/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
// eslint-disable-next-line max-classes-per-file
import crypto from 'crypto';
import {
  createLocalJWKSet, createRemoteJWKSet, decodeJwt, jwtVerify, UnsecuredJWT,
} from 'jose';
import { clearAuthCookie, getAuthCookie, setAuthCookie } from './auth-cookie.js';

import idpMicrosoft from './idp-configs/microsoft.js';

export const IDPS = [
  idpMicrosoft,
];

const AUTH_REDIRECT_URL = 'https://login.hlx.page/.auth';

export class AccessDeniedError extends Error {
}

/**
 * Decodes the given id_token for the given idp. if `lenient` is `true`, the clock tolerance
 * is set to 1 week. this allows to extract some profile information that can be used as login_hint.
 * @param {PipelineState} state
 * @param {IDPConfig} idp
 * @param {string} idToken
 * @param {boolean} lenient
 * @returns {Promise<JWTPayload>}
 */
export async function decodeIdToken(state, idp, idToken, lenient = false) {
  const { log } = state;
  const jwks = idp.discovery.jwks
    ? createLocalJWKSet(idp.discovery.jwks)
    : /* c8 ignore next */ createRemoteJWKSet(new URL(idp.discovery.jwks_uri));

  const { payload, key, protectedHeader } = await jwtVerify(idToken, jwks, {
    audience: idp.client(state).clientId,
    clockTolerance: lenient ? 7 * 24 * 60 * 60 : 0,
  });

  // delete from information not needed in the profile
  ['azp', 'sub', 'at_hash', 'nonce', 'aio', 'c_hash'].forEach((prop) => delete payload[prop]);

  // compute ttl
  payload.ttl = payload.exp - Math.floor(Date.now() / 1000);

  // export the public key
  payload.jwk = key.export({
    type: 'pkcs1',
    format: 'jwk',
  });
  payload.kid = protectedHeader.kid;

  log.info(`[auth] decoded id_token${lenient ? ' (lenient)' : ''} from ${payload.iss} and validated payload.`);
  return payload;
}

/**
 * AuthInfo class
 */
export class AuthInfo {
  /**
   * AuthInfo constructor
   * @constructor
   */
  constructor() {
    Object.assign(this, {
      authenticated: false,
      idp: null,
      profile: null,
      loginHint: null,
      expired: false,
      idToken: null,
      cookieInvalid: false,
    });
  }

  /**
   * Creates the default AuthInfo that is not authenticated.
   * @returns {AuthInfo}
   */
  static Default() {
    return new AuthInfo()
      .withAuthenticated(false);
  }

  withAuthenticated(value) {
    this.authenticated = value;
    return this;
  }

  withProfile(profile) {
    this.profile = profile;
    return this;
  }

  withLoginHint(value) {
    this.loginHint = value;
    return this;
  }

  withIdp(value) {
    this.idp = value;
    return this;
  }

  withExpired(value) {
    this.expired = value;
    return this;
  }

  withCookieInvalid(value) {
    this.cookieInvalid = value;
    return this;
  }

  withIdToken(value) {
    this.idToken = value;
    return this;
  }

  /**
   * Sets a redirect (302) response to the IDPs login endpoint
   *
   * @param {PipelineState} state
   * @param {PipelineRequest} req
   * @param {PipelineResponse} res
   * @param {IDPConfig} idp IDP config
   */
  redirectToLogin(state, req, res) {
    const { log } = state;
    const { idp } = this;

    const { clientId, clientSecret } = idp.client(state);
    if (!clientId || !clientSecret) {
      log.error('[auth] unable to create login redirect: missing client_id or client_secret');
      res.status = 500;
      res.error = 'invalid auth config.';
      return;
    }

    // determine the location of 'this' document based on the xfh header. so that logins to
    // .page stay on .page. etc. but fallback to the config.host if non set
    let host = req.headers.get('x-forwarded-host');
    if (host) {
      host = host.split(',')[0].trim();
    }
    if (!host) {
      host = state.config.host;
    }
    if (!host) {
      log.error('[auth] unable to create login redirect: no xfh or config.host.');
      res.status = 401;
      res.error = 'no host information.';
      return;
    }

    const url = new URL(idp.discovery.authorization_endpoint);

    // todo: properly sign to avoid CSRF
    const tokenState = new UnsecuredJWT({
      owner: state.owner,
      repo: state.repo,
      contentBusId: state.contentBusId,
      // this is our own login redirect, i.e. the current document
      requestPath: state.info.path,
      requestHost: host,
    }).encode();

    url.searchParams.append('client_id', clientId);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', idp.scope);
    url.searchParams.append('nonce', crypto.randomUUID());
    url.searchParams.append('state', tokenState);
    url.searchParams.append('redirect_uri', state.createExternalLocation(AUTH_REDIRECT_URL));
    url.searchParams.append('prompt', 'select_account');

    log.info('[auth] redirecting to login page', url.href);
    res.status = 302;
    res.body = '';
    res.headers.set('location', url.href);
    res.headers.set('set-cookie', clearAuthCookie());
    res.headers.set('cache-control', 'no-store, private, must-revalidate');
    res.error = 'moved';
  }

  /**
   * Performs a token exchange from the code flow and redirects to the root page
   *
   * @param {PipelineState} state
   * @param {PipelineRequest} req
   * @param {PipelineResponse} res
   */
  async exchangeToken(state, req, res) {
    const { log } = state;
    const { idp } = this;

    const { code } = req.params;
    if (!code) {
      log.warn('[auth] code exchange failed: code parameter missing.');
      res.status = 401;
      res.error = 'code exchange failed.';
      return;
    }

    // ensure that the request is made to the target host
    if (req.params.state?.requestHost) {
      const host = req.headers.get('x-forwarded-host') || state.config.host;
      if (host !== req.params.state.requestHost) {
        const url = new URL(`https://${req.params.state.requestHost}/.auth`);
        url.searchParams.append('state', req.params.rawState);
        url.searchParams.append('code', req.params.code);
        const location = state.createExternalLocation(url.href);
        log.info('[auth] redirecting to initial host', location);
        res.status = 302;
        res.body = `please go to <a href="${location}">${location}</a>`;
        res.headers.set('location', location);
        res.headers.set('cache-control', 'no-store, private, must-revalidate');
        res.error = 'moved';
        return;
      }
    }

    const { clientId, clientSecret } = idp.client(state);
    const url = new URL(idp.discovery.token_endpoint);
    const body = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: state.createExternalLocation(AUTH_REDIRECT_URL),
    };
    const ret = await state.fetch(url.href, {
      method: 'POST',
      body: new URLSearchParams(body).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });
    if (!ret.ok) {
      log.warn(`[auth] code exchange failed: ${ret.status}`, await ret.text());
      res.status = 401;
      res.error = 'code exchange failed.';
      return;
    }

    const tokenResponse = await ret.json();
    const { id_token: idToken } = tokenResponse;
    try {
      await decodeIdToken(state, idp, idToken);
    } catch (e) {
      log.warn(`[auth] id token from ${idp.name} is invalid: ${e.message}`);
      res.status = 401;
      res.error = 'id token invalid.';
      return;
    }

    // ensure that auth cookie is not cleared again in `index.js`
    // ctx.attributes.authInfo?.withCookieInvalid(false);

    const location = state.createExternalLocation(req.params.state.requestPath || '/');
    log.info('[auth] redirecting to home page with id_token cookie', location);
    res.status = 302;
    res.body = `please go to <a href="${location}">${location}</a>`;
    res.headers.set('location', location);
    res.headers.set('content-tye', 'text/plain');
    res.headers.set('set-cookie', setAuthCookie(idToken));
    res.headers.set('cache-control', 'no-store, private, must-revalidate');
    res.error = 'moved';
  }
}

export function initAuthRoute(state, req, res) {
  const { log } = state;

  // use request headers if present
  if (req.headers.get('x-hlx-auth-state')) {
    log.info('[auth] override params.state from header.');
    req.params.state = req.headers.get('x-hlx-auth-state');
  }
  if (req.headers.get('x-hlx-auth-code')) {
    log.info('[auth] override params.code from header.');
    req.params.code = req.headers.get('x-hlx-auth-code');
  }

  if (!req.params.state) {
    log.warn('[auth] unable to exchange token: no state.');
    res.status = 401;
    res.headers.set('x-error', 'missing state parameter.');
    return false;
  }

  try {
    req.params.rawState = req.params.state;
    req.params.state = decodeJwt(req.params.state);
  } catch (e) {
    log.warn(`[auth] error decoding state parameter: invalid state: ${e.message}`);
    res.status = 401;
    res.headers.set('x-error', 'missing state parameter.');
    return false;
  }

  // fixup pipeline state
  state.owner = req.params.state.owner;
  state.repo = req.params.state.repo;
  state.ref = 'main';
  state.contentBusId = req.params.state.contentBusId;
  state.partition = 'preview';
  state.info.path = '/.auth';
  return true;
}

/**
 * Extracts the authentication info from the cookie. Returns {@code null} if missing or invalid.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {Promise<AuthInfo>} the authentication info or null if the request is not authenticated
 */
async function getAuthInfoFromCookie(state, req) {
  const { log } = state;
  const idToken = getAuthCookie(req);
  if (idToken) {
    let idp;
    try {
      const { iss } = decodeJwt(idToken);
      if (!iss) {
        log.warn('[auth] missing \'iss\' claim in id_token.');
        return AuthInfo.Default().withCookieInvalid(true);
      }
      idp = IDPS.find((i) => i.validateIssuer(iss));
      if (!idp) {
        log.warn(`[auth] no IDP found for: ${iss}`);
        return AuthInfo.Default().withCookieInvalid(true);
      }
      return AuthInfo.Default()
        .withProfile(await decodeIdToken(state, idp, idToken))
        .withAuthenticated(true)
        .withIdp(idp)
        .withIdToken(idToken);
    } catch (e) {
      if (e.code === 'ERR_JWT_EXPIRED' && idp) {
        try {
          const profile = await decodeIdToken(state, idp, idToken, true);
          log.warn(`[auth] decoding the id_token failed: ${e.message}, using expired token as hint.`);
          return AuthInfo.Default()
            .withExpired(true)
            .withIdp(idp)
            .withLoginHint(profile.email);
        } catch {
          // ignore
        }
      }
      // wrong token
      log.warn(`[auth] decoding the id_token failed: ${e.message}.`);
      return AuthInfo.Default().withCookieInvalid(true);
    }
  }
  return null;
}

/**
 * Computes the authentication info.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {Promise<AuthInfo>} the authentication info or null if the request is not authenticated
 */
export async function getAuthInfo(state, req) {
  const { log } = state;
  const auth = await getAuthInfoFromCookie(state, req);
  if (auth) {
    if (auth.authenticated) {
      log.info(`[auth] id-token valid: iss=${auth.profile.iss}`);
    }
    return auth;
  }
  return AuthInfo
    .Default()
    // todo: select idp from config
    .withIdp(idpMicrosoft);
}
