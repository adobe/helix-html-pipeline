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

function createState(hast, config = { features: { rendering: { version: 2 } } }) {
  return { content: { hast }, config };
}

describe('Extract Section Metadata', () => {
  it('does nothing if no section-metadata block', () => {
    const hast = h('div', [
      h('div', [h('p', 'hello')]),
    ]);
    const state = createState(hast);
    extractSectionMetadata(state);
    assert.strictEqual(hast.children.length, 1);
  });

  it('adds style as class names to section', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'highlight')]),
        ]),
      ]),
    ]);
    const state = createState(hast);
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['highlight']);
  });

  it('adds non-style keys as data attributes', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Background'), h('div', 'blue')]),
        ]),
      ]),
    ]);
    const state = createState(hast);
    extractSectionMetadata(state);
    assert.strictEqual(hast.children[0].properties['data-background'], 'blue');
  });

  it('removes section-metadata block after processing', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'dark')]),
        ]),
      ]),
    ]);
    const state = createState(hast);
    extractSectionMetadata(state);
    const sectionChildren = hast.children[0].children;
    assert.ok(!sectionChildren.some((c) => c.properties?.className?.includes('section-metadata')));
  });

  it('skips rows without value column', () => {
    const hast = h('div', [
      h('div', [
        h('div.section-metadata', [
          h('div', [h('div', 'Style')]),
        ]),
      ]),
    ]);
    const state = createState(hast);
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
    const state = createState(hast);
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties, {});
  });

  it('does nothing when feature flag is not set', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'highlight')]),
        ]),
      ]),
    ]);
    const state = createState(hast, {});
    extractSectionMetadata(state);
    // section-metadata block should still be present
    const sectionChildren = hast.children[0].children;
    assert.ok(sectionChildren.some((c) => c.properties?.className?.includes('section-metadata')));
  });

  it('does nothing when config is undefined', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Background'), h('div', 'red')]),
        ]),
      ]),
    ]);
    const state = { content: { hast } };
    extractSectionMetadata(state);
    assert.strictEqual(hast.children[0].properties['data-background'], undefined);
  });

  it('processes section metadata when site was created after May 1 2026', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'dark')]),
        ]),
      ]),
    ]);
    const state = createState(hast, { createdAt: '2026-05-02T00:00:00Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['dark']);
  });

  it('processes section metadata when site was created on May 1 2026', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'dark')]),
        ]),
      ]),
    ]);
    const state = createState(hast, { createdAt: '2026-05-01T00:00:00Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, ['dark']);
  });

  it('does not process section metadata when site was created before May 1 2026', () => {
    const hast = h('div', [
      h('div', [
        h('p', 'content'),
        h('div.section-metadata', [
          h('div', [h('div', 'Style'), h('div', 'dark')]),
        ]),
      ]),
    ]);
    const state = createState(hast, { createdAt: '2026-04-30T23:59:59Z' });
    extractSectionMetadata(state);
    assert.deepStrictEqual(hast.children[0].properties.className, undefined);
  });
});
