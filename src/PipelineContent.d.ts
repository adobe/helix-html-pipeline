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
import {Node} from "unist";
import { Root } from 'hast';
import { IDSlugger } from './utils/id-slugger.js';

declare enum SourceType {
  CONTENT = 'content',
  CODE = 'code',
}

declare class PipelineContent {
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
   * The transformed document (hast) representation
   */
  hast: Root;

  /**
   * slugger to use for heading id calculations
   */
  slugger: IDSlugger;

  /**
   * document specific metadata
   */
  meta: object;
  title: string;
  intro: string;
  image: string;
}
