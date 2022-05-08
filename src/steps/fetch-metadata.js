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

import { PipelineStatusError } from '../PipelineStatusError.js';
import { extractLastModified, updateLastModified } from '../utils/last-modified.js';

/**
 * Loads the metadata.json from the content-bus and stores it in `state.metadata`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchMetadata(state, req, res) {
  const { contentBusId, partition } = state;
  const key = `${contentBusId}/${partition}/metadata.json`;
  const ret = await state.s3Loader.getObject('helix-content-bus', key);
  if (ret.status === 200) {
    let json;
    try {
      json = JSON.parse(ret.body);
    } catch (e) {
      throw new PipelineStatusError(400, `failed parsing of /metadata.json: ${e.message}`);
    }

    const { data } = json.default ?? json;
    if (!Array.isArray(data)) {
      throw new PipelineStatusError(400, 'failed loading of /metadata.json: data must be an array');
    }
    state.metadata = data;

    if (state.type === 'html' && state.info.selector !== 'plain') {
      // also update last-modified (only for extensionless html pipeline)
      updateLastModified(state, res, extractLastModified(ret.headers));
    }
    return;
  }

  if (ret.status !== 404) {
    throw new PipelineStatusError(502, `failed to load /metadata.json: ${ret.status}`);
  }

  // ignore 404
  state.metadata = [];
}
