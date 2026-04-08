# mime-to-extension

MIMEタイプをファイル拡張子に変換するユーティリティ関数。HTTPレスポンスのContent-Typeヘッダーから、適切なファイル拡張子を取得できます。charsetなどのパラメータが含まれていても正しく処理されます。

## 関数

### `mimeToExtension(mimeType)`

MIMEタイプをファイル拡張子に変換します。

**パラメータ:**

- `mimeType?: string` - MIMEタイプ文字列（charsetやその他のパラメータを含む場合もある）

**戻り値:**

- `string` - ファイル拡張子（先頭にドットを含む、例: `.html`）、未知のMIMEタイプの場合は空文字列

**例:**

```typescript
import { mimeToExtension } from '@d-zero/shared/mime-to-extension';

// 基本的な使用
mimeToExtension('text/html'); // '.html'
mimeToExtension('text/css'); // '.css'
mimeToExtension('application/javascript'); // '.js'

// charsetパラメータ付き
mimeToExtension('text/html; charset=utf-8'); // '.html'
mimeToExtension('text/css; charset=UTF-8'); // '.css'

// 未知のMIMEタイプ
mimeToExtension('unknown/type'); // ''
mimeToExtension('application/x-custom'); // ''

// undefinedや空文字列の場合
mimeToExtension(undefined); // ''
mimeToExtension(''); // ''
```

## サポートされているMIMEタイプ

以下のMIMEタイプがサポートされています：

### テキスト

- `text/html` → `.html`
- `text/css` → `.css`
- `application/javascript` → `.js`
- `text/javascript` → `.js`
- `application/json` → `.json`
- `application/xml` → `.xml`
- `text/xml` → `.xml`

### 画像

- `image/jpeg` → `.jpg`
- `image/png` → `.png`
- `image/svg+xml` → `.svg`
- `image/webp` → `.webp`
- `image/gif` → `.gif`
- `image/x-icon` → `.ico`

### フォント

- `font/woff` → `.woff`
- `application/font-woff` → `.woff`
- `font/woff2` → `.woff2`
- `font/ttf` → `.ttf`
- `application/x-font-ttf` → `.ttf`
- `font/otf` → `.otf`
- `application/x-font-otf` → `.otf`

## 動作仕様

### パラメータの除去

MIMEタイプ文字列にcharsetなどのパラメータが含まれている場合、セミコロン（`;`）で分割して、最初の部分のみが使用されます：

```typescript
mimeToExtension('text/html; charset=utf-8'); // '.html'
mimeToExtension('application/json; charset=UTF-8'); // '.json'
```

### 大文字小文字の扱い

MIMEタイプは自動的に小文字に変換されてからマッピングされます：

```typescript
mimeToExtension('TEXT/HTML'); // '.html'
mimeToExtension('Application/JSON'); // '.json'
```

### 未定義値の処理

- `undefined`や空文字列が渡された場合、空文字列を返します
- パラメータ除去後に空文字列になった場合も、空文字列を返します

## 注意事項

- 未知のMIMEタイプの場合は空文字列が返されます
- カスタムMIMEタイプや非標準のMIMEタイプはマッピングされません
- MIMEタイプのマッピングは大文字小文字を区別しませんが、スラッシュ以降の部分（サブタイプ）も含めて完全一致で判定されます

## 関連モジュール

- [encode-resource-path](./encode-resource-path.md) - リソースパスのエンコード/デコード機能（この関数を使用）
