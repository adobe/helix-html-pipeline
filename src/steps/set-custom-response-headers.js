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
 * Hop-by-hop headers (see https://www.freesoft.org/CIE/RFC/2068/143.htm) that should
 * be ignored as custom header.
 */
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'public',
  'proxy-authenticate',
  'content-encoding',
  'transfer-encoding',
  'upgrade',
];

function cleanupHeaderValue(value) {
  return value
    .replace(/[^\t\u0020-\u007E\u0080-\u00FF]/g, '')
    .substring(0, 1024 * 64);
}

/**
 * Computes the access-control-allow-origin header value.
 * The value can either be a single value or a comma separated list of origin names or patterns.
 * If only a single static value is given (eg `*` or `https://www.adobe.com`), it is used verbatim.
 * If multiple values are given, the one matching the origin request header is used.
 * If any of the values is a regexp, the origin request header is used, if any match is given.
 *
 * @param {PipelineRequest} req
 * @param {string} value
 * @return {string} the access-control-allow-origin header value.
 */
function getACAOriginValue(req, value) {
  /** @type string */
  const origin = req.headers.get('origin') || '*';
  const values = value.split(',')
    .map((v) => v.trim());

  if (values.length === 1 && !values[0].startsWith('/')) {
    return values[0];
  }

  for (const v of values) {
    if (v.startsWith('/') && v.endsWith('/') && new RegExp(v.substring(1, v.length - 1)).test(origin)) {
      return origin;
    }
    if (v === origin) {
      return origin;
    }
  }
  return '';
}

/**
 * Decorates the pipeline response object with the headers defined in metadata.json.
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default function setCustomResponseHeaders(state, req, res) {
  Object.entries(state.headers.getModifiers(state.info.path)).forEach(([name, value]) => {
    if (HOP_BY_HOP_HEADERS.includes(name)) {
      return;
    }
    // only use `link` header for extensionless pipeline
    if (name !== 'link' || (state.type === 'html' && state.info.selector === '')) {
      let val = cleanupHeaderValue(value);
      if (name === 'access-control-allow-origin') {
        val = getACAOriginValue(req, val);
      }
      if (val) {
        res.headers.set(name, val);
      }
    }
  });
}
