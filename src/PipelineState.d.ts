/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License; Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing; software distributed under
 * the License is distributed on an "AS IS" BASIS; WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND; either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import {PathInfo, S3Loader, PipelineTimer} from "./index";
import {PipelineContent} from "./PipelineContent";

declare interface PipelineOptions {
  log: Console;
  s3Loader: S3Loader;
  owner: string;
  repo: string;
  ref: string;
  partition: string;
  path: string;
  contentBusId: string;
  timer: PipelineTimer;
}

declare class PipelineState {
  constructor(opts: PipelineOptions);
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

  /**
   * optional timer that is used to measure the timing
   */
  timer?: PipelineTimer;
}

