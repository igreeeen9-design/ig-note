// npm依存を追加せず、利用可能なPlaywrightを指定して実行する手動ブラウザ検証。
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/log-browser.mjs
// ローカルAstroサーバーが必要。GitHub通信はすべてモックし、実データは変更しない。
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const logData = await Promise.all((await readdir('src/content/logs')).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(`src/content/logs/${name}`, 'utf8'))));
const expectedLatestCount = Math.min(3, logData.filter((log) => !log.draft).length);
const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4321/ig-note/';
const shots = process.env.TEST_SCREENSHOTS || '/tmp/dekirukana-log-check';
await mkdir(shots, {recursive:true});
try {
  const context = await browser.newContext({ serviceWorkers:'block' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', (dialog) => dialog.accept());
  const files = new Map(); let seq = 0; let conflict = false; let failSave = false; let uploads = 0;
  const initial = JSON.parse(await readFile('src/content/logs/20261010-hakata.json','utf8'));
  const seed = (path, content) => files.set(path, {sha:String(++seq), content:Buffer.from(content).toString('base64')});
  seed('src/content/logs/20261010-hakata.json', JSON.stringify(initial));
  seed('src/content/posts/test.md', '---\ntitle: "既存記事"\ndate: 2026-10-10\ndraft: false\ntags: []\nfeatured: false\n---\n\n既存の本文。\n');
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'api.github.com') {
      const path = decodeURIComponent(url.pathname.split('/contents/')[1] || '');
      const method = route.request().method();
      const respond = (data, status=200) => route.fulfill({status, contentType:'application/json', body:JSON.stringify(data)});
      if (method === 'GET') {
        if (files.has(path)) return respond(files.get(path));
        const list = [...files.keys()].filter((p) => p.startsWith(path+'/')).map((p) => ({path:p,name:p.split('/').pop(),type:'file'}));
        if (list.length || path==='src/content/logs') return respond(list);
        return respond({message:'Not found'},404);
      }
      if (failSave) { failSave=false; return route.abort('failed'); }
      const data = route.request().postDataJSON();
      if (conflict) { conflict=false; return respond({message:'Conflict'},409); }
      if (files.has(path) && files.get(path).sha !== data.sha) return respond({message:'Stale SHA'},409);
      if (method === 'DELETE') { files.delete(path); return respond({}); }
      if (method === 'PUT') {
        if (path.startsWith('public/images/uploads/')) uploads++;
        files.set(path,{sha:String(++seq),content:data.content});
        return respond({content:{sha:String(seq)}});
      }
      throw new Error(`Unexpected API call: ${method} ${path}`);
    }
    if (url.origin === new URL(base).origin) return route.continue();
    // 外部アクセス・アクセス解析・実際のメール送信を発生させない。
    return route.abort();
  });
  for (const width of [1280,390,320]) {
    await page.setViewportSize({width,height:900});
    for (const path of ['', 'blog/', 'log/', 'photo/', 'about/', 'contact/']) {
      const response = await page.goto(base+path); assert.equal(response.status(),200);
      assert.deepEqual(await page.locator('.site-nav a').allTextContents(),['HOME','BLOG','LOG','PHOTO','ABOUT']);
      assert.equal(await page.locator('.site-footer a').getAttribute('href'),'/ig-note/contact/');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${path} overflow at ${width}`);
      if (path==='log/') {
        assert.equal(await page.locator('#log-20261010-hakata .log-body').innerText(),initial.body);
        assert.equal(await page.locator('#log-20261010-hakata .log-body').evaluate((el)=>getComputedStyle(el).whiteSpace),'pre-wrap');
        assert.equal(await page.locator('#log-20261010-hakata .log-photo').count(),0);
        await page.screenshot({path:`${shots}/log-${width}.png`,fullPage:true});
      }
      if (!path) {
        assert.equal(await page.locator('main .now').count(), 0);
        assert.ok(!(await page.locator('main .section-label').allTextContents()).includes('NOW'));
        const gap = await page.evaluate(() => {
          const intro = document.querySelector('.intro');
          const latest = document.querySelector('#latest-log-heading');
          if (intro.nextElementSibling !== latest.closest('section')) return -1;
          return latest.getBoundingClientRect().top - intro.getBoundingClientRect().bottom;
        });
        assert.ok(gap >= 24 && gap <= 48, `Unexpected intro/LATEST LOG gap: ${gap}`);
        assert.equal(await page.locator('#latest-log-heading').innerText(), 'LOG');
        assert.equal(await page.locator('.latest-logs li').count(), expectedLatestCount);
        assert.ok((await page.locator('.latest-logs').innerText()).includes('10.10'));
        const href = await page.locator('.latest-logs a').first().getAttribute('href');
        assert.ok(href.includes('log/#log-'));
        await page.screenshot({path:`${shots}/home-${width}.png`,fullPage:true});
      }
    }
  }
  await page.goto(base+'admin/logs.html');
  await page.waitForURL('**/admin/index.html');
  assert.ok(await page.locator('#setup-view').isVisible());
  await page.locator('#token-input').fill('test-only-token');
  await page.locator('#save-token-btn').click();
  await page.locator('#post-list a').waitFor();
  assert.equal(await page.getByRole('link', {name:'NOWを編集', exact:true}).count(), 0);
  await page.getByRole('link', {name:'LOG', exact:true}).click();
  await page.locator('#logs a').waitFor();
  await page.getByRole('link',{name:'＋ 新しいLOGを書く'}).click();
  await page.locator('#editor').waitFor();
  // 必須検証。空白のみもAPI送信しない。
  await page.locator('#body').fill('  '); await page.locator('#publish').click();
  await page.getByText('本文を入力してください。',{exact:true}).waitFor();
  assert.equal([...files.keys()].filter((p)=>p.startsWith('src/content/logs/')).length,1);
  await page.locator('#date').fill('2026-10-10');
  const text = '新しい記録。\n改行も保存。\n<script>window.injected=true</script>';
  await page.locator('#body').fill(text);
  await page.locator('#save-draft').click();
  await page.getByText('下書き保存しました。',{exact:true}).waitFor();
  const savedPath = new URL(page.url()).searchParams.get('path');
  const savedData = () => JSON.parse(Buffer.from(files.get(savedPath).content,'base64').toString());
  assert.equal(savedData().draft,true); assert.equal(savedData().body,text);
  await page.locator('#publish').click();
  await page.getByText('公開用に保存しました。サイトへの反映には少し時間がかかります。',{exact:true}).waitFor();
  assert.equal(savedData().draft,false);
  await page.reload(); await page.locator('#editor').waitFor();
  assert.equal(await page.locator('#body').inputValue(),text);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  await page.locator('#body').fill('更新した記録。\nもう一行。');
  conflict=true;
  await page.locator('#publish').click();
  await page.getByText(/他の場所で更新された可能性/).waitFor();
  assert.equal(savedData().body,text);
  assert.equal(await page.locator('#body').inputValue(),'更新した記録。\nもう一行。');
  failSave=true; await page.locator('#publish').click();
  await page.getByText(/保存できませんでした/).waitFor();
  await page.locator('#publish').click();
  await page.getByText('公開用に保存しました。サイトへの反映には少し時間がかかります。',{exact:true}).waitFor();
  assert.equal(savedData().body,'更新した記録。\nもう一行。');
  // 写真は保存時に既存uploadImageでJPEG化される。
  await page.locator('#photo').setInputFiles('public/icons/dekirukana-512.png');
  await page.locator('#preview').waitFor();
  assert.equal(uploads,0);
  await page.locator('#publish').click();
  await page.getByText('公開用に保存しました。サイトへの反映には少し時間がかかります。',{exact:true}).waitFor();
  assert.equal(uploads,1); assert.match(savedData().photo,/^\/ig-note\/images\/uploads\/.*\.jpg$/);
  const uploaded = files.get('public'+savedData().photo.replace('/ig-note',''));
  assert.equal(Buffer.from(uploaded.content,'base64').subarray(0,2).toString('hex'),'ffd8');
  await page.reload(); await page.locator('#editor').waitFor();
  await page.waitForFunction(()=>document.getElementById('preview').naturalWidth>0);
  await page.screenshot({path:`${shots}/log-editor-mobile.png`,fullPage:true});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#remove-photo').click(); await page.locator('#unpublish').click();
  await page.getByText('下書き保存しました。',{exact:true}).waitFor();
  assert.equal(savedData().draft,true); assert.equal(savedData().photo,undefined);
  await page.locator('#delete').click(); await page.waitForURL('**/admin/logs.html');
  assert.equal(files.has(savedPath),false);
  // 既存BLOGの更新・取り下げ・複製・削除も同じAPIモックで確認。
  await page.goto(base+'admin/edit.html?path=src%2Fcontent%2Fposts%2Ftest.md');
  await page.locator('#editor').waitFor();
  await page.locator('#body-textarea').fill('BLOG更新確認。');
  await page.locator('#btn-update').click(); await page.getByText('公開しました',{exact:true}).waitFor();
  assert.ok(Buffer.from(files.get('src/content/posts/test.md').content,'base64').toString().includes('excerpt: "BLOG更新確認。"'));
  await page.locator('#btn-unpublish').click(); await page.getByText('下書き保存しました',{exact:true}).waitFor();
  await page.locator('#btn-publish').click(); await page.getByText('公開しました',{exact:true}).waitFor();
  await page.locator('#btn-duplicate').click(); await page.waitForURL((url)=>url.searchParams.get('path')!=='src/content/posts/test.md');
  await page.locator('#editor').waitFor();
  await page.locator('#btn-delete').click(); await page.waitForURL('**/admin/index.html');
  assert.equal([...files.keys()].filter(p=>p.startsWith('src/content/posts/')).length,1);
  assert.deepEqual(pageErrors,[]);
  console.log('PASS: public pages 1280/390/320px, navigation, HOME, LOG CRUD/drafts, photo upload/removal, errors, existing BLOG operations');
  await context.close();
} finally { await browser.close(); }
