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

/* eslint-env mocha */
import assert from 'assert';
import { clearAuthCookie, getAuthCookie, setAuthCookie } from '../../src/utils/auth-cookie.js';
import { PipelineRequest } from '../../src/index.js';

describe('Auth Cookie Test', () => {
  const DEFAULT_REQUEST = (host = 'main--helix-website--adobe.hlx.page') => new PipelineRequest('https://foo', {
    headers: {
      host,
    },
  });
  it('clears the auth cookie', () => {
    assert.strictEqual(clearAuthCookie(DEFAULT_REQUEST()), 'hlx-auth-token=; Domain=hlx.page; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  });

  it('clears the auth cookie (secure)', () => {
    assert.strictEqual(clearAuthCookie(DEFAULT_REQUEST(), true), 'hlx-auth-token=; Domain=hlx.page; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=None');
  });

  it('sets the auth cookie', () => {
    assert.strictEqual(
      setAuthCookie(DEFAULT_REQUEST(), '1234'),
      'hlx-auth-token=1234; Domain=hlx.page; Path=/; HttpOnly; SameSite=Lax',
    );
  });

  it('sets the auth cookie (.live)', () => {
    assert.strictEqual(
      setAuthCookie(DEFAULT_REQUEST('main--helix-website--adobe.hlx.live'), '1234'),
      'hlx-auth-token=1234; Domain=hlx.live; Path=/; HttpOnly; SameSite=Lax',
    );
  });

  it('sets the auth cookie (prod)', () => {
    assert.strictEqual(
      setAuthCookie(DEFAULT_REQUEST('blog.adobe.com'), '1234'),
      'hlx-auth-token=1234; Path=/; HttpOnly; SameSite=Lax',
    );
  });

  it('sets the auth cookie (secure)', () => {
    assert.strictEqual(
      setAuthCookie(DEFAULT_REQUEST(), '1234', true),
      'hlx-auth-token=1234; Domain=hlx.page; Path=/; HttpOnly; Secure; SameSite=None',
    );
  });

  it('gets the auth cookie', () => {
    const info = {
      headers: new Map(Object.entries({
        cookie: 'hlx-auth-token=1234',
      })),
    };
    assert.deepStrictEqual(getAuthCookie(info), '1234');

    const { cookies } = info;
    getAuthCookie(info);
    assert.strictEqual(cookies, info.cookies, 'req.cookies should not be parsed twice');
  });

  it('gets the auth cookie if no header', () => {
    const info = {
      headers: new Map(),
    };
    assert.deepStrictEqual(getAuthCookie(info), '');
  });
});
