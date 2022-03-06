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
import fetchContent from '../../src/steps/fetch-content.js';
import { StaticS3Loader } from '../StaticS3Loader.js';

describe('Fetch Content', () => {
  it('throws error on generic error', async () => {
    /** @type PipelineState */
    const state = {
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      info: {
        resourcePath: '/index.md',
      },
      content: {},
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/index.md', {
          status: 500,
          body: '',
          headers: new Map(),
        }),
    };
    /** @type PipelineResponse */
    const res = {};

    await fetchContent(state, {}, res);
    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.error, 'failed to load undefined from undefined-bus: 500');
  });
});
