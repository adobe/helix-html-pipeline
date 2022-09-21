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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import addHeadingIds from './steps/add-heading-ids.js';
import createPageBlocks from './steps/create-page-blocks.js';
import createPictures from './steps/create-pictures.js';
import extractMetaData from './steps/extract-metadata.js';
import fetchConfig from './steps/fetch-config.js';
import fetchContent from './steps/fetch-content.js';
import fetchMetadata from './steps/fetch-metadata.js';
import fixSections from './steps/fix-sections.js';
import folderMapping from './steps/folder-mapping.js';
import getMetadata from './steps/get-metadata.js';
import html from './steps/make-html.js';
import parseMarkdown from './steps/parse-markdown.js';
import removeHlxProps from './steps/removeHlxProps.js';
import render from './steps/render.js';
import renderCode from './steps/render-code.js';
import rewriteBlobImages from './steps/rewrite-blob-images.js';
import rewriteIcons from './steps/rewrite-icons.js';
import setXSurrogateKeyHeader from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import splitSections from './steps/split-sections.js';
import unwrapSoleImages from './steps/unwrap-sole-images.js';
import tohtml from './steps/stringify-response.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';
import { validatePathInfo } from './utils/path.js';

/**
 * Runs the default pipeline and returns the response.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function htmlPipe(state, req) {
  const { log } = state;
  state.type = 'html';

  if (!validatePathInfo(state.info)) {
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': 'invalid path',
      },
    });
  }

  /** @type PipelineResponse */
  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });

  try { // fetch config first, since we need to compute the content-bus-id from the fstab ...
    state.timer?.update('config-fetch');
    await fetchConfig(state, req, res);

    // ...and apply the folder mapping
    await folderMapping(state);

    // load metadata and content in parallel
    state.timer?.update('content-fetch');
    await Promise.all([
      fetchMetadata(state, req, res),
      fetchContent(state, req, res),
    ]);

    if (res.error) {
      // if content loading produced an error, we're done.
      log.error(`error running pipeline: ${res.status} ${res.error}`);
      res.headers.set('x-error', cleanupHeaderValue(res.error));
      return res;
    }

    if (state.content.sourceBus === 'code') {
      state.timer?.update('serialize');
      await renderCode(state, req, res);
    } else {
      state.timer?.update('parse');
      await parseMarkdown(state);
      state.timer?.update('render');
      await splitSections(state);
      await getMetadata(state); // this one extracts the metadata from the mdast
      await unwrapSoleImages(state);
      await html(state);
      await rewriteBlobImages(state);
      await rewriteIcons(state);
      await fixSections(state);
      await createPageBlocks(state);
      await createPictures(state);
      await extractMetaData(state, req);
      await addHeadingIds(state);
      await render(state, req, res);
      await removeHlxProps(state, req, res);
      state.timer?.update('serialize');
      await tohtml(state, req, res);
    }

    await setCustomResponseHeaders(state, req, res);
    await setXSurrogateKeyHeader(state, req, res);
  } catch (e) {
    res.error = e.message;
    if (e instanceof PipelineStatusError) {
      res.status = e.code;
    } else {
      res.status = 500;
    }
    log.error(`error running pipeline: ${res.status} ${res.error}`, e);
    res.headers.set('x-error', cleanupHeaderValue(res.error));

    // turn any URL errors into a 400, since they are user input
    // see https://github.com/adobe/helix-pipeline-service/issues/346
    if (e.code === 'ERR_INVALID_URL') {
      res.status = 400;
      res.headers.set('x-error', cleanupHeaderValue(`invalid url: ${e.input}`));
    }
  }

  return res;
}
