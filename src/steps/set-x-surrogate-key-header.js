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
import { computeSurrogateKey } from '@adobe/helix-shared-utils';

/**
 * Returns the surrogate key based on the contentBusId and the resource path
 * @param state
 * @returns {Promise<string>}
 */
export async function getPathKey(state) {
  const { contentBusId, info } = state;
  let { path } = info;
  // surrogate key for path
  // strip [index].plain.html
  if (path.endsWith('index.plain.html')) {
    path = path.substring(0, path.length - 'index.plain.html'.length);
  } else if (path.endsWith('.plain.html')) {
    path = path.substring(0, path.length - '.plain.html'.length);
  }
  // strip .md
  if (path.endsWith('.md')) {
    path = path.substring(0, path.length - '.md'.length);
  }
  return computeSurrogateKey(`${contentBusId}${path}`);
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function setXSurrogateKeyHeader(state, req, res) {
  const {
    contentBusId, owner, repo, ref,
  } = state;
  const hash = await getPathKey(state);
  const keys = [
    hash,
    `${contentBusId}_metadata`,
    `${ref}--${repo}--${owner}_head`,
  ];

  // for folder-mapped resources, we also need to include the surrogate key of the mapped metadata
  if (state.mapped) {
    keys.push(`${hash}_metadata`);
  }

  res.headers.set('x-surrogate-key', keys.join(' '));
}
