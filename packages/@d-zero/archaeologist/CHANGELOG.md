# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
