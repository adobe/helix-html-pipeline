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

export function globToRegExp(glob) {
  const reString = glob
    .replaceAll('**', '|')
    .replaceAll('*', '[0-9a-z-.]*')
    .replaceAll('|', '.*');
  return new RegExp(`^${reString}$`);
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

/**
 * Converts all keys in a row object to lowercase
 * @param {Object} obj A row of data from a sheet
 * @returns {Object} A row with all keys converted to lowercase
 */
function toLowerKeys(obj) {
  return Object.keys(obj).reduce((prev, key) => {
    prev[key.toLowerCase()] = obj[key];
    return prev;
  }, Object.create(null));
}

/**
 * The modifiers class help manage the metadata and headers modifiers.
 */
export class Modifiers {
  /**
   * Empty modifiers
   * @type {Modifiers}
   */
  static EMPTY = new Modifiers({});

  /**
   * Parses a sheet that is in a modifier format into a list of key/value pairs
   *
   * @example
   *
   * | url   | key | value | Title   | Description    |
   * |-------|-----|-------|---------|----------------|
   * | "/*"  | "A" | "B"   | ""      | ""             |
   * | "/*"  | "C" | "D"   | ""      | ""             |
   * | "/f"  | ""  | ""    | "Hero"  | "Once upon..." |
   *
   * becomes:
   *
   * {
   *   "/*": [
   *     { "key": "A", "value": "B" },
   *     { "key": "C", "value": "D" },
   *   ],
   *   "/f": [
   *     { "key": "title", "value": "Hero" },
   *     { "key": "description", "value": "Once upon..." },
   *   ]
   * }
   *
   *
   * @param {object[]} sheet The sheet to parse
   * @param {function} keyFilter filter to apply on keys
   * @returns {object} An object containing an array of key/value pairs for every glob
   */
  static fromModifierSheet(sheet, keyFilter = () => true) {
    const res = Object.create(null);
    for (let row of sheet) {
      row = toLowerKeys(row);
      const {
        url, key, value, ...rest
      } = row;
      if (url) {
        const put = (k, v) => {
          if (keyFilter(k)) {
            let entry = res[url];
            if (!entry) {
              entry = [];
              res[url] = entry;
            }
            entry.push({ key: k, value: v });
          }
        };

        // note that all values are strings, i.e. never another falsy value
        if ('key' in row && 'value' in row && key && value) {
          put(key, value);
        } else {
          Object.entries(rest).forEach(([k, v]) => {
            if (k && v) {
              put(k, v);
            }
          });
        }
      }
    }
    return new Modifiers(res);
  }

  constructor(config) {
    this.modifiers = Object.entries(config).map(([url, mods]) => {
      const pat = url.indexOf('*') >= 0 ? globToRegExp(url) : url;
      return {
        pat,
        mods,
      };
    });
  }

  /**
   * Returns the modifier object for the given path.
   * @param {string} path
   * @return {object} the modifier
   */
  getModifiers(path) {
    const modifiers = Object.create(null);
    for (const { pat, mods } of this.modifiers) {
      if (pat === path || (pat instanceof RegExp && pat.test(path))) {
        for (const { key, value } of mods) {
          modifiers[toMetaName(key)] = value;
        }
      }
    }
    return modifiers;
  }
}
