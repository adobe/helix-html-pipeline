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
import { createHash } from 'crypto';
import { PipelineResponse } from './PipelineResponse.js';
import fetchConfigAll from './steps/fetch-config-all.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import fetchConfig from './steps/fetch-config.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { getOriginalHost } from './steps/utils.js';

/**
 * Hashes the domain and domainkey
 * @param {string} domain the domain
 * @param {string|string[]} domainkeys the domainkey or domainkeys
 * @returns {string} the hash
 */
function hashMe(domain, domainkeys) {
  return (Array.isArray(domainkeys) ? domainkeys : [domainkeys]).map((dk) => {
    const hash = createHash('sha256');
    hash.update(domain);
    hash.update(dk);
    return hash.digest('hex');
  }).join(' ');
}

/**
 * If the request is a _rum-challenge request, then set the x-rum-challenge header
 * A rum-challenge request is an OPTIONS request to any path ending with _rum-challenge
 * and will return a 204 response with the x-rum-challenge header set to the hash of
 * the x-forwarded-host and the domainkey. If no domainkey has been set in .helix/config
 * then the `slack` channel will be used instead.
 * @param {object} state current pipeline state
 * @param {Request} request HTTP request
 * @param {Response} response HTTP response
 * @returns {void}
 */
function setDomainkeyHeader(state, request, response) {
  // nope out if path does not end with _rum-challenge
  if (!request.url.pathname.endsWith('/_rum-challenge')) {
    return;
  }
  // get x-forwarded-host
  const originalHost = getOriginalHost(request.headers);
  // get liveHost
  const { host } = state.config;

  if (originalHost !== host) {
    // these have to match
    state.log.debug(`x-forwarded-host: ${originalHost} does not match prod host: ${host}`);
    return;
  }
  // get domainkey from config
  const { domainkey } = state.config;
  // get slack channel from config
  const { slack } = state.config;
  let hash;
  if (typeof domainkey === 'string' || Array.isArray(domainkey)) {
    hash = hashMe(originalHost, domainkey);
  } else if (typeof slack === 'string' || Array.isArray(slack)) {
    hash = hashMe(originalHost, slack);
  }

  if (hash) {
    response.headers.set('x-rum-challenge', hash);
  }
}
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
    setDomainkeyHeader(state, request, res);

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
