/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { heading as fallback } from 'mdast-util-to-hast/lib/handlers/heading.js';
import { toString } from 'mdast-util-to-string';
import strip from 'strip-markdown';

/**
 * Utility class injects heading identifiers during the MDAST to VDOM transformation.
 */
export default class HeadingHandler {
  /**
   * Initializes the handler
   */
  constructor(slugger) {
    this.slugger = slugger;
  }

  /**
   * Returns the handler function
   */
  handler() {
    return (h, node) => {
      // Prepare the heading id
      const headingIdentifier = this.slugger.slug(toString(strip()(node)));

      // Inject the id after transformation
      const n = { ...node };
      const el = fallback(h, n);
      el.properties.id = el.properties.id || headingIdentifier;
      return el;
    };
  }
}
