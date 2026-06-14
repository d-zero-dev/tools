# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

D-ZERO 株式会社の Web 開発・テスト・自動化ツール群（`@d-zero-dev/tools`）。Lerna + Yarn Workspaces のモノレポ構成で、`@d-zero/` スコープ配下に多数のライブラリ／CLI を提供する（**independent バージョンモード**）。

## プロジェクト構成

作業前に以下のファイルを確認し、プロジェクトの状態を把握すること:

- `package.json` — scripts、devDependencies、Volta（Node 24 / Yarn 4）
- `lerna.json` — **independent バージョンモード**、`packages/@d-zero/*`
- `ARCHITECTURE.md` — パッケージ一覧、レイヤ構成、設計方針、主要な技術スタック
- `README.md` — リポジトリ概要
- `tsconfig.json` — TypeScript 設定
- 各パッケージの構成は `packages/@d-zero/*/package.json` を参照

## コマンド

- `yarn build` — 全パッケージビルド（`lerna run build`）
- `yarn watch` — `lerna run watch --parallel`
- `yarn test` — Vitest によるテスト実行
- `yarn lint` — eslint / prettier / textlint / cspell を直列実行
- `yarn release` / `yarn release:alpha` 等 — `lerna version`（independent モード）→ `release:trigger` で `git push origin main --follow-tags` と `v-release` タグ強制更新を行う。リリース手順は `/release` コマンド参照

### コマンド制約

- **yarn のみ使用**: npm / pnpm / bun / deno によるコマンド実行は禁止
- **パッケージディレクトリに cd しない**: 常にリポジトリルートから実行
- **ビルドは `yarn build` のみ**: `npx tsc`、`lerna run build --scope` 等の個別指定は禁止
- **コマンドの連続実行禁止**: `&&`、`;`、改行によるコマンド連結をしない。1回の Bash 呼び出しで1コマンドのみ実行する。連結されたコマンドは settings.json の permissions allow/deny でパターンマッチできず、毎回ユーザーの手動承認が必要になり効率が大幅に低下する

## アーキテクチャ

詳細は [`ARCHITECTURE.md`](../ARCHITECTURE.md) を参照。各パッケージのカテゴリ・依存関係・設計方針はそちらに集約されている。

ドキュメントと実装に矛盾がある場合は、**実装が正**とし、ドキュメントを修正すること。

## independent モードの注意

- 各パッケージは個別のバージョンを持つ。`lerna version` は変更のあったパッケージのみ昇格させる
- リリース時は `v-release` タグの強制更新を伴う（`publish.yml` のトリガー）
- 単一パッケージの破壊的変更でもリポジトリ全体の major bump にはならない

## コーディング規約

- **`@d-zero/shared` はサブパスエクスポート**: `@d-zero/shared/parse-url` のような形式で import すること（ルート import は不可）
- **exports フィールドを壊さない**: package.json の `exports` を変更する場合は差分のみを追記し、既存パスを削除しない
- 1関数1ファイルを基本とし、`index.ts` の作成は避ける

## セキュリティ

### 機密情報の取り扱い

- `.env`、`.env.*` 等の機密ファイルを読み取り・編集・コミットしない（機密ファイルの判断は `.gitignore` を参考にすること）
- `credentials.json`、`token.json` 等の Google API 認証情報も同様に扱う
- コミット前に `git diff --staged` で機密情報（API キー、トークン、パスワード、企業名、顧客情報）が含まれていないか確認する
- 環境変数やシークレットをコード内にハードコードしない

### サプライチェーン保護

- **yarn dlx は完全禁止**: ローカルパッケージを使わずリモートから直接実行するため、サプライチェーン攻撃に脆弱
- **npx は原則使わない**: package.json の scripts で定義されたコマンドを `yarn <script>` で実行すること
- 新しい依存パッケージの追加は慎重に。既存の依存で解決できないか先に確認する
- `yarn add` する前にパッケージの信頼性（ダウンロード数、メンテナンス状況、既知の脆弱性）を確認する
- `yarn add` する場合はバージョンを固定する（例: `yarn add foo@1.2.3`）
- lockfile（yarn.lock）の手動編集は禁止

## スキル

タスクに応じて `.claude/skills/` 配下のスキルを参照すること。

| スキル          | パス                                      | 用途                                                        |
| --------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Product Manager | `.claude/skills/product-manager/SKILL.md` | リポジトリ分析、ドキュメント生成・レビュー、PR レビュー     |
| QA Engineer     | `.claude/skills/qa-engineer/SKILL.md`     | コードレビュー、テスト品質チェック、カバレッジ改善          |
| Impl            | `.claude/skills/impl/SKILL.md`            | 合意済み計画の実装・検証・PR 作成までのオーケストレーション |
