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

  // add meta
  // (this is so complicated to keep the order backward compatible to make the diff tests happy)
  const metadata = {
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.url,
    'og:image': meta.image,
    'og:image:secure_url': meta.image,
    'og:image:alt': meta.imageAlt,
    'og:updated_time': meta.modified_time,
    'article:tag': meta.tags || [],
    'article:section': meta.section,
    'article:published_time': meta.published_time,
    'article:modified_time': meta.modified_time,
    'twitter:card': meta['twitter:card'],
    'twitter:title': '',
    'twitter:description': '',
    'twitter:image': '',
  };

  // append custom metadata
  Object.assign(metadata, meta.custom);

  // fallback for twitter
  const FALLBACKS = [
    ['twitter:title', 'og:title'],
    ['twitter:description', 'og:description'],
    ['twitter:image', 'og:image'],
  ];

  for (const [from, to] of FALLBACKS) {
    if (!(from in meta.custom)) {
      metadata[from] = metadata[to];
    }
  }

  // remove undefined metadata
  for (const name of Object.keys(metadata)) {
    if (metadata[name] === undefined) {
      delete metadata[name];
    }
  }

  appendElement($head, createElement('link', 'rel', 'canonical', 'href', meta.canonical));
  appendElement($head, createElement('meta', 'name', 'description', 'content', meta.description));
  appendElement($head, createElement('meta', 'name', 'keywords', 'content', meta.keywords));

  for (const [name, value] of Object.entries(metadata)) {
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

  // inject head.html
  const headHtml = state.helixConfig?.head?.data.html;
  if (headHtml) {
    const $headHtml = await unified()
      .use(rehypeParse, { fragment: true })
      .parse(headHtml);
    $head.children.push(...$headHtml.children);
  } else {
    appendElement($head, createElement('meta', 'name', 'viewport', 'content', 'width=device-width, initial-scale=1'));
    appendElement($head, createElement('script', 'src', '/scripts.js', 'type', 'module', 'crossorigin', 'use-credentials'));
    appendElement($head, createElement('link', 'rel', 'stylesheet', 'href', '/styles.css'));
  }

  res.document = {
    type: 'root',
    children: [
      { type: 'doctype' },
      h('html', [
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
