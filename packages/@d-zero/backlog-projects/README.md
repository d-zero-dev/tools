# `@d-zero/backlog-projects`

Backlog プロジェクトのタスク一括登録と、古い課題の添付ファイル削除を行う CLI。

## Installation

```sh
yarn add @d-zero/backlog-projects
```

## Usage

```sh
npx @d-zero/backlog-projects --assign   # タスク一括登録（プロンプト形式）
npx @d-zero/backlog-projects --delete   # 添付ファイル削除（ダウンロード後に削除）
```

オプションは `--help` を参照。

### `.env`

```
BACKLOG_HOST=xxxxx.backlog.jp
BACKLOG_APIKEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_TOKEN=secret_xxxxxxxxxxxxxx
```

### 添付ファイル削除の出力

保存先は `<outDir>/<プロジェクトキー>/<課題キー>/` 階層。各ファイルには削除結果のメタデータ（`.json`）が同梱される。
