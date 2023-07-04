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

/* eslint-env mocha */
/* eslint-disable quote-props */

import assert from 'assert';
import { StaticS3Loader } from './StaticS3Loader.js';
import { PipelineState, PipelineRequest, PipelineResponse } from '../src/index.js';
import { optionsPipe } from '../src/options-pipe.js';

const HELIX_CONFIG_JSON = JSON.stringify({
  content: {
    '/': {
      'contentBusId': 'foobus',
    },
  },
});

describe('Preflight OPTIONS Requests', () => {
  function createRequest(headers) {
    return new PipelineRequest('https://helix-pipeline.com/', {
      method: 'options',
      headers,
    });
  }

  const defaultState = () => ({
    owner: 'owner',
    repo: 'repo',
    ref: 'ref',
    partition: 'live',
    path: '/somepath/workbook',
    log: console,
    s3Loader: new StaticS3Loader()
      .reply(
        'helix-code-bus',
        'owner/repo/ref/helix-config.json',
        new PipelineResponse(HELIX_CONFIG_JSON),
      ),
  });

  it('All allowed CORS headers', async () => {
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-content-bus',
      'foobus/live/metadata.json',
      new PipelineResponse(JSON.stringify({
        data: [
          { 'url': '/**', 'access-control-allow-origin': '*' },
          { 'url': '/**', 'content-security-policy': "default-src 'self'" },
          { 'url': '/**', 'access-control-allow-methods': 'GET, POST' },
        ],
      })),
    );

    const response = await optionsPipe(
      state,
      createRequest({
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        origin: 'https://foo.bar',
      }),
    );
    assert.strictEqual(response.status, 204);
    const headers = Object.fromEntries(response.headers.entries());
    assert.deepStrictEqual(headers, {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-origin': '*',
      'access-control-max-age': '86400',
      'content-security-policy': 'default-src \'self\'',
    });
  });

  it('sends 404 for missing helix-config', async () => {
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-code-bus',
      'owner/repo/ref/helix-config.json',
      null,
    );
    const response = await optionsPipe(
      state,
      createRequest({
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        origin: 'https://foo.bar',
      }),
    );
    assert.strictEqual(response.status, 404);
    const headers = Object.fromEntries(response.headers.entries());
    assert.deepStrictEqual(headers, {
      'cache-control': 'no-store, private, must-revalidate',
      'x-error': 'unable to load /helix-config.json: 404',
    });
  });

  it('sends 400 for missing contentbusid', async () => {
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-code-bus',
      'owner/repo/ref/helix-config.json',
      new PipelineResponse('{}'),
    );

    const response = await optionsPipe(
      state,
      createRequest({
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        origin: 'https://foo.bar',
      }),
    );
    assert.strictEqual(response.status, 400);
    const headers = Object.fromEntries(response.headers.entries());
    assert.deepStrictEqual(headers, {
      'x-error': 'contentBusId missing',
    });
  });

  it('sends 500 for internal error', async () => {
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-code-bus',
      'owner/repo/ref/helix-config.json',
      new Error('bang!'),
    );

    const response = await optionsPipe(
      state,
      createRequest({
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        origin: 'https://foo.bar',
      }),
    );
    assert.strictEqual(response.status, 500);
    const headers = Object.fromEntries(response.headers.entries());
    assert.deepStrictEqual(headers, {
      'x-error': 'bang!',
      'cache-control': 'no-store, private, must-revalidate',
    });
  });

  it('No CORS headers in metadata.xlxs', async () => {
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-content-bus',
      'foobus/live/metadata.json',
      new PipelineResponse(JSON.stringify({
        data: [],
      })),
    );

    const response = await optionsPipe(
      state,
      createRequest({
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
        origin: 'https://foo.bar',
      }),
    );
    assert.strictEqual(response.status, 204);
    const headers = Object.fromEntries(response.headers.entries());
    assert.deepStrictEqual(headers, {
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
  });
});
