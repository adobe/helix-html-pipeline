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
import { UnsecuredJWT } from 'jose';
import { FileS3Loader } from './FileS3Loader.js';
import { htmlPipe, PipelineRequest, PipelineState } from '../src/index.js';

describe('HTML Pipe Test', () => {
  it('responds with 404 for invalid path', async () => {
    const resp = await htmlPipe(
      new PipelineState({ path: '/foo.hidden.html' }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 404);
    assert.strictEqual(resp.headers.get('x-error'), 'invalid path');
  });

  it('responds with 400 for invalid xfh', async () => {
    const resp = await htmlPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader().status('config-all.json', 404),
        owner: 'adobe',
        repo: 'helix-pages',
        ref: 'super-test',
        partition: 'live',
        path: '/',
        contentBusId: 'foo-id',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/'), {
        headers: {
          // eslint-disable-next-line no-template-curly-in-string
          'x-forwarded-host': '${jndi:dns://3.238.15.214/ORTbVlfjTl}',
        },
      }),
    );
    assert.strictEqual(resp.status, 400);
    // eslint-disable-next-line no-template-curly-in-string
    assert.strictEqual(resp.headers.get('x-error'), 'invalid url: https://${jndi:dns://3.238.15.214/ORTbVlfjTl}/');
  });

  it('responds with 500 for content-bus errors', async () => {
    const resp = await htmlPipe(
      new PipelineState({
        log: console,
        s3Loader: new FileS3Loader().status('index.md', 500),
        owner: 'adobe',
        repo: 'helix-pages',
        ref: 'super-test',
        partition: 'live',
        path: '/',
        contentBusId: 'foo-id',
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 502);
    // eslint-disable-next-line no-template-curly-in-string
    assert.strictEqual(resp.headers.get('x-error'), 'failed to load /index.md from content-bus: 500');
  });

  it('responds with 500 for pipeline errors', async () => {
    /** @type htmlPipe */
    const { htmlPipe: mockPipe } = await esmock('../src/html-pipe.js', {
      '../src/steps/fetch-config.js': () => {
        throw Error('kaputt');
      },
    });

    const resp = await mockPipe(
      new PipelineState({ contentBusId: 'foo', s3Loader: new FileS3Loader() }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers.get('x-error'), 'kaputt');
  });

  it('handles /.auth route', async () => {
    const tokenState = new UnsecuredJWT({
      owner: 'owner',
      repo: 'repo',
      contentBusId: 'foo-id',
      // this is our own login redirect, i.e. the current document
      requestPath: '/en',
      requestHost: 'www.hlx.live',
    }).encode();

    const req = new PipelineRequest('https://localhost/.auth', {
      headers: new Map(Object.entries({
        'x-hlx-auth-state': tokenState,
        'x-hlx-auth-code': '1234-code',
      })),
    });

    const resp = await htmlPipe(
      new PipelineState({ path: '/.auth', contentBusId: 'foo', s3Loader: new FileS3Loader() }),
      req,
    );
    assert.strictEqual(resp.status, 302);
    assert.strictEqual(resp.headers.get('location'), `https://www.hlx.live/.auth?state=${tokenState}&code=1234-code`);
  });

  it('handles .auth partition', async () => {
    const resp = await htmlPipe(
      new PipelineState({ partition: '.auth', contentBusId: 'foo', s3Loader: new FileS3Loader() }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 401);
    assert.strictEqual(resp.headers.get('x-error'), 'missing state parameter.');
  });

  it('responds with 400 for missing contentBusId', async () => {
    const resp = await htmlPipe(
      new PipelineState({ s3Loader: new FileS3Loader() }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 400);
    assert.strictEqual(resp.headers.get('x-error'), 'contentBusId missing');
  });
});
