/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License; Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing; software distributed under
 * the License is distributed on an "AS IS" BASIS; WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND; either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import GithubSlugger from 'github-slugger';
import { Node } from 'unist';

/**
 * Path Info
 */
declare interface PathInfo {
  /**
   * Resource path
   * @example '/express/index.md'
   * @example '/en/query-index.json'
   */
  resourcePath: string;

  /**
   * Web path
   * @example '/express/'
   * @example '/blogs/may-21'
   * @example '/en/query-index.json'
   */
  path: string;

  /**
   * extension / type of resource
   * @example '.html'
   * @example '.md'
   */
  extension: string;

  /**
   * selector
   * @example 'plain'
   */
  selector?: string;

  /**
   * original path as passed via request
   */
  originalPath: string;

  /**
   * original filename as passed via request
   */
  originalFilename: string;

  /**
   * original extension as passed via request
   */
  originalExtension: string;
}

declare interface PipelineRequest {
  url: URL;
  method: string;
  headers: Map<string, string>;
  body: string | object;
}

declare interface PipelineResponse {
  status: number;
  document?: Document;
  body: string;
  headers: Map<string, string>;
  error: any;

  /**
   * the last modified time of the response. this is the max of the last-modified times of the
   * various source. e.g. if the `head.html` is newer than the `content`, then the last-modified
   * header will be the one of the `head.html`
   */
  lastModifiedTime: number;
}

declare enum SourceType {
  CONTENT = 'content',
  CODE = 'code',
}

declare interface S3Loader {
  /**
   * Loads a S3 object from the given bucket and key.
   * @param {string} bucketId
   * @param {string} key
   */
  getObject(bucketId, key): Promise<PipelineResponse>;

  /**
   * Retrieves the head metadata of a S3 object from the given bucket and key.
   * @param {string} bucketId
   * @param {string} key
   */
  headObject(bucketId, key): Promise<PipelineResponse>;
}

declare interface PipelineContent {
  /**
   * source of content: `content` or `code`
   * @default 'content'
   */
  sourceBus: SourceType;

  /**
   * http status of the content fetch response
   */
  status: number;

  /**
   * raw data of the content
   */
  data: string;

  /**
   * http headers of the content fetch response
   */
  headers: object;

  /**
   * the source location of the loaded content
   */
  sourceLocation: string;

  /**
   * Markdown AST of the parsed content
   */
  mdast: Node;

  /**
   * document specific metadata
   */
  meta: object;
  title: string;
  intro: string;
  image: string;

  /**
   * slugger to use for heading id calculations
   */
  slugger: GithubSlugger;

  /**
   * The transformed document (jsom) representation
   */
  document: Document;
}

declare interface PipelineState {
  log: Console;
  info: PathInfo;
  content: PipelineContent;
  contentBusId: string;
  s3Loader: S3Loader;

  /**
   * Content bus partition
   * @example 'live'
   * @example 'preview'
   */
  partition: string;

  /**
   * Repository owner
   */
  owner: string;

  /**
   * Repository name
   */
  repo: string;

  /**
   * Repository ref
   */
  ref: string;

  /**
   * helix-config.json once loaded (contains fstab, head.html, etc)
   */
  helixConfig?: object;

  /**
   * metadata.json once loaded
   */
  metadata?: object;
}

declare interface PipelineStep {
  async(state: PipelineState, req: PipelineRequest, resp: PipelineResponse): Promise<void>;
}


declare interface PipelineOptions {
  log: Console;
  s3Loader: S3Loader;
  owner: string;
  repo: string;
  ref: string;
  partition: string;
  path: string;
  contentBusId: string;
}
