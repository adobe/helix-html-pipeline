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
 * Records the last modified for the given source.
 *
 * @param {PipelineState} state
 * @param {PipelineResponse} res the pipeline context
 * @param {string} source the source providing a last-modified date
 * @param {string} httpDate http-date string
 */
export function recordLastModified(state, res, source, httpDate) {
  if (!httpDate) {
    return;
  }
  const { log } = state;
  const date = new Date(httpDate);
  if (Number.isNaN(date.valueOf())) {
    log.warn(`last-modified date is invalid: ${httpDate} for ${source}`);
    return;
  }
  res.lastModifiedSources[source] = {
    time: date.valueOf(),
    date: date.toUTCString(),
  };
}

/**
 * Calculates the last modified by using the latest date from all the recorded sources
 * and sets it on the `last-modified` header.
 *
 * @param {PipelineState} state
 * @param {PipelineResponse} res the pipeline context
 */
export function setLastModified(state, res) {
  let latestTime = 0;
  for (const { time, date } of Object.values(res.lastModifiedSources)) {
    if (time > latestTime) {
      latestTime = time;
      res.headers.set('last-modified', date);
    }
  }
}

/**
 * Returns the last modified date from response headers, giving 'x-amz-meta-x-source-last-modified'
 * preference.
 * @param {Map<string, string>} headers
 * @return {string} the last modified date
 */
export function extractLastModified(headers) {
  let lastModified = headers.get('x-amz-meta-x-source-last-modified');
  if (lastModified && lastModified !== 'null') {
    return lastModified;
  }
  lastModified = headers.get('x-amz-meta-last-modified');
  if (lastModified && lastModified !== 'null') {
    return lastModified;
  }
  return headers.get('last-modified');
}
