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
import { Root } from 'hast';

declare interface PipelineResponseInit {
  status?: number;
  headers: Map<string, string> | object;
}

declare class PipelineResponse {
  constructor(body?:string, init?:PipelineResponseInit);
  status: number;
  /**
   * The transformed document (hast) representation
   */
  document: Root;
  body: string;
  headers: Map<string, string>;
  error: any;

  /**
   * the last modified time of the response. this is the max of the last-modified times of the
   * various source. e.g. if the `head.html` is newer than the `content`, then the last-modified
   * header will be the one of the `head.html`
   */
  lastModifiedTime: number;

  /**
   * the last modified sources of the response. this is a record of the last-modified times of the
   * various sources making up the response.
   * @example
   * {
   *   content: { time: 1714857600, date: 'Wed, 12 Jan 2022 09:33:01 GMT' },
   *   metadata: { time: 1714857600, date: 'Wed, 12 Jan 2022 09:33:01 GMT' },
   * }
   */
  lastModifiedSources: Record<string, { time: number; date: string }>;
}

