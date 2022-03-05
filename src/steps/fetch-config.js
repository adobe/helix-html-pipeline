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
import { updateLastModified } from '../utils/last-modified.js';
import { PipelineStatusError } from '../PipelineStatusError.js';

/**
 * Fetches the helix-config.json from the code-bus and stores it in `state.helixConfig`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchConfig(state, req, res) {
  const {
    log, owner, repo, ref,
  } = state;

  const key = `${owner}/${repo}/${ref}/helix-config.json`;
  const ret = await state.s3Loader.getObject('helix-code-bus', key);
  if (ret.status !== 200) {
    throw new PipelineStatusError(ret.status === 404 ? 404 : 502, `unable to load /helix-config.json: ${ret.status}`);
  }
  try {
    state.helixConfig = JSON.parse(ret.body);
  } catch (e) {
    log.info('failed to parse helix-config.json', e);
    throw new PipelineStatusError(400, `Failed parsing of /helix-config.json: ${e.message}`);
  }

  // also update last-modified
  updateLastModified(state, res, ret.headers['last-modified']);
}
