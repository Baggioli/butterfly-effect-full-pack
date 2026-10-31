/**
 * P0-29 same-entry smoke against Tailscale :8443 (A2).
 * SOCKS 127.0.0.1:1055. Does not merge main / does not announce 可测.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { chapterHasExplicitQuad, extractQuadFromText, nearTermFromPlanStory } from '../../butterfly-dev/worker/depth-contract.js';

const OUT = '/workspace/butterfly-handoff/p0-29-hotupdate';
const BASE = 'https://spark-864f.tailfb7e5f.ts.net:8443';
const AGENT = new SocksProxyAgent('socks5h://127.0.0.1:1055');
const BASIC = 'Basic ' + Buffer.from('owner:rl9ejwIoyonFkJBtOt9aVgmg').toString('base64');
const STAMP = '1.4-p0-29';
const PHONE = '138' + String(Date.now()).slice(-8);
const CODE = '000000';

const persona = {
  name: '虚构便利店试单甲', age: '22', education: '高中 / 中专', role: '便利店店员',
  experience: '没有编程经验，刚开始学习Excel', skills: '基础录入',
  resources: '只有个人电脑，没有客户联系人', budget: 0, hours: 4,
  goal: '90天内完成一个Excel表格自动化服务的付费试单',
  constraints: '不辞职，不购买课程，不编造收入与客户',
  longGoal: '用表格自动化技能接稳定小单'
};

const steps = [];
const note = (name, ok, detail = '') => {
  steps.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
  console.log(ok ? 'PASS' : 'FAIL', name, String(detail).slice(0, 200));
};
const countHan = (s) => Array.from(String(s || '')).filter((ch) => /\p{Script=Han}/u.test(ch)).length;
const narrativeChars = (story) => (story?.chapters || []).reduce((n, c) => n + countHan(c.narrative || ''), 0);

function req(method, urlPath, { body, token, timeoutMs = 120000 } = {}) {
  const u = new URL(urlPath.startsWith('http') ? urlPath : BASE + urlPath);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  const headers = {
    Authorization: BASIC,
    Origin: BASE,
    Accept: 'application/json,text/html,*/*',
    'User-Agent': 'p0-29-hotupdate-smoke/1.0',
  };
  if (token) headers['X-Butterfly-Session'] = token;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(payload.length);
  }
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const r = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers,
        agent: AGENT,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, text, json });
        });
      }
    );
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(new Error('timeout')); });
    if (payload) r.write(payload);
    r.end();
  });
}

async function login() {
  const send = await req('POST', '/api/auth/send-code', {
    body: { phone: PHONE, agreedTerms: true, agreedPrivacy: true },
  });
  if (send.status !== 200) throw new Error('send-code ' + send.status + ' ' + JSON.stringify(send.json));
  const ver = await req('POST', '/api/auth/verify-code', {
    body: { phone: PHONE, code: CODE },
  });
  if (ver.status !== 200 || !ver.json?.token) throw new Error('verify ' + ver.status + ' ' + JSON.stringify(ver.json));
  const token = ver.json.token;
  const cons = await req('POST', '/api/auth/sensitive-consent', {
    body: { agreed: true },
    token,
  });
  if (cons.status !== 200) throw new Error('consent ' + cons.status + ' ' + JSON.stringify(cons.json));
  return token;
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    zone: 'Asia/Shanghai',
    base: BASE,
    stamp_expected: STAMP,
    tip: '6638f67',
    phone_masked: PHONE.slice(0, 3) + '****' + PHONE.slice(-4),
    steps: [],
    criteria: {},
  };

  // 1) stamp
  const home = await req('GET', '/', { timeoutMs: 30000 });
  const stampOk = home.text.includes(STAMP);
  note('stamp_html', stampOk, stampOk ? STAMP : (home.text.match(/1\.4-p[\w.-]+/g) || []).join(',') || 'none');
  report.criteria.stamp = stampOk ? 'PASS' : 'FAIL';

  // 2) ai status
  const st = await req('GET', '/api/ai/status', { timeoutMs: 30000 });
  const sj = st.json || {};
  const statusOk = st.status === 200 && sj.configured && sj.providerKind === 'deepseek' && sj.onlineReady && sj.hasApiKey && sj.depth;
  note('ai_status_deepseek', statusOk, JSON.stringify({
    provider: sj.provider, model: sj.model, depthVersion: sj.depthVersion, onlineReady: sj.onlineReady, hasApiKey: sj.hasApiKey, fallbackReason: sj.fallbackReason,
  }));
  report.criteria.ai_status = statusOk ? 'PASS' : 'FAIL';
  report.aiStatus = {
    provider: sj.provider, providerKind: sj.providerKind, model: sj.model,
    depth: sj.depth, depthVersion: sj.depthVersion, onlineReady: sj.onlineReady, hasApiKey: sj.hasApiKey,
  };

  // 3) login + sensitive consent (API)
  let token;
  try {
    token = await login();
    note('login_consent', true, 'token_len=' + token.length);
    report.criteria.login_consent = 'PASS';
  } catch (e) {
    note('login_consent', false, e.message);
    report.criteria.login_consent = 'FAIL';
    report.steps = steps;
    fs.writeFileSync(path.join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // 4) plan (DeepSeek live)
  const t0 = Date.now();
  let planRes;
  for (let attempt = 1; attempt <= 3; attempt++) {
    planRes = await req('POST', '/api/ai', {
      body: { mode: 'plan', profile: persona },
      token,
      timeoutMs: 300000,
    });
    if (planRes.status === 429) {
      console.log(JSON.stringify({ phase: 'plan-busy', attempt }));
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    break;
  }
  const planMs = Date.now() - t0;
  const story = planRes.json?.story || planRes.json?.data?.story || null;
  const narr = narrativeChars(story);
  const quads = (story?.chapters || []).map((c) => ({
    name: c.name,
    explicit: chapterHasExplicitQuad(c),
    hasFields: ['situation', 'action', 'change', 'cost'].every((k) => String(c?.[k] || '').trim().length >= 8),
    labels: !!extractQuadFromText(c?.narrative || ''),
  }));
  const quadOk = quads.length >= 3 && quads.every((q) => q.explicit || q.hasFields || q.labels);
  const narrOk = narr >= 1500;
  const providerOk = /deepseek/i.test(String(planRes.json?.provider || story?.provider || planRes.json?.invokeMeta?.provider || ''));
  note('plan_http', planRes.status === 200, 'status=' + planRes.status + ' ms=' + planMs + ' err=' + (planRes.json?.error || ''));
  note('plan_narr_ge_1500', narrOk, 'narr=' + narr);
  note('plan_quad_visible', quadOk, JSON.stringify(quads));
  note('plan_provider_deepseek', providerOk || statusOk, String(planRes.json?.provider || story?.provider || story?.model || ''));
  report.criteria.plan_depth = narrOk && quadOk && planRes.status === 200 ? 'PASS' : 'FAIL';
  report.plan = {
    status: planRes.status, ms: planMs, narr, quadOk, provider: planRes.json?.provider || story?.provider,
    model: planRes.json?.model || story?.model, depthVersion: planRes.json?.depthVersion || story?.depthVersion,
    chapters: (story?.chapters || []).map((c) => c.name),
    weekFirst: {
      today: story?.chapters?.[0]?.quests?.[0]?.title,
      week: story?.chapters?.[0]?.quests?.[1]?.title,
    },
  };

  // compliance: no raw40 / fortune promises in user-visible plan blob
  const planBlob = JSON.stringify(story || {});
  const noRaw40 = !/rawProjectionHorizon/.test(planBlob) && !/"hi"\s*:\s*40/.test(planBlob);
  const noFortune = !/算命|保证成功|成功率\s*\d/.test(planBlob);
  note('plan_no_raw40', noRaw40, noRaw40 ? 'clean' : 'exposed');
  note('plan_compliance_no_fortune', noFortune, noFortune ? 'clean' : 'hit');
  report.criteria.compliance = noRaw40 && noFortune ? 'PASS' : 'FAIL';

  // 5) projection skeleton + story with authoritative nearTerm from plan
  const planNear = nearTermFromPlanStory(story);
  note('plan_nearTerm', !!planNear?.today?.title && !!planNear?.week?.title, planNear ? (planNear.today.title + ' / ' + planNear.week.title) : 'missing');

  let projStory = null;
  let nearMatch = false;
  let nearSourceOk = false;
  try {
    // save journey lightly so projection has profile context
    await req('POST', '/api/account/journey', {
      token,
      body: { profile: persona, story },
      timeoutMs: 30000,
    }).catch(() => null);

    const gap = await req('POST', '/api/projection/gap', {
      token,
      body: { profile: persona },
      timeoutMs: 120000,
    });
    note('proj_gap', gap.status === 200 || gap.status === 201, 'status=' + gap.status + ' err=' + (gap.json?.error || ''));

    if (gap.json?.gap || gap.status === 200) {
      await req('POST', '/api/projection/gap/confirm', {
        token,
        body: { confirm: true, gapId: gap.json?.gap?.id || gap.json?.id },
        timeoutMs: 30000,
      }).catch(() => null);
    }

    const sk = await req('POST', '/api/projection/skeleton', {
      token,
      body: { profile: persona },
      timeoutMs: 180000,
    });
    note('proj_skeleton', sk.status === 200, 'status=' + sk.status + ' err=' + (sk.json?.error || '') + ' mode=' + (sk.json?.projection?.mode || ''));

    const t1 = Date.now();
    const gen = await req('POST', '/api/projection/story/generate', {
      token,
      body: {
        wait: true,
        force: true,
        profile: persona,
        planStory: story,
        authoritativeNearTerm: planNear,
      },
      timeoutMs: 360000,
    });
    const genMs = Date.now() - t1;
    projStory = gen.json?.story || null;
    const nt = projStory?.nearTerm || projStory?.draft?.nearTerm || null;
    const src = projStory?.nearTermSource || projStory?.draft?.nearTermSource || null;
    nearMatch = Boolean(
      planNear && nt?.today?.title === planNear.today.title && nt?.week?.title === planNear.week.title
      && nt?.today?.output === planNear.today.output && nt?.week?.output === planNear.week.output
    );
    nearSourceOk = src === 'plan' || src === 'authoritative';
    const projBlob = JSON.stringify(projStory || {});
    const projNoRaw = !/rawProjectionHorizon/.test(projBlob);
    note('proj_story_generate', gen.status === 200 || gen.status === 202, 'status=' + gen.status + ' ms=' + genMs + ' err=' + (gen.json?.error || ''));
    note('proj_nearTerm_match', nearMatch, nt ? (nt.today?.title + ' / ' + nt.week?.title) : 'missing');
    note('proj_nearTerm_source', nearSourceOk, String(src));
    note('proj_no_raw40', projNoRaw, projNoRaw ? 'clean' : 'exposed');
    report.projection = {
      status: gen.status, ms: genMs, nearTermSource: src, nearMatch,
      today: nt?.today?.title, week: nt?.week?.title,
      provider: projStory?.provider, model: projStory?.model,
      depthVersion: projStory?.depthVersion, chars: projStory?.chars,
      nodes: (projStory?.perNode || projStory?.nodes || []).length,
    };
    report.criteria.proj_same_depth = (gen.status === 200 || gen.status === 202) && nearMatch && nearSourceOk && projNoRaw ? 'PASS' : 'FAIL';
  } catch (e) {
    note('proj_flow', false, e.message);
    report.criteria.proj_same_depth = 'FAIL';
  }

  // Persist redacted plan sample (no keys)
  fs.writeFileSync(path.join(OUT, 'plan-live-sample.json'), JSON.stringify({
    narr, quads, provider: report.plan?.provider, model: report.plan?.model,
    chapters: (story?.chapters || []).map((c) => ({
      name: c.name, period: c.period, gate: c.gate,
      situation: c.situation, action: c.action, change: c.change, cost: c.cost,
      narrativePreview: String(c.narrative || '').slice(0, 400),
      quests: (c.quests || []).slice(0, 2).map((q) => ({ title: q.title, output: q.output })),
    })),
  }, null, 2));

  report.steps = steps;
  const must = ['stamp', 'ai_status', 'login_consent', 'plan_depth', 'compliance', 'proj_same_depth'];
  report.allPass = must.every((k) => report.criteria[k] === 'PASS');
  report.canAskProductRetest = report.allPass;
  fs.writeFileSync(path.join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ phase: 'done', allPass: report.allPass, criteria: report.criteria }, null, 2));
  process.exit(report.allPass ? 0 : 2);
}

main().catch((e) => {
  console.error('FATAL', e);
  fs.writeFileSync(path.join(OUT, 'smoke-report.json'), JSON.stringify({ fatal: String(e?.stack || e), steps }, null, 2));
  process.exit(1);
});
