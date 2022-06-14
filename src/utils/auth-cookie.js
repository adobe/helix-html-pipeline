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
import { parse, serialize } from 'cookie';

export function clearAuthCookie() {
  return serialize('hlx-auth-token', '', {
    path: '/',
    httpOnly: true,
    secure: true,
    expires: new Date(0),
    sameSite: 'lax',
  });
}

export function setAuthCookie(idToken) {
  return serialize('hlx-auth-token', idToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}

export function getAuthCookie(req) {
  // add cookies if not already present
  if (!req.cookies) {
    const hdr = req.headers.get('cookie');
    // eslint-disable-next-line no-param-reassign
    req.cookies = hdr ? parse(hdr) : {};
  }
  return req.cookies['hlx-auth-token'] || '';
}
