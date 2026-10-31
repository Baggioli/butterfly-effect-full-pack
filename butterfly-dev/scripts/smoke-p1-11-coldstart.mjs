/**
 * P1-11 cold-start paste import — CS1–CS4 smoke (no browser, no A2).
 * Writes report under /workspace/butterfly-handoff/p1-11-coldstart/
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = '/workspace/butterfly-handoff/p1-11-coldstart';
const PORT = 18911;
const STAMP = '1.4-p1-11b';

fs.mkdirSync(OUT, { recursive: true });

const results = [];
const pass = (name, detail = '') => { results.push({ ok: true, name, detail }); console.log('PASS', name, detail); };
const fail = (name, detail = '') => { results.push({ ok: false, name, detail }); console.log('FAIL', name, detail); };

const SAMPLE_STRUCTURED = `【基本】
称呼偏好：阿凯
年龄段：32 岁
城市：杭州
职业/身份：独立咨询顾问
家庭或重要关系：与伴侣同住，无子女

【现状】
正在做的事：帮中小企业做数字化诊断
资源与约束：每周约 8 小时可投入个人项目；预算有限；精力一般

【目标】
1) 3 个月内完成个人网站并接到 2 个付费诊断单
2) 半年内把诊断流程标准化成可复用模板
3) 一年内验证是否值得全职转型

【卡点】
反复出现的困难：开场拖延、容易被客户临时需求打断
容易放弃的触发点：连续两周没有外部反馈

【风格】
做决定的习惯：先小步验证再加码
喜欢怎样被提醒或拆任务：短清单、可勾选、不要鸡汤

【忌讳】
不希望被评价为「不够拼」或用「别人都怎样」施压

依据来自对话中的哪些主题：数字化咨询、个人品牌、时间预算、拖延、付费验证`;

const SAMPLE_FREE = `我是上海的产品经理，想在一年内做出副业收入证明。平时加班多，每周大概只能挤 5 小时。`;

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${pathname}`, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    }).on('error', reject);
  });
}

async function startServer() {
  const child = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: PUBLIC,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((r) => setTimeout(r, 400));
  return child;
}

async function main() {
  // --- static / wiring ---
  const app = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  const index = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(PUBLIC, 'style.css'), 'utf8');
  const modPath = path.join(PUBLIC, 'coldstart-import.js');
  if (!fs.existsSync(modPath)) fail('module_exists', 'coldstart-import.js missing');
  else pass('module_exists');

  if (index.includes(`app.js?v=${STAMP}`) && index.includes(`style.css?v=${STAMP}`)) pass('stamp_index', STAMP);
  else fail('stamp_index', index.slice(0, 280));

  // Consent logic markers still present (P0-23 untouched structurally)
  const consentMarks = ['confirm-sensitive-btn', 'agree-sensitive', 'sensitive-error', 'is-gated', 'label.consent-row'];
  if (consentMarks.every((m) => app.includes(m))) pass('consent_markers_intact');
  else fail('consent_markers_intact', 'missing marker');

  // Gate after consent, not replacing consent
  if (app.includes("showSensitiveConsent(()=>showColdstartGate('text'))") && app.includes('showColdstartGate(mode)'))
    pass('gate_after_consent');
  else fail('gate_after_consent');

  // CS1 wiring: direct path exists
  if (app.includes("data-action=\"coldstart-direct\"") && app.includes('startChatOnboarding') && app.includes('gate_direct'))
    pass('CS1_wiring_direct_chat');
  else fail('CS1_wiring_direct_chat');

  // CS4 wiring: demo skip + no import in demo
  if (app.includes('gate_skip_demo') && app.includes('demoModeOn()') && app.includes('演示模式不提供画像导入'))
    pass('CS4_wiring_demo_hide');
  else fail('CS4_wiring_demo_hide');

  if (css.includes('P1-11 cold-start import') && css.includes('#coldstart-paste')) pass('css_present');
  else fail('css_present');

  // Import parser as ESM
  const mod = await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
  const { MAIN_PROMPT, parseImportPaste, trackColdstart, demoModeOn, STAMP: modStamp } = mod;

  if (modStamp === STAMP && MAIN_PROMPT.includes('【基本】') && MAIN_PROMPT.includes('【忌讳】'))
    pass('prompt_main_version');
  else fail('prompt_main_version', modStamp);

  // --- CS3: empty / garbage ---
  const empty = parseImportPaste('');
  const garbage = parseImportPaste('@@@###');
  const short = parseImportPaste('??');
  if (!empty.ok && empty.reason === 'empty' && !garbage.ok && garbage.reason === 'garbage')
    pass('CS3_empty_garbage', `${empty.reason}/${garbage.reason}/${short.reason}`);
  else fail('CS3_empty_garbage', JSON.stringify({ empty, garbage, short }));

  // --- CS2: structured sample ---
  const parsed = parseImportPaste(SAMPLE_STRUCTURED);
  const need = ['name', 'age', 'city', 'role', 'goal', 'constraints', 'preference'];
  const missing = need.filter((k) => !parsed.profile?.[k]);
  if (parsed.ok && parsed.structured && missing.length === 0 && /阿凯/.test(parsed.profile.name) && /杭州/.test(parsed.profile.city) && /咨询/.test(parsed.profile.role) && /网站|诊断/.test(parsed.profile.goal))
    pass('CS2_structured_map', `covered=${parsed.covered.join(',')}`);
  else fail('CS2_structured_map', JSON.stringify({ ok: parsed.ok, structured: parsed.structured, profile: parsed.profile, missing }, null, 2));

  // Label-strip: no leftover 偏好：/身份： prefixes
  const leakKeys = Object.entries(parsed.profile).filter(([k,v]) => typeof v === 'string' && /^(偏好|身份|职业|称呼|家庭或重要关系|家庭|年龄|城市)[：:]/.test(v));
  if (parsed.profile.name === '阿凯' && parsed.profile.role === '独立咨询顾问' && !leakKeys.length)
    pass('CS2_strip_labels', `name=${parsed.profile.name};role=${parsed.profile.role}`);
  else fail('CS2_strip_labels', JSON.stringify({ name: parsed.profile.name, role: parsed.profile.role, leakKeys }, null, 2));

  if (parsed.profile.taboo && /不够拼/.test(parsed.profile.taboo) && !/依据来自/.test(parsed.profile.taboo))
    pass('CS2_taboo_aside', parsed.profile.taboo.slice(0, 60));
  else fail('CS2_taboo_aside', String(parsed.profile.taboo || ''));

  // Free-text fallback still ok
  const free = parseImportPaste(SAMPLE_FREE);
  if (free.ok && (free.profile.importNotes || free.freeNote) && (free.profile.city || free.profile.role || free.profile.goal || free.freeNote))
    pass('CS2_free_note_fallback', `structured=${free.structured}`);
  else fail('CS2_free_note_fallback', JSON.stringify(free));

  // Hours extraction
  if (parsed.profile.hours === 8) pass('CS2_hours_map', '8');
  else fail('CS2_hours_map', String(parsed.profile.hours));

  // Never auto budget/income
  if (parsed.profile.budget === undefined) pass('CS2_no_auto_budget');
  else fail('CS2_no_auto_budget', String(parsed.profile.budget));

  // --- CS4 analytics: no paste body ---
  globalThis.window = globalThis.window || {};
  globalThis.window.__bfColdstartEvents = [];
  trackColdstart('submit_paste', { chars: SAMPLE_STRUCTURED.length, paste: SAMPLE_STRUCTURED, text: SAMPLE_STRUCTURED, raw: 'SECRET' });
  const ev = globalThis.window.__bfColdstartEvents.at(-1);
  const leaked = JSON.stringify(ev).includes('阿凯') || JSON.stringify(ev).includes('SECRET') || ev.paste || ev.text || ev.raw;
  if (!leaked && ev.chars === SAMPLE_STRUCTURED.length) pass('CS4_no_paste_in_events', JSON.stringify(ev));
  else fail('CS4_no_paste_in_events', JSON.stringify(ev));

  if (demoModeOn('?demo=1') === true && demoModeOn('') === false && demoModeOn('?foo=1') === false)
    pass('CS4_demo_flag');
  else fail('CS4_demo_flag');

  // Confirm apply path exists (role card → makeUser → route)
  if (app.includes('applyColdstartCard') && app.includes("page='route'") && app.includes('他方AI画像粘贴冷启动'))
    pass('CS2_confirm_apply_path');
  else fail('CS2_confirm_apply_path');

  if (app.includes('ai_plan_attempt') && app.includes('已保留示例骨架') && app.includes('previewAI(profile,result.story'))
    pass('CS2_optional_ai_plan_wiring');
  else fail('CS2_optional_ai_plan_wiring');

  // Static server asset check
  const child = await startServer();
  try {
    const home = await get('/');
    if (home.status === 200 && home.body.includes(`app.js?v=${STAMP}`)) pass('static_index', String(home.status));
    else fail('static_index', `${home.status}`);

    const js = await get(`/app.js?v=${STAMP}`);
    if (js.status === 200 && js.body.includes('showColdstartGate')) pass('static_appjs');
    else fail('static_appjs', String(js.status));

    const ci = await get(`/coldstart-import.js?v=${STAMP}`);
    if (ci.status === 200 && ci.body.includes('parseImportPaste')) pass('static_coldstart_module');
    else fail('static_coldstart_module', String(ci.status));

    const demoHome = await get('/?demo=1');
    if (demoHome.status === 200) pass('static_demo_query');
    else fail('static_demo_query');
  } finally {
    child.kill('SIGTERM');
  }

  // Write sample + report
  fs.writeFileSync(path.join(OUT, 'sample-structured.txt'), SAMPLE_STRUCTURED);
  fs.writeFileSync(path.join(OUT, 'sample-free.txt'), SAMPLE_FREE);
  fs.writeFileSync(path.join(OUT, 'parsed-structured.json'), JSON.stringify({ profile: parsed.profile, covered: parsed.covered, structured: parsed.structured }, null, 2));

  const summary = {
    stamp: STAMP,
    at: new Date().toISOString(),
    branch: 'feat/p1-11-coldstart-import',
    deploy: 'local butterfly-dev/public only — NOT hot-updated to A2 / 8443',
    cs: {
      CS1: results.find((r) => r.name.startsWith('CS1'))?.ok && results.find((r) => r.name === 'gate_after_consent')?.ok ? 'PASS' : 'FAIL',
      CS2: results.filter((r) => r.name.startsWith('CS2')).every((r) => r.ok) ? 'PASS' : 'FAIL',
      CS3: results.find((r) => r.name.startsWith('CS3'))?.ok ? 'PASS' : 'FAIL',
      CS4: results.filter((r) => r.name.startsWith('CS4')).every((r) => r.ok) ? 'PASS' : 'FAIL',
    },
    results,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(summary, null, 2));
  const md = `# P1-11 冷启动竖切冒烟

- 时间：${summary.at}（UTC；箱内 Asia/Shanghai）
- 戳：\`${STAMP}\`
- 分支：\`feat/p1-11-coldstart-import\`
- 部署：仅本地 \`/workspace/butterfly-dev/public\`；**未**热更 A2 / Tailscale \`:8443\`（保现网 23c 演示）

## CS 结论
- CS1 直接开始聊（主路径接线）：**${summary.cs.CS1}**
- CS2 结构化粘贴→角色卡映射→确认进故事路径：**${summary.cs.CS2}**
- CS3 空/乱码友好失败：**${summary.cs.CS3}**
- CS4 demo 隐藏 + 埋点无原文：**${summary.cs.CS4}**

## 明细
${results.map((r) => `- ${r.ok ? 'PASS' : 'FAIL'} \`${r.name}\` ${r.detail || ''}`).join('\n')}

## 证据文件
- \`report.json\`
- \`sample-structured.txt\` / \`parsed-structured.json\`
- \`sample-free.txt\`
`;
  fs.writeFileSync(path.join(OUT, 'README.md'), md);
  console.log('\nSUMMARY', summary.cs);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
