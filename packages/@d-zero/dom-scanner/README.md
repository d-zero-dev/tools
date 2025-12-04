# `@d-zero/dom-scanner`

指定ディレクトリ内のHTMLファイルとPugファイルから特定のCSSセレクタにマッチする要素を検索して報告するCLIツールです。

## 使い方

### 基本的な使い方

```sh
npx @d-zero/dom-scanner <selector> [options]
```

**引数**

- `selector` - CSSセレクタ（必須）

**オプション**

- `-d, --dir, --directory <directory>` - 検索対象のディレクトリパス（デフォルト: 現在のディレクトリ）
- `--ext, --extension <extensions>` - 検索対象の拡張子（カンマ区切り、デフォルト: `html`）
  - 例: `--ext html,pug` でHTMLとPugファイルの両方を検索
- `-p, --processor <processor>` - 使用するプロセッサーを明示的に指定（`html` または `pug`）
  - 例: `--processor pug` で全てのファイルをPugプロセッサーで処理
  - 拡張子ごとのデフォルトプロセッサー: `html` → `html`, `pug` → `pug`
- `-x, --exclude-dirs <dirs>` - 除外するディレクトリ名（カンマ区切り）
  - 例: `--exclude-dirs node_modules,dist` で特定のディレクトリを除外
- `--verbose` - 詳細なログを表示
- `--ignore <pattern>` - 無視するファイルパターン（複数指定可能）

### 使用例

```sh
# 現在のディレクトリでHTMLファイルのみを検索（デフォルト）
npx @d-zero/dom-scanner "button"

# 指定ディレクトリで検索
npx @d-zero/dom-scanner "button" --dir ./src

# HTMLとPugファイルの両方を検索
npx @d-zero/dom-scanner "button" --dir ./src --ext html,pug

# HTMLファイルをPugプロセッサーで処理（極端な例）
npx @d-zero/dom-scanner "button" --dir ./src --ext html --processor pug

# 除外ディレクトリをカスタマイズ
npx @d-zero/dom-scanner "button" --exclude-dirs node_modules,dist
```

## API

このパッケージはAPIとしても使用できます。

### 基本的な使い方

```typescript
import { scanDirectory } from '@d-zero/dom-scanner';

const results = await scanDirectory('./src', 'button', {
	extensions: ['html', 'pug'],
});

for (const result of results) {
	console.log(`${result.filePath}: ${result.count}件`);
}
```

## 動作環境

- Node.js 20.11以降
