# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [3.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@3.0.0...@d-zero/beholder@3.1.0) (2026-06-17)

### Features

- **beholder:** expose extractMetaFromDocument for jsdom-backed meta extraction ([a56e21c](https://github.com/d-zero-dev/tools/commit/a56e21c17dcc1e542595a596074c5d8e659c1168))

# [3.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.6...@d-zero/beholder@3.0.0) (2026-06-16)

### Bug Fixes

- **beholder:** warn loudly and tripwire-test puppeteer Page.\_client() coverage ([97a07ea](https://github.com/d-zero-dev/tools/commit/97a07ea273e90d50bfede1d68f594ddee9c33268))

- feat(beholder)!: expand meta extraction with frontmatter-keys schema and Wappalyzer tag detection ([6ee7861](https://github.com/d-zero-dev/tools/commit/6ee78617aac3fe3d5c022ccfd0df265de0c5310b))

### Features

- **beholder:** rewrite getAnchorList with single AX tree + parallel describeNode ([#876](https://github.com/d-zero-dev/tools/issues/876)) ([7e5b089](https://github.com/d-zero-dev/tools/commit/7e5b089695bd1e605d63c6faef2e8bf927bd861f))

### BREAKING CHANGES

- `Meta` is restructured from flat keys (`noindex`, `canonical`,
  `'og:type'`, `'twitter:card'`, ...) into a nested shape backed by
  `frontmatter-keys.md`. New required fields: `title`, `jsonLd`,
  `speculationRules`, `originTrial`, `tags`, `others`. `getMeta(page)` now takes
  a context object `getMeta(page, { url, html?, statusCode?, headers? }, timeout?)`.
  Old top-level shortcuts (`canonical`, `alternate`, `noindex`, `nofollow`,
  `noarchive`, `'og:*'`, `'twitter:card'`) are removed; values move to
  `meta.link.canonical`, `meta.robots.*`, `meta.og.*`, `meta.twitter.*` etc.

Changes:

- New `src/meta/` module: `types.ts`, `keys.ts`, `parsers.ts`, `classify.ts`,
  `id-extractors.ts`, `tag-detection.ts`, plus ambient `simple-wappalyzer.d.ts`
- Browser-side `collectHead()` serializes every `<meta>`, `<link>`, structured-data
  `<script>`, `<base>`, `<iframe>` plus a curated set of `window` globals into
  `RawHeadEntry[]`; Node-side `classify()` maps these to typed Meta fields
- `simple-wappalyzer` (MIT) added as a dependency for technology detection;
  detected providers run through `id-extractors.ts` for real ID extraction
  (GA4, GTM, UA, FB Pixel, Hotjar, Clarity, ...)
- Unknown markup is preserved under `Meta.others` (meta/property/httpEquiv/
  itemprop/link/script/iframe buckets) so nothing is silently dropped
- Tests: parsers/classify/id-extractors/tag-detection units + getMeta
  error/timeout fallback

## [2.1.6](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.5...@d-zero/beholder@2.1.6) (2026-06-15)

### Bug Fixes

- **beholder:** prevent getMeta from hanging on unresponsive pages ([f55bb26](https://github.com/d-zero-dev/tools/commit/f55bb261c1868b40709cbae6aa17d273c5516e74)), closes [#874](https://github.com/d-zero-dev/tools/issues/874)

## [2.1.5](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.4...@d-zero/beholder@2.1.5) (2026-05-27)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.4](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.4-alpha.2...@d-zero/beholder@2.1.4) (2026-04-08)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.4-alpha.2](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.4-alpha.1...@d-zero/beholder@2.1.4-alpha.2) (2026-04-08)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.4-alpha.1](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.4-alpha.0...@d-zero/beholder@2.1.4-alpha.1) (2026-04-08)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.4-alpha.0](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.3...@d-zero/beholder@2.1.4-alpha.0) (2026-04-08)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.3](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.2...@d-zero/beholder@2.1.3) (2026-04-01)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.2](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.1...@d-zero/beholder@2.1.2) (2026-03-30)

**Note:** Version bump only for package @d-zero/beholder

## [2.1.1](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.1.0...@d-zero/beholder@2.1.1) (2026-03-30)

### Bug Fixes

- **beholder:** isolate per-device image extraction to prevent total failure ([f9e4dbc](https://github.com/d-zero-dev/tools/commit/f9e4dbc613ea92d85e178131a67ecb5c8af96e30))

# [2.1.0](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.0.1...@d-zero/beholder@2.1.0) (2026-03-24)

### Features

- **beholder:** track requestfailed events and retry on network disconnection ([5d167e3](https://github.com/d-zero-dev/tools/commit/5d167e3417dc3a458bb1dd64691960db9f91d734)), closes [#864](https://github.com/d-zero-dev/tools/issues/864)

## [2.0.1](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@2.0.0...@d-zero/beholder@2.0.1) (2026-03-11)

**Note:** Version bump only for package @d-zero/beholder

# [2.0.0](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.29...@d-zero/beholder@2.0.0) (2026-02-26)

- feat(beholder)!: replace SubProcessRunner with in-process Scraper ([eaf2768](https://github.com/d-zero-dev/tools/commit/eaf276898d96dccf6b504b22b7c8f0234162e82e))

### BREAKING CHANGES

- SubProcessRunner and related event types are removed.
  Use the new Scraper class with scrapeStart(page, url) instead.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

## [0.1.29](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.28...@d-zero/beholder@0.1.29) (2026-02-24)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.28](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.27...@d-zero/beholder@0.1.28) (2026-02-14)

### Bug Fixes

- **beholder:** fix port bug, remove HEAD body, and integrate beforePageScan ([ad87860](https://github.com/d-zero-dev/tools/commit/ad87860df10737993f8cb7428c7424b101536d8f))

## [0.1.27](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.26...@d-zero/beholder@0.1.27) (2026-02-12)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.26](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.25...@d-zero/beholder@0.1.26) (2026-02-06)

### Bug Fixes

- **beholder:** fix exports path from lib to dist in package.json ([eb348f1](https://github.com/d-zero-dev/tools/commit/eb348f1842be219d1a6dd3b0a107328484b6bf1f))

## [0.1.25](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.24...@d-zero/beholder@0.1.25) (2026-01-23)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.24](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.23...@d-zero/beholder@0.1.24) (2026-01-07)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.23](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.22...@d-zero/beholder@0.1.23) (2025-12-12)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.22](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.21...@d-zero/beholder@0.1.22) (2025-11-25)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.21](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.20...@d-zero/beholder@0.1.21) (2025-11-21)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.20](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.19...@d-zero/beholder@0.1.20) (2025-11-20)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.19](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.18...@d-zero/beholder@0.1.19) (2025-10-31)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.18](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.17...@d-zero/beholder@0.1.18) (2025-10-30)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.17](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.16...@d-zero/beholder@0.1.17) (2025-10-30)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.16](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.15...@d-zero/beholder@0.1.16) (2025-10-29)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.15](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.14...@d-zero/beholder@0.1.15) (2025-10-28)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.14](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.13...@d-zero/beholder@0.1.14) (2025-10-15)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.13](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.12...@d-zero/beholder@0.1.13) (2025-10-15)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.12](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.11...@d-zero/beholder@0.1.12) (2025-10-03)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.11](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.10...@d-zero/beholder@0.1.11) (2025-09-02)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.10](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.9...@d-zero/beholder@0.1.10) (2025-09-01)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.9](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.8...@d-zero/beholder@0.1.9) (2025-07-08)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.8](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.7...@d-zero/beholder@0.1.8) (2025-06-25)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.7](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.6...@d-zero/beholder@0.1.7) (2025-06-18)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.6](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.5...@d-zero/beholder@0.1.6) (2025-05-20)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.5](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.3...@d-zero/beholder@0.1.5) (2025-03-05)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.4](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.3...@d-zero/beholder@0.1.4) (2024-10-30)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.3](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.2...@d-zero/beholder@0.1.3) (2024-10-03)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.2](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.1...@d-zero/beholder@0.1.2) (2024-06-25)

**Note:** Version bump only for package @d-zero/beholder

## [0.1.1](https://github.com/d-zero-dev/tools/compare/@d-zero/beholder@0.1.0...@d-zero/beholder@0.1.1) (2024-06-13)

**Note:** Version bump only for package @d-zero/beholder

# 0.1.0 (2024-05-22)

### Features

- **beholder:** add `@d-zero/beholder` ([99b47c8](https://github.com/d-zero-dev/tools/commit/99b47c8693f6007f2a45dcfa66f4fd4ada42c5b2))
