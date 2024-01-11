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
      env: opts.env,
      info: getPathInfo(opts.path),
      config: opts.config,
      content: new PipelineContent(),
      contentBusId: opts.config.contentBusId,
      site: opts.site,
      org: opts.org,
      owner: opts.config.owner,
      repo: opts.config.repo,
      ref: opts.ref,
      partition: opts.partition,
      metadata: Modifiers.EMPTY,
      headers: Modifiers.EMPTY,
      s3Loader: opts.s3Loader,
      messageDispatcher: opts.messageDispatcher,
      authEnvLoader: opts.authEnvLoader ?? { load: () => {} },
      fetch: opts.fetch,
      timer: opts.timer,
      type: 'html',
    });
    for (const prop of ['org', 'site', 'contentBusId', 'repo', 'owner', 'ref', 'partition']) {
      if (!this[prop]) {
        throw new Error(`${prop} required`);
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  createExternalLocation(value) {
    return value;
  }
}
