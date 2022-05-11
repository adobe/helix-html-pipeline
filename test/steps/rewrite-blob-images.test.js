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
/* eslint-env mocha */
import assert from 'assert';
import { readFile } from 'fs/promises';
import path from 'path';
import { toHtml } from 'hast-util-to-html';
import mdast2hast from '../../src/utils/mdast-to-hast.js';
// import rewriteBlobImages from '../../src/steps/rewrite-blob-images.js';

describe.skip('Test Blob Image Rewriting', () => {
  it('Rewrites blob store image URLs', async () => {
    const mdast = JSON.parse(await readFile(path.resolve(__testdir, 'fixtures', 'image-example.json'), 'utf-8'));
    const expected = await readFile(path.resolve(__testdir, 'fixtures', 'image-example.html'), 'utf-8');

    const hast = mdast2hast(mdast);

    // const context = {
    //   content: { hast },
    // };
    // rewriteBlobImages(context);
    assert.strictEqual(toHtml(hast), expected.trim());
  });

  it('Does not throw error if document is missing', () => {
    // rewriteBlobImages({
    //   content: {
    //     html: '<html></html>',
    //   },
    // });
  });
});
