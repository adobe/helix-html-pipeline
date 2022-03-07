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
import { extname } from 'path';
import { getPathInfo } from '../utils/path.js';

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
 * Checks the fstab for folder mapping entries and then re-adjusts the path infos if needed.
 * if the remapped resource is *not* extensionless, it will be declared as code-bus resource.
 *
 * @type PipelineStep
 * @param {PipelineState} state
 */
export default function folderMapping(state) {
  const folders = state.helixConfig?.fstab?.folders;
  if (!folders) {
    return;
  }
  const { path } = state.info;
  const mapped = mapPath(folders, path);
  if (mapped) {
    state.info = getPathInfo(mapped);
    if (extname(mapped)) {
      // special case: use code-bus
      state.content.sourceBus = 'code';
      state.info.resourcePath = mapped;
      state.log.info(`mapped ${path} to ${state.info.resourcePath} (code-bus)`);
    } else {
      state.log.info(`mapped ${path} to ${state.info.path} (content-bus)`);
    }
  }
}
