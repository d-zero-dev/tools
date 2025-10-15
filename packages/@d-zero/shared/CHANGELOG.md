# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.11.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.10.0...@d-zero/shared@0.11.0) (2025-10-15)

### Features

- **shared:** add isAncestor property to Node type in pathListToTree ([3669633](https://github.com/d-zero-dev/tools/commit/3669633a6a1ed7a9c5283bfe5af3c1da7f3fc79f))

# [0.10.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.9.2...@d-zero/shared@0.10.0) (2025-10-15)

### Bug Fixes

- **shared:** correct protocol comparison in parseUrl function ([3c3fcf8](https://github.com/d-zero-dev/tools/commit/3c3fcf8cf433116dbb83055cc5f98cd3fb4497d0))

### Features

- **shared:** add baseUrl option to parseUrl function ([1bf9e80](https://github.com/d-zero-dev/tools/commit/1bf9e80808f6840b7f58eb5f5e5a9d99a19f39de))
- **shared:** add indexAsParent option to parseUrl function ([8d3d3aa](https://github.com/d-zero-dev/tools/commit/8d3d3aaf526ffa565f41a04427a05921b7538435))
- **shared:** add pathListToTree function with tests and documentation ([da211f3](https://github.com/d-zero-dev/tools/commit/da211f3f13362a99d0389f8ba16d086deb942d25))
- **shared:** add stem property to ExURL type ([45bc112](https://github.com/d-zero-dev/tools/commit/45bc1129e35a6f4d6e273ee33406bc6cc5f5d583))

## [0.9.2](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.9.1...@d-zero/shared@0.9.2) (2025-09-01)

**Note:** Version bump only for package @d-zero/shared

## [0.9.1](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.9.0...@d-zero/shared@0.9.1) (2025-06-25)

**Note:** Version bump only for package @d-zero/shared

# [0.9.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.8.0...@d-zero/shared@0.9.0) (2025-06-18)

### Bug Fixes

- correct typos and grammar mistakes across codebase ([4ad3d78](https://github.com/d-zero-dev/tools/commit/4ad3d7806dd892de5bd68e8645e78e6ea36c27a1))
- **shared:** correct holiday spelling from holyday to holiday ([92a1a37](https://github.com/d-zero-dev/tools/commit/92a1a37fdec165102c05abaff63a6289289009ed))

### Features

- **cli-core:** create new CLI utilities package for common CLI patterns ([70100a2](https://github.com/d-zero-dev/tools/commit/70100a26349130dcc4da184e9afce7fa664b0d88))
- **shared:** add parse-url module to handle URL parsing with extended properties ([33536f9](https://github.com/d-zero-dev/tools/commit/33536f910190f66c15eb2840715681a3e42dbf79))

### BREAKING CHANGES

- **shared:** Function and export names changed from holyday to holiday

* skipHolydays -> skipHolidays
* skipHolydayPeriod -> skipHolidayPeriod
* File names and import paths updated accordingly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

# [0.8.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.7.0...@d-zero/shared@0.8.0) (2025-05-20)

### Features

- **shared:** add `@d-zero/shared/timestamp` ([8ff03cf](https://github.com/d-zero-dev/tools/commit/8ff03cf69b0fd7c1073368ae5088a2f250297a48))

# [0.7.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.5.0...@d-zero/shared@0.7.0) (2025-03-05)

### Bug Fixes

- **shared:** fix `BinaryCache` to accept `Uint8Array` instead of `Buffer` ([c5a0f09](https://github.com/d-zero-dev/tools/commit/c5a0f09c0ebfc372f6afeff4edd1594e5a7d4364))

### Features

- **shared:** add `@d-zero/shared/cache` classes ([5208a13](https://github.com/d-zero-dev/tools/commit/5208a133faa1653b9e20ce0394a990571d3716e8))
- **shared:** add `@d-zero/shared/deferred` ([c7dcccc](https://github.com/d-zero-dev/tools/commit/c7dcccc93267b93b1c5fb4b7e20b1729f1c54b85))
- **shared:** add `@d-zero/shared/hash` function ([10c4679](https://github.com/d-zero-dev/tools/commit/10c46790b2e74c496a0d7b86d9b62e85ea953b0d))
- **shared:** add `@d-zero/shared/race-with-timeout` ([6afdcdd](https://github.com/d-zero-dev/tools/commit/6afdcdd06cda53aea87663bd46896821e0512c25))
- **shared:** add `@d-zero/shared/split-array` function ([c71d340](https://github.com/d-zero-dev/tools/commit/c71d34015bbd6680366b8d9307a5a8d272eb4ab9))
- **shared:** add `exists` method to `BinaryCache` ([50ff0dc](https://github.com/d-zero-dev/tools/commit/50ff0dce58ee8f637af3af49e59477c2ab3db899))
- **shared:** add `loadDirectly` method to `@d-zero/shared/cache` ([06e3024](https://github.com/d-zero-dev/tools/commit/06e30243c5d9d330a8b7bd11cff552f48d60034b))
- **shared:** expose `@d-zero/shared/decode-uri-safely` function ([59f2f90](https://github.com/d-zero-dev/tools/commit/59f2f90262777d754f20084d4b73ef0b1dc057fa))
- **shared:** improve `BinaryCache` to inherit file extension ([d642220](https://github.com/d-zero-dev/tools/commit/d642220efaca0902e1ae87f2686e945272eb49b9))
- **shared:** improve `Cache.store` to return a file name ([e6a0d7d](https://github.com/d-zero-dev/tools/commit/e6a0d7d791cc986dbe05ccb0215761287eb1042a))

# [0.6.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.5.0...@d-zero/shared@0.6.0) (2024-10-30)

### Bug Fixes

- **shared:** fix `BinaryCache` to accept `Uint8Array` instead of `Buffer` ([c5a0f09](https://github.com/d-zero-dev/tools/commit/c5a0f09c0ebfc372f6afeff4edd1594e5a7d4364))

### Features

- **shared:** add `@d-zero/shared/cache` classes ([5208a13](https://github.com/d-zero-dev/tools/commit/5208a133faa1653b9e20ce0394a990571d3716e8))
- **shared:** add `@d-zero/shared/deferred` ([c7dcccc](https://github.com/d-zero-dev/tools/commit/c7dcccc93267b93b1c5fb4b7e20b1729f1c54b85))
- **shared:** add `@d-zero/shared/hash` function ([10c4679](https://github.com/d-zero-dev/tools/commit/10c46790b2e74c496a0d7b86d9b62e85ea953b0d))
- **shared:** add `@d-zero/shared/race-with-timeout` ([6afdcdd](https://github.com/d-zero-dev/tools/commit/6afdcdd06cda53aea87663bd46896821e0512c25))
- **shared:** add `@d-zero/shared/split-array` function ([c71d340](https://github.com/d-zero-dev/tools/commit/c71d34015bbd6680366b8d9307a5a8d272eb4ab9))
- **shared:** add `exists` method to `BinaryCache` ([50ff0dc](https://github.com/d-zero-dev/tools/commit/50ff0dce58ee8f637af3af49e59477c2ab3db899))
- **shared:** add `loadDirectly` method to `@d-zero/shared/cache` ([06e3024](https://github.com/d-zero-dev/tools/commit/06e30243c5d9d330a8b7bd11cff552f48d60034b))
- **shared:** expose `@d-zero/shared/decode-uri-safely` function ([59f2f90](https://github.com/d-zero-dev/tools/commit/59f2f90262777d754f20084d4b73ef0b1dc057fa))
- **shared:** improve `BinaryCache` to inherit file extension ([d642220](https://github.com/d-zero-dev/tools/commit/d642220efaca0902e1ae87f2686e945272eb49b9))
- **shared:** improve `Cache.store` to return a file name ([e6a0d7d](https://github.com/d-zero-dev/tools/commit/e6a0d7d791cc986dbe05ccb0215761287eb1042a))

# [0.5.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.4.0...@d-zero/shared@0.5.0) (2024-10-03)

### Features

- **shared:** add `@d-zero/shared/url-to-file-name` ([7c32757](https://github.com/d-zero-dev/tools/commit/7c327578634b4c68f6e11afda37e159ccc276fa1))

# [0.4.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.3.0...@d-zero/shared@0.4.0) (2024-05-22)

### Features

- **shared:** add `@d-zero/shared/delay` ([f9e1067](https://github.com/d-zero-dev/tools/commit/f9e1067e05a1a6b50392a0a481d0a6f98a17c265))
- **shared:** add `@d-zero/shared/retry` ([b629e83](https://github.com/d-zero-dev/tools/commit/b629e8331150e29e68137c908d7cb1889add1142))
- **shared:** add `@d-zero/shared/str-to-regex` ([6547112](https://github.com/d-zero-dev/tools/commit/654711262e4054e437cc7d4fef9ceed6ba845301))
- **shared:** add `@d-zero/shared/typed-await-event-emitter` ([5381eb6](https://github.com/d-zero-dev/tools/commit/5381eb6a71fe3cb89a79ec5efeffe0d9e1cc9bbb))

# [0.3.0](https://github.com/d-zero-dev/tools/compare/@d-zero/shared@0.2.0...@d-zero/shared@0.3.0) (2024-05-15)

### Features

- **shared:** add `@d-zero/shared/sort/dir` ([7b58df6](https://github.com/d-zero-dev/tools/commit/7b58df62f927d3eb1531860b1fa62eac226f44dc))
- **shared:** add `@d-zero/shared/sort/path` ([4f746e0](https://github.com/d-zero-dev/tools/commit/4f746e085e936f3c3bdb54ce79b28e5289ccaeda))

# 0.2.0 (2024-05-08)

### Features

- **shared:** add `@d-zero/shared` ([d6891ee](https://github.com/d-zero-dev/tools/commit/d6891eeaa4eab8976a329f590e36e05ce31e4faa))
