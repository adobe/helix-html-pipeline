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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { PipelineResponse } from './PipelineResponse.js';
import fetchConfigAll from './steps/fetch-config-all.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import fetchConfig from './steps/fetch-config.js';
import { PipelineStatusError } from './PipelineStatusError.js';

/**
 * Handles options requests
 * @param {PipelineState} state pipeline options
 * @param {PipelineRequest} request
 * @returns {Response} a response
 */
export async function optionsPipe(state, request) {
  try {
    await fetchConfig(state, request);
    if (!state.contentBusId) {
      return new PipelineResponse('', {
        status: 400,
        headers: {
          'x-error': 'contentBusId missing',
        },
      });
    }

    // todo: improve
    const res = new PipelineResponse('', {
      status: 204,
      headers: {
        // Set preflight cache duration
        'access-control-max-age': '86400',
        // Allow content type header
        'access-control-allow-headers': 'content-type',
      },
    });
    await fetchConfigAll(state, request, res);
    await setCustomResponseHeaders(state, request, res);

    return res;
  } catch (e) {
    const res = new PipelineResponse('', {
      status: e instanceof PipelineStatusError ? e.code : 500,
    });
    const level = res.status >= 500 ? 'error' : 'info';
    state.log[level](`pipeline status: ${res.status} ${e.message}`);
    res.headers.set('x-error', cleanupHeaderValue(e.message));
    res.headers.set('cache-control', 'no-store, private, must-revalidate');
    return res;
  }
}
