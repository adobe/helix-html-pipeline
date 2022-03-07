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
import { JSDOM } from 'jsdom';
import stringify from '../../src/steps/stringify-response.js';

describe('Testing stringify pipeline step', () => {
  /** @type PipelineState */
  const state = { log: console };

  it('document can be transformed', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body>bar</body></html>');
    dom.window.document.serialize = dom.serialize.bind(dom);
    /** @type PipelineResponse */
    const response = {
      document: dom.window.document,
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, '<html><head><title>Foo</title></head><body>bar</body></html>');
  });

  it('document without serialize function can be transformed', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body>bar</body></html>');
    /** @type PipelineResponse */
    const response = {
      document: dom.window.document,
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, '<html><head><title>Foo</title></head><body>bar</body></html>');
  });

  it('document with doctype can be transformed', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Foo</title></head><body>bar</body></html>');
    /** @type PipelineResponse */
    const response = {
      document: dom.window.document,
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, '<!DOCTYPE html><html><head><title>Foo</title></head><body>bar</body></html>');
  });

  it('document body can be transformed', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body>bar</body></html>');
    /** @type PipelineResponse */
    const response = {
      document: dom.window.document.body,
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, 'bar');
  });

  it('response body takes precedence over document can be transformed', () => {
    const dom = new JSDOM('<html><head><title>Foo</title></head><body>bar</body></html>');
    dom.window.document.serialize = dom.serialize.bind(dom);
    /** @type PipelineResponse */
    const response = {
      body: 'foobar',
      document: dom.window.document,
    };
    stringify(state, undefined, response);
    assert.strictEqual(response.body, 'foobar');
  });

  it('throws error if neither body or document is present in the response', () => {
    assert.throws(() => stringify(state, undefined, {}), Error('no response document'));
  });

  it('throws error if document is not serializable', () => {
    assert.throws(() => stringify(state, undefined, {
      document: {},
    }), Error('unexpected context.response.document: [object Object]'));
  });
});
