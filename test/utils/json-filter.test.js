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
import { readFile } from 'fs/promises';
import path from 'path';
import jsonFilter from '../../src/utils/json-filter.js';

function createTestData(size) {
  const data = [];
  for (let i = 0; i < size; i += 1) {
    const row = {};
    data.push(row);
    for (let j = 0; j < 10; j += 1) {
      row[`col${j}`] = `cell(${i},${j})`;
    }
  }
  return data;
}

describe('JSON Filter test', () => {
  const DEFAULT_CONTEXT = {
    log: console,
  };

  let TEST_DATA;
  let TEST_SINGLE_SHEET;
  let TEST_MULTI_SHEET;
  let TEST_MULTI_SHEET_DEFAULT;

  before(async () => {
    TEST_DATA = JSON.parse(await readFile(path.resolve(__testdir, 'fixtures', 'json', 'test-data.json'), 'utf-8'));
    TEST_SINGLE_SHEET = {
      offset: 0,
      limit: TEST_DATA.length,
      total: TEST_DATA.length,
      data: TEST_DATA,
    };

    TEST_MULTI_SHEET = {
      ':names': ['sheet1', 'sheet2'],
      sheet1: TEST_SINGLE_SHEET,
      sheet2: TEST_SINGLE_SHEET,
    };

    TEST_MULTI_SHEET_DEFAULT = {
      ':names': ['sheet1', 'default'],
      sheet1: TEST_SINGLE_SHEET,
      default: TEST_SINGLE_SHEET,
    };
  });

  it('returns same response for single sheet with no query', async () => {
    const resp = jsonFilter(DEFAULT_CONTEXT, JSON.stringify(TEST_SINGLE_SHEET), {});
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      offset: 0,
      limit: TEST_DATA.length,
      total: TEST_DATA.length,
      data: TEST_DATA,
      ':type': 'sheet',
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('returns the default sheet', async () => {
    const resp = jsonFilter(DEFAULT_CONTEXT, JSON.stringify(TEST_MULTI_SHEET_DEFAULT), {});
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      offset: 0,
      limit: TEST_DATA.length,
      total: TEST_DATA.length,
      data: TEST_DATA,
      ':type': 'sheet',
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('returns plain json in raw mode', async () => {
    const resp = jsonFilter(DEFAULT_CONTEXT, JSON.stringify({
      version: 123,
      message: 'hello, world',
    }), { raw: true });
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      version: 123,
      message: 'hello, world',
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('returns broken json in raw mode', async () => {
    const resp = jsonFilter(DEFAULT_CONTEXT, 'hello, world', { raw: true });
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(resp.body, 'hello, world');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain',
    });
  });

  it('filters response for single sheet with offset and limit', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_SINGLE_SHEET),
      { limit: 10, offset: 5 },
    );
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
    });
  });

  it('filters response for single sheet with offset and limit near the end', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_SINGLE_SHEET),
      { limit: 20, offset: TEST_DATA.length - 5 },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: TEST_DATA.length - 5,
      limit: 5,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(TEST_DATA.length - 5),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('filters response for single sheet with offset', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_SINGLE_SHEET),
      { offset: 5 },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 5,
      limit: TEST_DATA.length - 5,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(5),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('filters response for single sheet with limit', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_SINGLE_SHEET),
      { limit: 5 },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      offset: 0,
      limit: 5,
      total: TEST_DATA.length,
      data: TEST_DATA.slice(0, 5),
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('filter multiple sheets with limit and offset', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_MULTI_SHEET),
      { limit: 10, offset: 5, sheet: [] },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'multi-sheet',
      ':version': 3,
      ':names': ['sheet1', 'sheet2'],
      sheet1: {
        offset: 5,
        limit: 10,
        total: TEST_DATA.length,
        data: TEST_DATA.slice(5, 15),
      },
      sheet2: {
        offset: 5,
        limit: 10,
        total: TEST_DATA.length,
        data: TEST_DATA.slice(5, 15),
      },
    });
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'application/json',
    });
  });

  it('filter by sheet', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_MULTI_SHEET),
      { limit: 10, offset: 5, sheet: 'sheet1' },
    );
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
    });
  });

  it('filter by unknown sheet returns 404', async () => {
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify(TEST_MULTI_SHEET),
      { sheet: 'foo' },
    );
    assert.strictEqual(resp.status, 404);
    assert.strictEqual(resp.headers.get('x-error'), 'filtered result does not contain selected sheet(s): foo');
  });

  it('truncates result if too large for action response', async () => {
    const TEST_LARGE_DATA = createTestData(10000);
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify({
        ':names': ['default'],
        default: {
          data: TEST_LARGE_DATA,
          offset: 0,
          limit: 10000,
          total: 10000,
        },
      }),
      {},
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      data: TEST_LARGE_DATA.slice(0, 1000),
      limit: 1000,
      offset: 0,
      total: 10000,
    });
  });

  it('truncates multisheet result if too large for action response', async () => {
    const DATA1 = createTestData(10000);
    const DATA2 = createTestData(10000);

    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify({
        ':names': ['foo', 'bar'],
        foo: {
          data: DATA1,
          offset: 0,
          limit: 10000,
          total: 10000,
        },
        bar: {
          data: DATA2,
          offset: 0,
          limit: 10000,
          total: 10000,
        },
      }),
      {
        sheet: ['foo', 'bar'],
        offset: 4000,
      },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':names': [
        'foo',
        'bar',
      ],
      ':type': 'multi-sheet',
      ':version': 3,
      foo: {
        data: createTestData(5000).slice(4000),
        limit: 1000,
        offset: 4000,
        total: 10000,
      },
      bar: {
        data: createTestData(5000).slice(4000),
        limit: 1000,
        offset: 4000,
        total: 10000,
      },
    });
  });

  it('dev can force large limit', async () => {
    const TEST_LARGE_DATA = createTestData(10000);
    const resp = jsonFilter(
      DEFAULT_CONTEXT,
      JSON.stringify({
        ':names': ['default'],
        default: {
          data: TEST_LARGE_DATA,
          offset: 0,
          limit: 10000,
          total: 10000,
        },
      }),
      {
        limit: 5000,
      },
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(await resp.json(), {
      ':type': 'sheet',
      data: TEST_LARGE_DATA.slice(0, 5000),
      limit: 5000,
      offset: 0,
      total: 10000,
    });
  });
});
