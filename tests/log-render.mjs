// 一時LOGで実際の静的出力を検証。必ず一時データを消して通常のdistへ戻す。
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const created = [];
function build() {
  const result = spawnSync('npm', ['run','build'], {encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
}
try {
  const photo = 'public/images/uploads/render-check.png';
  await writeFile(photo, await readFile('public/icons/dekirukana-512.png'), {flag:'wx'});
  created.push(photo);
  for (const [id,date,draft] of [
    ['a','2099-10-07',false], ['b','2099-10-09',false],
    ['c','2099-10-10',false], ['d','2099-10-10',false], ['hidden','2099-10-11',true],
  ]) {
    const path = `src/content/logs/test-log-render-${id}.json`;
    await writeFile(path,JSON.stringify({date,draft,body:`RENDER_${id}\n<script>danger()</script>\n${'長い記録。'.repeat(100)}`,
      ...(id==='d' ? {photo:'/ig-note/images/uploads/render-check.png'} : {})}),{flag:'wx'});
    created.push(path);
  }
  build();
  const home = await readFile('dist/index.html','utf8');
  const log = await readFile('dist/log/index.html','utf8');
  const latest = home.match(/<ul class="latest-logs"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.equal((latest.match(/<li\b/g)||[]).length,3);
  assert.ok(latest.indexOf('RENDER_d')<latest.indexOf('RENDER_c'));
  assert.ok(latest.indexOf('RENDER_c')<latest.indexOf('RENDER_b'));
  assert.ok(!latest.includes('RENDER_a'));
  for (const html of [home,log]) { assert.ok(!html.includes('RENDER_hidden')); assert.ok(!html.includes('<script>danger()')); }
  assert.ok(log.includes('&lt;script&gt;danger()&lt;/script&gt;'));
  assert.ok(log.includes('src="/ig-note/images/uploads/render-check.png"'));
  assert.ok(log.includes('RENDER_a'));
  assert.ok(log.includes('博多駅周辺をうろうろ。'));
  const sitemap = await readFile('dist/sitemap.xml','utf8');
  assert.ok(sitemap.includes('/ig-note/log/'));
  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
    try {
      const page = await browser.newPage({serviceWorkers:'block'});
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'log-preview.test') return route.abort();
        let path = url.pathname.replace(/^\/ig-note\//,'');
        if (!path || path.endsWith('/')) path += 'index.html';
        try {
          const data = await readFile('dist/'+path);
          const contentType = path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.png') ? 'image/png' : 'text/html';
          await route.fulfill({body:data,contentType});
        } catch { await route.fulfill({status:404,body:''}); }
      });
      await mkdir('/tmp/dekirukana-log-check',{recursive:true});
      for (const width of [1280,320]) {
        await page.setViewportSize({width,height:900});
        await page.goto('http://log-preview.test/ig-note/log/');
        await page.waitForFunction(()=>document.querySelector('.log-photo').naturalWidth>0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.evaluate(()=>typeof danger),'undefined');
        await page.screenshot({path:`/tmp/dekirukana-log-check/log-long-photo-${width}.png`,fullPage:true});
      }
    } finally { await browser.close(); }
  }
  console.log('PASS: static HTML latest 3, date and same-day order, draft exclusion, escaped plain text, optional photo, sitemap');
} finally {
  for (const path of created) await unlink(path);
  build();
}
