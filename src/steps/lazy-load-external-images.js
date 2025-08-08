/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { visit } from 'unist-util-visit';

function isExternalImage(node) {
  return node.tagName === 'img' && node.properties?.src && !node.properties?.src.startsWith('./media_');
}

/**
 * Adds loading="lazy" to external images
 * @type PipelineStep
 * @param context The current context of processing pipeline
 */
export default async function lazyLoadExternalImages({ content }) {
  const { hast } = content;

  visit(hast, isExternalImage, (img) => {
    const { loading } = img.properties;
    if (!loading) {
      img.properties.loading = 'lazy';
    }
  });
}
