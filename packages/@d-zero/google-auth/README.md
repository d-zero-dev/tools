# `@d-zero/google-auth`

Google API 用 `OAuth2Client` を生成する汎用ライブラリ。複数の認証方式を優先順位付きで解決する（詳細は `src/authentication.ts` の JSDoc）。

## Installation

```sh
yarn add @d-zero/google-auth
```

## Usage

```ts
import { authentication } from '@d-zero/google-auth';

const auth = await authentication('./credential.json', [
	'https://www.googleapis.com/auth/spreadsheets',
]);
```

## セットアップ方法

利用環境に応じて選ぶ。コード側は同じ `authentication(...)` で動く。

### 方法 1: gcloud CLI（最も簡単）

```sh
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/spreadsheets
```

```ts
const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);
```

### 方法 2: OAuth2 Desktop（ローカル開発）

Google Cloud Console の **APIとサービス** から **OAuth 2.0 クライアント ID**（アプリ種別: **デスクトップ**）を発行して JSON を保存。

```ts
const auth = await authentication('./credential.json', [
	'https://www.googleapis.com/auth/spreadsheets',
]);
```

初回はブラウザ認証が要求される（5 分以内に完了）。

### 方法 3: サービスアカウント（CI/CD）

```sh
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

```ts
// ADC で自動検出
const auth = await authentication(null, ['https://www.googleapis.com/auth/spreadsheets']);
```
