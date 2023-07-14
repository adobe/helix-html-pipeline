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
async function performValidation(fetch, token, secretKey) {
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: secretKey, response: token }),
  });
  if (!response.ok) {
    return false;
  }
  const responseData = await response.json();
  return responseData.success;
}

/**
 *
 * @param {PipelineState} state Pipeline options
 * @param {Object} body Request body
 * @returns {{success: boolean, message: string | null, status: number | null}} Captcha state
 */
export default async function validateCaptcha(state, body) {
  const { fetch, config } = state;
  const { 'captcha-secret-key': captchaSecretKey, 'captcha-type': captchaType } = config;

  // Handle cases where captcha is not configured correctly
  if (captchaType && captchaType !== 'reCaptcha v2') {
    return {
      success: false,
      message: `The captcha type ${captchaType} you have configured is not currently supported.`,
      status: 500,
    };
  }
  if (captchaType && !captchaSecretKey) {
    return {
      success: false,
      message: 'You must configure a captcha secret key if a captcha type is set.',
      status: 500,
    };
  }

  // If captcha is configured correctly, run captcha validation
  if (captchaType) {
    const captchaToken = body.data?.find((x) => x.name === 'g-recaptcha-response')?.value;

    if (!captchaToken) {
      return {
        success: false,
        message: 'Captcha token missing from request body',
        status: 400,
      };
    }

    const captchaPassed = await performValidation(fetch, captchaToken, captchaSecretKey);
    return {
      success: captchaPassed,
      message: captchaPassed ? null : 'Captcha validation failed.',
      status: captchaPassed ? null : 400,
    };
  }

  return {
    success: true,
    message: null,
    status: null,
  };
}
