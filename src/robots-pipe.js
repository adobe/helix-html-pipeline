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
import { cleanupHeaderValue, computeSurrogateKey } from '@adobe/helix-shared-utils';
import fetchContent from './steps/fetch-content.js';
import renderCode from './steps/render-code.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';
import initConfig from './steps/init-config.js';

function generateRobots(state) {
  const {
    prodHost,
  } = state;
  const txt = [
    'User-Agent: *',
    'Allow: /',
    '',
    `Sitemap: https://${prodHost}/sitemap.xml`,
  ].join('\n');
  return new PipelineResponse(txt, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

async function computeSurrogateKeys(state) {
  const keys = [];

  const pathKey = `${state.ref}--${state.repo}--${state.owner}${state.info.path}`;
  keys.push(await computeSurrogateKey(`${state.site}--${state.org}_config.json`));
  keys.push(pathKey.replace(/\//g, '_')); // TODO: remove
  keys.push(await computeSurrogateKey(pathKey));
  return keys;
}

/**
 * Serves or renders the robots.txt.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function robotsPipe(state, req) {
  const { log } = state;
  state.type = 'robots';

  if (state.info?.path !== '/robots.txt') {
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
      'content-type': 'text/plain; charset=utf-8',
    },
  });

  try {
    await initConfig(state, req, res);

    // fetch robots.txt
    state.timer?.update('content-fetch');

    state.content.sourceBus = 'code';
    await fetchContent(state, req, res);
    if (res.status === 404) {
      const robots = state.config?.robots?.txt;
      if (robots) {
        state.content.data = robots;
      } else {
        const ret = generateRobots(state);
        state.content.data = ret.body;
      }
      res.headers.set('content-type', 'text/plain; charset=utf-8');
      res.status = 200;
      delete res.error;
    }
    if (res.error) {
      // if content loading produced an error, we're done.
      throw new PipelineStatusError(res.status, res.error);
    }

    state.timer?.update('serialize');
    await renderCode(state, req, res);

    // set surrogate keys
    const keys = await computeSurrogateKeys(state);
    res.headers.set('x-surrogate-key', keys.join(' '));

    await setCustomResponseHeaders(state, req, res);
  } catch (e) {
    res.error = e.message;
    res.status = e.code || 500;

    log.error(`pipeline status: ${res.status} ${res.error}`);
    res.headers.set('x-error', cleanupHeaderValue(res.error));
  }
  return res;
}
