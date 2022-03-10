/*
 * Copyright 2018 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { toHast as mdast2hast, defaultHandlers } from 'mdast-util-to-hast';
import { raw } from 'hast-util-raw';
import { visit, CONTINUE } from 'unist-util-visit';

import section from './section-handler.js';

/**
 * Turns the MDAST into a HAST structure
 * @param {Node} mdast mdast tree
 * @returns {Root} the HAST document
 */
export default function getHast(mdast) {
  const hast = mdast2hast(mdast, {
    handlers: {
      ...defaultHandlers,
      section: section(),
    },
    allowDangerousHtml: true,
  });

  // the following recreates a bug with the old vdom transformer that would create a
  // <p></p> for all raw `<p>` before an image
  visit(hast, (node, idx, parent) => {
    if (node.type !== 'raw' || node.value !== '<p>') {
      return CONTINUE;
    }
    const next = parent.children[idx + 1];
    /* c8 ignore next 3 */
    if (!next) {
      return CONTINUE;
    }
    if (next.type === 'raw' && next.value.startsWith('<img ')) {
      node.value = '<p></p>';
    }
    return CONTINUE;
  });

  return raw(hast);
}
