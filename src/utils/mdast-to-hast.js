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
import { mdast2hastGridTableHandler, TYPE_TABLE } from '@adobe/helix-markdown-support/gridtable';

import section from './section-handler.js';
import heading from './heading-handler.js';

/**
 * Turns the MDAST into a HAST structure
 * @param {Node} mdast mdast tree
 * @param {GithubSlugger} slugger github slugger for the heading ids
 * @returns {Root} the HAST document
 */
export default function getHast(mdast, slugger) {
  const hast = mdast2hast(mdast, {
    handlers: {
      ...defaultHandlers,
      section: section(),
      heading: heading(slugger),
      [TYPE_TABLE]: mdast2hastGridTableHandler(),
    },
    allowDangerousHtml: true,
  });

  return raw(hast);
}
