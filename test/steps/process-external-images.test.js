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
import { h } from 'hastscript';
import processExternalImages, { createExternalPicture } from '../../src/steps/process-external-images.js';

const BASE = 'https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets'
  + '/urn:aaid:aem:11112222-1111-2222-1111-222211112222/as/test.avif';

// Returns the fallback <img> child of a <picture> node
function imgNode(picture) {
  return picture.children[picture.children.length - 1];
}

// Builds a minimal pipeline content state from a HAST root
function makeState(hast) {
  return { content: { hast } };
}

// ─── createExternalPicture unit tests ────────────────────────────────────────

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

  it('falls back to image/jpeg for unknown file extensions', () => {
    const unknownExt = 'https://delivery-p12345-e67890.adobeaemcloud.com/adobe/assets'
      + '/urn:aaid:aem:11112222-1111-2222-1111-222211112222/as/test.unknownext';
    const pic = createExternalPicture(unknownExt);
    // Last two <source> elements use the native (fallback) type
    assert.strictEqual(pic.children[2].properties.type, 'image/jpeg');
  });
});

// ─── processExternalImages integration tests ─────────────────────────────────

describe('processExternalImages', () => {
  it('replaces an external img with a picture in a plain parent', async () => {
    const img = h('img', { src: `${BASE}?assetname=test.jpg`, alt: 'test' });
    const p = h('p', [img]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    assert.strictEqual(p.children[0].tagName, 'picture');
  });

  it('passes existing width/height from img properties to createExternalPicture', async () => {
    const img = h('img', {
      src: `${BASE}?assetname=test.jpg`, alt: '', width: 800, height: 600,
    });
    const p = h('p', [img]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    const result = imgNode(p.children[0]);
    assert.strictEqual(result.properties.width, 800);
    assert.strictEqual(result.properties.height, 600);
  });

  it('skips an img already inside a picture', async () => {
    const img = h('img', { src: `${BASE}?assetname=test.jpg`, alt: '' });
    const pic = h('picture', [img]);
    const p = h('p', [pic]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    // picture should still have the original img as its only child
    assert.strictEqual(pic.children[0].tagName, 'img');
  });

  it('skips an img with an invalid src URL', async () => {
    const img = h('img', { src: 'not-a-url', alt: '' });
    const p = h('p', [img]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    assert.strictEqual(p.children[0].tagName, 'img');
  });

  it('skips ./media_ images', async () => {
    const img = h('img', { src: './media_abc123.png', alt: '' });
    const p = h('p', [img]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    assert.strictEqual(p.children[0].tagName, 'img');
  });

  it('replaces an img wrapped in em with a picture on the grandparent', async () => {
    const img = h('img', { src: `${BASE}?assetname=test.jpg`, alt: '' });
    const em = h('em', [img]);
    const p = h('p', [em]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    assert.strictEqual(p.children[0].tagName, 'picture');
  });

  it('replaces an img wrapped in strong with a picture on the grandparent', async () => {
    const img = h('img', { src: `${BASE}?assetname=test.jpg`, alt: '' });
    const strong = h('strong', [img]);
    const p = h('p', [strong]);
    const root = { type: 'root', children: [p] };
    await processExternalImages(makeState(root));
    assert.strictEqual(p.children[0].tagName, 'picture');
  });
});
