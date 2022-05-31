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
import fetchConfigAll from './steps/fetch-metadata.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineResponse } from './PipelineResponse.js';
import jsonFilter from './utils/json-filter.js';
import { extractLastModified, updateLastModified } from './utils/last-modified.js';

/**
 * Runs the default pipeline and returns the response.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function jsonPipe(state, req) {
  const { log } = state;
  state.type = 'json';
  const {
    owner, repo, ref, contentBusId, partition, s3Loader,
  } = state;
  const { path } = state.info;
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

  if (!path.endsWith('.json')) {
    log.error('only json resources supported.');
    return new PipelineResponse('', {
      status: 400,
      headers: {
        'x-error': 'only json resources supported.',
      },
    });
  }

  // fetch data from content bus
  state.timer?.update('json-fetch');
  let dataResponse = await s3Loader.getObject('helix-content-bus', `${contentBusId}/${partition}${path}`);

  // if not found, fall back to code bus
  if (dataResponse.status === 404) {
    dataResponse = await s3Loader.getObject('helix-code-bus', `${owner}/${repo}/${ref}${path}`);
  }

  // if still not found, return status
  if (dataResponse.status !== 200) {
    return dataResponse;
  }
  const data = dataResponse.body;

  // filter data
  const response = jsonFilter(state, data, {
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    offset: offset ? Number.parseInt(offset, 10) : undefined,
    sheet,
    raw: limit === undefined && offset === undefined && sheet === undefined,
  });

  // set last-modified
  updateLastModified(state, response, extractLastModified(dataResponse.headers));

  // set surrogate key
  response.headers.set('x-surrogate-key', `${contentBusId}${path}`.replace(/\//g, '_'));

  // Load metadata from metadata.json
  await fetchConfigAll(state, req, response);
  await setCustomResponseHeaders(state, req, response);

  return response;
}
