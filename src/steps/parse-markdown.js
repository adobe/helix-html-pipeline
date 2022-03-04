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
import { unified } from 'unified';
import remark from 'remark-parse';
import { visit } from 'unist-util-visit';
import { remarkMatter } from '@adobe/helix-markdown-support';
import remarkGfm from '../utils/remark-gfm-nolink.js';

export class FrontmatterParsingError extends Error {
}

export function removePositions(tree) {
  visit(tree, (node) => {
    delete node.position;
  });
  return tree;
}

/**
 * Parses the markdown body
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function parseMarkdown(state) {
  const { log, content } = state;

  // convert linebreaks
  const converted = content.data.replace(/(\r\n|\n|\r)/gm, '\n');
  const idx = Math.min(converted.indexOf('\n'), 100);
  log.debug(`Parsing markdown from request body starting with ${converted.substring(0, idx)}`);

  content.mdast = unified()
    .use(remark)
    .use(remarkGfm)
    .use(remarkMatter, {
      errorHandler: (e) => {
        log.warn(new FrontmatterParsingError(e));
      },
    })
    .parse(converted);

  removePositions(content.mdast);
}
