# @d-zero/remote-inspector

SSH/SFTP経由でローカルファイルとリモートファイルを比較し、デプロイ前の差分確認を行うツールです。実際にデプロイすることなく、ローカルファイルとリモートサーバーファイルの違いを検査できます。

## 機能

- 🔍 **ファイル比較**: SSH/SFTP経由でローカルファイルとリモートファイルを比較
- 🔐 **柔軟な認証**: 秘密鍵認証またはパスワード認証をサポート
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

# 秘密鍵認証を使用
remote-inspector --host example.com --user deploy --key /path/to/key.pem --remote-dir /var/www/html

# パスワード認証を使用
remote-inspector --host example.com --user deploy --password your_password --remote-dir /var/www/html

# 短縮エイリアスを使用
remote-inspector -h example.com -u deploy -k /path/to/key.pem -r /var/www/html
remote-inspector -h example.com -u deploy -w your_password -r /var/www/html
```

### 設定

設定はCLIオプション、環境変数、.envファイルで指定できます。
**優先順位**: CLIオプション → 環境変数 → .envファイル

#### 認証方式

このツールは2つの認証方式をサポートしています：

1. **秘密鍵認証** (推奨):
   - `--key` オプションで秘密鍵ファイルを指定
   - 必要に応じて `--passphrase` でパスフレーズを指定

2. **パスワード認証**:
   - `--password` オプションでパスワードを指定
   - セキュリティ上の理由により、可能な限り秘密鍵認証を使用することを推奨

**注意**: 秘密鍵認証とパスワード認証を同時に指定することはできません。

#### CLIオプション

| オプション     | エイリアス | 説明                       | デフォルト  |
| -------------- | ---------- | -------------------------- | ----------- |
| `--version`    | -          | バージョンを表示           | -           |
| `--host`       | `-h`       | リモートホスト             | -           |
| `--user`       | `-u`       | リモートユーザー名         | -           |
| `--key`        | `-k`       | 秘密鍵ファイルのパス       | -           |
| `--passphrase` | `-p`       | 秘密鍵のパスフレーズ       | -           |
| `--password`   | `-w`       | SSH認証用パスワード        | -           |
| `--remote-dir` | `-r`       | リモートディレクトリ       | -           |
| `--local-dir`  | `-l`       | ローカルディレクトリ       | `.`         |
| `--listfile`   | `-f`       | ファイルリスト             | `files.txt` |
| `--root`       | `-o`       | ファイルリストのルートパス | -           |
| `--debug`      | `-d`       | デバッグモードを有効化     | `false`     |
| `--verbose`    | `-v`       | 詳細出力を有効化           | `false`     |

#### 環境変数 / .envファイル

**秘密鍵認証の場合:**

```env
RELEASE_HOST=example.com
RELEASE_USER=deploy
RELEASE_KEY=/path/to/private/key.pem
RELEASE_PASS_PHRASE=必要に応じてパスフレーズ
RELEASE_DIR=/var/www/html
```

**パスワード認証の場合:**

```env
RELEASE_HOST=example.com
RELEASE_USER=deploy
RELEASE_PASSWORD=your_password
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

### --root オプションについて

`--root` オプションは、ファイルリスト内のパスとリモートサーバー上のパスの整合性を保つために使用します。

例えば、ローカルでは `htdocs` がドキュメントルートだが、ファイルリストに `htdocs/index.html` のように記載されている場合：

```bash
# htdocs プレフィックスを除去してリモートパスを計算
remote-inspector --root htdocs --remote-dir /var/www/html
```

この場合、`htdocs/index.html` は `/var/www/html/index.html` として比較されます。

**設定例:**

- ファイルリスト: `htdocs/css/style.css`
- `--root htdocs` 指定
- `--remote-dir /var/www/html` 指定
- → リモートパス: `/var/www/html/css/style.css`

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
- `Local file is not found`: リストにあるがローカルに存在しない（リモートファイルの存在状況も併せて表示）

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

### 例3: パスワード認証を使用

```bash
# パスワード認証でサーバーに接続
remote-inspector --host example.com --user deploy --password your_password --remote-dir /var/www/html

# .envファイルでパスワード認証を設定
echo "RELEASE_HOST=example.com
RELEASE_USER=deploy
RELEASE_PASSWORD=your_password
RELEASE_DIR=/var/www/html" > .env

remote-inspector
```

### 例4: 異なるファイルリストを使用

```bash
# 別のファイルリストを使用
remote-inspector --listfile production-files.txt
```

### 例5: ルートプレフィックスを指定

```bash
# ファイルリストのhtdocsプレフィックスを除去
remote-inspector --root htdocs

# .envの設定を使用しつつ、ルートプレフィックスのみ変更
remote-inspector --root public
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
- 以下のいずれかの認証方法:
  - SSH秘密鍵ファイル（推奨）
  - SSHパスワード認証

## API

このパッケージはCLIツールとしてだけでなく、プログラムからも使用できます。

### `remoteInspector(options)`

リモートファイルとローカルファイルを比較します。

```typescript
import { remoteInspector } from '@d-zero/remote-inspector';
import type {
	RemoteInspectorOptions,
	ConnectionConfig,
	FileComparison,
} from '@d-zero/remote-inspector';

await remoteInspector({
	host: 'example.com',
	user: 'deploy',
	keyPath: '/path/to/key.pem',
	remoteDir: '/var/www/html',
	localDir: './htdocs',
	listfile: 'files.txt',
});
```

### 型定義

#### `RemoteInspectorOptions`

```typescript
interface RemoteInspectorOptions {
	host?: string; // リモートホスト
	user?: string; // リモートユーザー名
	keyPath?: string; // 秘密鍵ファイルのパス
	passphrase?: string; // 秘密鍵のパスフレーズ
	password?: string; // SSH認証用パスワード
	remoteDir?: string; // リモートディレクトリ
	localDir?: string; // ローカルディレクトリ
	listfile?: string; // ファイルリスト
	root?: string; // ファイルリストのルートパス
}
```

#### `ConnectionConfig`

```typescript
interface ConnectionConfig {
	host: string; // リモートホスト
	username: string; // ユーザー名
	privateKey?: Buffer; // 秘密鍵
	passphrase?: string; // パスフレーズ
	password?: string; // パスワード
}
```

#### `FileComparison`

```typescript
interface FileComparison {
	localPath: string; // ローカルファイルパス
	remotePath: string; // リモートファイルパス
	relativePath: string; // 相対パス
	isTextFile: boolean; // テキストファイルかどうか
	status: 'same' | 'modified' | 'new' | 'missing'; // 比較ステータス
	localSize?: number; // ローカルファイルサイズ
	remoteSize?: number; // リモートファイルサイズ
	diff?: string; // 差分テキスト
	remoteExists?: boolean; // リモートに存在するか
}
```

## ライセンス

MIT
