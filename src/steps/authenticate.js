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
import { getAuthInfo } from '../utils/auth.js';

/**
 * Checks if the given email is allowed.
 * @param {string} email
 * @param {string[]} allows
 * @returns {boolean}
 */
export function isAllowed(email = '', allows = []) {
  /** @type string[] */
  const [, domain] = email.split('@');
  if (!domain) {
    return false;
  }
  const wild = `*@${domain}`;
  return allows.findIndex((a) => a === email || a === wild) >= 0;
}

/**
 * Handles authentication
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export async function authenticate(state, req, res) {
  // get auth info
  const authInfo = await getAuthInfo(state, req);

  // check if `.auth` route to validate and exchange token
  if (state.info.path === '/.auth') {
    await authInfo.exchangeToken(state, req, res);
    return;
  }

  // if not protected, do nothing
  if (!state.config?.access?.allow) {
    return;
  }

  // if not authenticated, redirect to login screen
  if (!authInfo.authenticated) {
    // send 401 for plain requests
    if (state.info.selector || state.type !== 'html') {
      state.log.warn('[auth] unauthorized. redirect to login only for extension less html.');
      res.status = 401;
      res.error = 'unauthorized.';
      return;
    }
    authInfo.redirectToLogin(state, req, res);
    return;
  }

  // check profile is allowed
  const { allow } = state.config.access;
  const allows = Array.isArray(allow) ? allow : [allow];
  if (!isAllowed(authInfo.profile.email || authInfo.profile.preferred_username, allows)) {
    state.log.warn(`[auth] profile not allowed for ${allows}`);
    res.status = 403;
    res.error = 'forbidden.';
  }

  // set some response headers for deferred edge authentication
  // AdobePatentID="P11443-US"
  res.headers.set('x-hlx-auth-allow', allows.join(','));
  if (authInfo.profile) {
    res.headers.set('x-hlx-auth-iss', authInfo.profile.iss);
    res.headers.set('x-hlx-auth-kid', authInfo.profile.kid);
    res.headers.set('x-hlx-auth-aud', authInfo.profile.aud);
    res.headers.set('x-hlx-auth-key', authInfo.profile.pem);
  }
}
