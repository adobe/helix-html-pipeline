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
import { JSDOM } from 'jsdom';

import {
  getAbsoluteUrl,
  getOriginalHost, makeCanonicalHtmlUrl,
  optimizeImageURL,
  wrapContent,
} from '../../src/steps/utils.js';

describe('Testing wrapNodes', () => {
  it('Wraps one element in one div', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body><h1>Title</h1></body></html>');
    const { document } = dom.window;

    const div = document.createElement('div');
    wrapContent(div, document.body);

    assert.equal(document.body.innerHTML, '<div><h1>Title</h1></div>');
  });

  it('Wraps multiple elements in one div', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body><h1>T1</h1><h1>T2</h1><h1>T3</h1></body></html>');
    const { document } = dom.window;

    const div = document.createElement('div');
    wrapContent(div, document.body);

    assert.equal(document.body.innerHTML, '<div><h1>T1</h1><h1>T2</h1><h1>T3</h1></div>');
  });

  it('Wraps elements including line breaks in one div', () => {
    const dom = new JSDOM(`<html><head><title>Foo</title></head><body>
      <h1>T1</h1>
      Some text
      <h1>T2</h1>
      Some more text
      <h1>T3</h1>
      Final text
      <div>A div</div>
    </body></html>`);
    const { document } = dom.window;

    const div = document.createElement('div');
    wrapContent(div, document.body);

    assert.equal(document.body.innerHTML, `<div>
      <h1>T1</h1>
      Some text
      <h1>T2</h1>
      Some more text
      <h1>T3</h1>
      Final text
      <div>A div</div>
    </div>`);
  });
});

describe('Optimize Image URLs', () => {
  it('creates correct image optimize urls', () => {
    assert.throws(() => optimizeImageURL(313), {
      name: 'TypeError',
      message: /^Parameter 'url' must be a string/,
    });

    assert.equal(optimizeImageURL('/foo.png'), '/foo.png?format=webply&optimize=medium');
    assert.equal(optimizeImageURL('/foo'), '/foo?format=webply&optimize=medium');
    assert.equal(optimizeImageURL('/foo#image.png'), '/foo?format=webply&optimize=medium#image.png');
    assert.equal(optimizeImageURL('/foo?a=42#image.png'), '/foo?a=42&format=webply&optimize=medium#image.png');
    assert.equal(optimizeImageURL('/foo?width=450'), '/foo?width=450&format=webply&optimize=medium');
    assert.equal(optimizeImageURL('/foo?format=bogus'), '/foo?format=webply&optimize=medium');

    assert.equal(optimizeImageURL('/foo.png', 2000), '/foo.png?width=2000&format=webply&optimize=medium');
    assert.equal(optimizeImageURL('/foo.png', 2000, 'pjpg'), '/foo.png?width=2000&format=pjpg&optimize=medium');
    assert.equal(optimizeImageURL('/foo.png', 2000, 'pjpg', 'low'), '/foo.png?width=2000&format=pjpg&optimize=low');
    assert.equal(optimizeImageURL('https://blog.adobe.com/foo.png'), 'https://blog.adobe.com/foo.png?format=webply&optimize=medium');
    assert.equal(optimizeImageURL('./foo.png'), './foo.png?format=webply&optimize=medium');
  });
});

describe('Get Absolute URL', () => {
  it('get correct absolute url', () => {
    const headers = new Map([['host', 'blog.adobe.com']]);
    assert.equal(getAbsoluteUrl(headers, {}), null);
    assert.equal(getAbsoluteUrl(headers, '/'), 'https://blog.adobe.com/');
    assert.equal(getAbsoluteUrl(headers, '/foo.png'), 'https://blog.adobe.com/foo.png');
    assert.equal(getAbsoluteUrl(headers, './foo.png'), 'https://blog.adobe.com/foo.png');
    assert.equal(getAbsoluteUrl(headers, 'https://spark.adobe.com/foo.png'), 'https://spark.adobe.com/foo.png');
  });
});

describe('Make canonical URL', () => {
  it('get correct canonical url', () => {
    assert.equal(makeCanonicalHtmlUrl(null), null);
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/'), 'https://spark.adobe.com/');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo'), 'https://spark.adobe.com/foo');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo.html'), 'https://spark.adobe.com/foo');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index.html'), 'https://spark.adobe.com/foo/');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index'), 'https://spark.adobe.com/foo/');
  });

  it('get correct canonical url with query', () => {
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/?a=1'), 'https://spark.adobe.com/?a=1');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo?a=1'), 'https://spark.adobe.com/foo?a=1');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo.html?a=1'), 'https://spark.adobe.com/foo?a=1');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index.html?a=1'), 'https://spark.adobe.com/foo/?a=1');
    assert.equal(makeCanonicalHtmlUrl('https://spark.adobe.com/foo/index?a=1'), 'https://spark.adobe.com/foo/?a=1');
  });
});

describe('Get Original Host', () => {
  it('get correct host for plain host header', () => {
    const headers = new Map([['host', 'blog.adobe.com']]);
    assert.equal(getOriginalHost(headers), 'blog.adobe.com');
  });

  it('get correct host for plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com'],
    ]);
    assert.equal(getOriginalHost(headers), 'spark.adobe.com');
  });

  it('get correct host for multiple plain xfwd header', () => {
    const headers = new Map([
      ['host', 'blog.adobe.com'],
      ['x-forwarded-host', 'spark.adobe.com, cdn1.hlx.page'],
    ]);
    assert.equal(getOriginalHost(headers), 'spark.adobe.com');
  });
});
