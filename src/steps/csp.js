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
import { select } from 'hast-util-select';
import { Tokenizer } from 'parse5';
import { remove } from 'unist-util-remove';
import { visit } from 'unist-util-visit';
// eslint-disable-next-line import/no-unresolved
import cryptoImpl from '#crypto';

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
  const array = new Uint8Array(18);
  cryptoImpl.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
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

  visit(tree, (node) => {
    if (scriptNonce && node.tagName === 'script' && node.properties?.nonce === 'aem') {
      node.properties.nonce = nonce;
      return;
    }

    if (styleNonce
      && (node.tagName === 'style' || (node.tagName === 'link' && node.properties?.rel?.[0] === 'stylesheet'))
      && node.properties?.nonce === 'aem'
    ) {
      node.properties.nonce = nonce;
    }
  });
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

export function contentSecurityPolicyOnAST(res, tree) {
  const metaCSP = getMetaCSP(tree);
  const headersCSP = getHeaderCSP(res);

  if (!metaCSP && !headersCSP) {
    // No CSP defined
    return;
  }

  // CSP with nonce
  if (metaCSP?.properties.content.includes(NONCE_AEM) || headersCSP?.includes(NONCE_AEM)) {
    createAndApplyNonceOnAST(res, tree, metaCSP, headersCSP);
  }

  if (metaCSP?.properties['move-as-header'] === 'true') {
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

export function contentSecurityPolicyOnCode(state, res) {
  if (state.type !== 'html') {
    return;
  }

  const cspHeader = getHeaderCSP(res);
  if (!(
    cspHeader?.includes(NONCE_AEM)
    || (checkResponseBodyForMetaBasedCSP(res) && checkResponseBodyForAEMNonce(res))
  )) {
    return;
  }

  const nonce = createNonce();
  let { scriptNonce, styleNonce } = shouldApplyNonce(null, cspHeader);

  const html = res.body;
  const chunks = [];
  let lastOffset = 0;

  const getRawHTML = (token) => html.slice(token.location.startOffset, token.location.endOffset);

  const tokenizer = new Tokenizer({
    sourceCodeLocationInfo: true,
  }, {
    onStartTag(tag) {
      chunks.push(html.slice(lastOffset, tag.location.startOffset));
      try {
        if (tag.tagName === 'meta'
          && tag.attrs.find(
            (attr) => attr.name.toLowerCase() === 'http-equiv' && attr.value.toLowerCase() === 'content-security-policy',
          )
        ) {
          const contentAttr = tag.attrs.find((attr) => attr.name.toLowerCase() === 'content');
          if (contentAttr) {
            ({ scriptNonce, styleNonce } = shouldApplyNonce(contentAttr.value, cspHeader));

            if (!cspHeader && tag.attrs.find((attr) => attr.name === 'move-as-header' && attr.value === 'true')) {
              res.headers.set('content-security-policy', contentAttr.value.replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
              return; // don't push the chunk so it gets removed from the response body
            }
            chunks.push(getRawHTML(tag).replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
            return;
          }
        }

        if (scriptNonce && tag.tagName === 'script' && tag.attrs.find((attr) => attr.name === 'nonce' && attr.value === 'aem')) {
          chunks.push(getRawHTML(tag).replace(/nonce="aem"/i, `nonce="${nonce}"`));
          return;
        }

        if (styleNonce && (tag.tagName === 'style' || tag.tagName === 'link') && tag.attrs.find((attr) => attr.name === 'nonce' && attr.value === 'aem')) {
          chunks.push(getRawHTML(tag).replace(/nonce="aem"/i, `nonce="${nonce}"`));
          return;
        }

        chunks.push(getRawHTML(tag));
      } finally {
        lastOffset = tag.location.endOffset;
      }
    },
    // no-op callbacks. onStartTag will take care of these
    onComment(_) {},
    onDoctype(_) {},
    onEndTag(_) {},
    onEof(_) {},
    onCharacter(_) {},
    onNullCharacter(_) {},
    onWhitespaceCharacter(_) {},
    onParseError(_) {},
  });

  tokenizer.write(html);
  chunks.push(html.slice(lastOffset));

  res.body = chunks.join('');
  if (cspHeader) {
    res.headers.set('content-security-policy', cspHeader.replaceAll(NONCE_AEM, `'nonce-${nonce}'`));
  }
}
