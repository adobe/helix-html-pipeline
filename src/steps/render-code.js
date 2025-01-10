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
import mime from 'mime';
import { contentSecurityPolicyOnCode } from './csp.js';

const CHARSET_RE = /charset=([^()<>@,;:"/[\]?.=\s]*)/i;

/**
 * "Renders" the content from the code-bus as-is
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function renderCode(state, req, res) {
  res.body = state.content.data;
  let contentType = mime.getType(state.info.resourcePath);
  const originalType = res.headers.get('content-type');
  if (originalType) {
    const match = CHARSET_RE.exec(originalType);
    if (match) {
      contentType += `; charset=${match[1]}`;
    }
  }
  res.headers.set('content-type', contentType);

  contentSecurityPolicyOnCode(state, req, res);
}
