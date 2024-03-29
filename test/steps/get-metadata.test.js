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
import parse from '../../src/steps/parse-markdown.js';
import split from '../../src/steps/split-sections.js';
import { assertMatchDir } from '../markdown-utils.js';

import getmetadata from '../../src/steps/get-metadata.js';

const SECTIONS_BLOCS = [
  'header',
  'paragraph',
  'paragraphwithlink',
  '2images',
  'headerparagraph',
  'headerlist',
  'headerimage',
  'headerparaimage',
  'headerpara2images',
  'complex',
  'herosection',
];

describe('Test getMetadata', () => {
  SECTIONS_BLOCS.forEach((block) => {
    it(`indvidual section block: ${block}`, async () => {
      function callback(data) {
        /** @type PipelineState */
        const state = { log: console, content: { data }, config: { host: 'www.adobe.com' } };
        parse(state);
        split(state);
        getmetadata(state);
        return state.content.mdast;
      }

      await assertMatchDir('sections', block, callback);
    });
  });

  it('getmetadata does not fail with "empty" mdast', () => {
    /** @type PipelineState */
    const state = {
      log: console,
      content: {
        mdast: {},
      },
    };
    getmetadata(state);
    assert.deepEqual(state.content.meta, { types: [] });
  });

  it('getmetadata gets first title and intro', () => {
    /** @type PipelineState */
    const state = {
      log: console,
      content: {
        mdast: {
          type: 'root',
          children: [
            {
              type: 'section',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'image',
                      title: null,
                      url: './helix_logo.png',
                      alt: 'helix-logo',
                    },
                  ],
                  meta: {
                    types: [
                      'has-image',
                    ],
                  },
                },
              ],
              meta: {
                types: [
                  'has-image',
                  'nb-image-1',
                  'has-only-image',
                ],
              },
              title: '',
              intro: '',
              image: './helix_logo.png',
            },
            {
              type: 'section',
              children: [
                {
                  type: 'heading',
                  depth: 1,
                  children: [
                    {
                      type: 'text',
                      value: 'Header and one image',
                    },
                  ],
                  meta: {
                    types: [
                      'is-heading',
                    ],
                  },
                },
              ],
              meta: {
                types: [
                  'has-heading',
                  'nb-heading-1',
                  'has-only-heading',
                ],
              },
              title: 'Header and one image',
              intro: 'Header and one image',
            },
          ],
        },
      },
    };
    getmetadata(state);
    assert.strictEqual(state.content.title, 'Header and one image');
  });

  it('getmetadata does not fail with empty sections', () => {
    /** @type PipelineState */
    const state = {
      log: console,
      content: {
        mdast: {
          children: [],
          position: {},
          type: '',
        },
      },
    };
    getmetadata(state);
    assert.deepEqual(state.content, {
      meta: {
        types: [],
      },
      title: '',
      intro: '',
      image: undefined,
      mdast: {
        children: [],
        position: {},
        meta: {
          types: [],
        },
        type: '',
        title: '',
        intro: '',
      },
    });
  });
});
