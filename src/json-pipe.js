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
import { cleanupHeaderValue, computeSurrogateKey } from '@adobe/helix-shared-utils';
import initConfig from './steps/init-config.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { computeContentPathKey, computeCodePathKey } from './steps/set-x-surrogate-key-header.js';
import { PipelineResponse } from './PipelineResponse.js';
import jsonFilter from './utils/json-filter.js';
import { extractLastModified, updateLastModified } from './utils/last-modified.js';
import { getPathInfo } from './utils/path.js';
import { PipelineStatusError } from './PipelineStatusError.js';

/**
 * Checks the fstab for folder mapping entries and then re-adjusts the path infos if needed.
 * Note that json can only be mapped using direct documents mapping.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function folderMapping(state) {
  const { folders } = state.config;
  if (!folders) {
    return;
  }
  const { path } = state.info;
  const mapped = folders[path];
  if (mapped) {
    state.info = getPathInfo(mapped);
    state.info.unmappedPath = path;
    state.info.resourcePath = mapped;
    state.log.info(`mapped ${path} to ${state.info.resourcePath} (${state.content.sourceBus}-bus)`);
  }
}

async function fetchJsonContent(state, req, res) {
  const {
    owner, repo, ref, contentBusId, partition, s3Loader, log,
  } = state;
  const { path } = state.info;
  state.content.sourceBus = 'content';
  let ret = await s3Loader.getObject('helix-content-bus', `${contentBusId}/${partition}${path}`);

  // if not found, fall back to code bus
  if (ret.status === 404) {
    state.content.sourceBus = 'code';
    ret = await s3Loader.getObject('helix-code-bus', `${owner}/${repo}/${ref}${path}`);
  }

  // check for redirect
  const redirectLocation = ret.headers.get('x-amz-meta-redirect-location');
  if (redirectLocation) {
    res.status = 301;
    res.body = '';
    res.headers.delete('content-type');
    res.headers.set('location', redirectLocation);
    const keys = [];
    if (state.content.sourceBus === 'content') {
      // provide either (prefixed) preview or (unprefixed) live content keys
      const contentKeyPrefix = partition === 'preview' ? 'p_' : '';
      keys.push(`${contentKeyPrefix}${await computeContentPathKey(state)}`);
      keys.push(`${contentKeyPrefix}${contentBusId}`);
    } else {
      keys.push(`${ref}--${repo}--${owner}_code`);
      keys.push(await computeCodePathKey(state));
    }
    res.headers.set('x-surrogate-key', keys.join(' '));
    res.error = 'moved';
    return;
  }

  if (ret.status === 200) {
    res.status = 200;
    delete res.error;
    state.content.data = ret.body;

    // store extra source location if present
    state.content.sourceLocation = ret.headers.get('x-amz-meta-x-source-location');
    log.info(`source-location: ${state.content.sourceLocation}`);

    updateLastModified(state, res, extractLastModified(ret.headers));
  } else {
    // also add code surrogate key in case json is later added to code bus (#688)
    state.content.sourceBus = 'code|content';
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${state.info.resourcePath}: ${ret.status}`;
  }
}

async function computeSurrogateKeys(state) {
  const keys = [];
  if (state.info.path === '/config.json') {
    keys.push(await computeSurrogateKey(`${state.site}--${state.org}_config.json`));
  }
  if (state.content.sourceBus.includes('code')) {
    keys.push(await computeCodePathKey(state));
    keys.push(`${state.ref}--${state.repo}--${state.owner}_code`);
  }
  if (state.content.sourceBus.includes('content')) {
    // provide either (prefixed) preview or (unprefixed) live content keys
    const contentKeyPrefix = state.partition === 'preview' ? 'p_' : '';
    keys.push(`${contentKeyPrefix}${await await computeContentPathKey(state)}`);
    keys.push(`${contentKeyPrefix}${state.contentBusId}`);
  }

  return keys;
}

/**
 * Runs the default pipeline and returns the response.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function jsonPipe(state, req) {
  const { log } = state;
  state.type = 'json';
  const { extension } = state.info;
  const { searchParams } = req.url;
  const params = Object.fromEntries(searchParams.entries());
  if (params.sheet) {
    params.sheet = searchParams.getAll('sheet');
  }
  const {
    limit,
    offset,
    sheet,
  } = params;

  if (extension !== '.json') {
    log.error('only json resources supported.');
    return new PipelineResponse('', {
      status: 400,
      headers: {
        'x-error': 'only json resources supported.',
      },
    });
  }

  try {
    /** @type PipelineResponse */
    const res = new PipelineResponse('', {
      headers: {
        'content-type': 'application/json',
      },
    });
    await initConfig(state, req, res);

    // apply the folder mapping if the current resource doesn't exist
    state.timer?.update('json-fetch');
    await fetchJsonContent(state, req, res);
    if (res.status === 404) {
      folderMapping(state);
      if (state.info.unmappedPath) {
        await fetchJsonContent(state, req, res);
      }
    }

    state.timer?.update('json-metadata-fetch');

    if (res.status === 404 && state.info.path === '/config.json' && state.config.public) {
      // special handling for public config
      const publicConfig = {
        public: state.config.public,
      };
      res.status = 200;
      res.body = JSON.stringify(publicConfig, null, 2);
    } else if (res.error) {
      if (res.status < 400) {
        return res;
      }
      throw new PipelineStatusError(res.status, res.error);
    } else {
      // filter data
      jsonFilter(state, res, {
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        offset: offset ? Number.parseInt(offset, 10) : undefined,
        sheet,
        raw: limit === undefined && offset === undefined && sheet === undefined,
      });
    }

    // set surrogate keys
    const keys = await computeSurrogateKeys(state);
    res.headers.set('x-surrogate-key', keys.join(' '));

    await setCustomResponseHeaders(state, req, res);
    return res;
  } catch (e) {
    const res = new PipelineResponse('', {
      status: e instanceof PipelineStatusError ? e.code : 500,
    });
    const level = res.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${res.status} ${e.message}`, e);
    res.body = '';
    res.headers.set('x-error', cleanupHeaderValue(e.message));
    if (res.status < 500) {
      await setCustomResponseHeaders(state, req, res);
    }
    if (res.status === 404) {
      const keys = await computeSurrogateKeys(state);
      res.headers.set('x-surrogate-key', keys.join(' '));
    }
    return res;
  }
}
