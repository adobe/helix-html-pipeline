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
import { cleanupHeaderValue, computeSurrogateKey } from '@adobe/helix-shared-utils';
import renderCode from './steps/render-code.js';
import { computeCodePathKey } from './steps/set-x-surrogate-key-header.js';
import setCustomResponseHeaders from './steps/set-custom-response-headers.js';
import { PipelineResponse } from './PipelineResponse.js';
import initConfig from './steps/init-config.js';

/**
 * Default robots.txt contents returned on inner/outer CDN.
 */
const DEFAULT_ROBOTS = `# AEM robots.txt FAQ
#
# Q: This looks like a default robots.txt, how can I provide my own?
# A: Add the contents of your robots.txt to your site configuration:
# https://labs.aem.live/tools/robots-edit/index.html
#
# Q: Why am I seeing this robots.txt instead of the one I
# configured?
# A: You are visiting from *.aem.page or *.aem.live - in order
# to prevent these sites from showing up in search engines and
# giving you a duplicate content penalty on your real site we
# exclude all robots
#
# Q: What do you mean with "real site"?
# A: If you add a custom domain to this site (e.g.
# example.com), then Franklin detects that you are ready for
# production and serves your own robots.txt - but only on
# example.com
#
# Q: This does not answer my questions at all. What can I do?
# A: Head to your Teams or Slack channel, or ask us on Discord:
# https://discord.gg/aem-live
User-agent: *
Disallow: /
`;

/**
 * Internal domains suffixes, either inner or outer CDN. Every host that
 * ends with one of those is considered internal.
 */
const INTERNAL_DOMAINS = [
  '.aem.page',
  '.aem-fastly.page',
  '.aem-cloudflare.page',
  '.aem-gcp.page',
  '.aem.live',
  '.aem-fastly.live',
  '.aem-cloudflare.live',
  '.aem-gcp.live',
  '.hlx.page',
  '.hlx-fastly.page',
  '.hlx-cloudflare.page',
  '.hlx.live',
  '.hlx-fastly.live',
  '.hlx-cloudflare.live',
];

/**
 * Hosts that should not be treated as internal.
 */
const EXCLUDED_HOSTS = [
  'www.aem.live',
];

/**
 * Generate dynamic robots.txt with production host in the sitemap.
 *
 * @param {import('./PipelineState.js').PipelineState} state state
 * @returns {import('./PipelineResponse.js').PipelineResponse} response
 */
function generateRobots(state) {
  const {
    prodHost,
  } = state;
  const txt = [
    'User-Agent: *',
    'Allow: /',
    '',
    `Sitemap: https://${prodHost}/sitemap.xml`,
    '',
  ].join('\n');
  return new PipelineResponse(txt, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}

/**
 * Return the array of hosts in the `X-Forwarded-Host` request header.
 *
 * @param {import('./PipelineRequest.js').PipelineRequest} req request
 * @returns {Array<String>} array of hosts
 */
function getForwardedHosts(req) {
  const xfh = req.headers.get('x-forwarded-host');
  if (!xfh) {
    return [];
  }
  return xfh.split(',').map((v) => v.trim()).filter((v) => !!v);
}

/**
 * Return the array of surrogate keys to return for a `robots.txt`
 *
 * @param {import('./PipelineState.js').PipelineState} state state
 * @returns {Array<String>} surrogate keys
 */
async function computeSurrogateKeys(state) {
  const keys = [];

  keys.push(await computeSurrogateKey(`${state.site}--${state.org}_config.json`));
  keys.push(await computeCodePathKey(state));
  return keys;
}

/**
 * Serves or renders the robots.txt.
 *
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @returns {PipelineResponse}
 */
export async function robotsPipe(state, req) {
  const { log } = state;
  state.type = 'robots';

  if (state.info?.path !== '/robots.txt') {
    // this should not happen as it would mean that the caller used the wrong route. so we respond
    // with a 500 to indicate that something is wrong.
    return new PipelineResponse('', {
      status: 500,
      headers: {
        'x-error': 'invalid route',
      },
    });
  }

  /** @type PipelineResponse */
  const res = new PipelineResponse('', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  });

  const { partition } = state;
  const forwardedHosts = getForwardedHosts(req);

  if (partition === 'preview' || forwardedHosts.every(
    (host) => !EXCLUDED_HOSTS.includes(host)
      && INTERNAL_DOMAINS.some((domain) => host.endsWith(domain)),
  )) {
    // return default robots.txt, vary and no surrogate key
    res.body = DEFAULT_ROBOTS;
    res.headers.set('vary', 'x-forwarded-host');
    return res;
  }

  try {
    await initConfig(state, req, res);

    const robots = state.config?.robots?.txt;
    if (robots) {
      state.content.data = robots;
    } else {
      const ret = generateRobots(state);
      state.content.data = ret.body;
    }
    res.headers.set('content-type', 'text/plain; charset=utf-8');
    res.status = 200;

    state.timer?.update('serialize');
    await renderCode(state, req, res);

    // set surrogate keys
    const keys = await computeSurrogateKeys(state);
    res.headers.set('x-surrogate-key', keys.join(' '));
    res.headers.set('vary', 'x-forwarded-host');

    await setCustomResponseHeaders(state, req, res);
  } catch (e) {
    res.error = e.message;
    res.status = e.code || 500;

    log.error(`pipeline status: ${res.status} ${res.error}`);
    res.headers.set('x-error', cleanupHeaderValue(res.error));
  }
  return res;
}
