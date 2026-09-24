import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostFile, parseFrontmatter, unquote } from '../public/admin/admin.js';

const originalData = {
  title: '"既存タイトル"',
  date: '2026-09-24',
  excerpt: '"更新前の抜粋"',
  tags: '["雑記", "AI"]',
  featured: 'true',
  cover: '"/images/uploads/cover.jpg"',
};

const body = '# 新しい本文\n\n**更新した説明**と[リンク](https://example.com)。\n'
  + '![写真](/images/uploads/photo.jpg)\n'
  + '<img src="/images/uploads/photo.jpg" data-original="/images/uploads/original.jpg" style="width:50%;">\n'
  + '<p>続きの文章。</p>\n```js\noldCode();\n```\n'
  + 'あ'.repeat(100);
const expectedExcerpt = ('新しい本文 更新した説明とリンク。 続きの文章。 ' + 'あ'.repeat(100)).slice(0, 80);

for (const [action, beforeDraft, draft] of [
  ['下書き保存', true, true],
  ['公開', true, false],
  ['更新', false, false],
  ['下書きに戻す', false, true],
]) {
  test(`既存記事の${action}で最新本文の抜粋を保存し、他の項目を保持する`, () => {
    const saved = buildPostFile({
      originalData: { ...originalData, draft: String(beforeDraft) },
      title: '既存タイトル', date: originalData.date, draft, body,
    });
    const parsed = parseFrontmatter(saved);
    assert.equal(unquote(parsed.data.excerpt), expectedExcerpt);
    assert.equal(unquote(parsed.data.excerpt).length, 80);
    assert.equal(parsed.data.draft, String(draft));
    for (const key of ['title', 'date', 'tags', 'featured', 'cover']) {
      assert.equal(parsed.data[key], originalData[key]);
    }
    assert.equal(parsed.body, body + '\n');
  });
}

test('新規記事も本文から抜粋を生成する', () => {
  const { data } = parseFrontmatter(buildPostFile({
    title: '新規記事', date: '2026-09-24', draft: true, body,
  }));
  assert.equal(unquote(data.excerpt), expectedExcerpt);
});

test('本文にテキストがなくなった場合も古い抜粋を残さない', () => {
  for (const body of ['', '![写真](/photo.jpg)\n<img src="/another.jpg">']) {
    const { data } = parseFrontmatter(buildPostFile({
      originalData, title: '既存タイトル', date: originalData.date, draft: false, body,
    }));
    assert.equal(data.excerpt, undefined);
  }
});
