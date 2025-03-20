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

/* eslint-disable max-len */
import { h } from 'hastscript';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { contentSecurityPolicyOnAST } from './csp.js';

const LANG_REGEX = /^[a-z]{2}([-_]{1}[a-z]{2})?$/i;

function formatLang(lang) {
  return lang
    .replace('_', '-')
    .toLowerCase();
}

function appendElement($parent, $el) {
  if ($el) {
    $parent.children.push($el);
  }
}

function createElement(name, ...attrs) {
  // check for empty values
  const properties = {};
  for (let i = 0; i < attrs.length; i += 2) {
    const value = attrs[i + 1];
    if (value === undefined) {
      return null;
    }
    properties[attrs[i]] = value;
  }
  return h(name, properties);
}

function sanitizeJsonLd(jsonLd) {
  const sanitizedJsonLd = jsonLd.replaceAll('<', '&#x3c;').replaceAll('>', '&#x3e;');
  return JSON.stringify(JSON.parse(sanitizedJsonLd.trim()), null, 2);
}

/**
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export default async function render(state, req, res) {
  const { content } = state;
  const { hast, meta } = content;

  if (state.info.selector === 'plain') {
    // just return body
    res.document = hast;
    return;
  }
  const $head = h('head');
  if (meta.title !== undefined) {
    $head.children.push(h('title', meta.title));
  }

  if (meta.canonical) {
    appendElement($head, createElement('link', 'rel', 'canonical', 'href', meta.canonical));
  }

  let jsonLd;
  let htmlLang;

  for (const [name, value] of Object.entries(meta.page)) {
    if (name.toLowerCase() === 'json-ld') {
      jsonLd = value;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (name.toLowerCase() === 'html-lang') {
      if (LANG_REGEX.test(value)) {
        htmlLang = formatLang(value);
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    if (name.toLowerCase().startsWith('hreflang-')) {
      const lang = name.substring(9);
      if (LANG_REGEX.test(lang)) {
        appendElement(
          $head,
          createElement('link', 'rel', 'alternate', 'hreflang', formatLang(lang), 'href', value),
        );
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    const attr = name.includes(':') && !name.startsWith('twitter:') ? 'property' : 'name';
    if (Array.isArray(value)) {
      for (const v of value) {
        appendElement($head, createElement('meta', attr, name, 'content', v));
      }
    } else {
      appendElement($head, createElement('meta', attr, name, 'content', value));
    }
  }
  appendElement($head, createElement('link', 'rel', 'alternate', 'type', 'application/xml+atom', 'href', meta.feed, 'title', `${meta.title} feed`));

  // inject json ld if valid
  if (jsonLd) {
    const props = { type: 'application/ld+json' };
    try {
      jsonLd = sanitizeJsonLd(jsonLd);
    } catch (e) {
      jsonLd = '';
      props['data-error'] = `error in json-ld: ${cleanupHeaderValue(e.message)}`;
    }
    const script = h('script', props, jsonLd);
    $head.children.push(script);
  }

  // inject head.html
  const headHtml = state.config?.head?.html;
  if (headHtml) {
    const $headHtml = await unified()
      .use(rehypeParse, { fragment: true })
      .parse(headHtml);
    contentSecurityPolicyOnAST(res, $headHtml);
    $head.children.push(...$headHtml.children);
  }

  res.document = {
    type: 'root',
    children: [
      { type: 'doctype' },
      h('html', htmlLang ? { lang: htmlLang } : null, [
        $head,
        h('body', [
          h('header', []), // todo: are those still required ?
          h('main', hast),
          h('footer', []), // todo: are those still required ?
        ]),
      ]),
    ],
  };
}
