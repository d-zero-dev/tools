# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
