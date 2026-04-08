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
import {
  PipelineRequest,
  PipelineResponse,
  PipelineState,
} from '../../src/index.js';
import initConfig from '../../src/steps/init-config.js';

describe('Init Config', () => {
  it('computes host and routes correctly', async () => {
    const state = new PipelineState({
      ref: 'main',
      log: console,
      partition: 'live',
      org: 'org',
      site: 'site',
      config: {
        contentBusId: 'foo-id',
        owner: 'test-owner',
        repo: 'test-repo',
        cdn: {
          prod: {
            host: 'www.adobe.com',
          },
          preview: {
            host: '$ref--$repo--$owner.my.page',
          },
          live: {
            host: '$ref--$site--$org.my.live',
          },
        },
      },
    });
    const req = new PipelineRequest('https://localhost');
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.previewHost, 'main--test-repo--test-owner.my.page');
    assert.strictEqual(state.liveHost, 'main--site--org.my.live');
    assert.strictEqual(state.prodHost, 'www.adobe.com');
  });

  it('logs a warning when cdn.prod.host is absent and x-forwarded-host is present', async () => {
    const warnings = [];
    const state = new PipelineState({
      ref: 'main',
      log: { ...console, warn: (msg) => warnings.push(msg) },
      partition: 'live',
      org: 'myorg',
      site: 'mysite',
      config: { contentBusId: 'foo-id', owner: 'myowner', repo: 'myrepo' },
    });
    const req = new PipelineRequest('https://localhost', {
      headers: { 'x-forwarded-host': 'www.example.com, main--website--example.aem.live' },
    });
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.prodHost, 'www.example.com');
    assert.ok(warnings.length > 0, 'expected a warning to be logged');
    assert.strictEqual(warnings[0], '[myorg/mysite] cdn.prod.host is not configured, falling back to x-forwarded-host: www.example.com');
  });

  it('does not log a warning when cdn.prod.host is configured', async () => {
    const warnings = [];
    const state = new PipelineState({
      ref: 'main',
      log: { ...console, warn: (msg) => warnings.push(msg) },
      partition: 'live',
      org: 'myorg',
      site: 'mysite',
      config: {
        contentBusId: 'foo-id',
        owner: 'myowner',
        repo: 'myrepo',
        cdn: { prod: { host: 'www.adobe.com' } },
      },
    });
    const req = new PipelineRequest('https://localhost', {
      headers: { 'x-forwarded-host': 'www.example.com' },
    });
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.prodHost, 'www.adobe.com');
    assert.strictEqual(warnings.length, 0, 'expected no warnings');
  });

  it('does not log a warning when cdn.prod.host is absent but x-forwarded-host is also absent', async () => {
    const warnings = [];
    const state = new PipelineState({
      ref: 'main',
      log: { ...console, warn: (msg) => warnings.push(msg) },
      partition: 'live',
      org: 'myorg',
      site: 'mysite',
      config: { contentBusId: 'foo-id', owner: 'myowner', repo: 'myrepo' },
    });
    const req = new PipelineRequest('https://localhost', {
      headers: { host: 'www.example.com' },
    });
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.prodHost, 'www.example.com');
    assert.strictEqual(warnings.length, 0, 'expected no warnings');
  });

  it('does not log a warning when cdn.prod.host is absent but x-forwarded-host is aem.live', async () => {
    const warnings = [];
    const state = new PipelineState({
      ref: 'main',
      log: { ...console, warn: (msg) => warnings.push(msg) },
      partition: 'live',
      org: 'myorg',
      site: 'mysite',
      config: { contentBusId: 'foo-id', owner: 'myowner', repo: 'myrepo' },
    });
    const req = new PipelineRequest('https://localhost', {
      headers: {
        host: 'www.example.com',
        'x-forwarded-host': 'main--website--example.aem.live',
      },
    });
    const res = new PipelineResponse();
    await initConfig(state, req, res);
    assert.strictEqual(state.prodHost, 'main--website--example.aem.live');
    assert.strictEqual(warnings.length, 0, 'expected no warnings');
  });

  it('throws error if property is missing', async () => {
    assert.throws(() => new PipelineState({ config: {} }), Error('org required'));
  });
});
