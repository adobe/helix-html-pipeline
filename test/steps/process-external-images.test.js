/*
 * Copyright 2021 Adobe. All rights reserved.
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
import { createExternalPicture } from '../../src/steps/process-external-images.js';

const BASE = 'https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets'
  + '/urn:aaid:aem:11112222-1111-2222-1111-222211112222/as/test.avif';

// hastscript stores the last child (fallback <img>) of the returned <picture>
function imgNode(picture) {
  return picture.children[picture.children.length - 1];
}

describe('createExternalPicture', () => {
  it('returns null for an invalid URL', () => {
    assert.strictEqual(createExternalPicture('not-a-url'), null);
  });

  it('builds a picture with four variants', () => {
    const pic = createExternalPicture(`${BASE}?assetname=test.jpg`);
    assert.strictEqual(pic.tagName, 'picture');
    assert.strictEqual(pic.children.length, 4);
    assert.strictEqual(pic.children[0].tagName, 'source');
    assert.strictEqual(imgNode(pic).tagName, 'img');
  });

  it('sets width and height from originalImageWidth/Height params', () => {
    const src = `${BASE}?assetname=test.jpg&originalImageWidth=800&originalImageHeight=600`;
    const img = imgNode(createExternalPicture(src));
    // hastscript coerces width/height to numbers via property-information
    assert.strictEqual(img.properties.width, 800);
    assert.strictEqual(img.properties.height, 600);
  });

  it('strips originalImageWidth/Height from all srcset and src URLs', () => {
    const src = `${BASE}?assetname=test.jpg&originalImageWidth=800&originalImageHeight=600`;
    const pic = createExternalPicture(src);
    for (const child of pic.children) {
      // HAST uses srcSet (camelCase) for <source> and src for <img>
      const url = child.properties.srcSet ?? child.properties.src;
      assert.ok(!url.includes('originalImageWidth'), `unexpected originalImageWidth in: ${url}`);
      assert.ok(!url.includes('originalImageHeight'), `unexpected originalImageHeight in: ${url}`);
    }
  });

  it('falls back to existingWidth/Height when no originalImage params', () => {
    const img = imgNode(
      createExternalPicture(`${BASE}?assetname=test.jpg`, '', undefined, '1200', '800'),
    );
    assert.strictEqual(img.properties.width, 1200);
    assert.strictEqual(img.properties.height, 800);
  });

  it('prefers originalImageWidth/Height over existingWidth/Height', () => {
    const src = `${BASE}?assetname=test.jpg&originalImageWidth=800&originalImageHeight=600`;
    const img = imgNode(createExternalPicture(src, '', undefined, '999', '777'));
    assert.strictEqual(img.properties.width, 800);
    assert.strictEqual(img.properties.height, 600);
  });

  it('sets no width/height when neither source provides dims', () => {
    const img = imgNode(createExternalPicture(`${BASE}?assetname=test.jpg`));
    assert.strictEqual(img.properties.width, undefined);
    assert.strictEqual(img.properties.height, undefined);
  });

  it('strips delivery-size width/height params from all srcset and src URLs', () => {
    const src = `${BASE}?assetname=test.jpg&width=1200&height=800&quality=80`;
    const pic = createExternalPicture(src);
    const img = imgNode(pic);
    assert.strictEqual(img.properties.width, undefined);
    for (const child of pic.children) {
      const url = child.properties.srcSet ?? child.properties.src;
      assert.ok(!url.includes('height=800'), `original height should be stripped: ${url}`);
    }
  });

  it('sets data-title (dataTitle in HAST) when title differs from alt', () => {
    const img = imgNode(createExternalPicture(`${BASE}?assetname=test.jpg`, 'Alt', 'Title'));
    // HAST stores data-title as dataTitle (camelCase via property-information)
    assert.strictEqual(img.properties.dataTitle, 'Title');
  });

  it('omits data-title when title equals alt', () => {
    const img = imgNode(createExternalPicture(`${BASE}?assetname=test.jpg`, 'Same', 'Same'));
    assert.strictEqual(img.properties.dataTitle, undefined);
  });
});
