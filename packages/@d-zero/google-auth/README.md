# `@d-zero/google-auth`

Google APIの認証のための汎用ライブラリです。各Google APIで必要な[`OAuth2Client`](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest/google-auth-library/oauth2client)オブジェクトを生成します。

## CLI版

CLIで利用する関数の使用方法と、クレデンシャルファイルの準備、認証方法を解説します。

使用にあたって、Google Cloud Consoleの[APIとサービス](https://console.cloud.google.com/apis/credentials)から**OAuth 2.0 クライアント ID**を（アプリケーションの種類は**デスクトップ**とする）発行し、JSON形式のクレデンシャルファイルをローカルにダウンロードする必要があります。

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
	 * `null`または`undefined`の場合、環境変数`GOOGLE_AUTH_CREDENTIALS`を使用します。
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
	 *
	 * @type {AuthenticationOptions}
	 */
	{
		tokenFilePath: './path/to/token.json', // カスタムトークンファイルパス
		checkTokenExpiry: true, // トークンの有効期限をチェック
	},
);
```

環境変数を利用する場合は、第1引数に`null`を渡します：

```ts
const auth: Auth = await authentication(null, [
	'https://www.googleapis.com/auth/spreadsheets',
]);
```

クレデンシャルファイルの解決順序は以下の通りです：

1. 第1引数で渡されたパス
2. 環境変数`GOOGLE_AUTH_CREDENTIALS`
3. いずれも未設定の場合はエラー

### 認証方法

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
