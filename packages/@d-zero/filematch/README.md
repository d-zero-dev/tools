# `@d-zero/filematch`

2つのファイルパスもしくはURLを渡して、そのファイルの内容を比較するツールです。単純に差異があるかどうかしか判定しません。**差分検出ではないことに注意してください**。

このツールの用途としては、例えば以下のようなものが考えられます。

- リダイレクト処理のテスト
- アップロード・デプロイの成功の判定

バイト単位で比較を行うため、ファイルの種類に関係なく比較が可能です。また、そのため画像は圧縮率が異なれば異なるファイルとして判定されます。

## 使い方

### ファイル比較

#### オプション

```sh
npx @d-zero/filematch <file_path_or_url_1> <file_path_or_url_2>
```

#### 例

```sh
npx @d-zero/filematch ./test1.pdf ./test2.pdf
```

```sh
npx @d-zero/filematch https://example.com/test1.pdf https://example.com/test2.pdf
```

ローカルファイルとURLを混在して比較することも可能です。

```sh
npx @d-zero/filematch ./test1.pdf https://example.com/test2.pdf
```

### リストファイルからの比較

`-f`オプションを使用することで、リストファイルからの比較が可能です。

```sh
npx @d-zero/filematch -f <list_file_path>
```

```txt list.txt
./test1.pdf ./test2.pdf
https://example.com/test1.pdf https://example.com/test2.pdf
https://example.com/test1.png https://example.com/test2.png
https://example.com/test1.html https://example.com/test2.html
https://example.com/test1.js https://example.com/test2.js
```

```sh
npx @d-zero/filematch -f list.txt
```

## 動作環境

- Node.js 20.11以降
