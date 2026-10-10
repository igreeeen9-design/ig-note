import { getToken, todayISO, uploadImage, fetchRepoImageBlob } from './admin.js';
import { getLog, saveLog, deleteLog, newLogPath } from './log-store.js';
import { normalizeLog } from './log-data.js';
const el = (id) => document.getElementById(id);
let path = new URLSearchParams(location.search).get('path');
let sha;
let photo = '';
let selectedPhoto = null;
let previewUrl = '';
let draft = true;
let busy = false;
let dirty = false;
function status(message, type = '') { el('status').textContent = message; el('status').className = `status ${type}`; }
function showPhoto(url) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = url.startsWith('blob:') ? url : '';
  el('preview').src = url;
  el('preview').hidden = !url;
  el('remove-photo').hidden = !url;
}
function render() {
  el('badge').textContent = draft ? '下書き' : '公開中';
  el('badge').className = `badge ${draft ? 'draft' : 'published'}`;
  el('publish').textContent = draft ? '公開する' : '更新を保存';
  el('save-draft').hidden = !draft;
  el('unpublish').hidden = draft;
  el('delete').hidden = !sha;
}
function errorMessage(err) {
  if (err.status === 409 || err.status === 422) return '他の場所で更新された可能性があります。入力内容を控えて、LOG一覧から開き直してください。';
  if (err.status === 401 || err.status === 403) return 'トークンが無効か権限不足です。入力内容を控えて、管理画面で設定を確認してください。';
  return `保存できませんでした。入力内容は残っています。${err.message}`;
}
async function run(action) {
  if (busy) return;
  busy = true; el('fields').disabled = true;
  try { await action(); }
  catch (err) { status(errorMessage(err), 'error'); }
  finally { busy = false; el('fields').disabled = false; }
}
async function save(nextDraft) {
  if (busy || !el('editor').reportValidity()) return;
  // 検証は画像アップロードより先に行う。
  let data;
  try { data = normalizeLog({ date: el('date').value, body: el('body').value, draft: nextDraft, photo }); }
  catch (err) { status(err.message, 'error'); return; }
  await run(async () => {
    status('保存中…');
    if (selectedPhoto) {
      photo = await uploadImage(selectedPhoto, (message) => status(message));
      selectedPhoto = null;
    }
    if (photo) data.photo = photo;
    path ||= newLogPath();
    const saved = await saveLog({ path, sha, data });
    sha = saved.sha; draft = nextDraft; dirty = false;
    history.replaceState(null, '', `./log-edit.html?path=${encodeURIComponent(path)}`);
    render();
    status(draft ? '下書き保存しました。' : '公開用に保存しました。サイトへの反映には少し時間がかかります。', 'success');
  });
}
el('editor').addEventListener('input', () => { dirty = true; });
el('editor').addEventListener('submit', (event) => { event.preventDefault(); save(false); });
el('save-draft').addEventListener('click', () => save(true));
el('unpublish').addEventListener('click', () => save(true));
el('photo').addEventListener('change', () => {
  const file = el('photo').files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { status('画像ファイルを選んでください。', 'error'); el('photo').value = ''; return; }
  selectedPhoto = file; dirty = true; showPhoto(URL.createObjectURL(file));
});
el('remove-photo').addEventListener('click', () => {
  selectedPhoto = null; photo = ''; el('photo').value = ''; dirty = true; showPhoto('');
});
el('delete').addEventListener('click', () => {
  if (busy || !sha || !confirm('このLOGを削除します。よろしいですか？')) return;
  run(async () => {
    await deleteLog(path, sha); dirty = false; location.href = './logs.html';
  });
});
window.addEventListener('beforeunload', (event) => {
  if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
});
async function init() {
  if (!getToken()) { location.replace('./index.html'); return; }
  el('date').value = todayISO();
  try {
    if (path) {
      const log = await getLog(path);
      sha = log.sha; draft = log.data.draft; photo = log.data.photo || '';
      el('date').value = log.data.date; el('body').value = log.data.body;
      if (photo) {
        // デプロイ前の写真もGitHub上の実体から表示する。
        try { showPhoto(URL.createObjectURL(await fetchRepoImageBlob(photo))); }
        catch { showPhoto(photo); }
      }
    }
    status(''); render(); el('editor').hidden = false;
  } catch (err) { status(`読み込みに失敗しました。LOG一覧から開き直してください。${err.message}`, 'error'); }
}
init();
