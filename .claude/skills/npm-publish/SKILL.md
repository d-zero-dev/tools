---
name: npm-publish
description: npm パッケージのリリース（dev→main マージ、バージョニング、tag push、publish workflow 監視、publish 結果検証、dev への同期）
when_to_use: ユーザーが「リリースして」「publish して」「バージョン上げて」「/npm-publish」と指示した場合
disable-model-invocation: true
---

# 前提

- リリースは `main` ブランチから行う。`dev` の変更を `main` にマージしてから実行する
- タグ push（`v-release`）で publish workflow が発火し、npm へ自動 publish される（OIDC Trusted Publishing）
- **publish は取り消せない**。各ステップでユーザーの確認を取る
- **`yarn release` / `git push --tags` / `git push origin dev` はユーザーが実行する**。エージェントは実行せず `!` プレフィックス付きのコマンドを提示し、完了報告を待つ

# 対象パッケージ

このリポジトリが publish するパッケージ（independent モードのためバージョンは個別に上がる）:

| ディレクトリ | npm パッケージ名 |
|---|---|
| `packages/@d-zero/a11y-check` | `@d-zero/a11y-check` |
| `packages/@d-zero/a11y-check-axe-scenario` | `@d-zero/a11y-check-axe-scenario` |
| `packages/@d-zero/a11y-check-core` | `@d-zero/a11y-check-core` |
| `packages/@d-zero/a11y-check-scenarios` | `@d-zero/a11y-check-scenarios` |
| `packages/@d-zero/anatomist` | `@d-zero/anatomist` |
| `packages/@d-zero/archaeologist` | `@d-zero/archaeologist` |
| `packages/@d-zero/backlog-projects` | `@d-zero/backlog-projects` |
| `packages/@d-zero/beholder` | `@d-zero/beholder` |
| `packages/@d-zero/cli-core` | `@d-zero/cli-core` |
| `packages/@d-zero/dealer` | `@d-zero/dealer` |
| `packages/@d-zero/filematch` | `@d-zero/filematch` |
| `packages/@d-zero/fs` | `@d-zero/fs` |
| `packages/@d-zero/google-auth` | `@d-zero/google-auth` |
| `packages/@d-zero/google-sheets` | `@d-zero/google-sheets` |
| `packages/@d-zero/html-distiller` | `@d-zero/html-distiller` |
| `packages/@d-zero/notion` | `@d-zero/notion` |
| `packages/@d-zero/page-cluster` | `@d-zero/page-cluster` |
| `packages/@d-zero/print` | `@d-zero/print` |
| `packages/@d-zero/proc-talk` | `@d-zero/proc-talk` |
| `packages/@d-zero/puppeteer-dealer` | `@d-zero/puppeteer-dealer` |
| `packages/@d-zero/puppeteer-general-actions` | `@d-zero/puppeteer-general-actions` |
| `packages/@d-zero/puppeteer-page-scan` | `@d-zero/puppeteer-page-scan` |
| `packages/@d-zero/puppeteer-screenshot` | `@d-zero/puppeteer-screenshot` |
| `packages/@d-zero/puppeteer-scroll` | `@d-zero/puppeteer-scroll` |
| `packages/@d-zero/readtext` | `@d-zero/readtext` |
| `packages/@d-zero/remote-inspector` | `@d-zero/remote-inspector` |
| `packages/@d-zero/replicator` | `@d-zero/replicator` |
| `packages/@d-zero/roar` | `@d-zero/roar` |
| `packages/@d-zero/shared` | `@d-zero/shared` |

# 手順

## 1. ワーキングツリーの状態確認

`git status` で未コミットの変更・未追跡ファイルがないか確認する。

- クリーンなら次へ
- 変更があればユーザーに報告し、`git stash` / コミット / 中断のいずれかを尋ねる。指示に従ってから次へ

汚れたまま先に進むとマージ・バージョニングが意図しない差分を巻き込むため、ここは省略しない。

## 2. main と dev の最新化

```bash
git fetch origin
git checkout main
git pull origin main
git checkout dev
git pull origin dev
git checkout main
```

両ブランチをローカルで最新にしてから `main` に戻る。`dev` をローカルで最新にしておくのは、手順 11 の `main` → `dev` 同期でそのまま使うため。

いずれかの `pull` がコンフリクトやリジェクトで失敗したらユーザーに報告して指示を仰ぐ。

## 3. 未マージ PR の確認

リリースに含めるべき PR が残っていないか確認し、あればユーザーに提示して続行可否を尋ねる。

```bash
gh pr list --base dev --state open
```

## 4. dev → main マージ

`dev` が `main` より進んでいる場合、差分コミットをユーザーに提示してからマージする。

```bash
git log --oneline main..dev
git merge dev --no-edit
```

コンフリクトが発生したらユーザーに報告して指示を仰ぐ。

## 5. lockfile の同期確認

```bash
yarn install
git diff yarn.lock
```

差分が出たらユーザーに報告し、コミットしてから次へ。CI の `yarn install --immutable` が失敗するのを防ぐため必須。

## 6. 事前チェック

```bash
yarn lint
yarn build
yarn test
```

すべてパスすること。`yarn release` は内部の `prerelease` スクリプト（`yarn build; yarn test`）で build / test を再度走らせるが、`lerna version` の途中で失敗するより事前に落としたほうが安全なので省略しない。失敗があれば修正してから次へ。`main` の CI が green かも併せて確認する。

```bash
gh run list --branch main --limit 5
```

## 7. リリース内容の提示

現在のバージョンと前回タグからの差分をユーザーに提示し、リリース種別（graduate / alpha / beta / rc）の判断材料にする。

```bash
git describe --tags --abbrev=0
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

independent モードではパッケージごとにバージョンが異なるため、各パッケージの現行バージョン（`packages/@d-zero/*/package.json` の `version`）も提示する。

## 8. バージョニングと tag push（ユーザー実行）

`lerna version` はインタラクティブなため Claude からは実行できない。リリース種別を確認したうえで、`!` プレフィックス付きでユーザーに実行を依頼し、**完了報告を待つ**。

```
! yarn release          # graduate（正式リリース）
! yarn release:alpha    # alpha プレリリース
! yarn release:beta     # beta プレリリース
! yarn release:rc       # RC プレリリース
```

続けてタグを push する。

```
! git push --tags
```

`release:trigger` スクリプトが `git push origin main --follow-tags` と `v-release` タグの強制更新まで済ませているため、`git push --tags` は通常 "Everything up-to-date" になる。取りこぼしがないことの確認として実行しておく。

ユーザーから完了報告を受けたら、実際にタグが push されたことを確認してから次へ進む。

```bash
git ls-remote --tags origin
```

## 9. publish workflow の監視

`v-release` タグ push で `publish.yml` が発火する。バックグラウンド実行で完了を待つ。

```bash
gh run watch --exit-status
```

失敗したらログ URL をユーザーに提示し、「12. 失敗時の対処」へ。

## 10. dist-tag の判定ロジック（参考）

`publish.yml` は `packages/@d-zero/shared/package.json` の `version` を読み、以下で dist-tag を決める:

- `-alpha` を含む → `alpha`
- `-beta` を含む → `beta`
- `-rc` を含む → `rc`
- それ以外で `-` を含む → `next`
- 上記以外 → `latest`

手順 12 の検証で、実際に付いた dist-tag がこのロジック通りかを確認する材料にする。

## 11. publish 結果の検証

workflow が success でも publish が意図通りとは限らない。**「対象パッケージ」の全 29 パッケージについて**実際の npm 上の状態を確認する。

```bash
npm view <package> version
npm view <package> dist-tags
```

確認項目:

- バージョンが手順 8 で上げた値と一致しているか
- dist-tag が手順 10 のロジック通りか（正式リリースは `latest`、プレリリースは `alpha` / `beta` / `rc` / `next`）
- provenance が付与されているか（npm の該当バージョンページ、または `npm view <package> --json` の `dist.attestations`）

independent モードでは**一部のパッケージだけ publish される（部分 publish）**ことがある。29 パッケージ全てを個別に確認し、漏れがあればユーザーに報告する。

**ここが success の判定点**。npm 上の状態を確認するまでリリース完了と判断してはいけない。

## 12. main → dev の同期

publish の成功を確認した後、バージョン更新コミットを `dev` に取り込む。

```bash
git checkout dev
git merge main --no-edit
```

コンフリクトが発生したらユーザーに報告して指示を仰ぐ。マージできたら push をユーザーに依頼する。

```
! git push origin dev
```

`dev` はブランチ保護がかかっており、`maintain` ロールでは直接 push できない場合がある。push が拒否されたら、`dev` への取り込みを PR 経由に切り替える（`git checkout -b chore/sync-main` してから `.claude/skills/pr/SKILL.md` の手順へ）。

## 13. 失敗時の対処

- **sigstore の transient 409**: workflow 側に retry ステップがあるため、まず retry の結果を確認する。それでも失敗する場合は `gh run rerun` で再実行
- **部分 publish**: 成功したパッケージは publish 済みで巻き戻せない。未 publish のパッケージのみを対象に、`v-release` タグを打ち直して workflow を再発火させる（`lerna publish from-package` は未 publish のバージョンのみを対象にするため、成功済みパッケージは二重 publish されない）
- **誤ったバージョンを publish した**: unpublish は原則不可。`npm deprecate <package>@<version> "<理由>"` で非推奨化し、修正版を新バージョンとして publish する。この判断は必ずユーザーに確認を取る
- **publish が失敗したまま中断する場合**: 手順 12 の `dev` 同期は行わない。`main` にバージョン更新コミットだけが残るため、次回リリース時にそこから再開する

# 注意

- **`v-release` タグの作成・削除は CODEOWNERS のみ**（GitHub Rulesets で保護）。権限がない場合は手順 8 で失敗するため、実行者がタグ権限者か事前に確認する
- **publish は取り消せない**。手順 5・6 の事前チェックを省略しない
- **`.yarnrc.yml` の `npmMinimalAgeGate: 7d` を一時的に外していないか確認する**。サプライチェーン対策の設定を戻し忘れたまま publish すると保護が効かない状態でリリースすることになる
