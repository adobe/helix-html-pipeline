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
 * Response of a pipeline
 * @class PipelineResponse
 */
export class PipelineResponse {
  /**
   * Creates the pipeline response
   */
  constructor(body = undefined, init = {}) {
    let headers = init.headers ?? new Map([['content-type', 'text/html; charset=utf-8']]);
    if (typeof headers.get !== 'function') {
      headers = new Map(Object.entries(init.headers));
    }

    Object.assign(this, {
      status: init.status ?? 200,
      body,
      document: undefined,
      headers,
      error: undefined,
      lastModifiedTime: 0,
    });
  }

  /**
   * Returns the json parsed object of `this.body`.
   * @returns {object}
   */
  json() {
    return JSON.parse(this.body);
  }
}
