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
import { visitParents } from 'unist-util-visit-parents';
import { h } from 'hastscript';

const EXTERNAL_IMAGE_CONFIG = {
  width: '750',
};

function isExternalImage(node, state) {
  if (node.tagName !== 'img' || !node.properties?.src) {
    return false;
  }

  const { src } = node.properties;

  if (src.startsWith('./media_')) {
    return false;
  }

  // Check if URL matches any external image prefix
  const { externalImageUrlPrefixes = [] } = state.config || {};
  return externalImageUrlPrefixes.some((prefix) => src.startsWith(prefix));
}

function processExternalImage(src, alt = '', title = undefined) {
  try {
    const url = new URL(src);
    const { searchParams } = url;

    const width = searchParams.get('width');
    const height = searchParams.get('height');

    const hasOriginalDimensions = width || height;

    searchParams.delete('width');
    searchParams.delete('height');

    searchParams.set('width', EXTERNAL_IMAGE_CONFIG.width);
    const newSrc = `${url.origin}${url.pathname}${url.search}${url.hash}`;

    const imgAttributes = {
      src: newSrc,
      alt,
      'data-title': title === alt ? undefined : title,
    };

    if (hasOriginalDimensions) {
      if (width) {
        imgAttributes.width = width;
      }
      if (height) {
        imgAttributes.height = height;
      }
    }

    return imgAttributes;
  } catch (e) {
    return null;
  }
}

/**
 * Processes external images by extracting width/height from search params
 * and adding them as attributes, while setting hardcoded width=750 in URL
 * @type PipelineStep
 * @param {PipelineState} state The current context of processing pipeline
 */
export default async function processExternalImages(state) {
  const { content } = state;
  const { hast } = content;

  visitParents(hast, (node) => isExternalImage(node, state), (img, parents) => {
    const { src, alt, title } = img.properties;
    const processedAttributes = processExternalImage(src, alt, title);

    if (processedAttributes) {
      const newImg = h('img', processedAttributes);
      const parent = parents[parents.length - 1];
      const idx = parent.children.indexOf(img);
      parent.children[idx] = newImg;
    }
  });
}
