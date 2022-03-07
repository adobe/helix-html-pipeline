/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Request of a pipeline
 * @class PipelineRequest
 */
export class PipelineRequest {
  /**
   * Creates the pipeline request
   * @param {URL|string} url
   * @param {PipelineRequestInit} [init]
   */
  constructor(url, init = {}) {
    let headers = init.headers ?? new Map();
    if (typeof headers.get !== 'function') {
      headers = new Map(Object.entries(init.headers));
    }

    Object.assign(this, {
      url: url instanceof URL ? url : new URL(url),
      method: init.method ?? 'GET',
      body: init.body,
      headers,
    });
  }
}
