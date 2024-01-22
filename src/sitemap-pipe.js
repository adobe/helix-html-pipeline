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
import { authenticate, requireProject } from './steps/authenticate.js';
import fetchConfig from './steps/fetch-config.js';
import fetchContent from './steps/fetch-content.js';
import fetchConfigAll from './steps/fetch-config-all.js';
import renderCode from './steps/render-code.js';
import setXSurrogateKeyHeader from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';

/**
 * Serves or renders the sitemap xml. The sitemap is always served from the preview content-bus
 * partition.
 *
 * todo: currently only serves an existing sitemap.xml from the contentbus.
 *       generate sitemap on the fly based on the sitemap.json
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function sitemapPipe(state, req) {
  const { log } = state;
  state.type = 'sitemap';
  // force loading from preview
  state.partition = 'preview';

  if (state.info?.path !== '/sitemap.xml') {
    // this should not happen as it would mean that the caller used the wrong route. so we respond
    // with a 500 to indicate that something is wrong.
    return new PipelineResponse('', {
      status: 500,
      headers: {
        'x-error': 'invalid route',
      },
    });
  }

  /** @type PipelineResponse */
  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });

  // check if .auth request

  try { // fetch config first, since we need to compute the content-bus-id from the fstab ...
    state.timer?.update('config-fetch');
    await fetchConfig(state, req, res);
    if (!state.contentBusId) {
      res.status = 400;
      res.headers.set('x-error', 'contentBusId missing');
      return res;
    }

    // fetch sitemap.xml

    state.timer?.update('content-fetch');
    await Promise.all([
      fetchConfigAll(state, req, res),
      fetchContent(state, req, res),
    ]);

    await requireProject(state, req, res);
    if (res.error !== 401) {
      await authenticate(state, req, res);
    }

    if (res.error) {
      // if content loading produced an error, we're done.
      const level = res.status >= 500 ? 'error' : 'info';
      log[level](`pipeline status: ${res.status} ${res.error}`);
      res.headers.set('x-error', cleanupHeaderValue(res.error));
      if (res.status < 500) {
        await setCustomResponseHeaders(state, req, res);
      }
      return res;
    }

    state.timer?.update('serialize');
    await renderCode(state, req, res);
    await setCustomResponseHeaders(state, req, res);
    await setXSurrogateKeyHeader(state, req, res);
  } catch (e) {
    res.error = e.message;
    if (e instanceof PipelineStatusError) {
      res.status = e.code;
    } else {
      res.status = 500;
    }

    const level = res.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${res.status} ${res.error}`, e);
    res.headers.set('x-error', cleanupHeaderValue(res.error));
  }

  return res;
}
