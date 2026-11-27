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
import assert from 'assert';
import { JSDOM } from 'jsdom';
import { h } from 'hastscript';
import { htmlPipe, PipelineRequest, PipelineState } from '../src/index.js';
import inlineResources from '../src/steps/inline-resources.js';
import { computeContentPathKey } from '../src/steps/set-x-surrogate-key-header.js';
import { StaticS3Loader } from './StaticS3Loader.js';

const DATE = 'Thu, 26 Nov 2026 10:00:00 GMT';
const NEWER = 'Thu, 26 Nov 2026 11:00:00 GMT';

function fragmentLink(path = '/fragments/card') {
  return `[${path}](${path})`;
}

function fragmentBlock(path = '/fragments/card') {
  const cell = fragmentLink(path);
  const width = Math.max('Fragment'.length, cell.length);
  const border = `+${'-'.repeat(width + 2)}+`;
  return `${border}\n| ${'Fragment'.padEnd(width)} |\n+${'='.repeat(width + 2)}+\n| ${cell.padEnd(width)} |\n${border}\n`;
}

function setup(rendering = {}, options = {}) {
  const loads = [];
  const warnings = [];
  const s3Loader = new StaticS3Loader();
  const getObject = s3Loader.getObject.bind(s3Loader);
  s3Loader.getObject = (bucket, key) => {
    loads.push(`${bucket}/${key}`);
    return getObject(bucket, key);
  };
  const partition = options.partition || 'live';
  const put = (path, body, headers = {}) => s3Loader.reply(
    'helix-content-bus',
    `content-id/${partition}${path}`,
    { status: 200, body, headers: new Map(Object.entries({ 'last-modified': DATE, ...headers })) },
  );
  const config = {
    contentBusId: 'content-id',
    owner: 'owner',
    repo: 'repo',
    ref: 'main',
    features: { rendering: { version: 2, ...rendering } },
    metadata: {
      [partition]: {
        data: {
          '/': [{ key: 'nav', value: '/nav' }, { key: 'footer', value: '/footer' }],
        },
      },
    },
    ...options.config,
  };
  const state = new PipelineState({
    config,
    org: 'org',
    site: 'site',
    ref: 'main',
    path: options.path || '/',
    partition,
    s3Loader,
    log: {
      ...console,
      warn: (message) => warnings.push(message),
    },
  });
  put('/index.md', `# Parent\n\n---\n\n${fragmentBlock()}`);
  put('/nav.md', '# Navigation\n');
  put('/footer.md', '# Footer\n');
  put('/fragments/card.md', '# Card\n', { 'last-modified': NEWER });
  put('/content/card.md', '# Card\n', { 'last-modified': NEWER });
  const req = new PipelineRequest(`https://main--repo--owner.aem.live${state.info.originalPath}`, {
    method: options.method || 'GET',
  });
  return {
    state, req, put, loads, warnings, s3Loader,
  };
}

async function run(fixture) {
  const res = await htmlPipe(fixture.state, fixture.req);
  const { document } = new JSDOM(res.body).window;
  return { res, document };
}

describe('Server-side content inlining', () => {
  for (const [version, created, enabled] of [
    [1, undefined, false],
    [1, '2026-05-01', false],
    [undefined, undefined, false],
    [undefined, '2026-04-30', false],
    [undefined, '2026-05-01', true],
    [2, '2026-04-30', true],
    [3, '2026-04-30', true],
  ]) {
    it(`gates all inlining with rendering version ${version} and creation date ${created}`, async () => {
      const fixture = setup({
        version, inlineHeader: true, inlineFooter: true, inlineFragments: true,
      }, { config: { created } });
      fixture.put('/index.md', `# Parent\n\n---\n\n${fragmentLink()}\n\n${fragmentBlock()}`);
      const { res, document } = await run(fixture);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(document.querySelector('header').children.length, enabled ? 1 : 0);
      assert.strictEqual(document.querySelector('footer').children.length, enabled ? 1 : 0);
      assert.strictEqual(document.querySelectorAll('main h1#card').length, enabled ? 2 : 0);
      assert.strictEqual(document.querySelectorAll('.fragment').length, enabled ? 0 : 1);
      assert.strictEqual(document.querySelectorAll('p > a[href="/fragments/card"]').length, enabled ? 0 : 1);
      assert.strictEqual(fixture.loads.length, enabled ? 4 : 1);
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
    });
  }

  it('is disabled by default and leaves the response unchanged', async () => {
    const fixture = setup();
    const { res, document } = await run(fixture);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(document.querySelector('header').children.length, 0);
    assert.strictEqual(document.querySelector('footer').children.length, 0);
    assert.ok(document.querySelector('a[href="/fragments/card"]'));
    assert.strictEqual(fixture.loads.length, 1);
    assert.strictEqual(res.headers.get('last-modified'), DATE);
    assert.strictEqual(res.headers.get('x-inline-error'), undefined);
  });

  it('accepts false and preserves both generic links and authored blocks', async () => {
    const results = await Promise.all([{}, { inlineFragments: false }].map(async (rendering) => {
      const fixture = setup(rendering);
      fixture.put('/index.md', `# Parent\n\n${fragmentLink()}\n\n${fragmentBlock()}`);
      const { res, document } = await run(fixture);
      assert.strictEqual(res.status, 200);
      assert.ok(document.querySelector('p > a[href="/fragments/card"]'));
      assert.ok(document.querySelector('.fragment a[href="/fragments/card"]'));
      assert.strictEqual(fixture.loads.length, 1);
      return res.body;
    }));
    assert.strictEqual(results[0], results[1]);
  });

  describe('Fragment inline limit', () => {
    for (const limits of [{}, { rendering: {} }]) {
      it(`defaults to 10 with incomplete limits configuration ${JSON.stringify(limits)}`, async () => {
        const fixture = setup({ inlineFragments: true }, {
          config: { limits },
        });
        fixture.put('/index.md', Array(11).fill(fragmentBlock()).join('\n'));
        const { document } = await run(fixture);
        assert.strictEqual(document.querySelectorAll('h1#card').length, 10);
        assert.strictEqual(document.querySelectorAll('.fragment').length, 1);
      });
    }

    it('does not enable fragment inlining when only the root limit is configured', async () => {
      const fixture = setup({}, { config: { limits: { rendering: { maxFragments: 1 } } } });
      const { document } = await run(fixture);
      assert.ok(document.querySelector('.fragment'));
      assert.strictEqual(document.querySelector('h1#card'), null);
      assert.strictEqual(fixture.loads.length, 1);
    });

    for (const source of [fragmentBlock, fragmentLink]) {
      for (const shared of [false, true]) {
        for (const count of [9, 10, 11]) {
          it(`defaults to 10 occurrences for ${count} ${shared ? 'shared' : 'standalone'} ${source === fragmentBlock ? 'blocks' : 'links'}`, async () => {
            const fixture = setup({ inlineFragments: true });
            const fragments = Array(count).fill(source()).join(shared ? '\n\n' : '\n\n---\n\n');
            fixture.put('/index.md', `# Page with inline fragments\n\n---\n\n${fragments}`);
            const { document, res } = await run(fixture);
            assert.strictEqual(document.querySelectorAll('main h1#card').length, Math.min(count, 10));
            assert.strictEqual(document.querySelectorAll('.fragment').length, Math.max(count - 10, 0));
            assert.strictEqual(fixture.loads.length, 2);
            assert.strictEqual(res.headers.get('x-inline-error'), undefined);
          });
        }
      }
    }

    it('limits distinct loads in document order without counting nonmatching links or unsupported paths', async () => {
      const fixture = setup({ inlineFragments: true }, {
        config: { limits: { rendering: { maxFragments: 2 } } },
      });
      fixture.put('/index.md', `${fragmentLink('/other')}\n\n${fragmentBlock('/fragments/unsupported.html')}\n${fragmentLink('/fragments/one')}\n\n${fragmentBlock('/fragments/two')}\n${fragmentBlock('/fragments/three')}`);
      fixture.put('/fragments/one.md', '# One\n');
      fixture.put('/fragments/two.md', '# Two\n');
      fixture.put('/fragments/three.md', '# Three\n', { 'last-modified': NEWER });
      const { document, res } = await run(fixture);
      assert.ok(document.querySelector('h1#one'));
      assert.ok(document.querySelector('h1#two'));
      assert.strictEqual(document.querySelector('h1#three'), null);
      assert.ok(document.querySelector('.fragment a[href="/fragments/three"]'));
      assert.strictEqual(fixture.loads.length, 3);
      assert.ok(!fixture.loads.some((load) => load.endsWith('/fragments/three.md')));
      assert.strictEqual(res.headers.get('last-modified'), DATE);
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
      const key = await computeContentPathKey({
        contentBusId: 'content-id', info: { path: '/fragments/three' },
      });
      assert.ok(!res.headers.get('x-surrogate-key').split(' ').includes(key));
    });

    it('supports a configured limit above the default', async () => {
      const fixture = setup({ inlineFragments: true }, {
        config: { limits: { rendering: { maxFragments: 12 } } },
      });
      fixture.put('/index.md', Array(13).fill(fragmentBlock()).join('\n'));
      const { document } = await run(fixture);
      assert.strictEqual(document.querySelectorAll('h1#card').length, 12);
      assert.strictEqual(document.querySelectorAll('.fragment').length, 1);
      assert.strictEqual(fixture.loads.length, 2);
    });

    it('allows zero without limiting header or footer loads', async () => {
      const fixture = setup({
        inlineHeader: true,
        inlineFooter: true,
        inlineFragments: true,
      }, {
        config: { limits: { rendering: { maxFragments: 0 } } },
      });
      const { document, res } = await run(fixture);
      assert.ok(document.querySelector('header h1'));
      assert.ok(document.querySelector('footer h1'));
      assert.ok(document.querySelector('.fragment a[href="/fragments/card"]'));
      assert.strictEqual(fixture.loads.length, 3);
      assert.strictEqual(res.headers.get('last-modified'), DATE);
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
    });

    it('does not count header or footer loads against a positive fragment limit', async () => {
      const fixture = setup({
        inlineHeader: true,
        inlineFooter: true,
        inlineFragments: true,
      }, {
        config: { limits: { rendering: { maxFragments: 1 } } },
      });
      const { document } = await run(fixture);
      assert.ok(document.querySelector('header h1'));
      assert.ok(document.querySelector('footer h1'));
      assert.ok(document.querySelector('main h1#card'));
      assert.strictEqual(document.querySelector('.fragment'), null);
      assert.strictEqual(fixture.loads.length, 4);
    });

    it('counts failed dependency attempts toward the limit', async () => {
      const fixture = setup({ inlineFragments: true }, {
        config: { limits: { rendering: { maxFragments: 1 } } },
      });
      fixture.put('/index.md', `${fragmentBlock('/fragments/missing')}\n${fragmentBlock()}`);
      const { document, res } = await run(fixture);
      assert.strictEqual(document.querySelectorAll('.fragment').length, 2);
      assert.ok(!fixture.loads.some((load) => load.endsWith('/fragments/card.md')));
      assert.match(res.headers.get('x-inline-error'), /failed to inline \/fragments\/missing/);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    });

    for (const linked of [true, false]) {
      it(`keeps overflow ${linked ? 'linked' : 'plain-text'} blocks client-loadable`, async () => {
        const fixture = setup({ inlineFragments: true }, {
          config: { limits: { rendering: { maxFragments: 0 } } },
        });
        const plainBlock = '+-----------------+\n| Fragment        |\n+=================+\n| /fragments/card |\n+-----------------+\n';
        fixture.put('/index.md', linked ? fragmentBlock() : plainBlock);
        const { document } = await run(fixture);
        const block = document.querySelector('.fragment');
        assert.ok(block);
        if (linked) {
          assert.strictEqual(block.querySelector('a').getAttribute('href'), '/fragments/card');
        } else {
          assert.strictEqual(block.textContent.trim(), '/fragments/card');
        }
        assert.strictEqual(fixture.loads.length, 1);
      });
    }

    for (const limit of [-1, 1.5, '10', null, true, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      it(`rejects invalid limit ${String(limit)}`, async () => {
        const { res } = await run(setup({ inlineFragments: true }, {
          config: { limits: { rendering: { maxFragments: limit } } },
        }));
        assert.strictEqual(res.status, 500);
        assert.match(res.headers.get('x-error'), /invalid limits\.rendering\.maxFragments/);
      });
    }
  });

  describe('Generic link and fragment block HTML parity', () => {
    const path = '/fragments/card';
    const link = `[${path}](${path})`;
    const metadata = '| Section Metadata | |\n| --- | --- |\n| Style | Red |\n| Foo | parent |\n';
    const content = '# First\n\nFirst paragraph.\n\n| Section Metadata | |\n| --- | --- |\n| Style | Highlight |\n| Foo | fragment |\n\n---\n\n| Cards |\n| --- |\n| Card content |\n\n![Image](./media_image.png)\n';
    for (const [name, parent, limits, missing = false] of [
      ['standalone section', (fragment) => fragment],
      ['standalone section with comments', (fragment) => `<!-- Parent comment -->\n\n${fragment}`],
      ['standalone section with parent metadata', (fragment) => `${fragment}\n\n${metadata}`],
      ['shared section with parent metadata', (fragment) => `# Before\n\n${fragment}\n\nAfter.\n\n${metadata}`],
      ['multiple shared references', (fragment) => `${fragment}\n\n${fragment}`],
      ['multiple standalone references', (fragment) => `${fragment}\n\n---\n\n${fragment}`],
      ['overflow in a shared section', (fragment) => `${fragment}\n\n${fragment}`, { rendering: { maxFragments: 1 } }],
      ['overflow in standalone sections', (fragment) => `${fragment}\n\n---\n\n${fragment}`, { rendering: { maxFragments: 1 } }],
      ['zero limit', (fragment) => fragment, { rendering: { maxFragments: 0 } }],
      ['failed standalone dependency', (fragment) => fragment, undefined, true],
      ['failed shared dependency', (fragment) => `Before.\n\n${fragment}\n\nAfter.`, undefined, true],
    ]) {
      it(`produces identical HTML for a ${name}`, async () => {
        const results = await Promise.all([link, fragmentBlock(path)].map(async (fragment) => {
          const fixture = setup({ version: 2, inlineFragments: true }, { config: { limits } });
          fixture.put('/index.md', `# Page with inline fragments\n\n---\n\n${parent(fragment)}`);
          fixture.put(`${path}.md`, content);
          if (missing) {
            fixture.s3Loader.reply('helix-content-bus', `content-id/live${path}.md`, {
              status: 404, body: '', headers: new Map(),
            });
          }
          const { res } = await run(fixture);
          assert.strictEqual(res.status, 200);
          return { res, loads: fixture.loads };
        }));
        assert.strictEqual(results[0].res.body, results[1].res.body);
        assert.deepStrictEqual([...results[0].res.headers], [...results[1].res.headers]);
        assert.deepStrictEqual(results[0].loads, results[1].loads);
      });
    }

    for (const unsupportedPath of [
      '/fragments/card?test=1', '/fragments/card#inline',
      '/fragments/card.html', '/fragments/card.md', '/fragments/card.plain.html',
    ]) {
      it(`produces identical client fallback HTML for the unsupported path ${unsupportedPath}`, async () => {
        const results = await Promise.all([
          fragmentLink(unsupportedPath), fragmentBlock(unsupportedPath),
        ].map(async (fragment) => {
          const fixture = setup({ inlineFragments: true });
          fixture.put('/index.md', `# Parent\n\n---\n\n${fragment}`);
          const { res, document } = await run(fixture);
          assert.strictEqual(res.status, 200);
          assert.strictEqual(document.querySelector('.fragment a').getAttribute('href'), unsupportedPath);
          assert.strictEqual(fixture.loads.length, 1);
          return res.body;
        }));
        assert.strictEqual(results[0], results[1]);
      });
    }

    for (const source of [
      '<a href="/fragments/card">/fragments/card</a>',
      '<p>\n  <a href="/fragments/card">/fragments/card</a>\n</p>',
    ]) {
      it(`normalizes a raw HTML fragment link: ${source}`, async () => {
        const results = await Promise.all([source, fragmentBlock()]
          .map(async (fragment) => {
            const fixture = setup({ inlineFragments: true }, {
              config: { limits: { rendering: { maxFragments: 0 } } },
            });
            fixture.put('/index.md', `# Parent\n\n---\n\n${fragment}`);
            const { res } = await run(fixture);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(fixture.loads.length, 1);
            return res.body;
          }));
        assert.strictEqual(results[0], results[1]);
      });
    }
  });

  it('inlines header, footer, and fragment content and merges dependency keys and dates', async () => {
    const fixture = setup({
      inlineHeader: true, inlineFooter: true, inlineFragments: true,
    });
    const { res, document } = await run(fixture);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(document.querySelector('header h1').textContent, 'Navigation');
    assert.strictEqual(document.querySelector('footer h1').textContent, 'Footer');
    assert.strictEqual(document.querySelector('main h1#card').textContent, 'Card');
    assert.strictEqual(document.querySelector('main a'), null);
    assert.strictEqual(document.querySelector('main p'), null);
    assert.strictEqual(document.querySelector('title').textContent, 'Parent');
    assert.strictEqual(res.headers.get('last-modified'), NEWER);
    const keys = res.headers.get('x-surrogate-key').split(' ');
    await Promise.all(['/', '/nav', '/footer', '/fragments/card'].map(async (path) => {
      assert.ok(keys.includes(await computeContentPathKey({
        contentBusId: 'content-id', info: { path },
      })));
    }));
    assert.strictEqual(keys.length, new Set(keys).size);
    assert.strictEqual(fixture.loads.length, 4);
  });

  for (const [option, tag, other] of [
    ['inlineHeader', 'header', 'footer'], ['inlineFooter', 'footer', 'header'],
  ]) {
    it(`supports independently enabled ${tag}`, async () => {
      const fixture = setup({ [option]: true });
      const { document } = await run(fixture);
      assert.ok(document.querySelector(`${tag} h1`));
      assert.strictEqual(document.querySelector(other).children.length, 0);
      assert.strictEqual(fixture.loads.length, 2);
    });
  }

  it('defaults to /nav and /footer when metadata is absent', async () => {
    const fixture = setup({ inlineHeader: true, inlineFooter: true }, {
      config: { metadata: undefined },
    });
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('header h1').textContent, 'Navigation');
    assert.strictEqual(document.querySelector('footer h1').textContent, 'Footer');
    assert.strictEqual(fixture.loads.length, 3);
  });

  it('uses configured header metadata while defaulting only the missing footer metadata', async () => {
    const fixture = setup({ inlineHeader: true, inlineFooter: true }, {
      config: {
        metadata: { live: { data: { '/': [{ key: 'nav', value: '/fragments/card' }] } } },
      },
    });
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('header h1').textContent, 'Card');
    assert.strictEqual(document.querySelector('footer h1').textContent, 'Footer');
    assert.strictEqual(fixture.loads.length, 3);
  });

  it('uses metadata authored on the page', async () => {
    const fixture = setup({ inlineHeader: true });
    fixture.put('/index.md', '# Parent\n\n| Metadata | |\n| --- | --- |\n| nav | /fragments/card |\n');
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('header h1').textContent, 'Card');
  });

  it('deduplicates targets across fragments and header/footer while preserving independent trees', async () => {
    const fixture = setup({
      inlineHeader: true, inlineFooter: true, inlineFragments: true,
    }, {
      config: {
        metadata: {
          live: { data: { '/': [{ key: 'nav', value: '/shared' }, { key: 'footer', value: '/shared' }] } },
        },
      },
    });
    fixture.put('/index.md', `# Parent\n\n---\n\n${fragmentBlock('/shared')}\n---\n\n${fragmentBlock('/shared')}`);
    fixture.put('/shared.md', '# Shared\n\n[Child](/nested#inline)\n');
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelectorAll('h1#shared').length, 4);
    assert.strictEqual(document.querySelectorAll('a[href="/nested#inline"]').length, 4);
    assert.strictEqual(fixture.loads.filter((load) => load.endsWith('/shared.md')).length, 1);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('does not recursively expand self-references', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Parent\n\n---\n\n${fragmentBlock('/')}`);
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelectorAll('h1').length, 2);
    assert.ok(document.querySelector('a[href="/"]'));
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('does not use queries or hashes as generic fragment markers', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Parent\n\n${fragmentLink('/content/card#inline')}\n\n${fragmentLink('/other?path=/fragments/')}\n`);
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('h1#card'), null);
    assert.ok(document.querySelector('a[href="/content/card#inline"]'));
    assert.ok(document.querySelector('a[href="/other?path=/fragments/"]'));
    assert.strictEqual(fixture.loads.length, 1);
  });

  for (const block of [false, true]) {
    for (const [name, href, genericExpected] of [
      ['fragment marker', '/fragments/card', true],
      ['nested fragment marker', '/inlines/fragments/card', true],
      ['nonmatching path', '/content/card', false],
      ['marker lookalike', '/fragmentsfoo/card', false],
      ['missing trailing slash', '/fragments', false],
    ]) {
      it(`${block ? 'inlines an explicit fragment block with' : 'filters a generic link with'} a ${name}`, async () => {
        const fixture = setup({ inlineFragments: true });
        const markdown = block
          ? fragmentBlock(href)
          : fragmentLink(href);
        fixture.put('/index.md', markdown);
        fixture.put(`${href}.md`, '# Card\n');
        const { document } = await run(fixture);
        const inlined = block || genericExpected;
        assert.strictEqual(document.querySelector('h1#card') !== null, inlined);
        assert.strictEqual(document.querySelector(`a[href="${href}"]`) !== null, !inlined);
        assert.strictEqual(document.querySelector('.fragment') !== null, block && !inlined);
        assert.strictEqual(fixture.loads.length, inlined ? 2 : 1);
      });
    }
  }

  it('leaves unmarked generic links unchanged', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '[/content/card](/content/card)\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('a[href="/content/card"]'));
    assert.strictEqual(fixture.loads.length, 1);
  });

  for (const path of ['/content/', '/content/card.html', '/content/card.md', '/content/card.plain.html']) {
    it(`supports the header dependency path ${path}`, async () => {
      const fixture = setup({ inlineHeader: true }, {
        config: { metadata: { live: { data: { '/': [{ key: 'nav', value: path }] } } } },
      });
      fixture.put('/content/index.md', '# Directory\n');
      const { document } = await run(fixture);
      assert.ok(document.querySelector(`header h1#${path.endsWith('/') ? 'directory' : 'card'}`));
      assert.strictEqual(fixture.loads.length, 2);
    });
  }

  it('preserves surrounding text when the link is not alone', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Parent\n\nBefore ${fragmentLink()} after\n`);
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('main p').textContent, 'Before /fragments/card after');
    assert.strictEqual(fixture.loads.length, 1);
  });

  it('ignores generic links inside unrelated block cells', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Parent\n\n| Cards |\n| --- |\n| ${fragmentLink()} |\n`);
    const { document } = await run(fixture);
    assert.ok(document.querySelector('.cards a[href="/fragments/card"]'));
    assert.strictEqual(document.querySelector('.cards h1#card'), null);
    assert.strictEqual(fixture.loads.length, 1);
  });

  it('leaves paragraphs with multiple links, empty paragraphs, and anchors without href unchanged', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Parent\n\n${fragmentLink()} ${fragmentLink('/fragments/other')}\n\n<p> </p>\n\n<p><a>/fragments/card</a></p>\n`);
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelectorAll('main a').length, 3);
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(fixture.loads.length, 1);
  });

  it('inlines plain-text paths in explicit fragment blocks without a fragment marker', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| /content/card |\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main > div > h1#card'));
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('replaces an entire standalone fragment grid-table section with fragment sections', async () => {
    const fixture = setup({ version: 2, inlineFragments: true });
    fixture.put('/index.md', '+-----------------+\n| Fragment        |\n+=================+\n| /fragments/card |\n+-----------------+\n');
    fixture.put('/fragments/card.md', '# First\n\n| Cards |\n| --- |\n| Card content |\n\n| Section Metadata | |\n| --- | --- |\n| Style | Highlight |\n| ID | First Section |\n\n---\n\n# Second\n\nSecond section content.\n');
    const { document } = await run(fixture);
    const sections = [...document.querySelector('main').children];
    assert.strictEqual(sections.length, 2);
    assert.strictEqual(sections[0].id, 'first-section');
    assert.ok(sections[0].classList.contains('highlight'));
    assert.ok(sections[0].querySelector('.cards'));
    assert.strictEqual(sections[1].querySelector('h1').textContent, 'Second');
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(document.querySelector('main > div > div > h1'), null);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('uses the first link of a standalone fragment block', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Card](/fragments/card) |\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main > div > h1#card'));
    assert.strictEqual(document.querySelector('.fragment'), null);
  });

  for (const path of [
    '/fragments/card?test=1',
    '/fragments/card#inline',
    '/fragments/card.html', '/fragments/card.md', '/fragments/card.plain.html',
  ]) {
    it(`retains a fragment-block path that the client does not normalize: ${path}`, async () => {
      const fixture = setup({ inlineFragments: true });
      fixture.put('/index.md', `| Fragment |\n| --- |\n| [Card](${path}) |\n`);
      const { document } = await run(fixture);
      assert.strictEqual(document.querySelector('.fragment a').getAttribute('href'), path);
      assert.strictEqual(fixture.loads.length, 1);
    });
  }

  it('discards the standalone host section metadata when replacing it, like the client', async () => {
    const fixture = setup({ version: 2, inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Card](/fragments/card) |\n\n| Section Metadata | |\n| --- | --- |\n| Style | Parent Style |\n| ID | Parent ID |\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main > div > h1#card'));
    assert.strictEqual(document.querySelector('#parent-id'), null);
    assert.strictEqual(document.querySelector('.parent-style'), null);
  });

  it('inlines shared-section fragment blocks while preserving surrounding content', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '# Before\n\n| Fragment |\n| --- |\n| [Card](/fragments/card) |\n\nAfter.\n');
    const { document, res } = await run(fixture);
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.ok(document.querySelector('h1#card'));
    assert.ok(document.querySelector('h1#before'));
    assert.strictEqual(document.querySelector('main p').textContent, 'After.');
    assert.strictEqual(document.querySelectorAll('main > div').length, 1);
    assert.strictEqual(fixture.loads.length, 2);
    assert.strictEqual(res.headers.get('x-inline-error'), undefined);
  });

  it('inlines multiple fragment blocks sharing a section with one dependency load', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [One](/fragments/card) |\n\n| Fragment |\n| --- |\n| [Two](/fragments/card) |\n');
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(document.querySelectorAll('main > div > h1#card').length, 2);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('replaces multiple standalone sections while loading a repeated dependency only once', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [One](/fragments/card) |\n\n---\n\n| Fragment |\n| --- |\n| [Two](/fragments/card) |\n');
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelectorAll('main > div > h1#card').length, 2);
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('preserves the whole standalone fragment block when the dependency fails', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Missing](/missing) |\n');
    const { document, res } = await run(fixture);
    assert.ok(document.querySelector('main > div > .fragment a[href="/missing"]'));
    assert.strictEqual(document.querySelectorAll('main > div').length, 1);
    assert.match(res.headers.get('x-inline-error'), /failed to inline \/missing:/);
  });

  it('preserves a shared section and its fragment block when the dependency fails', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', `# Before\n\n${fragmentBlock('/missing')}\nAfter.\n`);
    const { document, res } = await run(fixture);
    assert.ok(document.querySelector('main > div > h1#before'));
    assert.ok(document.querySelector('main > div > .fragment a[href="/missing"]'));
    assert.strictEqual(document.querySelector('main p').textContent, 'After.');
    assert.strictEqual(document.querySelectorAll('main > div').length, 1);
    assert.match(res.headers.get('x-inline-error'), /failed to inline \/missing:/);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  });

  it('does not expand fragment blocks introduced by a server-inlined document', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Card](/fragments/card) |\n');
    fixture.put('/fragments/card.md', '| Fragment |\n| --- |\n| [Nested](/nested) |\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main > div > .fragment a[href="/nested"]'));
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('does not expand generic fragment links introduced by a server-inlined document', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', fragmentBlock());
    fixture.put('/fragments/card.md', `# Card\n\n${fragmentLink('/fragments/nested')}\n`);
    fixture.put('/fragments/nested.md', '# Nested\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main a[href="/fragments/nested"]'));
    assert.strictEqual(document.querySelector('h1#nested'), null);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('does not expand external or protocol-relative links', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '# Parent\n\n[External](https://other.example/fragments/card#inline)\n\n[Protocol](//other.example/card#inline)\n');
    const { document } = await run(fixture);
    assert.strictEqual(document.querySelectorAll('a').length, 2);
    assert.strictEqual(fixture.loads.length, 1);
  });

  for (const path of ['https://other.example/fragments/card', '//other.example/fragments/card', 'relative/card']) {
    it(`retains a fragment block with a non-root-relative path: ${path}`, async () => {
      const fixture = setup({ inlineFragments: true });
      fixture.put('/index.md', fragmentBlock(path));
      const { document, res } = await run(fixture);
      assert.strictEqual(document.querySelector('.fragment a').getAttribute('href'), path);
      assert.strictEqual(fixture.loads.length, 1);
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
    });
  }

  it('retains authored fragment blocks nested inside another block', async () => {
    const fixture = setup({ inlineFragments: true }, {
      config: { limits: { rendering: { maxFragments: 1 } } },
    });
    fixture.put('/index.md', '# Parent\n');
    const { res } = await run(fixture);
    // Markdown table conversion does not create nested blocks; test the rendered HAST directly.
    const nested = h('div.fragment', [
      h('div', [h('div', [h('a', { href: '/fragments/card' }, '/fragments/card')])]),
    ]);
    const cards = h('div.cards', [h('div', [h('div', [nested])])]);
    const sibling = h('div.fragment', [
      h('div', [h('div', [h('a', { href: '/fragments/card' }, '/fragments/card')])]),
    ]);
    const section = h('div', [cards, sibling]);
    res.document = { type: 'root', children: [h('main', [section])] };
    await inlineResources(fixture.state, fixture.req, res, htmlPipe);
    assert.strictEqual(cards.children[0].children[0].children[0], nested);
    assert.ok(section.children.some((node) => node.tagName === 'h1' && node.properties.id === 'card'));
    assert.strictEqual(fixture.loads.length, 2);
    assert.strictEqual(res.headers.get('x-inline-error'), undefined);
  });

  it('preserves relative links and rebases fragment media like the client renderer', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '# Parent\n\n---\n\n| Fragment |\n| --- |\n| [/fragments/card](/fragments/card) |\n');
    fixture.put('/fragments/card.md', '# Card\n\n[Details](details)\n\n![Image](./media_image.png)\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('a[href="details"]'));
    assert.ok(document.querySelector('picture img[src^="https://main--repo--owner.aem.live/fragments/media_image.png"]'));
    assert.ok([...document.querySelectorAll('picture source')]
      .every((source) => source.getAttribute('srcset').startsWith('https://main--repo--owner.aem.live/fragments/media_image.png')));
  });

  it('preserves metadata and rebases media when inlining a directory fragment', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', fragmentBlock('/fragments/'));
    fixture.put('/fragments/index.md', '# Directory\n\n![Image](./media_image.png)\n\n| Section Metadata | |\n| --- | --- |\n| Style | Highlight |\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('main > div.highlight > h1#directory'));
    assert.ok(document.querySelector('img[src^="https://main--repo--owner.aem.live/fragments/media_image.png"]'));
    assert.strictEqual(document.querySelector('.fragment'), null);
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('rebases media to the forwarded page host instead of an internal pipeline host', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Card](/fragments/card) |\n');
    fixture.put('/fragments/card.md', '![Image](./media_image.png)\n');
    fixture.req.url = new URL('http://localhost:3000/');
    fixture.req.headers.set('x-forwarded-host', 'www.example.com');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('img[src^="https://www.example.com/fragments/media_image.png"]'));
  });

  it('does not mutate a header dependency when the same document is also inlined as a fragment', async () => {
    const fixture = setup({ inlineHeader: true, inlineFragments: true });
    fixture.put('/index.md', '| Fragment |\n| --- |\n| [Nav](/nav) |\n');
    fixture.put('/nav.md', '![Image](./media_image.png)\n');
    const { document } = await run(fixture);
    assert.ok(document.querySelector('header img[src^="./media_image.png"]'));
    assert.ok(document.querySelector('main img[src^="https://main--repo--owner.aem.live/media_image.png"]'));
    assert.strictEqual(fixture.loads.length, 2);
  });

  it('uses preview content and preview dependency keys', async () => {
    const fixture = setup({ inlineHeader: true }, { partition: 'preview' });
    const { res, document } = await run(fixture);
    assert.ok(document.querySelector('header h1'));
    const hash = await computeContentPathKey({
      contentBusId: 'content-id', info: { path: '/nav' },
    });
    assert.ok(res.headers.get('x-surrogate-key').split(' ').includes(`p_${hash}`));
    assert.ok(fixture.loads.every((load) => load.includes('/preview/')));
  });

  it('applies folder mapping to dependencies and includes mapped and original keys', async () => {
    const fixture = setup({ inlineFragments: true }, {
      config: { folders: { '/virtual': '/fragments/card' } },
    });
    fixture.put('/index.md', fragmentBlock('/virtual'));
    const { res, document } = await run(fixture);
    assert.ok(document.querySelector('h1#card'));
    const hash = await computeContentPathKey({
      contentBusId: 'content-id', info: { path: '/virtual' },
    });
    assert.ok(res.headers.get('x-surrogate-key').split(' ').includes(hash));
  });

  it('does not inline a dependency folder-mapped to code-bus content', async () => {
    const fixture = setup({ inlineFragments: true }, {
      config: { folders: { '/virtual': '/raw.html' } },
    });
    fixture.put('/index.md', fragmentBlock('/virtual'));
    fixture.s3Loader.reply('helix-code-bus', 'owner/repo/main/raw.html', {
      status: 200,
      body: '<html><body><main>Code content</main></body></html>',
      headers: new Map([['last-modified', DATE]]),
    });
    const { res, document } = await run(fixture);
    assert.ok(document.querySelector('a[href="/virtual"]'));
    assert.ok(!res.body.includes('Code content'));
    assert.ok(res.headers.get('x-inline-error'));
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  });

  it('includes dependency-specific metadata last-modified without changing the parent title', async () => {
    const fixture = setup({ inlineHeader: true }, {
      config: {
        metadata: {
          live: {
            data: {
              '/': [{ key: 'nav', value: '/nav' }],
              '/nav': [
                { key: 'title', value: 'Dependency title' },
                { key: 'last-modified', value: NEWER },
              ],
            },
          },
        },
      },
    });
    const { res, document } = await run(fixture);
    assert.strictEqual(res.headers.get('last-modified'), NEWER);
    assert.strictEqual(document.querySelector('title').textContent, 'Parent');
  });

  for (const directive of ['private', 'no-cache', 'no-store']) {
    it(`does not cache a composed response containing a ${directive} dependency`, async () => {
      const fixture = setup({ inlineHeader: true }, {
        config: {
          headers: { '/nav': [{ key: 'cache-control', value: directive }] },
        },
      });
      const { res, document } = await run(fixture);
      assert.ok(document.querySelector('header h1'));
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
    });
  }

  for (const [name, response] of [
    ['missing', { status: 404, body: '', headers: new Map() }],
    ['unavailable', { status: 503, body: '', headers: new Map() }],
    ['redirected', {
      status: 200, body: '', headers: new Map([['x-amz-meta-redirect-location', '/elsewhere']]),
    }],
    ['network error', new Error('connection lost')],
  ]) {
    it(`preserves original content and disables caching for a ${name} dependency`, async () => {
      const fixture = setup({ inlineHeader: true, inlineFragments: true }, {
        config: {
          headers: {
            '/': [
              { key: 'cache-control', value: 'public, max-age=600' },
              { key: 'surrogate-control', value: 'max-age=600' },
              { key: 'cdn-cache-control', value: 'max-age=600' },
              { key: 'cloudflare-cdn-cache-control', value: 'max-age=600' },
              { key: 'edge-control', value: 'max-age=600' },
              { key: 'expires', value: NEWER },
            ],
          },
        },
      });
      fixture.put('/index.md', fragmentBlock('/broken'));
      fixture.s3Loader.reply('helix-content-bus', 'content-id/live/broken.md', response);
      const { res, document } = await run(fixture);
      assert.strictEqual(res.status, 200);
      assert.ok(document.querySelector('header h1'));
      assert.ok(document.querySelector('a[href="/broken"]'));
      assert.match(res.headers.get('x-inline-error'), /failed to inline \/broken:/);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      for (const header of [
        'surrogate-control', 'cdn-cache-control', 'cloudflare-cdn-cache-control',
        'edge-control', 'expires',
      ]) {
        assert.strictEqual(res.headers.get(header), undefined);
      }
      assert.ok(fixture.warnings.some((warning) => warning.includes('failed to inline')));
    });
  }

  it('rejects external header locations without making an external fetch', async () => {
    const fixture = setup({ inlineHeader: true }, {
      config: { metadata: { live: { data: { '/': [{ key: 'nav', value: 'https://other.example/nav' }] } } } },
    });
    const { res, document } = await run(fixture);
    assert.strictEqual(document.querySelector('header').children.length, 0);
    assert.strictEqual(fixture.loads.length, 1);
    assert.match(res.headers.get('x-inline-error'), /expected a root-relative content path/);
  });

  it('preserves an empty header and reports a failed header dependency', async () => {
    const fixture = setup({ inlineHeader: true });
    fixture.s3Loader.reply('helix-content-bus', 'content-id/live/nav.md', {
      status: 404, body: '', headers: new Map(),
    });
    const { res, document } = await run(fixture);
    assert.strictEqual(document.querySelector('header').children.length, 0);
    assert.match(res.headers.get('x-inline-error'), /failed to inline \/nav:/);
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  });

  it('reports malformed paths without failing the parent page', async () => {
    const fixture = setup({ inlineFragments: true });
    fixture.put('/index.md', fragmentBlock('/content//card'));
    const { res, document } = await run(fixture);
    assert.strictEqual(res.status, 200);
    assert.ok(document.querySelector('a'));
    assert.match(res.headers.get('x-inline-error'), /invalid content path/);
    assert.strictEqual(fixture.loads.length, 1);
  });

  it('does not inline on an unsuccessful parent response', async () => {
    const fixture = setup({ inlineHeader: true }, { path: '/missing' });
    const { res } = await run(fixture);
    assert.strictEqual(res.status, 404);
    assert.ok(!fixture.loads.some((load) => load.endsWith('/nav.md')));
    assert.strictEqual(res.headers.get('x-inline-error'), undefined);
  });

  for (const path of ['/', '/index.plain.html', '/index.md', '/raw.html']) {
    it(`leaves ${path} unchanged when inlining cannot apply`, async () => {
      const fixture = setup({
        inlineHeader: true, inlineFooter: true, inlineFragments: true,
      }, { path, method: path === '/' ? 'HEAD' : 'GET' });
      fixture.s3Loader.reply('helix-code-bus', 'owner/repo/main/raw.html', {
        status: 200,
        body: '<header></header><a href="/nav#inline">Nav</a>',
        headers: new Map([['last-modified', DATE]]),
      });
      const { res } = await run(fixture);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(fixture.loads.length, 1);
      assert.strictEqual(res.headers.get('x-inline-error'), undefined);
    });
  }

  for (const rendering of [
    { inlineHeader: 'true' },
    { inlineFooter: 1 },
    { inlineFragments: 'true' },
    { inlineFragments: null },
    { inlineFragments: [] },
    { inlineFragments: 1 },
    { inlineFragments: {} },
    { inlineFragments: { paths: ['/fragments/'] } },
  ]) {
    it(`reports invalid configuration: ${JSON.stringify(rendering)}`, async () => {
      const { res } = await run(setup(rendering));
      assert.strictEqual(res.status, 500);
      assert.match(res.headers.get('x-error'), /invalid inline/);
    });
  }
});
