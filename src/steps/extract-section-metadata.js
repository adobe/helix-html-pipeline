/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { toString } from 'hast-util-to-string';
import { CONTINUE, SKIP, visit } from 'unist-util-visit';
import { toMetaName } from '../utils/modifiers.js';
import { getAbsoluteUrl, toBlockCSSClassNames } from './utils.js';

/**
 * Checks whether section metadata processing is enabled for the current site.
 * It is enabled if the rendering version is >= 2, or if no version is set
 * and the site was created on or after May 1, 2026.
 * @param {PipelineSiteConfig} config
 * @returns {boolean}
 */
function isSectionMetadataEnabled(config) {
  const { version } = config.features?.rendering ?? {};
  if (version !== undefined) {
    return version >= 2;
  }
  return new Date(config.created) >= new Date('2026-05-01');
}

/**
 * Extracts a value from a HAST node by collecting image srcs, link hrefs,
 * and text tokens (split by comma/whitespace).
 * @param {PipelineState} state
 * @param {object} $value the HAST value node
 * @returns {string} the extracted value
 */
function getValueFromNode(state, $value) {
  const items = [];
  visit($value, (node) => {
    if (node.tagName === 'img' && node.properties?.src) {
      const { src } = node.properties;
      items.push(src.startsWith('https://') ? src : getAbsoluteUrl(state, src));
      return SKIP;
    }
    if (node.tagName === 'a' && node.properties?.href) {
      const { href } = node.properties;
      items.push(href.startsWith('https://') ? href : getAbsoluteUrl(state, href));
      return SKIP;
    }
    if (node.type === 'text') {
      items.push(...node.value.trim().split(/[,\s]+/).filter(Boolean));
    }
    return CONTINUE;
  });
  return items.join(',');
}

/**
 * Processes section metadata blocks by applying their key/value pairs
 * as data attributes on the parent section div, with special handling
 * for the "style" key (added as class names).
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function extractSectionMetadata(state) {
  if (!isSectionMetadataEnabled(state.config)) {
    return;
  }

  const { hast } = state.content;

  const isSectionMetadata = (node) => node.tagName === 'div'
    && node.properties?.className?.includes('section-metadata');

  visit(hast, isSectionMetadata, (node, index, parent) => {
    // extract metadata from rows
    for (const $row of node.children) {
      if ($row.tagName === 'div' && $row.children?.[1]) {
        const [$name, $value] = $row.children;
        const name = toMetaName(toString($name));
        if (name) {
          const value = getValueFromNode(state, $value);
          if (name === 'style') {
            if (!parent.properties.className) {
              parent.properties.className = [];
            }
            parent.properties.className.push(
              ...value.split(/[,\s]+/).filter(Boolean).flatMap(toBlockCSSClassNames),
            );
          } else {
            parent.properties[`data-${name}`] = value;
          }
        }
      }
    }

    // remove the section-metadata block from the section
    parent.children.splice(index, 1);
    return SKIP;
  });
}
