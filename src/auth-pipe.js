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
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineResponse } from './PipelineResponse.js';
import { validateAuthState, getAuthInfo } from './utils/auth.js';

/**
 * Runs the auth pipeline that handles the token exchange. this is separated from the main pipeline
 * since it doesn't need the configuration.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function authPipe(state, req) {
  const { log } = state;

  /** @type PipelineResponse */
  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });

  try {
    await validateAuthState(state, req);
    const authInfo = await getAuthInfo(state, req);
    await authInfo.exchangeToken(state, req, res);
    /* c8 ignore next */
    const level = res.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${res.status} ${res.error}`);
    res.headers.set('x-error', cleanupHeaderValue(res.error));
    if (res.status < 500) {
      await setCustomResponseHeaders(state, req, res);
    }
    return res;
  } catch (e) {
    return new PipelineResponse('', {
      status: 401,
      headers: {
        'cache-control': 'no-store, private, must-revalidate',
        'content-type': 'text/html; charset=utf-8',
        'x-error': e.message,
      },
    });
  }
}
