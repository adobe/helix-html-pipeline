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
import {
  authenticate,
  isAllowed,
  isOwnerRepoAllowed,
} from '../../src/steps/authenticate.js';
import { PipelineRequest, PipelineResponse, PipelineState } from '../../src/index.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
};

describe('Authenticate Test', () => {
  it('isAllowed() checks correctly', () => {
    assert.strictEqual(isAllowed('', ''), false);
    assert.strictEqual(isAllowed('foo@bar.com', ['foo@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['*@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['a', 'foo@bar.com']), true);
    assert.strictEqual(isAllowed('foo@bar.com', ['*@zoo.com']), false);
  });

  it('authenticate does nothing if not configured', async () => {
    const state = new PipelineState({ config: DEFAULT_CONFIG });
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
    const state = new PipelineState({
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });
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
    const state = new PipelineState({
      path: '/nav.plain.html',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });
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

    const state = new PipelineState({
      path: '/.auth',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

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
            pem: '1234',
            kid: 'kid',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

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

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 403);
  });

  it('accepts subject logins', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            sub: 'owner/repo',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 200);
  });

  it('accepts subject logins (wildcard)', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            sub: 'owner/*',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 200);
  });

  it('rejects wrong subject logins', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            sub: 'foo/bar',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['*@adobe.com'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('rejects wrong jit logins', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            jti: '1234',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['*@adobe.com'],
            apiKeyId: ['foo'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 401);
  });

  it('accept correct jit logins', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'test@adobe.com',
            aud: 'aud',
            jti: '1234',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['*@adobe.com'],
            apiKeyId: ['foo', '1234'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 200);
  });

  it('reject correct jit logins with wrong user', async () => {
    const { authenticate: authProxy } = await esmock('../../src/steps/authenticate.js', {
      '../../src/utils/auth.js': {
        getAuthInfo: () => ({
          authenticated: true,
          profile: {
            email: 'helix@adobe.com',
            aud: 'aud',
            jti: '1234',
          },
        }),
      },
    });

    const state = new PipelineState({
      path: '/',
      partition: 'preview',
      config: {
        ...DEFAULT_CONFIG,
        owner: 'owner',
        repo: 'repo',
        access: {
          preview: {
            allow: ['foo@adobe.com'],
            apiKeyId: ['foo', '1234'],
          },
        },
      },
    });

    const req = new PipelineRequest('https://localhost/?code=123');
    const res = new PipelineResponse();
    await authProxy(state, req, res);
    assert.strictEqual(res.status, 403);
  });

  it('isOwnerRepoAllow() checks correctly', () => {
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website'), true);
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website', ['adobe/*']), true);
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website', ['adobe/helix-website']), true);
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website', ['adobe/foobar']), false);
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website', ['demo/*']), false);
    assert.strictEqual(isOwnerRepoAllowed('adobe', 'helix-website', ['demo/*', 'adobe/*']), true);
  });

  // it('allows project if no required in config', async () => {
  //   const state = new PipelineState({ path: '/', config: DEFAULT_CONFIG });
  //   const req = new PipelineRequest('https://localhost/');
  //   const res = new PipelineResponse();
  //   await requireProject(state, req, res);
  //   assert.strictEqual(res.status, 200);
  // });

  // it('rejects project not configured', async () => {
  //   const state = new PipelineState({
  //     path: '/',
  //     owner: 'foo',
  //     repo: 'helix-test',
  //   });
  //   state.config.access = {
  //     require: {
  //       repository: 'adobe/*',
  //     },
  //   };
  //
  //   const req = new PipelineRequest('https://localhost/');
  //   const res = new PipelineResponse();
  //
  //   await requireProject(state, req, res);
  //   assert.strictEqual(res.status, 403);
  // });

  // it('allows project configured', async () => {
  //   const state = new PipelineState({
  //     path: '/',
  //     owner: 'foo',
  //     repo: 'helix-test',
  //   });
  //   state.config.access = {
  //     require: {
  //       repository: [
  //         'adobe/*',
  //         'foo/helix-test',
  //       ],
  //     },
  //   };
  //
  //   const req = new PipelineRequest('https://localhost/');
  //   const res = new PipelineResponse();
  //
  //   await requireProject(state, req, res);
  //   assert.strictEqual(res.status, 200);
  // });
});
