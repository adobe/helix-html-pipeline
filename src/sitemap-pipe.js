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
import escape from 'lodash.escape';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { requireProject } from './steps/authenticate.js';
import fetchConfig from './steps/fetch-config.js';
import fetchContent from './steps/fetch-content.js';
import fetchConfigAll from './steps/fetch-config-all.js';
import renderCode from './steps/render-code.js';
import setXSurrogateKeyHeader from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineStatusError } from './PipelineStatusError.js';
import { PipelineResponse } from './PipelineResponse.js';
import { extractLastModified, recordLastModified, setLastModified } from './utils/last-modified.js';

async function generateSitemap(state) {
  const {
    owner, repo, ref, contentBusId, s3Loader, log, partition,
    previewHost, liveHost, config: { host: prodCDN } = {},
  } = state;
  const ret = await s3Loader.getObject('helix-content-bus', `${contentBusId}/live/sitemap.json`);
  if (ret.status !== 200) {
    return ret;
  }
  let config;
  try {
    config = JSON.parse(ret.body);
  } catch (e) {
    log.info('failed to parse /sitemap.json', e);
    throw new PipelineStatusError(404, `Failed to parse /sitemap.json: ${e.message}`);
  }
  const { data } = config;
  if (!data || !Array.isArray(data)) {
    throw new PipelineStatusError(404, 'Expected \'data\' array not found in /sitemap.json');
  }
  const host = partition === 'preview'
    ? (previewHost || `${ref}--${repo}--${owner}.hlx.page`)
    : (prodCDN || liveHost || `${ref}--${repo}--${owner}.hlx.live`);
  const loc = ({ path, lastModified }) => `  <url>
    <loc>https://${host}${escape(path)}</loc>
    <lastmod>${new Date(lastModified * 1000).toISOString().substring(0, 10)}</lastmod>
  </url>`;
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...data.map((record) => loc(record)),
    '</urlset>',
  ].join('\n');
  return new PipelineResponse(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  });
}

/**
 * Serves or renders the sitemap xml. The sitemap is always served from the preview content-bus
 * partition.
 *
 * todo: currently only serves an existing sitemap.xml from the contentbus.
 *       generate sitemap on the fly based on the sitemap.json
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function sitemapPipe(state, req) {
  const { log } = state;
  state.type = 'sitemap';

  if (state.info?.path !== '/sitemap.xml') {
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

  try { // fetch config first, since we need to compute the content-bus-id from the fstab ...
    state.timer?.update('config-fetch');
    await fetchConfig(state, req, res);
    if (!state.contentBusId) {
      res.status = 400;
      res.headers.set('x-error', 'contentBusId missing');
      return res;
    }

    // fetch sitemap.xml

    state.timer?.update('content-fetch');
    await Promise.all([
      fetchConfigAll(state, req, res),
      fetchContent(state, req, res),
    ]);

    await requireProject(state, req, res);
    // authentication is handled in hlx.page vcl
    if (res.status === 404) {
      const ret = await generateSitemap(state);
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
