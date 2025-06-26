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
import path from 'path';
import { readFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import { assertHTMLEquals } from './utils.js';
import { FileS3Loader } from './FileS3Loader.js';

const mockCrypto = {
  getRandomValues: (array) => {
    const mockRandomValues = new TextEncoder().encode('rA4nd0mmmrA4nd0mmm');
    for (let i = 0; i < array.length; i += 1) {
      array[i] = mockRandomValues[i];
    }
  },
};

const { htmlPipe, PipelineRequest, PipelineState } = await esmock('../src/index.js', {
  '../src/html-pipe.js': await esmock('../src/html-pipe.js', {
    '../src/steps/render.js': await esmock('../src/steps/render.js', {
      '../src/steps/csp.js': await esmock('../src/steps/csp.js', {
        '#crypto': mockCrypto,
      }),
    }),
    '../src/steps/render-code.js': await esmock('../src/steps/render-code.js', {
      '../src/steps/csp.js': await esmock('../src/steps/csp.js', {
        '#crypto': mockCrypto,
      }),
    }),
    '../src/steps/fetch-404.js': await esmock('../src/steps/fetch-404.js', {
      '../src/steps/csp.js': await esmock('../src/steps/csp.js', {
        '#crypto': mockCrypto,
      }),
    }),
  }),
});

const METADATA = {
  data: {
    '/news/**': [
      {
        key: 'category',
        value: 'news',
      },
      {
        key: 'locale',
        value: 'en-US',
      },
    ],
    '/blog/**': [
      {
        key: 'category',
        value: 'blog',
      },
      {
        key: 'og:url',
        value: '""',
      },
    ],
    '/**': [
      {
        key: 'title',
        value: 'ACME CORP',
      },
      {
        key: 'description',
        value: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, urna eu tempor congue, nisi erat condimentum nunc, eget tincidunt nisl nunc euismod.',
      },
      {
        key: 'locale',
        value: 'en-US',
      },
      {
        key: 'empty-cell',
        value: '',
      },
      {
        key: 'zero-cell',
        value: '0',
      },
      {
        key: 'empty-string-cell',
        value: '""',
      },
    ],
  },
};

const HEADERS = {
  '/news/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: '*',
    },
    {
      key: 'access-control-request-method',
      value: 'DELETE',
    },
  ],
  '/blog/**': [
    {
      key: 'access-control-max-age',
      value: '86400',
    },
    {
      key: 'access-control-request-method',
      value: 'PUT',
    },
  ],
  '/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: '*',
    },
    {
      key: 'Link',
      value: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    },
  ],
};

const DEFAULT_CONFIG = {
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
  cdn: {
    prod: {
      host: 'www.adobe.com',
    },
  },
  head: {
    html: '<link id="favicon" rel="icon" type="image/svg+xml" href="/icons/spark.svg">\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<script src="/scripts.js" type="module"></script>\n<link rel="stylesheet" href="/styles.css"/>\n',
  },
  folders: {
    '/products': '/generic-product',
    '/articles/': '/special/default-article',
    '/app': '/spa/index.html',
    '/broken': '/not-a-page',
  },
  headers: HEADERS,
  metadata: {
    live: METADATA,
  },
};

const DEFAULT_CONFIG_EMPTY = {
  lastModified: 'Wed, 12 Jan 2022 11:33:01 GMT',
  contentBusId: 'foo-id',
  owner: 'adobe',
  repo: 'helix-pages',
  ref: 'main',
  head: {
    html: '<link id="favicon" rel="icon" type="image/svg+xml" href="/icons/spark.svg">\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<script src="/scripts.js" type="module"></script>\n<link rel="stylesheet" href="/styles.css"/>\n',
  },
};

describe('Rendering', () => {
  let loader;
  let config;

  beforeEach(() => {
    loader = new FileS3Loader();
    config = DEFAULT_CONFIG;
  });

  async function render(url, selector = '', expectedStatus = 200, partition = 'live') {
    const req = new PipelineRequest(url, {
      headers: new Map([['host', url.hostname]]),
      body: '',
    });

    const state = new PipelineState({
      log: console,
      s3Loader: loader,
      org: 'adobe',
      site: 'helix-pages',
      ref: 'super-test',
      partition,
      config,
      path: selector ? `${url.pathname}${selector}.html` : url.pathname,
      timer: {
        update: () => { },
      },
    });

    const res = await htmlPipe(state, req);
    assert.strictEqual(res.status, expectedStatus);
    return res;
  }

  // eslint-disable-next-line default-param-last
  async function testRender(url, domSelector = 'main', expStatus, partition = 'live') {
    if (!(url instanceof URL)) {
      // eslint-disable-next-line no-param-reassign
      url = new URL(`https://helix-pages.com/${url}`);
    }
    const pathname = url.pathname
      .replace(/\/*$/, '')
      .replace(/^\/*/, '');
    const expFile = path.resolve(__testdir, 'fixtures', 'content', `${pathname}.html`);
    let expHtml = null;
    try {
      expHtml = await readFile(expFile, 'utf-8');
    } catch {
      // ignore
    }
    // console.log(expHtml);
    if (!expStatus) {
      // eslint-disable-next-line no-param-reassign
      expStatus = expHtml === null ? 404 : 200;
    }
    const response = await render(url, '', expStatus, partition);
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
      spec = url.pathname.substring(1);
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

  async function testRenderCode(url, expStatus = 200, spec = null, forceCompare = false) {
    if (!(url instanceof URL)) {
      // eslint-disable-next-line no-param-reassign
      url = new URL(`https://helix-pages.com/${url}`);
    }

    // eslint-disable-next-line no-param-reassign
    spec = spec || url.pathname.split('/').pop().split('.')[0];
    const expFile = path.resolve(__testdir, 'fixtures', 'code/super-test', `${spec}.ref.html`);
    let expHtml = null;
    try {
      expHtml = await readFile(expFile, 'utf-8');
    } catch {
      // ignore
    }

    const response = await render(url, '', expStatus);
    assert.strictEqual(response.status, expStatus);
    const actHtml = response.body;
    // console.log(actHtml);
    if (expStatus === 200 || forceCompare) {
      /*
       we use strict equality here because we want to ensure minimal intrusion in the customer HTML
       by the rendering pipeline. JSDOM will normalize the HTML, so we can't use it for comparison.
      */
      assert.strictEqual(actHtml, expHtml);
    }
    return response;
  }

  describe('Section DIVS', () => {
    it('renders document with 1 section correctly', async () => {
      await testRender('one-section');
    });

    it('renders large document correctly', async () => {
      await testRender('large');
    }).timeout(10000);

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

    it('renders icons-ignored.md correctly', async () => {
      await testRender('icons-ignored', 'main');
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
    it('renders combined metadata', async () => {
      await testRender('blog/page-metadata-block', 'head');
    });

    it('renders multi value meta tags from metadata block in paragraphs', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-multi-p', 'head');
    });

    it('renders multi value meta tags from metadata block in unordered lists', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-multi-ul', 'head');
    });

    it('renders multi value meta tags from metadata block in ordered lists', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-multi-ol', 'head');
    });

    it('renders multi value meta tags from metadata block in links', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-multi-a', 'head');
    });

    it('renders canonical from metadata block', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-canonical', 'head');
    });

    it('does not no og:url for empty string in document', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-block-empty-url', 'head');
    });

    it('uses correct title and hero image', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender(new URL('https://super-test--helix-pages--adobe.hlx3.page/marketing/page-metadata-content-blocks'), 'head');
    });

    it('uses correct image', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('image', 'html');
    });

    it('uses correct image - no alt text', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('image-no-alt', 'html');
    });

    it('uses correct image - with title attribute', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('image-with-title', 'html');
    });

    it('uses correct image - from metadata', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('image-from-meta', 'html');
    });

    it('uses correct image - from metadata with rewrite', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('image-from-meta-rewrite', 'html');
    });

    it('uses correct image - from metadata with rewrite (link)', async () => {
      loader.status('config-all.json', 404);
      await testRender('image-from-meta-rewrite-link', 'html');
    });

    it('uses correct description', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('description-long', 'head');
    });

    it('uses correct description from table', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('description', 'head');
    });

    it('uses correct description with blockquote', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('description-blockquote', 'head');
    });

    it('does not fallback for empty cell', async () => {
      await testRender('page-metadata-no-fallback', 'head');
    });

    it('sets proper twitter fallbacks', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-twitter-fallback', 'head');
    });

    it('injects json ld', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-jsonld', 'head');
    });

    it('injects json ld even for multi-list cells', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-jsonld-list', 'head');
    });

    it('chooses last json-ld if multiple', async () => {
      config = {
        ...DEFAULT_CONFIG_EMPTY,
        metadata: {
          live: {
            data: {
              '/**': [{
                key: 'json-ld',
                value: '{"@context":"http://schema.org","@type":"Product","sku":"AA-BB-GLOBAL"}',
              }],
            },
          },
        },
      };
      await testRender('page-metadata-jsonld-multi', 'head');
    });

    it('injects global json ld', async () => {
      config = {
        ...DEFAULT_CONFIG_EMPTY,
        metadata: {
          live: {
            data: {
              '/**': [{
                key: 'json-ld',
                value: '{"@context":"http://schema.org","@type":"Product","sku":"AA-BB-GLOBAL"}',
              }],
            },
          },
        },
      };
      await testRender('page-metadata-jsonld-global', 'head');
    });

    it('appends the canonical extension and title suffix', async () => {
      config = {
        ...DEFAULT_CONFIG_EMPTY,
        metadata: {
          live: {
            data: {
              '/**': [{
                key: 'canonical:extension',
                value: 'html',
              }, {
                key: 'title:suffix',
                value: ' | Adobe',
              }],
            },
          },
        },
      };
      await testRender('page-metadata-canonical-suffix', 'head');
    });

    it('ignores the canonical extension on folders', async () => {
      config = {
        ...DEFAULT_CONFIG_EMPTY,
        metadata: {
          live: {
            data: {
              '/**': [{
                key: 'canonical:extension',
                value: 'html',
              }],
            },
          },
        },
      };
      await testRender('page-metadata-canonical-suffix-folder/', 'head');
    });

    it('detects errors in json ld', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-jsonld-error', 'head');
    });

    it('prevents xss in json ld', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-jsonld-xss', 'head');
    });

    it('injects html lang', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-htmllang', ':scope');
    });

    it('accepts short html lang', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-htmllang-short', ':scope');
    });

    it('injects hreflang link', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await testRender('page-metadata-hreflang', ':scope');
    });
  });

  describe('Miscellaneous', () => {
    it('sets the surrogate-keys correctly', async () => {
      const resp = await testRender('page-block-empty-cols');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), 'rDFj9gBeGHx_FI2T foo-id_metadata super-test--helix-pages--adobe_head foo-id');
    });

    it('sets the surrogate-keys correctly for plain', async () => {
      const resp = await testRenderPlain('one-section');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), 'oHjg_WDu20CBS4rD foo-id_metadata super-test--helix-pages--adobe_head foo-id');
    });

    it('sets the surrogate-keys correctly for index.plain.html', async () => {
      const resp = await testRenderPlain('one-section/index', 'one-section/index');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), 'Vp-I6NB8PSor1sI6 foo-id_metadata super-test--helix-pages--adobe_head foo-id');
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

    it('renders document with many image references quickly', async () => {
      await testRender('gt-many-refs');
    });

    it('renders header correctly if head is missing', async () => {
      config = {
        ...DEFAULT_CONFIG,
        head: null,
      };
      await testRender('no-head-html', 'html');
    });

    it('renders header correctly if head has linefeed', async () => {
      config = {
        ...DEFAULT_CONFIG,
        head: {
          html: '<script>\n// comment\na = 1;</script>\n',
        },
      };
      await testRender('head-with-script', 'html');
    });

    it('renders csp nonce meta', async () => {
      config = {
        ...DEFAULT_CONFIG,
        head: {
          // eslint-disable-next-line quotes
          html: `<meta http-equiv="content-security-policy" content="script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';">\n`
            + '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="aem" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem" > const a = 1 </script>\n'
            + '<style nonce="aem" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-meta', 'html');
      assert.ok(!headers.get('content-security-policy'));
    });

    it('renders csp nonce headers', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'Content-Security-Policy',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
        head: {
          html: '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="aem" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem" > const a = 1 </script>\n'
            + '<style nonce="aem" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-headers', 'html');
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders csp nonce header - report-only', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'Content-Security-Policy-Report-Only',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
        head: {
          html: '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="aem" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem" > const a = 1 </script>\n'
            + '<style nonce="aem" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-headers', 'html');
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy-report-only'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders csp nonce metadata - move as header', async () => {
      config = {
        ...DEFAULT_CONFIG,
        head: {
          // eslint-disable-next-line quotes
          html: `<meta http-equiv="content-security-policy" content="script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';" move-as-header="true" />\n`
            + '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="aem" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem"> const a = 1 </script>\n'
            + '<style nonce="aem" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-meta-move-as-header', 'html');
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders csp nonce headers and metadata - move as header', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'content-security-policy',
              value: 'frame-ancestors \'self\'',
            },
          ],
        },
        head: {
          // eslint-disable-next-line quotes
          html: `<meta http-equiv="content-security-policy" content="script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';" move-as-header="true">\n`
            + '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="aem" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem" > const a = 1 </script>\n'
            + '<style nonce="aem" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-headers-meta', 'html');
      assert.strictEqual(headers.get('content-security-policy'), 'frame-ancestors \'self\'');
    });

    it('renders csp nonce script only', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'content-security-policy',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-aem' 'strict-dynamic'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
        head: {
          html: '<link nonce="aem" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="aem" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="aem" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="aem"> const a = 1 </script>\n'
            + '<style id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-script-only', 'html');
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; base-uri 'self'; object-src 'none';`);
    });

    it('does not alter csp nonce if already set to a different value by meta', async () => {
      config = {
        ...DEFAULT_CONFIG,
        head: {
          // eslint-disable-next-line quotes
          html: `<meta http-equiv="content-security-policy" content="script-src 'nonce-r4nD0m' 'strict-dynamic'; style-src 'nonce-r4nD0m'; base-uri 'self'; object-src 'none';">\n`
            + '<link nonce="r4nD0m" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="r4nD0m" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="r4nD0m" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="r4nD0m" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="r4nD0m" > const a = 1 </script>\n'
            + '<style nonce="r4nD0m" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-meta-different', 'html');
      assert.ok(!headers.get('content-security-policy'));
    });

    it('does not alter csp nonce if already set to a different value by header', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'Content-Security-Policy',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-r4nD0m' 'strict-dynamic'; style-src 'nonce-r4nD0m'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
        head: {
          html: '<link nonce="r4nD0m" rel="preload" as="script" href="/scripts/aem.js"/>\n'
            + '<script nonce="r4nD0m" src="/scripts/aem.js" type="module"></script>\n'
            + '<script nonce="r4nD0m" src="/scripts/scripts.js" type="module"></script>\n'
            + '<link nonce="r4nD0m" rel="stylesheet" href="/styles/styles.css"/>\n'
            + '<script nonce="r4nD0m" > const a = 1 </script>\n'
            + '<style nonce="r4nD0m" id="at-body-style">body {opacity: 1}</style>',
        },
      };
      const { headers } = await testRender('nonce-headers-different', 'html');
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-r4nD0m' 'strict-dynamic'; style-src 'nonce-r4nD0m'; base-uri 'self'; object-src 'none';`);
    });

    it('renders 404 if content not found', async () => {
      await testRender('not-found', 'html');
      // preview (code coverage)
      await testRender('not-found', 'html', 404, 'preview');
    });

    it('can render empty table row', async () => {
      await testRender('empty-table-row', 'main');
    });

    it('renders 404.html if content not found', async () => {
      loader
        .rewrite('404.html', 'super-test/404-test.html')
        .headers('super-test/404-test.html', 'x-amz-meta-x-source-last-modified', 'Mon, 12 Oct 2009 17:50:00 GMT');
      const { body, headers } = await testRender('not-found-with-handler', 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
        'x-surrogate-key': 'OYsA_wfqip5EuBu6 foo-id fRCqxCtsDrp5LOYW super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
        'x-error': 'failed to load /not-found-with-handler.md from content-bus: 404',
        'access-control-allow-origin': '*',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
      assert.strictEqual(body.trim(), '<html><body>There might be dragons.</body></html>');
    });

    it('renders 404.html if content not found for .plain.html', async () => {
      loader
        .rewrite('super-test/404.html', 'super-test/404-test.html')
        .headers('super-test/404-test.html', 'x-amz-meta-x-source-last-modified', 'Mon, 12 Oct 2009 17:50:00 GMT');
      const { body, headers } = await testRender('not-found-with-handler.plain.html', 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
        'x-surrogate-key': 'OYsA_wfqip5EuBu6 foo-id fpt80Bs0_DS5RDD4 super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
        'x-error': 'failed to load /not-found-with-handler.md from content-bus: 404',
        'access-control-allow-origin': '*',
      });
      assert.strictEqual(body.trim(), '<html><body>There might be dragons.</body></html>');
    });

    it('renders 404.html if content not found for static html', async () => {
      loader
        .rewrite('super-test/404.html', 'super-test/404-test.html')
        .headers('super-test/404-test.html', 'x-amz-meta-x-source-last-modified', 'Mon, 12 Oct 2009 17:50:00 GMT');
      const { body, headers } = await testRender('not-found-with-handler.html', 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
        'x-error': 'failed to load /not-found-with-handler.html from code-bus: 404',
        'x-surrogate-key': 'ta3V7wR3zlRh1b0E foo-id 9q9qs7DEYGc4lYTJ super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
        'access-control-allow-origin': '*',
      });
      assert.strictEqual(body.trim(), '<html><body>There might be dragons.</body></html>');
    });

    it('renders 404 for /index', async () => {
      loader.rewrite('index.md', 'simple.md');
      const { headers, body } = await testRender('index', 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
        'x-error': 'request to /index.md not allowed (no-index).',
        'x-surrogate-key': 'FzT3jXtDSYMYOTq1 foo-id 03oC8MtxiF9EGbkp super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
      });
      assert.strictEqual(body.trim(), '');
    });

    it('renders 404 for folder mapped not found', async () => {
      const { headers, body } = await testRender(new URL('https://helix-pipeline.com/broken/folder'), 'html', 404);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
        'x-error': 'failed to load /not-a-page.md from content-bus: 404',
        'x-surrogate-key': 'gPHXKWdMY_R8KV2Z foo-id QJqsV4atnOA47sHc nzU8FWOQ2xQBWJo_ super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
      });
      assert.strictEqual(body.trim(), '');
      // preview (code coverage)
      const resp = await testRender(new URL('https://helix-pipeline.com/broken/folder'), 'html', 404, 'preview');
      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
        'x-error': 'failed to load /not-a-page.md from content-bus: 404',
        'x-surrogate-key': 'p_gPHXKWdMY_R8KV2Z p_foo-id p_QJqsV4atnOA47sHc nzU8FWOQ2xQBWJo_ super-test--helix-pages--adobe_404 super-test--helix-pages--adobe_code',
      });
      assert.strictEqual(resp.body.trim(), '');
    });

    it('renders 301 for redirect file', async () => {
      loader.headers('one-section.md', 'x-amz-meta-redirect-location', 'https://www.adobe.com');
      let resp = await render(new URL('https://localhost/one-section'), '', 301);
      assert.strictEqual(resp.headers.get('location'), 'https://www.adobe.com');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), 'oHjg_WDu20CBS4rD foo-id');
      // preview (code coverage)
      resp = await render(new URL('https://localhost/one-section'), '', 301, 'preview');
      assert.strictEqual(resp.headers.get('location'), 'https://www.adobe.com');
      assert.strictEqual(resp.headers.get('x-surrogate-key'), 'p_oHjg_WDu20CBS4rD p_foo-id');
    });

    it('appends .plain.html in redirects', async () => {
      loader.headers('one-section.md', 'x-amz-meta-redirect-location', '/foo');
      const ret = await render(new URL('https://localhost/one-section'), '.plain', 301);
      assert.strictEqual(ret.headers.get('location'), '/foo.plain.html');
    });

    it('returns identical surrogate key for redirected /one-section and /one-section.plain.html', async () => {
      loader.headers('one-section.md', 'x-amz-meta-redirect-location', '/foo');
      let resp = await render(new URL('https://localhost/one-section'), '', 301);
      assert.strictEqual(resp.headers.get('location'), '/foo');
      const key1 = resp.headers.get('x-surrogate-key');

      resp = await render(new URL('https://localhost/one-section'), '.plain', 301);
      assert.strictEqual(resp.headers.get('location'), '/foo.plain.html');
      const key2 = resp.headers.get('x-surrogate-key');
      assert.strictEqual(key1, key2);
    });

    it('renders redirect for static html (content)', async () => {
      loader.headers('static-content.html', 'x-amz-meta-redirect-location', '/foo');
      const ret = await render(new URL('https://localhost/static-content.html'), '', 301);
      assert.strictEqual(ret.headers.get('location'), '/foo');
    });

    it('renders redirect for static html (code)', async () => {
      loader.headers('super-test/static.html', 'x-amz-meta-redirect-location', '/foo');
      const ret = await render(new URL('https://localhost/static.html'), '', 301);
      assert.strictEqual(ret.headers.get('location'), '/foo');
    });

    it('respect folder mapping: skip existing resources', async () => {
      loader.status('products.md', 200);
      let resp = await render(new URL('https://helix-pipeline.com/products'), '', 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products">/);

      loader.status('product1.md', 200);
      resp = await render(new URL('https://helix-pipeline.com/products/product1'), '', 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products\/product1">/);
      // folder mapped metadata is also applied.
      assert.match(resp.body, /<meta name="keywords" content="Exactomento Mapped Folder">/);

      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'AkcHu8fRFT7HarTR foo-id_metadata super-test--helix-pages--adobe_head foo-id AkcHu8fRFT7HarTR_metadata z8NGXvKB0X5Fzcnd',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('renders 404', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      await render(new URL('https://helix-pipeline.com/not_found'), '', 404);
    });

    it('respect folder mapping: self and descendents', async () => {
      loader.status('products.md', 404);
      loader.status('generic-product.md', 200);
      let resp = await render(new URL('https://helix-pipeline.com/products'), '', 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products">/);

      // coverage
      loader.status('products.md', 404);
      loader.status('generic-product.md', 200);
      resp = await render(new URL('https://helix-pipeline.com/products'), '', 200, 'preview');
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products">/);

      loader.status('product1.md', 404);
      loader.rewrite('generic-product/metadata.json', 'metadata-product.json');
      loader.headers('generic-product.md', 'last-modified', 'Sun, 07 Nov 2021 00:00:00 GMT');
      resp = await render(new URL('https://helix-pipeline.com/products/product1'), '', 200);
      assert.match(resp.body, /<meta property="og:url" content="https:\/\/www.adobe.com\/products\/product1">/);
      assert.match(resp.body, /<title>Product<\/title>/);
      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Sun, 07 Nov 2021 00:00:00 GMT',
        'x-surrogate-key': 'AkcHu8fRFT7HarTR foo-id_metadata super-test--helix-pages--adobe_head foo-id AkcHu8fRFT7HarTR_metadata z8NGXvKB0X5Fzcnd',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('respect folder mapping: only descendents', async () => {
      loader.status('articles.md', 404);
      let resp = await render(new URL('https://helix-pipeline.com/articles'), '', 404);
      assert.strictEqual(resp.body, '');

      loader.status('document1.md', 404);
      resp = await render(new URL('https://helix-pipeline.com/articles/document1'), '', 200);
      assert.match(resp.body, /<link rel="canonical" href="https:\/\/www.adobe.com\/articles\/document1">/);
      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'SCKEB3bkK0hFm4aS foo-id_metadata super-test--helix-pages--adobe_head foo-id SCKEB3bkK0hFm4aS_metadata JHEAK7b1XZvfOJpY',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('respect folder mapping: render 404 if mapped missing', async () => {
      loader.status('document1.md', 404);
      loader.status('articles/document1.md', 404);
      loader.status('special/default-article.md', 404);
      loader.rewrite('super-test/404.html', 'super-test/404-test.html');

      const resp = await render(new URL('https://helix-pipeline.com/articles/document1'), '', 404);
      assert.strictEqual(resp.body, '<html><body>There might be dragons.</body></html>\n');
    });

    it('respect folder mapping: load from code-bus', async () => {
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/app/todos/1'));
      assert.strictEqual(status, 200);
      assert.strictEqual(body.trim(), '<script>alert("hello, world");</script>');
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'OjUJ-F2DzRC3rMht super-test--helix-pages--adobe_code',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('respect metadata with folder mapping: self and descendents', async () => {
      loader
        .headers('generic-product/metadata.json', 'last-modified', 'Thu, 07 Nov 2024 00:00:00 GMT');

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
      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'AkcHu8fRFT7HarTR foo-id_metadata super-test--helix-pages--adobe_head foo-id AkcHu8fRFT7HarTR_metadata z8NGXvKB0X5Fzcnd',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });

      // product2 has a custom last-modified defined in the metadata
      resp = await render(new URL('https://helix-pipeline.com/products/product2'));
      assert.strictEqual(resp.status, 200);
      assert.match(resp.body, /<meta name="short-title" content="E">/);
      assert.match(resp.body, /<meta property="og:publisher" content="Adobe">/);
      assert.match(resp.body, /<meta name="keywords" content="Exactomento Mapped Folder">/);
      assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Wed, 25 Dec 2024 03:33:33 GMT',
        'x-surrogate-key': 'AkcHu8fRFT7HarTR foo-id_metadata super-test--helix-pages--adobe_head foo-id AkcHu8fRFT7HarTR_metadata G03gAJ9i4zOGySKf',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('handles error while loading mapped metadata', async () => {
      loader.status('generic-product/metadata.json', 500);
      await render(new URL('https://helix-pipeline.com/products'), null, 502);
    });

    it('uses last modified from config', async () => {
      config = DEFAULT_CONFIG_EMPTY;
      loader
        .headers('index.md', 'x-amz-meta-x-source-last-modified', 'Wed, 12 Jan 2022 10:50:00 GMT');
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/blog/'));
      assert.strictEqual(status, 200);
      assert.match(body, /<link rel="canonical" href="https:\/\/helix-pipeline\.com\/blog\/">/);
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'content-type': 'text/html; charset=utf-8',
        'x-surrogate-key': 'o_fNQBWBLWTIfYqV foo-id_metadata super-test--helix-pages--adobe_head foo-id',
        'last-modified': 'Wed, 12 Jan 2022 11:33:01 GMT',
      });
    });

    it('renders static html from the codebus and applies headers', async () => {
      const { status, body, headers } = await render(new URL('https://helix-pipeline.com/static.html'));
      assert.strictEqual(status, 200);
      assert.strictEqual(body, '<html>\n<main>Hello, world.</main>\n</html>\n');
      assert.deepStrictEqual(Object.fromEntries(headers.entries()), {
        'access-control-allow-origin': '*',
        'content-type': 'text/html; charset=utf-8',
        'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
        'x-surrogate-key': 'OhRDjcpvIRqjAeih super-test--helix-pages--adobe_code',
        link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
      });
    });

    it('renders static html from the codebus and applies csp from header with nonce', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'content-security-policy',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
      };

      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-header.html'));
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders static html from the codebus and applies csp from header - report-only with nonce', async () => {
      config = {
        ...DEFAULT_CONFIG,
        headers: {
          '/**': [
            {
              key: 'content-security-policy-report-only',
              // eslint-disable-next-line quotes
              value: `script-src 'nonce-aem' 'strict-dynamic'; style-src 'nonce-aem'; base-uri 'self'; object-src 'none';`,
            },
          ],
        },
      };

      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-header.html'));
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy-report-only'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders static html from the codebus and applies csp from meta with nonce', async () => {
      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-meta.html'));
      assert.ok(!headers.get('content-security-policy'));
    });

    it('renders static html from the codebus and applies csp from meta with nonce moved as header', async () => {
      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-meta-move-as-header.html'));
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; style-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t'; base-uri 'self'; object-src 'none';`);
    });

    it('renders static html from the codebus and applies csp with different nonce without altering', async () => {
      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-meta-different.html'));
      assert.ok(!headers.get('content-security-policy'));
    });

    it('renders static html from the codebus and applies csp without altering the HTML structure', async () => {
      const { headers } = await testRenderCode(new URL('https://helix-pages.com/static-nonce-fragment.html'));
      assert.ok(!headers.get('content-security-policy'));
    });

    it('renders 404 html from codebus and applies csp', async () => {
      loader
        .rewrite('404.html', 'super-test/404-csp-nonce.html')
        .headers('super-test/404-test.html', 'x-amz-meta-x-source-last-modified', 'Mon, 12 Oct 2009 17:50:00 GMT');
      const { headers } = await testRenderCode('not-found', 404, '404-csp-nonce', true);
      // eslint-disable-next-line quotes
      assert.strictEqual(headers.get('content-security-policy'), `script-src 'nonce-ckE0bmQwbW1tckE0bmQwbW1t' 'strict-dynamic'; base-uri 'self'; object-src 'none';`);
    });
  });
});
