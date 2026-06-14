# `@d-zero/remote-inspector`

SSH/SFTP 経由でローカルとリモートのファイルを比較し、デプロイ前に差分を確認する CLI。

## Installation

```sh
yarn add @d-zero/remote-inspector
```

## Usage

```sh
# 秘密鍵認証（推奨）
remote-inspector --host example.com --user deploy --key ~/.ssh/id_rsa --remote-dir /var/www/html

# .env を使う場合
remote-inspector
```

オプションは `--help` を参照。設定の優先順位は CLI、環境変数、`.env` の順。

**認証**: 秘密鍵認証とパスワード認証は併用不可。

**`--root`**: ファイルリストのパスからプレフィックスを除いてリモートパスを計算する。詳細は `src/remote-inspector.ts` の `compareFile` JSDoc を参照。

### ファイルリスト形式

```txt
htdocs/css/style.css
htdocs/index.html
```

### `.env` 例

```env
RELEASE_HOST=example.com
RELEASE_USER=deploy
RELEASE_KEY=/path/to/key.pem
RELEASE_PASS_PHRASE=
RELEASE_DIR=/var/www/html
```
