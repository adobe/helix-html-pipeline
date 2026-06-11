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
import mime from 'mime';
import { h } from 'hastscript';
import { visitParents } from 'unist-util-visit-parents';

const BREAK_POINTS = [
  { media: '(min-width: 600px)', width: '2000' },
  { width: '750' },
];

function isExternalImage(node) {
  return node.tagName === 'img'
    && !!node.properties?.src
    && !node.properties.src.startsWith('./media_');
}

/**
 * Builds a responsive <picture> element for an external image URL.
 * Mirrors createOptimizedPicture() for media images but works with absolute URLs.
 * Intrinsic dimensions are read from ?originalImageWidth/originalImageHeight (set by the
 * asset picker) or fall back to existingWidth/existingHeight (from HTL-rendered attributes).
 * These are stripped from all srcset URLs; delivery size is controlled by BREAK_POINTS.
 * @param {string} src Absolute external image URL
 * @param {string} alt Alt text
 * @param {string|undefined} title Title attribute value
 * @param {string|undefined} existingWidth Existing width attribute from <img> (OOTB picker)
 * @param {string|undefined} existingHeight Existing height attribute from <img> (OOTB picker)
 * @returns {import('hast').Element|null} picture HAST node, or null on bad URL
 */
export function createExternalPicture(src, alt = '', title = undefined, existingWidth = undefined, existingHeight = undefined) {
  let url;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);
  const type = mime.getType(pathname) || 'image/jpeg';

  // Read intrinsic dimensions from no-op query params appended by the custom asset picker.
  // existingWidth/Height is a forward-looking fallback for the OOTB UE picker path: once the
  // UE platform team stores imageWidth/imageHeight as separate JCR properties and the HTL
  // template renders them as width/height attrs on <img>, this fallback activates with no
  // further pipeline changes required.
  const width = url.searchParams.get('originalImageWidth') || existingWidth || undefined;
  const height = url.searchParams.get('originalImageHeight') || existingHeight || undefined;
  url.searchParams.delete('originalImageWidth');
  url.searchParams.delete('originalImageHeight');
  // Remove any delivery-size params so BREAK_POINTS drive srcset widths exclusively.
  url.searchParams.delete('width');
  url.searchParams.delete('height');
  // Fragments are not sent to the server and have no meaning for image delivery URLs.
  url.hash = '';

  // Four variants: webp × breakpoints, then native format × breakpoints.
  // The last entry becomes the fallback <img>; the rest become <source> elements.
  const variants = [
    ...BREAK_POINTS.map((bp) => ({ ...bp, ext: 'webply', type: 'image/webp' })),
    ...BREAK_POINTS.map((bp) => ({ ...bp, ext, type })),
  ];

  const nodes = variants.map((v, i) => {
    url.searchParams.set('width', v.width);
    url.searchParams.set('format', v.ext);
    const srcset = url.href;

    if (i < variants.length - 1) {
      return h('source', { type: v.type, srcset, media: v.media });
    }

    return h('img', {
      loading: 'lazy',
      alt,
      'data-title': title === alt ? undefined : title,
      src: srcset,
      width,
      height,
    });
  });

  return h('picture', nodes);
}

/**
 * Converts external <img> elements to responsive <picture> elements with srcset.
 * Runs after createPictures() so ./media_* images are already handled.
 * Generating a server-side <picture> causes decorateExternalImages() in aem-assets.js
 * to skip these images (it ignores <img> already inside <picture>), eliminating the
 * conflict between server-side and client-side image decoration.
 * @type PipelineStep
 * @param {object} context The current context of processing pipeline
 */
export default async function processExternalImages({ content }) {
  const { hast } = content;

  visitParents(hast, isExternalImage, (img, parents) => {
    const parent = parents[parents.length - 1];
    // Already inside a picture — skip to avoid double-processing
    if (parent.tagName === 'picture') {
      return;
    }

    const {
      src, alt, title, width: existingWidth, height: existingHeight,
    } = img.properties;
    const picture = createExternalPicture(src, alt, title, existingWidth, existingHeight);
    if (!picture) {
      return;
    }

    const parentTag = parent.tagName;
    if (parentTag === 'em' || parentTag === 'strong') {
      const grand = parents[parents.length - 2];
      const idx = grand.children.indexOf(parent);
      grand.children[idx] = picture;
    } else {
      const idx = parent.children.indexOf(img);
      parent.children[idx] = picture;
    }
  });
}
