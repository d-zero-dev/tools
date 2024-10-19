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

const auth: OAuth2Client = await authentication(
	/**
	 * クレデンシャルファイル
	 *
	 * @type {string}
	 */
	'./path/to/credential.json',

	/**
	 * スコープ
	 *
	 * @type {string[]}
	 * @see https://developers.google.com/identity/protocols/oauth2/scopes?hl=ja
	 */
	['https://www.googleapis.com/auth/spreadsheets'],
);
```

### 認証方法

**:warning: 実行時にローカルにトークンがない場合、対話形式で認証が要求されます。**

```terminal
🔑 [ Authorization (Google Sheets, Google Drive) ]

🔰 Access this URL: https://accounts.google.com/o/oauth2/v2/..(略)..&redirect_uri=http%3A%2F%2Flocalhost

Enter the URL from the redirected page here: |
```

URLにアクセスしブラウザで認証をしたあとに、 http://localhost （**OAuth 2.0 クライアント ID**を発行の方法に依る）に移動します。
サーバーの応答がなかったりページが表示されませんが、**移動した先のURLをそのままコピーして**、コマンドに貼り付けてエンターキーを押してください。
