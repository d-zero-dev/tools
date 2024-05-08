# `@d-zero/backlog-projects`

## 使い方

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
