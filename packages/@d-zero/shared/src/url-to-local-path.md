# url-to-local-path

URLをローカルファイルパスに変換するユーティリティ関数。URLのパス名から、適切な拡張子を付加したローカルファイルパスを生成します。ディレクトリパスの場合は自動的に`index`ファイルとして扱われます。

## 関数

### `urlToLocalPath(url, extension)`

URLをローカルファイルパスに変換します。

**パラメータ:**

- `url: string` - 変換するURL文字列
- `extension: string` - 追加するファイル拡張子（先頭にドットを含む、例: `.html`）

**戻り値:**

- `string` - ローカルファイルパス（先頭のスラッシュなし）

**例:**

```typescript
import { urlToLocalPath } from '@d-zero/shared/url-to-local-path';

// ルートパスの場合
urlToLocalPath('https://example.com/', '.html'); // 'index.html'

// ディレクトリパスの場合
urlToLocalPath('https://example.com/path/', '.html'); // 'path/index.html'

// ファイルパス（拡張子なし）の場合
urlToLocalPath('https://example.com/file', '.html'); // 'file.html'

// 既に拡張子がある場合
urlToLocalPath('https://example.com/file.js', ''); // 'file.js'
urlToLocalPath('https://example.com/file.js', '.html'); // 'file.js'（拡張子は上書きされない）

// ネストされたパスの場合
urlToLocalPath('https://example.com/path/to/resource', '.json'); // 'path/to/resource.json'
```

## 動作仕様

### パス名の正規化

- 空のパス名は`/`として扱われます
- 先頭のスラッシュは自動的に削除されます

### ディレクトリパスの処理

パスが空文字列または末尾が`/`で終わる場合、`index`ファイルとして扱われます：

```typescript
urlToLocalPath('https://example.com/', '.html'); // 'index.html'
urlToLocalPath('https://example.com/path/', '.html'); // 'path/index.html'
```

### 拡張子の追加

- 最後のセグメント（最後の`/`以降）に拡張子（`.`を含む）がない場合、指定された拡張子が追加されます
- 既に拡張子がある場合、そのまま保持され、指定された拡張子は無視されます

```typescript
// 拡張子なし → 追加される
urlToLocalPath('https://example.com/page', '.html'); // 'page.html'

// 拡張子あり → そのまま
urlToLocalPath('https://example.com/style.css', '.html'); // 'style.css'
```

## 注意事項

- URLのクエリパラメータやハッシュフラグメントは無視されます（パス名のみが使用されます）
- パス名のみが使用されるため、異なるクエリパラメータを持つ同じパス名のURLは同じローカルパスにマッピングされます
- 拡張子の検出は最後のセグメントに`.`が含まれているかどうかで判断されます（例: `file.min.js`は拡張子ありとして扱われます）

## 関連モジュール

- [encode-resource-path](./encode-resource-path.md) - リソースパスのエンコード/デコード機能
