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
import { PipelineRequest, PipelineStatusError } from '../../src/index.js';
import fetchConfigAll from '../../src/steps/fetch-config-all.js';
import { StaticS3Loader } from '../StaticS3Loader.js';
import { FileS3Loader } from '../FileS3Loader.js';

describe('Fetch Config-All', () => {
  it('loads config-all', async () => {
    const state = {
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      s3Loader: new FileS3Loader(),
    };
    await fetchConfigAll(state);
    const meta = state.metadata.getModifiers('/page-metadata-json.html');
    assert.deepEqual(meta, {
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, urna eu tempor congue, nisi erat condimentum nunc, eget tincidunt nisl nunc euismod.',
      locale: 'en-US',
      title: 'ACME CORP',
      'empty-cell': '',
      'empty-string-cell': '""',
      'zero-cell': '0',
    });

    const hdrs = state.headers.getModifiers('/blog/article');
    assert.deepEqual(hdrs, {
      'access-control-allow-origin': '*',
      'access-control-max-age': '86400',
      'access-control-request-method': 'PUT',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });

    assert.deepEqual(state.config, {
      cdn: {
        prod: {
          route: '/express/',
        },
        preview: {
          host: '$ref--$repo--$owner.my.page',
        },
      },
      host: 'www.adobe.com',
      slack: 'foo/bar123',
      routes: [
        /^\/express\/.*$/,
      ],
    });
  });

  it('can handle empty json', async () => {
    const state = {
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/.helix/config-all.json', {
          status: 200,
          body: '{}',
          headers: new Map(),
        }),
    };
    await fetchConfigAll(state, new PipelineRequest('https://localhost', {
      headers: {
        'x-forwarded-host': 'localhost',
      },
    }));
    assert.deepStrictEqual(state.config, {
      host: 'localhost',
      routes: [
        /.*/,
      ],
    });
    assert.deepStrictEqual(state.metadata.modifiers, []);
    assert.deepStrictEqual(state.headers.modifiers, []);
  });

  it('computes host and routes correctly', async () => {
    const state = {
      owner: 'test-owner',
      repo: 'test-repo',
      ref: 'main',
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/.helix/config-all.json', {
          status: 200,
          body: JSON.stringify({
            config: {
              data: {
                cdn: {
                  prod: {
                    host: 'www.adobe.com',
                    route: [
                      '/express',
                      '/blog/',
                      '**/express/**',
                    ],
                  },
                  preview: {
                    host: '$ref--$repo--$owner.my.page',
                  },
                  live: {
                    host: '$ref--$repo--$owner.my.live',
                  },
                },
              },
            },
          }),
          headers: new Map(),
        }),
    };
    await fetchConfigAll(state);
    assert.deepStrictEqual(state.config, {
      host: 'www.adobe.com',
      routes: [
        /^\/express(\/.*)?$/,
        /^\/blog\/.*$/,
        /^.*\/express\/.*$/,
      ],
      cdn: {
        prod: {
          host: 'www.adobe.com',
          route: [
            '/express',
            '/blog/',
            '**/express/**',
          ],
        },
        preview: {
          host: '$ref--$repo--$owner.my.page',
        },
        live: {
          host: '$ref--$repo--$owner.my.live',
        },
      },
    });
    assert.strictEqual(state.previewHost, 'main--test-repo--test-owner.my.page');
    assert.strictEqual(state.liveHost, 'main--test-repo--test-owner.my.live');
  });

  it('throws error on invalid json', async () => {
    const promise = fetchConfigAll({
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/.helix/config-all.json', {
          status: 200,
          body: 'this is no json!',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(400, 'failed parsing of /.helix/config-all.json: Unexpected token \'h\', "this is no json!" is not valid JSON'));
  });

  it('throws error on generic error', async () => {
    const promise = fetchConfigAll({
      log: console,
      contentBusId: 'foo-id',
      partition: 'live',
      s3Loader: new StaticS3Loader()
        .reply('helix-content-bus', 'foo-id/live/.helix/config-all.json', {
          status: 500,
          body: '',
          headers: new Map(),
        }),
    });
    await assert.rejects(promise, new PipelineStatusError(502, 'failed to load /.helix/config-all.json: 500'));
  });
});
