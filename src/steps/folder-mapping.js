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
import { getPathInfo, getExtension } from '../utils/path.js';

/**
 * Finds the mapping from path to folders in fstab
 * @param {object} folders folder/path mapping
 * @param {string} path given path
 * @returns {null|string} returns the mapped path or null
 */
export function mapPath(folders, path) {
  for (const [folder, mapping] of Object.entries(folders)) {
    if (path === folder) {
      return mapping;
    }
    if (folder.endsWith('/') && path.startsWith(folder)) {
      return mapping;
    }
    if (path.startsWith(`${folder}/`)) {
      return mapping;
    }
  }
  return null;
}

/**
 * Checks if the resource path is below a folder-mapped configuration and updates `state.mappedPath`
 * accordingly.
 *
 * @param state
 */
export function calculateFolderMapping(state) {
  const { folders } = state.config;
  if (!folders) {
    return;
  }
  const { path } = state.info;
  state.mappedPath = mapPath(folders, path);
}

/**
 * Applies folder mapping if the resource is mapped (i.e. if `state.mappedPath` is {@code true}.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 */
export function applyFolderMapping(state) {
  const { info: { path }, mappedPath } = state;
  if (mappedPath) {
    state.info = getPathInfo(mappedPath);
    state.info.unmappedPath = path;
    if (getExtension(mappedPath)) {
      // special case: use code-bus
      state.content.sourceBus = 'code';
      state.info.resourcePath = mappedPath;
      state.log.info(`mapped ${path} to ${state.info.resourcePath} (code-bus)`);
    } else {
      state.mapped = true;
      state.log.info(`mapped ${path} to ${state.info.path} (content-bus)`);
    }
  }
}
