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
import tohtml from './steps/stringify-response.js';
import { getPathInfo } from './utils/path.js';
import { PipelineStatusError } from './PipelineStatusError.js';

/**
 * Creates the pipeline state from the given options.
 * @param {PipelineOptions} opts
 * @returns {PipelineState}
 */
export function createState(opts) {
  /** @type {PipelineState} */
  return {
    log: opts.log ?? console,
    info: getPathInfo(opts.path),
    content: {
      sourceBus: 'content',
    },
    // todo: compute content-bus id from fstab
    contentBusId: opts.contentBusId,
    owner: opts.owner,
    repo: opts.repo,
    ref: opts.ref,
    partition: opts.partition,
    helixConfig: undefined,
    metadata: undefined,
    s3Loader: opts.s3Loader,
  };
}

/**
 * Runs the default pipeline and returns the response.
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function runPipe(state, req) {
  const { log } = state;

  /** @type PipelineResponse */
  const res = {
    status: 200,
    body: undefined,
    document: undefined,
    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
    error: undefined,
    lastModifiedTime: 0,
  };

  try { // fetch config first, since we need to compute the content-bus-id from the fstab ...
    await fetchConfig(state, req, res);
    // ...and apply the folder mapping
    await folderMapping(state, req, res);

    // load metadata and content in parallel
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
      await renderCode(state, req, res);
    } else {
      await parseMarkdown(state);
      await splitSections(state);
      await getMetadata(state); // this one extracts the metadata from the mdast
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
  }

  return res;
}

/**
 * Runs the default pipeline and returns the response.
 * @param {PipelineRequest} req
 * @param {PipelineOptions} opts
 * @returns {PipelineResponse}
 */
export async function pipe(req, opts) {
  return runPipe(createState(opts), req);
}
