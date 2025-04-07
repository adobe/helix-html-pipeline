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
  const metadata = [];
  await Promise.all(sources.map(async (src) => {
    const key = `${contentBusId}/${partition}/${src}`;

  }));
  const metadataPath = `${mappedPath}/metadata.json`;
  const ret = await state.s3Loader.getObject('helix-content-bus', key);
  if (ret.status === 200) {
    let json;
    try {
      json = JSON.parse(ret.body);
    } catch (e) {
      throw new PipelineStatusError(500, `failed parsing of ${metadataPath}: ${e.message}`);
    }
    const { data } = json.default ?? json;
    if (!data) {
      state.log.info(`default sheet missing in ${metadataPath}`);
      return;
    }

    if (!Array.isArray(data)) {
      throw new PipelineStatusError(500, `failed loading of ${metadataPath}: data must be an array`);
    }

    state.mappedMetadata = Modifiers.fromModifierSheet(
      data,
    );
    // note, that the folder mapped metadata does not influence the last-modified calculation.
    return;
  }
  if (ret.status !== 404) {
    throw new PipelineStatusError(502, `failed to load ${metadataPath}: ${ret.status}`);
  }
}
