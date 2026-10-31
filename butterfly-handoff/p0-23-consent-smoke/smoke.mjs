import {chromium} from 'playwright-core';
import {writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {join} from 'node:path';

const OUT = process.env.SMOKE_OUT || '/Users/lq/butterfly-handoff/p0-23-consent-smoke';
mkdirSync(OUT, {recursive:true});
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:18888';
const USER = process.env.SMOKE_USER || 'owner';
const PASS = process.env.SMOKE_PASS || '';
const PHONE = process.env.SMOKE_PHONE || ('139' + String(Date.now()).slice(-8));
const report = {
  startedAt: new Date().toISOString(),
  base: BASE, phone: PHONE,
  criteria: {}, notes: [], screenshots: [],
  network: [], passed: false
};

function shot(page, name){
  const p = join(OUT, name + '.png');
  return page.screenshot({path:p, fullPage:true}).then(()=>{ report.screenshots.push(name+'.png'); return p; });
}

const PROXY = process.env.SMOKE_PROXY || '';
const launchArgs = ['--disable-blink-features=AutomationControlled'];
if (!PROXY) launchArgs.push('--no-proxy-server');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: launchArgs,
});
const contextOpts = {
  viewport: {width: 390, height: 844},
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN',
  httpCredentials: {username: USER, password: PASS},
  ignoreHTTPSErrors: true,
};
if (PROXY) contextOpts.proxy = { server: PROXY };
const context = await browser.newContext(contextOpts);
const page = await context.newPage();
page.on('console', m => { if (['error','warning'].includes(m.type())) report.notes.push('console:'+m.type()+':'+m.text().slice(0,240)); });
page.on('pageerror', e => report.notes.push('pageerror:'+String(e).slice(0,240)));
page.on('request', req => {
  if (req.url().includes('/api/auth/sensitive-consent')) {
    const h = req.headers();
    report.network.push({
      phase: 'req',
      method: req.method(),
      url: req.url(),
      authorization: h.authorization ? (h.authorization.slice(0,20)+'…') : null,
      xButterflySession: h['x-butterfly-session'] ? (h['x-butterfly-session'].slice(0,12)+'…') : null,
    });
  }
});
page.on('response', async res => {
  if (res.url().includes('/api/auth/sensitive-consent')) {
    let body = '';
    try { body = (await res.text()).slice(0,200); } catch {}
    report.network.push({phase:'res', status: res.status(), url: res.url(), body});
  }
});

try {
  await page.goto(BASE + '/?v=1.4-p0-23-consent', {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForTimeout(900);
  const html = await page.content();
  report.cacheBust = html.includes('1.4-p0-23c') || html.includes('v=1.4-p0-23-consent');
  report.stamp23c = html.includes('1.4-p0-23c');
  report.hasSyncSensitiveInSrc = await page.evaluate(async () => {
    const s = [...document.scripts].find(x => (x.src||'').includes('app.js'));
    if (!s) return false;
    const t = await fetch(s.src).then(r=>r.text());
    return t.includes('__syncSensitive') && t.includes('X-Butterfly-Session');
  });
  await shot(page, '01-home');

  const loginTriggers = ['text=登录', 'text=手机号登录', '[data-action="login"]', 'button:has-text("登录")'];
  let opened = false;
  for (const sel of loginTriggers) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible().catch(()=>false)) {
      await el.click(); opened = true; break;
    }
  }
  if (!opened) {
    const any = page.locator('button, a, [role="button"]').filter({hasText: /登录|开始|建档/}).first();
    if (await any.count()) { await any.click(); opened = true; }
  }
  await page.waitForTimeout(500);
  await shot(page, '02-login-modal');

  const phoneInput = page.locator('#login-phone, input[name="phone"], input[type="tel"], input[placeholder*="手机"]').first();
  await phoneInput.waitFor({timeout: 10000});
  await phoneInput.fill(PHONE);
  for (const id of ['#agree-terms', '#agree-privacy', 'input[type=checkbox]']) {
    const boxes = page.locator(id);
    const n = await boxes.count();
    for (let i=0;i<n;i++) {
      const b = boxes.nth(i);
      if (!(await b.isChecked().catch(()=>false))) await b.check({force:true}).catch(()=>{});
    }
  }
  const sendBtn = page.locator('[data-action="send-code"], button:has-text("获取验证码"), button:has-text("发送验证码")').first();
  if (await sendBtn.count()) await sendBtn.click();
  await page.waitForTimeout(600);
  const codeInput = page.locator('#login-code, input[name="code"], input[placeholder*="验证码"]').first();
  await codeInput.fill('000000');
  await shot(page, '03-login-filled');
  const verifyBtn = page.locator('[data-action="verify-code"], button:has-text("登录")').last();
  await verifyBtn.click();
  await page.waitForTimeout(1800);
  await shot(page, '04-after-login');

  const consentTitle = page.locator('text=敏感信息处理同意');
  await consentTitle.waitFor({timeout: 15000});
  const btn = page.locator('#confirm-sensitive-btn');
  const box = page.locator('#agree-sensitive');
  const errEl = page.locator('#sensitive-error');

  const disabledBefore = await btn.isDisabled();
  const ariaBefore = await btn.getAttribute('aria-disabled');
  report.criteria.c1_disabled_before_check = {ok: disabledBefore === true, disabled: disabledBefore, aria: ariaBefore};
  await shot(page, '05-consent-gated');

  await btn.click({force:true}).catch(()=>{});
  await page.waitForTimeout(400);
  const stillConsent = await consentTitle.isVisible();
  report.criteria.c1b_force_click_stays = {ok: stillConsent, stillConsent};

  await box.check({force:true});
  await page.waitForTimeout(250);
  const disabledAfter = await btn.isDisabled();
  report.criteria.c2_enabled_after_check = {ok: disabledAfter === false, disabled: disabledAfter};
  await shot(page, '06-consent-ungated');

  // c4: inject ONE fail, require #sensitive-error visible (not leftover login toast)
  let failInjected = false;
  await page.route('**/api/auth/sensitive-consent', async (route) => {
    if (!failInjected) {
      failInjected = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({error:'同意提交失败(冒烟注入)', code:'SMOKE_INJECT'})
      });
      return;
    }
    await route.continue();
  });
  // Clear any leftover toast noise
  await page.evaluate(() => {
    const t = document.querySelector('#toast');
    if (t) t.textContent = '';
    const e = document.querySelector('#sensitive-error');
    if (e) e.textContent = '';
  });
  await btn.click();
  await page.waitForTimeout(1000);
  const errText = (await errEl.innerText().catch(()=> '')).trim();
  const errVisible = await errEl.isVisible().catch(()=>false);
  const toastText = (await page.locator('#toast').innerText().catch(()=> '')).trim();
  const stillOnConsentAfterFail = await consentTitle.isVisible();
  const disabledAfterFail = await btn.isDisabled();
  const c4ok = stillOnConsentAfterFail && errVisible && errText.length > 0;
  report.criteria.c4_visible_error_on_fail = {
    ok: c4ok, errText, errVisible, toastText, stillOnConsentAfterFail, disabledAfterFail
  };
  await shot(page, '07-consent-fail-visible');

  // c3: real success must leave consent
  if (!(await box.isChecked())) await box.check({force:true});
  await page.waitForTimeout(150);
  const netBefore = report.network.length;
  await btn.click();
  await page.waitForTimeout(2500);
  const leftConsent = !(await consentTitle.isVisible().catch(()=>false));
  const nextHints = await page.locator('text=/建档|角色|故事|开始|聊天|自述|示例/').count();
  const successRes = report.network.filter(n => n.phase==='res').slice(-1)[0];
  report.criteria.c3_leaves_consent = {
    ok: leftConsent === true,
    leftConsent, nextHints,
    lastConsentRes: successRes || null,
    reqsAfterFail: report.network.slice(netBefore)
  };
  await shot(page, '08-after-consent');

  report.criteria.deploy_markers = {
    ok: !!(report.cacheBust && report.hasSyncSensitiveInSrc),
    cacheBust: report.cacheBust,
    hasSyncSensitiveInSrc: report.hasSyncSensitiveInSrc
  };

  const all = ['c1_disabled_before_check','c2_enabled_after_check','c3_leaves_consent','c4_visible_error_on_fail','deploy_markers']
    .every(k => report.criteria[k]?.ok);
  report.passed = all;
  report.finishedAt = new Date().toISOString();
} catch (e) {
  report.error = String(e?.stack || e);
  report.finishedAt = new Date().toISOString();
  try { await shot(page, '99-error'); } catch {}
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT, 'run.log'), JSON.stringify({passed: report.passed, criteria: report.criteria, error: report.error, network: report.network, notes: report.notes}, null, 2));
  try { copyFileSync('/tmp/p0-23-pw/smoke.mjs', join(OUT, 'smoke.mjs')); } catch {}
  await browser.close();
  console.log(JSON.stringify({passed: report.passed, criteria: report.criteria, error: report.error, network: report.network, notes: report.notes}, null, 2));
  process.exit(report.passed ? 0 : 1);
}
