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
import { toString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';

/**
 * Adds missing `id` attributes to the headings
 * @type PipelineStep
 * @param {PipelineContent } content The current context of processing pipeline
 */
export default async function fixSections({ content }) {
  const { slugger, hast } = content;
  visit(hast, (node) => {
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
      const { properties } = node;
      if (!properties.id) {
        const text = toString(node).trim();
        if (text) {
          properties.id = slugger.slug(text);
        }
      }
    }
  });
}
