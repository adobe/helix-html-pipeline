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
import { toClassName } from './utils.js';

/**
 * Creates a "DIV representation" of a table.
 * @type PipelineStep
 * @param {Document} document
 * @param {HTMLTableElement} $table the table element
 * @returns {HTMLDivElement} the resulting div
 */
function tableToDivs(document, $table) {
  const $cards = document.createElement('div');

  // iterate over the table to avoid problem with query selector and nested tables
  const $rows = [];
  if ($table.tHead) {
    $rows.push(...$table.tHead.rows);
  }
  for (const $tbody of $table.tBodies) {
    $rows.push(...$tbody.rows);
  }
  if ($rows.length === 0) {
    return $cards;
  }
  const $headerRow = $rows.shift();

  // special case, only 1 row and 1 column with a nested table
  if ($rows.length === 0 && $headerRow.cells.length === 1) {
    const $nestedTable = $headerRow.cells[0].querySelector(':scope table');
    if ($nestedTable) {
      return $nestedTable;
    }
  }

  // get columns names
  const clazz = Array.from($headerRow.cells)
    .map((e) => toClassName(e.textContent))
    .filter((c) => !!c)
    .join('-');
  if (clazz) {
    $cards.classList.add(clazz);
  }

  // construct page block
  for (const $row of $rows) {
    const $card = document.createElement('div');
    for (const $cell of $row.cells) {
      const $div = document.createElement('div');
      $div.append(...$cell.childNodes);
      $card.append($div);
    }
    $cards.append($card);
  }
  return $cards;
}

/**
 * Converts tables into page blocks.
 * see https://github.com/adobe/helix-pages/issues/638
 * @param context The current context of processing pipeline
 */
export default function createPageBlocks({ content }) {
  const { document } = content;
  document.querySelectorAll('body > div > table').forEach(($table) => {
    const $div = tableToDivs(document, $table);
    $table.parentNode.replaceChild($div, $table);
  });
}
