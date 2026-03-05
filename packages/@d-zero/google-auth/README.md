# `@d-zero/google-auth`

Google APIの認証のための汎用ライブラリです。各Google APIで必要な[`OAuth2Client`](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/oauth2client)オブジェクトを生成します。

複数の認証方式をサポートしており、以下の優先順位で認証を試みます：

1. 引数で渡されたクレデンシャルファイルパス
2. 環境変数 `GOOGLE_AUTH_CREDENTIALS` で指定されたファイル
3. **ADC（Application Default Credentials）** — `GOOGLE_APPLICATION_CREDENTIALS` 環境変数、`gcloud auth application-default login`、GCEメタデータなど
4. すべて未設定の場合はセットアップガイダンス付きエラー

## セットアップ方法

### 方法1: gcloud CLI（最も簡単）

Google Cloud SDKの`gcloud`コマンドでログインするだけで使えます。クレデンシャルファイルの管理が不要です。

```shell
# インストール: https://cloud.google.com/sdk/docs/install
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets
```

コード側ではクレデンシャルファイルの指定が不要です：

```ts
const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);
```

### 方法2: Google Workspace CLI (gws)

[Google Workspace CLI (`gws`)](https://github.com/googleworkspace/cli)を使うと、Google Cloudプロジェクトの作成からAPI有効化までを自動化できます。

```shell
# インストール
go install github.com/googleworkspace/cli/cmd/gws@latest

# プロジェクトセットアップ
gws auth setup
```

### 方法3: OAuth2 Desktop（従来の方法）

Google Cloud Consoleの[APIとサービス](https://console.cloud.google.com/apis/credentials)から**OAuth 2.0 クライアント ID**を（アプリケーションの種類は**デスクトップ**とする）発行し、JSON形式のクレデンシャルファイルをローカルにダウンロードします。

```ts
const auth = await authentication('./path/to/credential.json', [
	'https://www.googleapis.com/auth/spreadsheets',
]);
```

**:warning: 実行時にローカルにトークンがない場合、ブラウザでの認証が要求されます。**

```terminal
🔑 [ Authorization (Google Sheets) ]

🔰 Opening browser for authentication...
   If the browser does not open automatically, visit:
   https://accounts.google.com/o/oauth2/v2/..(略)..&redirect_uri=http%3A%2F%2Flocalhost%3A12345
```

ローカルに一時的なHTTPサーバーが起動し、ブラウザが自動的に開きます。Googleの認証画面で許可すると、ブラウザに「認証に成功しました」と表示され、ターミナルに自動で戻ります。

- ブラウザが自動で開かない場合は、表示されたURLに手動でアクセスしてください
- 5分以内に認証を完了しない場合はタイムアウトします

### 方法4: サービスアカウント（CI/CD向け）

サービスアカウントキーのJSONファイルを指定するだけで認証できます。CI/CD環境やブラウザ認証が使えない環境に適しています。

```ts
const auth = await authentication('./service-account-key.json', [
	'https://www.googleapis.com/auth/spreadsheets',
]);
```

環境変数でも指定可能です：

```shell
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

```ts
// GOOGLE_APPLICATION_CREDENTIALS が設定されていれば、ADCで自動検出される
const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);
```

## CLI版

```shell
yarn add -D @d-zero/google-auth
```

クレデンシャルファイルと[スコープ](https://developers.google.com/identity/protocols/oauth2/scopes?hl=ja)を設定します。

```ts
import { authentication } from '@d-zero/google-auth';

const auth: Auth = await authentication(
	/**
	 * クレデンシャルファイル
	 *
	 * `null`または`undefined`の場合、環境変数`GOOGLE_AUTH_CREDENTIALS`を確認し、
	 * それもなければADC（Application Default Credentials）にフォールバックします。
	 *
	 * @type {string | undefined | null}
	 */
	'./path/to/credential.json',

	/**
	 * スコープ
	 *
	 * @type {string[]}
	 * @see https://developers.google.com/identity/protocols/oauth2/scopes?hl=ja
	 */
	['https://www.googleapis.com/auth/spreadsheets'],

	/**
	 * オプション（省略可）
	 * OAuth2 Desktopフローでのみ使用されます。
	 *
	 * @type {AuthenticationOptions}
	 */
	{
		tokenFilePath: './path/to/token.json', // カスタムトークンファイルパス
		checkTokenExpiry: true, // トークンの有効期限をチェック
	},
);
```

## 型のエクスポート

### `Auth`

`google-auth-library`の`OAuth2Client`型のエイリアスです。

```ts
import type { Auth } from '@d-zero/google-auth';
```

### `AuthenticationOptions`

`authentication`関数の第3引数に渡すオプションの型です。

```ts
type AuthenticationOptions = {
	readonly tokenFilePath?: string; // トークンファイルの保存先パス（デフォルト: クレデンシャルファイルと同じディレクトリに`.token`拡張子で保存）
	readonly checkTokenExpiry?: boolean; // トークンの有効期限をチェックするかどうか（デフォルト: false）
};
```
