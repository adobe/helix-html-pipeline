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
import path from 'path';
import assert from 'assert';
import { readFile } from 'fs/promises';
import { removePosition } from 'unist-util-remove-position';

export async function assertMatchDir(dir, name, cb) {
  const expected = JSON.parse(await readFile(path.resolve(__testdir, 'fixtures', dir, `${name}.json`), 'utf-8'));

  const md = await readFile(path.resolve(__testdir, 'fixtures', dir, `${name}.md`), 'utf-8');
  const actual = await cb(md);

  return assert.deepEqual(actual, removePosition(expected, true));
}

export async function assertMatch(name, cb) {
  await assertMatchDir('mdasts', name, cb);
}
