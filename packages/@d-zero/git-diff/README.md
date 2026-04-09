# `@d-zero/git-diff`

gitの差分を持つファイルの一覧を取得するためのツールです。

## CLI

```sh
# HEADからタグが付いているコミットまでの差分を取得する場合
npx @d-zero/git-diff

# HEADから特定のコミットまでの差分を取得する場合
npx @d-zero/git-diff <commit-hash>

# 特定のコミットから特定のコミットまでの差分を取得する場合
npx @d-zero/git-diff <commit-hash> <commit-hash>
```

差分を取得したいローカルリポジトリに移動し、上記コマンドを入力してください。  
コミットのハッシュ値を指定する場合、古い方のコミットを先に入力してください
