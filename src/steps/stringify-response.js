/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { toHtml } from 'hast-util-to-html';
import rehypeFormat from 'rehype-format';

/**
 * Serializes the response document to HTML
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 */
export default function stringify(state, req, res) {
  const { log } = state;
  if (res.body) {
    log.debug('stringify: ignoring already defined context.response.body');
    return;
  }
  const doc = res.document;
  if (!doc) {
    throw Error('no response document');
  }

  rehypeFormat()(doc);
  res.body = toHtml(doc, {
    upperDoctype: true,
  });
}
