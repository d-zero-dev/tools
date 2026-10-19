---
name: git
description: Git 操作ルール（コミット作成、メッセージ形式、事前チェック、破壊的変更の扱い）
---

# コミット前ブランチチェック（必須・最優先）

コミットを求められたら、他の何より先に以下を行う。

1. `git branch --show-current` で現在のブランチを確認する
2. 現在のブランチが `main` / `dev` のいずれかに該当する場合、コミットを進めず、ユーザーにトピックブランチの作成を提案する
3. 該当しない場合はそのまま以下のコミット作成手順に進む

# コミット作成

- 「コミット」を求められた場合、毎回のコミットを `git status` の実行から始める。**以前の状態やメモリを信用しない** — ステージングエリアは会話の途中でユーザーが変えている可能性がある
  1. ファイルが既にステージングされている場合:
     - ユーザーがその組み合わせを用意している。**`git add` や `git restore` を使わず、ステージングエリアを一切変更しない**
     - `git diff --staged` でステージング済みファイルを確認し、そのファイル*のみ*に基づくコミットメッセージを作成
     - メッセージ付きで `git commit` を直接実行（ユーザーが適宜承認する）
  2. ステージングされたファイルがない場合:
     - 以下のコミット粒度に基づいてファイルを順次ステージングしてからコミット:
       - パッケージ単位でコミットを分割（independent モードなので、コミットに含めたパッケージだけが `lerna version` でバージョンアップの対象になる）
       - 依存元を先にコミット（後述の「パッケージのコミット順序」を参照。不明なら `yarn lerna list --graph --all` で確認）
- **各コミット後:** `git status` と `git diff` を見直し、今回の作業に属する変更が残っていれば、上の粒度と順序に従って続けてコミットする。残りが作業と無関係な変更のときや、分け方が曖昧なときだけユーザーに確認する
- OS、アプリケーション設定、またはコンテキストから英語以外の言語が使用されていると判断される場合、コミットコマンド実行の直前に、コミットメッセージの翻訳と説明をその言語で提供すること。

# コミット前コンテンツチェック

`git commit` を実行する前に、必ず `git diff --staged` をスキャンして以下の 2 点を確認する。実サイトに対して CLI を動かして確認するパッケージが多いので、実データ断片の混入には特に注意する。

## 1. 機密・案件情報の検出

プロジェクト固有の名称、企業名、顧客情報、API キー・トークン（Google / Notion / Backlog の認証情報を含む）など、リポジトリに含めるべきでない情報がないか確認する。

## 2. サンプル値の慣例チェック

サンプル値が「無いこと」ではなく「**予約済み慣例に従っていること**」を確認する。

**許可される値（予約済み慣例）:**

- ドメイン: `example.com` / `example.org` / `example.net`、`*.example` / `*.test` / `*.invalid` / `*.localhost`（RFC 2606 / RFC 6761）
- IP: `127.0.0.1`、TEST-NET（`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`）、`2001:db8::/32`
- メール: `user@example.com` 系

**検出対象（混入してはいけない値）:**

- 実在する無関係ドメイン・URL・パス
- 未取得の創作ドメイン（もっともらしい造語ドメインは将来第三者が取得しうる — supply-chain / SEO リスク）
- 案件キーワード・顧客識別子・実データ由来の識別子
- 実サイト・実コーパスでの実験・デバッグの残骸（実 URL、実ページタイトル、実クエリ値、`.archaeologist` / `.print` / `.page-cluster` の出力など）

**検出時の対処:**

- ステージングから除外するのではなく、**汎用値（example.com 等）へ書き換える**（fixture 内の実ドメインは除外しても解決しない）。書き換え後にテストが通ることを確認してからコミットする
- 判断が難しい場合（実データが検証に不可欠に見える等）はユーザーに確認する

# パッケージのコミット順序（依存元優先）

複数パッケージにまたがる変更をコミットする場合、必ず**リーフからルートへ**コミットする。依存順序が不明な場合は `yarn lerna list --graph --all` で確認する。ルート設定ファイル（`package.json`、lint 設定等）の変更はティア 0 より先にコミットする。

| ティア | パッケージ                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------ |
| 0      | `shared`, `readtext`, `fs`, `html-distiller`, `google-auth`, `puppeteer-general-actions`, `roar` |
| 1      | `cli-core`, `dealer`, `notion`, `proc-talk`, `puppeteer-scroll`, `google-sheets`, `filematch`    |
| 2      | `puppeteer-page-scan`, `puppeteer-dealer`, `page-cluster`, `remote-inspector`, `backlog-projects` |
| 3      | `puppeteer-screenshot`, `beholder`, `a11y-check-core`, `replicator`                              |
| 4      | `archaeologist`, `print`, `anatomist`, `a11y-check-axe-scenario`, `a11y-check-scenarios`         |
| 5      | `a11y-check`                                                                                     |

# コミットメッセージの形式

- 英語で記述すること
- 命令法を使用すること
- Conventional Commits を使用すること
  - 使用するタイプ: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  - 使用するスコープ:
    - 各パッケージ名（ネームスペースなし）: `a11y-check`, `a11y-check-axe-scenario`, `a11y-check-core`, `a11y-check-scenarios`, `anatomist`, `archaeologist`, `backlog-projects`, `beholder`, `cli-core`, `dealer`, `filematch`, `fs`, `google-auth`, `google-sheets`, `html-distiller`, `notion`, `page-cluster`, `print`, `proc-talk`, `puppeteer-dealer`, `puppeteer-general-actions`, `puppeteer-page-scan`, `puppeteer-screenshot`, `puppeteer-scroll`, `readtext`, `remote-inspector`, `replicator`, `roar`, `shared`
    - `repo`, `deps`, `github`
- メッセージ本文の各行は100文字以下
- 件名は sentence-case, start-case, pascal-case, upper-case にしない

# 破壊的変更と振る舞いの変更

- 破壊的変更マーカー（タイプ直後の `!`、または `BREAKING CHANGE:` / `BREAKING-CHANGE:` フッター）は、意図された使い方が壊れる変更に付ける。付けてよいかは**そのコミットが触るパッケージの現バージョン段階**で決まる。independent モードなので `yarn release`（`lerna version --conventional-commits`）はパッケージごとに、そのパッケージを触ったコミットだけを見てバージョンを決める。マーカー付きコミットの効果は段階ごとに違う

  | 触るパッケージの現バージョン（`package.json`）                                  | マーカー付きコミットの効果                                                    | 扱い                                                                             |
  | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
  | `0.y.z`                                                                         | メジャーはマイナーに丸められる（`0.7.6` → `0.8.0`）                           | 付けてよい。破壊的変更が許される段階で、CHANGELOG に BREAKING CHANGES として残る |
  | `X.0.0-alpha.n`（次メジャーのプレリリース）                                     | プレリリース番号が進むだけ（`alpha.n+1`）。graduate で `X.0.0`                | 付けてよい。同上                                                                 |
  | `X.Y.0-alpha.n`（`Y` ≠ 0）、`X.Y.Z-alpha.n`（マイナー / パッチのプレリリース） | `premajor` に跳ねる（`3.5.0-alpha.2` → `4.0.0-alpha.0`）。graduate で `4.0.0` | ユーザーが「メジャーを切る」と承認したときだけ                                   |
  | `X.Y.Z`（`1.0.0` 以降の安定版。多くのパッケージはここ）                         | そのパッケージの次のリリースがメジャーになる                                  | 同上                                                                             |

- 1 つのコミットが複数パッケージを触るなら、マーカーはその全パッケージに効く。破壊的変更を含むパッケージとそうでないパッケージは別コミットにする
- 承認が要る段階でマーカーを書くのは、ユーザーが質問（種別: spec silent。メジャーを切るかどうかは判断基準が決めない）に「切る」と答えたときだけ。承認が無ければその変更はコミットしない（壊さない設計に戻すか、計画に差し戻す）。`yarn commit`（commitizen）の breaking change の問いは、マーカーを付けてよいときだけ「yes」と答える
- 安定版で、メジャーを切らずに出すことをユーザーが例外として明示的に決めた破壊的変更は、マーカーを付けずに本文の最後の段落を `Behavior change (approved): ` で始め、マイグレーションガイドを PR 本文の `## 振る舞いの変更` に書く
- 破壊的ではないが観察できる振る舞いが変わる変更（CLI の出力・終了コード・生成ファイルの形、ライブラリの戻り値の内容や順序、既定値、エラーメッセージ等）は、本文の最後の段落を `Behavior change: ` で始め、影響するデータと before → after を 1〜2 文で書く。conventional-changelog はこの語を破壊的変更として読まないのでバージョンには影響しない。`npm-publish` スキルがリリース前に `git log --grep` で集めてリリース内容として提示する。`.claude/rules/spec-files.md` が既存テストの assertion を反転するときに付けるラベルも同じ語

# コミットメッセージの安全ガイドライン

- シンプルな1行コミットにはシングルクォート (') を使用
- 複数行のコミットメッセージには、必ず heredoc 形式を使用（下記参照）
- 複数行のメッセージで複数の -m フラグを使わない（commitlint のパースエラーの原因になる）

## Heredoc 形式（複数行メッセージはすべて）

heredoc とコマンド置換を使って複数行のコミットメッセージを渡す。

**形式 — 振る舞いの変更の段落を持つコミット:**

```bash
git commit -m "$(cat <<'EOF'
fix(dealer): subject line

何をなぜ変えたか（他のコミットと同じ）。

Behavior change: `deal()` が `AbortSignal` の abort 後に残りのタスクを開始しなくなった。
abort 後の完了を待っていた呼び出し側は、未開始タスクの結果を受け取らない。
EOF
)"
```

**形式 — 破壊的変更（マーカーを付けてよい段階、または承認済み）:**

```bash
git commit -m "$(cat <<'EOF'
type(scope)!: subject line

BREAKING CHANGE: 説明

詳細:
- 変更点1
- 変更点2
EOF
)"
```

## シンプルなコミット

```bash
git commit -m 'type(scope): subject line'
```
