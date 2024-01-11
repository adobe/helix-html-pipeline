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

const DEFAULT_CONFIG_HEADERS = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
  headers: {
    '/**': [
      { key: 'access-control-allow-origin', value: '*' },
      { key: 'content-security-policy', value: "default-src 'self'" },
      { key: 'access-control-allow-methods', value: 'GET, POST' },
    ],
  },
};

const DEFAULT_CONFIG = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
};

function createRequest(headers, url = '/') {
  return new PipelineRequest(`https://helix-pipeline.com${url}`, {
    method: 'options',
    headers,
  });
}

describe('Preflight OPTIONS Requests', () => {
  const defaultState = (config) => ({
    site: 'site',
    org: 'org',
    ref: 'ref',
    partition: 'live',
    path: '/somepath/workbook',
    log: console,
    config,
    s3Loader: new StaticS3Loader(),
  });

  it('All allowed CORS headers', async () => {
    const state = new PipelineState(defaultState(DEFAULT_CONFIG_HEADERS));
    state.s3Loader.reply(
      'helix-content-bus',
      'foobus/live/.helix/config-all.json',
      new PipelineResponse(JSON.stringify({
        headers: {
          data: {
            '/**': [
              { key: 'access-control-allow-origin', value: '*' },
              { key: 'content-security-policy', value: "default-src 'self'" },
              { key: 'access-control-allow-methods', value: 'GET, POST' },
            ],
          },
        },
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

  it('sends 500 for internal error', async () => {
    const state = new PipelineState(defaultState(DEFAULT_CONFIG_HEADERS));
    delete state.config; // this causes an error
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
      'x-error': 'Cannot read properties of undefined (reading \'metadata\')',
      'cache-control': 'no-store, private, must-revalidate',
    });
  });

  it('No CORS headers in headers', async () => {
    const state = new PipelineState(defaultState(DEFAULT_CONFIG));
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

describe('RUM Challenge OPTIONS Request', () => {
  it('sends 204 without x-rum-challenge header for normal requests', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: DEFAULT_CONFIG,
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'localhost',
      }),
    );
    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is not set
    assert.strictEqual(challenge, undefined);
  });

  it('sends 204 without x-rum-challenge header when hostnames do not match', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: {
        ...DEFAULT_CONFIG,
        domainkey: 'foo/bar/baz',
        cdn: {
          prod: {
            host: 'adobe.com',
          },
        },
      },
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
      s3Loader: new StaticS3Loader(),
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'example.com',
      }, '/_rum-challenge'),
    );

    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is unsetset
    assert.strictEqual(challenge, undefined);
  });

  it('sends 204 with x-rum-challenge header for rum-challenge requests', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: {
        ...DEFAULT_CONFIG,
        domainkey: ['foo/bar/baz'],
        cdn: {
          prod: {
            host: 'example.com',
          },
        },
      },
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
      s3Loader: new StaticS3Loader(),
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'example.com',
      }, '/_rum-challenge'),
    );

    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is set
    assert.strictEqual(challenge, '7263bf25ef81b7a406a1bea7f367d553441c420678fc74726a7a8f9f63b8d5a7');
  });

  it('sends 204 with x-rum-challenge header for rum-challenge requests wit array of domainkeys', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: {
        ...DEFAULT_CONFIG,
        domainkey: ['foo/bar/baz', 'bar/baz/foo'],
        cdn: {
          prod: {
            host: 'example.com',
          },
        },
      },
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
      s3Loader: new StaticS3Loader(),
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'example.com',
      }, '/_rum-challenge'),
    );

    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is set
    assert.strictEqual(challenge, '7263bf25ef81b7a406a1bea7f367d553441c420678fc74726a7a8f9f63b8d5a7 de6b5c08a3d9257e699400a1de13958364a34b2ccd4dd9ea204926e9740327c4');
  });

  it('sends 204 with x-rum-challenge header for rum-challenge requests, falling back to Slack if unset', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: {
        ...DEFAULT_CONFIG,
        slack: 'foo/bar/baz', // todo: still supported ?
        cdn: {
          prod: {
            host: 'example.com',
          },
        },
      },
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'example.com',
      }, '/_rum-challenge'),
    );

    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is set
    assert.strictEqual(challenge, '7263bf25ef81b7a406a1bea7f367d553441c420678fc74726a7a8f9f63b8d5a7');
  });

  it('sends 204 with x-rum-challenge header for rum-challenge requests, falling back to Slack if unset, even if multiple Slack channels have been configured', async () => {
    const state = new PipelineState({
      site: 'site',
      org: 'org',
      config: {
        ...DEFAULT_CONFIG,
        slack: ['foo/bar/baz', 'baz/bar/foo'], // todo: Still supported?
        cdn: {
          prod: {
            host: 'example.com',
          },
        },
      },
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook',
      log: console,
      s3Loader: new StaticS3Loader(),
    });

    const response = await optionsPipe(
      state,
      createRequest({
        'x-forwarded-host': 'example.com',
      }, '/_rum-challenge'),
    );

    assert.strictEqual(response.status, 204);
    const challenge = response.headers.get('x-rum-challenge');
    // assert that the challenge is set
    assert.equal(challenge.indexOf('7263bf25ef81b7a406a1bea7f367d553441c420678fc74726a7a8f9f63b8d5a7'), 0);
  });
});
