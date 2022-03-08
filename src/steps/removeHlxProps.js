/*
 * Copyright 2019 Adobe. All rights reserved.
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

/**
 * Cleans the response document by removing `hlx-` stuff
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 */
export default function clean(state, req, res) {
  const { document } = res;
  selectAll('[class]', document).forEach(({ properties }) => {
    properties.className = properties.className.filter((name) => !name.startsWith('hlx-'));
    if (properties.className.length === 0) {
      delete properties.className;
    }

    // Remove all `data-hlx-*` attributes on these elements
    Object.keys(properties)
      .filter((key) => key.startsWith('data-hlx-'))
      .forEach((key) => delete properties[key]);
  });
}
