// LOGはプレーンテキスト。公開ページと管理画面で同じ検証・並び順を使う。
export function isLogDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isLogPhoto(value) {
  return typeof value === 'string' && /^\/(?:[\w-]+\/)*images\/uploads\/[\w.-]+\.(?:jpe?g|png|webp)$/i.test(value);
}

export function normalizeLog(input) {
  if (!isLogDate(input.date)) throw new Error('日付を正しく入力してください。');
  if (typeof input.body !== 'string' || !input.body.trim()) throw new Error('本文を入力してください。');
  if (typeof input.draft !== 'boolean') throw new Error('公開状態が不正です。');
  if (input.photo && !isLogPhoto(input.photo)) throw new Error('写真のパスが不正です。');
  return { date: input.date, body: input.body.trim(), draft: input.draft, ...(input.photo ? { photo: input.photo } : {}) };
}

export function logExcerpt(body, length = 48) {
  const chars = Array.from(body.replace(/\s+/g, ' ').trim());
  return chars.slice(0, length).join('') + (chars.length > length ? '…' : '');
}

export function sortLogs(entries) {
  return [...entries].sort((a, b) => b.data.date.localeCompare(a.data.date) || b.id.localeCompare(a.id));
}

export function publishedLogs(entries) {
  return sortLogs(entries.filter(({ data }) => !data.draft));
}
