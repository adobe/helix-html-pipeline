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
import path from 'path';
import { readFile } from 'fs/promises';

/**
 * @implements S3Loader
 */
export class FileS3Loader {
  constructor() {
    Object.assign(this, {
      dirs: {
        'helix-content-bus': path.resolve(__testdir, 'fixtures', 'content'),
        'helix-code-bus': path.resolve(__testdir, 'fixtures', 'code'),
      },
      statusCodeOverrides: {},
      rewrites: {},
      headerOverride: {},
    });
  }

  rewrite(fileName, dst) {
    this.rewrites[fileName] = dst;
    return this;
  }

  status(fileName, status) {
    this.statusCodeOverrides[fileName] = status;
    return this;
  }

  headers(fileName, name, value) {
    let headers = this.headerOverride[fileName];
    if (!headers) {
      headers = new Map();
      this.headerOverride[fileName] = headers;
    }
    headers.set(name, value);
    return this;
  }

  async getObject(bucketId, key) {
    const dir = this.dirs[bucketId];
    if (!dir) {
      throw Error(`unknown bucketId: ${bucketId}`);
    }
    // eslint-disable-next-line no-console
    let fileName = key.split('/').pop();

    fileName = this.rewrites[fileName] || fileName;
    const status = this.statusCodeOverrides[fileName];
    const headers = this.headerOverride[fileName] ?? new Map();
    if (status) {
      // eslint-disable-next-line no-console
      console.log(`FileS3Loader: loading ${bucketId}/${key} -> ${status}`);
      return {
        status,
        body: '',
        headers,
      };
    }

    const file = path.resolve(dir, fileName);
    try {
      const body = await readFile(file, 'utf-8');
      // eslint-disable-next-line no-console
      console.log(`FileS3Loader: loading ${bucketId}/${key} -> 200`);
      return {
        status: 200,
        body,
        headers: new Map([
          ['last-modified', 'Fri, 30 Apr 2021 03:47:18 GMT'],
          ['x-source-location', fileName],
          ['x-amz-meta-x-source-location', fileName],
          ...headers,
        ]),
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`FileS3Loader: loading ${bucketId}/${key} -> 404 (${e.message})`);
      return {
        status: 404,
        body: '',
        headers: new Map(),
      };
    }
  }

  async headObject(bucketId, key) {
    return this.getObject(bucketId, key);
  }
}
