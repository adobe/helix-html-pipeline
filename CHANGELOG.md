## [3.1.1](https://github.com/adobe/helix-html-pipeline/compare/v3.1.0...v3.1.1) (2022-07-09)


### Bug Fixes

* **deps:** update dependency mdast-util-to-hast to v12.1.2 ([1c863bc](https://github.com/adobe/helix-html-pipeline/commit/1c863bcb06ef8af8ac3c6367121fa3a71aad38f5))

# [3.1.0](https://github.com/adobe/helix-html-pipeline/compare/v3.0.2...v3.1.0) (2022-06-24)


### Features

* improve authentication implementation ([#90](https://github.com/adobe/helix-html-pipeline/issues/90)) ([def347c](https://github.com/adobe/helix-html-pipeline/commit/def347cd0d4860d2804d71be6b702a6be30d6095)), closes [#85](https://github.com/adobe/helix-html-pipeline/issues/85)

## [3.0.2](https://github.com/adobe/helix-html-pipeline/compare/v3.0.1...v3.0.2) (2022-06-16)


### Bug Fixes

* make crypto.randomUUID() portable ([d40ba5a](https://github.com/adobe/helix-html-pipeline/commit/d40ba5ab67c764726d923061d4844e5adb162c86))

## [3.0.1](https://github.com/adobe/helix-html-pipeline/compare/v3.0.0...v3.0.1) (2022-06-14)


### Bug Fixes

* handle xfh properly and protect forms and json pipeline ([#83](https://github.com/adobe/helix-html-pipeline/issues/83)) ([9c13419](https://github.com/adobe/helix-html-pipeline/commit/9c1341987549fbc721a7d1bce12fe537a6f8c5ba))

# [3.0.0](https://github.com/adobe/helix-html-pipeline/compare/v2.1.2...v3.0.0) (2022-06-14)


### Features

* add site access control ([#80](https://github.com/adobe/helix-html-pipeline/issues/80)) ([2109d90](https://github.com/adobe/helix-html-pipeline/commit/2109d90a932b75a9de6996da2854d349613541b9))


### BREAKING CHANGES

* PipelineState now need to implement fetch() and createExternalLocation()

## [2.1.2](https://github.com/adobe/helix-html-pipeline/compare/v2.1.1...v2.1.2) (2022-06-04)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.11 ([811287b](https://github.com/adobe/helix-html-pipeline/commit/811287bbf168ee7ae0a305d958d7ca84ec1a75ca))

## [2.1.1](https://github.com/adobe/helix-html-pipeline/compare/v2.1.0...v2.1.1) (2022-06-02)


### Bug Fixes

* Lazy images ([#73](https://github.com/adobe/helix-html-pipeline/issues/73)) ([7442a5e](https://github.com/adobe/helix-html-pipeline/commit/7442a5e0720699d974332a2f5659fdddd27b0dc6))

# [2.1.0](https://github.com/adobe/helix-html-pipeline/compare/v2.0.4...v2.1.0) (2022-06-02)


### Features

* use /.helix/config-all.json ([#72](https://github.com/adobe/helix-html-pipeline/issues/72)) ([712046c](https://github.com/adobe/helix-html-pipeline/commit/712046c31d51eecc392bb2f0aabfd0e227ed595c))

## [2.0.4](https://github.com/adobe/helix-html-pipeline/compare/v2.0.3...v2.0.4) (2022-05-31)


### Bug Fixes

* fix glob matching for mapped pages ([c43e359](https://github.com/adobe/helix-html-pipeline/commit/c43e3590f9b564f988dfd35daeb5000e458dea71))
* rename mappedPath to unmappedPath ([12e0066](https://github.com/adobe/helix-html-pipeline/commit/12e0066c8da51ffcb16f8ac7e78306fae1a1cd93))

## [2.0.3](https://github.com/adobe/helix-html-pipeline/compare/v2.0.2...v2.0.3) (2022-05-30)


### Bug Fixes

* **deps:** update dependency @adobe/helix-markdown-support to v3.1.6 ([1dd999a](https://github.com/adobe/helix-html-pipeline/commit/1dd999a2c4ef3caf06a6b66dd7ff3e091166ea72))

## [2.0.2](https://github.com/adobe/helix-html-pipeline/compare/v2.0.1...v2.0.2) (2022-05-28)


### Bug Fixes

* **deps:** update external fixes ([#65](https://github.com/adobe/helix-html-pipeline/issues/65)) ([0994581](https://github.com/adobe/helix-html-pipeline/commit/09945810ee3969350b6053d49d1614c1e9051eba))

## [2.0.1](https://github.com/adobe/helix-html-pipeline/compare/v2.0.0...v2.0.1) (2022-05-25)


### Bug Fixes

* querystring is deprecated ([d693319](https://github.com/adobe/helix-html-pipeline/commit/d6933197e928da452712bcfb2c8a42cdefe2bf2c))
* respect fragments and querystring during link-rewrite ([44e00d4](https://github.com/adobe/helix-html-pipeline/commit/44e00d49293df392f4dec7eafee1abc60743ff79))

# [2.0.0](https://github.com/adobe/helix-html-pipeline/compare/v1.5.8...v2.0.0) (2022-05-25)


### Bug Fixes

* add link rewriting ([bde5fb6](https://github.com/adobe/helix-html-pipeline/commit/bde5fb6a15fcac24887897c0134d524677730741))
* clean up empty paragraphs ([30547b7](https://github.com/adobe/helix-html-pipeline/commit/30547b7cca7869bd791bfa0b5fee7b23d8548798))
* create <picture> tags ([88c1ab9](https://github.com/adobe/helix-html-pipeline/commit/88c1ab96c335a60092b8fcbe60de2d2e061809bf))
* detect and fix wrong dimensions fragment ([e0df3dc](https://github.com/adobe/helix-html-pipeline/commit/e0df3dc6bfa0c2f3acf771f8cea95f5237eddb00))
* improve block css class names ([ff05d3c](https://github.com/adobe/helix-html-pipeline/commit/ff05d3c38d92126ea65573d33639453ea5aaa5e6))
* preserve table-cell align attributes as data-attribures ([c5a5c1a](https://github.com/adobe/helix-html-pipeline/commit/c5a5c1aea3148c7ad44e44f40e7dd7b8eca19566))
* pretty-print html ([529facf](https://github.com/adobe/helix-html-pipeline/commit/529facf416a07e8a5050ec1a614eec23f9249efc))
* replace icon svgs with spans ([55aeeeb](https://github.com/adobe/helix-html-pipeline/commit/55aeeeb03578eef0ece877669969729e1ce68855))
* unwrap img inside em/strong ([dbc6a82](https://github.com/adobe/helix-html-pipeline/commit/dbc6a8204193aa7c79fda05024fe3d8f40093443))


### Features

* Breaking changes for 2022-05 ([f2d1523](https://github.com/adobe/helix-html-pipeline/commit/f2d1523d21eb2b9a57bdd658526c7a9ee8bd8056))


### BREAKING CHANGES

* icons: are now replaced with <span> elements
* the format of the css class names changed
* dom changes
* picture dom changed
* all links to media and same hlx sites are relativized
* empty <p></p> tags now properly sourround the following element, eg pictures
* inter-element whitespace changes

## [1.5.8](https://github.com/adobe/helix-html-pipeline/compare/v1.5.7...v1.5.8) (2022-05-19)


### Bug Fixes

* forms service expect repo and owner in message body ([a14e6a0](https://github.com/adobe/helix-html-pipeline/commit/a14e6a0800704a49173ae62ca95dfcbc2cdd3638))

## [1.5.7](https://github.com/adobe/helix-html-pipeline/compare/v1.5.6...v1.5.7) (2022-05-17)


### Bug Fixes

* **deps:** update dependency @adobe/helix-markdown-support to v3.1.5 ([10b3bb9](https://github.com/adobe/helix-html-pipeline/commit/10b3bb9175685b0367d1e834054974bc4da25b6e))

## [1.5.6](https://github.com/adobe/helix-html-pipeline/compare/v1.5.5...v1.5.6) (2022-05-17)


### Bug Fixes

* avoid leading digits in heading ids ([#60](https://github.com/adobe/helix-html-pipeline/issues/60)) ([b2af7bf](https://github.com/adobe/helix-html-pipeline/commit/b2af7bf23f8479ba31c410d5b0a3316bbe071481)), closes [#59](https://github.com/adobe/helix-html-pipeline/issues/59)

## [1.5.5](https://github.com/adobe/helix-html-pipeline/compare/v1.5.4...v1.5.5) (2022-05-16)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.10 ([#58](https://github.com/adobe/helix-html-pipeline/issues/58)) ([2761635](https://github.com/adobe/helix-html-pipeline/commit/2761635b891e76a6f16f0bc817abc7f2b7c28979))

## [1.5.4](https://github.com/adobe/helix-html-pipeline/compare/v1.5.3...v1.5.4) (2022-05-10)


### Bug Fixes

* **deps:** update dependency @adobe/helix-markdown-support to v3.1.4 ([#55](https://github.com/adobe/helix-html-pipeline/issues/55)) ([29a1a80](https://github.com/adobe/helix-html-pipeline/commit/29a1a808be2f5850cd4a6c5ff3ea2412e94bfc48))

## [1.5.3](https://github.com/adobe/helix-html-pipeline/compare/v1.5.2...v1.5.3) (2022-05-09)


### Reverts

* Revert "ci(release): tag releases in Coralogix (#49)" ([9a47ac1](https://github.com/adobe/helix-html-pipeline/commit/9a47ac19ea86752e1a56bd7d953f8e331cd448a4)), closes [#49](https://github.com/adobe/helix-html-pipeline/issues/49)

## [1.5.2](https://github.com/adobe/helix-html-pipeline/compare/v1.5.1...v1.5.2) (2022-05-08)


### Bug Fixes

* respect x-source-last-modified for json ([#51](https://github.com/adobe/helix-html-pipeline/issues/51)) ([094f22b](https://github.com/adobe/helix-html-pipeline/commit/094f22b4bc86306a3727472bdb1f03c65fe67012))

## [1.5.1](https://github.com/adobe/helix-html-pipeline/compare/v1.5.0...v1.5.1) (2022-05-06)


### Bug Fixes

* include owner and repo to forms message ([#48](https://github.com/adobe/helix-html-pipeline/issues/48)) ([aabb52f](https://github.com/adobe/helix-html-pipeline/commit/aabb52f96fbdba74d73c4e6e24c3ad710a18442d))

# [1.5.0](https://github.com/adobe/helix-html-pipeline/compare/v1.4.2...v1.5.0) (2022-05-04)


### Features

* always add twitter:card ([4b14e31](https://github.com/adobe/helix-html-pipeline/commit/4b14e3144625d9b457079ae7fc654621e3271e14)), closes [#46](https://github.com/adobe/helix-html-pipeline/issues/46)

## [1.4.2](https://github.com/adobe/helix-html-pipeline/compare/v1.4.1...v1.4.2) (2022-05-03)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.9 ([2aee8a3](https://github.com/adobe/helix-html-pipeline/commit/2aee8a3c70388a220bacdef1671e6c899b02736f))

## [1.4.1](https://github.com/adobe/helix-html-pipeline/compare/v1.4.0...v1.4.1) (2022-04-16)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.8 ([9c7e30d](https://github.com/adobe/helix-html-pipeline/commit/9c7e30daccfab99e0dc5861f7105c0eee6c88ca5))

# [1.4.0](https://github.com/adobe/helix-html-pipeline/compare/v1.3.4...v1.4.0) (2022-04-12)


### Features

* adjust for upcoming helix-config changes ([#37](https://github.com/adobe/helix-html-pipeline/issues/37)) ([e6d4f90](https://github.com/adobe/helix-html-pipeline/commit/e6d4f90d4bf8c9a0642e921395e5ac48aa3e53c7)), closes [#36](https://github.com/adobe/helix-html-pipeline/issues/36)

## [1.3.4](https://github.com/adobe/helix-html-pipeline/compare/v1.3.3...v1.3.4) (2022-04-11)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.7 ([e8a293c](https://github.com/adobe/helix-html-pipeline/commit/e8a293c54ac8617d5457692e780bc60c9358c0ee))

## [1.3.3](https://github.com/adobe/helix-html-pipeline/compare/v1.3.2...v1.3.3) (2022-04-06)


### Bug Fixes

* correct last-modified handling for json ([#33](https://github.com/adobe/helix-html-pipeline/issues/33)) ([c9bb4fd](https://github.com/adobe/helix-html-pipeline/commit/c9bb4fd8e0974788cf0e963567db76685fcba231))

## [1.3.2](https://github.com/adobe/helix-html-pipeline/compare/v1.3.1...v1.3.2) (2022-03-19)


### Bug Fixes

* expect spec-compliant URL ([d65428a](https://github.com/adobe/helix-html-pipeline/commit/d65428a2f0e68471f8eed785706766744a7f168b))

## [1.3.1](https://github.com/adobe/helix-html-pipeline/compare/v1.3.0...v1.3.1) (2022-03-18)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.6 ([#26](https://github.com/adobe/helix-html-pipeline/issues/26)) ([186c376](https://github.com/adobe/helix-html-pipeline/commit/186c376d0252b0c96ee461670cf45a711aa93f4f))
* preserve formatting of script tags ([#25](https://github.com/adobe/helix-html-pipeline/issues/25)) ([7009f20](https://github.com/adobe/helix-html-pipeline/commit/7009f20d37190f5704b7f9363c59912b4272c0bf)), closes [#23](https://github.com/adobe/helix-html-pipeline/issues/23)

# [1.3.0](https://github.com/adobe/helix-html-pipeline/compare/v1.2.1...v1.3.0) (2022-03-17)


### Features

* provide pipes for OPTIONS and POSTs ([#24](https://github.com/adobe/helix-html-pipeline/issues/24)) ([1dfc47e](https://github.com/adobe/helix-html-pipeline/commit/1dfc47e764a0b1d8acee80b51b845be2e54a16f5))

## [1.2.1](https://github.com/adobe/helix-html-pipeline/compare/v1.2.0...v1.2.1) (2022-03-16)


### Bug Fixes

* reject double-slashes ([#22](https://github.com/adobe/helix-html-pipeline/issues/22)) ([5aee75d](https://github.com/adobe/helix-html-pipeline/commit/5aee75d4109550525d971c64d87e4f2420863c30)), closes [#20](https://github.com/adobe/helix-html-pipeline/issues/20)

# [1.2.0](https://github.com/adobe/helix-html-pipeline/compare/v1.1.3...v1.2.0) (2022-03-16)


### Features

* use hast instead of jsdom ([#12](https://github.com/adobe/helix-html-pipeline/issues/12)) ([bee0a0b](https://github.com/adobe/helix-html-pipeline/commit/bee0a0b3309919f896520bc700dd2d867be19a1c)), closes [#11](https://github.com/adobe/helix-html-pipeline/issues/11)

## [1.1.3](https://github.com/adobe/helix-html-pipeline/compare/v1.1.2...v1.1.3) (2022-03-12)


### Bug Fixes

* **deps:** update dependency @adobe/helix-shared-utils to v2.0.5 ([4ea15f9](https://github.com/adobe/helix-html-pipeline/commit/4ea15f9888486ba0e81e92c7796236726da5b74c))

## [1.1.2](https://github.com/adobe/helix-html-pipeline/compare/v1.1.1...v1.1.2) (2022-03-11)


### Bug Fixes

* handling invalid input url with 400 ([#16](https://github.com/adobe/helix-html-pipeline/issues/16)) ([4491691](https://github.com/adobe/helix-html-pipeline/commit/449169107cc1d6a3b7b5fd211b39174d59fb2a8e)), closes [#15](https://github.com/adobe/helix-html-pipeline/issues/15)

## [1.1.1](https://github.com/adobe/helix-html-pipeline/compare/v1.1.0...v1.1.1) (2022-03-10)


### Bug Fixes

* adapt to breaking change (computeSurrogateKey is async) ([9c8830d](https://github.com/adobe/helix-html-pipeline/commit/9c8830dc8db3007921dd85f27537c030d80c0cbf))
* **deps:** update dependency @adobe/helix-shared-utils to v2.0.4 ([b5cd927](https://github.com/adobe/helix-html-pipeline/commit/b5cd92783f03c47f7f26fbaa6c9438ea11c1e05b))

# [1.1.0](https://github.com/adobe/helix-html-pipeline/compare/v1.0.5...v1.1.0) (2022-03-10)


### Features

* avoid node built-ins (path and url) ([9e315df](https://github.com/adobe/helix-html-pipeline/commit/9e315df46fc7f473e437feb2e2d3dfdf9c6ddfc2))

## [1.0.5](https://github.com/adobe/helix-html-pipeline/compare/v1.0.4...v1.0.5) (2022-03-08)


### Bug Fixes

* re-add lost image unwrapper ([#10](https://github.com/adobe/helix-html-pipeline/issues/10)) ([0f2b66e](https://github.com/adobe/helix-html-pipeline/commit/0f2b66eed2157717d0edc321fbd3430d4ce4b42c))

## [1.0.4](https://github.com/adobe/helix-html-pipeline/compare/v1.0.3...v1.0.4) (2022-03-08)


### Bug Fixes

* no special headers init for PipelineResponse ([#9](https://github.com/adobe/helix-html-pipeline/issues/9)) ([7288677](https://github.com/adobe/helix-html-pipeline/commit/72886779f6ba0f8d07ea14757a8097034262e215))

## [1.0.3](https://github.com/adobe/helix-html-pipeline/compare/v1.0.2...v1.0.3) (2022-03-08)


### Bug Fixes

* fix canonical url and 404.html response, clean up meta ([5f3e999](https://github.com/adobe/helix-html-pipeline/commit/5f3e999a6e305fb6ecf7d2fefe3a38274a135433))

## [1.0.2](https://github.com/adobe/helix-html-pipeline/compare/v1.0.1...v1.0.2) (2022-03-08)


### Bug Fixes

* canonical url and 404.html response ([9f4e473](https://github.com/adobe/helix-html-pipeline/commit/9f4e47372d6aea1252f179ad661b0d2fb03429bd))

## [1.0.1](https://github.com/adobe/helix-html-pipeline/compare/v1.0.0...v1.0.1) (2022-03-07)


### Bug Fixes

* include static s3 loader ([0a89e2f](https://github.com/adobe/helix-html-pipeline/commit/0a89e2fda5d6a8ab3e67724fd0b436c8b1aa6e58))

# 1.0.0 (2022-03-07)


### Features

* initial version ([9956ded](https://github.com/adobe/helix-html-pipeline/commit/9956ded639ae9ed5a2516cb9befbc7e911bf3783))
