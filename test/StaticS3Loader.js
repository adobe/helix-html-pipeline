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
/**
 * @implements S3Loader
 */
export class StaticS3Loader {
  constructor() {
    this.buckets = {};
  }

  reply(bucketId, key, response) {
    let bucket = this.buckets[bucketId];
    if (!bucket) {
      bucket = {};
      this.buckets[bucketId] = bucket;
    }
    bucket[key] = response;
    return this;
  }

  async getObject(bucketId, key) {
    const bucket = this.buckets[bucketId];
    const response = bucket?.[key] ?? {
      status: 404,
      body: '',
      headers: new Map(),
    };
    if (response instanceof Error) {
      // eslint-disable-next-line no-console
      console.log(`StaticS3Loader: failing ${bucketId}/${key} -> ${response.message}`);
      throw response;
    }
    // eslint-disable-next-line no-console
    console.log(`StaticS3Loader: loading ${bucketId}/${key} -> ${response.status}`);
    return response;
  }

  async headObject(bucketId, key) {
    return this.getObject(bucketId, key);
  }
}
