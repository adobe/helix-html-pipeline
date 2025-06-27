/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

function lookup(state, obj, token) {
  if (token === 'path') {
    return state.info.path;
  }
  if (token === 'host') {
    return state.prodHost;
  }
  return obj[token] || '';
}

function expand(state, obj, value) {
  const str = String(value);
  const matches = str.matchAll(/{{(.+?)}}/g);
  let ret = '';
  let last = 0;
  for (const match of matches) {
    ret += str.substring(last, match.index);
    ret += lookup(state, obj, match[1]);
    last = match.index + match[0].length;
  }
  if (last) {
    return ret + str.substring(last);
  }
  // no match
  return value;
}

/**
 * Expands the handlebars-like templates in the given object.
 * Special property names are:
 * - `path` : state.info.path
 * - `host` : state.prodHost
 *
 * @param {PipelineState} state
 * @param {object} obj
 * @returns {*}
 */
export function expandTemplates(state, obj) {
  const ret = {};
  for (const [key, value] of Object.entries(obj)) {
    // ignore json-ld
    if (key.toLowerCase() === 'json-ld') {
      ret[key] = obj[key];
    } else {
      ret[key] = expand(state, obj, value);
    }
  }
  return ret;
}
