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
import path from 'path';
import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import { assertHTMLEquals } from './utils.js';

import { htmlPipe, PipelineRequest, PipelineState } from '../src/index.js';
import { FileS3Loader } from './FileS3Loader.js';

describe('Rendering', () => {
  let loader;

  beforeEach(() => {
    loader = new FileS3Loader();
  });

  async function render(url, selector = '', expectedStatus = 200) {
    const req = new PipelineRequest(url, {
      headers: new Map([['host', url.hostname]]),
      body: '',
    });

    const state = new PipelineState({
      log: console,
      s3Loader: loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: selector ? `${url.pathname}${selector}.html` : url.pathname,
      contentBusId: 'foo-id',
      timer: {
        update: () => { },
      },
    });

    const res = await htmlPipe(state, req);
    assert.strictEqual(res.status, expectedStatus);
    return res;
  }

  // eslint-disable-next-line default-param-last
  async function testRender(url, domSelector = 'main', expStatus) {
    if (!(url instanceof URL)) {
      // eslint-disable-next-line no-param-reassign
      url = new URL(`https://helix-pages.com/${url}`);
    }
    const spec = url.pathname.split('/').pop();
    const expFile = path.resolve(__testdir, 'fixtures', 'content', `${spec}.html`);
    let expHtml = null;
    try {
      expHtml = await readFile(expFile, 'utf-8');
    } catch {
      // ignore
    }
    if (!expStatus) {
      // eslint-disable-next-line no-param-reassign
      expStatus = expHtml === null ? 404 : 200;
    }
    const response = await render(url, '', expStatus);
    const actHtml = response.body;
    // console.log(actHtml);
    if (expStatus === 200) {
      const $actMain = new JSDOM(actHtml).window.document.querySelector(domSelector);
      const $expMain = new JSDOM(expHtml).window.document.querySelector(domSelector);
      await assertHTMLEquals($actMain.outerHTML, $expMain.outerHTML);
    }
    return response;
  }

  async function testRenderPlain(url, spec) {
    if (!(url instanceof URL)) {
      // eslint-disable-next-line no-param-reassign
      url = new URL(`https://helix-pages.com/${url}`);
    }
    if (!spec) {
      // eslint-disable-next-line no-param-reassign
      spec = url.pathname.split('/').pop();
    }
    const response = await render(url, '.plain');
    const actHtml = response.body;
    // console.log(actHtml);
    const expHtml = await readFile(path.resolve(__testdir, 'fixtures', 'content', `${spec}.plain.html`), 'utf-8');
    const $actMain = new JSDOM(actHtml).window.document.querySelector('body');
    const $expMain = new JSDOM(expHtml).window.document.querySelector('body');
    await assertHTMLEquals($actMain.outerHTML, $expMain.outerHTML);
    return response;
  }

  describe('Section DIVS', () => {
    it('renders document with 1 section correctly', async () => {
      await testRender('one-section');
    });

    it('renders document with 1 section correctly (plain)', async () => {
      await testRenderPlain('one-section');
    });

    it('renders document with 3 sections correctly', async () => {
      await testRender('simple');
    });

    it('renders document with 3 sections correctly (plain)', async () => {
      await testRenderPlain('simple');
    });
  });

  describe('Images', () => {
    it('renders images.md correctly', async () => {
      await testRender('images');
    });
    it('unwrapps images', async () => {
      await testRender('unwrap-images');
    });
  });

  describe('Icons', () => {
    it('renders icons.md correctly', async () => {
      await testRender('icons', 'main');
    });
  });

  describe('Headings', () => {
    it('renders headings.md correctly', async () => {
      await testRender('headings', 'main');
    });

    it('renders md-headings.md correctly', async () => {
      await testRender('md-headings', 'main');
    });
  });

  describe('Page Block', () => {
    it('renders document with singe column page block', async () => {
      await testRender('page-block-1-col');
    });

    it('renders document with singe column page block (plain)', async () => {
      await testRenderPlain('page-block-1-col');
    });

    it('renders document with double column page block', async () => {
      await testRender('page-block-2-col');
    });

    it('renders document with double column page block (plain)', async () => {
      await testRenderPlain('page-block-2-col');
    });

    it('renders document with formatting in header', async () => {
      await testRender('page-block-strong');
    });

    it('renders document with empty header', async () => {
      await testRender('page-block-no-title');
    });

    it('renders document with some empty header', async () => {
      await testRender('page-block-empty-cols');
    });

    it('renders document html tables', async () => {
      await testRender('page-block-with-html-table');
    });

    it('renders document tables in tables', async () => {
      await testRender('page-block-table-in-table');
    });

    it('renders document with _strong_ in p (legacy)', async () => {
      // todo: remove once clear dom is produced
      await testRender('stray-p-strong', 'main');
    });
  });

  describe('Metadata', () => {
    it('renders meta tags from metadata json', async () => {
      loader.status('config-all.json', 404);
      await testRender('page-metadata-json', 'head');
    });

    it('renders meta tags from metadata json (legacy)', async () => {
      loader.status('config-all.json', 404);
      loader.rewrite('metadata.json', 'metadata-legacy.json');
      await testRender('page-metadata-json', 'head');
    });

    it('renders meta tags from metadata html block', async () => {
      loader.status('config-all.json', 404);
      await testRender('page-metadata-block-html', 'head');
    });

    it('renders meta tags from metadata block', async () => {
      loader.status('config-all.json', 404);
      await testRender('page-metadata-block', 'head');
    });

    it('renders multi value meta tags from metadata block in paragraphs', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('page-metadata-block-multi-p', 'head');
    });

    it('renders multi value meta tags from metadata block in unordered lists', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('page-metadata-block-multi-ul', 'head');
    });

    it('renders multi value meta tags from metadata block in ordered lists', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('page-metadata-block-multi-ol', 'head');
    });

    it('renders multi value meta tags from metadata block in links', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('page-metadata-block-multi-a', 'head');
    });

    it('renders canonical from metadata block', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('page-metadata-block-canonical', 'head');
    });

    it('uses correct title and hero image', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender(new URL('https://super-test--helix-pages--adobe.hlx3.page/marketing/page-metadata-content-blocks'), 'head');
    });

    it('uses correct image', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('image', 'html');
    });

    it('uses correct image - no alt text', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('image-no-alt', 'html');
    });

    it('uses correct image - from metadata', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('image-from-meta', 'html');
    });

    it('uses correct description', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('description-long', 'head');
    });

    it('uses correct description from table', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('description', 'head');
    });

    it('uses correct description with blockquote', async () => {
      loader.status('config-all.json', 404);
      loader.status('metadata.json', 404);
      await testRender('description-blockquote', 'head');
    });
  });

  describe('Miscellaneous', () => {
    it('sets the surrogate-keys correctly', async () => {
      const resp = await testRender('page-block-empty-cols');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), '_5g3dEf12QuYUAwe rDFj9gBeGHx_FI2T foo-id_metadata super-test--helix-pages--adobe_head');
    });

    it('sets the surrogate-keys correctly for plain', async () => {
      const resp = await testRenderPlain('one-section');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), '0j8f6rmY3lU5kgOE oHjg_WDu20CBS4rD foo-id_metadata super-test--helix-pages--adobe_head');
    });

    it('sets the surrogate-keys correctly for index.plain.html', async () => {
      const resp = await testRenderPlain('one-section/index', 'one-section/index');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), '-RNwtJ99NJmYY2L- Vp-I6NB8PSor1sI6 foo-id_metadata super-test--helix-pages--adobe_head');
    });

    it('renders the fedpub header correctly', async () => {
      await testRenderPlain('fedpub-header');
    });

    it('renders styling test document correctly', async () => {
      await testRenderPlain('styling');
    });

    it('renders document with gridtables correctly', async () => {
      await testRender('page-with-gridtables');
    });

    it('renders header correctly if head is missing', async () => {
      loader.rewrite('helix-config.json', 'helix-config-no-head.json');
      await testRender('no-head-html', 'html');
    });

    it('renders header correctly if head has linefeed', async () => {
      loader.rewrite('helix-config.json', 'helix-config-head-with-script.json');
      await testRender('head-with-script', 'html');
    });

    it('renders header correctly if head.html is missing', async () => {
      loader.rewrite('helix-config.json', 'helix-config-no-head-html.json');
      await testRender('no-head-html', 'html');
    });

    it('renders 404 if content not found', async () => {
      await testRender('not-found', 'html');
    });

    it('renders 404.html if content not found', async () => {
      loader
        .rewrite('404.html', '404-test.html')
        .headers('404-test.html', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2009 17:50:00 GMT');
      const { body, headers } = await testRender('not-found-with-handler', 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Wed, 12 Oct 2009 17:50:00 GMT',
        'x-surrogate-key': 'OYsA_wfqip5EuBu6 super-test--helix-pages--adobe_404',
        'x-error': 'failed to load /not-found-with-handler.md from content-bus: 404',
        'access-control-allow-origin': '*',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
      assert.strictEqual(body.trim(), '<html><body>There might be dragons.</body></html>');
    });

    it('renders 404 if helix-config not found', async () => {
      loader.status('helix-config.json', 404);
      await testRender('no-head-html', 'html', 404);
    });

    it('renders 404 for /index', async () => {
      loader.rewrite('index.md', 'simple.md');
      await testRender('index', 'html', 404);
    });

    it('renders 400 for invalid helix-config', async () => {
      loader.rewrite('helix-config.json', 'helix-config.corrupt');
      await testRender('no-head-html', 'html', 400);
    });

    it('renders 301 for redirect file', async () => {
      loader.headers('one-section.md', 'x-amz-meta-redirect-location', 'https://www.adobe.com');
      const ret = await render(new URL('https://localhost/one-section'), '', 301);
      assert.strictEqual(ret.headers.get('location'), 'https://www.adobe.com');
    });

    it('respect folder mapping: self and descendents', async () => {
      let resp = await render(new URL('https://helix-pipeline.com/products'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products">/);

      loader.rewrite('generic-product/metadata.json', 'metadata-product.json');
      resp = await render(new URL('https://helix-pipeline.com/products/product1'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products\/product1">/);
      assert.match(resp.body, /<title>Product<\/title>/);
    });

    it('respect folder mapping: only descendents', async () => {
      let resp = await render(new URL('https://helix-pipeline.com/articles'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<link rel="canonical" href="https:\/\/www.adobe.com\/articles">/);

      resp = await render(new URL('https://helix-pipeline.com/articles/document1'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<link rel="canonical" href="https:\/\/www.adobe.com\/articles\/document1">/);
    });

    it('respect folder mapping: load from code-bus', async () => {
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/app/todos/1'));
      assert.strictEqual(status, 200);
      assert.strictEqual(body.trim(), '<script>alert("hello, world");</script>');
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'zxdhoulVcSRWb0Ky ZHQXDa0L7jSHQHPX foo-id_metadata super-test--helix-pages--adobe_head',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('respect metadata with folder mapping: self and descendents', async () => {
      loader.status('config-all.json', 404);
      let resp = await render(new URL('https://helix-pipeline.com/products'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<meta name="short-title" content="E">/);
      assert.match(resp.body, /<meta property="og:publisher" content="Adobe">/);
      assert.match(resp.body, /<meta name="keywords" content="Exactomento Mapped Folder">/);

      resp = await render(new URL('https://helix-pipeline.com/products/product1'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<meta name="short-title" content="E">/);
      assert.match(resp.body, /<meta property="og:publisher" content="Adobe">/);
      assert.match(resp.body, /<meta name="keywords" content="Exactomento Mapped Folder">/);
    });

    it('uses last modified from helix-config', async () => {
      loader.status('config-all.json', 404);
      loader
        .headers('helix-config.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Jan 2022 11:33:01 GMT')
        .headers('index.md', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Jan 2022 10:50:00 GMT')
        .headers('metadata.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Jan 2022 09:50:00 GMT');
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/blog/'));
      assert.strictEqual(status, 200);
      assert.match(body, /<link rel="canonical" href="https:\/\/helix-pipeline\.com\/blog\/">/);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'x-surrogate-key': '-RNwtJ99NJmYY2L- o_fNQBWBLWTIfYqV foo-id_metadata super-test--helix-pages--adobe_head',
        'last-modified': 'Wed, 12 Jan 2022 11:33:01 GMT',
      });
    });

    it('uses last modified from metadata.json', async () => {
      loader.status('config-all.json', 404);
      loader
        .headers('helix-config.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2009 11:50:00 GMT')
        .headers('index.md', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2022 12:50:00 GMT')
        .headers('metadata.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2022 09:33:01 GMT');
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/blog/'));
      assert.strictEqual(status, 200);
      assert.match(body, /<link rel="canonical" href="https:\/\/helix-pipeline\.com\/blog\/">/);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'x-surrogate-key': '-RNwtJ99NJmYY2L- o_fNQBWBLWTIfYqV foo-id_metadata super-test--helix-pages--adobe_head',
        'last-modified': 'Wed, 12 Oct 2022 12:50:00 GMT',
      });
    });

    it('ignores last modified from metadata.json for plain', async () => {
      loader.status('config-all.json', 404);
      loader
        .headers('helix-config.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2009 11:50:00 GMT')
        .headers('one-section.md', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2022 12:50:00 GMT')
        .headers('metadata.json', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Oct 2022 15:33:01 GMT');
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/blog/one-section'), '.plain');
      assert.strictEqual(status, 200);
      assert.match(body, /<div class="test">\s*<h1 id="hello">Hello<\/h1>\s*<p>This is the first section.<\/p>\s*<\/div>/);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'x-surrogate-key': '0j8f6rmY3lU5kgOE Nep3VelSa1voMXR- foo-id_metadata super-test--helix-pages--adobe_head',
        'last-modified': 'Wed, 12 Oct 2022 12:50:00 GMT',
      });
    });

    it('uses response headers from metadata.json', async () => {
      loader.status('config-all.json', 404);
      loader.rewrite('metadata.json', 'metadata-headers.json');
      const { headers } = await testRender('meta-response-headers', 'head');
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'",
        'content-security-policy-report-only': 'true',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-origin': '*',
        link: '/more-styles.css',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'zh7-SbNEyY3CnWoh BqwCiOrhMfJvUe79 foo-id_metadata super-test--helix-pages--adobe_head',
      });
    });

    it('uses response headers from metadata.json (ignores link on .plain.html)', async () => {
      loader.status('config-all.json', 404);
      loader.rewrite('metadata.json', 'metadata-headers.json');

      const { headers } = await testRenderPlain('meta-response-headers');
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'",
        'content-security-policy-report-only': 'true',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-origin': '*',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'zh7-SbNEyY3CnWoh BqwCiOrhMfJvUe79 foo-id_metadata super-test--helix-pages--adobe_head',
      });
    });
  });
});
