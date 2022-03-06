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
import esmock from 'esmock';
import { FileS3Loader } from './FileS3Loader.js';

describe('Index Tests', () => {
  it('responds with 500 for pipeline errors', async () => {
    const proxyMain = await esmock('../src/index.js', {
      '../src/steps/fetch-config.js': () => {
        throw Error('kaputt');
      },
    });

    const resp = await proxyMain({
      url: new URL('https://www.hlx.live/'),
      headers: {
        host: 'www.hlx.live',
      },
    }, {
      s3Loader: new FileS3Loader(),
    });
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers['x-error'], 'kaputt');
  });
});
