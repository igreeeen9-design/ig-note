// 管理画面の共通ロジック。
// GitHubリポジトリを直接読み書きすることで、記事の保存・公開をブラウザ完結で行う。
// サーバーは持たない: 認証トークンはこの端末のブラウザ(localStorage)にのみ保存される。

export const OWNER = 'igreeeen9-design';
export const REPO = 'ig-note';
export const BRANCH = 'main';
export const POSTS_DIR = 'src/content/posts';
export const UPLOADS_DIR = 'public/images/uploads';
const API = 'https://api.github.com';
const TOKEN_KEY = 'ig_note_admin_token';

// ---------- トークン管理 ----------

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ---------- GitHub API ----------

async function gh(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).message;
    } catch {
      // ignore
    }
    const err = new Error(detail || `GitHub API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listPosts() {
  const items = await gh(`/repos/${OWNER}/${REPO}/contents/${POSTS_DIR}?ref=${BRANCH}`);
  const files = items.filter((it) => it.type === 'file' && it.name.endsWith('.md'));
  const posts = await Promise.all(
    files.map(async (f) => {
      const file = await gh(`/repos/${OWNER}/${REPO}/contents/${f.path}?ref=${BRANCH}`);
      const text = base64ToUtf8(file.content);
      const { data } = parseFrontmatter(text);
      return {
        path: f.path,
        title: unquote(data.title) || '(無題)',
        date: data.date || '',
        draft: data.draft === 'true',
      };
    })
  );
  return posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function getPost(path) {
  const file = await gh(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  const text = base64ToUtf8(file.content);
  const { data, body } = parseFrontmatter(text);
  return { path, sha: file.sha, data, body };
}

export async function savePostFile(path, content, message, sha) {
  const body = { message, content: utf8ToBase64(content), branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deletePostFile(path, sha, message) {
  return gh(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
}

// file はFile、または(トリミング後の)Blobのどちらでも可
export async function uploadImage(file, onProgress) {
  onProgress?.('圧縮中…');
  const blob = await compressImage(file);
  onProgress?.('アップロード中…');
  const base64 = await blobToBase64(blob);
  const filename = `${genTimestamp()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const path = `${UPLOADS_DIR}/${filename}`;
  await gh(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `画像を追加: ${filename}`, content: base64, branch: BRANCH }),
  });
  return `${getBasePath()}images/uploads/${filename}`;
}

// 公開URL(/ig-note/images/uploads/xxx.jpg)から、GitHub上の元画像をBlobとして取得する。
// 公開サイトのURLはビルド完了まで数十秒〜1分ラグがあるため、
// 既存記事の画像を編集(トリミング)する際はビルド結果を待たずGitHub上の実体を直接読む。
export async function fetchRepoImageBlob(publicUrl) {
  const base = getBasePath();
  const relative = publicUrl.startsWith(base) ? publicUrl.slice(base.length) : publicUrl.replace(/^\//, '');
  const path = `public/${relative}`;
  const file = await gh(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  const binary = atob(file.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}

// ---------- 本文内の画像タグの読み書き ----------
// 画像は <img src="..." data-original="..." style="width:XX%;"> というHTML直書きで本文に埋め込む
// (Astroはmarkdown内の生HTMLをそのまま公開ページに出力するため)。
// 過去に挿入された ![](url) 形式(旧仕様)も読み取り専用ではなく編集可能として扱う。

const IMAGE_TAG_RE = /<img\s+[^>]*>|!\[[^\]]*\]\([^)]+\)/g;

export function parseImages(body) {
  const results = [];
  IMAGE_TAG_RE.lastIndex = 0;
  let m;
  while ((m = IMAGE_TAG_RE.exec(body))) {
    const raw = m[0];
    const start = m.index;
    const end = start + raw.length;
    if (raw.startsWith('<img')) {
      const srcMatch = raw.match(/src="([^"]*)"/);
      const originalMatch = raw.match(/data-original="([^"]*)"/);
      const widthMatch = raw.match(/width:\s*(\d+)%/);
      const src = srcMatch ? srcMatch[1] : '';
      results.push({
        start,
        end,
        raw,
        src,
        original: originalMatch ? originalMatch[1] : src,
        width: widthMatch ? Number(widthMatch[1]) : 100,
      });
    } else {
      const urlMatch = raw.match(/\(([^)]+)\)/);
      const src = urlMatch ? urlMatch[1] : '';
      results.push({ start, end, raw, src, original: src, width: 100 });
    }
  }
  return results;
}

export function buildImageTag({ src, original, width }) {
  const originalAttr = original && original !== src ? ` data-original="${original}"` : '';
  return `<img src="${src}"${originalAttr} style="width:${width}%;">`;
}

export function replaceImageAt(body, start, end, newTag) {
  return body.slice(0, start) + newTag + body.slice(end);
}

// ---------- frontmatter の読み書き ----------
// 独自のシンプルなYAML風パーサー。既存記事のフォーマット(フラットなkey: value)専用。
// 未知のフィールド(cover, tagsなど)はそのまま保持して書き戻す。

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const lm = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (lm) data[lm[1]] = lm[2];
  }
  return { data, body: m[2].replace(/^\n+/, '') };
}

export function unquote(raw) {
  if (raw == null) return '';
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

// 記事本文の最初の80文字くらいをプレーンテキスト化して一覧用の抜粋にする
export function excerptFromBody(body) {
  const plain = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '') // <img ...> など、本文中の生HTMLタグを除去
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, 80);
}

// 記事1本分のMarkdownファイル本文を組み立てる。
// 既存のフォーマットにない項目(cover, tagsなど)は originalData から引き継いで壊さない。
export function buildPostFile({ originalData = {}, title, draft, date, body }) {
  const data = {};
  data.title = JSON.stringify(title || '');
  data.date = date;
  data.draft = draft ? 'true' : 'false';

  // 抜粋: 既に手動で書かれているものがあれば尊重し、新規記事のみ自動生成する
  const existingExcerpt = originalData.excerpt ? unquote(originalData.excerpt) : '';
  const excerpt = existingExcerpt || excerptFromBody(body);
  if (excerpt) data.excerpt = JSON.stringify(excerpt);

  for (const key of Object.keys(originalData)) {
    if (['title', 'date', 'draft', 'excerpt'].includes(key)) continue;
    data[key] = originalData[key];
  }

  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

// ---------- ユーティリティ ----------

export function genTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function genPostPath() {
  return `${POSTS_DIR}/${genTimestamp()}.md`;
}

export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

// サイトのbase path(例: /ig-note/)を、admin配下から自動で求める
export function getBasePath() {
  const path = location.pathname;
  const idx = path.indexOf('/admin/');
  return idx === -1 ? '/' : path.slice(0, idx + 1);
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// スマホの写真はサイズが大きいので、長辺1600pxまで縮小しJPEGに圧縮する
// (GitHub Contents APIは1ファイル1MBまでのため)
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function compressImage(file, maxDim = 1600, quality = 0.82) {
  const img = await loadImageFromFile(file);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
