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
import {
  PipelineRequest,
  PipelineResponse,
  PipelineState,
} from '../../src/index.js';
import initConfig from '../../src/steps/init-config.js';

describe('Init Config', () => {
  it('computes host and routes correctly', async () => {
    const state = new PipelineState({
      ref: 'main',
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      config: {
        owner: 'test-owner',
        repo: 'test-repo',
        cdn: {
          prod: {
            host: 'www.adobe.com',
          },
          preview: {
            host: '$ref--$repo--$owner.my.page',
          },
          live: {
            host: '$ref--$repo--$owner.my.live',
          },
        },
      },
    });
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.previewHost, 'main--test-repo--test-owner.my.page');
    assert.strictEqual(state.liveHost, 'main--test-repo--test-owner.my.live');
    assert.strictEqual(state.prodHost, 'www.adobe.com');
  });
});
