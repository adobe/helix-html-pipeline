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
import { visit } from 'unist-util-visit';

function isExternalImage(node) {
  if (node.tagName !== 'img' || !node.properties?.src) {
    return false;
  }

  const { src } = node.properties;
  return !src.startsWith('./media_');
}

function processExternalImage(src, alt = '', title = undefined) {
  try {
    const url = new URL(src);
    const { searchParams } = url;

    const width = searchParams.get('width');
    const height = searchParams.get('height');

    if (!width && !height) {
      return null;
    }

    searchParams.delete('width');
    searchParams.delete('height');

    searchParams.set('width', '750');

    searchParams.set('quality', '65');

    const newSrc = `${url.origin}${url.pathname}${url.search}${url.hash}`;

    const imgAttributes = {
      src: newSrc,
      alt,
    };

    if (width) {
      imgAttributes.width = width;
    }
    if (height) {
      imgAttributes.height = height;
    }

    if (title && title !== alt) {
      imgAttributes['data-title'] = title;
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

  visit(hast, isExternalImage, (img) => {
    const { src, alt, title } = img.properties;
    const processedAttributes = processExternalImage(src, alt, title);

    if (processedAttributes) {
      Object.assign(img.properties, processedAttributes);
    }
  });
}
