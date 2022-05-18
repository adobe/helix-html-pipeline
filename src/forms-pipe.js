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
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { PipelineResponse } from './PipelineResponse.js';
import fetchMetadata from './steps/fetch-metadata.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { getOriginalHost } from './steps/utils.js';

function error(log, msg, status, response) {
  log.error(msg);
  response.status = status;
  response.headers.set('x-error', cleanupHeaderValue(msg));
  return response;
}

/**
 * Converts URLSearchParams to an object
 * @param {URLSearchParams} searchParams the search params object
 * @returns {Object} The converted object
 */
function searchParamsToObject(searchParams) {
  const result = {};

  for (const key of searchParams.keys()) {
    // get all values association with the key
    const values = searchParams.getAll(key);

    // if multiple values, convert to array
    result[key] = (values.length === 1) ? values[0] : values;
  }

  return result;
}

/**
 * Extracts and parses the body data from the request
 * @param {PipelineRequest} request the request object (see fetch api)
 * @returns {Object} The body data
 * @throws {Error} If an error occurs parsing the body
 */
export async function extractBodyData(request) {
  let { body } = request;
  if (!body) {
    throw Error('missing body');
  }
  const type = request.headers.get('content-type');

  // if content is form-urlencoded we need place the object in the body
  // in a "data" property in the body as this is what forms-service expects.
  if (/^application\/x-www-form-urlencoded/.test(type)) {
    // did they pass an object in the body when a form-urlencoded body was expected?
    if (body === '[object Object]') {
      throw Error('invalid form-urlencoded body');
    }

    body = {
      data: searchParamsToObject(new URLSearchParams(body)),
    };

    // else treat the body as json
  } else if (/^application\/json/.test(type)) {
    body = JSON.parse(body);
    // verify the body data is as expected
    if (!body.data) {
      throw Error('missing body.data');
    }
  } else {
    throw Error(`post body content-type not supported: ${type}`);
  }
  return body;
}

/**
 * Handle a pipeline POST request.
 * At this point POST's only apply to json files that are backed by a workbook.
 * @param {PipelineState} state pipeline options
 * @param {PipelineRequest} request
 * @returns {Promise<PipelineResponse>} a response
 */
export async function formsPipe(state, request) {
  const { log } = state;
  state.type = 'form';

  // todo: improve
  const response = new PipelineResponse('', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
  await fetchMetadata(state, request, response);
  await setCustomResponseHeaders(state, request, response);

  const {
    owner, repo, ref, contentBusId, partition, s3Loader,
  } = state;
  const { path } = state.info;
  const resourcePath = `${path}.json`;

  // block all POSTs to resources with extensions
  if (state.info.originalExtension !== '') {
    return error(log, 'POST to URL with extension not allowed', 405, response);
  }

  // head workbook in content bus
  const resourceFetchResponse = await s3Loader.headObject('helix-content-bus', `${contentBusId}/${partition}${resourcePath}`);
  if (resourceFetchResponse.status !== 200) {
    return resourceFetchResponse;
  }

  let body;
  try {
    body = await extractBodyData(request);
  } catch (err) {
    return error(log, err.message, 400, response);
  }

  const sheets = resourceFetchResponse.headers.get('x-amz-meta-x-sheet-names');
  if (!sheets) {
    return error(log, `Target workbook at ${resourcePath} missing x-sheet-names header.`, 403, response);
  }

  const sourceLocation = resourceFetchResponse.headers.get('x-amz-meta-x-source-location');
  const referer = request.headers.get('referer') || 'unknown';
  const sheetNames = sheets.split(',');

  if (!sourceLocation || !sheetNames.includes('incoming')) {
    return error(log, `Target workbook at ${resourcePath} is not setup to intake data.`, 403, response);
  }

  // Send message to SQS if workbook contains and incoming
  // sheet and the source location is not null
  const host = getOriginalHost(request.headers);

  // Forms service expect owner and repo in the message body
  body.owner = owner;
  body.repo = repo;

  const message = {
    url: `https://${ref}--${repo}--${owner}.hlx.live${resourcePath}`,
    body,
    host,
    sourceLocation,
    referer,
  };

  try {
    // Send message to forms queue
    const { requestId, messageId } = await state.messageDispatcher.dispatch(message);
    response.status = 201;
    response.headers.set('x-request-id', requestId);
    response.headers.set('x-message-id', messageId);
    return response;
  } catch (err) {
    return error(log, `Failed to send message to forms queue: ${err}`, 500, response);
  }
}
