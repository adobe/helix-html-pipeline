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
import {
  createLocalJWKSet,
  decodeJwt,
  jwtVerify,
  SignJWT,
  importJWK,
} from 'jose';
import { clearAuthCookie, getAuthCookie, setAuthCookie } from './auth-cookie.js';

import idpMicrosoft from './idp-configs/microsoft.js';

// eslint-disable-next-line import/no-unresolved
import cryptoImpl from '#crypto';
import { PipelineResponse } from '../PipelineResponse.js';

const AUTH_REDIRECT_URL = 'https://login.aem.page/.auth';

let ADMIN_KEY_PAIR = null;

export class AccessDeniedError extends Error {
}

async function getAdminKeyPair(state) {
  if (!ADMIN_KEY_PAIR) {
    ADMIN_KEY_PAIR = {
      privateKey: await importJWK(JSON.parse(state.env.HLX_ADMIN_IDP_PRIVATE_KEY), 'RS256'),
      publicKey: JSON.parse(state.env.HLX_ADMIN_IDP_PUBLIC_KEY),
    };
  }
  return ADMIN_KEY_PAIR;
}

/**
 * Signs the given JWT with the admin private key and returns the token.
 * @param {PipelineState} state
 * @param {SignJWT} jwt
 * @returns {Promise<string>}
 */
async function signJWT(state, jwt) {
  const { privateKey, publicKey } = await getAdminKeyPair(state);
  return jwt
    .setProtectedHeader({
      alg: 'RS256',
      kid: publicKey.kid,
    })
    .setAudience(state.env.HLX_SITE_APP_AZURE_CLIENT_ID)
    .setIssuer(publicKey.issuer)
    .sign(privateKey);
}

/**
 * Verifies and decodes the given jwt using the admin public key
 * @param {PipelineState} state
 * @param {string} jwt
 * @param {boolean} lenient
 * @returns {Promise<JWTPayload>}
 */
async function verifyJwt(state, jwt, lenient = false) {
  const publicKey = JSON.parse(state.env.HLX_ADMIN_IDP_PUBLIC_KEY);
  const jwks = createLocalJWKSet({
    keys: [publicKey],
  });
  const { payload } = await jwtVerify(jwt, jwks, {
    audience: state.env.HLX_SITE_APP_AZURE_CLIENT_ID,
    issuer: publicKey.issuer,
    clockTolerance: lenient ? 7 * 24 * 60 * 60 : 0,
  });
  return payload;
}

/**
 * Decodes the given id_token for the given idp. if `lenient` is `true`, the clock tolerance
 * is set to 1 week. this allows to extract some profile information that can be used as login_hint.
 * @param {PipelineState} state
 * @param {string} idToken
 * @param {boolean} lenient
 * @returns {Promise<JWTPayload>}
 */
export async function decodeIdToken(state, idToken, lenient = false) {
  const { log } = state;
  const payload = await verifyJwt(state, idToken, lenient);

  // delete from information not needed in the profile
  ['azp', 'at_hash', 'nonce', 'aio', 'c_hash'].forEach((prop) => delete payload[prop]);

  // compute ttl
  payload.ttl = payload.exp - Math.floor(Date.now() / 1000);

  log.info(`[auth] decoded id_token${lenient ? ' (lenient)' : ''} from ${payload.iss} and validated payload.`);
  return payload;
}

/**
 * Returns the host of the request; falls back to the configured `host`.
 * Note that this is different from the `state.prodHost` calculation in `init-config`,
 * as this prefers the xfh over the config.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {{proto: (*|string), host: string}} the request host and protocol.
 */
export function getRequestHostAndProto(state, req) {
  // determine the location of 'this' document based on the xfh header. so that logins to
  // .page stay on .page. etc. but fallback to the config.host if non set
  const xfh = req.headers.get('x-forwarded-host');
  let host = xfh;
  if (host) {
    host = host.split(',')[0].trim();
  }
  if (!host) {
    host = state.prodHost;
  }
  // fastly overrides the x-forwarded-proto, so we use x-forwarded-scheme
  const proto = req.headers.get('x-forwarded-scheme') || req.headers.get('x-forwarded-proto') || 'https';
  state.log.info(`request host is: ${host} (${proto}) (xfh=${xfh})`);
  return {
    host,
    proto,
  };
}

/**
 * sets the auth error on the response and clears the cookie.
 * @param state
 * @param req
 * @param res
 * @param error
 * @param status
 */
export function makeAuthError(state, req, res, error, status = 401) {
  const { proto } = getRequestHostAndProto(state, req);
  res.status = status;
  res.error = error;
  res.headers.set('set-cookie', clearAuthCookie(proto === 'https'));
  res.headers.set('x-error', error);
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
  async redirectToLogin(state, req, res) {
    const { log } = state;
    const { idp } = this;

    await state.authEnvLoader.load(state);
    const { clientId, clientSecret } = idp.client(state);
    if (!clientId || !clientSecret) {
      log.error('[auth] unable to create login redirect: missing client_id or client_secret');
      res.status = 401;
      res.error = 'invalid auth config.';
      return;
    }

    // determine the location of 'this' document based on the xfh header. so that logins to
    // .page stay on .page. etc. but fallback to the config.host if non set
    const { host, proto } = getRequestHostAndProto(state, req);
    if (!host) {
      log.error('[auth] unable to create login redirect: no xfh or config.host.');
      makeAuthError(state, req, res, 'no host information.');
      return;
    }

    // create the token state, so stat we know where to redirect back after the token exchange
    const payload = {
      url: state.createExternalLocation(`${proto}://${host}${state.info.path}`),
    };
    const tokenState = await signJWT(state, new SignJWT(payload));

    const url = new URL(idp.discovery.authorization_endpoint);
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', idp.scope);
    url.searchParams.append('nonce', cryptoImpl.randomUUID());
    url.searchParams.append('state', tokenState);
    url.searchParams.append('redirect_uri', AUTH_REDIRECT_URL);
    url.searchParams.append('prompt', 'select_account');

    log.info('[auth] redirecting to login page', url.href);
    res.status = 302;
    res.body = '';
    res.headers.set('location', url.href);
    res.headers.set('set-cookie', clearAuthCookie(proto === 'https'));
    res.headers.set('cache-control', 'no-store, private, must-revalidate');
    res.error = 'moved';
  }

  /**
   * Performs a token exchange from the code flow and redirects to the root page
   *
   * @param {universalContext} ctx
   * @param {PipelineRequest} req
   * @return {PipelineResponse} res
   * @throws {Error} if the token exchange fails
   */
  async exchangeToken(ctx, req) {
    const { log } = ctx;
    const { idp } = this;

    const { code } = req.params;
    if (!code) {
      log.warn('[auth] code exchange failed: code parameter missing.');
      throw new Error('code exchange failed.');
    }

    const { clientId, clientSecret } = idp.client(ctx);
    const url = new URL(idp.discovery.token_endpoint);
    const body = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: AUTH_REDIRECT_URL,
    };
    const { fetch } = ctx;
    const ret = await fetch(url.href, {
      method: 'POST',
      body: new URLSearchParams(body).toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });
    if (!ret.ok) {
      log.warn(`[auth] code exchange failed: ${ret.status}`, await ret.text());
      throw new Error('code exchange failed.');
    }

    const tokenResponse = await ret.json();
    const { id_token: idToken } = tokenResponse;
    let payload;
    try {
      payload = decodeJwt(idToken);
    } catch (e) {
      log.warn(`[auth] id token from ${idp.name} is invalid: ${e.message}`);
      throw new Error('id token invalid.');
    }

    const email = payload.email || payload.preferred_username;
    if (!email) {
      log.warn(`[auth] id token from ${idp.name} is missing email or preferred_username`);
      throw new Error('id token invalid.');
    }

    // create new token
    const jwt = new SignJWT({
      email,
      name: payload.name,
    })
      .setIssuedAt()
      .setExpirationTime('12 hours');
    const authToken = await signJWT(ctx, jwt);

    // redirect to original page
    const location = req.params.state.url;
    log.info('[auth] redirecting to original page with hlx-auth-token cookie:', location);
    return new PipelineResponse(`please go to <a href="${location}">${location}</a>`, {
      status: 302,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': setAuthCookie(authToken, location.startsWith('https://')),
        'cache-control': 'no-store, private, must-revalidate',
        location,
      },
    });
  }
}

/**
 * Validates the auth state and code either with from query parameter or request header.
 * @param {UniversalContext} ctx
 * @param {PipelineRequest} req
 * @returns {Promise<void>}
 */
export async function validateAuthState(ctx, req) {
  const { log } = ctx;
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
    throw new Error('missing state parameter.');
  }

  try {
    const payload = await verifyJwt(ctx, req.params.state);
    req.params.state = {
      url: payload.url,
    };
  } catch (e) {
    log.warn(`[auth] error decoding state parameter: invalid state: ${e.message}`);
    throw new Error('invalid state parameter.');
  }
}

/**
 * Extracts the authentication info from the cookie or 'authorization' header.
 * Returns {@code null} if missing or invalid.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {Promise<AuthInfo>} the authentication info or null if the request is not authenticated
 */
async function getAuthInfoFromCookieOrHeader(state, req) {
  const { log } = state;
  let idToken = getAuthCookie(req);
  if (!idToken) {
    log.debug('no auth cookie');
    const [marker, value] = (req.headers.get('authorization') || '').split(' ');
    if (marker.toLowerCase() === 'token' && value) {
      idToken = value.trim();
    } else {
      log.debug('no auth header');
    }
  }
  if (idToken) {
    try {
      return AuthInfo.Default()
        .withProfile(await decodeIdToken(state, idToken))
        .withAuthenticated(true)
        .withIdToken(idToken);
    } catch (e) {
      if (e.code === 'ERR_JWT_EXPIRED') {
        try {
          const profile = await decodeIdToken(state, idToken, true);
          log.warn(`[auth] decoding the id_token failed: ${e.message}, using expired token as hint.`);
          return AuthInfo.Default()
            .withExpired(true)
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
  log.debug('no id_token');
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
  const auth = await getAuthInfoFromCookieOrHeader(state, req);
  if (auth) {
    if (auth.authenticated) {
      log.info(`[auth] id-token valid: iss=${auth.profile.iss}`);
    }
    if (!auth.idp) {
      // todo: select idp from config
      auth.withIdp(idpMicrosoft);
    }
    return auth;
  }
  return AuthInfo
    .Default()
    // todo: select idp from config
    .withIdp(idpMicrosoft);
}
