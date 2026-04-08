# path-list-to-tree

ファイルパス（または URL パス）の配列を、階層ツリー構造に変換するユーティリティ。拡張子フィルタ・無視パターン・現在パスのハイライト・ノードごとのメタデータ付与が可能です。

## 関数

### `pathListToTree(pathList, options?)`

パス配列をソート・フィルタし、親子関係を持ったツリーに組み立てます。拡張子と `ignoreGlobs` で除外したあと、`filter` でノードを絞り、最後に `addMetaData` で各ノードにメタデータを付与します（いずれもオプション）。

**パラメータ:**

- `pathList: string[]` - ファイルパスまたは URL パスの配列（例: ファイルシステムや URL 一覧）
- `options?: PathListToTreeOptions<MetaData>` - オプション（後述）

**戻り値:**

- `Node<MetaData>` - ルートノード（`stem` が `'/'`）。子は `children` に再帰的に格納される。

**スロー:**

- `Error` - 次の場合にスローする:
  - `pathList` が空、またはルート（`'/'`）に相当するノードが存在しない: `"Root node not found"`
  - `createVirtualParent: false` のときに、親となるノードが存在しない: `"Parent node not found: \"...\""`

**例:**

```typescript
import {
	pathListToTree,
	type Node,
	type PathListToTreeOptions,
} from '@d-zero/shared/path-list-to-tree';

// 基本的な使用（ルート '/' は pathList に含める必要あり）
const tree = pathListToTree(['/', '/a/', '/a/b', '/a/c/', '/e/']);
// tree.stem === '/', tree.children に /a/, /e/ など

// 現在パスを指定（current / isAncestor が付く）
const tree2 = pathListToTree(['/', '/a/index', '/a/c/', '/b/d', '/e.html'], {
	currentPath: '/a/c/',
});

// 拡張子を限定（デフォルトは .html, .htm に加えて extensions で追加）
const tree3 = pathListToTree(['/', '/a/b.html', '/a/c.css'], {
	extensions: ['.html', '.css'],
});

// ノードの絞り込み（filter で false を返したノードとその子孫は削除）
const tree4 = pathListToTree(['/', '/a/', '/a/b.txt', '/a/c.html'], {
	filter: (node) => node.children.length > 0 || node.url.endsWith('.html'),
});

// ソート順をカスタマイズ（comparator で指定）
const tree4a = pathListToTree(['/', '/c/', '/a/', '/b/'], {
	comparator: (a, b) => b.localeCompare(a), // 降順
});
// tree4a.children の順序: /c/, /b/, /a/

// ソートなし（入力順を維持）
const tree4b = pathListToTree(['/', '/z/', '/a/', '/m/'], {
	comparator: null,
});
// tree4b.children の順序: /z/, /a/, /m/

// メタデータを付与（addMetaData は filter の後に適用される）
type MyMeta = { label: string; isLeaf: boolean };
const tree5 = pathListToTree<MyMeta>(['/', '/a/', '/a/b'], {
	addMetaData: (node) => ({
		label: node.stem,
		isLeaf: node.children.length === 0,
	}),
});
// tree5.meta, tree5.children[0].meta などが付く
```

## 型

### `PathListToTreeOptions<MetaData>`

ツリー構築時のオプション。ジェネリック `MetaData` は `addMetaData` で付与するメタの型（指定しない場合は `Record<string, unknown>`）。

| プロパティ             | 型                                                     | 説明                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentPath?`         | `string`                                               | 現在のパス。一致するノードの `current: true`、その祖先の `isAncestor: true` を設定する。                                                                      |
| `baseUrl?`             | `string`                                               | パスを stem/depth に変換するときのベース URL（未指定時は `'https://example.com'`）。`parseUrl` の `indexAsParent: true` で index を親ディレクトリとして扱う。 |
| `extensions?`          | `string[]`                                             | 含める拡張子。常に `.html` と `.htm` は含まれ、未指定時はこの2つのみ。指定した場合はこれらに加えて追加される。小文字に正規化して比較する。                    |
| `ignoreGlobs?`         | `string[]`                                             | 無視するパスの glob パターン。`path.matchesGlob` で一致したパスは除外される。                                                                                 |
| `createVirtualParent?` | `boolean`                                              | 親が存在しないときに仮想親ノードを作るか。`true`（既定）なら作成、`false` なら `Error` をスロー。                                                             |
| `comparator?`          | `'path' \| ((a: string, b: string) => number) \| null` | ソート方法。`'path'`（既定）は `pathComparator` を使用。関数を渡すとカスタムソート。`null` はソートなし（入力順を維持）。                                     |
| `filter?`              | `(node: Node<MetaData>) => boolean`                    | 各ノードを残すかどうか。`false` を返すとそのノードと子孫が削除される。適用順は filter → addMetaData。                                                         |
| `addMetaData?`         | `(node: Node<MetaData>) => MetaData`                   | 各ノードに付与するメタデータを返す関数。filter 適用後に全ノード（ルート含む）に対して呼ばれる。                                                               |

### `Node<MetaData>`

ツリーの 1 ノード。

| プロパティ   | 型                 | 説明                                                                            |
| ------------ | ------------------ | ------------------------------------------------------------------------------- |
| `url`        | `string`           | 元のパスまたは URL。                                                            |
| `stem`       | `string`           | 正規化された stem（ノードのキー。ディレクトリは末尾 `'/'` 付き、例: `'/a/'`）。 |
| `depth`      | `number`           | ツリー上の深さ（ルートは 0）。                                                  |
| `current`    | `boolean`          | このノードが `options.currentPath` と一致するとき `true`。                      |
| `isAncestor` | `boolean`          | `currentPath` がこのノードの配下にあるとき `true`。                             |
| `virtual?`   | `true`             | 実ファイルがなく仮想で作られた親ノードのときのみ存在。                          |
| `meta?`      | `MetaData`         | `options.addMetaData` を指定した場合に付与されるメタデータ。                    |
| `children`   | `Node<MetaData>[]` | 子ノードの配列。                                                                |

## 動作仕様

### パスの扱いと stem

- パスは内部で `comparator` オプションに従ってソートされたあと（既定は `pathComparator`、`null` 指定時はソートなし）、`parseUrl(path, { baseUrl, indexAsParent: true })` で stem と depth に変換される。
- `indexAsParent: true` のため、`index` や `index.html` のようなファイルは「親ディレクトリ」を表す stem（例: `'/a/'`）にまとめられ、depth は親と同じになる。
- ディレクトリ相当の stem は末尾が `'/'`（例: `'/a/'`）、ファイル相当は `'/'` なし（例: `'/a/b'`）。

### 拡張子フィルタ

- 拡張子は `path.extname` で取得し、小文字に揃えてから照合する。
- 常に `.html` と `.htm` は含まれ、`options.extensions` を渡すとそれらが**追加**される（置き換えではない）。
- 拡張子のないパス（例: `'/a/'`）はスキップされず常に通る。

### 処理順序

1. `pathList` を `comparator` オプションに従ってソート（既定: `pathComparator`、関数: カスタムソート、`null`: ソートなし）。
2. 各パスについて `ignoreGlobs` に一致すればスキップ。
3. 拡張子が `extensions` に含まれない場合はスキップ（拡張子なしは含める）。
4. 残ったパスでノードの flat リストを作成し、`createTree` で親子を連結（必要なら仮想親を作成）。
5. `filter` でノードを削除（未指定なら全ノードを残す）。
6. `addMetaData` が指定されていれば、残った全ノードにメタデータを付与。

### 仮想親（virtual）

- 子のみ存在して親のパスが `pathList` に含まれない場合、親 stem に対応するノードが存在しないとツリーを張れない。
- `createVirtualParent: true`（既定）のときは、その親を `virtual: true` のノードとして自動生成する。
- `createVirtualParent: false` のときは、そのような親が欠けていると `"Parent node not found: \"...\""` をスローする。

### ルートの必須

- ルート（stem `'/'`）は、`pathList` に `'/'` またはそれに相当するパス（ベース URL と parse の結果が `'/'` になるもの）が含まれている必要がある。
- 空配列やルートに相当するパスがない場合は `"Root node not found"` をスローする。
