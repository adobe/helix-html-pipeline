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

import { JSDOM } from 'jsdom';

/*
<!DOCTYPE html>
<html data-sly-attribute="${content.document.documentElement.attributesMap}">
<head>
  <title>${content.meta.title}</title>
  <link data-sly-test="${content.meta.url}" rel="canonical" href="${content.meta.url}"/>
  <meta data-sly-test="${content.meta.description}" name="description" content="${content.meta.description}"/>
  <meta data-sly-test="${content.meta.keywords}" name="keywords" content="${content.meta.keywords}"/>
  <meta data-sly-test="${content.meta.title}" property="og:title" content="${content.meta.title}"/>
  <meta data-sly-test="${content.meta.description}" property="og:description" content="${content.meta.description}"/>
  <meta data-sly-test="${content.meta.url}" property="og:url" content="${content.meta.url}"/>
  <meta data-sly-test="${content.meta.image}" property="og:image" content="${content.meta.image}"/>
  <meta data-sly-test="${content.meta.image}" property="og:image:secure_url" content="${content.meta.image}"/>
<sly data-sly-test="${content.meta.imageAlt}">
  <meta data-sly-test="${content.meta.imageAlt}" property="og:image:alt" content="${content.meta.imageAlt}"/>
</sly>
  <meta data-sly-test="${content.meta.modifiedTime}" property="og:updated_time" content="${content.meta.modified_time}"/>
<sly data-sly-test="${content.meta.tags}" data-sly-list.tag="${content.meta.tags}">
  <meta property="article:tag" content="${tag}"/>
</sly>
  <meta data-sly-test="${content.meta.section}" property="article:section" content="${section}"/>
  <meta data-sly-test="${content.meta.published_time}" property="article:published_time" content="${content.meta.published_time}"/>
  <meta data-sly-test="${content.meta.modified_time}" property="article:modified_time" content="${content.meta.modified_time}"/>
  <meta data-sly-test="${content.meta.title}" name="twitter:title" content="${content.meta.title}"/>
  <meta data-sly-test="${content.meta.description}" name="twitter:description" content="${content.meta.description}"/>
  <meta data-sly-test="${content.meta.image}" name="twitter:image" content="${content.meta.image}"/>
<sly data-sly-test="${content.meta.custom}" data-sly-list="${content.meta.custom}">
  <meta data-sly-test="${item.property}" property="${item.name}" content="${item.value}">
  <meta data-sly-test="${!item.property}" name="${item.name}" content="${item.value}">
</sly>
  <esi:include src="/head.html" onerror="continue"/>
</head>
<body data-sly-attribute="${content.document.body.attributesMap}">
  <!--  header -->
  <header><esi:include src="/header.plain.html" onerror="continue"/></header>
  <!--  main content -->
  <main>${content.document.body}</main>
  <!--  footer -->
  <footer><esi:include src="/footer.plain.html"  onerror="continue"/></footer>
</body>
</html>
*/

function appendElement($parent, $el) {
  if ($el) {
    $parent.append($el);
  }
}

function createElement(doc, name, ...attrs) {
  // check for empty values
  for (let i = 0; i < attrs.length; i += 2) {
    if (!attrs[i + 1]) {
      return null;
    }
  }
  const $el = doc.createElement(name);
  for (let i = 0; i < attrs.length; i += 2) {
    $el.setAttribute(attrs[i], attrs[i + 1]);
  }
  return $el;
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
  const srcDoc = content.document;
  if (state.info.selector === 'plain') {
    // just return body
    res.document = srcDoc.body;
  } else {
    // create document like HTL used to do
    const dom = new JSDOM('<!DOCTYPE html>'
      + '<html>'
      + '<head></head>'
      + '<body>'
      + '<header></header>' // todo: are those still required ?
      + '<main></main>'
      + '<footer></footer>' // todo: are those still required ?
      + '</body>'
      + '</html>');
    const doc = dom.window.document;

    // copy attributes
    for (const attr of srcDoc.documentElement.attributes) {
      doc.documentElement.attributes[attr.name] = attr.value;
    }
    for (const attr of srcDoc.body.attributes) {
      doc.body.attributes[attr.name] = attr.value;
    }

    // add title
    const $head = doc.head;
    const { meta } = content;
    const $title = doc.createElement('title');
    $title.innerHTML = meta.title;
    $head.append($title);

    // add meta
    appendElement($head, createElement(doc, 'link', 'rel', 'canonical', 'href', content.meta.canonical));

    appendElement($head, createElement(doc, 'meta', 'name', 'description', 'content', content.meta.description));
    appendElement($head, createElement(doc, 'meta', 'name', 'keywords', 'content', content.meta.keywords));
    appendElement($head, createElement(doc, 'meta', 'property', 'og:title', 'content', content.meta.title));
    appendElement($head, createElement(doc, 'meta', 'property', 'og:description', 'content', content.meta.description));
    appendElement($head, createElement(doc, 'meta', 'property', 'og:url', 'content', content.meta.url));
    appendElement($head, createElement(doc, 'meta', 'property', 'og:image', 'content', content.meta.image));
    appendElement($head, createElement(doc, 'meta', 'property', 'og:image:secure_url', 'content', content.meta.image));
    if (content.meta.imageAlt) {
      appendElement($head, createElement(doc, 'meta', 'property', 'og:image:alt', 'content', content.meta.imageAlt));
    }
    appendElement($head, createElement(doc, 'meta', 'property', 'og:updated_time', 'content', content.meta.modified_time));
    for (const tag of (meta.tags || [])) {
      appendElement($head, createElement(doc, 'meta', 'property', 'article:tag', 'content', tag));
    }
    appendElement($head, createElement(doc, 'meta', 'property', 'article:section', 'content', content.meta.section));
    appendElement($head, createElement(doc, 'meta', 'property', 'article:published_time', 'content', content.meta.published_time));
    appendElement($head, createElement(doc, 'meta', 'property', 'article:modified_time', 'content', content.meta.modified_time));

    appendElement($head, createElement(doc, 'meta', 'name', 'twitter:title', 'content', content.meta.title));
    appendElement($head, createElement(doc, 'meta', 'name', 'twitter:description', 'content', content.meta.description));
    appendElement($head, createElement(doc, 'meta', 'name', 'twitter:image', 'content', content.meta.image));

    for (const custom of (meta.custom || [])) {
      appendElement($head, createElement(doc, 'meta', custom.property ? 'property' : 'name', custom.name, 'content', custom.value));
    }
    if (meta.feed) {
      appendElement($head, createElement(doc, 'link', 'rel', 'alternate', 'type', 'application/xml+atom', 'href', meta.feed, 'title', `${meta.title} feed`));
    }
    // inject head.html
    const $headHtml = doc.createElement('template');
    $headHtml.innerHTML = state.helixConfig?.head?.html ?? `
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <script src="/scripts.js" type="module" crossorigin="use-credentials"></script>
        <link rel="stylesheet" href="/styles.css"/>`;
    $head.appendChild($headHtml.content);

    // add body to main
    const $main = doc.querySelector('main');

    $main.append(...srcDoc.body.childNodes);
    res.document = doc;
  }
}
