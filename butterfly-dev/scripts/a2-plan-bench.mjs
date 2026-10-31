#!/usr/bin/env node
/**
 * A2 bench: 20 real plan generations against a local/DGX API.
 * Usage: node scripts/a2-plan-bench.mjs --base http://127.0.0.1:PORT --password '...' --n 20
 * Results: reports/a2-plan-bench-<ts>.json  (synthetic profiles only)
 * Retries 429 (single-slot busy) so latency reflects real generation, not queue rejects.
 */
import { writeFileSync, mkdirSync } from 'fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a,x,i,arr)=> (x.startsWith('--')? [...a,[x.slice(2), arr[i+1]]] : a), []));
const base = (args.base || 'http://127.0.0.1:18887').replace(/\/$/, '');
const n = Number(args.n || 20);
const password = args.password || process.env.DGX_APP_PASSWORD || '';
const profiles = [
  { goal: '90天内转行做数据分析助理', role: '会计', age: 28, education: '本科', hours: 5, skills: 'Excel', constraints: '不能裸辞', experience: '5年总账', resources: '无', interests: '表格', recentUpdate: '在看网课' },
  { goal: '半年内拿下软考中级', role: '运维', age: 32, education: '大专', hours: 4, skills: 'Linux', constraints: '孩子要接送', experience: '一线运维', resources: '旧教材', interests: '考证', recentUpdate: '刚报了名' },
  { goal: '三个月做出能接单的摄影作品集', role: '设计师', age: 26, education: '本科', hours: 6, skills: 'Ps', constraints: '预算有限', experience: '平面设计', resources: '相机', interests: '人像', recentUpdate: '接了一次小单' },
  { goal: '90天找到少加班的工作', role: '会计', age: 45, education: '本科', hours: 0.5, skills: '报表', constraints: '不能开视频会', experience: '15年财务', resources: '同行微信', interests: '稳定', recentUpdate: '同行暂未回复' },
];
const auth = password ? { Authorization: 'Basic ' + Buffer.from('owner:' + password).toString('base64') } : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const times = []; const rows = [];
let ok = 0;
for (let i = 0; i < n; i++) {
  const profile = profiles[i % profiles.length];
  const t0 = Date.now();
  let status = 0, body = null, err = null, code = null, retries429 = 0;
  try {
    for (;;) {
      const r = await fetch(base + '/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...auth },
        body: JSON.stringify({ mode: 'plan', profile }), signal: AbortSignal.timeout(300000)
      });
      status = r.status; body = await r.json().catch(() => ({}));
      if (status === 429 && retries429 < 180) { retries429++; await sleep(2000); continue; }
      if (!r.ok) { code = body.code || body.error || 'http_' + status; }
      else if (!body.story?.chapters?.length) { code = 'PLAN_EMPTY'; }
      else { ok++; code = null; }
      break;
    }
  } catch (e) { err = e.name || String(e); code = e.name === 'TimeoutError' ? 'PLAN_TIMEOUT' : 'PLAN_NETWORK'; }
  const ms = Date.now() - t0; times.push(ms);
  rows.push({ i: i + 1, ms, status, code, err, retries429, goal: profile.goal.slice(0, 24) });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
times.sort((a, b) => a - b);
const pct = p => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))] || null;
const out = {
  kind: 'A2-real-plan-bench', syntheticProfiles: true, notHumanAcceptance: true,
  base, n, success: ok, successRate: ok / n,
  p50_ms: pct(50), p90_ms: pct(90), failCodes: rows.filter(r => r.code).reduce((m, r) => (m[r.code] = (m[r.code] || 0) + 1, m), {}),
  rows, at: new Date().toISOString()
};
mkdirSync('reports', { recursive: true });
const path = `reports/a2-plan-bench-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(out, null, 2));
writeFileSync('reports/a2-dgx-results.json', JSON.stringify(out, null, 2));
console.log('WROTE', path, 'successRate', out.successRate, 'p50', out.p50_ms, 'p90', out.p90_ms);
