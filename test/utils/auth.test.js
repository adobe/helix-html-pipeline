/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
import assert from 'assert';
import {
  generateKeyPair, exportJWK, SignJWT, decodeJwt,
} from 'jose';
import {
  getAuthInfo,
  initAuthRoute,
  AuthInfo,
} from '../../src/utils/auth.js';

import { Response } from '../utils.js';

import idpFakeTestIDP from './fixtures/test-idp.js';
import idpMicrosoft from '../../src/utils/idp-configs/microsoft.js';

import { PipelineRequest, PipelineResponse, PipelineState } from '../../src/index.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
};

describe('Auth Test', () => {
  const DEFAULT_INFO = {
    org: 'org',
    site: 'site',
    ref: 'ref',
    path: '/',
    resourcePath: '/index.md',
    headers: {},
    query: {},
    scheme: 'https',
    host: 'admin.hlx.page',
    functionPath: '',
  };

  let privateKey;
  let env;

  before(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    env = {
      HLX_ADMIN_IDP_PUBLIC_KEY: JSON.stringify({
        ...await exportJWK(keyPair.publicKey),
        kid: 'dummy-kid',
      }),
      HLX_ADMIN_IDP_PRIVATE_KEY: JSON.stringify(await exportJWK(privateKey)),
      HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
    };
  });

  const DEFAULT_STATE = (config = DEFAULT_CONFIG) => (new PipelineState({
    config,
    site: 'site',
    org: 'org',
    ref: 'ref',
    partition: 'preview',
    env,
  }));

  it('getAuthInfo returns unauthenticated if no cookie or header', async () => {
    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://www.hlx.live');
    const authInfo = await getAuthInfo(state, req);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo rejects invalid auth header token', async () => {
    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://www.hlx.live', {
      headers: {
        authorization: 'Token 1234',
      },
    });
    const authInfo = await getAuthInfo(state, req);
    assert.strictEqual(authInfo.cookieInvalid, true);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo rejects malformed auth header token', async () => {
    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://www.hlx.live', {
      headers: {
        authorization: 'Token',
      },
    });
    const authInfo = await getAuthInfo(state, req);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo rejects invalid JWT', async () => {
    const state = DEFAULT_STATE();
    const authInfo = await getAuthInfo(state, {
      cookies: {
        'hlx-auth-token': '123',
      },
    });
    assert.strictEqual(authInfo.cookieInvalid, true);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo rejects missing issuer', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    state.env = {};
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    assert.strictEqual(authInfo.cookieInvalid, true);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo rejects missing idp', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('foo')
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    state.env = {};
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    assert.strictEqual(authInfo.cookieInvalid, true);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('getAuthInfo properly decodes the id token', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    assert.ok(authInfo.profile.exp);
    assert.ok(authInfo.profile.iat);
    delete authInfo.profile.exp;
    delete authInfo.profile.iat;
    assert.strictEqual(authInfo.authenticated, true);
    assert.ok(Math.abs(authInfo.profile.ttl - 7200) < 2);
    delete authInfo.profile.ttl;
    delete authInfo.profile.pem;
    assert.deepStrictEqual(authInfo.profile, {
      aud: 'dummy-clientid',
      email: 'bob',
      iss: 'urn:example:issuer',
      name: 'Bob',
      userId: '112233',
    });
  });

  it('decodes the token leniently', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime(Math.floor(Date.now() / 1000 - 10))
      .sign(privateKey);

    const state = DEFAULT_STATE();
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    assert.strictEqual(authInfo.expired, true);
    assert.strictEqual(authInfo.loginHint, 'bob');
    assert.strictEqual(authInfo.profile, null);
    assert.strictEqual(authInfo.authenticated, false);
  });

  it('rejects too old id_token', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime(Math.floor(Date.now() / 1000 - 8 * 24 * 60 * 60))
      .sign(privateKey);

    const state = DEFAULT_STATE();
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    assert.strictEqual(authInfo.cookieInvalid, true);
  });

  it('redirects to the login page if token is expired', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime(Math.floor(Date.now() / 1000 - 8 * 24 * 60 * 60))
      .sign(privateKey);

    const state = new PipelineState({
      site: 'helix-pages',
      org: 'adobe',
      ref: 'ref',
      partition: 'preview',
      config: DEFAULT_CONFIG,
      env: {
        HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
        HLX_SITE_APP_AZURE_CLIENT_SECRET: 'dummy',
      },
      authEnvLoader: {
        load: (s) => Object.assign(s.env, env),
      },
    });
    const authInfo = await getAuthInfo(state, {
      ...DEFAULT_INFO,
      cookies: {
        'hlx-auth-token': idToken,
      },
    });

    state.prodHost = 'www.hlx.live';
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);

    assert.strictEqual(res.status, 302);

    const loc = new URL(res.headers.get('location'));
    const sp = Object.fromEntries(loc.searchParams.entries());
    loc.search = '';
    assert.strictEqual(loc.href, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    delete sp.nonce;
    sp.state = decodeJwt(sp.state);
    assert.deepStrictEqual(sp, {
      client_id: 'dummy-clientid',
      prompt: 'select_account',
      redirect_uri: 'https://login.hlx.page/.auth',
      response_type: 'code',
      scope: 'openid profile email',
      state: {
        aud: 'dummy-clientid',
        requestHost: 'www.hlx.live',
        requestPath: '/',
        requestProto: 'https',
        org: 'adobe',
        site: 'helix-pages',
      },
    });
  });
});

describe('Init Auth Route tests', () => {
  let privateKey;
  let env;

  before(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    env = {
      HLX_ADMIN_IDP_PUBLIC_KEY: JSON.stringify({
        ...await exportJWK(keyPair.publicKey),
        kid: 'dummy-kid',
      }),
      HLX_ADMIN_IDP_PRIVATE_KEY: JSON.stringify(await exportJWK(privateKey)),
      HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
    };
  });

  const DEFAULT_STATE = (config = DEFAULT_CONFIG) => (new PipelineState({
    config,
    site: 'site',
    org: 'org',
    ref: 'ref',
    partition: 'preview',
    env,
  }));

  it('rejects missing state params', async () => {
    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();

    assert.strictEqual(await initAuthRoute(state, req, res), false);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers.get('x-error'), 'missing state parameter.');
    assert.strictEqual(res.headers.get('set-cookie'), 'hlx-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=None');
  });

  it('rejects invalid state parameter', async () => {
    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost?state=123');
    const res = new PipelineResponse();

    assert.strictEqual(await initAuthRoute(state, req, res), false);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers.get('x-error'), 'missing state parameter.');
  });

  it('uses correct state parameter via header', async () => {
    const tokenState = await new SignJWT({
      owner: 'owner',
      repo: 'repo',
      contentBusId: 'foo-id',
      // this is our own login redirect, i.e. the current document
      requestPath: '/en',
      requestHost: 'www.hlx.live',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost', {
      headers: new Map(Object.entries({
        'x-hlx-auth-state': tokenState,
        'x-hlx-auth-code': '1234-code',
      })),
    });
    const res = new PipelineResponse();

    assert.strictEqual(await initAuthRoute(state, req, res), true);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(req.params, {
      code: '1234-code',
      rawState: tokenState,
      state: {
        contentBusId: 'foo-id',
        owner: 'owner',
        repo: 'repo',
        requestHost: 'www.hlx.live',
        requestPath: '/en',
      },
    });
  });
});

describe('AuthInfo tests', () => {
  let privateKey;
  let env;

  before(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    env = {
      HLX_ADMIN_IDP_PUBLIC_KEY: JSON.stringify({
        ...await exportJWK(keyPair.publicKey),
        kid: 'dummy-kid',
      }),
      HLX_ADMIN_IDP_PRIVATE_KEY: JSON.stringify(await exportJWK(privateKey)),
      HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
    };
  });

  const DEFAULT_STATE = (config = DEFAULT_CONFIG, opts = {}) => (new PipelineState({
    config,
    site: 'site',
    org: 'org',
    ref: 'ref',
    partition: 'preview',
    env,
    ...opts,
  }));

  it('redirects to the login page', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    state.prodHost = 'www.hlx.live';
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);

    assert.strictEqual(res.status, 302);

    const loc = new URL(res.headers.get('location'));
    const sp = Object.fromEntries(loc.searchParams.entries());
    loc.search = '';
    assert.strictEqual(loc.href, 'https://accounts.example.com/o/oauth2/v2/auth');
    delete sp.nonce;
    sp.state = decodeJwt(sp.state);
    assert.deepStrictEqual(sp, {
      client_id: 'dummy-clientid',
      prompt: 'select_account',
      redirect_uri: 'https://login.hlx.page/.auth',
      response_type: 'code',
      scope: 'openid profile email',
      state: {
        aud: 'dummy-clientid',
        requestHost: 'www.hlx.live',
        requestPath: '/',
        requestProto: 'https',
        org: 'org',
        site: 'site',
      },
    });
  });

  it('redirects to the login page (xfh)', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        'x-forwarded-host': 'www.hlx.live',
      },
    });
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 302);
    const reqState = new URL(res.headers.get('location')).searchParams.get('state');
    assert.deepStrictEqual(decodeJwt(reqState), {
      aud: 'dummy-clientid',
      requestHost: 'www.hlx.live',
      requestProto: 'https',
      requestPath: '/',
      org: 'org',
      site: 'site',
    });
  });

  it('redirects to the login page (xfh, proto)', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        'x-forwarded-host': 'localhost',
        'x-forwarded-proto': 'http',
      },
    });
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 302);
    const reqState = new URL(res.headers.get('location')).searchParams.get('state');
    assert.deepStrictEqual(decodeJwt(reqState), {
      aud: 'dummy-clientid',
      requestHost: 'localhost',
      requestProto: 'http',
      requestPath: '/',
      org: 'org',
      site: 'site',
    });
  });

  it('redirects to the login page (xfh, scheme)', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        'x-forwarded-host': 'localhost',
        'x-forwarded-scheme': 'http',
        'x-forwarded-proto': 'ftp',
      },
    });
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 302);
    const reqState = new URL(res.headers.get('location')).searchParams.get('state');
    assert.deepStrictEqual(decodeJwt(reqState), {
      aud: 'dummy-clientid',
      requestHost: 'localhost',
      requestProto: 'http',
      requestPath: '/',
      org: 'org',
      site: 'site',
    });
  });

  it('redirects to the login page (xfh - multi)', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE(DEFAULT_CONFIG, {
      path: '/en/blog',
    });
    const req = new PipelineRequest('https://localhost/', {
      headers: {
        'x-forwarded-host': 'bla.live, foo.page',
      },
    });
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 302);
    const reqState = new URL(res.headers.get('location')).searchParams.get('state');
    assert.deepStrictEqual(decodeJwt(reqState), {
      aud: 'dummy-clientid',
      requestHost: 'bla.live',
      requestProto: 'https',
      requestPath: '/en/blog',
      org: 'org',
      site: 'site',
    });
  });

  it('redirects fails if not host', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost/');
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.error, 'no host information.');
  });

  it('redirects to the login page needs client id', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp({
        client: () => ({
          clientId: 'client-id',
        }),
      });

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('redirects to the login page needs client secret', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp({
        client: () => ({
          clientSecret: 'client-secret',
        }),
      });

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authInfo.redirectToLogin(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('exchangeToken requires code parameter', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('exchangeToken redirects to the original host', async () => {
    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const state = DEFAULT_STATE();
    state.prodHost = 'www.adobe.com';
    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestPath: '/en',
      requestHost: 'localhost',
      requestProto: 'http',
    };
    req.params.rawState = 'raw';

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), 'http://localhost/.auth?state=raw&code=1234');
  });

  it('exchangeToken fetches the token', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    let fetched;
    const state = DEFAULT_STATE();
    state.fetch = (url) => {
      fetched = url;
      return new Response({
        id_token: idToken,
      });
    };

    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestPath: '/en',
      requestHost: 'localhost',
      requestProto: 'https',
    };
    req.headers.set('x-forwarded-host', 'localhost');

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(fetched, 'https://www.example.com/token');
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), '/en');
  });

  it('exchangeToken redirects to / if needed', async () => {
    const idToken = await new SignJWT({
      email: 'bob',
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    state.fetch = () => new Response({ id_token: idToken });

    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestHost: 'localhost',
    };
    req.headers.set('x-forwarded-host', 'localhost');

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), '/');
  });

  it('exchangeToken handles missing email', async () => {
    const idToken = await new SignJWT({
      name: 'Bob',
      userId: '112233',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuedAt()
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .setExpirationTime('2h')
      .sign(privateKey);

    const state = DEFAULT_STATE();
    state.fetch = () => new Response({ id_token: idToken });

    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestHost: 'localhost',
    };
    req.headers.set('x-forwarded-host', 'localhost');

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('exchangeToken handles fetch errors', async () => {
    const state = DEFAULT_STATE();
    state.fetch = () => new Response('not found', {
      status: 404,
    });

    const authInfo = AuthInfo
      .Default()
      .withIdp(idpFakeTestIDP);

    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestPath: '/en',
      requestHost: 'localhost',
    };
    req.headers.set('x-forwarded-host', 'localhost');

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('exchangeToken handles decode errors', async () => {
    const state = DEFAULT_STATE();
    state.fetch = () => new Response('gobledegook', {
      status: 200,
    });

    const authInfo = AuthInfo
      .Default()
      .withIdp(idpMicrosoft);

    const req = new PipelineRequest('https://localhost?code=1234');
    req.params.state = {
      requestPath: '/en',
      requestHost: 'localhost',
    };
    req.headers.set('x-forwarded-host', 'localhost');

    const res = new PipelineResponse();
    await authInfo.exchangeToken(state, req, res);
    assert.strictEqual(res.status, 401);
  });
});
