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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { PipelineResponse } from '../PipelineResponse.js';

const TYPE_KEY = ':type';

const VERSION_KEY = ':version';

const NAMES_KEY = ':names';

/**
 * Creates a json response from the given data and query
 * @param {PipelineState} state
 * @param {object} data
 * @param {object} query
 * @returns {PipelineResponse}
 */
export default function jsonFilter(state, data, query) {
  const {
    limit = 1000,
    offset = 0,
    sheet = [],
    raw,
  } = query;
  const { log } = state;

  function filter(dataStruct) {
    const len = Math.min(limit, dataStruct.data.length - offset);
    const filtered = dataStruct.data.slice(offset, offset + len);
    return {
      total: dataStruct.total,
      offset,
      limit: filtered.length,
      data: filtered,
    };
  }

  let json;
  try {
    state.timer?.update('json-parse');
    json = JSON.parse(data);
  } catch (e) {
    const msg = `failed to parse json: ${e.message}`;
    if (raw) {
      log.warn(msg);
      return new PipelineResponse(data, {
        headers: {
          'content-type': 'text/plain',
        },
      });
    }

    log.error(msg);
    return new PipelineResponse('', {
      status: 502,
      headers: {
        'x-error': cleanupHeaderValue(msg),
      },
    });
  }

  // when raw request, only handle multisheets.
  if (raw && !(NAMES_KEY in json)) {
    return new PipelineResponse(data, {
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  // if single sheet, convert it to multisheet
  if (Array.isArray(json.data)) {
    json = {
      [NAMES_KEY]: ['default'],
      default: json,
    };
  }

  if (!json[NAMES_KEY]) {
    const msg = 'multisheet data invalid. missing ":names" property.';
    log.error(msg);
    return new PipelineResponse('', {
      status: 502,
      headers: {
        'x-error': cleanupHeaderValue(msg),
      },
    });
  }

  state.timer?.update('json-filter');
  const requestedSheets = Array.isArray(sheet) ? sheet : [sheet];
  if (requestedSheets.length === 0 && 'default' in json) {
    requestedSheets.push('default');
  }
  const sheetNames = [];
  const sheets = {};
  json[NAMES_KEY]
    .filter((name) => requestedSheets.indexOf(name) >= 0 || requestedSheets.length === 0)
    .forEach((name) => {
      sheets[name] = filter(json[name]);
      sheetNames.push(name);
    });
  if (sheetNames.length === 0) {
    const msg = `filtered result does not contain selected sheet(s): ${requestedSheets.join(',')}`;
    log.info(msg);
    return new PipelineResponse('', {
      status: 404,
      headers: {
        'x-error': cleanupHeaderValue(msg),
      },
    });
  }

  let body;
  let type = 'sheet';
  if (sheetNames.length === 1) {
    body = sheets[sheetNames[0]];
  } else {
    type = 'multi-sheet';
    body = {
      ...sheets,
      [VERSION_KEY]: 3,
      [NAMES_KEY]: sheetNames,
    };
  }
  body[TYPE_KEY] = type;
  state.timer?.update('json-stringify');
  return new PipelineResponse(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
  });
}
