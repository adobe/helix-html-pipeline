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

const REGEXP_ICON = /(?<!https?[^\s]*)(?<!urn[^\s]*):(#?[a-z_-]+[a-z\d]*):/gi;

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
    let lastIdx = 0;
    for (const match of text.matchAll(REGEXP_ICON)) {
      const [matched, icon] = match;
      const before = text.substring(lastIdx, match.index);
      if (before) {
        // textNode.parentNode.insertBefore(document.createTextNode(before), textNode);
        parent.children.splice(idx, 0, { type: 'text', value: before });
        idx += 1;
      }
      // textNode.parentNode.insertBefore(createIcon(document, icon), textNode);
      parent.children.splice(idx, 0, createIcon(icon));
      idx += 1;
      lastIdx = match.index + matched.length;
    }

    if (lastIdx && lastIdx <= text.length) {
      // there is still some text left
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
