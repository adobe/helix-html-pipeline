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
import { optimizeImageURL } from './utils.js';

/**
 * Converts imgs to pictures
 * @type PipelineStep
 * @param context The current context of processing pipeline
 */
export default async function createPictures({ content }) {
  const { document } = content;

  // transform <img> to <picture>
  document.querySelectorAll('img[src^="./media_"]').forEach((img, i) => {
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    const src = img.getAttribute('src');
    source.setAttribute('media', '(max-width: 400px)');
    source.setAttribute('srcset', optimizeImageURL(src, 750));
    picture.appendChild(source);
    img.setAttribute('loading', i > 0 ? 'lazy' : 'eager'); // load all but first image lazy
    img.setAttribute('src', optimizeImageURL(src, 2000));
    img.parentNode.insertBefore(picture, img);
    picture.appendChild(img);
  });
}
