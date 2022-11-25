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
import { Modifiers } from '../../src/utils/modifiers.js';
import { PipelineRequest, PipelineResponse, PipelineState } from '../../src/index.js';
import setCustomResponseHeaders from '../../src/steps/set-custom-response-headers.js';

const TEST_HEADERS = {
  '/news/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: '*',
    },
    {
      key: 'access-control-request-method',
      value: 'DELETE',
    },
  ],
  '/spa/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: 'https://www.adobe.com, https://localhost:3000',
    },
  ],
  '/special/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: '/https://[a-z]+.adobe.com/',
    },
  ],
  '/ugly/**': [
    {
      key: 'x-very-long',
      value: '0123456789abcdef'.repeat(1024 * 5), // 80k,
    },
    {
      key: 'x-very-special',
      value: 'おはいおう\n(good morning)',
    },
  ],
  '/blog/**': [
    {
      key: 'Access-Control-Allow-Origin',
      value: 'https://www.adobe.com',
    },
    {
      key: 'x-foo-bar',
      value: '86400',
    },
    {
      key: 'access-control-request-method',
      value: 'PUT',
    },
  ],
  '/**': [
    {
      key: 'Link',
      value: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    },
  ],
};

const DEFAULT_STATE = (path = '/') => {
  const state = new PipelineState({
    log: console,
    owner: 'owner',
    repo: 'repo',
    ref: 'ref',
    path,
  });
  state.headers = new Modifiers(TEST_HEADERS);
  return state;
};

describe('Set custom response headers', () => {
  it('sets custom response header with link', () => {
    const state = DEFAULT_STATE();
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost');
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('does not set link header on .plain', () => {
    const state = DEFAULT_STATE('/index.plain.html');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost');
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {});
  });

  it('does not set link header on non html', () => {
    const state = DEFAULT_STATE('/foo.json');
    state.type = 'json';
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost');
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {});
  });

  it('truncates long values at 64k and sanitizes invalid chars', () => {
    const state = DEFAULT_STATE('/ugly/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        origin: 'https://blog.example.com',
      },
    });
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'x-very-long': '0123456789abcdef'.repeat(1024 * 4),
      'x-very-special': '(good morning)',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });
});

describe('Set access-control-allow-origin header', () => {
  it('sets the access-control-origin to *', () => {
    const state = DEFAULT_STATE('/news/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost');
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'access-control-allow-origin': '*',
      'access-control-request-method': 'DELETE',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('sets the access-control-origin to a static host', () => {
    const state = DEFAULT_STATE('/blog/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost');
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'access-control-allow-origin': 'https://www.adobe.com',
      'access-control-request-method': 'PUT',
      'x-foo-bar': '86400',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('sets the access-control-origin to the origin that matches', () => {
    const state = DEFAULT_STATE('/spa/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        origin: 'https://localhost:3000',
      },
    });
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'access-control-allow-origin': 'https://localhost:3000',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('sets the access-control-origin to the origin that matches the regexp', () => {
    const state = DEFAULT_STATE('/special/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        origin: 'https://blog.adobe.com',
      },
    });
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      'access-control-allow-origin': 'https://blog.adobe.com',
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });

  it('omits the access-control-origin if no match', () => {
    const state = DEFAULT_STATE('/special/');
    const res = new PipelineResponse();
    const req = new PipelineRequest('https://localhost', {
      headers: {
        origin: 'https://blog.example.com',
      },
    });
    setCustomResponseHeaders(state, req, res);
    assert.deepStrictEqual(Object.fromEntries(res.headers.entries()), {
      link: '</scripts/scripts.js>; rel=modulepreload; as=script; crossorigin=use-credentials',
    });
  });
});
