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

const AZURE_BLOB_REGEXP = /^https:\/\/hlx\.blob\.core\.windows\.net\/external\//;

const MEDIA_BLOB_REGEXP = /^https:\/\/.*\.hlx3?\.(live|page)\/media_.*/;

const HELIX_URL_REGEXP = /^https:\/\/(?!admin\.|www\.)[^.]+\.hlx3?\.(live|page)\/?.*/;

/**
 * Returns the original host name from the request to the outer CDN.
 * @param {object} headers The request headers
 * @returns {string} The original host
 */
export function getOriginalHost(headers) {
  const xfh = headers.get('x-forwarded-host');
  if (xfh) {
    return xfh.split(',')[0].trim();
  }
  return headers.get('host');
}

/**
 * Returns the canonical HTML url for the given one by
 *
 * - removing .html extension
 * - removing index
 *
 * @param {string} url
 * @return {string} canonical url
 */
export function makeCanonicalHtmlUrl(url) {
  if (typeof url !== 'string') {
    return null;
  }
  const queryIdx = url.indexOf('?');
  const query = queryIdx > 0 ? url.substring(queryIdx) : '';
  let base = queryIdx > 0 ? url.substring(0, queryIdx) : url;
  if (base.endsWith('.html')) {
    base = base.substring(0, base.length - 5);
  }
  if (base.endsWith('index')) {
    base = base.substring(0, base.length - 5);
  }
  return `${base}${query}`;
}

/**
 * Wraps the content of $node with a new $parent node and then appends the new parent to the node.
 *
 * @param {Element} $node The content of the node to wrap
 * @param {Element} $parent The new parent node
 */
export function wrapContent($parent, $node) {
  $parent.children.push(...$node.children);
  $node.children = [$parent];
}

/**
 * Converts the given text to an array of CSS class names:
 * - extracts the list of options (given as CSV in braces at the end)
 * - collapses all consecutive invalid-css name characters to a single `-`
 * - removes leading and trailing `-`
 * - converts all names to lowercase
 *
 * @examples
 *   Columns (fullsize center) --> columns fullsize-center
 *   Columns (fullsize, center) --> columns fullsize center
 *   Joe's Pizza! (small) -> joe-s-pizza small
 *
 * @param {string} text input text
 * @returns {string[]} the array of CSS class names
 */
export function toBlockCSSClassNames(text) {
  if (!text) {
    return [];
  }
  const names = [];
  const idx = text.lastIndexOf('(');
  if (idx >= 0) {
    names.push(text.substring(0, idx));
    names.push(...text.substring(idx + 1).split(','));
  } else {
    names.push(text);
  }

  return names.map((name) => name
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, ''))
    .filter((name) => !!name);
}

/**
 * Adds the fastly-image-optimization url params to the given image src.
 * @param {string} src The image source.
 * @param {number} [width = 0] optional 'width' parameter
 * @param {string} [format = 'webply'] image format.
 * @param {string} [optimize = 'medium'] optimization.
 * @returns {string}
 */
export function optimizeImageURL(src, width, format = 'webply', optimize = 'medium') {
  if (typeof src !== 'string') {
    throw new TypeError(`Parameter 'url' must be a string, not ${typeof src}`);
  }

  const simplePath = (uri) => uri.startsWith('/') || uri.startsWith('./');

  const uri = src.trim();

  let url;
  if (simplePath(uri)) {
    url = new URL(`https://dummy${uri[0] !== '/' ? '/' : ''}${uri}`);
  } else {
    url = new URL(uri);
  }
  delete url.search;
  if (width) {
    url.searchParams.set('width', String(width));
  }
  url.searchParams.set('format', format);
  url.searchParams.set('optimize', optimize);

  if (simplePath(uri)) {
    // preserve original path over url.pathname
    const pos = uri.search(/[?#]/g);
    if (pos > -1) {
      return `${uri.substring(0, pos)}${url.search}${url.hash}`;
    } else {
      return `${uri}${url.search}${url.hash}`;
    }
  }
  return url.toString();
}

/**
 * Resolves a target URL relative to a base URL in a manner similar
 * to that of a web browser resolving an anchor tag.
 * @param {string} from
 * @param {string} to
 * @returns {string} resolved url
 */
export function resolveUrl(from, to) {
  const DUMMY_BASE = 'https://__dummmy__';
  const resolvedUrl = new URL(to, new URL(from, DUMMY_BASE));
  if (resolvedUrl.origin === DUMMY_BASE) {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

/**
 * Turns a relative into an absolute URL.
 * @param {PipelineState} state the request state
 * @param {string} url The relative or absolute URL
 * @returns {string} The absolute URL or <code>null</code>
 *                   if <code>url</code> is not a string
 */
export function getAbsoluteUrl(state, url) {
  if (typeof url !== 'string') {
    return null;
  }
  return resolveUrl(`https://${state.config.host}/`, url);
}

/**
 * Rewrites the media, helix or external url. Returns the original if not rewritten.
 * @param {PipelineState} state
 * @param {string} url
 * @returns {string|null}
 */
export function rewriteUrl(state, url) {
  if (!url || !url.startsWith('https://')) {
    return url;
  }
  try {
    const { pathname, search, hash } = new URL(url);

    if (AZURE_BLOB_REGEXP.test(url)) {
      const filename = pathname.split('/').pop();
      const [name, props] = hash.split('?');
      const extension = name.split('.').pop() || 'jpg';
      const newHash = props ? `#${props}` : '';
      return `./media_${filename}.${extension}${newHash}`;
    }

    if (MEDIA_BLOB_REGEXP.test(url)) {
      return `.${pathname}${hash}`;
    }

    if (HELIX_URL_REGEXP.test(url)) {
      if (hash && pathname === state.info?.path) {
        return hash;
      }
      return `${pathname}${search}${hash}`;
    }
  } catch {
    // ignore
  }

  return url;
}
