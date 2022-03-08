/*
 * Copyright 2022 Adobe. All rights reserved.
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
 * Converts all non-valid characters to `-`.
 * @param {string} text input text
 * @returns {string} the meta name
 */
export function toMetaName(text) {
  return text
    .toLowerCase()
    .replace(/[^0-9a-z:_]/gi, '-');
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
 * Array of headers allowed in the metadata.json file.
 */
export const ALLOWED_RESPONSE_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'link',
];
