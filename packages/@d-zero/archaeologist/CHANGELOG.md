# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.0.9](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.8...@d-zero/archaeologist@4.0.9) (2026-07-09)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.8](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.7...@d-zero/archaeologist@4.0.8) (2026-07-02)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.7](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.6...@d-zero/archaeologist@4.0.7) (2026-07-01)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.6](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.5...@d-zero/archaeologist@4.0.6) (2026-06-18)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.5](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.4...@d-zero/archaeologist@4.0.5) (2026-06-18)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.4](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.3...@d-zero/archaeologist@4.0.4) (2026-06-16)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.2...@d-zero/archaeologist@4.0.3) (2026-06-15)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.1...@d-zero/archaeologist@4.0.2) (2026-06-09)

**Note:** Version bump only for package @d-zero/archaeologist

## [4.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@4.0.0...@d-zero/archaeologist@4.0.1) (2026-06-08)

**Note:** Version bump only for package @d-zero/archaeologist

# [4.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.7.1...@d-zero/archaeologist@4.0.0) (2026-05-27)

- feat(archaeologist)!: pass hooks through IPC and run them in analyze and freeze ([2096b8f](https://github.com/d-zero-dev/tools/commit/2096b8f2e6af5d4f78d78d1e73f9168db2dee5a6))

### BREAKING CHANGES

- AnalyzeOptions.hooks and FreezeOptions.hooks are now an
  optional PageHookSource instead of a required readonly PageHook[]. Library
  callers must pass { paths, baseDir } instead of a function array. The
  PageHook re-export from @d-zero/archaeologist is removed; import it from
  @d-zero/puppeteer-page-scan if needed inside hook files. CLI users get a
  behavior change: `hooks:` in the URL-list frontmatter now actually runs in
  both analyze and freeze modes (previously a no-op). See
  MIGRATION-page-hooks.md.

## [3.7.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.7.1-alpha.2...@d-zero/archaeologist@3.7.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.7.1-alpha.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.7.1-alpha.1...@d-zero/archaeologist@3.7.1-alpha.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.7.1-alpha.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.7.1-alpha.0...@d-zero/archaeologist@3.7.1-alpha.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.7.1-alpha.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.7.0...@d-zero/archaeologist@3.7.1-alpha.0) (2026-04-08)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.7.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.6.2...@d-zero/archaeologist@3.7.0) (2026-04-01)

### Features

- **archaeologist:** support direct URL pair arguments without listfile ([7e9c7d1](https://github.com/d-zero-dev/tools/commit/7e9c7d1055c5d9e65cc3fff53247cbf486a6435f))

## [3.6.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.6.1...@d-zero/archaeologist@3.6.2) (2026-04-01)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.6.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.6.0...@d-zero/archaeologist@3.6.1) (2026-03-30)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.6.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.10...@d-zero/archaeologist@3.6.0) (2026-03-24)

### Bug Fixes

- **archaeologist:** preserve auth header across redirects in fetchHtml ([9f04aaf](https://github.com/d-zero-dev/tools/commit/9f04aaf4ec8cee8cff7f519ab04715bbc45eda6e))
- **archaeologist:** support Basic auth in fetchHtml ([cdf66e2](https://github.com/d-zero-dev/tools/commit/cdf66e26378e0ac1625b136b5fb2eb6ff348bd6f))

### Features

- **archaeologist:** add code type for raw HTML source diff comparison ([ea4f189](https://github.com/d-zero-dev/tools/commit/ea4f18991468d574dc34e4f41c42f20ab0c3e04d))

## [3.5.10](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.9...@d-zero/archaeologist@3.5.10) (2026-03-11)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.9](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.8...@d-zero/archaeologist@3.5.9) (2026-03-10)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.8](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.7...@d-zero/archaeologist@3.5.8) (2026-03-10)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.7](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.6...@d-zero/archaeologist@3.5.7) (2026-02-26)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.6](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.5...@d-zero/archaeologist@3.5.6) (2026-02-26)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.5](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.4...@d-zero/archaeologist@3.5.5) (2026-02-24)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.4](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.3...@d-zero/archaeologist@3.5.4) (2026-02-14)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.2...@d-zero/archaeologist@3.5.3) (2026-02-12)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.1...@d-zero/archaeologist@3.5.2) (2026-02-06)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.5.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.5.0...@d-zero/archaeologist@3.5.1) (2026-01-23)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.5.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.4.4...@d-zero/archaeologist@3.5.0) (2026-01-08)

### Features

- **repo:** add version option to all CLIs ([12c0429](https://github.com/d-zero-dev/tools/commit/12c042975adb6c92f16fb551e561a2717db54a93))

## [3.4.4](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.4.3...@d-zero/archaeologist@3.4.4) (2026-01-07)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.4.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.4.2...@d-zero/archaeologist@3.4.3) (2025-12-12)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.4.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.4.1...@d-zero/archaeologist@3.4.2) (2025-12-03)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.4.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.4.0...@d-zero/archaeologist@3.4.1) (2025-11-25)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.4.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.3.3...@d-zero/archaeologist@3.4.0) (2025-11-21)

### Bug Fixes

- **archaeologist:** add non-null assertion for options.listfile ([f3c5487](https://github.com/d-zero-dev/tools/commit/f3c54874a0cf802a9e71ec241481583887c09be5))

### Features

- **archaeologist:** add --combined option to output side-by-side comparison images ([c3445e4](https://github.com/d-zero-dev/tools/commit/c3445e460b52406a2cbcad5ddacae5148fa805c3))

## [3.3.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.3.2...@d-zero/archaeologist@3.3.3) (2025-11-20)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.3.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.3.1...@d-zero/archaeologist@3.3.2) (2025-10-31)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.3.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.3.0...@d-zero/archaeologist@3.3.1) (2025-10-30)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.3.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.6...@d-zero/archaeologist@3.3.0) (2025-10-30)

### Features

- **archaeologist:** add --interval option to CLI and pass to deal function ([2e84d4d](https://github.com/d-zero-dev/tools/commit/2e84d4d00b522c2933fd0da33f632bfbb5c86010))

## [3.2.6](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.5...@d-zero/archaeologist@3.2.6) (2025-10-29)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.2.5](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.4...@d-zero/archaeologist@3.2.5) (2025-10-28)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.2.4](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.3...@d-zero/archaeologist@3.2.4) (2025-10-15)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.2.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.2...@d-zero/archaeologist@3.2.3) (2025-10-15)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.2.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.1...@d-zero/archaeologist@3.2.2) (2025-10-03)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.2.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.2.0...@d-zero/archaeologist@3.2.1) (2025-09-02)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.2.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.1.1...@d-zero/archaeologist@3.2.0) (2025-09-02)

### Features

- **archaeologist:** unify device configuration with shared presets ([5caf50c](https://github.com/d-zero-dev/tools/commit/5caf50c8a8e4554e53cbbbc7e22791ea98b7533c))

## [3.1.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.1.0...@d-zero/archaeologist@3.1.1) (2025-09-01)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.0.2...@d-zero/archaeologist@3.1.0) (2025-07-08)

### Features

- **archaeologist:** support async distill function ([821c1b8](https://github.com/d-zero-dev/tools/commit/821c1b82cbdc46c81cbadd410b621015f5ed67d9))

## [3.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.0.1...@d-zero/archaeologist@3.0.2) (2025-06-26)

**Note:** Version bump only for package @d-zero/archaeologist

## [3.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@3.0.0...@d-zero/archaeologist@3.0.1) (2025-06-25)

**Note:** Version bump only for package @d-zero/archaeologist

# [3.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@2.0.0...@d-zero/archaeologist@3.0.0) (2025-06-18)

### Bug Fixes

- **archaeologist:** make diff-text test environment-independent ([a7c6f77](https://github.com/d-zero-dev/tools/commit/a7c6f7762f52bcc99fcbe2a72838a8c715d8cdf0))
- **archaeologist:** pass verbose option to method correctly ([427ff93](https://github.com/d-zero-dev/tools/commit/427ff93a61e73ace08c1d975cd83630323bf720f))
- correct typos and grammar mistakes across codebase ([4ad3d78](https://github.com/d-zero-dev/tools/commit/4ad3d7806dd892de5bd68e8645e78e6ea36c27a1))

- feat(dealer)!: improve integration with dealer package ([fb59c1f](https://github.com/d-zero-dev/tools/commit/fb59c1f7635882cb2ff85d48f6f4729aec63d9ee))
- refactor(archaeologist)!: replace htmlDiffOnly with type-based filtering ([66920c3](https://github.com/d-zero-dev/tools/commit/66920c3ee7d85b1b1388d10aecfeb2bf8d34f738))

### Features

- **archaeologist:** add devices option for screenshot targets ([9b522a5](https://github.com/d-zero-dev/tools/commit/9b522a571e9f995ae1f681a73f3d99143c3eb4d1))
- **archaeologist:** add ignore option for element exclusion in analysis ([623d515](https://github.com/d-zero-dev/tools/commit/623d515cebd61ca6f8db19f54fd856c0ac02acd2))
- **archaeologist:** add result file output functionality ([96c1ea0](https://github.com/d-zero-dev/tools/commit/96c1ea0ef84e91c71914dfb68616d3340a128f3e))
- **archaeologist:** add selector option for targeted analysis ([63a3d76](https://github.com/d-zero-dev/tools/commit/63a3d76f1af8e28afc63ab068276026924822ea3))
- **archaeologist:** add text diff analysis with morphological analysis ([00ed8b2](https://github.com/d-zero-dev/tools/commit/00ed8b2343b5d382cf325292dc756a2e9027c980))
- **archaeologist:** add type filtering support for analysis ([4373b8d](https://github.com/d-zero-dev/tools/commit/4373b8d361b1709d6be2a6d38c587152e0f9ec93))
- **archaeologist:** improve text processing with document normalization ([700b6ac](https://github.com/d-zero-dev/tools/commit/700b6ac90c5569cf387affb8be261ce27e6e5897))
- **cli-core:** create new CLI utilities package for common CLI patterns ([70100a2](https://github.com/d-zero-dev/tools/commit/70100a26349130dcc4da184e9afce7fa664b0d88))

### BREAKING CHANGES

- integrate dealer options and update callback format
- htmlDiffOnly option is removed, use types option instead

# [2.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.1.3...@d-zero/archaeologist@2.0.0) (2025-05-20)

- refactor(archaeologist)!: implement child process architecture ([b22bbdc](https://github.com/d-zero-dev/tools/commit/b22bbdc1d99e876b764753c3dd83ceaba42eb22c))

### Features

- **archaeologist:** add `--freeze` option ([ea31010](https://github.com/d-zero-dev/tools/commit/ea310105142cdb6bceb5ed4a8480d6594d448deb))
- **archaeologist:** allow analyzeUrlList to accept strings in addition to URLPair ([aff57b2](https://github.com/d-zero-dev/tools/commit/aff57b21fcf72e583d3c0c1820f942800ca73f00))
- **archaeologist:** use shared delay function and remove local implementation ([bed61ad](https://github.com/d-zero-dev/tools/commit/bed61adf6a4cb944dac8f2e90076b97522e4734c))
- **archaeologist:** use shared delay function and remove local implementation ([2a775e8](https://github.com/d-zero-dev/tools/commit/2a775e850a827d958b6b4acfb7690c8835584669))

### BREAKING CHANGES

- complete rewrite of internal architecture

* Split analyze and freeze into main/child processes

* Replace direct puppeteer-dealer usage with process-based implementation

* Change return type of analyze() function to void (logs to console directly)

* Remove archaeologist.ts in favor of analyze-main-process.ts

## [1.1.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.1.1...@d-zero/archaeologist@1.1.3) (2025-03-05)

**Note:** Version bump only for package @d-zero/archaeologist

## [1.1.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.1.1...@d-zero/archaeologist@1.1.2) (2024-10-30)

**Note:** Version bump only for package @d-zero/archaeologist

## [1.1.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.1.0...@d-zero/archaeologist@1.1.1) (2024-10-03)

### Bug Fixes

- **archaeologist:** fix to throw an error when option is empty ([a6fc338](https://github.com/d-zero-dev/tools/commit/a6fc33882401d6f0224e8fcc50e435da5adc6eb2))

# [1.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.0.3...@d-zero/archaeologist@1.1.0) (2024-06-25)

### Bug Fixes

- **archaeologist:** DOMツリーの差分検出の改善 ([1de9a68](https://github.com/d-zero-dev/tools/commit/1de9a6834108d6475ac53875d2a7966f0fa732f5))

### Features

- **archaeologist:** `--debug`オプションの追加 ([34ae41a](https://github.com/d-zero-dev/tools/commit/34ae41a57e7642b38aa423bf3d28dc3356aa9c69))
- **archaeologist:** `--htmlDiffOnly`オプションの追加 ([97b2cab](https://github.com/d-zero-dev/tools/commit/97b2cabb8959e979bb53846ce7944650ed9e8333))
- **archaeologist:** `--limit`オプションの追加 ([88f21e8](https://github.com/d-zero-dev/tools/commit/88f21e8d560e9846a0002f9bfb77029f57f118bf))

## [1.0.3](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.0.2...@d-zero/archaeologist@1.0.3) (2024-06-13)

**Note:** Version bump only for package @d-zero/archaeologist

## [1.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.0.1...@d-zero/archaeologist@1.0.2) (2024-05-22)

**Note:** Version bump only for package @d-zero/archaeologist

## [1.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.0.0...@d-zero/archaeologist@1.0.1) (2024-05-15)

**Note:** Version bump only for package @d-zero/archaeologist

# [1.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/archaeologist@1.0.0-alpha.3...@d-zero/archaeologist@1.0.0) (2024-05-08)

### Features

- **archaeologist:** add `hooks` option ([c36856a](https://github.com/d-zero-dev/tools/commit/c36856a77927da5f814644604b50b44bb742d4e4))
