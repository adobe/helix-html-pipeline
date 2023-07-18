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

/* eslint-disable max-classes-per-file */

import assert from 'assert';
import { HtmlDiffer } from '@markedjs/html-differ';

export function getDiffVersions(diff) {
  const charsAroundDiff = 40;
  const expected = [];
  const actual = [];
  diff.forEach((part, index) => {
    const partValue = part.value;
    if (part.added) {
      actual.push(partValue);
    } else if (part.removed) {
      expected.push(partValue);
    } else if (partValue.length < charsAroundDiff * 2) {
      expected.push(partValue);
      actual.push(partValue);
    } else {
      if (index > 0) {
        expected.push(partValue.substr(0, charsAroundDiff));
        actual.push(partValue.substr(0, charsAroundDiff));
      }
      if (index < diff.length - 1) {
        expected.push(`...\n${partValue.substr(partValue.length - charsAroundDiff)}`);
        actual.push(`...\n${partValue.substr(partValue.length - charsAroundDiff)}`);
      }
    }
  });
  return {
    expected: expected.join('\n'),
    actual: actual.join('\n'),
  };
}

class DiffAssertionError extends assert.AssertionError {
  constructor(opts) {
    super(opts);
    this.diff = opts.diff;
  }
}

export async function assertHTMLEquals(actualHtml, expectedHtml) {
  const htmlDiffer = new HtmlDiffer({
    ignoreAttributes: [],
    compareAttributesAsJSON: [],
    ignoreWhitespaces: true,
    ignoreComments: true,
    ignoreEndTags: false,
  });
  const diff = await htmlDiffer.diffHtml(expectedHtml, actualHtml);
  if (diff.length === 1 && !diff[0].added && !diff[0].removed) {
    return;
  }
  const { expected, actual } = getDiffVersions(diff);
  throw new DiffAssertionError({
    message: 'HTML differs.',
    actual,
    expected,
    diff,
  });
}

/**
 * Helpers for working with strings.
 */

/**
 * This is a helper for declaring multiline strings.
 *
 * ```
 * const s = multiline(`
 *     Foo
 *     Bar
 *     Baz
 *
 *        Hello
 *
 *     Bang
 * `);
 * ```
 *
 * The function basically just takes a string and then
 * strips the first & last lines if they are empty.
 *
 * In order to remove indentation, we determine the common
 * whitespace prefix length (number of space 0x20 characters
 * at the start of the line). This prefix is simply removed
 * from each line...
 */
export function multiline(str) {
  // Discard the leading & trailing line
  const lines = str.split('\n');

  // Strip the first and the last line
  if (lines[0].match(/^\s*$/)) {
    lines.shift();
  }
  if (lines.length > 0 && lines[lines.length - 1].match(/^\s*$/)) {
    lines.pop();
  }

  // Find the prefix length
  const prefixLen = lines
    .filter((l) => !l.match(/^\s*$/)) // Disregarding empty lines
    .map((l) => l.match(/^ */)[0].length) // Extract prefixes length
    .reduce((a, b) => Math.min(a, b), Infinity); // minimum

  return lines
    .map((l) => l.slice(prefixLen)) // discard prefixes
    .join('\n');
}

export class Response {
  constructor(body, opts) {
    this.status = 200;
    Object.assign(this, opts);
    this.body = body;
    this.ok = this.status === 200;
  }

  async json() {
    return this.body;
  }

  async text() {
    return this.body instanceof String ? this.body : JSON.stringify(this.body);
  }
}
