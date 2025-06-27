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
import assert from 'assert';

import {
  getAbsoluteUrl,
  getOriginalHost, makeCanonicalHtmlUrl,
  optimizeImageURL,
  rewriteUrl,
  toBlockCSSClassNames,
  toArray,
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
      prodHost: 'blog.adobe.com',
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
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/index'), 'https://spark.adobe.com/');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo'), 'https://spark.adobe.com/foo');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo.html'), 'https://spark.adobe.com/foo');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index.html'), 'https://spark.adobe.com/foo/');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index'), 'https://spark.adobe.com/foo/');
    assert.strictEqual(makeCanonicalHtmlUrl('https://spark.adobe.com/foo-index'), 'https://spark.adobe.com/foo-index');
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

  it('get correct host for multiple plain xfwd header if first segment is empty', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', '  , spark.adobe.com, cdn1.hlx.page'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header if all segments are empty', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', '  ,  ,'],
    ]);
    assert.strictEqual(getOriginalHost(headers), 'blog.adobe.com');
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
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.aem.page/media_1234.png'), './media_1234.png');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.aem.live/media_1234.png'), './media_1234.png');
  });

  it('replaces an helix url', () => {
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article?a=42'), '/blog/article?a=42');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page'), '/');
  });

  it('replaces an custom preview or live host url', () => {
    const state = {
      previewHost: 'main--repo--owner.page.custom',
      liveHost: 'main--repo--owner.live.custom',
    };
    assert.strictEqual(rewriteUrl(state, 'https://main--repo--owner.page.custom/blog/article'), '/blog/article');
    assert.strictEqual(rewriteUrl(state, 'https://main--repo--owner.live.custom/blog/article'), '/blog/article');
  });

  it('replaces an helix url with fragments', () => {
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.aem.page/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.page/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx.live/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.aem.live/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article#heading'), '/blog/article#heading');
    assert.strictEqual(rewriteUrl({}, 'https://main--pages--adobe.hlx3.page/blog/article?a=42#heading'), '/blog/article?a=42#heading');
    assert.strictEqual(rewriteUrl({}, 'https://mwpw-118214--express-website--adobe.hlx.page/express/experiments/ccx0074/test#how-to-make-flyers'), '/express/experiments/ccx0074/test#how-to-make-flyers');
  });

  it('keeps helix urls for www and admin in place', () => {
    assert.strictEqual(rewriteUrl({}, 'https://www.hlx.page/docs'), 'https://www.hlx.page/docs');
    assert.strictEqual(rewriteUrl({}, 'https://www.aem.live/docs'), 'https://www.aem.live/docs');
    assert.strictEqual(rewriteUrl({}, 'https://tools.aem.live/docs'), 'https://tools.aem.live/docs');
    assert.strictEqual(rewriteUrl({}, 'https://admin.hlx.live/api'), 'https://admin.hlx.live/api');
  });

  it('keeps invalid urls', () => {
    assert.strictEqual(rewriteUrl({}, 'https://optout.networkadvertising.org%20'), 'https://optout.networkadvertising.org%20');
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
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/article' },
    }, 'https://main--pages--adobe.hlx3.page/blog/article.plain.html#heading'), '#heading');
    assert.strictEqual(rewriteUrl({
      info: { path: '/blog/' },
    }, 'https://main--pages--adobe.hlx3.page/blog/index.plain.html#heading'), '#heading');
  });

  it('does not replace prod url', () => {
    const state = {
      config: {
        host: 'www.adobe.com',
      },
      info: { path: '/blog/article', search: '' },
    };
    assert.strictEqual(rewriteUrl(state, 'https://www.adobe.com/blog/article'), 'https://www.adobe.com/blog/article');
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

describe('to array test', () => {
  it('converts to array', () => {
    assert.deepStrictEqual(toArray('foo'), ['foo']);
    assert.deepStrictEqual(toArray(['foo']), ['foo']);
    assert.deepStrictEqual(toArray(null), []);
  });
});
