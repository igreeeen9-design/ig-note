# オヤジのつぶやき

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
---

ここから本文をMarkdownで書きます。
```

## GitHub Pagesに公開する

1. `astro.config.mjs` の `site` を自分のURLに書き換える(プロジェクトページの場合は `base` も設定)
2. GitHubのリポジトリ設定 → Pages → Source を「GitHub Actions」にする
3. `main` ブランチにpushすると `.github/workflows/deploy.yml` が自動でビルド・公開する

## 構成について

- 記事はcontent collections(`src/content/posts/`)で管理。フィールドは `title` `date` `excerpt` `cover` `tags` のみ。
- 検索・コメント・タグ別ページなどは意図的に入れていません。まずは「書く」ことを優先し、必要になったら足す方針です。
- PWA対応: `public/manifest.webmanifest` と `public/sw.js` で、一度開いたページはオフラインでも表示できるようにしています。プッシュ通知など踏み込んだ機能は入れていません。

## デザインについて

日記帳・雑記帳をイメージした見た目にしています。

- 背景はノートの罫線のような薄い横線
- 記事一覧の日付は判子(はんこ)のような丸い印
- 見出しは明朝体(Shippori Mincho)、本文はゴシック体(Zen Kaku Gothic New)
- 写真を入れると、隅にセロテープを貼ったような飾りが付きます
