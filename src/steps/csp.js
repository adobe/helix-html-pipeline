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
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';

export const NONCE_AEM = '\'nonce-aem\'';

/**
 * Parse a CSP string into its directives
 * @param {string | undefined | null} csp
 * @returns {Object}
 */
function parseCSP(csp) {
  if (!csp) {
    return {};
  }

  const parts = csp.split(';');
  const result = {};
  parts.forEach((part) => {
    const [directive, ...values] = part.trim().split(' ');
    result[directive] = values.join(' ');
  });
  return result;
}

/**
 * Computes where nonces should be applied
 * @param {string | null | undefined} metaCSPText The actual CSP value from the meta tag
 * @param {string | null | undefined} headersCSPText The actual CSP value from the headers
 * @returns {scriptNonce: boolean, styleNonce: boolean}
 */
function shouldApplyNonce(metaCSPText, headersCSPText) {
  const metaBased = parseCSP(metaCSPText);
  const headersBased = parseCSP(headersCSPText);
  return {
    scriptNonce: metaBased['script-src']?.includes(NONCE_AEM)
      || headersBased['script-src']?.includes(NONCE_AEM),
    styleNonce: metaBased['style-src']?.includes(NONCE_AEM)
      || headersBased['style-src']?.includes(NONCE_AEM),
  };
}

/**
 * Create a nonce for CSP
 * @returns {string}
 */
function createNonce() {
  return crypto.randomBytes(18).toString('base64');
}

/**
 * Get the applied CSP header from a response
 * @param {PipelineResponse} res
 * @returns {string}
 */
export function getHeaderCSP(res) {
  return res.headers?.get('content-security-policy');
}

/**
 * Apply CSP with nonces on an AST
 * @param {PipelineResponse} res
 * @param {Object} tree
 * @param {Object} metaCSP
 * @param {string} headersCSP
 */
function createAndApplyNonceOnAST(res, tree, metaCSP, headersCSP) {
  const nonce = createNonce();
  const { scriptNonce, styleNonce } = shouldApplyNonce(metaCSP?.properties.content, headersCSP);

  if (metaCSP) {
    metaCSP.properties.content = metaCSP.properties.content.replaceAll(NONCE_AEM, `'nonce-${nonce}'`);
  }

  if (headersCSP) {
    res.headers.set('content-security-policy', headersCSP.replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
  }

  if (scriptNonce) {
    selectAll('script[nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
  }

  if (styleNonce) {
    selectAll('style[nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
    selectAll('link[rel=stylesheet][nonce="aem"]', tree).forEach((el) => {
      el.properties.nonce = nonce;
    });
  }
}

/**
 * Process the content security policy on an AST
 * @param {PipelineResponse} res
 * @param {Object} tree
 * @returns {void}
 */
export function contentSecurityPolicyOnAST(res, tree) {
  const metaCSP = select('meta[http-equiv="content-security-policy"]', tree)
    || select('meta[http-equiv="Content-Security-Policy"]', tree);
  const headersCSP = getHeaderCSP(res);

  if (!metaCSP && !headersCSP) {
    // No CSP defined
    return;
  }

  // CSP with nonce
  if (metaCSP?.properties?.content?.includes(NONCE_AEM) || headersCSP?.includes(NONCE_AEM)) {
    createAndApplyNonceOnAST(res, tree, metaCSP, headersCSP);
  }

  if (metaCSP && metaCSP.properties['move-as-header'] === 'true') {
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

/**
 * Apply CSP with nonces on a HTML code
 * @param {PipelineResponse} res
 * @param {Object} metaCSP
 * @param {string} headersCSP
 */
function createAndApplyNonceOnCode(res, metaCSP, headersCSP) {
  const nonce = createNonce();
  const { scriptNonce, styleNonce } = shouldApplyNonce(metaCSP?.properties.content, headersCSP);
  if (metaCSP) {
    if (metaCSP.properties['move-as-header'] !== 'true') {
      res.body = res.body
        .replace(/(<meta\b[^<>]*?'nonce-)aem(')/i, `$1${nonce}$2`)
        .replace(/(<meta\b[^<>]*?'nonce-)aem(')/i, `$1${nonce}$2`); // can appear twice in the same meta tag
    } else {
      metaCSP.properties.content = metaCSP.properties.content.replaceAll(NONCE_AEM, `'nonce-${nonce}'`);
    }
  }

  if (headersCSP) {
    res.headers.set('content-security-policy', headersCSP.replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
  }

  if (scriptNonce) {
    res.body = res.body.replace(/(<script\b[^<>]*?\bnonce=")aem(")/ig, `$1${nonce}$2`);
  }

  if (styleNonce) {
    res.body = res.body.replace(/(<style\b[^<>]*?\bnonce=")aem(")/ig, `$1${nonce}$2`)
      .replace(/(<link\b[^<>]*?\bnonce=")aem(")/ig, `$1${nonce}$2`);
  }
}

/**
 * Process the content security policy directly on HTML code
 * while keeping the changes to an absolute minimum
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {void}
 */
export function contentSecurityPolicyOnCode(state, req, res) {
  if (state.type !== 'html') {
    return;
  }

  const headersCSP = getHeaderCSP(res);

  // eslint-disable-next-line max-len
  const metaCSPRegex = /<meta\b[^<>]+?\bhttp-equiv="content-security-policy"(?:(?!http-equiv="content-security-policy")[^<>])*?>/i;
  const metaCSPText = metaCSPRegex.exec(res.body)?.[0];
  const metaCSP = metaCSPText
    ? unified().use(rehypeParse, { fragment: true }).parse(metaCSPText)?.children[0]
    : null;

  // CSP with nonce
  if (metaCSP?.properties?.content?.includes(NONCE_AEM) || headersCSP?.includes(NONCE_AEM)) {
    createAndApplyNonceOnCode(res, metaCSP, headersCSP);
  }

  if (metaCSP && metaCSP.properties['move-as-header'] === 'true') {
    if (!headersCSP) {
      res.headers.set('content-security-policy', metaCSP.properties.content);
      res.body = res.body.replace(metaCSPRegex, '');
    } else {
      res.body = res.body.replace('move-as-header="true"', '');
    }
  }
}
