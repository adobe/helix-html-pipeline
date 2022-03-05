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

import assert from 'assert';
import { updateLastModified } from '../../src/utils/last-modified.js';

describe('Last Modified Utils Test', () => {
  /** @type PipelineState */
  const state = { log: console };

  it('sets the last modified if missing', async () => {
    /** @type PipelineResponse */
    const res = { headers: {} };
    updateLastModified(state, res, 'Wed, 12 Jan 2022 09:33:01 GMT');
    assert.strictEqual(res.headers['last-modified'], 'Wed, 12 Jan 2022 09:33:01 GMT');
  });

  it('sets the last modified if newer', async () => {
    /** @type PipelineResponse */
    const res = { headers: {} };
    updateLastModified(state, res, 'Wed, 12 Jan 2022 09:33:01 GMT');
    updateLastModified(state, res, 'Wed, 12 Jan 2022 14:33:01 GMT');
    updateLastModified(state, res, 'Wed, 12 Jan 2022 19:33:01 GMT');
    assert.strictEqual(res.headers['last-modified'], 'Wed, 12 Jan 2022 19:33:01 GMT');
  });

  it('ignores the last modified if older', async () => {
    /** @type PipelineResponse */
    const res = { headers: {} };
    updateLastModified(state, res, 'Wed, 12 Jan 2022 09:33:01 GMT');
    updateLastModified(state, res, 'Wed, 12 Jan 2022 08:33:01 GMT');
    updateLastModified(state, res, 'Wed, 12 Jan 2022 07:33:01 GMT');
    assert.strictEqual(res.headers['last-modified'], 'Wed, 12 Jan 2022 09:33:01 GMT');
  });

  it('ignores invalid last modified', async () => {
    /** @type PipelineResponse */
    const res = { headers: {} };
    updateLastModified(state, res, 'Wed, 12 Jan 2022 09:33:01 GMT');
    updateLastModified(state, res, 'Hello, world.');
    assert.strictEqual(res.headers['last-modified'], 'Wed, 12 Jan 2022 09:33:01 GMT');
  });

  it('ignores undefined last modified', async () => {
    /** @type PipelineResponse */
    const res = { headers: {} };
    updateLastModified(state, res, 'Wed, 12 Jan 2022 09:33:01 GMT');
    updateLastModified(state, res, undefined);
    assert.strictEqual(res.headers['last-modified'], 'Wed, 12 Jan 2022 09:33:01 GMT');
  });
});
