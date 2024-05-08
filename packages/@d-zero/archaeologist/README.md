# `@d-zero/archaeologist`

**🕵️ Archaeologist: アーキオロジスト**

ウェブサイトの本番環境と開発環境や、新旧のページの比較するためのツールです。

- Puppeteerを実行してページのスクリーンショットを撮影します
- スクリーンショットはデスクトップとモバイルの2つのサイズでそれぞれ撮影します
- スクリーンショットは画像差分（ビジュアルリグレッション）を検出・出力します
- HTMLの差分も検出します

## CLI

```sh
npx @d-zero/archaeologist -f <filepath>
```

URLリストを持つファイルを指定して実行します。

ファイルの先頭には比較対象のホストを指定します。[Frontmatter](https://jekyllrb.com/docs/front-matter/)形式で`comparisonHost`に指定します。

```txt
---
comparisonHost: https://stage.example.com
---

https://example.com
https://example.com/a
https://example.com/b
https://example.com/c
https://example.com/xyz/001
```

上記のサンプルファイルの場合、以下のURLが比較されます。

| 比較元                        | 比較対象                            |
| ----------------------------- | ----------------------------------- |
| `https://example.com`         | `https://stage.example.com`         |
| `https://example.com/a`       | `https://stage.example.com/a`       |
| `https://example.com/b`       | `https://stage.example.com/b`       |
| `https://example.com/c`       | `https://stage.example.com/c`       |
| `https://example.com/xyz/001` | `https://stage.example.com/xyz/001` |

実行した結果は`.archaeologist`ディレクトリに保存されます。
