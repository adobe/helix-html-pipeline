/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { FileS3Loader } from './FileS3Loader.js';
import {
  robotsPipe, PipelineRequest, PipelineState,
} from '../src/index.js';

const DEFAULT_CONFIG = {
  contentBusId: 'foobar',
  owner: 'owner',
  repo: 'repo',
};

const DEFAULT_STATE = (opts = {}) => (new PipelineState({
  config: DEFAULT_CONFIG,
  site: 'site',
  org: 'org',
  ref: 'ref',
  partition: 'live',
  s3Loader: new FileS3Loader(),
  ...opts,
}));

describe('Robots Pipe Test', () => {
  it('responds with 500 for non robots', async () => {
    const resp = await robotsPipe(
      DEFAULT_STATE(),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'x-error': 'invalid route',
    });
  });

  it('responds with 500 for code-bus errors', async () => {
    const resp = await robotsPipe(
      DEFAULT_STATE({
        s3Loader: new FileS3Loader().status('robots.txt', 500),
        path: '/robots.txt',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'failed to load /robots.txt from code-bus: 500',
    });
  });

  it('renders robots from a configured robots entry', async () => {
    const resp = await robotsPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          robots: {
            txt: 'this is my robots.txt',
          },
        },
        s3Loader: new FileS3Loader()
          .status('robots.txt', 404),
        path: '/robots.txt',
        partition: 'live',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      vary: 'x-forwarded-host',
      'x-surrogate-key': 'U_NW4adJU7Qazf-I ref--repo--owner_robots.txt ZcR1sjWODctSccZh',
    });
    assert.strictEqual(resp.body, 'this is my robots.txt');
  });

  it('renders robots from live with prod CDN', async () => {
    const resp = await robotsPipe(
      DEFAULT_STATE({
        config: {
          ...DEFAULT_CONFIG,
          cdn: {
            prod: {
              host: 'www.adobe.com',
            },
          },
        },
        s3Loader: new FileS3Loader()
          .status('robots.txt', 404),
        path: '/robots.txt',
        partition: 'live',
        timer: { update: () => {} },
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      vary: 'x-forwarded-host',
      'x-surrogate-key': 'U_NW4adJU7Qazf-I ref--repo--owner_robots.txt ZcR1sjWODctSccZh',
    });
    assert.strictEqual(resp.body, `User-Agent: *
Allow: /

Sitemap: https://www.adobe.com/sitemap.xml`);
  });

  it('handles pipeline errors', async () => {
    const resp = await robotsPipe(
      DEFAULT_STATE({
        path: '/robots.txt',
        timer: {
          update: () => {
            throw new Error('boom!');
          },
        },
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );

    assert.strictEqual(resp.status, 500);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'boom!',
    });
    assert.strictEqual(resp.body, '');
  });
});
