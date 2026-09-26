// 検索エンジン向けのサイトマップ(/ig-note/sitemap.xml)。
// 公開ページだけを載せる: 下書き(draft: true)と管理画面(public/admin/)は含めない。
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// 記事・タグ以外の固定ページ(base path からの相対)
const STATIC_PAGES = ['', 'blog/', 'photo/', 'about/'];

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const url = (path: string) => new URL(`${base}${path}`, site).href;

  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const tags = Array.from(new Set(posts.flatMap((post) => post.data.tags)));

  const entries = [
    ...STATIC_PAGES.map((path) => ({ loc: url(path) })),
    ...posts.map((post) => ({
      loc: url(`posts/${post.slug}/`),
      lastmod: post.data.date.toISOString().slice(0, 10),
    })),
    // タグ名は日本語なので、URLとして正しくエンコードする
    ...tags.map((tag) => ({ loc: url(`tags/${encodeURIComponent(tag)}/`) })),
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map(
        ({ loc, lastmod }) =>
          `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
