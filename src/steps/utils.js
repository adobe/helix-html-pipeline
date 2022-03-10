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
 * @param {DOMNode} $node The content of the node to wrap
 * @param {DOMNode} $parent The new parent node
 */
export function wrapContent($parent, $node) {
  $parent.append(...$node.childNodes);
  $node.append($parent);
}

/**
 * Converts all non-valid-css-classname characters to `-`.
 * @param {string} text input text
 * @returns {string} the css class name
 */
export function toClassName(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z]/gi, '-');
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
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash;
  }
  return resolvedUrl.toString();
}

/**
 * Turns a relative into an absolute URL.
 * @param {object} headers The request headers
 * @param {string} url The relative or absolute URL
 * @returns {string} The absolute URL or <code>null</code>
 *                   if <code>url</code> is not a string
 */
export function getAbsoluteUrl(headers, url) {
  if (typeof url !== 'string') {
    return null;
  }
  return resolveUrl(`https://${getOriginalHost(headers)}/`, url);
}
