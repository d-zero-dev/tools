# `@d-zero/replicator`

ウェブページとそのリソースをレスポンシブ画像対応でローカルディレクトリに複製するツールです。複数のURLを並列処理し、効率的にリソースを取得します。

## インストール

```bash
npm install @d-zero/replicator
```

## 使い方

### CLI

```bash
npx @d-zero/replicator <url...> -o <output-directory> [options]
```

#### オプション

- `-o, --output <dir>`: 出力ディレクトリ（必須）
- `-t, --timeout <ms>`: リクエストタイムアウト（ミリ秒、デフォルト: 30000）
- `-d, --devices <devices>`: デバイスプリセット（カンマ区切り、デフォルト: desktop-compact,mobile）
- `-l, --limit <number>`: 並列処理数の上限（デフォルト: 3）
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
# 単一URL（デフォルトデバイス: desktop-compact, mobile）
npx @d-zero/replicator https://example.com -o ./output

# 複数URLを並列処理
npx @d-zero/replicator https://example.com/page1 https://example.com/page2 -o ./output

# 並列数を制限
npx @d-zero/replicator https://example.com/page1 https://example.com/page2 -o ./output --limit 2

# カスタムデバイス指定
npx @d-zero/replicator https://example.com -o ./output --devices desktop,tablet,mobile

# タイムアウト指定
npx @d-zero/replicator https://example.com -o ./output --timeout 60000
```

### プログラマティック使用

```typescript
import { replicate } from '@d-zero/replicator';

// 単一URL
await replicate({
	urls: ['https://example.com'],
	outputDir: './output',
});

// 複数URLを並列処理
await replicate({
	urls: [
		'https://example.com/page1',
		'https://example.com/page2',
		'https://example.com/page3',
	],
	outputDir: './output',
	limit: 2, // 最大2つのURLを同時処理
});

// カスタムデバイス
await replicate({
	urls: ['https://example.com'],
	outputDir: './output',
	devices: {
		desktop: { width: 1400 },
		mobile: { width: 375, resolution: 2 },
	},
	timeout: 30000,
	verbose: true,
});
```

## 機能

- **並列処理**: 複数のURLを並列で効率的に処理
- **メモリ効率**: リソースを直接ディスクに保存してメモリ使用量を最小化
- **レスポンシブ画像対応**: 複数のデバイス幅で`<picture>`要素やメディアクエリのリソースを取得
- **遅延読み込み対応**: ページを自動スクロールして`loading=lazy`や`IntersectionObserver`ベースのコンテンツを取得
- **マルチデバイスシミュレーション**: 様々なデバイス幅と解像度をシミュレートして包括的なリソース取得を実現
- HTMLページのディレクトリ構造を保持してダウンロード
- 関連するすべてのリソース（CSS、JS、画像など）を取得
- リソース間の相対リンクを維持
- 同一ホストのリソースのみサポート（複数ホストが検出された場合はエラー）
- 元のファイル拡張子とパスを保持

## License

MIT
