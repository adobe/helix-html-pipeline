/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { authPipe, PipelineRequest } from '../src/index.js';
import { Response } from './utils.js';

describe('Auth Pipe Test', () => {
  it('handles /.auth route', async () => {
    const keyPair = await generateKeyPair('RS256');
    const { privateKey, publicKey } = keyPair;
    const env = {
      HLX_ADMIN_IDP_PUBLIC_KEY: JSON.stringify({
        ...await exportJWK(publicKey),
        kid: 'dummy-kid',
      }),
      HLX_ADMIN_IDP_PRIVATE_KEY: JSON.stringify(await exportJWK(privateKey)),
      HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
    };

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

    const tokenState = await new SignJWT({
      url: 'https://www.hlx.live/en',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .sign(privateKey);

    const ctx = {
      env,
      log: console,
      fetch: () => new Response({
        id_token: idToken,
      }),
    };
    const req = new PipelineRequest('https://localhost/.auth', {
      headers: new Map(Object.entries({
        'x-hlx-auth-state': tokenState,
        'x-hlx-auth-code': '1234-code',
      })),
    });
    const resp = await authPipe(ctx, req);
    assert.strictEqual(resp.status, 302);
    assert.strictEqual(resp.headers.get('location'), 'https://www.hlx.live/en');
  });

  it('handles error in the /.auth route', async () => {
    const ctx = {
      log: console,
    };
    const req = new PipelineRequest('https://localhost/.auth', {
      headers: new Map(Object.entries({
        'x-hlx-auth-state': 'invalid',
        'x-hlx-auth-code': '1234-code',
      })),
    });
    const resp = await authPipe(ctx, req);
    assert.strictEqual(resp.status, 401);
  });
});
