/*
 * Copyright 2018 Adobe. All rights reserved.
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
import assert from 'assert';
import { PipelineStatusError } from '../../src/PipelineStatusError.js';
import fetchConfig from '../../src/steps/fetch-config.js';
import { StaticS3Loader } from '../StaticS3Loader.js';
import { PipelineRequest, PipelineResponse } from '../../src/index.js';

describe('Fetch Config', () => {
  it('updates last modified', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            fstab: {},
            head: {},
          }),
          headers: new Map(Object.entries({
            'last-modified': 'Wed, 12 Jan 2022 09:33:01 GMT',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(state.helixConfig, {
      fstab: {
        data: {},
      },
      head: {
        data: {},
      },
    });
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'last-modified': 'Wed, 12 Jan 2022 09:33:01 GMT',
    });
  });

  it('updates individual fstab last modified for version 2', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            version: 2,
            fstab: {
              lastModified: 'Wed, 12 Jan 2022 09:33:01 GMT',
            },
          }),
          headers: new Map(Object.entries({
            'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'last-modified': 'Wed, 12 Jan 2022 09:33:01 GMT',
    });
  });

  it('sets the contentbus id if only present in header', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            version: 2,
          }),
          headers: new Map(Object.entries({
            'x-contentbus-id': '/=foobar-id',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(state.helixConfig, {
      version: 2,
      content: {
        data: {
          '/': {
            contentBusId: 'foobar-id',
          },
        },
      },
    });
  });

  it('updates individual fstab last modified for version 2 (missing)', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      type: 'json',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            version: 2,
            fstab: {
              data: {},
            },
            head: {
              lastModified: 'Wed, 16 Jan 2022 09:33:01 GMT',
            },
          }),
          headers: new Map(Object.entries({
            'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
    });
  });

  it('updates individual head last modified for version 2', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      type: 'html',
      info: {},
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            version: 2,
            fstab: {
              data: {},
            },
            head: {
              lastModified: 'Wed, 16 Jan 2022 09:33:01 GMT',
            },
          }),
          headers: new Map(Object.entries({
            'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'last-modified': 'Wed, 16 Jan 2022 09:33:01 GMT',
    });
  });

  it('ignores individual head last modified for version 2 for plain', async () => {
    const state = {
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      type: 'html',
      info: {
        selector: 'plain',
      },
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: JSON.stringify({
            version: 2,
            fstab: {
              data: {},
            },
            head: {
              lastModified: 'Wed, 16 Jan 2022 09:33:01 GMT',
            },
          }),
          headers: new Map(Object.entries({
            'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
          })),
        }),
    };
    const req = new PipelineRequest('https://localhost:3000');
    const res = new PipelineResponse();
    await fetchConfig(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'last-modified': 'Wed, 14 Jan 2022 09:33:01 GMT',
    });
  });

  it('throws error on invalid json', async () => {
    const promise = fetchConfig({
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 200,
          body: 'this is no json!',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(400, 'Failed parsing of /helix-config.json: Unexpected token h in JSON at position 1'));
  });

  it('throws error on generic error', async () => {
    const promise = fetchConfig({
      log: console,
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      s3Loader: new StaticS3Loader()
        .reply('helix-code-bus', 'owner/repo/ref/helix-config.json', {
          status: 500,
          body: '',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(502, 'unable to load /helix-config.json: 500'));
  });
});
