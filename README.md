# ディーゼロ制作関連ツール

ウェブサイト制作・検証・管理のためのツール群です。レスポンシブデザイン対応、ビジュアルリグレッション検証、スクリーンショット撮影、リソース複製などの機能を提供します。

## CLI ツール

- [`@d-zero/a11y-check`](./packages/%40d-zero/a11y-check/README.md) - ウェブサイトのアクセシビリティチェックツール
- [`@d-zero/archaeologist`](./packages/%40d-zero/archaeologist/README.md) - ウェブサイトの本番環境と開発環境の差分検証ツール
- [`@d-zero/backlog-projects`](./packages/%40d-zero/backlog-projects/README.md) - Backlogプロジェクト管理ツール
- [`@d-zero/filematch`](./packages/%40d-zero/filematch/README.md) - ファイルマッチングツール
- [`@d-zero/print`](./packages/%40d-zero/print/README.md) - ウェブページのスクリーンショット撮影ツール
- [`@d-zero/remote-inspector`](./packages/%40d-zero/remote-inspector/README.md) - SSH/SFTP経由でローカルとリモートファイルを比較するツール
- [`@d-zero/replicator`](./packages/%40d-zero/replicator/README.md) - レスポンシブ対応のウェブページ複製ツール

## ライブラリ

### アクセシビリティ

- [`@d-zero/a11y-check-core`](./packages/%40d-zero/a11y-check-core/README.md) - アクセシビリティチェックのコア機能
- [`@d-zero/a11y-check-axe-scenario`](./packages/%40d-zero/a11y-check-axe-scenario/README.md) - axe-coreを使用したアクセシビリティチェックシナリオ
- [`@d-zero/a11y-check-scenarios`](./packages/%40d-zero/a11y-check-scenarios/README.md) - カスタムアクセシビリティチェックシナリオ

### ウェブスクレイピング

- [`@d-zero/beholder`](./packages/%40d-zero/beholder/README.md) - ウェブページのスクレイピングと記録機能

### Puppeteer関連

- [`@d-zero/puppeteer-dealer`](./packages/%40d-zero/puppeteer-dealer/README.md) - Puppeteerページハンドリングとブラウザ管理
- [`@d-zero/puppeteer-general-actions`](./packages/%40d-zero/puppeteer-general-actions/README.md) - Puppeteer汎用アクション
- [`@d-zero/puppeteer-page-scan`](./packages/%40d-zero/puppeteer-page-scan/README.md) - ページスキャン用ヘルパー関数とデバイス設定
- [`@d-zero/puppeteer-screenshot`](./packages/%40d-zero/puppeteer-screenshot/README.md) - スクリーンショット撮影機能
- [`@d-zero/puppeteer-scroll`](./packages/%40d-zero/puppeteer-scroll/README.md) - ページスクロール機能

### Google連携

- [`@d-zero/google-auth`](./packages/%40d-zero/google-auth/README.md) - Google API認証機能
- [`@d-zero/google-sheets`](./packages/%40d-zero/google-sheets/README.md) - Google Sheets API型安全ラッパー

### ユーティリティ

- [`@d-zero/cli-core`](./packages/%40d-zero/cli-core/README.md) - CLIツール共通ユーティリティ
- [`@d-zero/dealer`](./packages/%40d-zero/dealer/README.md) - 並列処理管理
- [`@d-zero/fs`](./packages/%40d-zero/fs/README.md) - ファイルシステムユーティリティ（zip/unzip）
- [`@d-zero/html-distiller`](./packages/%40d-zero/html-distiller/README.md) - HTML解析・抽出機能
- [`@d-zero/notion`](./packages/%40d-zero/notion/README.md) - Notion API連携
- [`@d-zero/proc-talk`](./packages/%40d-zero/proc-talk/README.md) - プロセス間通信
- [`@d-zero/readtext`](./packages/%40d-zero/readtext/README.md) - テキスト読み取り機能
- [`@d-zero/roar`](./packages/%40d-zero/roar/README.md) - サブコマンド対応CLIヘルパーライブラリ（yargs-parserベース）
- [`@d-zero/shared`](./packages/%40d-zero/shared/README.md) - 共通ユーティリティ関数

## マイグレーションガイド

破壊的変更を伴うリリースには移行手順を用意しています。

- [MIGRATION-page-hooks.md](./MIGRATION-page-hooks.md) - ページフック API の整合化（`@d-zero/print` / `@d-zero/archaeologist` / `@d-zero/a11y-check` / `@d-zero/a11y-check-core` / `@d-zero/puppeteer-page-scan`）

## メンテナンス環境

- [Volta](https://volta.sh/)によって管理しています。
  - [Node.js](https://nodejs.org/)のバージョンは[`package.json`](./package.json)に記載しています
  - [yarn](https://yarnpkg.com/)のバージョンは[`package.json`](./package.json)に記載しています
  - このバージョンは[Renovate](https://www.mend.io/renovate/)によってアップデートされます
- [Commitizen](https://github.com/commitizen/cz-cli)を利用してコミットメッセージを作ります（メッセージは[_commitlint_](https://commitlint.js.org/)によってチェックされます）

### メンテ用のコマンド

| コマンド     | 内容                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `yarn build` | 各パッケージのビルドを行います                                             |
| `yarn lint`  | リポジトリ内のファイルのリント・自動フォーマット・スペルチェックを行います |
| `yarn test`  | リポジトリ内のファイルのテストを実行します                                 |
| `yarn co`    | Gitコミットを*Commitizen*経由で実行します                                  |
