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
import { resolve } from 'url';
import { getAbsoluteUrl, makeCanonicalHtmlUrl, optimizeImageURL } from './utils.js';

/**
 * Converts all non-valid characters to `-`.
 * @param {string} text input text
 * @returns {string} the meta name
 */
function toMetaName(text) {
  return text
    .toLowerCase()
    .replace(/[^0-9a-z:_]/gi, '-');
}

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
 * @param {HTMLDivElement} $block The block element
 * @returns {object} The block config
 */
function readBlockConfig($block) {
  if (!$block) {
    return {};
  }
  const config = {};
  $block.querySelectorAll(':scope>div').forEach(($row) => {
    if ($row.children && $row.children[1]) {
      const name = toMetaName($row.children[0].textContent);
      if (name) {
        let value;
        if ($row.children[1].hasChildNodes() && $row.children[1].firstElementChild) {
          // check for multiple paragraph or a list
          let childNodes;
          const { tagName } = $row.children[1].firstElementChild;
          if (tagName === 'P') {
            // contains a list of <p> paragraphs
            childNodes = $row.children[1].childNodes;
          } else if (tagName === 'UL' || tagName === 'OL') {
            // contains a list
            childNodes = $row.children[1].children[0].childNodes;
          }

          if (childNodes) {
            value = '';
            childNodes.forEach((child) => {
              value += `${child.textContent}, `;
            });
            value = value.substring(0, value.length - 2);
          }
        }

        if (!value) {
          // for text content only
          value = $row.children[1].textContent.trim().replace(/ {3}/g, ',');
        }

        if (!value) {
          // check for value inside link
          const $a = $row.children[1].querySelector('a');
          if ($a) {
            value = $a.getAttribute('href');
          }
        }
        if (!value) {
          // check for value inside img
          const $img = $row.children[1].querySelector('img');
          if ($img) {
            // strip query string
            value = $img.getAttribute('src');
          }
        }
        if (value) {
          // only keep non-empty value
          config[name] = value;
        }
      }
    }
  });
  return config;
}

function applyMetaRule(target, obj) {
  Object.keys(obj).forEach((key) => {
    const metaKey = toMetaName(key);
    if (metaKey !== 'url' && obj[key]) {
      target[metaKey] = obj[key];
    }
  });
}

function globToRegExp(glob) {
  const reString = glob
    .replace(/\*\*/g, '_')
    .replace(/\*/g, '[0-9a-z-.]*')
    .replace(/_/g, '.*');
  return new RegExp(`^${reString}$`);
}

export function filterGlobalMetadata(metaRules, path) {
  const metaConfig = {};
  metaRules.forEach((rule) => {
    const glob = rule.url || rule.URL || rule.Url;
    if (glob && typeof glob === 'string' && /[0-9a-z-/*]/.test(glob)) {
      if (glob.indexOf('*') >= 0) {
        if (globToRegExp(glob).test(path)) {
          applyMetaRule(metaConfig, rule);
        }
      } else if (glob === path) {
        applyMetaRule(metaConfig, rule);
      }
    }
  });
  return metaConfig;
}

/**
 * Looks for metadata in the document.
 * @param {HTMLDocument} document The document
 * @return {object} The metadata
 */
function getLocalMetadata(document) {
  let metaConfig = {};
  const metaBlock = document.querySelector('body div.metadata');
  if (metaBlock) {
    metaConfig = readBlockConfig(metaBlock);
    metaBlock.remove();
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
  if (typeof imgUrl !== 'string') {
    return null;
  }
  const src = resolve(pagePath, imgUrl);
  if (src.startsWith('/')) {
    return optimizeImageURL(src, 1200, 'pjpg');
  }
  return src;
}

/**
 * Extracts the metadata and stores it in the content meta
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 */
export default function extractMetaData(state, req) {
  const { content } = state;
  const { meta, document } = content;

  // extract global metadata from spreadsheet, and overlay
  // with local metadata from document
  const metaConfig = Object.assign(
    filterGlobalMetadata(state.metadata, state.info.path),
    getLocalMetadata(document),
  );

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
  ].forEach((name) => {
    if (metaConfig[name]) {
      meta[name] = metaConfig[name];
      delete metaConfig[name];
    }
  });
  if (Object.keys(metaConfig).length > 0) {
    // add rest to meta.custom
    meta.custom = Object.keys(metaConfig).map((name) => ({
      name,
      value: metaConfig[name],
      property: name.includes(':'),
    }));
  }

  if (meta.keywords) {
    meta.keywords = toList(meta.keywords).join(', ');
  }
  if (meta.tags) {
    meta.tags = toList(meta.tags);
  }

  // complete metadata with insights from content
  if (!meta.title) {
    // content.title is not correct if the h1 is in a page-block since the pipeline
    // only respects the heading nodes in the mdast
    const $title = document.querySelector('body > div h1');
    if ($title) {
      content.title = $title.textContent;
    }
    meta.title = content.title;
  }
  if (!meta.description) {
    // description: text from paragraphs with 10 or more words
    let desc = [];
    document.querySelectorAll('div > p').forEach((p) => {
      if (desc.length === 0) {
        const words = p.textContent.trim().split(/\s+/);
        if (words.length >= 10 || words.some((w) => w.length > 25 && !w.startsWith('http'))) {
          desc = desc.concat(words);
        }
      }
    });
    meta.description = `${desc.slice(0, 25).join(' ')}${desc.length > 25 ? ' ...' : ''}`;
  }
  meta.url = makeCanonicalHtmlUrl(getAbsoluteUrl(req.headers, state.info.path));
  if (!meta.canonical) {
    meta.canonical = meta.url;
  }

  // content.image is not correct if the first image is in a page-block. since the pipeline
  // only respects the image nodes in the mdast
  const $hero = document.querySelector('body > div img');
  if ($hero) {
    content.image = $hero.src;
    if ($hero.alt) {
      content.imageAlt = $hero.alt;
    }
  }

  meta.image = getAbsoluteUrl(
    req.headers,
    optimizeMetaImage(state.info.path, meta.image || content.image || '/default-meta-image.png'),
  );

  meta.imageAlt = meta['image-alt'] || content.imageAlt;
}
