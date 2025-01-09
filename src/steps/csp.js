/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import crypto from 'crypto';
import { select, selectAll } from 'hast-util-select';
import { remove } from 'unist-util-remove';

export const NONCE_AEM = '\'nonce-aem\'';

function parseCSP(csp) {
  const parts = csp.split(';');
  const result = {};
  parts.forEach((part) => {
    const [directive, ...values] = part.trim().split(' ');
    result[directive] = values.join(' ');
  });
  return result;
}

function shouldApplyNonce(csp) {
  const parsedCSP = parseCSP(csp);
  return {
    scriptNonce: parsedCSP['script-src']?.includes(NONCE_AEM),
    styleNonce: parsedCSP['style-src']?.includes(NONCE_AEM),
  };
}

function createAndApplyNonce(res, tree, metaCSP, headersCSP) {
  const nonce = crypto.randomBytes(18).toString('base64');
  let scriptNonceResult = false;
  let styleNonceResult = false;

  if (metaCSP) {
    const { scriptNonce, styleNonce } = shouldApplyNonce(metaCSP.properties.content);
    scriptNonceResult ||= scriptNonce;
    styleNonceResult ||= styleNonce;
    metaCSP.properties.content = metaCSP.properties.content.replaceAll(NONCE_AEM, `'nonce-${nonce}'`);
  }

  if (headersCSP) {
    const { scriptNonce, styleNonce } = shouldApplyNonce(headersCSP);
    scriptNonceResult ||= scriptNonce;
    styleNonceResult ||= styleNonce;
    res.headers.set('content-security-policy', headersCSP.replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
  }

  if (scriptNonceResult) {
    selectAll('script[nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
  }

  if (styleNonceResult) {
    selectAll('style[nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
    selectAll('link[rel=stylesheet][nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
  }
}

export function checkResponseBodyForMetaBasedCSP(res) {
  return res.body?.includes('http-equiv="content-security-policy"')
    || res.body?.includes('http-equiv="Content-Security-Policy"');
}

export function checkResponseBodyForAEMNonce(res) {
  /*
    we only look for 'nonce-aem' (single quote) to see if there is a meta CSP with nonce
    we don't want to generate nonces if they appear just on script/style tags,
    as those have no effect without the actual CSP meta (or header).
    this means it is ok to not check for the "nonce-aem" (double quotes)
   */
  return res.body?.includes(NONCE_AEM);
}

export function getMetaCSP(tree) {
  return select('meta[http-equiv="content-security-policy"]', tree)
    || select('meta[http-equiv="Content-Security-Policy"]', tree);
}

export function getHeaderCSP(res) {
  return res.headers?.get('content-security-policy');
}

export function contentSecurityPolicy(res, tree) {
  const metaCSP = getMetaCSP(tree);
  const headersCSP = getHeaderCSP(res);

  if (!metaCSP && !headersCSP) {
    // No CSP defined
    return;
  }

  // CSP with nonce
  if (
    (metaCSP && metaCSP.properties.content.includes(NONCE_AEM))
    || (headersCSP && headersCSP.includes(NONCE_AEM))
  ) {
    createAndApplyNonce(res, tree, metaCSP, headersCSP);
  }

  if (metaCSP && metaCSP.properties['move-as-header']) {
    if (!headersCSP) {
      // if we have a CSP in meta but no CSP in headers
      // we can move the CSP from meta to headers, if requested
      res.headers.set('content-security-policy', metaCSP.properties.content);
      remove(tree, null, metaCSP);
    } else {
      delete metaCSP.properties['move-as-header'];
    }
  }
}
