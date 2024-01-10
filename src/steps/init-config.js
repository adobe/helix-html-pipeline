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
import { Modifiers } from '../utils/modifiers.js';
import { getOriginalHost } from './utils.js';
import { updateLastModified } from '../utils/last-modified.js';

function replaceParams(str, info) {
  if (!str) {
    return '';
  }
  return str
    .replaceAll('$owner', info.owner)
    .replaceAll('$org', info.org)
    .replaceAll('$site', info.site)
    .replaceAll('$repo', info.repo)
    .replaceAll('$ref', info.ref);
}

/**
 * Initializes the pipeline state with the config from the config service
 * (passed via the `config` parameter during state construction).
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default function initConfig(state, req, res) {
  const { config, partition } = state;
  state.metadata = new Modifiers(config.metadata?.[partition]?.data || {});
  state.headers = new Modifiers(config.headers || {});

  // set custom preview and live hosts
  state.previewHost = replaceParams(config.cdn?.preview?.host, state);
  state.liveHost = replaceParams(config.cdn?.live?.host, state);
  state.prodHost = config.cdn?.prod?.host || getOriginalHost(req.headers);
  updateLastModified(state, res, state.config.lastModified);
}
