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
import { IDSlugger } from '../../src/utils/id-slugger.js';

describe('IDSlugger Test', () => {
  it('generates correct ids', () => {
    const s = new IDSlugger();

    assert.strictEqual(s.slug('hello, world'), 'hello-world');
    assert.strictEqual(s.slug('hello. world'), 'hello-world-1');
    assert.strictEqual(s.slug('hello-world-1'), 'hello-world-1-1');

    assert.strictEqual(s.slug('1. Goals'), 'goals');
    assert.strictEqual(s.slug('2. Goals'), 'goals-1');
  });
});
