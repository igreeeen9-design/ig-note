# できるかな。

Astroで作った、個人ブログ用の最小構成サイトです。Markdownファイルを追加するだけで記事が増えていきます。

## 使い方(ローカルで確認)

```bash
npm install
npm run dev
```

`http://localhost:4321` で確認できます。

## 新しい記事を書く

`src/content/posts/` に Markdown ファイルを追加するだけです。ファイル名は何でも構いません(URLは自動でスラッグ化されます)。

```markdown
---
title: "記事タイトル"
date: 2026-10-01
excerpt: "一覧に表示される一言(省略可)"
cover: "/images/example.jpg"  # 省略可。写真を使う場合は public/images/ に置く
tags: ["雑記"]                # 省略可
draft: true                   # 省略可。trueにすると公開サイトには出ない(下書き)
---

ここから本文をMarkdownで書きます。
```

## スマホから記事を管理する(管理画面)

`/admin/` にスマホ用の管理画面があります。GitやMarkdownを意識せず、ブラウザだけで記事の作成・編集・公開・下書き保存・削除・複製ができます。裏側では管理画面がGitHubリポジトリへ直接コミットしており、pushすると自動でサイトがビルド・公開されます(反映まで1分程度)。

- 公開後のURL: `https://<ユーザー名>.github.io/<リポジトリ名>/admin/`
- 初回のみ、GitHubの「Fine-grained personal access token」を発行して登録します(管理画面の案内に従うだけでOK)。このリポジトリの Contents 権限(Read and write)のみに絞って発行してください。
- トークンはこの端末のブラウザ(localStorage)にのみ保存され、どこにも送信されません。他の端末で使う場合は、その端末でも同じ手順でトークンを登録してください。
- 画像はスマホの写真をそのまま選べば、自動で縮小・圧縮してアップロードされます(GitHubの1ファイル1MB制限に収めるため)。挿入前(または挿入後、一覧の「トリミング」ボタンから)にトリミングでき、元画像は残したまま切り抜き後の画像を保存するので「元に戻す」もできます。本文内の画像ごとに表示サイズ(25/50/75/100%)も個別に設定できます。
- 実装は `public/admin/` 以下(`index.html`＝一覧, `edit.html`＝編集, `admin.js`＝GitHub APIとのやり取り)。ビルド不要のプレーンなHTML/JSなので、そのままエディタで開いて直接直せます。

## GitHub Pagesに公開する

1. `astro.config.mjs` の `site` を自分のURLに書き換える(プロジェクトページの場合は `base` も設定)
2. GitHubのリポジトリ設定 → Pages → Source を「GitHub Actions」にする
3. `main` ブランチにpushすると `.github/workflows/deploy.yml` が自動でビルド・公開する

## 構成について

- 記事はcontent collections(`src/content/posts/`)で管理。フィールドは `title` `date` `excerpt` `cover` `tags` `draft` のみ。
- 検索・コメント・タグ別ページなどは意図的に入れていません。まずは「書く」ことを優先し、必要になったら足す方針です。
- PWA対応: `public/manifest.webmanifest` と `public/sw.js` で、一度開いたページはオフラインでも表示できるようにしています。プッシュ通知など踏み込んだ機能は入れていません。

## デザインについて

日記帳・雑記帳をイメージした見た目にしています。

- 背景はノートの罫線のような薄い横線
- 記事一覧の日付は判子(はんこ)のような丸い印
- 見出しは明朝体(Shippori Mincho)、本文はゴシック体(Zen Kaku Gothic New)
- 写真を入れると、隅にセロテープを貼ったような飾りが付きます
