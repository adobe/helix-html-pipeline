/*
 * Copyright 2022 Adobe. All rights reserved.
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
import { PipelineResponse } from '../src/index.js';

describe('PipelineResponse Tests', () => {
  it('can be initialized with headers map', () => {
    const headers = new Map();
    const res = new PipelineResponse('', {
      headers,
    });
    assert.strictEqual(res.headers, headers);
  });

  it('can be initialized with headers object', () => {
    const res = new PipelineResponse('', {
      headers: {
        'content-type': 'application/json',
      },
    });
    assert.strictEqual(res.headers.get('content-type'), 'application/json');
  });
});
