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

import { PipelineStatusError } from '../PipelineStatusError.js';

async function validateGoogleCaptchaV2(body, fetch, secretKey) {
  const captchaToken = body.data?.['g-recaptcha-response']
    || body.data?.find((x) => (x.name === 'g-recaptcha-response'))?.value;

  if (!captchaToken) {
    throw new PipelineStatusError(400, 'Captcha token missing from request body');
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: secretKey, response: captchaToken }),
  });
  if (!response.ok) {
    throw new PipelineStatusError(500, `Captcha validation request returned ${response.status}`);
  }
  const responseData = await response.json();
  if (!responseData.success) {
    throw new PipelineStatusError(400, 'Captcha validation failed');
  }
}

const SUPPORTED_CAPTCHA_TYPES = {
  'reCaptcha v2': validateGoogleCaptchaV2,
};

/**
 *
 * @param {PipelineState} state Pipeline options
 * @param {Object} body Request body
 * @returns {void}
 */
export default async function validateCaptcha(state, body) {
  const { fetch, config } = state;
  const { captcha } = config;

  // If captcha type is not configured, do nothing
  if (!captcha?.type) {
    return;
  }

  // Handle cases where captcha is not configured correctly
  if (!(captcha.type in SUPPORTED_CAPTCHA_TYPES)) {
    throw new PipelineStatusError(500, `The captcha type ${captcha.type} is not supported.`);
  }
  if (!captcha.secret) {
    throw new PipelineStatusError(500, 'Captcha secret key is not configured.');
  }

  // Perform validation
  const validator = SUPPORTED_CAPTCHA_TYPES[captcha.type];
  await validator(body, fetch, captcha.secret);
}
