/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { filterGlobalMetadata } from './extract-metadata.js';

/**
 * Array of headers allowed in the metadata.json file.
 */
const allowList = [
  'content-security-policy',
  'content-security-policy-report-only',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'link',
];

/**
 * Decorates the pipeline response object with the headers defined in metadata.json.
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default function setCustomResponseHeaders(state, req, res) {
  const meta = filterGlobalMetadata(state.metadata, state.info.path);
  Object.entries(meta).forEach(([name, value]) => {
    if (allowList.includes(name)) {
      res.headers.set(name, cleanupHeaderValue(value));
    }
  });
}
