/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { cleanupHeaderValue } from '@adobe/helix-shared-utils';
import { h } from 'hastscript';
import { select } from 'hast-util-select';
import { toString } from 'hast-util-to-string';
import { map } from 'unist-util-map';
import { CONTINUE, SKIP, visit } from 'unist-util-visit';
import { PipelineState } from '../PipelineState.js';
import { PipelineRequest } from '../PipelineRequest.js';
import { PipelineStatusError } from '../PipelineStatusError.js';
import { recordLastModified } from '../utils/last-modified.js';
import { getPathInfo } from '../utils/path.js';
import { getOrigin, getXFH } from './utils.js';
import { isSectionMetadataEnabled } from './extract-section-metadata.js';

function validateConfig(config, maxFragments) {
  for (const name of ['inlineHeader', 'inlineFooter', 'inlineFragments']) {
    if (config[name] !== undefined && typeof config[name] !== 'boolean') {
      throw new PipelineStatusError(500, `invalid ${name} config, expected boolean`);
    }
  }
  if (maxFragments !== undefined
    && (!Number.isSafeInteger(maxFragments) || maxFragments < 0)) {
    throw new PipelineStatusError(500, 'invalid limits.rendering.maxFragments config, expected non-negative integer');
  }
}

function isRootRelative(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

function dependencyUrl(path, base) {
  if (!isRootRelative(path) || path.includes('\\')) {
    throw new Error('expected a root-relative content path');
  }
  const url = new URL(path, base);
  url.hash = '';
  const pathname = url.pathname.replace(/(?:\.plain\.html|\.html|\.md)$/, '');
  url.pathname = pathname.endsWith('/')
    ? `${pathname}index.plain.html`
    : `${pathname}.plain.html`;
  if (!getPathInfo(url.pathname)) {
    throw new Error('invalid content path');
  }
  return url;
}

function shouldInlineFragment(path) {
  return isRootRelative(path) && path.split(/[?#]/)[0].includes('/fragments/');
}

/**
 * Composes already-rendered content without changing the parent page's metadata.
 * The plain pipeline prevents recursive expansion. The renderer is injected to avoid
 * a circular import of htmlPipe.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @param {typeof import('../html-pipe.js').htmlPipe} renderDependency
 */
export default async function inlineResources(state, req, res, renderDependency) {
  if (req.method !== 'GET' || res.status !== 200 || state.info.selector === 'plain') {
    return;
  }
  const config = state.config.features?.rendering || {};
  const maxFragments = state.config.limits?.rendering?.maxFragments;
  validateConfig(config, maxFragments);
  if (!isSectionMetadataEnabled(state.config)
    || (!config.inlineHeader && !config.inlineFooter && !config.inlineFragments)) {
    return;
  }

  const replacements = [];
  for (const [enabled, tag, name] of [
    [config.inlineHeader, 'header', 'nav'],
    [config.inlineFooter, 'footer', 'footer'],
  ]) {
    const path = state.content.meta.page[name] ?? `/${name}`;
    const node = select(`body > ${tag}`, res.document);
    if (enabled && path && node && node.children.length === 0) {
      replacements.push({ path, node });
    }
  }
  if (config.inlineFragments) {
    const limit = maxFragments ?? 10;
    let fragmentCount = 0;
    const main = select('main', res.document);
    visit(main, 'element', (node, index, parent) => {
      let block = node;
      if (main.children.includes(parent)) {
        const children = node.tagName === 'p'
          ? node.children.filter((child) => child.type !== 'text' || child.value.trim())
          : [node];
        if (children.length === 1 && children[0].tagName === 'a'
          && shouldInlineFragment(children[0].properties.href)) {
          block = h('div.fragment', [h('div', [h('div', [children[0]])])]);
          parent.children[index] = block;
        }
      }
      if (block.tagName === 'div' && block.properties.className?.includes('fragment')) {
        const link = select('a', block);
        const path = link ? link.properties.href : toString(block).trim();
        if (!isRootRelative(path)) {
          return SKIP;
        }
        if (main.children.includes(parent)) {
          const siblings = parent.children.filter((child) => child.type === 'element');
          // The client appends .plain.html literally; normalization would change its behavior.
          if (/[?#]/.test(path) || path.split('/').pop().includes('.')) {
            state.log.info('fragment block path left unchanged to preserve client-side loading');
          } else if (fragmentCount >= limit) {
            state.log.info(`fragment inline limit ${limit} reached; block left for client-side rendering`);
          } else {
            const shared = siblings.length !== 1;
            replacements.push({
              path, node: shared ? block : parent, fragment: true, shared,
            });
            fragmentCount += 1;
          }
        } else {
          state.log.info('nested fragment block left for client-side rendering');
        }
        // Never replace a link inside a retained fragment block.
        return SKIP;
      }
      return CONTINUE;
    });
  }

  const dependencies = new Map();
  const errors = [];
  const keys = new Set();
  let uncacheable = false;
  const fail = (path, message) => {
    const error = `failed to inline ${path}: ${message}`;
    state.log.warn(error);
    errors.push(cleanupHeaderValue(error));
  };
  replacements.forEach((replacement) => {
    let url;
    try {
      url = dependencyUrl(replacement.path, req.url);
    } catch (e) {
      fail(replacement.path, e.message);
      return;
    }
    replacement.key = url.href;
    if (!dependencies.has(url.href)) {
      dependencies.set(url.href, (async () => {
        const child = new PipelineState({
          ...state,
          path: url.pathname,
          // Folder mapping can replace the plain selector, so also disable child inlining.
          config: {
            ...state.config,
            features: {
              ...state.config.features,
              rendering: {
                ...config, inlineHeader: false, inlineFooter: false, inlineFragments: false,
              },
            },
          },
          timer: undefined,
        });
        // Match metadata and folder rules against the canonical content path.
        child.info.path = url.pathname.replace(/\.plain\.html$/, '').replace(/\/index$/, '/');
        const response = await renderDependency(child, new PipelineRequest(url, {
          headers: req.headers,
        }));
        if (response.status !== 200 || !response.document
          || child.content.sourceBus !== 'content') {
          fail(replacement.path, response.error || `unexpected response: ${response.status}`);
          return undefined;
        }
        response.headers.get('x-surrogate-key')?.split(' ').filter(Boolean)
          .forEach((key) => keys.add(key));
        if (/\b(no-store|no-cache|private)\b/i.test(response.headers.get('cache-control') || '')) {
          uncacheable = true;
        }
        recordLastModified(state, res, `inline:${url.pathname}`, response.headers.get('last-modified'));
        return child.info.selector === 'plain'
          ? response.document
          : { type: 'root', children: select('main', response.document).children };
      })());
    }
  });
  const documents = new Map(await Promise.all([...dependencies].map(async ([key, promise]) => [
    key, await promise,
  ])));

  const fragments = new Map();
  replacements.forEach(({
    node, key, fragment, shared, path,
  }) => {
    const document = documents.get(key);
    if (!document) {
      return;
    }
    const copy = map(document, (child) => ({
      ...child,
      ...(child.properties ? { properties: { ...child.properties } } : {}),
    }));
    if (fragment) {
      const host = getXFH(req.headers);
      const base = new URL(path, host ? getOrigin(host) : req.url);
      visit(copy, 'element', (child) => {
        const attr = { img: 'src', source: 'srcSet' }[child.tagName];
        const value = child.properties[attr];
        if (typeof value === 'string' && value.startsWith('./media_')) {
          child.properties[attr] = new URL(value, base).href;
        }
      });
    }
    const { children } = copy;
    if (fragment) {
      fragments.set(node, shared
        ? children.flatMap((section) => (section.tagName === 'div' ? section.children : []))
        : children);
    } else {
      node.children = children;
    }
  });

  // Replace only original blocks, never blocks introduced by an inlined dependency.
  const replace = (parent) => {
    parent.children = parent.children.flatMap((node) => {
      if (fragments.has(node)) {
        return fragments.get(node);
      }
      if (node.children) {
        replace(node);
      }
      return [node];
    });
  };
  replace(res.document);
  if (keys.size) {
    res.headers.set('x-surrogate-key', [...keys].join(' '));
  }
  if (errors.length) {
    res.headers.set('x-inline-error', errors.join(', '));
  }
  if (errors.length || uncacheable) {
    res.headers.set('cache-control', 'no-store');
    for (const name of [
      'surrogate-control', 'cdn-cache-control', 'cloudflare-cdn-cache-control',
      'edge-control', 'expires',
    ]) {
      res.headers.delete(name);
    }
  }
}
