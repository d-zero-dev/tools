# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
