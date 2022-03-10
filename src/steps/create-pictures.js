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
import { h } from 'hastscript';
import { selectAll } from 'hast-util-select';
import { replace } from '../utils/hast-utils.js';
import { optimizeImageURL } from './utils.js';

/**
 * Converts imgs to pictures
 * @type PipelineStep
 * @param context The current context of processing pipeline
 */
export default async function createPictures({ content }) {
  const { hast } = content;

  // transform <img> to <picture>
  selectAll('img[src^="./media_"]', hast).forEach((img, i) => {
    const { src } = img.properties;
    const source = h('source');
    source.properties.media = '(max-width: 400px)';
    source.properties.srcset = optimizeImageURL(src, 750);

    const picture = h('picture', source);
    img.properties.loading = i > 0 ? 'lazy' : 'eager';
    img.properties.src = optimizeImageURL(src, 2000);

    replace(hast, img, picture);
    picture.children.push(img);
  });
}
