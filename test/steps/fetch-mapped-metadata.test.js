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
import { PipelineStatusError } from '../../src/index.js';
import { StaticS3Loader } from '../StaticS3Loader.js';
import fetchMappedMetadata from '../../src/steps/fetch-mapped-metadata.js';
import { FileS3Loader } from '../FileS3Loader.js';

describe('Fetch Mapped Metadata', () => {
  it('parses KV sheet', async () => {
    const state = {
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      mapped: true,
      info: {
        path: '/mapped',
      },
      s3Loader: new FileS3Loader()
        .rewrite('foo-id/live/mapped/metadata.json', 'metadata-kv.json'),
    };
    await fetchMappedMetadata(state);
    assert.deepEqual(state.mappedMetadata.getModifiers('/new/foo'), {
      description: 'Lorem ipsum dolor sit amet.',
      keywords: 'ACME, CORP, PR',
      title: 'ACME CORP',
    });
  });

  it('throws error on invalid json', async () => {
    const promise = fetchMappedMetadata({
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      mapped: true,
      info: {
        path: '/mapped',
      },
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/mapped/metadata.json', {
          status: 200,
          body: 'this is no json!',
          headers: new Map(),
        }),
    });
    await assert.rejects(
      promise,
      new PipelineStatusError(500, 'failed parsing of /mapped/metadata.json: Unexpected token h in JSON at position 1'),
    );
  });

  it('throws error on metadata with no data array', async () => {
    const promise = fetchMappedMetadata({
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      mapped: true,
      info: {
        path: '/mapped',
      },
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/mapped/metadata.json', {
          status: 200,
          body: '{}',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(500, 'failed loading of /mapped/metadata.json: data must be an array'));
  });

  it('throws error on generic error', async () => {
    const promise = fetchMappedMetadata({
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      mapped: true,
      info: {
        path: '/mapped',
      },
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/mapped/metadata.json', {
          status: 500,
          body: '',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(502, 'failed to load /mapped/metadata.json: 500'));
  });
});
