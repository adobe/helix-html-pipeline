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
 * Loads metadata for a mapped path and puts it into `state.mappedMetadata`. If path is not
 * mapped or there is no `metadata.json` at that path, puts an `EMPTY` Modifiers object into
 * `state.mappedMetadata`.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @returns {Promise<void>}
 */
export default async function fetchMappedMetadata(state) {
  state.mappedMetadata = Modifiers.EMPTY;
  if (!state.mapped) {
    return;
  }
  const { contentBusId, partition } = state;
  const metadataPath = `${state.info.path}/metadata.json`;
  const key = `${contentBusId}/${partition}${metadataPath}`;
  const ret = await state.s3Loader.getObject('helix-content-bus', key);
  if (ret.status === 200) {
    let json;
    try {
      json = JSON.parse(ret.body);
    } catch (e) {
      throw new PipelineStatusError(400, `failed parsing of ${metadataPath}: ${e.message}`);
    }

    const { data } = json.default ?? json;
    if (!Array.isArray(data)) {
      throw new PipelineStatusError(400, `failed loading of ${metadataPath}: data must be an array`);
    }

    state.mappedMetadata = Modifiers.fromModifierSheet(
      data,
    );
    return;
  }
  if (ret.status !== 404) {
    throw new PipelineStatusError(502, `failed to load ${metadataPath}: ${ret.status}`);
  }
}
