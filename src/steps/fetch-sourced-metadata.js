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
import { Modifiers } from '../utils/modifiers.js';
import { extractLastModified, recordLastModified } from '../utils/last-modified.js';

/**
 * Loads metadata from the metadata sources if required. this happens when the amount of metadata
 * was too large to include in the config response. the metadata is loaded if
 * `state.metadata` is empty and `config.metadata.source` is not.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
export default async function fetchSourcedMetadata(state, res) {
  if (!state.metadata.isEmpty()) {
    return;
  }
  const sources = state.config.metadata?.source || [];
  if (sources.length === 0) {
    return;
  }

  const { contentBusId, partition } = state;
  const metadatas = {};
  await Promise.all(sources.map(async (src) => {
    metadatas[src] = [];
    const key = `${contentBusId}/${partition}/${src}`;
    const ret = await state.s3Loader.getObject('helix-content-bus', key);
    if (ret.status === 200) {
      let json;
      try {
        json = JSON.parse(ret.body);
      } catch (e) {
        throw new PipelineStatusError(500, `failed parsing of ${key}: ${e.message}`);
      }
      const { data } = json.default ?? json;
      if (!data) {
        state.log.info(`default sheet missing in ${key}`);
        return;
      }

      if (!Array.isArray(data)) {
        throw new PipelineStatusError(500, `failed loading of ${key}: data must be an array`);
      }
      metadatas[src] = data;
      recordLastModified(state, res, 'content', extractLastModified(ret.headers));
    } else if (ret.status !== 404) {
      throw new PipelineStatusError(502, `failed to load ${key}: ${ret.status}`);
    }
  }));
  // aggregate the metadata in the same order as specified
  const metadata = [];
  for (const src of sources) {
    metadata.push(...metadatas[src]);
  }
  state.metadata = Modifiers.fromModifierSheet(metadata);
}
