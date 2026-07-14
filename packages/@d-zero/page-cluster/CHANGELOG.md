# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.3.0](https://github.com/d-zero-dev/tools/compare/@d-zero/page-cluster@0.2.0...@d-zero/page-cluster@0.3.0) (2026-07-14)

### Bug Fixes

- **page-cluster:** resolve first-party stylesheet ties via page host ([542c533](https://github.com/d-zero-dev/tools/commit/542c53324c77d22e1ef90f799a12f1f03a6e2fc9))

- feat(page-cluster)!: trim options, add CLI and onProgress, cut public API ([359acc3](https://github.com/d-zero-dev/tools/commit/359acc3c0b892524af77e05f73cec5b4ebc301d7))
- feat(page-cluster)!: add streaming API for corpora that overflow memory ([d54c8e1](https://github.com/d-zero-dev/tools/commit/d54c8e10283cfc68150d1ea6b9f8c6326e06126f))

### Features

- **page-cluster:** add self-tuning recursive clustering ([4cb5e83](https://github.com/d-zero-dev/tools/commit/4cb5e83cee0b9050d91c60e93368ea1b79768d86))
- **page-cluster:** drop depth heuristic, discover local chrome via auto-cut ([ae5dc24](https://github.com/d-zero-dev/tools/commit/ae5dc247f7460ee3143ad732b54591d52fe1c087))
- **page-cluster:** extend landmark extraction to form and search ([ec182f8](https://github.com/d-zero-dev/tools/commit/ec182f8eb39b7cb67f77aceda4d42abac7bfc034))
- **page-cluster:** show user-friendly stderr progress via Lanes ([37c4acb](https://github.com/d-zero-dev/tools/commit/37c4acbb14625f3adc3948912d155f50b9506aa6))

### BREAKING CHANGES

- the `mergeRareLandmarkClusters`,
  `landmarkRarityThreshold`, `landmarkGateSimilarityThreshold`, and
  `autoCapMainDepth` options are removed from `resolvePageClusterKeys`. The
  `autoCapMainDepth`-driven <main> depth cap is now unconditional and
  matches the previous default (`true`); the rare-landmark merge feature was
  never validated on real crawl data and is dropped along with its
  `mergeLandmarkAffinedClusters` implementation.
- `package.json` `exports` shrinks from 17 subpaths to 4
  (`.` / `./extract-landmarks` / `./resolve-landmark-variant-keys` /
  `./resolve-page-cluster-keys`). Internal helpers stay in `src/` for
  in-package imports; downstream callers relying on removed subpaths must
  build against the public surface.

New:

- `resolvePageClusterKeys` is now async and takes a factory
  function `() => Iterable<Page> | AsyncIterable<Page>`. Callers with a
  materialized array can use the new `resolvePageClusterKeysFromArray`
  convenience wrapper; existing sync array-based use cases keep working with a
  one-line change.

Corpora at or below `CORPUS_INLINE_THRESHOLD` (20,000 pages) still take the
byte-identical in-memory path; larger corpora are processed via three passes:

- Pass 0 (HTML-free) — read blocking signals only and compute block keys
  with the existing blocking / orphan-reassignment / first-party filter
  pipeline.
- Pass 1 (per-block reservoir sampling) — draw up to `BLOCK_SAMPLE_SIZE`
  (100) pages per block, run Stage A on the sample, emit its CrossBlockUnits,
  and save learned artifacts (per-block `maxMainDepth`, local-chrome
  signatures, per-cluster member token sets) for the assignment step.
- Pass 1b (streaming assignment) — Jaccard-assign every non-sample page to
  its block's nearest sample-derived cluster.

Additional memory reductions:

- `CrossBlockUnit.memberLandmarks: ExtractLandmarksResult[]` becomes
  `memberLandmarkInstances: PerPageLandmarkInstance[][]`. Landmarks are
  pre-tokenized at unit creation instead of being re-tokenized by shellQuorum
  each round.
- `mergeCrossBlockClusters` accepts an opt-in `capMembers` option that
  down-samples merged groups after each merge. Streaming callers pass 100;
  the in-memory path omits it to keep validated corpora unchanged.

Small-corpus regression preserved on the four historically validated
corpora (302 / 8,936 / 1,416 / 89 pages → 9 / 21 / 63 / 3 clusters). New
streaming path validated on a 176,046-page real crawl: completes in ~28 min
at 1.4 GB peak RSS / 2.8 GB peak heap, well within an 8 GB budget.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

- **page-cluster:** ExtractLandmarksResult fields change from string|undefined
  to string[]; every landmark instance is now returned in document order
  instead of just the shallowest match per type.
- **page-cluster:** cluster keys may differ from previous versions

# 0.2.0 (2026-07-09)

### Bug Fixes

- **page-cluster:** detect the content-depth knee per block, not globally ([c5b2e73](https://github.com/d-zero-dev/tools/commit/c5b2e73197f28a20972e6c44f8ac12a79577bc32))
- **page-cluster:** escape tag names before building the genuine-close regex ([8aaeffe](https://github.com/d-zero-dev/tools/commit/8aaeffe662923bdc0d575062a8f17ad83a1c8a74))

### Features

- **page-cluster:** add complete-linkage structural clustering within a block ([87728a7](https://github.com/d-zero-dev/tools/commit/87728a72e7028d1438b5f9270801c005690d23e9))
- **page-cluster:** add frequency-based template/content token split ([68acfe8](https://github.com/d-zero-dev/tools/commit/68acfe840a8e38b506972f65fb51c726385b4541))
- **page-cluster:** add HTML structure tokenizer for duplicate-page detection ([286f121](https://github.com/d-zero-dev/tools/commit/286f121233df08f5fdb829e815824cdfa3cbfd3f))
- **page-cluster:** add Jaccard similarity and array edit distance primitives ([deebd85](https://github.com/d-zero-dev/tools/commit/deebd85e118256d7c8b0ccd1ec44105fdf981f4d))
- **page-cluster:** add URL-path and stylesheet blocking-key derivation ([fb29464](https://github.com/d-zero-dev/tools/commit/fb294645aef8337e738f8c77c88135b88f58b5e8))
- **page-cluster:** auto-detect a content-depth cap inside <main> ([a79507c](https://github.com/d-zero-dev/tools/commit/a79507c18ee03fe04660f3fb57e1f2ca32488925))
- **page-cluster:** expose clustering pipeline and fix audit findings ([139252d](https://github.com/d-zero-dev/tools/commit/139252dc218938217421a0e8d744726a759e0945))
- **page-cluster:** extract header/footer/nav/aside landmarks before clustering ([b56d777](https://github.com/d-zero-dev/tools/commit/b56d777139a217e961d0dbbc1d0b8b0fe223bdf3))
- **page-cluster:** merge clusters sharing a rare landmark variant ([6018e0a](https://github.com/d-zero-dev/tools/commit/6018e0a3627de89852ca689438bf47dd08064afc))
- **page-cluster:** reassign orphan pages to their same-section css: block ([4c71b7f](https://github.com/d-zero-dev/tools/commit/4c71b7f2216caae30103563200b1f2d4152e84da))
- **page-cluster:** remove freeform content blocks and third-party stylesheets ([08a9c2a](https://github.com/d-zero-dev/tools/commit/08a9c2aa753a2f432da284d156d2951f7edf0f24))
- **page-cluster:** resolve which blocking key to use per page ([eeb937f](https://github.com/d-zero-dev/tools/commit/eeb937f09e4cde20eba1e29dbf41e65d97c4603e))

### BREAKING CHANGES

- **page-cluster:** tokenize() now returns { tokens, bodyClassList } instead of
  a bare string[]. Package is 0.x, so no migration guide is required.
