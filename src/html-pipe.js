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
import { authenticate, requireProject } from './steps/authenticate.js';
import addHeadingIds from './steps/add-heading-ids.js';
import createPageBlocks from './steps/create-page-blocks.js';
import createPictures from './steps/create-pictures.js';
import extractMetaData from './steps/extract-metadata.js';
import fetchConfig from './steps/fetch-config.js';
import fetchContent from './steps/fetch-content.js';
import fetch404 from './steps/fetch-404.js';
import fetchConfigAll from './steps/fetch-config-all.js';
import fixSections from './steps/fix-sections.js';
import { calculateFolderMapping, applyFolderMapping } from './steps/folder-mapping.js';
import getMetadata from './steps/get-metadata.js';
import html from './steps/make-html.js';
import parseMarkdown from './steps/parse-markdown.js';
import render from './steps/render.js';
import renderCode from './steps/render-code.js';
import rewriteUrls from './steps/rewrite-urls.js';
import rewriteIcons from './steps/rewrite-icons.js';
import setXSurrogateKeyHeader from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import splitSections from './steps/split-sections.js';
import unwrapSoleImages from './steps/unwrap-sole-images.js';
import tohtml from './steps/stringify-response.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';
import { validatePathInfo } from './utils/path.js';
import { initAuthRoute } from './utils/auth.js';
import fetchMappedMetadata from './steps/fetch-mapped-metadata.js';
import { applyMetaLastModified, setLastModified } from './utils/last-modified.js';

/**
 * Fetches the content and if not found, fetches the 404.html
 * @param state
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
async function fetchContentWith404Fallback(state, req, res) {
  await fetchContent(state, req, res);
  if (res.status === 404) {
    await fetch404(state, req, res);
  }
}

/**
 * Loads the resource from the content bus but only handles the redirect; otherwise applies
 * a 404 fallback.
 * @param state
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
async function fetchContentRedirectWith404Fallback(state, req, res) {
  // force load from content bus again
  state.content.sourceBus = 'content';
  const prevError = res.error;
  try {
    await fetchContent(state, req, res);
  } finally {
    state.content.sourceBus = 'code';
  }
  if (res.status !== 301) {
    // force 404
    res.status = 404;
    res.error = prevError;
    await fetch404(state, req, res);
  }
}

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

  // check if .auth request
  if (state.partition === '.auth' || state.info.path === '/.auth') {
    if (!await initAuthRoute(state, req, res)) {
      return res;
    }
  }

  try { // fetch config first, since we need to compute the content-bus-id from the fstab ...
    state.timer?.update('config-fetch');
    await fetchConfig(state, req, res);
    if (!state.contentBusId) {
      res.status = 400;
      res.headers.set('x-error', 'contentBusId missing');
      return res;
    }

    // force code-bus for .html files
    if (state.info.originalExtension === '.html' && state.info.selector !== 'plain') {
      state.content.sourceBus = 'code';
    }

    calculateFolderMapping(state);
    state.timer?.update('content-fetch');
    let contentPromise = await fetchContent(state, req, res);
    if (res.status === 404) {
      // special handling for code-bus 404
      if (state.content.sourceBus === 'code') {
        contentPromise = fetchContentRedirectWith404Fallback(state, req, res);
      } else {
        // ...apply folder mapping if the current resource doesn't exist
        applyFolderMapping(state);
        if (state.info.unmappedPath) {
          contentPromise = fetchContentWith404Fallback(state, req, res);
        } else {
          contentPromise = fetch404(state, req, res);
        }
      }
    }

    // load metadata and content in parallel
    state.timer?.update('metadata-fetch');
    await Promise.all([
      fetchConfigAll(state, req, res),
      contentPromise,
      fetchMappedMetadata(state),
    ]);

    await requireProject(state, req, res);
    if (res.error !== 401) {
      await authenticate(state, req, res);
    }

    if (res.error) {
      // if content loading produced an error, we're done.
      const level = res.status >= 500 ? 'error' : 'info';
      log[level](`pipeline status: ${res.status} ${res.error}`);
      res.headers.set('x-error', cleanupHeaderValue(res.error));
      if (res.status < 500) {
        setLastModified(state, res);
        await setCustomResponseHeaders(state, req, res);
      }
      return res;
    }

    if (state.content.sourceBus === 'code' || state.info.originalExtension === '.md') {
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
      await rewriteUrls(state);
      await rewriteIcons(state);
      await fixSections(state);
      await createPageBlocks(state);
      await createPictures(state);
      await extractMetaData(state, req);
      await addHeadingIds(state);
      await render(state, req, res);
      state.timer?.update('serialize');
      await tohtml(state, req, res);
      await applyMetaLastModified(state, res);
    }

    setLastModified(state, res);
    await setCustomResponseHeaders(state, req, res);
    await setXSurrogateKeyHeader(state, req, res);
  } catch (e) {
    res.error = e.message;
    if (e instanceof PipelineStatusError) {
      res.status = e.code;
    } else {
      res.status = 500;
    }

    const level = res.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${res.status} ${res.error}`, e);
    res.headers.set('x-error', cleanupHeaderValue(res.error));

    // turn any URL errors into a 400, since they are user input
    // see https://github.com/adobe/helix-pipeline-service/issues/346
    if (e.code === 'ERR_INVALID_URL' // node runtime
      /* c8 ignore next */
      || (e instanceof TypeError && e.message === 'Invalid URL string.')) { // cloudflare runtime
      res.status = 400;
      res.headers.set('x-error', cleanupHeaderValue(`invalid url: ${e.input}`));
    }
  }

  return res;
}
