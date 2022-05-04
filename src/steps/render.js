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
    if (!value) {
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
  const $head = h('head', [
    h('title', meta.title),
  ]);

  // add meta
  appendElement($head, createElement('link', 'rel', 'canonical', 'href', content.meta.canonical));
  appendElement($head, createElement('meta', 'name', 'description', 'content', content.meta.description));
  appendElement($head, createElement('meta', 'name', 'keywords', 'content', content.meta.keywords));
  appendElement($head, createElement('meta', 'property', 'og:title', 'content', content.meta.title));
  appendElement($head, createElement('meta', 'property', 'og:description', 'content', content.meta.description));
  appendElement($head, createElement('meta', 'property', 'og:url', 'content', content.meta.url));
  appendElement($head, createElement('meta', 'property', 'og:image', 'content', content.meta.image));
  appendElement($head, createElement('meta', 'property', 'og:image:secure_url', 'content', content.meta.image));
  appendElement($head, createElement('meta', 'property', 'og:image:alt', 'content', content.meta.imageAlt));
  appendElement($head, createElement('meta', 'property', 'og:updated_time', 'content', content.meta.modified_time));
  for (const tag of (meta.tags || [])) {
    appendElement($head, createElement('meta', 'property', 'article:tag', 'content', tag));
  }
  appendElement($head, createElement('meta', 'property', 'article:section', 'content', content.meta.section));
  appendElement($head, createElement('meta', 'property', 'article:published_time', 'content', content.meta.published_time));
  appendElement($head, createElement('meta', 'property', 'article:modified_time', 'content', content.meta.modified_time));
  appendElement($head, createElement('meta', 'name', 'twitter:card', 'content', content.meta['twitter:card']));
  appendElement($head, createElement('meta', 'name', 'twitter:title', 'content', content.meta.title));
  appendElement($head, createElement('meta', 'name', 'twitter:description', 'content', content.meta.description));
  appendElement($head, createElement('meta', 'name', 'twitter:image', 'content', content.meta.image));

  for (const custom of (meta.custom || [])) {
    appendElement($head, createElement('meta', custom.property ? 'property' : 'name', custom.name, 'content', custom.value));
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
