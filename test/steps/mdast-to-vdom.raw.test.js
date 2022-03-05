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
import sinon from 'sinon';
import { u as builder } from 'unist-builder';
import { all, defaultHandlers } from 'mdast-util-to-hast';
import { wrap } from 'mdast-util-to-hast/lib/wrap.js';
import GithubSlugger from 'github-slugger';
import VDOMTransformer from '../../src/utils/mdast-to-vdom.js';

function toHTML(mdast, handlers = {}) {
  const transformer = new VDOMTransformer(mdast)
    .withOptions({
      slugger: new GithubSlugger(),
    });
  Object.keys(handlers).forEach((key) => {
    // eslint-disable-next-line no-underscore-dangle
    transformer._handlers[key] = handlers[key];
  });
  return transformer.getDocument().body.innerHTML;
}

describe('Test VDOMTransformer#getDocument', () => {
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

  it('h1 node', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'heading',
        depth: 1,
        children: [{
          type: 'text',
          value: 'The title content',
        }],
      }],
    });
    assert.strictEqual(html, '<h1 id="the-title-content">The title content</h1>');
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

  it('custom handler', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          value: 'This is only a paragraph.',
        }],
      }],
    }, {
      text: function text(h, node) {
        return h.augment(node, builder(node.type, node.value.toUpperCase()));
      },
    });
    assert.strictEqual(html, '<p>THIS IS ONLY A PARAGRAPH.</p>');
  });

  it('multiple custom handlers', async () => {
    const html = toHTML({
      type: 'root',
      children: [{
        type: 'list',
        ordered: true,
        children: [{
          type: 'listItem',
          children: [{
            type: 'text',
            value: 'Item 1',
          }],
        }, {
          type: 'listItem',
          children: [{
            type: 'text',
            value: 'Item 2',
          }],
        }],
      }],
    }, {
      list: function list(h, node) {
        const props = {};
        // just for the test, force ordering
        const name = 'ol';

        return h(node, name, props, wrap(all(h, node), true));
      },
      text: function text(h, node) {
        return h.augment(node, builder(node.type, node.value.toUpperCase()));
      },
    });
    assert.strictEqual(html, '<ol>\n<li>\nITEM 1\n</li>\n<li>\nITEM 2\n</li>\n</ol>');
  });
});

describe('Test VDomTransformer static methods', () => {
  const mdast = {
    type: 'root',
    children: [{
      type: 'heading',
      depth: 1,
      children: [{
        type: 'text',
        value: 'The title content',
      }, {
        type: 'html',
        value: '<p>The Cloud-native Helix Services process',
      },
      ],
    }],
  };

  const correctHandler = defaultHandlers[mdast.type];
  let mockVT;

  beforeEach(() => {
    mockVT = sinon.createStubInstance(VDOMTransformer);
  });

  it('static handle function returns result', () => {
    mockVT.matches.returns(() => true);
    const res = VDOMTransformer.handle('a', 'b', 'c', mockVT);
    assert.strictEqual(res, true);
  });

  it('static handle function throws when result is string', () => {
    mockVT.matches.returns(() => 'Helix');
    const handle = VDOMTransformer.handle.bind('a', 'b', 'c', mockVT);
    assert.throws(handle, 'returning string from a handler is not supported yet.');
  });

  it('static handle throws when result is dom object', () => {
    const result = { outerHTML: 'Helix' };
    mockVT.matches.returns(() => result);
    const handle = VDOMTransformer.handle.bind('a', 'b', 'c', mockVT);
    assert.throws(handle, 'returning a DOM element from a handler is not supported yet.');
  });

  it('static default returns correct default handler', async () => {
    const handler = VDOMTransformer.default(mdast);
    assert.strictEqual(handler, correctHandler);
  });

  it('matchfn returns correct matches', async () => {
    const rootMatch = VDOMTransformer.matchfn(mdast, 'root');
    const headingMatch = VDOMTransformer.matchfn(mdast, 'heading');
    const textMatch = VDOMTransformer.matchfn(mdast, 'text');

    assert.strictEqual(rootMatch(mdast), true);
    assert.strictEqual(headingMatch(mdast.children[0]), true);
    assert.strictEqual(textMatch(mdast.children[0].children[0]), true);
  });

  it('sanitize fails when matching inline not found', async () => {
    const html = toHTML.bind(mdast);
    assert.throws(html, 'no matching inline element found for Random Header</h2>');
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
});
