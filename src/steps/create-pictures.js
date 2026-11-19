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

// Builds the four responsive variants (webp x breakpoints, then native-format x breakpoints)
// shared by every image source: media bus, external DM, or any other external image.
function buildVariants(ext, type, webpExt) {
  return [
    ...BREAK_POINTS.map((bp) => ({ ...bp, ext: webpExt, type: 'image/webp' })),
    ...BREAK_POINTS.map((bp) => ({ ...bp, ext, type })),
  ];
}

function sourcesFromVariants(variants, urlFor) {
  return variants.map((v) => h('source', { type: v.type, srcset: urlFor(v), media: v.media }));
}

/**
 * Builds a responsive <picture> element for a media-bus (./media_*) image.
 * The fallback <img> reuses the narrowest breakpoint, matching the platform-wide
 * media-bus convention (real browsers always resolve via <source> and never use it).
 * @param {string} src Relative media-bus image path
 * @param {string} alt Alt text
 * @param {string|undefined} title Title attribute value
 * @returns {import('hast').Element} picture HAST node
 */
export function createOptimizedPicture(src, alt = '', title = undefined) {
  const url = new URL(src, 'https://localhost/');
  const { pathname, hash = '' } = url;
  const props = new URLSearchParams(hash.substring(1));
  // detect bug in media handler that created fragments like `width=800&width=600`
  // eslint-disable-next-line prefer-const
  let [width, height] = props.getAll('width');
  if (props.has('height')) {
    height = props.get('height');
  }
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);
  const type = mime.getType(pathname);

  const urlFor = (v) => `.${pathname}?width=${v.width}&format=${v.ext}&optimize=medium`;
  const variants = buildVariants(ext, type, 'webply');
  const sources = sourcesFromVariants(variants.slice(0, -1), urlFor);

  const last = variants[variants.length - 1];
  const img = h('img', {
    loading: 'lazy',
    alt,
    'data-title': title === alt ? undefined : title,
    src: urlFor(last),
    width,
    height,
  });

  return h('picture', [...sources, img]);
}

/**
 * Builds a responsive <picture> element for an external image URL (DM or otherwise).
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

  const urlFor = (v) => {
    url.searchParams.set('width', v.width);
    url.searchParams.set('format', v.ext);
    return url.href;
  };
  const variants = buildVariants(ext, type, 'webp');
  const sources = sourcesFromVariants(variants, urlFor);

  // The fallback <img> intentionally uses the widest breakpoint, not the narrowest.
  // Real browsers always resolve via <source>/media and never fall through to this URL,
  // but anything that reads `src` directly instead of respecting <picture> (bespoke block
  // JS grabbing img.src via regex/DOM access, share-card scrapers, legacy browsers) should
  // get a safe, reasonable-quality image rather than the smallest responsive variant.
  const widest = variants[BREAK_POINTS.length]; // first native-format variant = BREAK_POINTS[0]
  const img = h('img', {
    loading: 'lazy',
    alt,
    'data-title': title === alt ? undefined : title,
    src: urlFor(widest),
    width,
    height,
  });

  return h('picture', [...sources, img]);
}

function isImage(node) {
  return node.tagName === 'img' && !!node.properties?.src;
}

/**
 * Converts <img> elements to responsive <picture> elements with srcset, for both media-bus
 * (./media_*) images and external image URLs (e.g. DM delivery URLs).
 * @type PipelineStep
 * @param context The current context of processing pipeline
 */
export default async function createPictures({ content }) {
  const { hast } = content;

  visitParents(hast, isImage, (img, parents) => {
    const parent = parents[parents.length - 1];
    const {
      src, alt, title, width: existingWidth, height: existingHeight,
    } = img.properties;

    let picture;
    if (src.startsWith('./media_')) {
      picture = createOptimizedPicture(src, alt, title);
    } else {
      // Already inside a picture — skip to avoid double-processing
      if (parent.tagName === 'picture') {
        return;
      }
      picture = createExternalPicture(src, alt, title, existingWidth, existingHeight);
      if (!picture) {
        img.properties.loading = 'lazy';
        return;
      }
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
