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
