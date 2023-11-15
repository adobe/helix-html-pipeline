/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { getAuthInfo, makeAuthError } from '../utils/auth.js';
import { toArray } from './utils.js';

/**
 * Checks if the given email is allowed.
 * @param {string} email
 * @param {string[]} allows
 * @returns {boolean}
 */
export function isAllowed(email = '', allows = []) {
  /** @type string[] */
  const [, domain] = email.split('@');
  if (!domain) {
    return false;
  }
  const wild = `*@${domain}`;
  return allows.findIndex((a) => a === email || a === wild) >= 0;
}

/**
 * Returns the normalized access configuration for the current partition.
 * @param state
 * @return {{}}
 */
export function getAccessConfig(state) {
  const { access } = state.config;
  if (!access) {
    return {
      allow: [],
      apiKeyId: [],
    };
  }
  const { partition } = state;
  return {
    allow: toArray(access[partition]?.allow ?? access.allow),
    apiKeyId: toArray(access[partition]?.apiKeyId ?? access.apiKeyId),
  };
}

/**
 * Handles authentication
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export async function authenticate(state, req, res) {
  // check if `.auth` route to validate and exchange token
  if (state.info.path === '/.auth') {
    const authInfo = await getAuthInfo(state, req);
    await authInfo.exchangeToken(state, req, res);
    return;
  }

  // get partition relative auth info
  const access = getAccessConfig(state);

  // if not protected, do nothing
  if (!access.allow.length) {
    return;
  }

  // get auth info
  const authInfo = await getAuthInfo(state, req);

  // if not authenticated, redirect to login screen
  if (!authInfo.authenticated) {
    // send 401 for plain requests
    if (state.info.selector || state.type !== 'html') {
      state.log.warn('[auth] unauthorized. redirect to login only for extension less html.');
      makeAuthError(state, req, res, 'unauthorized');
      return;
    }
    await authInfo.redirectToLogin(state, req, res);
    return;
  }

  const { sub, jti, email } = authInfo.profile;

  // validate subject, if present
  if (sub) {
    const [owner, repo] = sub.split('/');
    if (owner !== state.owner || (repo !== '*' && repo !== state.repo)) {
      state.log.warn(`[auth] invalid subject ${sub}: does not match ${state.owner}/${state.repo}`);
      makeAuthError(state, req, res, 'invalid-subject');
      return;
    }
  }

  // validate jti
  if (jti) {
    if (access.apiKeyId.indexOf(jti) < 0) {
      state.log.warn(`[auth] invalid jti ${jti}: does not match configured id ${access.apiKeyId}`);
      makeAuthError(state, req, res, 'invalid-jti');
    }
  }

  // check profile is allowed
  if (!isAllowed(email, access.allow)) {
    state.log.warn(`[auth] profile not allowed for ${access.allow}`);
    makeAuthError(state, req, res, 'forbidden', 403);
  }
}

/**
 * Checks if the given owner repo is allowed
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} allows
 * @returns {boolean}
 */
export function isOwnerRepoAllowed(owner, repo, allows = []) {
  if (allows.length === 0) {
    return true;
  }
  return allows
    .map((ownerRepo) => ownerRepo.split('/'))
    .findIndex(([o, r]) => owner === o && (repo === r || r === '*')) >= 0;
}

/**
 * Checks if the
 * @type PipelineStep
 * @param {PipelineState} state
 * @param {PipelineRequest} req
 * @param {PipelineResponse} res
 * @returns {Promise<void>}
 */
export async function requireProject(state, req, res) {
  // if not restricted, do nothing
  const ownerRepo = state.config?.access?.require?.repository;
  if (!ownerRepo) {
    return;
  }
  const ownerRepos = Array.isArray(ownerRepo) ? ownerRepo : [ownerRepo];
  const { log, owner, repo } = state;
  if (!isOwnerRepoAllowed(owner, repo, ownerRepos)) {
    log.warn(`${owner}/${repo} not allowed for ${ownerRepos}`);
    res.status = 403;
    res.error = 'forbidden.';
  }
}
