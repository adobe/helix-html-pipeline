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

/* eslint-env mocha */
import assert from 'assert';
import esmock from 'esmock';
import { FileS3Loader } from './FileS3Loader.js';
import {
  sitemapPipe, PipelineRequest, PipelineResponse, PipelineState,
} from '../src/index.js';
import { StaticS3Loader } from './StaticS3Loader.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
};

function createDefaultState(overrides) {
  return new PipelineState({
    path: '/sitemap.xml',
    org: 'org',
    site: 'site',
    ref: 'ref',
    partition: 'preview',
    config: DEFAULT_CONFIG,
    s3Loader: new FileS3Loader(),
    timer: {
      update: () => {},
    },
    ...overrides,
  });
}

describe('Sitemap Pipe Test', () => {
  it('responds with 500 for non sitemap', async () => {
    const state = createDefaultState({
      path: '/foo.html',
    });
    const resp = await sitemapPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'invalid route',
    });
  });

  it('responds with 500 for content-bus errors', async () => {
    const state = createDefaultState({
      s3Loader: new FileS3Loader().status('sitemap.xml', 500),
    });
    const resp = await sitemapPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap.xml from content-bus: 500',
    });
  });

  it('responds with 404 for sitemap not found', async () => {
    const state = createDefaultState({
      s3Loader: new FileS3Loader().status('sitemap.xml', 404),
    });
    const resp = await sitemapPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap.xml from content-bus: 404',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
  });

  it('responds with 500 for pipeline errors', async () => {
    const state = createDefaultState({
      timer: {
        update: () => { throw Error('kaputt'); },
      },
    });
    const resp = await sitemapPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'kaputt',
    });
  });

  it('serves sitemap.xml', async () => {
    const state = createDefaultState({
      timer: {
        update: () => { throw Error('kaputt'); },
      },
    });

    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      partition: 'live',
      path: '/sitemap.xml',
      timer: {
        update: () => { },
      },
    });
    const resp = await sitemapPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.startsWith('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });
});
