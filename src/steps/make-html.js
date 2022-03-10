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
import mdast2hast from '../utils/mdast-to-hast.js';

/**
 * Converts the markdown to a jsdom dom and stores it in `content.document`
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function html(state) {
  const { content } = state;
  const { mdast } = content;
  content.hast = mdast2hast(mdast);
}
