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
import path from 'path';
import {
  getPathInfo,
  validatePathInfo,
  getExtension,
} from '../../src/utils/path.js';

describe('Path Utils Test - getPathInfo', () => {
  it('get path info populates correctly', async () => {
    assert.deepStrictEqual(getPathInfo('foo'), null);

    assert.deepStrictEqual(getPathInfo(null), {
      path: '/',
      resourcePath: '/index.md',
      selector: '',
      extension: '.html',
      originalExtension: '',
      originalFilename: '',
      originalPath: '/',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo(''), {
      path: '/',
      resourcePath: '/index.md',
      selector: '',
      extension: '.html',
      originalExtension: '',
      originalFilename: '',
      originalPath: '/',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/'), {
      path: '/',
      resourcePath: '/index.md',
      selector: '',
      extension: '.html',
      originalExtension: '',
      originalFilename: '',
      originalPath: '/',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express'), {
      selector: '',
      extension: '.html',
      path: '/express',
      resourcePath: '/express.md',
      originalExtension: '',
      originalFilename: 'express',
      originalPath: '/express',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express.html'), {
      selector: '',
      extension: '.html',
      path: '/express',
      resourcePath: '/express.md',
      originalExtension: '.html',
      originalFilename: 'express.html',
      originalPath: '/express.html',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express.md'), {
      selector: '',
      extension: '.html',
      path: '/express',
      resourcePath: '/express.md',
      originalExtension: '.md',
      originalFilename: 'express.md',
      originalPath: '/express.md',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express/'), {
      selector: '',
      extension: '.html',
      path: '/express/',
      resourcePath: '/express/index.md',
      originalExtension: '',
      originalFilename: '',
      originalPath: '/express/',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express/index'), {
      selector: '',
      extension: '.html',
      path: '/express/',
      resourcePath: '/express/index.md',
      originalExtension: '',
      originalFilename: 'index',
      originalPath: '/express/index',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express/index.html'), {
      selector: '',
      extension: '.html',
      path: '/express/',
      resourcePath: '/express/index.md',
      originalExtension: '.html',
      originalFilename: 'index.html',
      originalPath: '/express/index.html',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/express/index.md'), {
      selector: '',
      extension: '.html',
      path: '/express/',
      resourcePath: '/express/index.md',
      originalExtension: '.md',
      originalFilename: 'index.md',
      originalPath: '/express/index.md',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/en/query-index.json'), {
      selector: '',
      extension: '.json',
      path: '/en/query-index.json',
      resourcePath: '/en/query-index.json',
      originalExtension: '.json',
      originalFilename: 'query-index.json',
      originalPath: '/en/query-index.json',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/en/header.plain.html'), {
      selector: 'plain',
      extension: '.html',
      path: '/en/header.plain.html',
      resourcePath: '/en/header.md',
      originalExtension: '.html',
      originalFilename: 'header.plain.html',
      originalPath: '/en/header.plain.html',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('/en/header.plain.json'), {
      selector: 'plain',
      extension: '.json',
      path: '/en/header.plain.json',
      resourcePath: '/en/header.json',
      originalExtension: '.json',
      originalFilename: 'header.plain.json',
      originalPath: '/en/header.plain.json',
      unmappedPath: '',
    });

    assert.deepStrictEqual(getPathInfo('///en//'), null);
    assert.deepStrictEqual(getPathInfo('/en//express'), null);
    assert.deepStrictEqual(getPathInfo('/en/../../../../../etc/passwd'), null);
    assert.deepStrictEqual(getPathInfo('/en/./etc/passwd'), null);
  });
});

describe('Path Utils Test - validatePathInfo', () => {
  it('rejects undefined path', async () => {
    assert.strictEqual(validatePathInfo(), false);
  });

  it('validates paths correctly', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('')), true);
  });

  it('validates path with html', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('/blog.html')), true);
  });

  it('rejects path ending with /index', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('/index')), true);
  });

  it('validates path with plain.html', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('/blog.plain.html')), true);
  });

  it('rejects path with html.plain.html', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('/blog.html.plain.html')), false);
  });

  it('rejects path with plain.json', async () => {
    assert.strictEqual(validatePathInfo(getPathInfo('/blog.plain.json')), false);
  });
});

describe('Path Utils Test - getExtension', () => {
  it('mimics path.extname', async () => {
    const paths = [
      '',
      '/index.html',
      '/foo/bar',
      '/foo.ext',
      '/foo.baz.bar',
      '/foo.',
      'bar',
      '.bar',
      '.foo.bar',
      '../foo/bar.ext',
    ];
    for (const p of paths) {
      assert.strictEqual(getExtension(p), path.extname(p));
    }
  });
});
