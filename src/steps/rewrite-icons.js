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
    const tokens = [];
    let pos = 0;

    // Find URN and timestamp patterns and mark their ranges
    const skipRanges = [];

    // URN patterns
    const urnRegex = /urn:[^\s]*/g;
    let urnMatch = urnRegex.exec(text);
    while (urnMatch !== null) {
      skipRanges.push([urnMatch.index, urnMatch.index + urnMatch[0].length]);
      urnMatch = urnRegex.exec(text);
    }

    // Timestamp patterns (both real and placeholder)
    const timeRegex = /(?:\d{4}|\b[A-Z]{4})-(?:\d{2}|[A-Z]{2})-(?:\d{2}|[A-Z]{2})T(?:\d{2}|[A-Z]{2}):(?:\d{2}|[A-Z]{2}):(?:\d{2}|[A-Z]{2})/g;
    let timeMatch = timeRegex.exec(text);
    while (timeMatch !== null) {
      skipRanges.push([timeMatch.index, timeMatch.index + timeMatch[0].length]);
      timeMatch = timeRegex.exec(text);
    }

    while (pos < text.length) {
      const colonPos = text.indexOf(':', pos);
      if (colonPos === -1) {
        tokens.push({ type: 'TEXT', value: text.slice(pos) });
        break;
      }

      // Add text before the colon
      if (colonPos > pos) {
        tokens.push({ type: 'TEXT', value: text.slice(pos, colonPos) });
      }

      // Look for the closing colon
      const nextColon = text.indexOf(':', colonPos + 1);
      if (nextColon === -1) {
        tokens.push({ type: 'TEXT', value: text.slice(colonPos) });
        break;
      }

      const potentialIcon = text.slice(colonPos, nextColon + 1);
      const beforeText = text.slice(Math.max(0, colonPos - 20), colonPos);

      // Check if this colon is part of a skip range
      const isInSkipRange = skipRanges.some((range) => colonPos >= range[0]
        && nextColon <= range[1]);

      // Additional check for timestamp-like patterns
      const isTimestampPattern = /[A-Z]{2}:[A-Z]{2}/.test(potentialIcon)
        || beforeText.match(/[A-Z]{2}$/)
        || text.slice(nextColon + 1).match(/^[A-Z]{2}/);

      // Skip if this is part of a known pattern
      const skipIfFound = [
        /https?/, // URLs
        /T\d{2}/, // ISO timestamps
        /\d{4}-\d{2}/, // Dates
      ];

      const shouldSkip = isInSkipRange
        || isTimestampPattern
        || skipIfFound.some((pattern) => pattern.test(beforeText))
        || /\d$/.test(beforeText) // number before first colon
        || /^\d/.test(text[nextColon + 1]); // number after second colon

      if (shouldSkip) {
        tokens.push({ type: 'TEXT', value: potentialIcon });
      } else {
        const iconName = potentialIcon.slice(1, -1);
        if (/^[#a-z0-9][-a-z0-9]*[a-z0-9]$/.test(iconName)) {
          tokens.push({ type: 'ICON', value: iconName });
        } else {
          tokens.push({ type: 'TEXT', value: potentialIcon });
        }
      }

      pos = nextColon + 1;
    }

    // Only process if we found any icons
    if (!tokens.some((t) => t.type === 'ICON')) {
      return CONTINUE;
    }

    // Convert tokens to nodes
    const newNodes = tokens.map((token) => (
      token.type === 'ICON' ? createIcon(token.value) : { type: 'text', value: token.value }
    ));

    parent.children.splice(idx, 1, ...newNodes);
    return idx + newNodes.length;
  });
}
