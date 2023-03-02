# Helix HTML Pipeline

> NOTE: 1.x is no longer supported.

This package contains the common code for `helix-pipeline-service` and `helix-cloudflare-page` for rendering the html response for helix3. it has the following design goals:

- be platform neutral, i.e. not using node or browser specific modules or dependencies.
- +/-0 runtime dependencies (eg. node [crypto](https://nodejs.org/api/crypto.html))
- offer extension interfaces where platform abstraction is required (e.g. reading from S3, sending to SQS)

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-html-pipeline.svg)](https://codecov.io/gh/adobe/helix-html-pipeline)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-html-pipeline.svg)](https://circleci.com/gh/adobe/helix-html-pipeline)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-html-pipeline.svg)](https://github.com/adobe/helix-html-pipeline/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-html-pipeline.svg)](https://github.com/adobe/helix-html-pipeline/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-html-pipeline.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-html-pipeline)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

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
