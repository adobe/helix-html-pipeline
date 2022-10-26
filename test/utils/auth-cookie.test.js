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

describe('Auth Cookie Test', () => {
  it('clears the auth cookie', () => {
    assert.strictEqual(clearAuthCookie(), 'hlx-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
  });

  it('clears the auth cookie (secure)', () => {
    assert.strictEqual(clearAuthCookie(true), 'hlx-auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax');
  });

  it('sets the auth cookie', () => {
    assert.strictEqual(
      setAuthCookie('1234'),
      'hlx-auth-token=1234; Path=/; HttpOnly; SameSite=Lax',
    );
  });

  it('sets the auth cookie (secure)', () => {
    assert.strictEqual(
      setAuthCookie('1234', true),
      'hlx-auth-token=1234; Path=/; HttpOnly; Secure; SameSite=Lax',
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
