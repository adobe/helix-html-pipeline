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

/* eslint-env mocha */
import assert from 'assert';
import { FileS3Loader } from './FileS3Loader.js';
import {
  sitemapIndexPipe, PipelineRequest, PipelineState,
} from '../src/index.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
};

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'preview',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Sitemap Index Pipe Test', () => {
  it('responds with 500 for non sitemap index', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE(),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'invalid route',
    });
  });

  it('serves sitemap index from code-bus', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader(),
        path: '/sitemap-index.xml',
        ref: 'super-test',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'ZZOkta1rb0l_RkX5 super-test--repo--owner_code',
    });
  });

  it('responds with 500 for code-bus errors', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader().status('super-test/sitemap-index.xml', 500),
        path: '/sitemap-index.xml',
        ref: 'super-test',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap-index.xml from code-bus: 500',
    });
  });

  it('responds with 404 for sitemap index and index not found', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader().status('super-test/sitemap-index.xml', 500),
        path: '/sitemap-index.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap-index.xml from code-bus: 404',
      'x-surrogate-key': 'p_cZJxIGSYwKZfhCVe p_foobar N750VN-BhMP-VsHv ref--repo--owner_code',
    });
  });

  it('renders sitemap index from preview', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          sitemap: {
            index: ['/sitemap.xml'],
            lastModified: 'Fri, 30 Apr 2021 03:47:18 GMT',
          },
        },
        path: '/sitemap-index.xml',
        timer: {
          update: () => { },
        },
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'p_cZJxIGSYwKZfhCVe p_foobar',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://ref--repo--owner.aem.page/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`);
  });

  it('renders sitemap index from preview with preview host', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            preview: {
              host: '$ref--$repo--$owner.my.page',
            },
          },
          sitemap: {
            index: ['/sitemap.xml'],
            lastModified: 'Fri, 30 Apr 2021 03:47:18 GMT',
          },
        },
        path: '/sitemap-index.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'p_cZJxIGSYwKZfhCVe p_foobar',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://ref--repo--owner.my.page/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`);
  });

  it('renders sitemap index from live with prod CDN', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            preview: {
              host: '$ref--$repo--$owner.my.page',
            },
          },
          sitemap: {
            index: ['/sitemap.xml'],
            lastModified: 'Fri, 30 Apr 2021 03:47:18 GMT',
          },
        },
        path: '/sitemap-index.xml',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'cZJxIGSYwKZfhCVe foobar',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://ref--repo--owner.aem.live/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`);
  });

  it('renders sitemap index from live with live host', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            live: {
              host: '$ref--$repo--$owner.my.live',
            },
          },
          sitemap: {
            index: [
              '/sitemap.xml',
              'https://ref--repo--owner.my.live/my-other-sitemap.xml',
            ],
            lastModified: 'Fri, 30 Apr 2021 03:47:18 GMT',
          },
        },
        path: '/sitemap-index.xml',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'cZJxIGSYwKZfhCVe foobar',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://ref--repo--owner.my.live/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://ref--repo--owner.my.live/my-other-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`);
  });

  it('handles pipeline errors', async () => {
    const resp = await sitemapIndexPipe(
      DEFAULT_STATE({
        path: '/sitemap-index.xml',
        timer: {
          update: () => {
            throw new Error('boom!');
          },
        },
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );

    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'boom!',
    });
    assert.strictEqual(resp.body, '');
  });
});
