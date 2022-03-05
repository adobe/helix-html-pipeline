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
import { extractLastModified, updateLastModified } from '../utils/last-modified.js';

/**
 * Loads the content from either the content-bus or code-bus and stores it in `state.content`
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchContent(state, req, res) {
  const {
    log, contentBusId, info, partition, owner, repo, ref,
  } = state;

  const isCode = state.content.sourceBus === 'code';
  const key = isCode
    ? `${owner}/${repo}/${ref}/${info.resourcePath}`
    : `${contentBusId}/${partition}${info.resourcePath}`;
  const bucketId = isCode ? 'helix-code-bus' : 'helix-content-bus';

  const ret = await state.s3Loader.getObject(bucketId, key);

  // check for redirect
  const redirectLocation = ret.headers['x-amz-meta-redirect-location'];
  if (redirectLocation) {
    res.status = 301;
    res.body = '';
    res.headers.location = redirectLocation;
    res.error = 'moved';
    return;
  }

  if (ret.status === 200) {
    state.content.data = ret.body;

    // store extra source location if present
    state.content.sourceLocation = ret.headers['x-amz-meta-x-source-location'];
    log.info(`source-location: ${state.content.sourceLocation}`);

    updateLastModified(state, res, extractLastModified(ret.headers));

    // reject requests to /index *after* checking for redirects
    // (https://github.com/adobe/helix-pipeline-service/issues/290)
    if (state.info.originalFilename === 'index') {
      res.status = 404;
      res.error = `request to ${info.path} not allowed (no-index).`;
    }
  } else {
    // keep 404, but propagate others as 502
    res.status = ret.status === 404 ? 404 : 502;
    res.error = `failed to load ${info.path} from ${state.content.sourceBus}-bus: ${ret.status}`;
  }

  if (res.status === 404) {
    // try to load 404.html from code-bus
    const ret404 = await state.s3Loader.getObject('helix-code-bus', `${owner}/${repo}/${ref}/404.html`);
    if (ret404.status === 200) {
      // override last-modified if source-last-modified is set
      const lastModified = extractLastModified(ret404.headers);
      if (lastModified) {
        ret404.headers['last-modified'] = lastModified;
      }

      // keep 404 response status
      res.body = ret.body;
      res.headers = {
        'last-modified': ret404.headers['last-modified'],
        'content-type': 'text/html; charset=utf-8',
        'x-surrogate-key': `${ref}--${repo}--${owner}_404`,
      };
    }
  }
}
