# `@d-zero/replicator`

ウェブページとそのリソースをレスポンシブ画像対応でローカルディレクトリに複製するツールです。

## インストール

```bash
npm install @d-zero/replicator
```

## 使い方

### CLI

```bash
npx @d-zero/replicator <url> -o <output-directory> [options]
```

#### オプション

- `-o, --output <dir>`: 出力ディレクトリ（必須）
- `-t, --timeout <ms>`: リクエストタイムアウト（ミリ秒、デフォルト: 30000）
- `-d, --devices <devices>`: デバイスプリセット（カンマ区切り、デフォルト: desktop-compact,mobile）
- `-v, --verbose`: 詳細ログモード

#### 利用可能なデバイスプリセット

- `desktop`: 1400px幅
- `tablet`: 768px幅
- `mobile`: 375px幅（2倍解像度）
- `desktop-hd`: 1920px幅
- `desktop-compact`: 1280px幅
- `mobile-large`: 414px幅（3倍解像度）
- `mobile-small`: 320px幅（2倍解像度）

#### 使用例

```bash
# デフォルトデバイス（desktop-compact, mobile）
npx @d-zero/replicator https://example.com -o ./output

# カスタムデバイス指定
npx @d-zero/replicator https://example.com -o ./output --devices desktop,tablet,mobile

# タイムアウト指定
npx @d-zero/replicator https://example.com -o ./output --timeout 60000
```

### プログラマティック使用

```typescript
import { replicate } from '@d-zero/replicator';

// デフォルトデバイス
await replicate('https://example.com', './output');

// カスタムデバイス
await replicate('https://example.com', './output', {
	devices: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	timeout: 30000,
	verbose: true,
});
```

## 機能

- **レスポンシブ画像対応**: 複数のデバイス幅で`<picture>`要素やメディアクエリのリソースを取得
- **遅延読み込み対応**: ページを自動スクロールして`loading=lazy`や`IntersectionObserver`ベースのコンテンツを取得
- **マルチデバイスシミュレーション**: 様々なデバイス幅と解像度をシミュレートして包括的なリソース取得を実現
- HTMLページのディレクトリ構造を保持してダウンロード
- 関連するすべてのリソース（CSS、JS、画像など）を取得
- リソース間の相対リンクを維持
- 同一ホストのリソースのみサポート
- 元のファイル拡張子とパスを保持

## License

MIT
