# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.6.0](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.11...@d-zero/google-sheets@0.6.0) (2026-02-24)

### Bug Fixes

- **google-sheets:** add if guard to waiting:false log callbacks in ErrorHandler ([6d6e0bd](https://github.com/d-zero-dev/tools/commit/6d6e0bdb8dddf3fee497b66ae5b69742ef25ac3e))

### Features

- **google-sheets:** add exports, header formatting, and fix error handler ([72726c9](https://github.com/d-zero-dev/tools/commit/72726c966fcf06e5d993d4dd6e294d28149aa1e8))
- **google-sheets:** add onLog callback to Sheets for rate limit notifications ([b05b74f](https://github.com/d-zero-dev/tools/commit/b05b74f0f14a854edd2def53b37d9504446a2f78))
- **google-sheets:** add optional defaultCellFormat parameter to createCellData ([1b458e1](https://github.com/d-zero-dev/tools/commit/1b458e137c0fcdd3aec9a5056b35260e90c3ef44))

## [0.5.11](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.10...@d-zero/google-sheets@0.5.11) (2026-02-14)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.10](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.9...@d-zero/google-sheets@0.5.10) (2026-02-06)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.9](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.8...@d-zero/google-sheets@0.5.9) (2026-01-23)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.8](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.7...@d-zero/google-sheets@0.5.8) (2026-01-07)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.7](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.6...@d-zero/google-sheets@0.5.7) (2025-12-12)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.6](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.5...@d-zero/google-sheets@0.5.6) (2025-11-25)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.5](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.4...@d-zero/google-sheets@0.5.5) (2025-11-20)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.4](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.3...@d-zero/google-sheets@0.5.4) (2025-10-31)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.3](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.2...@d-zero/google-sheets@0.5.3) (2025-10-30)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.2](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.1...@d-zero/google-sheets@0.5.2) (2025-10-30)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.5.1](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.5.0...@d-zero/google-sheets@0.5.1) (2025-10-29)

**Note:** Version bump only for package @d-zero/google-sheets

# [0.5.0](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.4.2...@d-zero/google-sheets@0.5.0) (2025-10-28)

- feat(google-sheets)!: change SheetTable to factory pattern with create method ([4fcc54e](https://github.com/d-zero-dev/tools/commit/4fcc54e5a80f2c45cf7340c58e408bd4102f95cc))

### Features

- **google-sheets:** add cell type detection and conversion in getData() ([93fd4f3](https://github.com/d-zero-dev/tools/commit/93fd4f3769efab7b61b4aad2f68956ad64d1667a))
- **google-sheets:** add getData method for reading sheet data ([2336043](https://github.com/d-zero-dev/tools/commit/23360433196bdda533009af6fffc5f1c14581372))

### BREAKING CHANGES

- Constructor is now private. Use static create() method instead of

new SheetTable(). The update() method is removed and replaced with addRecords().

## [0.4.2](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.4.1...@d-zero/google-sheets@0.4.2) (2025-10-15)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.4.1](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.4.0...@d-zero/google-sheets@0.4.1) (2025-10-15)

**Note:** Version bump only for package @d-zero/google-sheets

# [0.4.0](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.3.4...@d-zero/google-sheets@0.4.0) (2025-10-03)

### Features

- **google-sheets:** add getValues method to Sheet class and get method to Sheets class ([57d3aec](https://github.com/d-zero-dev/tools/commit/57d3aecafd845bb1b413b278e699c47f96875e1a))

## [0.3.4](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.3.3...@d-zero/google-sheets@0.3.4) (2025-09-01)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.3.3](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.3.2...@d-zero/google-sheets@0.3.3) (2025-06-25)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.3.2](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.3.1...@d-zero/google-sheets@0.3.2) (2025-06-18)

**Note:** Version bump only for package @d-zero/google-sheets

## [0.3.1](https://github.com/d-zero-dev/tools/compare/@d-zero/google-sheets@0.3.0...@d-zero/google-sheets@0.3.1) (2025-05-20)

**Note:** Version bump only for package @d-zero/google-sheets

# 0.3.0 (2025-03-05)

### Features

- **google-sheets:** add `@d-zero/google-sheets` ([4d92643](https://github.com/d-zero-dev/tools/commit/4d9264374ed69e8bd828c0c050a859af9e448648))

# 0.2.0 (2024-10-30)

### Features

- **google-sheets:** add `@d-zero/google-sheets` ([4d92643](https://github.com/d-zero-dev/tools/commit/4d9264374ed69e8bd828c0c050a859af9e448648))
