# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.7.4](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.4-alpha.2...@d-zero/dealer@1.7.4) (2026-04-08)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.4-alpha.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.4-alpha.1...@d-zero/dealer@1.7.4-alpha.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.4-alpha.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.4-alpha.0...@d-zero/dealer@1.7.4-alpha.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.4-alpha.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.3...@d-zero/dealer@1.7.4-alpha.0) (2026-04-08)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.3](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.2...@d-zero/dealer@1.7.3) (2026-04-01)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.1...@d-zero/dealer@1.7.2) (2026-03-24)

**Note:** Version bump only for package @d-zero/dealer

## [1.7.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.7.0...@d-zero/dealer@1.7.1) (2026-03-11)

**Note:** Version bump only for package @d-zero/dealer

# [1.7.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.5...@d-zero/dealer@1.7.0) (2026-03-10)

### Features

- **dealer:** add AbortSignal cancellation, JSDoc, and documentation ([eb9b6d5](https://github.com/d-zero-dev/tools/commit/eb9b6d592ad607a3ff39cdd46acbbe83df3693b3))

## [1.6.5](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.4...@d-zero/dealer@1.6.5) (2026-03-10)

### Bug Fixes

- **dealer:** ワーカーエラー時の未処理Promise rejectionとデッドロックを修正 ([81cd091](https://github.com/d-zero-dev/tools/commit/81cd0914b2ea40418cd6905504b8d36aa356ee62))

## [1.6.4](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.3...@d-zero/dealer@1.6.4) (2026-02-26)

**Note:** Version bump only for package @d-zero/dealer

## [1.6.3](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.2...@d-zero/dealer@1.6.3) (2026-02-26)

### Bug Fixes

- **dealer:** resolve hang when deal() is called with empty items array ([3774324](https://github.com/d-zero-dev/tools/commit/377432440c86fda073d6f161cab4a7f3883a9792))

## [1.6.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.1...@d-zero/dealer@1.6.2) (2026-02-24)

### Bug Fixes

- **dealer:** add ANSI reset to header lines in Lanes to prevent color bleeding ([20e314e](https://github.com/d-zero-dev/tools/commit/20e314e85adffef474ffe06a839f3a85c81a2c0a))
- **dealer:** improve Display lifecycle with proper cleanup and SIGINT handling ([cbd7041](https://github.com/d-zero-dev/tools/commit/cbd7041660fa33cb5209adaa9f795bab989b9c72))
- **dealer:** use literal ANSI reset code to prevent color bleeding ([a010f05](https://github.com/d-zero-dev/tools/commit/a010f05ac3eb683a5d5ddf07304f8507e4777b72))

## [1.6.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.6.0...@d-zero/dealer@1.6.1) (2026-02-14)

### Bug Fixes

- **dealer:** eliminate non-verbose display flicker with single stdout.write ([836b22f](https://github.com/d-zero-dev/tools/commit/836b22fe01749e10be8c87f4a7f96cfcefed6afb))
- **dealer:** make DealerOptions generic to fix onPush type ([4b5997f](https://github.com/d-zero-dev/tools/commit/4b5997f8775caa2f8ca2a155d63675196bd7b876))

# [1.6.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.5.4...@d-zero/dealer@1.6.0) (2026-02-12)

### Features

- **dealer:** add push() to dynamically enqueue items during processing ([dc8c3c5](https://github.com/d-zero-dev/tools/commit/dc8c3c5ebf25ca82134541e550c72f85769a8c6c))

## [1.5.4](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.5.3...@d-zero/dealer@1.5.4) (2026-02-06)

**Note:** Version bump only for package @d-zero/dealer

## [1.5.3](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.5.2...@d-zero/dealer@1.5.3) (2026-01-07)

**Note:** Version bump only for package @d-zero/dealer

## [1.5.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.5.1...@d-zero/dealer@1.5.2) (2025-12-12)

**Note:** Version bump only for package @d-zero/dealer

## [1.5.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.5.0...@d-zero/dealer@1.5.1) (2025-11-25)

**Note:** Version bump only for package @d-zero/dealer

# [1.5.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.4.2...@d-zero/dealer@1.5.0) (2025-11-20)

### Features

- **dealer:** add clear method to Lanes ([ef533a7](https://github.com/d-zero-dev/tools/commit/ef533a7328f87043985bc1638ef348fa0bbe22f2))

## [1.4.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.4.1...@d-zero/dealer@1.4.2) (2025-10-31)

**Note:** Version bump only for package @d-zero/dealer

## [1.4.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.4.0...@d-zero/dealer@1.4.1) (2025-10-30)

**Note:** Version bump only for package @d-zero/dealer

# [1.4.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.3.2...@d-zero/dealer@1.4.0) (2025-10-30)

### Features

- **dealer:** add interval option for controlling delay between parallel tasks ([de05240](https://github.com/d-zero-dev/tools/commit/de05240533c543e9d21d973bb88c304aa1353efc))

## [1.3.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.3.1...@d-zero/dealer@1.3.2) (2025-06-25)

**Note:** Version bump only for package @d-zero/dealer

## [1.3.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.3.0...@d-zero/dealer@1.3.1) (2025-05-20)

### Bug Fixes

- **dealer:** disable raw mode when display is closed ([df4c6cf](https://github.com/d-zero-dev/tools/commit/df4c6cfda39377f08eb38ee020ed4ffc03b08d87))

# [1.3.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.1.0...@d-zero/dealer@1.3.0) (2025-03-05)

### Bug Fixes

- **dealer:** fix display header line ([02199ce](https://github.com/d-zero-dev/tools/commit/02199ce09d4b3c929e0b80cf18bd1b267381c7c0))

### Features

- **dealer:** accept `verbose` option ([335871e](https://github.com/d-zero-dev/tools/commit/335871e9d77210c3e97d6472a70c223f0a5d1561))
- **dealer:** expose `DealOptions` type ([02f6a90](https://github.com/d-zero-dev/tools/commit/02f6a90ee18ccf175a8440550f37414e510e784a))
- **dealer:** expose type `DealHeader` ([a35468f](https://github.com/d-zero-dev/tools/commit/a35468f7a236bc1958a70815b85b831b321c0cc4))
- **dealer:** improve output when using `--verbose` option ([058bf02](https://github.com/d-zero-dev/tools/commit/058bf02486e4d0fb7551bee8e248e3a047199aff))

# [1.2.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.1.0...@d-zero/dealer@1.2.0) (2024-10-30)

### Bug Fixes

- **dealer:** fix display header line ([02199ce](https://github.com/d-zero-dev/tools/commit/02199ce09d4b3c929e0b80cf18bd1b267381c7c0))

### Features

- **dealer:** accept `verbose` option ([335871e](https://github.com/d-zero-dev/tools/commit/335871e9d77210c3e97d6472a70c223f0a5d1561))
- **dealer:** expose `DealOptions` type ([02f6a90](https://github.com/d-zero-dev/tools/commit/02f6a90ee18ccf175a8440550f37414e510e784a))
- **dealer:** expose type `DealHeader` ([a35468f](https://github.com/d-zero-dev/tools/commit/a35468f7a236bc1958a70815b85b831b321c0cc4))
- **dealer:** improve output when using `--verbose` option ([058bf02](https://github.com/d-zero-dev/tools/commit/058bf02486e4d0fb7551bee8e248e3a047199aff))

# [1.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.0.2...@d-zero/dealer@1.1.0) (2024-10-03)

### Features

- **dealer:** `deal` function's return type accepts sync function ([c15c8f4](https://github.com/d-zero-dev/tools/commit/c15c8f4e10eac20499292c43e6ec87fc34f55e4a))

## [1.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.0.1...@d-zero/dealer@1.0.2) (2024-06-25)

### Bug Fixes

- **dealer:** 並列実行数の計算を修正 ([8b39747](https://github.com/d-zero-dev/tools/commit/8b397473a34f6d631a16350831f136f3e9c303ed))

## [1.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.0.0...@d-zero/dealer@1.0.1) (2024-05-22)

**Note:** Version bump only for package @d-zero/dealer

# [1.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/dealer@1.0.0-alpha.2...@d-zero/dealer@1.0.0) (2024-05-08)

**Note:** Version bump only for package @d-zero/dealer
