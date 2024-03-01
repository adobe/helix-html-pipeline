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
import parse from '../../src/steps/parse-markdown.js';
import { assertMatch } from '../markdown-utils.js';

function callback(data) {
  /** @type PipelineState */
  const state = { log: console, content: { data } };
  parse(state);
  return state.content.mdast;
}

describe('Test Markdown Parsing', () => {
  it('Parses simple markdown', async () => {
    await assertMatch('simple', callback);
  });

  it('Parses example markdown', async () => {
    await assertMatch('example', callback);
  });

  it('Parses headings correctly', async () => {
    await assertMatch('headings', callback);
  });

  it('Parses HTML in Markdown', async () => {
    await assertMatch('forms', callback);
  });

  it('Does not get confused by grayscale', async () => {
    await assertMatch('grayscale', callback);
  });

  it('Does not get confused by escaped links', async () => {
    await assertMatch('simple-links', callback);
  });
});
