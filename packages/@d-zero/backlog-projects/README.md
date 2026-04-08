# `@d-zero/backlog-projects`

## 使い方

### オプション

- `-v, --version`: バージョンを表示
- `-a, --assign`: プロジェクトアサインモード
- `-d, --delete`: 添付ファイル削除モード
- `-V, --verbose`: 詳細出力

### プロジェクトアサイン

```sh
npx @d-zero/backlog-projects --assign
```

プロンプトに従って入力してください。

```sh
? BacklogのプロジェクトURLを入力してください ›
? カテゴリーを入力してください（ガントチャートなどで管理しやすくなります） ›
? 「窓口」を選択してください …
? 「ディレクション」を選択してください …
? 「情報設計」を選択してください …
? 「ビジュアルデザイン」を選択してください …
? 「フロントエンド」を選択してください …
? 「システム」を選択してください …
```

逐次、課題が登録されます。

### 添付ファイル削除

```sh
npx @d-zero/backlog-projects --delete
```

指定した基準日以前に最終更新された課題の添付ファイルをダウンロードしてから削除します。

プロンプトに従って入力してください。

```sh
? 基準日（例: 2024-01-01） ›
? 保存先ディレクトリ ›
```

添付ファイルは保存先ディレクトリに `プロジェクトキー/課題キー/` の階層で保存されます。各ファイルには削除結果のメタデータ（`.json`）も併せて保存されます。

`-V` オプションで詳細出力を有効にできます。

```sh
npx @d-zero/backlog-projects --delete -V
```

```sh
︙
API_TEST-1190 メールフォーム 情報設計・項目定義 @DZ平尾
API_TEST-1191 メールフォーム 自動返信メール文章作成 @DZ平尾
API_TEST-1192 デモサイト+開発環境準備 @DZ平尾
API_TEST-1193 トップページ デザイン @DZ平尾
API_TEST-1194 トップページ デザイン クライアント確認 @DZ平尾
API_TEST-1195 トップページ デザイン 戻し修正 @DZ平尾
API_TEST-1196 下層ページ デザイン @DZ平尾
︙

🔗 https://xxxxx.backlog.jp/gantt/API_TEST?span=6&scale=days&grouping=3&startDate=2024/01/01
```

## `.env`ファイル

`.env`ファイルを作成し、以下の内容を記述してください。

```
BACKLOG_HOST=xxxxx.backlog.jp
BACKLOG_APIKEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_TOKEN=secret_xxxxxxxxxxxxxx
```

## API

### `assign`

```ts
function assign(backlog: Backlog, params: Params): Promise<void>;

type Params = {
	backlogProject: Project.Project;
	assignedUsers: Record<Role, User.User>;
	backlogCategory?: string;
	log?: (message: string) => void;
};
```

### `deleteAttachments`

```ts
function deleteAttachments(
	backlog: Backlog,
	params: DeleteAttachmentsParams,
): Promise<void>;

type DeleteAttachmentsParams = {
	updatedUntil: string;
	outDir: string;
	verbose?: boolean;
};
```

### `createBacklogClient`

```ts
function createBacklogClient(): Backlog;
```
