/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { toHtml } from 'hast-util-to-html';
import rewrite from '../../src/steps/rewrite-icons.js';

describe('Rewrite Icons Step', () => {
  it('rewrites the icons correctly', () => {
    /** @type PipelineState */
    const state = {
      log: console,
      content: {
        hast: {
          type: 'element',
          tagName: 'div',
          children: [
            {
              type: 'text',
              value: 'This is a :smile:. and another :funny-123-icon: icon.',
            },
            {
              type: 'text',
              value: 'Hello :#check: mark.',
            },
            {
              type: 'text',
              value: ':red-check-mark-:',
            },
            {
              type: 'text',
              value: 'Team:rocket:blasting off again.',
            },
            {
              type: 'element',
              tagName: 'p',
              children: [
                {
                  type: 'text',
                  value: ':button:',
                },
              ],
            },
          ],
        },
      },
    };
    rewrite(state);
    const html = toHtml(state.content.hast);
    assert.strictEqual(html, '<div>'
      + 'This is a <span class="icon icon-smile"></span>.'
      + ' and another <span class="icon icon-funny-123-icon"></span> icon.'
      + 'Hello <span class="icon icon-check"></span> mark.'
      + '<span class="icon icon-red-check-mark-"></span>'
      + 'Team:rocket:blasting off again.'
      + '<p><span class="icon icon-button"></span></p>'
      + '</div>');
  });

  it('ignores some pattern correctly', () => {
    /** @type PipelineState */
    const state = {
      log: console,
      content: {
        hast: {
          type: 'element',
          tagName: 'div',
          children: [
            {
              type: 'element',
              tagName: 'code',
              children: [
                {
                  type: 'text',
                  value: 'code is not icons :smile:',
                },
              ],
            },
            {
              type: 'text',
              value: 'This url: https://example.test/:urn: is no an icon.',
            },
            {
              type: 'text',
              value: 'neither is this: urn:aaid:sc:VA6C2:ac6066f3-fd1d-4e00-bed3-fa3aa6d981d8 an icon.',
            },
            {
              type: 'text',
              value: 'Also not this:  hh:mm:ss',
            },
          ],
        },
      },
    };
    rewrite(state);
    const html = toHtml(state.content.hast);
    assert.strictEqual(html, '<div>'
      + '<code>code is not icons :smile:</code>'
      + 'This url: https://example.test/:urn: is no an icon.'
      + 'neither is this: urn:aaid:sc:VA6C2:ac6066f3-fd1d-4e00-bed3-fa3aa6d981d8 an icon.'
      + 'Also not this:  hh:mm:ss'
      + '</div>');
  });
});
