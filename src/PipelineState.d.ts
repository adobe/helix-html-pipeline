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
import {PathInfo, S3Loader, FormsMessageDispatcher, PipelineTimer} from "./index";
import {PipelineContent} from "./PipelineContent";

declare enum PipelineType {
  html = 'html',
  json = 'json',
  form = 'form',
}

declare interface PipelineOptions {
  log: Console;
  s3Loader: S3Loader;
  messageDispatcher: FormsMessageDispatcher;
  owner: string;
  repo: string;
  ref: string;
  partition: string;
  path: string;
  contentBusId: string;
  timer: PipelineTimer;
}

declare interface Modifier {
  key: string;
  value: string;
}

/**
 * The modifiers contain groups of key value pairs (Modifier) indexed by url patterns.
 * Note that javascript object preserve insertion ordering of theirs keys as long as they
 * are string-like, so the order is important when applying the modifiers.
 *
 * @example
 *
 * {
 *   "/*": [
 *     { "key": "A", "value": "B" },
 *     { "key": "C", "value": "D" },
 *   ],
 *   "/f": [
 *     { "key": "title", "value": "Hero" },
 *     { "key": "description", "value": "Once upon..." },
 *   ]
 * }
 *
 */
declare interface Modifiers {
  [url:string]: Modifier[];
}

declare class PipelineState {
  constructor(opts: PipelineOptions);
  log: Console;
  info: PathInfo;
  content: PipelineContent;
  contentBusId: string;
  s3Loader: S3Loader;
  messageDispatcher: FormsMessageDispatcher;

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
   * the /.helix/config.json in object form (only if /.helix/config-all.json is present)
   */
  config?: object;

  /**
   * the metadata.json in modifier form.
   */
  metadata?: Modifiers;

  /**
   * the headers.json in modifier form.
   */
  headers?: Modifiers;

  /**
   * optional timer that is used to measure the timing
   */
  timer?: PipelineTimer;

  /**
   * pipeline type. 'html', 'json', 'forms'
   */
  type: PipelineType;
}

