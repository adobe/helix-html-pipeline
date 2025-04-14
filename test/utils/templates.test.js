/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

import assert from 'assert';
import { expandTemplates } from '../../src/utils/templates.js';

describe('Templates Utils Test', () => {
  it('expands templates correctly', async () => {
    const state = {
      info: {
        path: '/products',
      },
      prodHost: 'adobe.com',
    };

    assert.deepStrictEqual(expandTemplates(state, {
      pageTitle: 'Products',
      title: '{{pageTitle}} | AEM',
      canoncial: 'https://{{host}}{{path}}.html',
      test: '{{first}} and {{middle}} and {{end}}',
      first: '0',
      middle: '1',
      end: '2',
      emptyString: '',
      empty: '{{emptyString}}',
      missing: '{{foo}}',
    }), {
      pageTitle: 'Products',
      title: 'Products | AEM',
      canoncial: 'https://adobe.com/products.html',
      test: '0 and 1 and 2',
      first: '0',
      middle: '1',
      end: '2',
      emptyString: '',
      empty: '',
      missing: '',
    });
  });
});
