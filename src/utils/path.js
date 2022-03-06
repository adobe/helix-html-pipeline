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

/**
 * Returns a path info for the given resource path
 * @param {string} path request path
 * @returns {PathInfo} the path info
 */
export function getPathInfo(path) {
  if (!path) {
    // eslint-disable-next-line no-param-reassign
    path = '/';
  }
  const segs = path.split(/\/+/);
  segs.shift(); // remove _emptyness_ before first slash
  if (segs.length < 1) {
    return null;
  }
  if (segs.indexOf('..') >= 0 || segs.indexOf('.') >= 0) {
    return null;
  }
  const info = {
    selector: '',
    extension: '.html',
    originalExtension: '',
    originalPath: path,
    originalFilename: segs.pop(),
  };

  // path         -> web path (no .html, no index)
  // resourcePath -> content path (.md)
  let fileName = info.originalFilename;
  if (!fileName || fileName === 'index.html' || fileName === 'index.md' || fileName === 'index') {
    // last segment empty or index
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot >= 0) {
      info.originalExtension = fileName.substring(lastDot);
    }
    segs.push('');
    fileName = 'index.md';
  } else if (fileName.indexOf('.') < 0) {
    // if last segment has no extension, add `.md`
    segs.push(fileName);
    fileName = `${fileName}.md`;
  } else {
    // compute selector and extension
    const firstDot = fileName.indexOf('.');
    const lastDot = fileName.lastIndexOf('.');
    info.extension = fileName.substring(lastDot);
    info.originalExtension = info.extension;
    const baseName = fileName.substring(0, firstDot);
    let resExt = info.extension;
    if (resExt === '.md') {
      info.extension = '.html';
      segs.push(baseName);
    } else if (resExt === '.html') {
      resExt = '.md';
      segs.push(baseName);
    } else {
      segs.push(`${baseName}${resExt}`);
    }

    if (lastDot !== firstDot) {
      info.selector = fileName.substring(firstDot + 1, lastDot);
      segs[segs.length - 1] = `${baseName}.${info.selector}${info.extension}`;
    }
    fileName = `${baseName}${resExt}`;
  }

  info.path = `/${segs.join('/')}`;
  segs[segs.length - 1] = fileName;
  info.resourcePath = `/${segs.join('/')}`;
  return info;
}

/**
 * Validates the path info
 * @param {PathInfo} info Info to valida
 * @return {boolean} {@code true} if valid.
 */
export function validatePathInfo(info) {
  if (!info) {
    return false;
  }

  // only support empty selector or plain with html
  if (info.selector) {
    if (info.selector !== 'plain') {
      return false;
    }
    return info.extension === '.html';
  }
  return true;
}
