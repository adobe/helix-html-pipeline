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
import { selectAll, select } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { remove } from 'unist-util-remove';
import { visit, EXIT, CONTINUE } from 'unist-util-visit';
import {
  getAbsoluteUrl, makeCanonicalHtmlUrl, optimizeImageURL, resolveUrl, rewriteUrl,
} from './utils.js';
import { toMetaName } from '../utils/modifiers.js';
import { childNodes } from '../utils/hast-utils.js';

/**
 * Cleans up comma-separated string lists and returns an array.
 * @param {string} list A comma-separated list
 * @returns {string[]} The clean list
 */
function toList(list) {
  return list
    .split(',')
    .map((key) => key.trim())
    .filter((key) => !!key);
}

/**
 * Returns the config from a block element as object with key/value pairs.
 * @param {Element} $block The block element
 * @returns {object} The block config
 */
function readBlockConfig($block) {
  const config = Object.create(null);
  selectAll(':scope>div', $block).forEach(($row) => {
    if ($row?.children[1]) {
      const [$name, $value] = $row.children;
      const name = toMetaName(toString($name));
      if (name) {
        // special case for json-ld. don't apply any special formatting
        if (name.toLowerCase() === 'json-ld') {
          config[name] = toString($value).trim();
          return;
        }

        let value;
        const $firstChild = childNodes($value)[0];
        if ($firstChild) {
          // check for multiple paragraph or a list
          let list;
          const { tagName } = $firstChild;
          if (tagName === 'p') {
            // contains a list of <p> paragraphs
            list = childNodes($value);
          } else if (tagName === 'ul' || tagName === 'ol') {
            // contains a list
            list = childNodes($firstChild);
          }

          if (list) {
            value = list.map((child) => toString(child)).join(', ');
          }
        }

        if (!value) {
          // for text content only
          value = toString($value).trim();
        }

        if (!value) {
          // check for value inside link
          const $a = select('a', $value);
          if ($a) {
            value = $a.properties.href;
          }
        }
        if (!value) {
          // check for value inside img
          const $img = select('img', $value);
          if ($img) {
            // strip query string
            value = $img.properties.src;
          }
        }
        config[name] = value;
      }
    }
  });
  return config;
}

/**
 * Looks for metadata in the document.
 * @param {Root} document The hast document
 * @return {object} The metadata
 */
function getLocalMetadata(document) {
  let metaConfig = {};
  const metaBlock = select('div.metadata', document);
  if (metaBlock) {
    metaConfig = readBlockConfig(metaBlock);
    // TODO: here we should also remove the parent div of the former table, otherwise it results
    // TODO: in an empty <div></div>
    remove(document, { cascade: false }, metaBlock);
  }
  return metaConfig;
}

/**
 * Adds image optimization parameters suitable for meta images to a URL.
 * @param {string} pagePath The path of the requested page
 * @param {string} imgUrl The image URL
 * @returns The optimized image URL
 */
function optimizeMetaImage(pagePath, imgUrl) {
  const src = resolveUrl(pagePath, imgUrl);
  if (src.startsWith('/')) {
    return optimizeImageURL(src, 1200, 'pjpg');
  }
  return src;
}

/**
 * Extracts the description from the document. note, that the selectAll('div > p') used in
 * jsdom doesn't work as expected in hast
 * @param {Root} hast
 * @see https://github.com/syntax-tree/unist/discussions/66
 */
function extractDescription(hast) {
  let desc = '';
  visit(hast, (node, idx, parent) => {
    if (parent?.tagName === 'div' && node.tagName === 'p') {
      const words = toString(node).trim().split(/\s+/);
      if (words.length >= 10 || words.some((w) => w.length > 25 && !w.startsWith('http'))) {
        desc = `${words.slice(0, 25).join(' ')}${words.length > 25 ? ' ...' : ''}`;
        return EXIT;
      }
    }
    return CONTINUE;
  });
  return desc;
}

/**
 * Extracts the metadata from config and the metadata block and stores it in the content.meta.page:
 * - all the non-empty values from the config metadata are applied.
 * - config value with an empty string (explicit "") are removed from the result
 * - all the values from the metadata block are applied. empty values remain empty for the
 *   properties that can have a default: 'title', 'description', 'image', 'image-alt', 'url'
 *   the others are removed.
 * - the defaults for 'title', 'description', 'image', 'image-alt', 'url' are applied if missing
 * - twitter: properties default to their og: counterparts if missing.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 */
export default function extractMetaData(state, req) {
  const FIXED = new Set([
    'title', 'description', 'image', 'image-alt', 'url',
    'twitter:card', 'og:url', 'canonical',
  ]);

  const { content } = state;
  const { meta, hast } = content;

  // extract global metadata from spreadsheet, and overlay
  // with local metadata from document
  const metaConfig = Object.assign(
    state.metadata.getModifiers(state.info.unmappedPath || state.info.path),
    state.mappedMetadata.getModifiers(state.info.unmappedPath || state.info.path),
  );

  // prune empty values and explicit "" strings from sheet based metadata
  Object.entries(metaConfig).forEach(([name, value]) => {
    if (!value) {
      delete metaConfig[name];
    } else if (value === '""') {
      metaConfig[name] = undefined;
    }
  });

  // apply document local overrides
  Object.entries(getLocalMetadata(hast)).forEach(([name, value]) => {
    if (value || FIXED.has(name)) {
      metaConfig[name] = value;
    }
  });

  // first process supported metadata properties
  [
    'title',
    'description',
    'keywords',
    'tags',
    'image',
    'image-alt',
    'canonical',
    'feed',
    'twitter:card',
  ].forEach((name) => {
    if (name in metaConfig) {
      meta[name] = metaConfig[name];
      delete metaConfig[name];
    }
  });

  if (!('twitter:card' in meta)) {
    // default value for twitter:card (mandatory for rendering URLs as cards in tweets)
    meta['twitter:card'] = 'summary_large_image';
  }

  if (meta.keywords) {
    meta.keywords = toList(meta.keywords).join(', ');
  }
  if (meta.tags) {
    meta.tags = toList(meta.tags);
  }

  // complete metadata with insights from content
  if (!('title' in meta)) {
    // content.title is not correct if the h1 is in a page-block since the pipeline
    // only respects the heading nodes in the mdast
    const $title = select('div h1', hast);
    if ($title) {
      content.title = toString($title);
    }
    meta.title = content.title;
  }
  // append the title suffix
  const titleSuffix = metaConfig['title:suffix'];
  delete metaConfig['title:suffix'];
  if (meta.title && titleSuffix && titleSuffix !== '""') {
    meta.title = `${meta.title} ${titleSuffix}`;
  }

  if (!('description' in meta)) {
    meta.description = extractDescription(hast) || undefined;
  }

  // use the req.url and not the state.info.path in case of folder mapping
  meta.url = makeCanonicalHtmlUrl(getAbsoluteUrl(state, req.url.pathname));

  // append canonical extension
  const canonicalExt = metaConfig['canonical:extension'];
  delete metaConfig['canonical:extension'];
  if (canonicalExt && !meta.url.endsWith('/')) {
    meta.url = `${meta.url}.${canonicalExt}`;
  }

  if ('canonical' in meta) {
    meta.url = meta.canonical;
  } else {
    meta.canonical = meta.url;
  }

  // content.image is not correct if the first image is in a page-block. since the pipeline
  // only respects the image nodes in the mdast
  const $hero = select('div img', hast);
  if ($hero) {
    content.image = $hero.properties.src;
    if ($hero.properties.alt) {
      content.imageAlt = $hero.properties.alt;
    }
  }

  if (!('image' in meta)) {
    meta.image = content.image || '/default-meta-image.png';
  }
  if (meta.image) {
    meta.image = rewriteUrl(state, meta.image);
    meta.image = optimizeMetaImage(state.info.path, meta.image);
    meta.image = getAbsoluteUrl(state, meta.image);
  }

  meta.imageAlt = meta['image-alt'] ?? content.imageAlt;

  // compute the final page metadata
  const metadata = {
    description: meta.description,
    keywords: meta.keywords,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.url,
    'og:image': meta.image,
    'og:image:secure_url': meta.image,
    'og:image:alt': meta.imageAlt,
    'og:updated_time': meta.modified_time,
    'article:tag': meta.tags || [],
    'article:section': meta.section,
    'article:published_time': meta.published_time,
    'article:modified_time': meta.modified_time,
    'twitter:card': meta['twitter:card'],
    'twitter:title': '',
    'twitter:description': '',
    'twitter:image': '',
  };

  // append custom metadata
  Object.assign(metadata, metaConfig);

  // fallback for twitter
  const FALLBACKS = [
    ['twitter:title', 'og:title'],
    ['twitter:description', 'og:description'],
    ['twitter:image', 'og:image'],
  ];

  for (const [from, to] of FALLBACKS) {
    if (!(from in metaConfig)) {
      metadata[from] = metadata[to];
    }
  }

  // remove undefined metadata
  for (const name of Object.keys(metadata)) {
    if (metadata[name] === undefined) {
      delete metadata[name];
    }
  }

  meta.page = metadata;
}
