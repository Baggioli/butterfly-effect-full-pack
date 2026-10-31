#!/usr/bin/env node
/**
 * Internal H1–H4 gate validation via Mac :18888 proxy (phone-like Origin).
 * Synthetic profiles only. Does not contact Micheal.
 */
import { writeFileSync, mkdirSync } from 'fs';

const BASE = (process.env.GATE_BASE || 'http://127.0.0.1:18888').replace(/\/$/, '');
const ORIGIN = process.env.GATE_ORIGIN || 'http://192.168.0.109:18888';
const OTP = '000000';
const out = {
  at: new Date().toISOString(),
  zone: 'Asia/Shanghai',
  base: BASE,
  origin: ORIGIN,
  gates: {},
  evidence: [],
  issues: [],
  runs: [],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', token, body, timeoutMs = 60000 } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: ORIGIN + '/',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  const t0 = Date.now();
  let status = 0, data = null, err = null, text = '';
  try {
    const r = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = r.status;
    text = await r.text();
    try { data = JSON.parse(text); } catch { data = { _raw: text.slice(0, 500) }; }
  } catch (e) {
    err = e.name || String(e);
  }
  const row = { path, method, status, ms: Date.now() - t0, err, code: data?.code, ok: data?.ok, error: data?.error };
  out.evidence.push(row);
  return { status, data, err, ms: row.ms };
}

function profile(tag) {
  return {
    name: '虚构测试' + tag,
    goal: '90天内做出一份可展示的数据分析作品集（虚构验收档）',
    role: '会计',
    age: 29,
    education: '本科',
    hours: 4,
    skills: 'Excel',
    constraints: '不能裸辞',
    experience: '5年总账（虚构）',
    resources: '旧电脑',
    interests: '表格',
    city: '杭州',
    longGoal: '向更少加班的分析岗靠近',
  };
}

function journeyOf(p, extra = {}) {
  return {
    id: 'gate-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    profile: p,
    week: 1,
    chapter: 0,
    tasks: [],
    versions: [],
    observations: [],
    results: [],
    notes: '',
    learn: false,
    questChecks: {},
    storyChoices: {},
    events: [],
    profileEvidence: {},
    profileInterpretations: [],
    lastConversationAt: new Date().toISOString(),
    contentVersion: 1,
    ...extra,
  };
}

async function loginFlow(phone) {
  const send = await api('/api/auth/send-code', {
    method: 'POST',
    body: { phone, agreedTerms: true, agreedPrivacy: true },
  });
  if (send.status !== 200) throw Error('send-code ' + send.status + ' ' + JSON.stringify(send.data));
  const verify = await api('/api/auth/verify-code', {
    method: 'POST',
    body: { phone, code: OTP },
  });
  if (verify.status !== 200 || !verify.data?.token) throw Error('verify ' + verify.status + ' ' + JSON.stringify(verify.data));
  const token = verify.data.token;
  const consent = await api('/api/auth/sensitive-consent', {
    method: 'POST',
    token,
    body: { agreed: true },
  });
  if (consent.status !== 200 || !consent.data?.sensitiveConsent) throw Error('consent ' + consent.status + ' ' + JSON.stringify(consent.data));
  return token;
}

async function saveJourney(token, journey) {
  const r = await api('/api/account/journey', { method: 'PUT', token, body: { journey } });
  if (r.status !== 200) throw Error('journey PUT ' + r.status + ' ' + JSON.stringify(r.data));
  return r;
}

async function getJourney(token) {
  return api('/api/account/journey', { method: 'GET', token });
}

async function plan(token, p, timeoutMs = 300000) {
  // /api/ai uses oai user from gateway; Bearer still forwarded as session for consistency
  return api('/api/ai', {
    method: 'POST',
    token,
    body: { mode: 'plan', profile: p },
    timeoutMs,
  });
}

function todayTask(story) {
  const q = story?.chapters?.[0]?.quests?.[0];
  return q ? { title: q.title, minutes: q.minutes, output: q.output } : null;
}

async function oneMainPath(label, phone) {
  const run = { label, phone, steps: {} };
  const token = await loginFlow(phone);
  run.steps.login = 'PASS';
  const p = profile(label);
  const j = journeyOf(p);
  await saveJourney(token, j);
  run.steps.建档 = 'PASS';
  const got = await getJourney(token);
  const roleOk = got.status === 200 && got.data?.journey?.profile?.name === p.name && got.data?.journey?.profile?.goal;
  run.steps.角色卡 = roleOk ? 'PASS' : 'FAIL';
  if (!roleOk) throw Error('role card missing after save');
  const pl = await plan(token, p, 300000);
  run.steps.planStatus = pl.status;
  run.steps.planMs = pl.ms;
  run.steps.planCode = pl.data?.code || pl.err || null;
  if (pl.status !== 200 || !pl.data?.story?.chapters?.length) {
    run.steps.展开故事 = 'FAIL';
    run.fail = pl.data || pl.err;
    out.runs.push(run);
    return { ok: false, run, token, journeyId: j.id, profile: p };
  }
  const story = pl.data.story;
  run.steps.展开故事 = 'PASS';
  run.steps.chapters = story.chapters.length;
  run.steps.today = todayTask(story);
  // Persist story onto journey (as UI would after accept)
  const j2 = { ...j, profile: { ...p, aiStory: story } };
  await saveJourney(token, j2);
  const got2 = await getJourney(token);
  const taskOk = Boolean(got2.data?.journey?.profile?.aiStory?.chapters?.[0]?.quests?.[0]?.title);
  run.steps.今日任务 = taskOk ? 'PASS' : 'FAIL';
  run.ok = taskOk && story.chapters.length === 4;
  out.runs.push(run);
  return { ok: run.ok, run, token, journeyId: j.id, profile: p, story };
}

async function main() {
  // Smoke: page + origin path
  const home = await api('/', { method: 'GET', timeoutMs: 10000 });
  out.evidence.push({ note: 'GET / via proxy', status: home.status });

  // H4 auth/origin quick checks
  const badOrigin = await fetch(BASE + '/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
    body: JSON.stringify({ phone: '13900000000', agreedTerms: true, agreedPrivacy: true }),
  });
  const badOriginStatus = badOrigin.status;
  out.evidence.push({ note: 'evil Origin send-code', status: badOriginStatus });

  // H1 run 1 & 2
  let h1a, h1b;
  try {
    h1a = await oneMainPath('A', '13800138011');
  } catch (e) {
    h1a = { ok: false, error: String(e) };
    out.runs.push({ label: 'A', fatal: String(e) });
  }
  try {
    h1b = await oneMainPath('B', '13800138012');
  } catch (e) {
    h1b = { ok: false, error: String(e) };
    out.runs.push({ label: 'B', fatal: String(e) });
  }

  const h1pass = Boolean(h1a?.ok && h1b?.ok);
  out.gates.H1 = {
    result: h1pass ? 'PASS' : 'FAIL',
    detail: 'login→consent→journey→plan→today task ×2',
    runA: h1a?.run || h1a,
    runB: h1b?.run || h1b,
  };

  // H2 from successful plans
  const planTimes = out.runs.filter((r) => r.steps?.展开故事 === 'PASS').map((r) => r.steps.planMs);
  const h2pass = planTimes.length >= 1 && planTimes.every((ms) => ms <= 300000);
  out.gates.H2 = {
    result: h2pass ? 'PASS' : 'FAIL',
    planTimesMs: planTimes,
    note: 'UI shows elapsed + 角色卡已保存; API has PLAN_BUSY retryable. Progress is elapsed-timer client-side (no server SSE).',
    within300s: h2pass,
  };

  // H3: journey survives failure, then retry plan succeeds
  let h3 = { result: 'FAIL' };
  try {
    const phone = '13800138013';
    const token = await loginFlow(phone);
    const p = profile('H3');
    const j = journeyOf(p);
    await saveJourney(token, j);

    // Force failure: start long plan, then concurrent plan → 429 from dgx-server generating lock
    const first = plan(token, p, 300000);
    await sleep(800);
    const concurrent = await plan(token, p, 30000);
    const failStatus = concurrent.status;
    const failCode = concurrent.data?.code || concurrent.data?.error || concurrent.err;

    const mid = await getJourney(token);
    const cardSurvived =
      mid.status === 200 &&
      mid.data?.journey?.profile?.name === p.name &&
      mid.data?.journey?.profile?.goal === p.goal;

    // Wait for first to finish (or fail), then retry
    const firstRes = await first;
    let retry = firstRes;
    if (firstRes.status !== 200 || !firstRes.data?.story?.chapters?.length) {
      // explicit「重新展开故事」
      retry = await plan(token, p, 300000);
    } else {
      // first eventually succeeded; still do one more clean retry after intentional 429 to prove recover path
      retry = await plan(token, { ...p, goal: p.goal + '·重试' }, 300000);
    }

    const retryOk = retry.status === 200 && retry.data?.story?.chapters?.length === 4;
    const after = await getJourney(token);
    // ensure journey still present (may or may not have aiStory yet)
    const stillThere = after.status === 200 && after.data?.journey?.profile?.name === p.name;

    h3 = {
      result: cardSurvived && stillThere && retryOk && (failStatus === 429 || failStatus === 503) ? 'PASS' : 'FAIL',
      concurrentFail: { status: failStatus, body: concurrent.data || concurrent.err },
      cardSurvived,
      firstStatus: firstRes.status,
      firstCode: firstRes.data?.code || firstRes.err,
      firstMs: firstRes.ms,
      retryStatus: retry.status,
      retryMs: retry.ms,
      retryChapters: retry.data?.story?.chapters?.length,
      stillThere,
      note: 'Concurrent plan expected 429 (gateway generating lock) or 503 PLAN_BUSY; role card must remain; retry must succeed.',
    };
    if (!(failStatus === 429 || failStatus === 503)) {
      h3.issues = ['Did not get 429/503 on concurrent plan; got ' + failStatus];
    }
    if (!cardSurvived) h3.issues = [...(h3.issues || []), 'Role card missing after failure'];
    if (!retryOk) h3.issues = [...(h3.issues || []), 'Retry plan did not succeed'];
  } catch (e) {
    h3 = { result: 'FAIL', error: String(e) };
  }
  out.gates.H3 = h3;

  // H4: no blocking auth on :18888 path; redline scan deferred to report (static)
  const mePhone = '13800138014';
  let h4auth = 'FAIL';
  try {
    const token = await loginFlow(mePhone);
    const me = await api('/api/auth/me', { token });
    h4auth = me.status === 200 && me.data?.ok ? 'PASS' : 'FAIL';
  } catch (e) {
    h4auth = 'FAIL:' + e;
  }
  out.gates.H4 = {
    result: home.status === 200 && h4auth === 'PASS' && badOriginStatus === 403 ? 'PASS' : 'FAIL',
    proxyHome: home.status,
    loginMe: h4auth,
    evilOriginBlocked: badOriginStatus,
    redlineNote: 'Static scan of public/*.js html: legal pages deny 命运预测/成功概率; UI uses 私人规划服务 not Ollama/DGX/算命. Full string scan in report.',
  };

  // Issues list seed
  if (!h1pass) out.issues.push({ pri: 'P0', id: 'H1', text: 'Main path did not pass twice', blocks: 'H1' });
  if (!h2pass) out.issues.push({ pri: 'P0', id: 'H2', text: 'Plan did not finish within 300s', blocks: 'H2' });
  if (h3.result !== 'PASS') out.issues.push({ pri: 'P0', id: 'H3', text: 'Failure recovery gate failed', blocks: 'H3', detail: h3 });
  if (out.gates.H4.result !== 'PASS') out.issues.push({ pri: 'P0', id: 'H4', text: 'Auth/origin/network blocking on :18888', blocks: 'H4' });

  const p0 = out.issues.filter((i) => i.pri === 'P0').length;
  out.gates.H5 = { result: p0 === 0 ? 'PASS' : 'FAIL', p0Count: p0, issues: out.issues };
  out.readyForPM可测 = p0 === 0 && h1pass && h2pass && h3.result === 'PASS' && out.gates.H4.result === 'PASS';

  mkdirSync('/tmp', { recursive: true });
  writeFileSync('/tmp/gate-h1-h4-result.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ready: out.readyForPM可测, H1: out.gates.H1.result, H2: out.gates.H2.result, H3: out.gates.H3.result, H4: out.gates.H4.result, H5: out.gates.H5.result, p0, planTimes }, null, 2));
  console.log('WROTE /tmp/gate-h1-h4-result.json');
}

main().catch((e) => {
  console.error('FATAL', e);
  writeFileSync('/tmp/gate-h1-h4-result.json', JSON.stringify({ fatal: String(e), out }, null, 2));
  process.exit(1);
});
