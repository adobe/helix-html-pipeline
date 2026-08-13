/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import escape from 'lodash.escape';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import fetchContent from './steps/fetch-content.js';
import renderCode from './steps/render-code.js';
import setXSurrogateKeyHeader from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';
import initConfig from './steps/init-config.js';
import { extractLastModified, recordLastModified, setLastModified } from './utils/last-modified.js';

async function generateSitemapIndex(state) {
  const {
    owner, repo, ref, partition,
    previewHost, liveHost, prodHost, config,
  } = state;

  const { sitemap } = config;
  if (!sitemap?.index) {
    throw new PipelineStatusError(404, 'No sitemap index defined in configuration');
  }
  const host = partition === 'preview'
    ? (previewHost || `${ref}--${repo}--${owner}.aem.page`)
    : (prodHost || liveHost || `${ref}--${repo}--${owner}.aem.live`);
  const loc = (path) => (path.startsWith('/') ? `https://${host}${escape(path)}` : path);
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemap.index.map((index) => `  <sitemap>
    <loc>${loc(index)}</loc>
  </sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n');
  return new PipelineResponse(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': sitemap.lastModified,
    },
  });
}

export async function sitemapIndexPipe(state, req) {
  const { log } = state;
  state.type = 'sitemap-index';

  if (state.info?.path !== '/sitemap-index.xml') {
    // this should not happen as it would mean that the caller used the wrong route. so we respond
    // with a 500 to indicate that something is wrong.
    return new PipelineResponse('', {
      status: 500,
      headers: {
        'x-error': 'invalid route',
      },
    });
  }

  /** @type PipelineResponse */
  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });

  try {
    await initConfig(state, req, res);

    // fetch sitemap.xml
    state.timer?.update('content-fetch');
    await fetchContent(state, req, res);
    if (res.status === 404) {
      const ret = await generateSitemapIndex(state);
      if (ret.status === 200) {
        res.status = 200;
        recordLastModified(state, res, 'content', extractLastModified(ret.headers));
        delete res.error;
        state.content.data = ret.body;
      }
    }
    if (res.error) {
      // if content loading produced an error, we're done.
      throw new PipelineStatusError(res.status, res.error);
    }

    state.timer?.update('serialize');
    await renderCode(state, req, res);
    setLastModified(state, res);
    await setCustomResponseHeaders(state, req, res);
    await setXSurrogateKeyHeader(state, req, res);
  } catch (e) {
    res.error = e.message;
    res.status = e.code || 500;

    const level = res.status >= 500 ? 'error' : 'info';
    log[level](`pipeline status: ${res.status} ${res.error}`);
    res.headers.set('x-error', cleanupHeaderValue(res.error));
    if (res.status < 500) {
      await setCustomResponseHeaders(state, req, res);
      await setXSurrogateKeyHeader(state, req, res);
    }
  }
  return res;
}
