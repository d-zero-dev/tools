# @d-zero/remote-inspector

SSH/SFTP経由でローカルファイルとリモートファイルを比較し、デプロイ前の差分確認を行うツールです。実際にデプロイすることなく、ローカルファイルとリモートサーバーファイルの違いを検査できます。

## 機能

- 🔍 **ファイル比較**: SSH/SFTP経由でローカルファイルとリモートファイルを比較
- 📊 **テキスト差分**: テキストファイルの行単位差分表示（カラーコード付き）
- 📦 **バイナリチェック**: バイナリファイル（画像、PDF等）のサイズ比較
- 🆕 **新規ファイル検出**: リモートサーバーに存在しないファイルの識別
- ⚙️ **柔軟な設定**: CLIオプション、環境変数、.envファイルをサポート
- 🎨 **カラー出力**: ファイルの状態を色分けして見やすく表示

## インストール

```bash
# 依存関係をインストール
yarn install

# パッケージをビルド
yarn build
```

## 使用方法

### 基本的な使い方

```bash
# .envファイルの設定を使用
remote-inspector

# CLIオプションを使用
remote-inspector --host example.com --user deploy --key /path/to/key.pem --remote-dir /var/www/html

# 短縮エイリアスを使用
remote-inspector -h example.com -u deploy -k /path/to/key.pem -r /var/www/html
```

### 設定

設定はCLIオプション、環境変数、.envファイルで指定できます。
**優先順位**: CLIオプション → 環境変数 → .envファイル

#### CLIオプション

| オプション     | エイリアス | 説明                   | デフォルト  |
| -------------- | ---------- | ---------------------- | ----------- |
| `--host`       | `-h`       | リモートホスト         | -           |
| `--user`       | `-u`       | リモートユーザー名     | -           |
| `--key`        | `-k`       | 秘密鍵ファイルのパス   | -           |
| `--passphrase` | `-p`       | 秘密鍵のパスフレーズ   | -           |
| `--remote-dir` | `-r`       | リモートディレクトリ   | -           |
| `--local-dir`  | `-l`       | ローカルディレクトリ   | `.`         |
| `--listfile`   | `-f`       | ファイルリスト         | `files.txt` |
| `--debug`      | `-d`       | デバッグモードを有効化 | `false`     |
| `--verbose`    | `-v`       | 詳細出力を有効化       | `false`     |

#### 環境変数 / .envファイル

プロジェクトルートに`.env`ファイルを作成:

```env
RELEASE_HOST=example.com
RELEASE_USER=deploy
RELEASE_KEY=/path/to/private/key.pem
RELEASE_PASS_PHRASE=必要に応じてパスフレーズ
RELEASE_DIR=/var/www/html
```

### ファイルリストの形式

比較したいファイルを列挙した`files.txt`ファイルを作成:

```
htdocs/css/style.css
htdocs/index.html
htdocs/images/logo.png
htdocs/js/app.js
```

## 出力

ツールはファイルの状態を素早く識別できるよう、色分けされた出力を提供します:

- 🟢 **緑**: テキストファイルと新規ファイル
- 🟣 **マゼンタ**: バイナリファイル
- 🔴 **赤**: 差分の削除行
- 🟢 **緑**: 差分の追加行
- ⚫ **黒/グレー**: 変更されていないコンテキスト行

### ファイルステータス表示

- `Same`: ファイルが同一
- `Modified`: ファイルに差分あり
- `New file`: ローカルに存在するがリモートに存在しない
- `Local file is not found`: リストにあるがローカルに存在しない

## 使用例

### 例1: 基本セットアップ

```bash
# 1. files.txtを作成
echo "htdocs/index.html
htdocs/css/style.css" > files.txt

# 2. .envを作成
echo "RELEASE_HOST=your-server.com
RELEASE_USER=deploy
RELEASE_KEY=~/.ssh/id_rsa
RELEASE_DIR=/var/www/html" > .env

# 3. 比較実行
remote-inspector
```

### 例2: 特定の設定をオーバーライド

```bash
# .envの設定を使用しつつ、ホストのみ変更
remote-inspector --host staging-server.com
```

### 例3: 異なるファイルリストを使用

```bash
# 別のファイルリストを使用
remote-inspector --listfile production-files.txt
```

## 開発

### ビルド

```bash
yarn build
```

### ウォッチモード

```bash
yarn watch
```

### クリーン

```bash
yarn clean
```

## 要件

- リモートサーバーへのSSHアクセス
- 認証用の秘密鍵ファイル

## ライセンス

MIT
