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
import stringify from '../../src/steps/stringify-response.js';

describe('Testing stringify pipeline step', () => {
  /** @type PipelineState */
  const state = { log: console };

  it('response body takes precedence over document can be transformed', () => {
    /** @type PipelineResponse */
    const response = {
      body: 'foobar',
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, 'foobar');
  });

  it('throws error if neither body or document is present in the response', () => {
    assert.throws(() => stringify(state, undefined, {}), Error('no response document'));
  });

  it('throws error if document is not serializable', () => {
    assert.throws(() => stringify(state, undefined, {
      document: {},
    }), Error('Expected node, not `[object Object]`'));
  });
});
