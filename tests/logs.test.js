import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLog, publishedLogs, sortLogs, logExcerpt } from '../public/admin/log-data.js';
import { getLog, listLogs, saveLog, deleteLog, newLogPath, LOGS_DIR } from '../public/admin/log-store.js';

const sample = { date: '2026-10-10', body: '一行目。\n二行目。', draft: true };
test('LOGは改行・文字を保ち、任意写真を扱う', () => {
  assert.deepEqual(normalizeLog(sample), sample);
  assert.equal(normalizeLog({ ...sample, photo: '/ig-note/images/uploads/sample.jpg' }).photo, '/ig-note/images/uploads/sample.jpg');
  for (const invalid of [{date:'2026-02-30'}, {body:'  '}, {draft:'false'}, {photo:'javascript:alert(1)'}, {photo:'/ig-note/images/uploads/../secret.jpg'}]) {
    assert.throws(() => normalizeLog({ ...sample, ...invalid }));
  }
});
test('公開LOGのみを日付降順・同日はID降順で表示し、HOMEは最新3件', () => {
  const logs = ['2026-10-07', '2026-10-10', '2026-10-09', '2026-10-08'].map((date, i) => ({ id: String(i), data: { ...sample, date, draft: false } }));
  logs.push({ id: 'secret', data: { ...sample, date: '2026-10-11' } });
  assert.deepEqual(publishedLogs(logs).slice(0, 3).map((l) => l.data.date), ['2026-10-10', '2026-10-09', '2026-10-08']);
  assert.equal(logs[0].data.date, '2026-10-07');
  assert.deepEqual(sortLogs([{ id:'a', data:sample }, { id:'b', data:sample }]).map((l) => l.id), ['b', 'a']);
  assert.deepEqual(publishedLogs([]), []);
});
test('HOMEの抜粋は改行をまとめ、長文・絵文字を安全に省略する', () => {
  assert.equal(logExcerpt(sample.body), '一行目。 二行目。');
  assert.equal(logExcerpt('🌱'.repeat(60)), '🌱'.repeat(48) + '…');
});
test('LOGの新規保存・読込・公開・編集・取り下げ・削除は既存GitHub APIを通り、BLOGに触れない', async (t) => {
  const files = new Map(); let seq = 0; const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    const path = new URL(url).pathname.split('/contents/')[1];
    calls.push({ path, method: opts.method || 'GET' });
    if (path === LOGS_DIR) return Response.json([...files.keys()].map((path) => ({ path, name:path.split('/').pop(), type:'file' })));
    const before = files.get(path);
    if (!opts.method) return before ? Response.json(before) : Response.json({}, {status:404});
    const data = JSON.parse(opts.body);
    if (before && before.sha !== data.sha) return Response.json({message:'Conflict'}, {status:409});
    if (opts.method === 'DELETE') { files.delete(path); return Response.json({}); }
    const file = { sha: String(++seq), content: data.content }; files.set(path, file);
    return Response.json({content:{sha:file.sha}});
  });
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => 'test-token' };
  t.after(() => { if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage; });
  const path = newLogPath(); assert.match(path, /^src\/content\/logs\/[\w-]+\.json$/);
  assert.notEqual(path, newLogPath());
  let saved = await saveLog({ path, data: sample });
  assert.deepEqual((await getLog(path)).data, sample);
  for (const draft of [false, false, true]) {
    saved = await saveLog({ ...saved, data: { ...sample, draft, body:'編集後。\n改行。', photo:'/ig-note/images/uploads/test.jpg' } });
    assert.equal((await getLog(path)).data.draft, draft);
    assert.equal((await getLog(path)).data.body, '編集後。\n改行。');
  }
  await assert.rejects(saveLog({ path, sha:'stale', data:sample }), (err) => err.status === 409);
  assert.equal((await listLogs()).length, 1);
  await assert.rejects(deleteLog('src/content/posts/test.md', saved.sha));
  await deleteLog(path, saved.sha);
  assert.deepEqual(await listLogs(), []);
  assert.ok(calls.every(({path}) => path.startsWith(LOGS_DIR)));
});
