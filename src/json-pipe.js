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
import fetchConfigAll from './steps/fetch-config-all.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineResponse } from './PipelineResponse.js';
import jsonFilter from './utils/json-filter.js';
import { extractLastModified, updateLastModified } from './utils/last-modified.js';
import { authenticate } from './steps/authenticate.js';
import fetchConfig from './steps/fetch-config.js';
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
  const folders = state.helixConfig?.fstab?.data.folders;
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
  let ret = await s3Loader.getObject('helix-content-bus', `${contentBusId}/${partition}${path}`);

  // if not found, fall back to code bus
  if (ret.status === 404) {
    ret = await s3Loader.getObject('helix-code-bus', `${owner}/${repo}/${ref}${path}`);
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
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${state.info.resourcePath}: ${ret.status}`;
  }
}

async function computeSurrogateKeys(path, contentBusId) {
  const keys = [];
  keys.push(`${contentBusId}${path}`.replace(/\//g, '_')); // TODO: remove
  keys.push(await computeSurrogateKey(`${contentBusId}${path}`));
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
  const { contentBusId } = state;
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
    // fetch config and apply the folder mapping
    await fetchConfig(state, req);
    if (!state.contentBusId) {
      return new PipelineResponse('', {
        status: 400,
        headers: {
          'x-error': 'contentBusId missing',
        },
      });
    }

    /** @type PipelineResponse */
    const res = new PipelineResponse('', {
      headers: {
        'content-type': 'application/json',
      },
    });

    // apply the folder mapping if the current resource doesn't exist
    state.timer?.update('json-fetch');
    let contentPromise = await fetchJsonContent(state, req, res);
    if (res.status === 404) {
      await folderMapping(state);
      if (state.info.unmappedPath) {
        contentPromise = fetchJsonContent(state, req, res);
      }
    }

    state.timer?.update('json-metadata-fetch');
    await Promise.all([
      fetchConfigAll(state, req, res),
      contentPromise,
    ]);

    await authenticate(state, req, res);

    if (res.error) {
      throw new PipelineStatusError(res.status, res.error);
    }

    // filter data
    jsonFilter(state, res, {
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      offset: offset ? Number.parseInt(offset, 10) : undefined,
      sheet,
      raw: limit === undefined && offset === undefined && sheet === undefined,
    });

    // set surrogate keys
    const keys = await computeSurrogateKeys(state.info.path, contentBusId);
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
      const keys = await computeSurrogateKeys(state.info.path, contentBusId);
      res.headers.set('x-surrogate-key', keys.join(' '));
    }
    return res;
  }
}
