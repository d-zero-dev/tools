# encode-resource-path

リソースパスをエンコード/デコードするユーティリティ関数群。拡張子がないURLパスにMIMEタイプ情報をエンコードし、後でデコードしてローカルファイルパスを生成できます。Webクローラーやサイトレプリケーターなどで、拡張子のないURLを適切なファイル名に変換する際に使用します。

**重要**: このモジュールは**特殊なエンコード形式**（`pathname:::MIME/type`）を使用します。単純にURLをローカルパスに変換したい場合は、[url-to-local-path](./url-to-local-path.md)を直接使用することを推奨します。`encodeResourcePath`は、MIMEタイプ情報を保存して後で使用する必要がある場合（例: 2フェーズのクローリング処理）にのみ使用してください。

## 関数

### `encodeResourcePath(urlOrStringOrExUrl, mimeType?, separator?)`

リソースパスをMIMEタイプと共にエンコードします。拡張子がないパスの場合のみ、MIMEタイプがエンコードされます。

**パラメータ:**

- `urlOrStringOrExUrl: URL | string | ExURL` - URLオブジェクト、URL文字列、またはExURLオブジェクト
- `mimeType?: string` - MIMEタイプ（オプション）
- `separator?: string` - パス名とMIMEタイプの間の区切り文字（デフォルト: `':::'`）

**戻り値:**

- `string` - エンコードされたリソースパス（拡張子がある場合はそのまま、ない場合は`pathname:::MIME/type`形式）

**例:**

```typescript
import { encodeResourcePath } from '@d-zero/shared/encode-resource-path';

// URLオブジェクトを使用
const url = new URL('https://example.com/page');
encodeResourcePath(url, 'text/html'); // '/page:::text/html'

// URL文字列を使用
encodeResourcePath('https://example.com/api', 'application/json'); // '/api:::application/json'

// 拡張子がある場合はエンコードされない
encodeResourcePath('https://example.com/style.css', 'text/css'); // '/style.css'

// MIMEタイプがない場合
encodeResourcePath('https://example.com/page'); // '/page'

// カスタムセパレーター
encodeResourcePath('https://example.com/page', 'text/html', '|'); // '/page|text/html'

// ルートパス
encodeResourcePath('https://example.com/', 'text/html'); // '/:::text/html'
```

### `decodeResourcePath(encodedPath, separator?)`

エンコードされたリソースパスをデコードして、パス名とMIMEタイプを取得します。

**パラメータ:**

- `encodedPath: string` - エンコードされたリソースパス（例: `"/page:::text/html"`または`"/style.css"`）
- `separator?: string` - パス名とMIMEタイプの間の区切り文字（デフォルト: `':::'`）

**戻り値:**

- `{ pathname: string; mimeType: string | null }` - パス名とMIMEタイプ（エンコードされていない場合は`mimeType`は`null`）

**例:**

```typescript
import { decodeResourcePath } from '@d-zero/shared/encode-resource-path';

// エンコードされたパス
decodeResourcePath('/page:::text/html'); // { pathname: '/page', mimeType: 'text/html' }

// エンコードされていないパス
decodeResourcePath('/style.css'); // { pathname: '/style.css', mimeType: null }

// カスタムセパレーター
decodeResourcePath('/page|text/html', '|'); // { pathname: '/page', mimeType: 'text/html' }

// パス名にセパレーターが含まれる場合（最後のセパレーターが使用される）
decodeResourcePath('/path:::with:::separator:::text/html');
// { pathname: '/path:::with:::separator', mimeType: 'text/html' }

// ルートパス
decodeResourcePath('/:::text/html'); // { pathname: '/', mimeType: 'text/html' }
```

### `parseEncodedPath(encodedPath, baseUrl, separator?)`

エンコードされたパス名を解析して、実際のURLとローカルファイルパスを取得します。

**パラメータ:**

- `encodedPath: string` - エンコードされたパス名（`"pathname"`または`"pathname:::MIME/type"`形式）
- `baseUrl: string` - パス名から完全なURLを構築するためのベースURL
- `separator?: string` - パス名とMIMEタイプの間の区切り文字（デフォルト: `':::'`）

**戻り値:**

- `{ url: string; localPath: string }` - 完全なURLとローカルファイルパス

**例:**

```typescript
import { parseEncodedPath } from '@d-zero/shared/encode-resource-path';

const baseUrl = 'https://example.com/';

// エンコードされたパス（MIMEタイプあり）
const result1 = parseEncodedPath('/page:::text/html', baseUrl);
// { url: 'https://example.com/page', localPath: 'page.html' }

// エンコードされていないパス（拡張子あり）
const result2 = parseEncodedPath('/style.css', baseUrl);
// { url: 'https://example.com/style.css', localPath: 'style.css' }

// ルートパス
const result3 = parseEncodedPath('/:::text/html', baseUrl);
// { url: 'https://example.com/', localPath: 'index.html' }

// ネストされたパス
const result4 = parseEncodedPath('/api/data:::application/json', baseUrl);
// { url: 'https://example.com/api/data', localPath: 'api/data.json' }
```

## エンコードの仕様

### エンコードされる条件

`encodeResourcePath`は、以下の条件を**すべて**満たす場合のみMIMEタイプをエンコードします：

1. 最後のセグメント（最後の`/`以降）に拡張子（`.`を含む）がない
2. MIMEタイプが指定されている

```typescript
// エンコードされる（拡張子なし）
encodeResourcePath('https://example.com/page', 'text/html'); // '/page:::text/html'

// エンコードされない（拡張子あり）
encodeResourcePath('https://example.com/page.html', 'text/html'); // '/page.html'

// エンコードされない（MIMEタイプなし）
encodeResourcePath('https://example.com/page'); // '/page'
```

### 空のパス名の処理

空のパス名は`/`として正規化されます：

```typescript
encodeResourcePath('https://example.com', 'text/html'); // '/:::text/html'
```

### セパレーターの動作

- デフォルトのセパレーターは`':::'`です
- カスタムセパレーターを指定できますが、パス名にセパレーターが含まれる可能性がある場合は注意が必要です
- `decodeResourcePath`は最後のセパレーター出現位置で分割するため、パス名にセパレーターが含まれていても正しく動作します

## デコードの仕様

### エンコード状態の判定

`decodeResourcePath`は以下の場合、エンコードされていないものとして扱います：

- セパレーターが見つからない場合
- セパレーターが空文字列の場合
- セパレーターで分割した後のMIMEタイプが空文字列の場合

### パス名内のセパレーター

パス名にセパレーターが含まれている場合、**最後のセパレーター**で分割されます：

```typescript
decodeResourcePath('/path:::with:::separator:::text/html');
// { pathname: '/path:::with:::separator', mimeType: 'text/html' }
```

## parseEncodedPathの動作

`parseEncodedPath`は以下の処理を行います：

1. `decodeResourcePath`でパス名とMIMEタイプを取得
2. `baseUrl`とパス名から完全なURLを構築
3. MIMEタイプがある場合、[mime-to-extension](./mime-to-extension.md)で拡張子を取得
4. [url-to-local-path](./url-to-local-path.md)でローカルファイルパスを生成

### 透過性（Equivalence）

テストで確認されている通り、以下の2つの方法は**完全に等価**です：

```typescript
import {
	encodeResourcePath,
	parseEncodedPath,
} from '@d-zero/shared/encode-resource-path';
import { urlToLocalPath } from '@d-zero/shared/url-to-local-path';

const url = new URL('https://example.com/page');
const baseUrl = 'https://example.com/';

// 方法1: encodeResourcePath経由（エンコード形式を使用）
const encoded = encodeResourcePath(url, 'text/html');
const { localPath } = parseEncodedPath(encoded, baseUrl);

// 方法2: urlToLocalPath直接（素直な変換）
const localPath = urlToLocalPath(url.href, '.html');

// 結果は同じ: 'page.html'
```

この透過性により、MIMEタイプが既に分かっている場合は、エンコード/デコードを経由せずに`urlToLocalPath`を直接使用できます。

## 型定義

### ExURL

拡張されたURLオブジェクトを表す型。`parseUrl`関数が返す型です。

```typescript
export type ExURL = {
	pathname?: string;
	// ... その他のプロパティ
};
```

## 使用例

### いつencodeResourcePathを使うべきか

`encodeResourcePath`は以下のような**特殊なユースケース**で使用します：

- **2フェーズのクローリング処理**: Phase 1でリソースURLとMIMEタイプを収集し、Phase 2でダウンロードする場合
- **メタデータの永続化**: URLとMIMEタイプを一緒に保存し、後で使用する場合

単純にURLをローカルパスに変換するだけであれば、**[url-to-local-path](./url-to-local-path.md)を直接使用してください**。

### Webクローラーでの使用（2フェーズ処理）

```typescript
import {
	encodeResourcePath,
	parseEncodedPath,
} from '@d-zero/shared/encode-resource-path';

// Phase 1: リソース収集時にエンコード（MIMEタイプ情報を保存）
const pageUrl = new URL('https://example.com/page');
const encoded = encodeResourcePath(pageUrl, 'text/html'); // '/page:::text/html'
// encoded を保存（メタデータとして）

// Phase 2: ダウンロード時にデコード
const baseUrl = 'https://example.com/';
const { url, localPath } = parseEncodedPath(encoded, baseUrl);
// url: 'https://example.com/page'
// localPath: 'page.html'
```

### シンプルな変換（推奨）

MIMEタイプが既に分かっている場合は、エンコード/デコードを経由せず、直接変換します：

```typescript
import { urlToLocalPath } from '@d-zero/shared/url-to-local-path';
import { mimeToExtension } from '@d-zero/shared/mime-to-extension';

const url = 'https://example.com/page';
const mimeType = 'text/html';
const extension = mimeToExtension(mimeType); // '.html'
const localPath = urlToLocalPath(url, extension); // 'page.html'
```

この方法は、エンコード形式を使わないため、より**素直で理解しやすい**コードになります。

### カスタムセパレーターの使用

```typescript
// セパレーターを変更したい場合
const encoded = encodeResourcePath(url, 'text/html', '|'); // '/page|text/html'
const decoded = decodeResourcePath(encoded, '|'); // { pathname: '/page', mimeType: 'text/html' }
```

## 注意事項

### エンコード形式について

- `encodeResourcePath`は特殊なエンコード形式（`pathname:::MIME/type`）を使用します
- この形式は、MIMEタイプ情報を保存する必要がある場合にのみ使用してください
- 単純なURL→ローカルパス変換は、[url-to-local-path](./url-to-local-path.md)を直接使用することを推奨します

### セパレーターの動作

- パス名にセパレーター文字列が含まれている場合、最後のセパレーターで分割されます
- 空のセパレーターが指定された場合、常にエンコードされていないものとして扱われます

### データの損失

- `parseEncodedPath`で生成されるURLは、元のURLのクエリパラメータやハッシュフラグメントが失われます（パス名のみが使用されるため）
- `encodeResourcePath`はパス名のみを抽出するため、元のURLの完全な情報は保持されません

## 関連モジュール

- [url-to-local-path](./url-to-local-path.md) - URLをローカルファイルパスに変換
- [mime-to-extension](./mime-to-extension.md) - MIMEタイプを拡張子に変換
- [parse-url](./parse-url.md) - URLの解析（ExURL型の生成）
