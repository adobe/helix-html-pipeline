/*
 * Copyright 2023 Adobe. All rights reserved.
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
/* eslint-disable quote-props */

import assert from 'assert';
import validateCaptcha from '../../src/steps/validate-captcha.js';

import { Response } from '../utils.js';

describe('Captcha verification', () => {
  it('returns successful state if no captcha is configured', async () => {
    const validate = async () => {
      await validateCaptcha({ config: {} }, {});
    };

    await assert.doesNotReject(validate);
  });

  it('returns unsuccessful state with wrong captcha type configured', async () => {
    const validate = async () => {
      await validateCaptcha({
        config: {
          captcha: {
            type: 'reCaptcha v3',
          },
        },
      }, {});
    };

    await assert.rejects(validate, { code: 500, message: 'The captcha type reCaptcha v3 is not supported.' });
  });

  it('returns unsuccessful state with no captcha secret configured', async () => {
    const validate = async () => {
      await validateCaptcha({
        config: {
          captcha: {
            type: 'reCaptcha v2',
          },
        },
      }, {});
    };

    await assert.rejects(validate, { code: 500, message: 'Captcha secret key is not configured.' });
  });

  it('returns unsuccessful state if recaptcha response is missing from body', async () => {
    const validate = async () => {
      await validateCaptcha({
        config: {
          captcha: {
            type: 'reCaptcha v2',
            secret: 'key',
          },
        },
      }, {});
    };

    await assert.rejects(validate, { code: 400, message: 'Captcha token missing from request body' });
  });

  function getMockedFetchForTokenValidation(status, success, requestValidator) {
    return (url, opts) => {
      requestValidator(url, opts);
      return new Response({ success }, { status });
    };
  }

  const defaultCaptchaConfig = {
    captcha: {
      type: 'reCaptcha v2',
      secret: 'key',
    },
  };

  it('returns unsuccessful state if recaptcha validation returns bad status code', async () => {
    let fetchCalled = false;
    const captchaToken = 'token';

    const validate = async () => {
      await validateCaptcha({
        config: defaultCaptchaConfig,
        fetch: getMockedFetchForTokenValidation(500, true, () => {
          fetchCalled = true;
        }),
      }, {
        data: [{ name: 'g-recaptcha-response', value: captchaToken }],
      });
    };

    await assert.rejects(validate, { code: 500, message: 'Captcha validation request returned 500' });
    assert.ok(fetchCalled);
  });

  it('returns unsuccessful state if recaptcha validation returns failure', async () => {
    let fetchCalled = false;
    const captchaToken = 'token';

    const validate = async () => {
      await validateCaptcha({
        config: defaultCaptchaConfig,
        fetch: getMockedFetchForTokenValidation(200, false, () => {
          fetchCalled = true;
        }),
      }, {
        data: [{ name: 'g-recaptcha-response', value: captchaToken }],
      });
    };

    await assert.rejects(validate, { code: 400, message: 'Captcha validation failed' });
    assert.ok(fetchCalled);
  });

  it('returns success if validation succeeds', async () => {
    let fetchCalled = false;
    const captchaToken = 'token';
    const validate = async () => {
      await validateCaptcha({
        config: defaultCaptchaConfig,
        fetch: getMockedFetchForTokenValidation(200, true, (url, opts) => {
          fetchCalled = true;
          assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify');
          assert.equal(opts.method, 'POST');
          assert.equal(opts.body.toString(), `secret=${defaultCaptchaConfig.captcha.secret}&response=${captchaToken}`);
        }),
      }, {
        data: [{ name: 'g-recaptcha-response', value: captchaToken }],
      });
    };

    await assert.doesNotReject(validate);
    assert.ok(fetchCalled);
  });

  it('works if form data is object instead of url encoded', async () => {
    let fetchCalled = false;
    const captchaToken = 'token';
    const validate = async () => {
      await validateCaptcha({
        config: defaultCaptchaConfig,
        fetch: getMockedFetchForTokenValidation(200, true, (url, opts) => {
          fetchCalled = true;
          assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify');
          assert.equal(opts.method, 'POST');
          assert.equal(opts.body.toString(), `secret=${defaultCaptchaConfig.captcha.secret}&response=${captchaToken}`);
        }),
      }, {
        data: {
          'g-recaptcha-response': captchaToken,
        },
      });
    };

    await assert.doesNotReject(validate);
    assert.ok(fetchCalled);
  });
});
