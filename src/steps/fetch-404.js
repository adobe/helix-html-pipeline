/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { computeSurrogateKey } from '@adobe/helix-shared-utils';
import { extractLastModified } from '../utils/last-modified.js';

/**
 * Loads the 404.html from code-bus and stores it in `res.body`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetch404(state, req, res) {
  const {
    contentBusId, info, owner, repo, ref,
  } = state;
  const ret = await state.s3Loader.getObject('helix-code-bus', `${owner}/${repo}/${ref}/404.html`);
  if (ret.status === 200) {
    // override last-modified if source-last-modified is set
    const lastModified = extractLastModified(ret.headers);
    if (lastModified) {
      ret.headers.set('last-modified', lastModified);
    }

    // keep 404 response status
    res.body = ret.body;
    res.headers.set('last-modified', ret.headers.get('last-modified'));
    res.headers.set('content-type', 'text/html; charset=utf-8');
    const pathKey = await computeSurrogateKey(`${contentBusId}${info.path}`);
    res.headers.set('x-surrogate-key', `${pathKey} ${ref}--${repo}--${owner}_404`);
  }
}
