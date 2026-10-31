/**
 * P1-11 live same-entry E2E against Tailscale :8443 (A2 via a2-host-proxy).
 * Uses SOCKS5 localhost:1055. Does NOT change Serve. Mock OTP 000000.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const OUT = '/workspace/butterfly-handoff/p0-28-plan-load-failed';
const SAMPLE_DIR = '/workspace/butterfly-handoff/p1-11-coldstart';
const SHOTS = path.join(OUT, 'live-e2e-shots');
const BASE = 'https://spark-864f.tailfb7e5f.ts.net:8443';
const PROXY = 'socks5://127.0.0.1:1055';
const PHONE = '137' + String(Date.now()).slice(-8);
const CODE = '000000';
const SAMPLE = fs.readFileSync(path.join(SAMPLE_DIR, 'sample-structured.txt'), 'utf8');

fs.mkdirSync(SHOTS, { recursive: true });
const steps = [];
const note = (name, ok, detail = '') => {
  steps.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', name, detail);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  note(`shot_${name}`, true, file);
  return file;
}

async function main() {
  let browser;
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    phone_masked: PHONE.slice(0, 3) + '****' + PHONE.slice(-4),
    stamp_expected: '1.4-p0-28',
    steps: [],
    criteria: {},
  };
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--proxy-server=${PROXY}`,
        '--window-size=430,900',
        '--ignore-certificate-errors',
      ],
      defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    let pendingAI = 0; const aiLog = [];
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/ai') { pendingAI++; aiLog.push({ at: Date.now(), ev: 'req', m: r.method() }); } });
    const done = (r, ev) => { if (new URL(r.url()).pathname === '/api/ai') { pendingAI--; aiLog.push({ at: Date.now(), ev, status: r.response()?.status(), fail: r.failure()?.errorText }); } };
    page.on('requestfinished', (r) => done(r, 'fin')); page.on('requestfailed', (r) => done(r, 'fail'));
    globalThis.__aiLog = aiLog; globalThis.__pending = () => pendingAI;
    page.on('pageerror', (e) => report.notes = [...(report.notes || []), String(e).slice(0, 200)]);

    await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });
    await wait(800);
    const html = await page.content();
    const stampOk = html.includes('1.4-p0-28');
    note('stamp_html', stampOk, stampOk ? '1.4-p0-28' : html.match(/1\.4-p[\w.-]+/g)?.join(',') || 'none');
    report.criteria.stamp = stampOk ? 'PASS' : 'FAIL';
    await shot(page, '01-home');

    // login
    const loginBtn = await page.$('[data-action="login"]');
    if (!loginBtn) throw new Error('no login button');
    await loginBtn.click();
    await wait(500);
    await shot(page, '02-login');
    await page.type('#login-phone', PHONE);
    for (const sel of ['#agree-terms', '#agree-privacy']) {
      const el = await page.$(sel);
      if (el) {
        const checked = await page.$eval(sel, (e) => e.checked);
        if (!checked) await el.click();
      }
    }
    await page.click('[data-action="send-code"]');
    await wait(800);
    await page.type('#login-code', CODE);
    await shot(page, '03-login-filled');
    await page.click('[data-action="verify-code"]');
    await wait(2000);
    await shot(page, '04-after-login');

    // consent gate
    let consentVisible = !!(await page.$('#confirm-sensitive-btn'));
    if (!consentVisible) {
      // maybe already past; check for coldstart or today
      const bodyText = await page.evaluate(() => document.body.innerText);
      note('consent_present', /敏感|同意/.test(bodyText) || !!(await page.$('#confirm-sensitive-btn')), bodyText.slice(0, 80));
    }
    if (await page.$('#confirm-sensitive-btn')) {
      await shot(page, '05-consent-gated');
      const gatedDisabled = await page.$eval('#confirm-sensitive-btn', (b) => b.disabled);
      note('consent_gated_disabled', gatedDisabled === true, String(gatedDisabled));
      report.criteria.consent_gate = gatedDisabled ? 'PASS' : 'FAIL';
      const row = await page.$('label.consent-row, #agree-sensitive, input[name="sensitive"]');
      if (row) await row.click();
      else {
        // click checkbox near 同意
        await page.evaluate(() => {
          const inp = document.querySelector('#confirm-sensitive-btn')?.closest('.modal, #modal, body')?.querySelector('input[type=checkbox]');
          if (inp && !inp.checked) inp.click();
        });
      }
      await wait(300);
      await shot(page, '06-consent-ungated');
      const ungated = await page.$eval('#confirm-sensitive-btn', (b) => !b.disabled);
      note('consent_ungated', ungated, String(ungated));
      await page.click('#confirm-sensitive-btn');
      await wait(1500);
      await shot(page, '07-after-consent');
      report.criteria.consent_submit = 'PASS';
    } else {
      note('consent_skipped_or_missing', false, 'no #confirm-sensitive-btn');
      report.criteria.consent_gate = 'FAIL';
    }

    // coldstart gate: 直接开始聊 + 导入
    await wait(800);
    const gateText = await page.evaluate(() => document.body.innerText);
    const hasDirect = /直接开始聊/.test(gateText);
    const hasImport = /导入|其他 AI|粘贴/.test(gateText);
    note('CS1_direct_visible', hasDirect, hasDirect ? '可见' : gateText.slice(0, 120));
    note('CS2_import_entry_visible', hasImport, hasImport ? '可见' : gateText.slice(0, 120));
    report.criteria.direct_chat = hasDirect ? 'PASS' : 'FAIL';
    report.criteria.import_entry = hasImport ? 'PASS' : 'FAIL';
    await shot(page, '08-coldstart-gate');

    // import path
    const importBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button, [data-action], a')];
      return buttons.find((b) => /导入|其他 AI|粘贴/.test(b.textContent || '')) || null;
    });
    const importEl = importBtn.asElement();
    if (importEl) {
      await importEl.click();
      await wait(800);
      await shot(page, '09-paste-page');
      const ta = await page.$('#coldstart-paste, textarea');
      if (ta) {
        await ta.click({ clickCount: 3 });
        await page.evaluate((sel, text) => {
          const el = document.querySelector(sel) || document.querySelector('textarea');
          if (el) {
            el.value = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, '#coldstart-paste', SAMPLE);
        await wait(400);
        await shot(page, '10-paste-filled');
        // parse / next
        const next = await page.evaluateHandle(() => {
          const buttons = [...document.querySelectorAll('button')];
          return buttons.find((b) => /解析|生成角色|下一步|预览/.test(b.textContent || '')) || null;
        });
        const nextEl = next.asElement();
        if (nextEl) await nextEl.click();
        else {
          // maybe data-action
          const a = await page.$('[data-action="coldstart-parse"], [data-action="parse-import"], [data-action="coldstart-preview"]');
          if (a) await a.click();
        }
        await wait(1000);
        await shot(page, '11-role-card');
        const cardText = await page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('input,textarea')].map(e => e.value).join('\n'));
        const stripOk = cardText.includes('阿凯') && cardText.includes('独立咨询顾问') && !/偏好：阿凯|身份：独立/.test(cardText);
        note('CS2_strip_labels_live', stripOk, stripOk ? '阿凯/独立咨询顾问' : cardText.match(/阿凯|偏好|身份|顾问/)?.join('|'));
        report.criteria.strip_labels = stripOk ? 'PASS' : 'FAIL';
        const tabooOk = /忌讳|不够拼/.test(cardText);
        note('CS2_taboo_aside_live', tabooOk, tabooOk ? '可见' : 'missing');
        report.criteria.taboo = tabooOk ? 'PASS' : 'WARN';

        // edit name slightly
        const nameInput = await page.$('input[name="name"], #coldstart-name');
        if (nameInput) {
          await nameInput.click({ clickCount: 3 });
          await nameInput.type('阿凯·测');
        }
        await shot(page, '12-role-card-edited');

        const confirm = await page.evaluateHandle(() => {
          const buttons = [...document.querySelectorAll('button')];
          return buttons.find((b) => /确认，进入故事/.test(b.textContent || '')) || buttons.find((b) => /进入故事|确认|开始/.test(b.textContent || '') && !/直接开始聊/.test(b.textContent || '')) || null;
        });
        const confirmEl = confirm.asElement();
        if (confirmEl) {
          await confirmEl.click();
          await wait(2500);
          await shot(page, '13-after-confirm');
          const after = await page.evaluate(() => document.body.innerText);
          const inStory = /人生剧本|第.?幕|路线|今天|任务|故事/.test(after);
          note('CS2_confirm_into_story', inStory, inStory ? '进故事' : after.slice(0, 100));
          report.criteria.confirm_story = inStory ? 'PASS' : 'FAIL';
          // wait for optional ai-plan (may fail → template toast)
          await wait(4000);
          await shot(page, '14-after-ai-attempt');
          const afterAi = await page.evaluate(() => document.body.innerText + '\n' + (document.querySelector('#toast')?.textContent || ''));
          const kept = /人生剧本|第.?幕|路线|示例骨架|保留|故事|展开/.test(afterAi);
          note('ai_plan_template_fallback_ok', kept, kept ? '模板/故事仍在' : afterAi.slice(0, 120));
          report.criteria.ai_plan_fallback = kept ? 'PASS' : 'FAIL';

          // ===== P0-28: 规划你的下一步 =====
          const openPlan = async (tag) => {
            await page.evaluate(() => document.querySelector('[data-action="close"]')?.click());
            await wait(500);
            const btn = await page.$('[data-action="ai-plan"]');
            if (!btn) { note('P0-28_ai_plan_btn_' + tag, false, 'missing'); return false; }
            await btn.click(); await wait(2500);
            return true;
          };
          if (await openPlan('open')) {
            await shot(page, 'P28-01-plan-modal-open');
            const t = await page.evaluate(() => document.querySelector('#modal')?.innerText || '');
            const okOpen = /规划你的下一步/.test(t) && !/Load failed|Failed to fetch/i.test(t);
            note('P0-28_open_no_load_failed', okOpen, t.slice(0, 160));
            report.criteria.p28_open = okOpen ? 'PASS' : 'FAIL';
            // real generate via 8443
            // wait for auto ai-plan (from confirm) to finish; capture its draft as plan evidence
            const w0 = Date.now(); while (globalThis.__pending() > 0 && Date.now() - w0 < 320000) await wait(3000);
            report.p28_auto_plan = { waited_s: Math.round((Date.now() - w0) / 1000), log: globalThis.__aiLog.slice() };
            await wait(1500); await shot(page, 'P28-00-auto-plan-result');
            report.p28_auto_plan.modal = (await page.evaluate(() => document.querySelector('#modal')?.innerText || '')).slice(0, 300);
            await openPlan('open2');
            let started = Date.now();
            await page.click('[data-action="ai-regenerate"]');
            await wait(5000);
            await shot(page, 'P28-02-generating');
            let outcome = 'pending', txt = '';
            while (Date.now() - started < 320000) {
              txt = await page.evaluate(() => (document.querySelector('#modal')?.innerText || '') + '\n#quick-error=' + (document.querySelector('#quick-error')?.textContent || ''));
              const btnTxt = await page.evaluate(() => document.querySelector('[data-action="ai-regenerate"]')?.textContent || '');
              if (!/规划你的下一步/.test(txt)) { outcome = 'draft'; break; }
              if (/同意并生成草案/.test(btnTxt) && Date.now() - started > 6000) {
                if (/仍在处理|排队/.test(txt) && (report.p28_busy_retries = (report.p28_busy_retries || 0) + 1) <= 12) { await wait(20000); await page.evaluate(() => { const e = document.querySelector('#quick-error'); if (e) { delete e.dataset.locked; e.textContent = ''; } }); await page.click('[data-action="ai-regenerate"]'); started = Date.now(); await wait(3000); continue; }
                outcome = 'error'; break; }
              await wait(3000);
            }
            report.p28_generate = { outcome, secs: Math.round((Date.now() - started) / 1000), text: txt.slice(0, 400) };
            await shot(page, 'P28-03-generate-result');
            const genOk = outcome === 'draft' || (outcome === 'error' && !/Load failed|Failed to fetch/i.test(txt) && /[\u4e00-\u9fa5]/.test(txt.split('#quick-error=')[1] || ''));
            note('P0-28_generate', genOk, outcome + ' ' + report.p28_generate.secs + 's');
            report.criteria.p28_generate = genOk ? 'PASS' : 'FAIL';
          }
          // simulated network drop on /api/ai (= Safari Load failed)
          await page.setRequestInterception(true);
          const onReq = (r) => { if (r.url().includes('/api/ai')) r.abort('internetdisconnected'); else r.continue(); };
          page.on('request', onReq);
          if (await openPlan('offline')) {
            await shot(page, 'P28-04-offline-open');
            const preTxt = await page.evaluate(() => document.querySelector('#quick-error')?.textContent || '');
            await page.click('[data-action="ai-regenerate"]');
            await wait(4000);
            await shot(page, 'P28-05-offline-generate');
            const e = await page.evaluate(() => document.querySelector('#quick-error')?.textContent || '');
            const ok = /连不上私人规划服务/.test(e) && !/Load failed|Failed to fetch/i.test(e + preTxt);
            note('P0-28_offline_chinese_retry', ok, 'open=' + preTxt + ' | click=' + e);
            report.criteria.p28_offline = ok ? 'PASS' : 'FAIL';
          }
          page.off('request', onReq);
          await page.setRequestInterception(false);
          await page.evaluate(() => document.querySelector('[data-action="close"]')?.click());
        } else {
          note('confirm_btn', false, 'not found');
          report.criteria.confirm_story = 'FAIL';
        }
      } else {
        note('paste_textarea', false, 'missing');
        report.criteria.import_path = 'FAIL';
      }
    } else {
      note('import_btn', false, 'not found on gate');
      report.criteria.import_entry = 'FAIL';
    }

    // CS4 demo=1 — fresh context to avoid session bleed
    const ctx2 = await browser.createBrowserContext();
    const page2 = await ctx2.newPage();
    page2.setDefaultTimeout(45000);
    await page2.goto(BASE + '/?demo=1', { waitUntil: 'networkidle0', timeout: 60000 });
    await wait(1500);
    await shot(page2, '15-demo-mode');
    const demoText = await page2.evaluate(() => document.body.innerText);
    // demo should hide import gate / skip coldstart import
    const demoHasImportGate = /从其他 AI 导入|粘贴他方/.test(demoText) && /直接开始聊/.test(demoText);
    // Prefer: no coldstart import CTA as primary path; demo users go straight to sample journey
    const demoOk = !demoHasImportGate;
    note('CS4_demo_no_import_gate', demoOk, demoOk ? '无导入闸' : '仍见导入闸: ' + demoText.slice(0, 100));
    report.criteria.demo_hide = demoOk ? 'PASS' : 'FAIL';
    // also check module wiring: app should treat demo
    const demoFlag = await page2.evaluate(() => location.search.includes('demo=1'));
    note('CS4_demo_query', demoFlag, location => '');
    await ctx2.close();

    report.steps = steps;
    report.passed = steps.filter((s) => !s.name.startsWith('shot_')).every((s) => s.ok) &&
      ['stamp', 'consent_gate', 'direct_chat', 'import_entry', 'confirm_story', 'demo_hide'].every(
        (k) => report.criteria[k] === 'PASS' || report.criteria[k] === undefined
      );
    // stricter: require key criteria
    const need = ['stamp', 'consent_gate', 'direct_chat', 'import_entry', 'demo_hide', 'p28_open', 'p28_generate', 'p28_offline'];
    report.passed = need.every((k) => report.criteria[k] === 'PASS');
    fs.writeFileSync(path.join(OUT, 'p0-28-live-report.json'), JSON.stringify(report, null, 2));
    console.log('\nSUMMARY', report.criteria);
    console.log('passed', report.passed);
    if (!report.passed) process.exitCode = 1;
  } catch (e) {
    console.error('E2E_ERROR', e);
    report.error = String(e);
    report.steps = steps;
    fs.writeFileSync(path.join(OUT, 'p0-28-live-report.json'), JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

main();
