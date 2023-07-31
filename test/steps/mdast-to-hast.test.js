/*
 * Copyright 2018 Adobe. All rights reserved.
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
import { readFile } from 'fs/promises';
import path from 'path';
import { toHtml as hast2html } from 'hast-util-to-html';
import { unified } from 'unified';
import parser from 'remark-parse';
import GithubSlugger from 'github-slugger';
import { assertHTMLEquals } from '../utils.js';
import mdast2hast from '../../src/utils/mdast-to-hast.js';

function toHTML(mdast) {
  return hast2html(mdast2hast(mdast, new GithubSlugger()));
}

describe('Test VDOMTransformer#getHast', () => {
  it('empty node', async () => {
    const html = toHTML({ type: 'root' });
    assert.strictEqual(html, '');
  });

  it('paragraph node', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          value: 'This is only a paragraph.',
        }],
      }],
    });
    assert.strictEqual(html, '<p>This is only a paragraph.</p>');
  });

  it('image node', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'image',
        url: 'url.html',
      }],
    });
    assert.strictEqual(html, '<img src="url.html">');
  });

  it('complex node', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'heading',
        depth: 1,
        children: [{
          type: 'text',
          value: 'The title content',
        }],
      }, {
        type: 'paragraph',
        children: [{
          type: 'text',
          value: 'This is a paragraph.',
        }],
      }, {
        type: 'image',
        url: 'url.html',
      }],
    });
    assert.strictEqual(html, '<h1 id="the-title-content">The title content</h1>\n<p>This is a paragraph.</p>\n<img src="url.html">');
  });

  it('sanitize creates proper closing tag', () => {
    const customMdast = {
      type: 'root',
      children: [{
        type: 'html',
        value: '<p>The Cloud-native Helix Services process',
      }],
    };
    const html = toHTML(customMdast);
    assert.strictEqual(html, '<p>The Cloud-native Helix Services process</p>');
  });

  it('sanitize ignores leading closing tag', () => {
    const customMdast = {
      type: 'root',
      children: [{
        type: 'html',
        value: 'The Cloud-native</i> Helix Services process',
      }],
    };
    const html = toHTML(customMdast);
    assert.strictEqual(html, 'The Cloud-native Helix Services process');
  });

  it('parses long list correctly', async () => {
    const markdown = await readFile(path.resolve(__testdir, 'fixtures', 'mdasts', 'tags.md'), 'utf-8');
    const mdast = unified().use(parser).parse(markdown);
    const actual = toHTML(mdast);
    const expected = await readFile(path.resolve(__testdir, 'fixtures', 'mdasts', 'tags.html'), 'utf-8');
    await assertHTMLEquals(actual, expected);
  });

  it('Headings MDAST Conversion', async () => {
    const mdast = JSON.parse(await readFile(path.resolve(__testdir, 'fixtures', 'mdasts', 'heading-ids.json'), 'utf-8'));
    const actual = toHTML(mdast);
    await assertHTMLEquals(actual, `
      <h1 id="foo">Foo</h1>
      <h2 id="bar">Bar</h2>
      <h3 id="baz">Baz</h3>
      <h2 id="qux">Qux</h2>
      <h3 id="bar-1">Bar</h3>
      <h4 id="bar-1-1">Bar-1</h4>
      <h1 id="foo-bar-baz"><strong>Foo</strong> <em>Bar</em> <code>Baz</code></h1>
    `);
  });

  it('Sections MDAST Conversion', async () => {
    const mdast = JSON.parse(await readFile(path.resolve(__testdir, 'fixtures', 'mdasts', 'headings.json'), 'utf-8'));
    const actual = toHTML(mdast);
    await assertHTMLEquals(actual, `
      <h1 id="heading-1-double-underline">Heading 1 (double-underline)</h1>
      <h2 id="heading-2-single-underline">Heading 2 (single-underline)</h2>
      <h1 id="heading-1">Heading 1</h1>
      <h2 id="heading-2">Heading 2</h2>
      <h3 id="heading-3">Heading 3</h3>
      <h4 id="heading-4">Heading 4</h4>
      <h5 id="heading-5">Heading 5</h5>
      <h6 id="heading-6">Heading 6</h6>
    `);
  });
});
