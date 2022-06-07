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

import { getPathInfo } from './utils/path.js';
import { PipelineContent } from './PipelineContent.js';
import { Modifiers } from './utils/modifiers.js';

/**
 * State of the pipeline
 * @class PipelineState
 */
export class PipelineState {
  /**
   * Creates the pipeline state
   * @param {PipelineOptions} opts
   */
  constructor(opts) {
    Object.assign(this, {
      log: opts.log ?? console,
      info: getPathInfo(opts.path),
      content: new PipelineContent(),
      // todo: compute content-bus id from fstab
      contentBusId: opts.contentBusId,
      owner: opts.owner,
      repo: opts.repo,
      ref: opts.ref,
      partition: opts.partition,
      helixConfig: undefined,
      metadata: Modifiers.EMPTY,
      headers: Modifiers.EMPTY,
      config: {},
      s3Loader: opts.s3Loader,
      messageDispatcher: opts.messageDispatcher,
      fetch: opts.fetch,
      timer: opts.timer,
      type: 'html',
      authInfo: undefined,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  createExternalLocation(value) {
    return value;
  }
}
