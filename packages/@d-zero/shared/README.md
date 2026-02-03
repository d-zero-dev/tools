# `@d-zero/shared`

共有ユーティリティ関数とクラスのコレクション。

## モジュール一覧

### コアユーティリティ

| Import Path                    | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `@d-zero/shared/cache`         | ファイルシステムにデータを保存するシンプルなキャッシュシステムのクラス |
| `@d-zero/shared/config-reader` | フロントマターをサポートする設定ファイルリーダー                       |
| `@d-zero/shared/deferred`      | 遅延解決可能なPromiseクラス                                            |
| `@d-zero/shared/hash`          | 文字列のSHA-256ハッシュ値を生成                                        |
| `@d-zero/shared/types`         | TypeScript型定義                                                       |

### ランダム数値生成と遅延機能

| Import Path                     | Description                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@d-zero/shared/delay`          | コードの実行を指定した時間だけ遅延させる関数。固定時間やランダムな遅延時間、確率分布を指定可能。 [詳細](./src/delay.md) |
| `@d-zero/shared/random-int`     | 指定された範囲内でランダムな整数を生成する関数。 [詳細](./src/random-int.md)                                            |
| `@d-zero/shared/parse-interval` | CLI引数から遅延間隔文字列をパースし、数値またはDelayOptionsに変換する関数                                               |

### 日付ユーティリティ

| Import Path                           | Description                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| `@d-zero/shared/between-weekend-days` | 2つの日付間の週末の日付を返す関数                                  |
| `@d-zero/shared/skip-holiday-period`  | 開始日と期限日の間の祝日期間をスキップする関数                     |
| `@d-zero/shared/skip-holidays`        | 指定された日付から祝日と週末をスキップし、次の有効な日付を返す関数 |

### URL/パスユーティリティ

| Import Path                           | Description                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@d-zero/shared/decode-uri-safely`    | URLエンコードされた文字列を安全にデコードする関数群（`decodeURISafely`、`decodeURIComponentSafely`）                                                 |
| `@d-zero/shared/encode-resource-path` | リソースパスをMIMEタイプと共にエンコード/デコードする関数群。拡張子がないURLパスにMIMEタイプ情報をエンコード。 [詳細](./src/encode-resource-path.md) |
| `@d-zero/shared/normalize-url`        | URLを正規化する関数。エンコーディング、パス、トレーリングスラッシュ、インデックスページのバリエーションを正規化                                      |
| `@d-zero/shared/parse-url`            | URL文字列をパースし、正規化されたExURLオブジェクトを返す関数                                                                                         |
| `@d-zero/shared/path-list-to-tree`    | URLまたはファイルパスのリストをツリー構造に変換する関数                                                                                              |
| `@d-zero/shared/url-matches`          | 2つのURLが等価かどうかを比較する関数。エンコーディング、トレーリングスラッシュ、インデックスページのバリエーション、クエリパラメータの順序を考慮     |
| `@d-zero/shared/url-to-file-name`     | URLをファイル名として使用可能な文字列に変換する関数                                                                                                  |
| `@d-zero/shared/url-to-local-path`    | URLをローカルファイルパスに変換する関数。 [詳細](./src/url-to-local-path.md)                                                                         |
| `@d-zero/shared/validate-same-host`   | すべてのURLが同じホスト名を持つことを検証する関数                                                                                                    |

### 配列/文字列ユーティリティ

| Import Path                   | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `@d-zero/shared/split-array`  | 配列を指定されたサイズのチャンクに分割する関数 |
| `@d-zero/shared/str-to-regex` | 文字列パターンを正規表現に変換する関数         |

### ソートユーティリティ

| Import Path                | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| `@d-zero/shared/sort/dir`  | 2つのディレクトリパスを比較し、順序を示す値を返す関数         |
| `@d-zero/shared/sort/path` | 2つのURLまたはURLを表す文字列を比較し、順序を示す値を返す関数 |

### その他のユーティリティ

| Import Path                                | Description                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `@d-zero/shared/filesize`                  | バイトサイズをキロバイト（KB）またはメガバイト（MB）に変換する関数                                    |
| `@d-zero/shared/mime-to-extension`         | MIMEタイプをファイル拡張子に変換する関数                                                              |
| `@d-zero/shared/race-with-timeout`         | 指定されたPromiseをタイムアウトと競争させ、結果またはタイムアウト指示を返す関数                       |
| `@d-zero/shared/ratio-value`               | 絶対値と相対値の比率を自動的に維持しながら更新する関数                                                |
| `@d-zero/shared/retry`                     | メソッドにリトライロジックを追加するデコレータファクトリ                                              |
| `@d-zero/shared/timestamp`                 | タイムスタンプを生成する関数。フォーマットが指定されない場合は、Linux時刻（エポック秒）を文字列で返す |
| `@d-zero/shared/typed-await-event-emitter` | 型付きイベントと非同期イベント処理をサポートするイベントエミッター                                    |
