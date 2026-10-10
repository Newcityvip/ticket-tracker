// Run with node tests/tracker.cjs; requires Playwright in NODE_PATH or locally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for (const script of scripts) {
  new Function(script);
  const names = [...script.matchAll(/function\s+(\w+)\s*\(/g)].map(m => m[1]);
  assert.equal(new Set(names).size, names.length, 'duplicate functions');
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let requests = 0;
    const payload = code => ({ success: true, ticket: { code, status: 'SOLVED', priority: 'HIGH', created_at: '2026-10-09T10:05:00Z', updated_at: '2026-10-10T02:15:00Z', subject: 'Deposit follow up', description: 'Issue: Deposit Follow Up\nUsername: exampleuser\nEmail: example@gmail.com', thread: [
      { role: 'agent', created_at: '2026-10-10T02:15:00Z', message: '<p>আপনার অনুরোধ গ্রহণ করা হয়েছে।</p><p>ধন্যবাদ।<br>Reference No: DJ9702EAMP</p>' },
      { role: 'customer', created_at: '2026-10-09T10:05:00Z', message: 'Phone No: +880 1712 345678\n\nRequest No Delete: 123456789' },
      { role: 'customer', message: '<img src="https://private.example/slip.png">' },
      { message: '' }, {}, { message: '--' }
    ] } });
    await page.route('https://tracker.test/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
      const local = path.join(__dirname, '..', file);
      return route.fulfill(fs.existsSync(local) ? { contentType: types[path.extname(file)], body: fs.readFileSync(local) } : { status: 404, body: 'Missing asset' });
    });
    await page.route('**/exec?**', async route => {
      requests++;
      const code = new URL(route.request().url()).searchParams.get('code');
      if (code === '404') return route.fulfill({ json: { success: false } });
      if (code === '500') return route.fulfill({ status: 500, body: 'Error' });
      if (code === '111') await new Promise(r => setTimeout(r, 250));
      await route.fulfill({ json: payload(code) }).catch(() => {});
    });
    await page.goto('https://tracker.test/?code=123');
    await page.waitForFunction(() => document.getElementById('replyCount').textContent === '3');
    const subjectFailures = await page.evaluate(() => {
      const cases = [
        ['AFF | J1 | New Affiliate Sign Up link Request', 'New Affiliate Sign Up link Request'],
        ['M1 | Player Account Number Delete Request', 'Player Account Number Delete Request'],
        ['M2 | Deposit Follow Up', 'Deposit Follow Up'],
        ['K1 | Affiliate Email Verification Request', 'Affiliate Email Verification Request'],
        ['  aFf  | j12|  Deposit Follow Up  ', 'Deposit Follow Up'],
        ['Player Withdrawal Issue', 'Player Withdrawal Issue'],
        ['Deposit | Follow Up', 'Deposit | Follow Up'],
        ['AFF | M2 | Deposit | Follow Up', 'Deposit | Follow Up'],
        ['AFF | Deposit | J1', 'Deposit | J1'],
        ['UNKNOWN | Deposit Follow Up', 'UNKNOWN | Deposit Follow Up'],
        ['AFF team | Deposit Follow Up', 'AFF team | Deposit Follow Up'],
        ['AFF | J1', 'AFF | J1'], ['M1 | ', 'M1 | '], ['AFF', 'AFF'],
        ['', ''], [null, ''], [undefined, '']
      ];
      const failures = cases.filter(([input, expected]) => formatSubject(input) !== expected);
      for (const [subject, expected] of cases) {
        const payload = { success: true, ticket: { subject } };
        const original = JSON.stringify(payload);
        renderTicket(payload);
        if (document.getElementById('subject').textContent !== (displayText(expected) || '—')) failures.push(['render', subject]);
        if (JSON.stringify(payload) !== original) failures.push(['mutation', subject]);
      }
      renderTicket(lastPayload);
      return failures;
    });
    assert.deepEqual(subjectFailures, [], 'subject display cleanup');
    const result = await page.evaluate(() => {
      const cases = [
        ['Username: exampleuser', 'Username: e*********r'],
        ['Email: a@sample.test', 'Email: *@sample.test'],
        ['Issue: Deposit Follow Up | Concern: Deposit Follow Up | Status: Solved', 'Issue: Deposit Follow Up | Concern: Deposit Follow Up | Status: Solved'],
        ['Username: a', 'Username: *'], ['Username: ab', 'Username: a*'],
        ['hello example@gmail.com', 'hello e*****e@gmail.com'],
        ['<p>প্রথম লাইন</p><p>দ্বিতীয়<br>তৃতীয়</p>', 'প্রথম লাইন\n\nদ্বিতীয়\nতৃতীয়'],
        ['', ''], [null, '']
      ];
      const failures = cases.filter(([input, expected]) => maskSensitiveText(input) !== expected).map(([input, expected]) => ({ input, expected, actual: maskSensitiveText(input) }));
      const labeled = 'Player Username: player123 | Affiliate Username : affiliate123\nAff Username: shortuser Email: person@sample.test Aff Email: affiliate@sample.test Phone No: +880 1712 345678 Reg Phone No: 01712345678 Mobile: 01712345678 Account No: 12345678 Cashout No: 1754193270 Reference No: DJ9702EAMP Ref No: ABCDEFG Transaction ID: TR123456 Request No Delete: 123456789';
      const masked = maskSensitiveText(labeled);
      const originals = ['player123', 'affiliate123', 'shortuser', 'person@', 'affiliate@', '1712', '01712345678', '12345678', '1754193270', 'DJ9702EAMP', 'ABCDEFG', 'TR123456', '123456789'];
      for (const value of originals) if (masked.includes(value)) failures.push({ leaked: value, masked });
      for (const input of [masked, 'Username: e***r Email: e***e@gmail.com Phone: 01******78', '01******78']) {
        if (maskSensitiveText(input) !== input) failures.push({ doubleMask: input, actual: maskSensitiveText(input) });
      }
      const links = maskSensitiveText('Before https://private.example/slip.png\nAfter data:image/png;base64,AAAAAA==');
      if (links.includes('private.example') || links.includes('AAAAAA') || !links.includes('Before') || !links.includes('After')) failures.push({ links });
      return { failures, masked };
    });
    assert.deepEqual(result.failures, []);
    await page.click('#btnEn');
    assert.equal(await page.textContent('#priority'), 'High');
    assert.equal(await page.locator('.message-text').count(), 3);
    assert.equal(await page.locator('#gateWrap').isVisible(), false);
    assert.equal(await page.locator('#repliesEmpty').isVisible(), false);
    assert.equal(await page.locator('#repliesList img, #repliesList a').count(), 0);
    assert.match(await page.textContent('#description'), /\nUsername: e\*+r\nEmail:/);
    await page.evaluate(() => renderReplies([{ message: '<script>window.hacked=true</script><b>&lt;img src=x onerror=alert(1)&gt;</b>safe' }]));
    assert.equal(await page.locator('#repliesList script, #repliesList img').count(), 0);
    assert.equal(await page.evaluate(() => window.hacked), undefined);
    await page.evaluate(() => { changeTicket('111'); load(); changeTicket('222'); load(); });
    await page.waitForFunction(() => document.getElementById('ticketCode').textContent === '222' && document.getElementById('replyCount').textContent === '3');
    await page.waitForTimeout(350);
    assert.equal(await page.textContent('#ticketCode'), '222');
    assert.match(page.url(), /code=222/);
    assert.ok(requests <= 3, 'overlapping same-ticket requests');
    const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(nodes => nodes.map(n => ({ href: n.href, sizes: n.getAttribute('sizes') })));
    assert.equal(icons.length, 5);
    for (const icon of icons) {
      const size = await page.evaluate(async href => {
        const img = new Image(); img.src = href; await img.decode();
        return [img.naturalWidth, img.naturalHeight];
      }, icon.href);
      if (icon.sizes) assert.equal(size.join('x'), icon.sizes);
    }
    for (const lang of ['en', 'bn']) {
      await page.click(lang === 'en' ? '#btnEn' : '#btnBn');
      for (const width of [320, 360, 375, 390, 414, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} ${width}: horizontal overflow`);
        for (const id of ['btnBn', 'btnEn', 'btnChangeCode', 'btnRefresh']) {
          const box = await page.locator('#' + id).boundingBox();
          assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `${id}: touch target/clipping`);
        }
        await page.screenshot({ path: path.join(__dirname, `preview-${lang}-${width}.png`), fullPage: true });
      }
    }
    await page.click('#btnEn');
    const beforeLayout = await page.locator('.ticket-card').boundingBox();
    await page.evaluate(() => { document.getElementById('loadState').textContent = I18N[getLang()].loading; });
    assert.deepEqual(await page.locator('.ticket-card').boundingBox(), beforeLayout, 'refresh indicator layout shift');
    await page.evaluate(() => { document.getElementById('loadState').textContent = ''; });
    await page.setViewportSize({ width: 320, height: 900 });
    for (const status of ['OPEN', 'IN_PROGRESS', 'SOLVED', 'CLOSED']) {
      await page.evaluate(status => setStatusPill(status), status);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), status + ' overflow');
      assert.ok(await page.locator('#btnRefresh').isVisible());
    }
    await page.evaluate(() => {
      document.getElementById('subject').textContent = 'দীর্ঘ বিষয় Long subject '.repeat(20) + 'x'.repeat(200);
      renderReplies([{ role: 'agent', created_at: '2026-10-10T01:02:03Z', message: ('বাংলা reply\n\n' + 'x'.repeat(100) + '\n').repeat(20) }]);
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'long-content overflow');
    assert.equal(await page.locator('.message-text').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
    await page.evaluate(() => renderTicket(lastPayload));
    const beforeRefresh = requests;
    await page.clock.runFor(20000);
    await page.waitForFunction(() => document.getElementById('dashWrap').getAttribute('aria-busy') === 'false');
    assert.equal(requests, beforeRefresh + 1, '20-second auto refresh');
    await page.evaluate(() => changeTicket('404'));
    await page.waitForFunction(() => document.getElementById('ticketError').textContent === 'Ticket not found');
    assert.equal(await page.textContent('#replyCount'), '0');
    await page.evaluate(() => changeTicket('500'));
    await page.waitForFunction(() => document.getElementById('ticketError').textContent.includes('Unable'));
    await page.goto('https://tracker.test/');
    assert.equal(await page.locator('#dashWrap').isVisible(), false);
    for (const lang of ['bn', 'en']) {
      await page.click(lang === 'bn' ? '#btnBn' : '#btnEn');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), lang + ' entry overflow');
      await page.screenshot({ path: path.join(__dirname, `preview-gate-${lang}.png`), fullPage: true });
    }
    await page.fill('#gateInput', 'abc');
    await page.click('#btnGateSubmit');
    assert.equal(await page.locator('#gateError').isVisible(), true);
    await page.fill('#gateInput', '333');
    await page.press('#gateInput', 'Enter');
    await page.waitForFunction(() => document.getElementById('replyCount').textContent === '3');
    assert.match(page.url(), /code=333/);
    assert.deepEqual(errors, []);
    console.log('PASS: masking, multiline/Bangla, short/idempotent values, attachments, XSS, replies, language, navigation, races, responsive overflow, syntax.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
