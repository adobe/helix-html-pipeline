/*
 * Copyright 2026 Adobe. All rights reserved.
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
import { h } from 'hastscript';
import extractSectionMetadata from '../../src/steps/extract-section-metadata.js';

function createHast() {
  return h('div', [
    h('div', [
      h('p', 'content'),
      h('div.section-metadata', [
        h('div', [h('div', 'Style'), h('div', 'highlight')]),
      ]),
    ]),
  ]);
}

function createState(config) {
  return { content: { hast: createHast() }, config };
}

describe('Extract Section Metadata', () => {
  it('processes when rendering version is 2', () => {
    const state = createState({ features: { rendering: { version: 2 } } });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, ['highlight']);
  });

  it('processes when rendering version is 3', () => {
    const state = createState({ features: { rendering: { version: 3 } } });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, ['highlight']);
  });

  it('does not process when rendering version is 1', () => {
    const state = createState({ features: { rendering: { version: 1 } } });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, undefined);
  });

  it('does not process when rendering version is 1 even if site is new', () => {
    const state = createState({
      features: { rendering: { version: 1 } },
      created: '2026-06-01T00:00:00Z',
    });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, undefined);
  });

  it('does not process when no features and site created before May 1 2026', () => {
    const state = createState({ created: '2026-04-30T23:59:59Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, undefined);
  });

  it('processes when no features and site created on May 1 2026', () => {
    const state = createState({ created: '2026-05-01T00:00:00Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, ['highlight']);
  });

  it('processes when no features and site created after May 1 2026', () => {
    const state = createState({ created: '2026-05-02T00:00:00Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, ['highlight']);
  });

  it('does not process when no features and no created date', () => {
    const state = createState({});
    extractSectionMetadata(state);
    assert.deepStrictEqual(state.content.hast.children[0].properties.className, undefined);
  });

  it('handles section-metadata with no children', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata'),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties, {});
  });

  it('skips rows without value column', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style')]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, undefined);
  });

  it('skips rows with empty key', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', ''), h('div', 'value')]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties, {});
  });

  it('absolutifies img src relative to page path', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Background'), h('div', [h('img', { src: './media_abc123.jpg' })])]),
        ]),
      ]),
    ]);
    const state = {
      content: { hast },
      config: { features: { rendering: { version: 2 } } },
      prodHost: 'www.example.com',
      info: { path: '/en/products/features' },
    };
    extractSectionMetadata(state);
    assert.strictEqual(
      hast.children[0].properties['data-background'],
      'https://www.example.com/en/products/media_abc123.jpg',
    );
  });

  it('absolutifies img src relative to root page path', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Background'), h('div', [h('img', { src: './media_abc123.jpg' })])]),
        ]),
      ]),
    ]);
    const state = {
      content: { hast },
      config: { features: { rendering: { version: 2 } } },
      prodHost: 'www.example.com',
      info: { path: '/my-page' },
    };
    extractSectionMetadata(state);
    assert.strictEqual(
      hast.children[0].properties['data-background'],
      'https://www.example.com/media_abc123.jpg',
    );
  });

  it('preserves already absolute img src', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Background'), h('div', [h('img', { src: 'https://cdn.example.com/hero.jpg' })])]),
        ]),
      ]),
    ]);
    const state = {
      content: { hast },
      config: { features: { rendering: { version: 2 } } },
      prodHost: 'www.example.com',
      info: { path: '/en/products/features' },
    };
    extractSectionMetadata(state);
    assert.strictEqual(
      hast.children[0].properties['data-background'],
      'https://cdn.example.com/hero.jpg',
    );
  });

  it('absolutifies a href relative to page path and preserves already absolute URLs', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Link'), h('div', [h('a', { href: './sub/path' }, 'local')])]),
          h('div', [h('div', 'External'), h('div', [h('a', { href: 'https://example.com' }, 'ext')])]),
        ]),
      ]),
    ]);
    const state = {
      content: { hast },
      config: { features: { rendering: { version: 2 } } },
      prodHost: 'www.example.com',
      info: { path: '/en/products/features' },
    };
    extractSectionMetadata(state);
    assert.strictEqual(
      hast.children[0].properties['data-link'],
      'https://www.example.com/en/products/sub/path',
    );
    assert.strictEqual(
      hast.children[0].properties['data-external'],
      'https://example.com',
    );
  });

  it('style with space-separated value produces single hyphenated class', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'wide dark')]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['wide-dark']);
  });

  it('style with comma-separated value produces separate classes', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'centered, dark')]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['centered', 'dark']);
  });

  it('style with mixed commas and spaces produces correct classes', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'columns wide, dark fancy')]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['columns-wide', 'dark-fancy']);
  });

  it('style treats hard break (separate paragraphs) as separator', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', [
            h('p', 'two columns'),
            h('p', 'centered, dark'),
          ])]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['two-columns', 'centered', 'dark']);
  });

  it('style treats soft break (br) as separator', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', [
            h('p', [
              { type: 'text', value: 'two columns' },
              h('br'),
              { type: 'text', value: 'centered, dark' },
            ]),
          ])]),
        ]),
      ]),
    ]);
    const state = { content: { hast }, config: { features: { rendering: { version: 2 } } } };
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['two-columns', 'centered', 'dark']);
  });
});
