import { defineConfig } from 'astro/config';

// GitHub Pagesで公開する場合は以下を自分のURLに書き換えてください。
// 例: ユーザーページ(username.github.io)ならbaseは不要。
//     プロジェクトページ(username.github.io/repo-name)なら base: '/repo-name' を追加。
export default defineConfig({
  site: 'https://igreeeen9-design.github.io',
  base: '/ig-note',
});
