# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [4.0.5](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@4.0.4...@d-zero/puppeteer-scroll@4.0.5) (2026-07-01)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [4.0.4](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@4.0.3...@d-zero/puppeteer-scroll@4.0.4) (2026-06-18)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [4.0.3](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@4.0.2...@d-zero/puppeteer-scroll@4.0.3) (2026-06-18)

### Bug Fixes

- **puppeteer-scroll:** retry page.evaluate on transient detached-Frame / Session-closed errors ([b464f42](https://github.com/d-zero-dev/tools/commit/b464f42b099bf90ee988fe2d1c509089d9cedb1c))

## [4.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@4.0.1...@d-zero/puppeteer-scroll@4.0.2) (2026-06-16)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [4.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@4.0.0...@d-zero/puppeteer-scroll@4.0.1) (2026-06-15)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

# [4.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.18...@d-zero/puppeteer-scroll@4.0.0) (2026-05-27)

- feat(puppeteer-scroll)!: randomize default scroll interval and distance ([3907d15](https://github.com/d-zero-dev/tools/commit/3907d1547da584d930ec3b2d436c98538ad6fbd0))

### BREAKING CHANGES

- scrollAllOver defaults change so each step looks less mechanical.

* interval default changes from a fixed 300 ms to a random 200-500 ms range
* distance default changes from a fixed clientHeight to clientHeight x random(0.5, 1.0)
  sampled per iteration inside the browser context
* distance option type widens from `number` to `number | DelayOptions`
* explicit 0 or negative distance values are clamped to 1 px to avoid
  accidental stuck-detection bail outs

Callers that need deterministic scrolling must pass explicit values, e.g.
`scrollAllOver(page, { interval: 300, distance: 800 })`.

Also factors the random-value resolver into its own `resolve-value.ts`
with dedicated tests, and extends the scroll-all-over test mock so that
`evaluate` arguments and `delay` invocations are now verifiable.

## [3.1.18](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.18-alpha.2...@d-zero/puppeteer-scroll@3.1.18) (2026-04-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.18-alpha.2](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.18-alpha.1...@d-zero/puppeteer-scroll@3.1.18-alpha.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.18-alpha.1](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.18-alpha.0...@d-zero/puppeteer-scroll@3.1.18-alpha.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.18-alpha.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.17...@d-zero/puppeteer-scroll@3.1.18-alpha.0) (2026-04-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.17](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.16...@d-zero/puppeteer-scroll@3.1.17) (2026-04-01)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.16](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.15...@d-zero/puppeteer-scroll@3.1.16) (2026-03-30)

### Bug Fixes

- **puppeteer-scroll:** detect stuck scrolling and bail out ([4c0c3a6](https://github.com/d-zero-dev/tools/commit/4c0c3a60a7721a89a624fd371d71a27fab246efe))

## [3.1.15](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.14...@d-zero/puppeteer-scroll@3.1.15) (2026-03-24)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.14](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.13...@d-zero/puppeteer-scroll@3.1.14) (2026-03-11)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.13](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.12...@d-zero/puppeteer-scroll@3.1.13) (2026-02-26)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.12](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.11...@d-zero/puppeteer-scroll@3.1.12) (2026-02-24)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.11](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.10...@d-zero/puppeteer-scroll@3.1.11) (2026-02-14)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.10](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.9...@d-zero/puppeteer-scroll@3.1.10) (2026-02-12)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.9](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.8...@d-zero/puppeteer-scroll@3.1.9) (2026-02-06)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.8](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.7...@d-zero/puppeteer-scroll@3.1.8) (2026-01-23)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.7](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.6...@d-zero/puppeteer-scroll@3.1.7) (2026-01-07)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.6](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.5...@d-zero/puppeteer-scroll@3.1.6) (2025-12-12)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.5](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.4...@d-zero/puppeteer-scroll@3.1.5) (2025-11-25)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.4](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.3...@d-zero/puppeteer-scroll@3.1.4) (2025-11-21)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.3](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.2...@d-zero/puppeteer-scroll@3.1.3) (2025-11-20)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.2](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.1...@d-zero/puppeteer-scroll@3.1.2) (2025-10-31)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.1.1](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.1.0...@d-zero/puppeteer-scroll@3.1.1) (2025-10-30)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

# [3.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.11...@d-zero/puppeteer-scroll@3.1.0) (2025-10-30)

### Features

- **shared:** add parse-interval utility and update delay/retry/scroll to support DelayOptions ([4c240a0](https://github.com/d-zero-dev/tools/commit/4c240a0bdd1091a8b009e7965543234c3babbccc))

## [3.0.11](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.10...@d-zero/puppeteer-scroll@3.0.11) (2025-10-29)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.10](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.9...@d-zero/puppeteer-scroll@3.0.10) (2025-10-28)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.9](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.8...@d-zero/puppeteer-scroll@3.0.9) (2025-10-15)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.8](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.7...@d-zero/puppeteer-scroll@3.0.8) (2025-10-15)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.7](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.6...@d-zero/puppeteer-scroll@3.0.7) (2025-10-03)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.6](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.5...@d-zero/puppeteer-scroll@3.0.6) (2025-09-02)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.5](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.4...@d-zero/puppeteer-scroll@3.0.5) (2025-09-01)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.4](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.3...@d-zero/puppeteer-scroll@3.0.4) (2025-07-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.3](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.2...@d-zero/puppeteer-scroll@3.0.3) (2025-06-25)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.1...@d-zero/puppeteer-scroll@3.0.2) (2025-06-18)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [3.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@3.0.0...@d-zero/puppeteer-scroll@3.0.1) (2025-05-20)

### Bug Fixes

- **puppeteer-scroll:** improve scroll calculation precision with Math.ceil ([71186c2](https://github.com/d-zero-dev/tools/commit/71186c25b23d0029ce49232f1681159a93d0bb20))

# [3.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.5...@d-zero/puppeteer-scroll@3.0.0) (2025-03-05)

### Features

- **puppeteer-scroll:** add `accurate` option to `scrollAllOver` function ([68b3745](https://github.com/d-zero-dev/tools/commit/68b374556c36b3ae285438edba9cb78215be45e6))
- **puppeteer-scroll:** add `logger` option to `scrollAllOver` function ([23adb0c](https://github.com/d-zero-dev/tools/commit/23adb0c97f8b946ae965d03c9d93a01bfced0e96))
- **puppeteer-scroll:** drop `accurate` option ([bf8df24](https://github.com/d-zero-dev/tools/commit/bf8df24271dd3c8da23cd3f8b459db2af1c39048))
- **puppeteer-scroll:** use `@d-zero/puppeteer-page` ([3a94e71](https://github.com/d-zero-dev/tools/commit/3a94e714f5a94d02492de787d99e49cb653be533))

### BREAKING CHANGES

- **puppeteer-scroll:** drop `accurate` option
- **puppeteer-scroll:** use `@d-zero/puppeteer-page` instead of `puppeteer`

# [2.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.5...@d-zero/puppeteer-scroll@2.0.0) (2024-10-30)

### Features

- **puppeteer-scroll:** add `accurate` option to `scrollAllOver` function ([68b3745](https://github.com/d-zero-dev/tools/commit/68b374556c36b3ae285438edba9cb78215be45e6))
- **puppeteer-scroll:** add `logger` option to `scrollAllOver` function ([23adb0c](https://github.com/d-zero-dev/tools/commit/23adb0c97f8b946ae965d03c9d93a01bfced0e96))
- **puppeteer-scroll:** drop `accurate` option ([bf8df24](https://github.com/d-zero-dev/tools/commit/bf8df24271dd3c8da23cd3f8b459db2af1c39048))
- **puppeteer-scroll:** use `@d-zero/puppeteer-page` ([3a94e71](https://github.com/d-zero-dev/tools/commit/3a94e714f5a94d02492de787d99e49cb653be533))

### BREAKING CHANGES

- **puppeteer-scroll:** drop `accurate` option
- **puppeteer-scroll:** use `@d-zero/puppeteer-page` instead of `puppeteer`

## [1.0.5](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.4...@d-zero/puppeteer-scroll@1.0.5) (2024-10-03)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [1.0.4](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.3...@d-zero/puppeteer-scroll@1.0.4) (2024-06-25)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [1.0.3](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.2...@d-zero/puppeteer-scroll@1.0.3) (2024-06-13)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [1.0.2](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.1...@d-zero/puppeteer-scroll@1.0.2) (2024-05-22)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

## [1.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.0...@d-zero/puppeteer-scroll@1.0.1) (2024-05-15)

**Note:** Version bump only for package @d-zero/puppeteer-scroll

# [1.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/puppeteer-scroll@1.0.0-alpha.3...@d-zero/puppeteer-scroll@1.0.0) (2024-05-08)

**Note:** Version bump only for package @d-zero/puppeteer-scroll
