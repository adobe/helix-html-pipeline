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
import { parse } from 'querystring';
import { h } from 'hastscript';
import { visitParents } from 'unist-util-visit-parents';

const BREAK_POINTS = [
  { media: '(min-width: 400px)', width: '2000' },
  { width: '750' },
];

export function createOptimizedPicture(src, alt = '', eager = false) {
  const url = new URL(src, 'https://localhost/');
  const { pathname, hash = '' } = url;
  const { width, height } = parse(hash.substring(1)); // intrinsic dimensions
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);
  const type = mime.getType(pathname);

  const variants = [
    ...BREAK_POINTS.map((br) => ({
      ...br,
      ext: 'webply',
      type: 'image/webp',
    })),
    ...BREAK_POINTS.map((br) => ({
      ...br,
      ext,
      type,
    }))];

  const sources = variants.map((v, i) => {
    const srcset = `.${pathname}?width=${v.width}&format=${v.ext}&optimize=medium`;
    if (i < variants.length - 1) {
      return h('source', {
        type: v.type,
        srcset,
        media: v.media,
      });
    }
    return h('img', {
      loading: eager ? 'eager' : 'lazy',
      alt,
      type: v.type,
      src: srcset,
      width,
      height,
    });
  });

  return h('picture', sources);
}

// export function decoratePictures(main) {
//   main.querySelectorAll('img[src*="/media_"').forEach((img, i) => {
//     const newPicture = createOptimizedPicture(img.src, img.alt, !i);
//     const picture = img.closest('picture');
//     if (picture) picture.parentElement.replaceChild(newPicture, picture);
//     if (['EM', 'STRONG'].includes(newPicture.parentElement.tagName)) {
//       const styleEl = newPicture.parentElement;
//       styleEl.parentElement.replaceChild(newPicture, styleEl);
//     }
//   });
// }

function isMediaImage(node) {
  return node.tagName === 'img' && node.properties?.src.startsWith('./media_');
}

/**
 * Converts imgs to pictures
 * @type PipelineStep
 * @param context The current context of processing pipeline
 */
export default async function createPictures({ content }) {
  const { hast } = content;

  let first = true;
  visitParents(hast, isMediaImage, (img, parents) => {
    const { src, alt } = img.properties;
    const picture = createOptimizedPicture(src, alt, first);
    first = false;

    // check if parent has style and unwrap if needed
    const parent = parents[parents.length - 1];
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
