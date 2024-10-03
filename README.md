# ディーゼロ制作関連ツール

## CLI

- [`@d-zero/archaeologist`](./packages/%40d-zero/archaeologist/README.md)
- [`@d-zero/backlog-projects`](./packages/%40d-zero/backlog-projects/README.md)
- [`@d-zero/print`](./packages/%40d-zero/print/README.md)
- [`@d-zero/filematch`](./packages/%40d-zero/filematch/README.md)

## API

- [`@d-zero/@d-zero/beholder`](./packages/%40d-zero/beholder/README.md)
- [`@d-zero/@d-zero/dealer`](./packages/%40d-zero/dealer/README.md)
- [`@d-zero/@d-zero/html-distiller`](./packages/%40d-zero/html-distiller/README.md)
- [`@d-zero/@d-zero/notion`](./packages/%40d-zero/notion/README.md)
- [`@d-zero/puppeteer-page-scan`](./packages/%40d-zero/puppeteer-page-scan/README.md)
- [`@d-zero/puppeteer-screenshot`](./packages/%40d-zero/puppeteer-screenshot/README.md)
- [`@d-zero/puppeteer-scroll`](./packages/%40d-zero/puppeteer-scroll/README.md)
- [`@d-zero/readtext`](./packages/%40d-zero/readtext/README.md)
- [`@d-zero/shared`](./packages/%40d-zero/shared/README.md)

## メンテナンス環境

- [Volta](https://volta.sh/)によって管理しています。
  - [Node.js](https://nodejs.org/)のバージョンは[`package.json`](./package.json)に記載しています
  - [yarn](https://yarnpkg.com/)のバージョンは[`package.json`](./package.json)に記載しています
  - このバージョンは[Renovate](https://www.mend.io/renovate/)によってアップデートされます
- [Commitizen](https://github.com/commitizen/cz-cli)を利用してコミットメッセージを作ります（メッセージは[_commitlint_](https://commitlint.js.org/)によってチェックされます）

### メンテ用のコマンド

| コマンド     | 内容                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `yarn build` | 各パッケージのビルドを行います                                             |
| `yarn lint`  | リポジトリ内のファイルのリント・自動フォーマット・スペルチェックを行います |
| `yarn test`  | リポジトリ内のファイルのテストを実装します                                 |
| `yarn co`    | Gitコミットを*Commitizen*経由で実行します                                  |
