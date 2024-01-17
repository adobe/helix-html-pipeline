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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { PipelineResponse } from './PipelineResponse.js';
import { validateAuthState, getRequestHostAndProto, AuthInfo } from './utils/auth.js';
import { clearAuthCookie } from './utils/auth-cookie.js';
import idpMicrosoft from './utils/idp-configs/microsoft.js';

/**
 * Runs the auth pipeline that handles the token exchange. this is separated from the main pipeline
 * since it doesn't need the configuration (yet).
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function authPipe(ctx, req) {
  try {
    await validateAuthState(ctx, req);
    const authInfo = AuthInfo
      .Default()
      // todo: select idp from config
      .withIdp(idpMicrosoft);
    return await authInfo.exchangeToken(ctx, req);
  } catch (e) {
    const { proto } = getRequestHostAndProto(ctx, req);
    return new PipelineResponse('', {
      status: 401,
      headers: {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/html; charset=utf-8',
        'x-error': cleanupHeaderValue(e.message),
        'set-cookie': clearAuthCookie(proto === 'https'),
      },
    });
  }
}
