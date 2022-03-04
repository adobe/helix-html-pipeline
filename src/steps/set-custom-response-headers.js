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
 * Given an array of metadata values returned from metadata.json, filter down
 * to just the headers that are in the allow list.
 *
 * @param {[MetadataObject]} metadata array of metadata objects
 */
export function filterAllowedHeaders(metadata) {
  if (!metadata) {
    return [];
  }

  return metadata.filter((value) => allowList.includes(value.name));
}

/**
 * Decorates the pipeline response object with the headers defined in metadata.json.
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default function setCustomResponseHeaders(state, req, res) {
  const { content: { meta: { custom: customMeta } } } = state;
  // process response headers
  if (customMeta) {
    const filteredMeta = filterAllowedHeaders(customMeta);
    filteredMeta.forEach((header) => {
      const { name: propertyName, value } = header;
      res.headers[propertyName] = cleanupHeaderValue(value);
    });
  }
}
