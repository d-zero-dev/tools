# ディーゼロ制作関連ツール

## CLI

- [`@d-zero/filematch`](./packages/%40d-zero/filematch/README.md)

## API

- [`@d-zero/readtext`](./packages/%40d-zero/readtext/README.md)

## メンテナンス環境

- [Volta](https://volta.sh/)によって管理しています。
  - [Node.js](https://nodejs.org/)のバージョンは[`package.json`](./package.json)に記載しています
  - [yarn](https://yarnpkg.com/)のバージョンは[`package.json`](./package.json)に記載しています
  - このバージョンは[Renovate](https://www.mend.io/renovate/)によってアップデートされます

### メンテ用のコマンド

| コマンド     | 内容                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `yarn build` | 各パッケージのビルドを行います                                             |
| `yarn lint`  | リポジトリ内のファイルのリント・自動フォーマット・スペルチェックを行います |
