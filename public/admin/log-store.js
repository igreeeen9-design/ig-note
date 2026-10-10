import { listDirectory, getTextFile, saveTextFile, deletePostFile, genTimestamp } from './admin.js';
import { normalizeLog, sortLogs } from './log-data.js';

export const LOGS_DIR = 'src/content/logs';
function assertLogPath(path) {
  if (!new RegExp(`^${LOGS_DIR}/[A-Za-z0-9_-]+\\.json$`).test(path)) throw new Error('LOGの保存先が不正です。');
}

export async function getLog(path) {
  assertLogPath(path);
  const file = await getTextFile(path);
  return { path, id: path.split('/').pop(), sha: file.sha, data: normalizeLog(JSON.parse(file.content)) };
}

export async function listLogs() {
  let items;
  try { items = await listDirectory(LOGS_DIR); }
  catch (err) { if (err.status === 404) return []; throw err; }
  const logs = await Promise.all(items.filter((item) => item.type === 'file' && item.name.endsWith('.json')).map((item) => getLog(item.path)));
  return sortLogs(logs);
}

export async function saveLog({ path, sha, data }) {
  // 同じ秒の作成でも衝突しないID。保存に失敗しても呼び出し元がpathを保持する。
  assertLogPath(path);
  const content = JSON.stringify(normalizeLog(data), null, 2) + '\n';
  const result = await saveTextFile(path, content, `${data.draft ? '下書き保存' : '公開・更新'}: LOG ${data.date}`, sha);
  return { path, sha: result.content.sha };
}

export function newLogPath() {
  return `${LOGS_DIR}/${genTimestamp()}-${crypto.randomUUID().slice(0, 8)}.json`;
}

export async function deleteLog(path, sha) {
  assertLogPath(path);
  if (!sha) throw new Error('削除するLOGを読み直してください。');
  return deletePostFile(path, sha, 'LOGを削除');
}
