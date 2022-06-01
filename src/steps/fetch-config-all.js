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

import { PipelineStatusError } from '../PipelineStatusError.js';
import { extractLastModified, updateLastModified } from '../utils/last-modified.js';
import { globToRegExp, Modifiers } from '../utils/modifiers.js';
import { getOriginalHost } from './utils.js';

/**
 * Array of headers allowed in the metadata.json file.
 */
export const ALLOWED_RESPONSE_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'link',
];

/**
 * Loads the metadata.json from the content-bus and stores it in `state.metadata` and
 * `state.headers` in modifier form.
 * this is to be backward compatible and can be removed in the future.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
async function fetchMetadata(state, req, res) {
  const { contentBusId, partition } = state;
  const key = `${contentBusId}/${partition}/metadata.json`;
  const ret = await state.s3Loader.getObject('helix-content-bus', key);
  if (ret.status === 200) {
    let json;
    try {
      json = JSON.parse(ret.body);
    } catch (e) {
      throw new PipelineStatusError(400, `failed parsing of /metadata.json: ${e.message}`);
    }

    const { data } = json.default ?? json;
    if (!Array.isArray(data)) {
      throw new PipelineStatusError(400, 'failed loading of /metadata.json: data must be an array');
    }

    state.metadata = Modifiers.fromModifierSheet(
      data,
      (name) => !ALLOWED_RESPONSE_HEADERS.includes(name),
    );
    state.headers = Modifiers.fromModifierSheet(
      data,
      (name) => ALLOWED_RESPONSE_HEADERS.includes(name),
    );

    if (state.type === 'html' && state.info.selector !== 'plain') {
      // also update last-modified (only for extensionless html pipeline)
      updateLastModified(state, res, extractLastModified(ret.headers));
    }
    return;
  }

  if (ret.status !== 404) {
    throw new PipelineStatusError(502, `failed to load /metadata.json: ${ret.status}`);
  }

  // ignore 404
}

/**
 * Computes the routes from the given config value.
 * @param {string|string[]|undefined} value
 * @return {RegExp[]} and array of regexps for route matching
 */
export function computeRoutes(value) {
  if (!value) {
    return [/.*/];
  }
  // eslint-disable-next-line no-param-reassign
  return (Array.isArray(value) ? value : [value]).map((route) => {
    if (route.indexOf('*') >= 0) {
      return globToRegExp(route);
    }
    if (route.endsWith('/')) {
      return new RegExp(`^${route}.*$`);
    }
    return new RegExp(`^${route}(/.*)?$`);
  });
}

/**
 * Loads the /.helix/config-all.json from the content-bus and stores it in the state. if no
 * such config exists, it will load the metadata.json as fallback and separate out the
 * `state.headers` and `state.metadata`.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function fetchConfigAll(state, req, res) {
  const { contentBusId, partition } = state;
  const key = `${contentBusId}/${partition}/.helix/config-all.json`;
  const ret = await state.s3Loader.getObject('helix-content-bus', key);
  if (ret.status === 200) {
    let json;
    try {
      json = JSON.parse(ret.body);
    } catch (e) {
      throw new PipelineStatusError(400, `failed parsing of /.helix/config-all.json: ${e.message}`);
    }
    state.config = json.config?.data || {};
    state.metadata = new Modifiers(json.metadata?.data || {});
    state.headers = new Modifiers(json.headers?.data || {});

    if (state.type === 'html' && state.info.selector !== 'plain') {
      // also update last-modified (only for extensionless html pipeline)
      updateLastModified(state, res, extractLastModified(ret.headers));
    }
  } else if (ret.status !== 404) {
    throw new PipelineStatusError(502, `failed to load /.helix/config-all.json: ${ret.status}`);
  } else {
    // fallback to old metadata loading
    await fetchMetadata(state, req, res);
  }

  // compute host and routes
  if (!state.config.host) {
    state.config.host = state.config.cdn?.prod?.host || getOriginalHost(req.headers);
  }
  state.config.routes = computeRoutes(state.config.cdn?.prod?.route);
}
