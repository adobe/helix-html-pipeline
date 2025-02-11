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
/* eslint-disable no-param-reassign */
import { h } from 'hastscript';
import { CONTINUE, SKIP, visit } from 'unist-util-visit';

/**
 * Create a <span> icon element:
 *
 * `<span class="icon icon-smile"></span>`
 *
 * @param {string} value the identifier of the icon
 */
function createIcon(value) {
  let name = encodeURIComponent(value);

  // icon starts with #
  if (name.startsWith('%23')) {
    // todo: still support sprite sheets?
    name = name.substring(3);
  }

  // create normal span
  return h('span', { className: ['icon', `icon-${name}`] });
}

// Helper function to check if a character is a digit
function isDigit(char) {
  return char >= '0' && char <= '9';
}

/**
 * Rewrite :icons:
 *
 * @type PipelineStep
 * @param content
 */
export default function rewrite({ content }) {
  const { hast } = content;

  visit(hast, (node, idx, parent) => {
    if (node.tagName === 'code') {
      return SKIP;
    }
    if (node.type !== 'text') {
      return CONTINUE;
    }

    const text = node.value;

    // Process icons with stricter regex
    // Only match valid icon patterns that:
    // - Must not be part of a timestamp pattern (real or example)
    // - Must not be part of a URL/URN pattern
    // - Must not be part of a time/ratio pattern
    const ICON_REGEX = /(?<!(?:https?|urn)[^\s]*|[\d:T]):((?!mm\b)[#a-z\d][a-z\d_-]*[a-z\d]):/gi;

    let lastIdx = 0;
    for (const match of text.matchAll(ICON_REGEX)) {
      const [matched, icon] = match;

      // Additional validation to prevent matching within patterns
      const beforeChar = match.index > 0 ? text[match.index - 1] : '';
      const afterChar = match.index + matched.length < text.length
        ? text[match.index + matched.length]
        : '';

      // Skip if this looks like part of a pattern
      if (beforeChar === ':' || beforeChar === 'T' || isDigit(beforeChar)
          || afterChar === ':' || isDigit(afterChar)) {
        return idx + 1;
      }

      const before = text.substring(lastIdx, match.index);
      if (before) {
        parent.children.splice(idx, 0, { type: 'text', value: before });
        idx += 1;
      }
      parent.children.splice(idx, 0, createIcon(icon));
      idx += 1;
      lastIdx = match.index + matched.length;
    }

    if (lastIdx && lastIdx <= text.length) {
      const after = text.substring(lastIdx);
      if (after) {
        node.value = after;
      } else {
        parent.children.splice(idx, 1);
        idx -= 1;
      }
    }

    return idx + 1;
  });
}
