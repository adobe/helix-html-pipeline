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

describe('Sitemap Pipe Test', () => {
  it('responds with 500 for non sitemap', async () => {
    const resp = await sitemapPipe(
      new PipelineState({ path: '/foo.html' }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'invalid route',
    });
  });

  it('responds with 500 for content-bus errors', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader().status('sitemap.xml', 500),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-error': 'failed to load /sitemap.xml from content-bus: 500',
    });
  });

  it('responds with 404 for sitemap and json not found', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .status('sitemap.json', 404),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-error': 'failed to load /sitemap.xml from content-bus: 404',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('responds with 404 for sitemap not found and corrupt json', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .rewrite('sitemap.json', 'sitemap-corrupt.json'),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-error': 'Failed to parse /sitemap.json: Unexpected token h in JSON at position 1',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('responds with 404 for sitemap not found and bad \'data\' property', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .rewrite('sitemap.json', 'sitemap-bad-data.json'),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-error': 'Expected \'data\' array not found in /sitemap.json',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('renders sitemap from preview', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader().status('sitemap.xml', 404),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'preview',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('renders sitemap from live with no config-all', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .status('config-all.json', 404),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('renders sitemap from live with prod CDN', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader().status('sitemap.xml', 404),
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        partition: 'live',
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'lkDPpF5moMrrCXQM foo-id_metadata ref--repo--owner_head',
    });
  });

  it('responds with 500 for pipeline errors', async () => {
    /** @type sitemapPipe */
    const { sitemapPipe: mockPipe } = await esmock('../src/sitemap-pipe.js', {
      '../src/steps/fetch-config.js': () => {
        throw Error('kaputt');
      },
    });

    const resp = await mockPipe(
      new PipelineState({ s3Loader: new FileS3Loader(), path: '/sitemap.xml' }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'kaputt',
    });
  });

  it('responds with 400 for missing contentBusId', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        path: '/sitemap.xml',
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        s3Loader: new StaticS3Loader()
          .reply(
            'helix-code-bus',
            'owner/repo/ref/helix-config.json',
            new PipelineResponse('{}'),
          ),
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 400);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'contentBusId missing',
    });
  });

  it('responds with 404 for missing helix-config', async () => {
    const resp = await sitemapPipe(
      new PipelineState({
        path: '/sitemap.xml',
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        s3Loader: new FileS3Loader().status('helix-config.json', 404),
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'unable to load /helix-config.json: 404',
      'x-surrogate-key': 'RCtFpbZCjJqnaZhA undefined_metadata ref--repo--owner_head',
    });
  });

  it('serves sitemap.xml', async () => {
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
