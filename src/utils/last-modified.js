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
 * Updates the context.content.lastModified if the time in `timeString` is newer than the existing
 * one if none exists yet. please note that it generates helper property `lastModifiedTime` in
 * unix epoch format.
 *
 * the date string will be a "http-date": https://httpwg.org/specs/rfc7231.html#http.date
 *
 * @param {PipelineState} state
 * @param {PipelineResponse} res the pipeline context
 * @param {string} httpDate http-date string
 */
export function updateLastModified(state, res, httpDate) {
  if (!httpDate) {
    return;
  }
  const { log } = state;
  const time = new Date(httpDate).getTime();
  if (Number.isNaN(time)) {
    log.warn(`updateLastModified date is invalid: ${httpDate}`);
    return;
  }

  if (time > (res.lastModifiedTime ?? 0)) {
    res.lastModifiedTime = time;
    res.headers.set('last-modified', httpDate);
  }
}

/**
 * Returns the last modified date from response headers, giving 'x-amz-meta-x-source-last-modified'
 * preference.
 * @param {Map<string, string>} headers
 * @return {string} the last modified date
 */
export function extractLastModified(headers) {
  const lastModified = headers.get('x-amz-meta-x-source-last-modified');
  if (lastModified && lastModified !== 'null') {
    return lastModified;
  }
  return headers.get('last-modified');
}
