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
/* eslint-disable quote-props */

import assert from 'assert';
import { StaticS3Loader } from './StaticS3Loader.js';
import { PipelineState, PipelineRequest, PipelineResponse } from '../src/index.js';
import { formsPipe, extractBodyData } from '../src/forms-pipe.js';

/**
 * @implements FormsMessageDispatcher
 */
class MockDispatcher {
  // eslint-disable-next-line class-methods-use-this
  async dispatch(message) {
    assert.strictEqual(message.sourceLocation, 'foo-bar');
    return {
      requestId: 'fake-requestId',
      messageId: 'fake-message-id',
    };
  }
}

describe('Form POST Requests', () => {
  const defaultRequest = {
    method: 'post',
    headers: {
      host: 'helix-pipeline.com',
      'x-forwarded-host': 'ref--repo--owner.hlx.live',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      data: [
        { name: 'name', value: 'dracula' },
        { name: 'email', value: 'count@example.com' },
      ],
    }),
  };

  const defaultFormUrlEncodedRequest = {
    method: 'post',
    headers: {
      host: 'helix-pipeline.com',
      'x-forwarded-host': 'ref--repo--owner.hlx.live',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'firstname=bruce&lastname=banner',
  };

  const defaultContext = {
    pathInfo: {
      suffix: '/live/owner/repo/ref/somepath/workbook',
    },
    runtime: {
      name: 'aws-lambda',
    },
    env: {
      AWS_ACCESS_KEY_ID: 'fake',
      AWS_SECRET_ACCESS_KEY: 'fake',
      AWS_REGION: 'us-east-1',
    },
    log: console,
  };

  const defaultState = () => (/** @type PipelineOptions */ {
    owner: 'owner',
    repo: 'repo',
    ref: 'ref',
    partition: 'live',
    path: '/somepath/workbook',
    contentBusId: 'foobus',
    log: console,
    messageDispatcher: new MockDispatcher(),
    s3Loader: new StaticS3Loader()
      .reply(
        'helix-content-bus',
        'foobus/live/somepath/workbook.json',
        new PipelineResponse('', {
          headers: {
            'x-amz-meta-x-source-location': 'foo-bar',
            'x-amz-meta-x-sheet-names': 'helix-default,incoming',
          },
        }),
      ),
  });

  it('successful POST Request w/Body', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 201);
  });

  it('successful POST Request w/Body and Custom Headers', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.s3Loader.reply(
      'helix-content-bus',
      'foobus/live/metadata.json',
      new PipelineResponse(JSON.stringify({
        data: [
          { 'url': '/**', 'access-control-allow-origin': '*' },
          { 'url': '/**', 'content-security-policy': "default-src 'self'" },
        ],
      })),
    );

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 201);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-security-policy': 'default-src \'self\'',
      'x-request-id': 'fake-requestId',
      'x-message-id': 'fake-message-id',
      'content-type': 'text/plain; charset=utf-8',
    });
  });

  it('successful POST Request w/form-urlencoded', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultFormUrlEncodedRequest);
    const state = new PipelineState(defaultState());

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 201);
  });

  it('target workbook is not setup to intake data.', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.s3Loader
      .reply(
        'helix-content-bus',
        'foobus/live/somepath/workbook.json',
        new PipelineResponse('', {
          headers: {
            'x-amz-meta-x-source-location': 'foo-bar',
            'x-amz-meta-x-sheet-names': 'helix-default',
          },
        }),
      )
      .reply(
        'helix-content-bus',
        'foobus/live/metadata.json',
        new PipelineResponse(JSON.stringify({
          data: [
            { 'url': '/**', 'access-control-allow-origin': '*' },
            { 'url': '/**', 'content-security-policy': "default-src 'self'" },
          ],
        })),
      );

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 403);
    assert.deepStrictEqual(Object.fromEntries(resp.headers.entries()), {
      'access-control-allow-origin': '*',
      'content-security-policy': 'default-src \'self\'',
      'content-type': 'text/plain; charset=utf-8',
      'x-error': 'Target workbook at /somepath/workbook.json is not setup to intake data.',
    });
  });

  it('target workbook in content bus missing x-sheet-names header.', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.s3Loader
      .reply(
        'helix-content-bus',
        'foobus/live/somepath/workbook.json',
        new PipelineResponse('', {
          headers: {
            'x-source-location': 'foo-bar',
          },
        }),
      );
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 403);
  });

  it('target workbook does not exist.', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.s3Loader = new StaticS3Loader();
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 404);
  });

  it('s3 fetch error', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.s3Loader
      .reply(
        'helix-content-bus',
        'foobus/live/somepath/workbook.json',
        new PipelineResponse('', {
          status: 503,
        }),
      );
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 503);
  });

  it('failed dispatch, SQS throws', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState(defaultState());
    state.messageDispatcher.dispatch = () => {
      throw new Error('kaputt');
    };

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 500);
  });

  it('POST request with extensions', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', defaultRequest);
    const state = new PipelineState({
      owner: 'owner',
      repo: 'repo',
      ref: 'ref',
      partition: 'live',
      path: '/somepath/workbook.json',
      contentBusId: 'foobus',
      log: console,
      s3Loader: new StaticS3Loader(),
    });

    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 405);
  });

  it('no post body', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', { ...defaultRequest, body: undefined });
    const state = new PipelineState(defaultState());
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 400);
  });

  it('no data object in post body', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', { ...defaultRequest, body: { data: undefined } });
    const state = new PipelineState(defaultState());
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 400);
  });

  it('invalid data in post body', async () => {
    const req = new PipelineRequest('https://helix-pipeline.com/', { ...defaultFormUrlEncodedRequest, body: '[object Object]' });
    const state = new PipelineState(defaultState());
    const resp = await formsPipe(state, req);
    assert.strictEqual(resp.status, 400);
  });

  describe('extractBodyData', () => {
    const validBody = {
      data: {
        foo: 'bar',
      },
    };

    it('valid json body', async () => {
      const res = await extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultRequest, body: JSON.stringify(validBody) }), defaultContext);
      assert.deepStrictEqual(res, validBody);
    });

    it('valid urlencoded body', async () => {
      const res = await extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', defaultFormUrlEncodedRequest), defaultContext);
      assert.deepStrictEqual(res, {
        data: {
          firstname: 'bruce',
          lastname: 'banner',
        },
      });
    });

    it('valid urlencoded body, duplicate keys', async () => {
      const body = 'foo=bar&foo=zoo&firstname=bruce&lastname=banner';

      const res = await extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultFormUrlEncodedRequest, body }), defaultContext);
      assert.deepStrictEqual(res, {
        data: {
          foo: ['bar', 'zoo'],
          firstname: 'bruce',
          lastname: 'banner',
        },
      });
    });

    it('invalid json body', async () => {
      const body = 'foobar';
      const res = extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultRequest, body }), defaultContext);
      await assert.rejects(res, new SyntaxError('Unexpected token o in JSON at position 1'));
    });

    it('empty json body', async () => {
      const body = '{}';
      const res = extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultRequest, body }), defaultContext);
      await assert.rejects(res, new Error('missing body.data'));
    });

    it('unsupported type', async () => {
      const body = '<foo></foo>';
      const res = extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultRequest, body, headers: { 'content-type': 'application/xml' } }), defaultContext);
      await assert.rejects(res, new Error('post body content-type not supported: application/xml'));
    });

    it('invalid urlencoded body, sent json instead', async () => {
      const body = '[object Object]';
      const res = extractBodyData(new PipelineRequest('https://helix-pipeline.com/?contentBusId=foobus', { ...defaultFormUrlEncodedRequest, body }), defaultContext);
      await assert.rejects(res, new Error('invalid form-urlencoded body'));
    });
  });
});
