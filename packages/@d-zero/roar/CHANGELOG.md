# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.2...@d-zero/roar@2.1.0) (2026-05-13)

### Features

- **roar:** add version setting for auto -v / --version handling ([20390e2](https://github.com/d-zero-dev/tools/commit/20390e2f4046091bbb2a2ad86f93b40aff50ab16))

## [2.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.2-alpha.2...@d-zero/roar@2.0.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/roar

## [2.0.2-alpha.2](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.2-alpha.1...@d-zero/roar@2.0.2-alpha.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/roar

## [2.0.2-alpha.1](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.2-alpha.0...@d-zero/roar@2.0.2-alpha.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/roar

## [2.0.2-alpha.0](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.1...@d-zero/roar@2.0.2-alpha.0) (2026-04-08)

**Note:** Version bump only for package @d-zero/roar

## [2.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@2.0.0...@d-zero/roar@2.0.1) (2026-03-13)

### Bug Fixes

- **roar:** fix flagless command fallback and improve test coverage ([067dd45](https://github.com/d-zero-dev/tools/commit/067dd45ab3833645e4ba56e56ebb75101d07f88a))
- **roar:** preserve positional args when boolean flag precedes them ([e0f7a39](https://github.com/d-zero-dev/tools/commit/e0f7a392735b6c41e360a9d091ce434b29e5c2e2)), closes [#862](https://github.com/d-zero-dev/tools/issues/862)

# [2.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@0.2.1...@d-zero/roar@2.0.0) (2026-02-26)

- feat(roar)!: replace meow-based roar() with yargs-parser-based parseCli() ([9ae1e9c](https://github.com/d-zero-dev/tools/commit/9ae1e9cc6bc852b818f1a64e5de5de0b6b40c113))

### BREAKING CHANGES

- the public API has been completely replaced

* Remove `roar()` function and meow/cli-meow-help dependencies
* Add `parseCli()` with per-subcommand typed flag definitions
* Export `CommandDef` interface and `InferFlags` utility type
* Entry point changed from `dist/index.js` to `dist/parse-cli.js`

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

## [0.2.1](https://github.com/d-zero-dev/tools/compare/@d-zero/roar@0.2.0...@d-zero/roar@0.2.1) (2026-02-24)

**Note:** Version bump only for package @d-zero/roar

# 0.2.0 (2025-12-03)

### Features

- **roar:** add OpenAI chat completion API client package ([e8a8cc7](https://github.com/d-zero-dev/tools/commit/e8a8cc74b6c0cf6dfae7fb04fb314d2a276ee4a5))
