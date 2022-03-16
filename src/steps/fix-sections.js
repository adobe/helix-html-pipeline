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
import { selectAll } from 'hast-util-select';
import { h } from 'hastscript';
import { wrapContent } from './utils.js';

/**
 * fixes the sections of a document.
 * @type PipelineStep
 * @param {PipelineContent} content
 */
export default async function fixSections({ content }) {
  const { hast } = content;
  const $sections = selectAll('div', hast);

  // if there are no sections wrap everything in a div with appropriate class names from meta
  if ($sections.length === 0) {
    const $outerDiv = h('div');
    if (content.meta && content.meta.class) {
      $outerDiv.properties.className = content.meta.class.split(/[ ,]/)
        .map((c) => c.trim())
        .filter((c) => !!c);
    }
    wrapContent($outerDiv, hast);
  }
}
