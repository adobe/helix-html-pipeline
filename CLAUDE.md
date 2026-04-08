# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test          # Run tests with c8 code coverage
npm run lint      # Run ESLint
npm ci            # Install dependencies (CI-style)
```

Run a single test file:
```bash
npx mocha test/html-pipe.test.js
```

Run a specific test by name (grep):
```bash
npx mocha --grep "test name" test/rendering.test.js
```

## Architecture

This is a platform-neutral (Node + Cloudflare Worker) library for rendering Helix3 HTML responses. It serves as shared code between `helix-pipeline-service` and `helix-cloudflare-page`.

### Entry Points (Pipe Functions)

Each HTTP response type has a dedicated "pipe" function:
- **`htmlPipe`** (`src/html-pipe.js`) — Markdown → HTML rendering pipeline (30+ steps)
- **`jsonPipe`** (`src/json-pipe.js`) — JSON response pipeline with folder mapping
- **`optionsPipe`** (`src/options-pipe.js`) — HTTP OPTIONS method handler
- **`robotsPipe`** (`src/robots-pipe.js`) — `robots.txt` generation
- **`sitemapPipe`** (`src/sitemap-pipe.js`) — XML sitemap generation

### Core Classes

- **`PipelineState`** — Execution context; holds org, site, repo, owner, ref, partition, metadata, headers, and content
- **`PipelineRequest`** / **`PipelineResponse`** — HTTP request/response wrappers
- **`PipelineContent`** — Content container (source markdown, parsed AST, rendered HTML)
- **`PipelineStatusError`** — Custom error for pipeline-specific HTTP status codes

### Pipeline Steps Pattern

Each step is an async function with signature `(state, req?, res?) => void`. Steps live in `src/steps/` and are composed in sequence within each pipe function. Categories:
- **Content fetching**: `fetch-content.js`, `fetch-404.js`, `fetch-sourced-metadata.js`
- **Markdown processing**: `parse-markdown.js`, `split-sections.js`
- **HTML transformation**: `make-html.js`, `create-page-blocks.js`, `create-pictures.js`, `extract-metadata.js`
- **URL rewriting**: `rewrite-urls.js`, `rewrite-icons.js`
- **Response formatting**: `stringify-response.js`, `render.js`, `render-code.js`

### AST Processing

Uses the `unified` ecosystem (remark for Markdown, rehype for HTML). The conversion path is: raw Markdown → mdast (via `remark-parse`) → hast (via custom `mdast-to-hast.js`) → serialized HTML (via `rehype-stringify`). Custom handling in `src/utils/mdast-to-hast.js` and `src/utils/hast-utils.js`.

### Platform Abstraction

Crypto operations use `src/utils/crypto.node.js` vs `src/utils/crypto.worker.js` to stay compatible with both Node.js and Cloudflare Worker runtimes. No Node-specific or browser-specific modules should be added as runtime dependencies.

### Content Sources

Content is fetched from two S3-backed sources:
- **Content bus** — Markdown and metadata (`.md`, `metadata.json`)
- **Code bus** — Templates, headers, footers, scripts

The S3 loader is injected into `PipelineState` and abstracted for testing via `test/FileS3Loader.js` and `test/StaticS3Loader.js`.

## Testing

Tests use Mocha + c8. Test fixtures live in `test/fixtures/` organized by type (`content/`, `code/`, `json/`, `mdasts/`, `sections/`). The `test/setup-env.js` file initializes the test environment.

Key test files:
- `test/rendering.test.js` — Large integration tests for HTML rendering (49KB)
- `test/html-pipe.test.js` / `test/json-pipe.test.js` — Pipe-level integration tests
- `test/steps/` and `test/utils/` — Unit tests for individual modules
