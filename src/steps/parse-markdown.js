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
import remarkParse from 'remark-parse';
import { removePosition } from 'unist-util-remove-position';
import { dereference, remarkGfmNoLink } from '@adobe/helix-markdown-support';
import remarkGridTable from '@adobe/remark-gridtables';

/**
 * Parses the markdown body
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function parseMarkdown(state) {
  const { content } = state;

  // convert linebreaks
  const converted = content.data.replace(/(\r\n|\n|\r)/gm, '\n');
  content.mdast = unified()
    .use(remarkParse)
    .use(remarkGfmNoLink)
    .use(remarkGridTable)
    .parse(converted);

  removePosition(content.mdast, { force: true });
  dereference(content.mdast);
}
