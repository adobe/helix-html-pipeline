/*
 * Copyright 2018 Adobe. All rights reserved.
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
import esmock from 'esmock';
import { authenticate, isAllowed } from '../../src/steps/authenticate.js';
import { PipelineRequest, PipelineResponse, PipelineState } from '../../src/index.js';

describe('Authenticate Test', () => {
  it('isAllowed() checks correctly', () => {
    assert.strictEqual(isAllowed('', ''), false);
    assert.strictEqual(isAllowed('foo@bar.com', ['foo@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['*@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['a', 'foo@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['*@zoo.com']), false);
  });

  it('authenticate does nothing if not configured', async () => {
    const state = new PipelineState({});
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authenticate(state, req, res);
    assert.strictEqual(res.error, undefined);
  });

  it('redirects to the login page', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          redirectToLogin(state, req, res) {
            res.status = 302;
          },
        }),
      },
    });
    const state = new PipelineState({});
    state.config.access = {
      allow: '*@adobe.com',
    };
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 302);
  });

  it('send 401 for unauthenticated .plain requests', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          redirectToLogin(state, req, res) {
            res.status = 302;
          },
        }),
      },
    });
    const state = new PipelineState({ path: '/nav.plain.html' });
    state.config.access = {
      allow: '*@adobe.com',
    };
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('.auth fetches the token', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          exchangeToken(state, req, res) {
            res.status = 302;
          },
        }),
      },
    });

    const state = new PipelineState({ path: '/.auth' });
    state.config.access = {
      allow: '*@adobe.com',
    };

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 302);
  });

  it('checks if profile is allowed (email)', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            iss: 'iss',
            jwk: { k: '123', alg: 'RSA' },
            kid: 'kid',
          },
        }),
      },
    });

    const state = new PipelineState({ path: '/' });
    state.config.access = {
      allow: ['*@adobe.com'],
    };

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(Object.fromEntries(res.headers), {
      'x-hlx-auth-allow': '*@adobe.com',
      'x-hlx-auth-aud': 'aud',
      'x-hlx-auth-iss': 'iss',
      'x-hlx-auth-jwk': '{"k":"123","alg":"RSA"}',
      'x-hlx-auth-kid': 'kid',
    });
  });

  it('checks if profile is allowed (preferred_username)', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            preferred_username: 'test@adobe.com',
          },
        }),
      },
    });

    const state = new PipelineState({ path: '/' });
    state.config.access = {
      allow: '*@adobe.com',
    };

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 200);
  });

  it('rejects invalid logins', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
          },
        }),
      },
    });

    const state = new PipelineState({ path: '/' });
    state.config.access = {
      allow: '*@adobe.com',
    };

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 403);
  });
});
