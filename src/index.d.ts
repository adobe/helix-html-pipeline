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
import {PipelineState} from "./PipelineState";
import {PipelineRequest} from "./PipelineRequest";
import {PipelineResponse} from "./PipelineResponse";

export * from './PipelineContent';
export * from './PipelineRequest';
export * from './PipelineResponse';
export * from './PipelineState';
export * from './PipelineStatusError';

/**
 * Path Info
 */
export declare interface PathInfo {
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

  /**
   * original path as passed before folder mapping
   */
  unmappedPath: string;
}

export declare interface S3Loader {
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

export declare interface DispatchMessageResponse {
  messageId:string,
  requestId:string,
}

/**
 * Timer
 */
export declare interface PipelineTimer {
  /**
   * Records the timestamp of the given `step`
   */
  update(step:string): void;
}

export declare interface PipelineStep {
  async(state: PipelineState, req: PipelineRequest, resp: PipelineResponse): Promise<void>;
}
