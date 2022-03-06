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

describe('Fetch Config', () => {
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
          headers: {},
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
          headers: {},
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(502, 'unable to load /helix-config.json: 500'));
  });
});
