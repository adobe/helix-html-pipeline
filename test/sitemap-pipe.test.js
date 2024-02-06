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
import { FileS3Loader } from './FileS3Loader.js';
import {
  sitemapPipe, PipelineRequest, PipelineState,
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

describe('Sitemap Pipe Test', () => {
  it('responds with 500 for non sitemap', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE(),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'invalid route',
    });
  });

  it('responds with 500 for content-bus errors', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader().status('sitemap.xml', 500),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap.xml from content-bus: 500',
    });
  });

  it('responds with 404 for sitemap and json not found', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .status('sitemap.json', 404),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /sitemap.xml from content-bus: 404',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
  });

  it('responds with 404 for sitemap not found and corrupt json', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .rewrite('sitemap.json', 'sitemap-corrupt.json'),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'Failed to parse /sitemap.json: Unexpected token \'h\', "this is not JSON" is not valid JSON',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
  });

  it('responds with 404 for sitemap not found and bad \'data\' property', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404)
          .rewrite('sitemap.json', 'sitemap-bad-data.json'),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': "Expected 'data' array not found in /sitemap.json",
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
  });

  it('serves sitemap from preview', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        path: '/sitemap.xml',
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
      'x-surrogate-key': 'rCCgYLwPe4ckYgJ7 RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    <url>
        <loc>https://www.aem.live/</loc>
    </url>
    <url>
        <loc>https://www.aem.live/developer</loc>
    </url>
</urlset>
`);
  });

  it('renders sitemap from preview with fallback origin', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://ref--repo--owner.hlx.page/</loc>
    <lastmod>2023-11-30</lastmod>
  </url>
  <url>
    <loc>https://ref--repo--owner.hlx.page/test</loc>
    <lastmod>2023-12-21</lastmod>
  </url>
</urlset>`);
  });

  it('renders sitemap from preview with preview host', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            preview: {
              host: '$ref--$repo--$owner.my.page',
            },
          },
        },
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404),
        path: '/sitemap.xml',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://ref--repo--owner.my.page/</loc>
    <lastmod>2023-11-30</lastmod>
  </url>
  <url>
    <loc>https://ref--repo--owner.my.page/test</loc>
    <lastmod>2023-12-21</lastmod>
  </url>
</urlset>`);
  });

  it('renders sitemap from live with prod CDN', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            prod: {
              host: 'www.adobe.com',
            },
          },
        },
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404),
        path: '/sitemap.xml',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.adobe.com/</loc>
    <lastmod>2023-11-30</lastmod>
  </url>
  <url>
    <loc>https://www.adobe.com/test</loc>
    <lastmod>2023-12-21</lastmod>
  </url>
</urlset>`);
  });

  it('renders sitemap from live with live host', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            live: {
              host: '$ref--$repo--$owner.my.live',
            },
          },
        },
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404),
        path: '/sitemap.xml',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://ref--repo--owner.my.live/</loc>
    <lastmod>2023-11-30</lastmod>
  </url>
  <url>
    <loc>https://ref--repo--owner.my.live/test</loc>
    <lastmod>2023-12-21</lastmod>
  </url>
</urlset>`);
  });

  it('renders sitemap from live with fallback origin', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader()
          .status('sitemap.xml', 404),
        path: '/sitemap.xml',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );

    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/xml; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'RXei-6EcTEMTEIqi foobar_metadata ref--repo--owner_head',
    });
    assert.strictEqual(resp.body, `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://ref--repo--owner.hlx.live/</loc>
    <lastmod>2023-11-30</lastmod>
  </url>
  <url>
    <loc>https://ref--repo--owner.hlx.live/test</loc>
    <lastmod>2023-12-21</lastmod>
  </url>
</urlset>`);
  });

  it('handles pipeline errors', async () => {
    const resp = await sitemapPipe(
      DEFAULT_STATE({
        path: '/sitemap.xml',
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
