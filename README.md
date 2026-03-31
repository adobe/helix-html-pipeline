# Helix HTML Pipeline

This package contains the common code for `helix-pipeline-service` and `helix-cloudflare-page` for rendering the html response for helix3. it has the following design goals:

- be platform neutral, i.e. not using node or browser specific modules or dependencies.
- +/-0 runtime dependencies (eg. node [crypto](https://nodejs.org/api/crypto.html))
- offer extension interfaces where platform abstraction is required (e.g. reading from S3, sending to SQS)

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-html-pipeline.svg)](https://codecov.io/gh/adobe/helix-html-pipeline)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/adobe/helix-html-pipeline/main.yaml)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-html-pipeline.svg)](https://github.com/adobe/helix-html-pipeline/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-html-pipeline.svg)](https://github.com/adobe/helix-html-pipeline/issues)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

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

## Installation

```bash
$ npm install @adobe/helix-html-pipeline
```
## Development

### Build

```bash
$ npm install
```

### Test

```bash
$ npm test
```

### Lint

```bash
$ npm run lint
```
