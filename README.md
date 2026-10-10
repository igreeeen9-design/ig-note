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

## LOG（日々の短い記録）

- 公開ページは `/ig-note/log/`。日付の新しい順に、本文の改行を保って表示します。同じ日はファイルIDの降順です。
- HOMEの `LATEST LOG` には公開中の最新3件だけを表示します。日付と48文字までの抜粋から該当LOGへ移動できます。
- `/ig-note/admin/` の **LOG** → **新しいLOGを書く** から、日付・本文・任意の写真1枚を入力します。タイトルやタグは不要です。
- **下書き保存／公開する／更新を保存／下書きに戻す／削除** に対応します。GitHubトークンはBLOGと共通です。
- 写真は保存時に既存の処理で長辺1600px以内のJPEGへ圧縮し、`public/images/uploads/` に保存します。写真を外す・LOGを削除する操作では、他の投稿から参照される可能性がある画像ファイル自体は削除しません。
- 保存後は既存のGitHub Actionsで再生成されます。下書きは公開ページに表示されません（既存BLOG同様、公開GitHubリポジトリ内のファイルを非公開にする機能ではありません）。
- 公開側のナビは HOME / BLOG / LOG / PHOTO / ABOUT。お問い合わせはフッターから開けます。

データは `src/content/logs/` の1件1JSONファイルです。Astroのdata collectionで検証します。本文はプレーンテキストで、HTMLやMarkdownとして実行しません。ファイルIDは作成時に固定され、日付を変更しても同じLOGを更新します。

```json
{
  "date": "2026-10-10",
  "body": "一行目。\n二行目。",
  "draft": false,
  "photo": "/ig-note/images/uploads/example.jpg"
}
```

写真なしの場合は `photo` を省略します。管理画面用の一覧・入力・データ処理は `public/admin/log*` に分離し、BLOGエディタには変更を加えていません。

### テスト

```sh
node --test tests/*.test.js
node tests/log-render.mjs
npm run build
```

ブラウザ検証は、ローカル開発サーバーを起動したうえで `node tests/log-browser.mjs` を実行します。利用可能なPlaywrightが別の場所にある場合は `PLAYWRIGHT_MODULE` にその `index.mjs` の絶対パスを指定し、必要なら `CHROME_PATH` にChromeの実行ファイルを指定します。テストのための依存追加は不要です。

GitHub通信はテスト内ですべてモックします。実リポジトリへの書き込みはありません。PC・スマホ表示、LOGの保存・公開・編集・取り下げ・削除、写真追加・除去、競合・通信失敗、既存BLOG操作を検証し、スクリーンショットを `/tmp/dekirukana-log-check/` に出力します。
