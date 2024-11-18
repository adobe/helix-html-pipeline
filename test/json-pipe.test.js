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
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import assert from 'assert';
import {
  jsonPipe, PipelineState, PipelineRequest, PipelineResponse,
} from '../src/index.js';
import { StaticS3Loader } from './StaticS3Loader.js';
import { getPathInfo } from '../src/utils/path.js';
import { FileS3Loader } from './FileS3Loader.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
};

const CONFIG_WITH_FOLDER = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
  folders: {
    '/super/mapped/index.json': '/en/index.json',
  },
};

const CONFIG_WITH_HEADERS = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
  headers: {
    '/**': [
      { key: 'access-control-allow-origin', value: '*' },
      { key: 'content-security-policy', value: "default-src 'self'" },
      { key: 'link', value: 'should not appear in json' },
    ],
  },
};

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'preview',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('JSON Pipe Test', () => {
  let TEST_DATA;
  let TEST_SINGLE_SHEET;
  let TEST_MULTI_SHEET;

  before(async () => {
    TEST_DATA = JSON.parse(await readFile(resolve(__testdir, 'fixtures', 'json', 'test-data.json'), 'utf-8'));
    TEST_SINGLE_SHEET = JSON.stringify({
      offset: 0,
      limit: TEST_DATA.length,
      total: TEST_DATA.length,
      data: TEST_DATA,
    });
    TEST_MULTI_SHEET = (names = ['foo', 'bar']) => JSON.stringify(
      {
        ...Object.fromEntries(
          names.map((name) => ([name, {
            offset: 0,
            limit: TEST_DATA.length,
            total: TEST_DATA.length,
            data: TEST_DATA,
          }])),
        ),
        ':names': names,
        ':type': 'multi-sheet',
        ':version': 3,
      },
    );
  });

  function createDefaultState(config = DEFAULT_CONFIG, path = '/en/index.json') {
    return new PipelineState({
      path,
      org: 'org',
      site: 'site',
      ref: 'ref',
      partition: 'preview',
      config,
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-content-bus',
          'foobar/preview/en/index.json',
          new PipelineResponse(TEST_SINGLE_SHEET, {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        )
        .reply(
          'helix-content-bus',
          'foobar/live/en/index.json',
          new PipelineResponse(TEST_SINGLE_SHEET, {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
      timer: {
        update: () => {},
      },
    });
  }

  it('sends 400 for non json path', async () => {
    const state = DEFAULT_STATE({
      path: '/blog/article',
    });
    const result = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.headers.get('x-error'), 'only json resources supported.');
  });

  it('fetches correct content', async () => {
    const state = createDefaultState();
    let resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
    });
    // live (code coverage)
    state.partition = 'live';
    resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'x-surrogate-key': 'Atrz_qDg26DmSe9a foobar',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
    });
  });

  it('sends 404 for missing /config.json', async () => {
    const state = createDefaultState(DEFAULT_CONFIG, '/config.json');
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 404);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'failed to load /config.json: 404',
      'x-surrogate-key': 'U_NW4adJU7Qazf-I pzrU-nNKQOUYNTEf ref--repo--owner_code p_kz8SoCaNqfp4ohQo p_foobar',
    });
  });

  it('sends public config for /config.json', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      public: {
        test: 'property',
        colors: ['a', 'b', 'c'],
      },
    };
    const state = createDefaultState(config, '/config.json');
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'x-surrogate-key': 'U_NW4adJU7Qazf-I pzrU-nNKQOUYNTEf ref--repo--owner_code p_kz8SoCaNqfp4ohQo p_foobar',
    });
    assert.deepStrictEqual(await resp.json(), {
      public: {
        colors: [
          'a',
          'b',
          'c',
        ],
        test: 'property',
      },
    });
  });

  it('fetches correct content with folder mapping', async () => {
    const state = createDefaultState(CONFIG_WITH_FOLDER);
    state.info = getPathInfo('/super/mapped/index.json');
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
    });
  });

  it('fetches correct content w/Headers', async () => {
    const state = createDefaultState(CONFIG_WITH_HEADERS);
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    const headers = Object.fromEntries(resp.headers.entries());
    assert.deepStrictEqual(headers, {
      'access-control-allow-origin': '*',
      'content-security-policy': 'default-src \'self\'',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
      'content-type': 'application/json',
    });
  });

  it('applies custom header also to errors', async () => {
    const state = createDefaultState(CONFIG_WITH_HEADERS);
    state.s3Loader.reply('helix-content-bus', 'foobar/preview/en/index.json', null);
    const resp = await jsonPipe(state, new PipelineRequest('https://not-found.json'));
    assert.strictEqual(resp.status, 404);
    const headers = Object.fromEntries(resp.headers.entries());
    assert.deepStrictEqual(headers, {
      'access-control-allow-origin': '*',
      'content-security-policy': 'default-src \'self\'',
      'x-error': 'failed to load /en/index.json: 404',
      'x-surrogate-key': 'SIMSxecp2CJXqGYs ref--repo--owner_code p_Atrz_qDg26DmSe9a p_foobar',
    });
  });

  it('respects redirects', async () => {
    const state = createDefaultState();
    state.s3Loader.reply(
      'helix-content-bus',
      'foobar/preview/en/index.json',
      new PipelineResponse(TEST_SINGLE_SHEET, {
        headers: {
          'content-type': 'application/json',
          'x-amz-meta-redirect-location': '/de/index.json',
        },
      }),
    )
      .reply(
        'helix-content-bus',
        'foobar/live/en/index.json',
        new PipelineResponse(TEST_SINGLE_SHEET, {
          headers: {
            'content-type': 'application/json',
            'x-amz-meta-redirect-location': '/de/index.json',
          },
        }),
      );
    let resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 301);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'location': '/de/index.json',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
    });
    // live (code coverage)
    state.partition = 'live';
    resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 301);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'location': '/de/index.json',
      'x-surrogate-key': 'Atrz_qDg26DmSe9a foobar',
    });
  });

  it('respects redirects (code)', async () => {
    const state = createDefaultState();
    state.s3Loader
      .reply(
        'helix-code-bus',
        'owner/repo/ref/en/index.json',
        new PipelineResponse(TEST_SINGLE_SHEET, {
          headers: {
            'content-type': 'application/json',
            'x-amz-meta-redirect-location': '/de/index.json',
          },
        }),
      )
      .reply('helix-content-bus', 'foobar/preview/en/index.json', null);
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 301);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'location': '/de/index.json',
      'x-surrogate-key': 'ref--repo--owner_code SIMSxecp2CJXqGYs',
    });
  });

  it('ignores last modified from metadata.json even if newer', async () => {
    const state = createDefaultState();
    state.s3Loader.reply(
      'helix-content-bus',
      'foobar/preview/metadata.json',
      new PipelineResponse(JSON.stringify({
        data: [
        ],
      }), {
        headers: {
          'last-modified': 'Wed, 15 Oct 2009 17:50:00 GMT',
        },
      }),
    );
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    const headers = Object.fromEntries(resp.headers.entries());
    assert.deepStrictEqual(headers, {
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
      'content-type': 'application/json',
    });
  });

  it('prefers x-source-last-modified', async () => {
    const state = createDefaultState();
    state.s3Loader.reply(
      'helix-content-bus',
      'foobar/preview/en/index.json',
      new PipelineResponse(TEST_SINGLE_SHEET, {
        headers: {
          'content-type': 'application/json',
          'x-amz-meta-x-source-location': 'foo-bar',
          'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
          'x-amz-meta-x-source-last-modified': 'Wed, 12 Oct 2009 15:50:00 GMT',
        },
      }),
    );

    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    const headers = Object.fromEntries(resp.headers.entries());
    assert.deepStrictEqual(headers, {
      'last-modified': 'Mon, 12 Oct 2009 15:50:00 GMT',
      'x-surrogate-key': 'p_Atrz_qDg26DmSe9a p_foobar',
      'content-type': 'application/json',
    });
  });

  it('falls back to code bus if content is not found', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      ref: 'ref',
      partition: 'preview',
      config: DEFAULT_CONFIG,
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new PipelineResponse(TEST_SINGLE_SHEET, {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10&offset=5'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: 10,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5, 15),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
      'x-surrogate-key': 'SIMSxecp2CJXqGYs ref--repo--owner_code',
    });
  });

  it('serves non table-json from code bus', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      ref: 'ref',
      partition: 'preview',
      config: DEFAULT_CONFIG,
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new PipelineResponse(JSON.stringify({
            version: 123,
            message: 'hello, world',
          }), {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      version: 123,
      message: 'hello, world',
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
      'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
      'x-surrogate-key': 'SIMSxecp2CJXqGYs ref--repo--owner_code',
    });
  });

  it('handles error from content', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      ref: 'ref',
      partition: 'preview',
      config: DEFAULT_CONFIG,
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/en/index.json', new PipelineResponse('', {
          status: 404,
        })),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(resp.status, 404);
  });

  it('handles error from code', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      ref: 'ref',
      config: DEFAULT_CONFIG,
      partition: 'preview',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/en/index.json', new PipelineResponse('', {
          status: 404,
        }))
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new PipelineResponse('', {
            status: 500,
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(resp.status, 502);
  });

  it('handles wrong branch error from content', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      config: DEFAULT_CONFIG,
      ref: 'ref',
      partition: 'preview',
      s3Loader: new StaticS3Loader(),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(resp.status, 404);
  });

  it('handles internal error', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      config: DEFAULT_CONFIG,
      ref: 'ref',
      partition: 'preview',
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new Error('boom!'),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/'));
    assert.strictEqual(resp.status, 500);
  });

  it('handles error from filter (code)', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      config: DEFAULT_CONFIG,
      ref: 'ref',
      partition: 'preview',
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new PipelineResponse(JSON.stringify({
            version: 123,
            message: 'hello, world',
          }), {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=5'));
    assert.strictEqual(resp.status, 400);
    assert.strictEqual(resp.headers.get('x-error'), 'multisheet data invalid. missing ":names" property.');
  });

  it('handles error from filter (content)', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      config: DEFAULT_CONFIG,
      ref: 'ref',
      partition: 'preview',
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-content-bus',
          'foobar/preview/en/index.json',
          new PipelineResponse(JSON.stringify({
            version: 123,
            message: 'hello, world',
          }), {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=5'));
    assert.strictEqual(resp.status, 502);
    assert.strictEqual(resp.headers.get('x-error'), 'multisheet data invalid. missing ":names" property.');
  });

  it('creates correct filter with no offset', async () => {
    const state = createDefaultState();
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=10'));
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.json().limit, 10);
    assert.strictEqual(resp.json().offset, 0);
  });

  it('creates correct filter with no limit', async () => {
    const state = createDefaultState();
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?offset=10'));
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.json().limit, 40);
    assert.strictEqual(resp.json().offset, 10);
  });

  it('creates correct filter with multiple sheets', async () => {
    const state = createDefaultState();
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?sheet=sheet1&sheet=sheet2'));
    assert.strictEqual(resp.status, 404);
  });

  it('creates correct filter with single sheet', async () => {
    const state = createDefaultState();
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?sheet=default'));
    assert.strictEqual(resp.status, 200);
  });

  it('handles corrupt json', async () => {
    const state = DEFAULT_STATE({
      path: '/en/index.json',
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      partition: 'preview',
      config: DEFAULT_CONFIG,
      s3Loader: new StaticS3Loader()
        .reply(
          'helix-code-bus',
          'owner/repo/ref/en/index.json',
          new PipelineResponse('this is no json', {
            headers: {
              'content-type': 'application/json',
              'x-amz-meta-x-source-location': 'foo-bar',
              'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
            },
          }),
        ),
    });
    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?limit=5'));
    assert.strictEqual(resp.status, 502);
    assert.strictEqual(resp.headers.get('x-error'), 'failed to parse json: Unexpected token \'h\', "this is no json" is not valid JSON');
  });

  it('serves multi-sheet data for multi-sheet query', async () => {
    const state = createDefaultState();
    state.s3Loader.reply(
      'helix-content-bus',
      'foobar/preview/en/index.json',
      new PipelineResponse(TEST_MULTI_SHEET(), {
        headers: {
          'content-type': 'application/json',
          'x-amz-meta-x-source-location': 'foo-bar',
          'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
        },
      }),
    );

    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?sheet=foo&sheet=bar'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'multi-sheet',
      ':version': 3,
      ':names': ['foo', 'bar'],
      foo: {
        offset: 0,
        limit: TEST_DATA.length,
        total: TEST_DATA.length,
        data: TEST_DATA,
      },
      bar: {
        offset: 0,
        limit: TEST_DATA.length,
        total: TEST_DATA.length,
        data: TEST_DATA,
      },
    });
  });

  it('serves multi-sheet data for multi-sheet query, when only 1 sheet exists', async () => {
    const state = createDefaultState();
    state.s3Loader.reply(
      'helix-content-bus',
      'foobar/preview/en/index.json',
      new PipelineResponse(TEST_MULTI_SHEET(['foo']), {
        headers: {
          'content-type': 'application/json',
          'x-amz-meta-x-source-location': 'foo-bar',
          'last-modified': 'Mon, 12 Oct 2009 17:50:00 GMT',
        },
      }),
    );

    const resp = await jsonPipe(state, new PipelineRequest('https://json-filter.com/?sheet=foo&sheet=bar'));
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'multi-sheet',
      ':version': 3,
      ':names': ['foo'],
      foo: {
        offset: 0,
        limit: TEST_DATA.length,
        total: TEST_DATA.length,
        data: TEST_DATA,
      },
    });
  });
});
