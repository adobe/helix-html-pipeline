/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* global describe, it */
import assert from 'assert';

import {
  getAbsoluteUrl,
  getOriginalHost, makeCanonicalHtmlUrl,
  optimizeImageURL,
  rewriteUrl,
  toBlockCSSClassNames,
} from '../../src/steps/utils.js';

describe('Optimize Image URLs', () => {
  it('creates correct image optimize urls', () => {
    assert.throws(() => optimizeImageURL(313), new TypeError('Parameter \'url\' must be a string, not number'));

    assert.strictEqual(optimizeImageURL('/foo.png'), '/foo.png?format=webply&optimize=medium');
    assert.strictEqual(optimizeImageURL('/foo'), '/foo?format=webply&optimize=medium');
    assert.strictEqual(optimizeImageURL('/foo#image.png'), '/foo?format=webply&optimize=medium#image.png');
    assert.strictEqual(optimizeImageURL('/foo?a=42#image.png'), '/foo?a=42&format=webply&optimize=medium#image.png');
    assert.strictEqual(optimizeImageURL('/foo?width=450'), '/foo?width=450&format=webply&optimize=medium');
    assert.strictEqual(optimizeImageURL('/foo?format=bogus'), '/foo?format=webply&optimize=medium');

    assert.strictEqual(optimizeImageURL('/foo.png', 2000), '/foo.png?width=2000&format=webply&optimize=medium');
    assert.strictEqual(optimizeImageURL('/foo.png', 2000, 'pjpg'), '/foo.png?width=2000&format=pjpg&optimize=medium');
    assert.strictEqual(optimizeImageURL('/foo.png', 2000, 'pjpg', 'low'), '/foo.png?width=2000&format=pjpg&optimize=low');
    assert.strictEqual(optimizeImageURL('https://blog.adobe.com/foo.png'), 'https://blog.adobe.com/foo.png?format=webply&optimize=medium');
    assert.strictEqual(optimizeImageURL('./foo.png'), './foo.png?format=webply&optimize=medium');
  });
});

describe('Get Absolute URL', () => {
  it('get correct absolute url', () => {
    const state = {
      config: {
        host: 'blog.adobe.com',
      },
    };
    assert.strictEqual(getAbsoluteUrl(state, {}), null);
    assert.strictEqual(getAbsoluteUrl(state, '/'), 'https://blog.adobe.com/');
    assert.strictEqual(getAbsoluteUrl(state, '/foo.png'), 'https://blog.adobe.com/foo.png');
    assert.strictEqual(getAbsoluteUrl(state, './foo.png'), 'https://blog.adobe.com/foo.png');
    assert.strictEqual(getAbsoluteUrl(state, 'https://spark.adobe.com/foo.png'), 'https://spark.adobe.com/foo.png');
  });
});

describe('Make canonical URL', () => {
  it('get correct canonical url', () => {
    assert.strictEqual(makeCanonicalHtmlUrl(null), null);
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/'), 'https://spark.adobe.com/');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo'), 'https://spark.adobe.com/foo');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo.html'), 'https://spark.adobe.com/foo');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index.html'), 'https://spark.adobe.com/foo/');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index'), 'https://spark.adobe.com/foo/');
  });

  it('get correct canonical url with query', () => {
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/?a=1'), 'https://spark.adobe.com/?a=1');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo?a=1'), 'https://spark.adobe.com/foo?a=1');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo.html?a=1'), 'https://spark.adobe.com/foo?a=1');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index.html?a=1'), 'https://spark.adobe.com/foo/?a=1');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index?a=1'), 'https://spark.adobe.com/foo/?a=1');
  });
});

describe('Get Original Host', () => {
  it('get correct host for plain host header', () => {
    const headers = new Map([['host', 'blog.adobe.com']]);
    assert.strictEqual(getOriginalHost(headers), 'blog.adobe.com');
  });

  it('get correct host for plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com, cdn1.hlx.page'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });
});

describe('Rewrite URLs test', () => {
  it('returns input for falsy', () => {
    assert.strictEqual(rewriteUrl({}, null), null);
    assert.strictEqual(rewriteUrl({}, ''), '');
    assert.strictEqual(rewriteUrl({}, undefined), undefined);
  });

  it('replaces an azure media url', () => {
    assert.strictEqual(rewriteUrl({}, 'https://hlx.blob.core.windows.net/external/1234#image.gif?w=10&h=10'), './media_1234.gif#w=10&h=10');
    assert.strictEqual(rewriteUrl({}, 'https://hlx.blob.core.windows.net/external/1234#image.gif'), './media_1234.gif');
    assert.strictEqual(rewriteUrl({}, 'https://hlx.blob.core.windows.net/external/1234'), './media_1234.jpg');
  });

  it('replaces an helix media url', () => {
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/media_1234.png#width=800&height=600'), './media_1234.png#width=800&height=600');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/media_1234.png'), './media_1234.png');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page/media_1234.png'), './media_1234.png');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/media_1234.png'), './media_1234.png');
  });

  it('replaces an helix url', () => {
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article?a=42'), '/blog/article?a=42');
  });

  it('replaces an helix url with fragments', () => {
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article?a=42#heading'), '/blog/article?a=42#heading');
  });

  it('replaces an helix url with fragments on same site', () => {
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/article' },
    }, 'https://main--pages--adobe.hlx.page/blog/article#heading'), '#heading');
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/article' },
    }, 'https://main--pages--adobe.hlx.live/blog/article#heading'), '#heading');
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/article' },
    }, 'https://main--pages--adobe.hlx3.page/blog/article#heading'), '#heading');
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/article' },
    }, 'https://main--pages--adobe.hlx3.page/blog/article?a=42#heading'), '#heading');
  });

  it('replaces prod url', () => {
    const state = {
      config: {
        host: 'www.adobe.com',
      },
      info: { path: '/blog/article', search: '' },
    };
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog#home'), '/blog#home');
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog?a=42#home'), '/blog?a=42#home');
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog/article#heading'), '#heading');
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog/article?a=42#heading'), '#heading');
  });

  it('replaces prod url and respects routes', () => {
    const state = {
      config: {
        host: 'www.adobe.com',
        routes: [
          /.*\/express\/.*/,
        ],
      },
      info: { path: '/blog/article', search: '' },
    };
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog/article'), 'https://www.adobe.com/blog/article');
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/express/blog'), '/express/blog');
  });
});

describe('Block CSS Class Name Generation', () => {
  it('creates the correct css names', () => {
    assert.deepStrictEqual(toBlockCSSClassNames(''), []);
    assert.deepStrictEqual(toBlockCSSClassNames('foo'), ['foo']);
    assert.deepStrictEqual(toBlockCSSClassNames('foo bar'), ['foo-bar']);
    assert.deepStrictEqual(toBlockCSSClassNames('!Joe\'s Pizza!'), ['joe-s-pizza']);
    assert.deepStrictEqual(toBlockCSSClassNames('!Joe\'s Pizza! (small)'), ['joe-s-pizza', 'small']);
    assert.deepStrictEqual(toBlockCSSClassNames('Sparkling! (5dl glass)'), ['sparkling', '5dl-glass']);
    assert.deepStrictEqual(toBlockCSSClassNames('Country Fries (small, sweat&sour )'), ['country-fries', 'small', 'sweat-sour']);
  });
});
