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
import { selectAll, select } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { remove } from 'unist-util-remove';
import { toMetaName } from '../utils/modifiers.js';
import { toBlockCSSClassNames } from './utils.js';

/**
 * Checks whether section metadata processing is enabled for the current site.
 * It is enabled if the feature flag is explicitly set, or if the site was created
 * after May 1, 2026.
 * @param {PipelineSiteConfig} config
 * @returns {boolean}
 */
function isSectionMetadataEnabled(config) {
  if (config?.features?.rendering?.version === 2) {
    return true;
  }
  const createdAt = config?.created;
  if (createdAt && new Date(createdAt) >= new Date('2026-05-01')) {
    return true;
  }
  return false;
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

  const sections = selectAll(':has(> div.section-metadata)', hast);
  for (const section of sections) {
    const block = select(':scope > div.section-metadata', section);

    selectAll(':scope>div', block).forEach(($row) => {
      if (!$row?.children[1]) {
        return;
      }
      const [$name, $value] = $row.children;
      const name = toMetaName(toString($name));
      if (!name) {
        return;
      }
      const value = toString($value).trim();

      if (name === 'style') {
        if (!section.properties.className) {
          section.properties.className = [];
        }
        section.properties.className.push(...toBlockCSSClassNames(value));
      } else {
        section.properties[`data-${name}`] = value;
      }
    });

    remove(hast, { cascade: false }, block);
  }
}
