/**
 * P1-11 cold-start: paste a third-party AI "about me" profile (zero OAuth).
 * Parser is client-side; callers must never log the raw paste.
 */
export const STAMP = '1.4-p0-29';

export const MAIN_PROMPT = `请根据我们过往的对话，整理一份「关于我」的冷启动画像，供另一款人生规划/推演产品使用。
要求：
1) 只写你有依据的信息；不确定就写「未知」，不要编造。
2) 用下面固定小标题输出（每个标题下用短句或条目，中文）：
【基本】称呼偏好、年龄段、城市、职业/身份、家庭或重要关系（可知的）
【现状】正在做的事、资源与约束（时间/钱/健康/精力）
【目标】近 3–12 个月最想达成的 1–3 件事（尽量具体、可验证）
【卡点】反复出现的困难、容易放弃的触发点
【风格】做决定的习惯、喜欢怎样被提醒或拆任务
【忌讳】不希望被怎样评价或施压（若未知写未知）
3) 全文控制在 600–900 字；不要鸡汤，不要预测未来成败。
4) 末尾加一行：依据来自对话中的哪些主题（列 3–5 个关键词即可）。`;

const SECTIONS = ['基本', '现状', '目标', '卡点', '风格', '忌讳'];
const SECTION_RE = /【(基本|现状|目标|卡点|风格|忌讳)】/g;

const unknownish = (s) => !s || /^(未知|不确定|不知道|不愿透露|无|暂无|—|-|－)$/.test(String(s).trim());

/** Strip leading field labels like 「称呼偏好：」「职业/身份：」「偏好：」. */
const LABEL_HEAD = /^(?:称呼偏好|偏好称呼|希望称呼|称呼|叫我|年龄段|年龄|常住城市|常住|现居城市|现居|城市|职业\/身份|职业身份|职业|身份|岗位|工作|家庭或重要关系|重要关系|家庭|正在做的事|资源与约束|约束|目标|卡点|风格|忌讳|偏好|资源|每周可用|可用时间)[：:\/\s]+/i;

export function stripFieldLabel(s) {
  let out = String(s ?? '').trim();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(LABEL_HEAD, '').trim();
    if (next === out) break;
    out = next;
  }
  return out.replace(/^[「」""'\s]+|[」""'\s]+$/g, '').trim();
}

function splitSections(text) {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const hits = [...src.matchAll(SECTION_RE)];
  if (!hits.length) return { structured: false, sections: {} };
  const sections = {};
  for (let i = 0; i < hits.length; i++) {
    const key = hits[i][1];
    const start = hits[i].index + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length;
    sections[key] = src.slice(start, end).trim();
  }
  return { structured: true, sections };
}

function firstLineBits(block) {
  const raw = String(block || '').trim();
  if (!raw || unknownish(raw)) return [];
  return raw
    .split(/[\n；;]+/)
    .map((x) => stripFieldLabel(x.replace(/^[\s\-•·*、]+/, '')))
    .filter((x) => x && !unknownish(x));
}

function pickAge(text) {
  const m = String(text || '').match(/(\d{1,3})\s*岁/) || String(text || '').match(/年龄[段]?[：:\s]*(\d{1,3})/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 120) return String(n);
  }
  const band = String(text || '').match(/(2[0-9]|3[0-9]|4[0-9]|5[0-9])\s*[—\-~到至]\s*(2[0-9]|3[0-9]|4[0-9]|5[0-9])|([2-5]0)\s*多?[岁岁]?/);
  if (band) return band[0].replace(/\s/g, '');
  return '';
}

function pickCity(text) {
  const m = String(text || '').match(/(?:城市|常住|现居|在)[：:\s]*([\u4e00-\u9fa5]{2,8}?)(?:市|城区)?(?:[，,。；;\s]|$)/);
  if (m) return m[1].endsWith('市') ? m[1] : m[1];
  const known = String(text || '').match(/(北京|上海|广州|深圳|杭州|成都|重庆|武汉|西安|南京|苏州|天津|长沙|郑州|青岛|厦门|福州|东莞|佛山|珠海|合肥|济南|大连|宁波|无锡|昆明|贵阳|南宁|海口|兰州|太原|石家庄|沈阳|长春|哈尔滨|乌鲁木齐|呼和浩特|银川|西宁|拉萨)(?:市)?/);
  return known ? known[1] : '';
}

function pickName(text) {
  const src = String(text || '');
  const m = src.match(/(?:称呼偏好|偏好称呼|希望称呼|叫我|称呼)[：:\/\s]*([^\n，,。；;]{1,40})/);
  if (m && !unknownish(m[1])) return stripFieldLabel(m[1]).replace(/[「」""']/g, '').trim().slice(0, 40);
  return '';
}

function pickRole(text) {
  const src = String(text || '');
  const m = src.match(/(?:职业\/身份|职业身份|职业|岗位|工作|身份)[：:\/\s]*([^\n，,。；;]{2,60})/);
  if (m && !unknownish(m[1])) {
    const v = stripFieldLabel(m[1]);
    // Avoid capturing the second half of 「职业/身份：…」 as role when regex hit 身份 alone
    if (v && !/^(身份|职业|岗位)$/.test(v)) return v.slice(0, 80);
  }
  const bits = firstLineBits(text);
  return bits.find((b) => /(?:顾问|工程师|运营|设计|教师|医生|学生|自由|咨询|产品|研发|经理|创始|老板|销售)/.test(b))?.slice(0, 80) || bits.find((b) => !/称呼|年龄|城市|家庭|偏好/.test(b))?.slice(0, 80) || '';
}

function pickHours(text) {
  const m = String(text || '').match(/(?:每周|一周)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:个)?小时/) ||
    String(text || '').match(/(\d+(?:\.\d+)?)\s*(?:个)?小时\s*(?:\/|每)?\s*周/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0.5 && n <= 80 ? n : undefined;
}

/**
 * Map pasted text → profile fields + free note. Never throws.
 * @returns {{ ok: boolean, reason?: string, structured: boolean, profile: object, evidence: object, freeNote: string, covered: string[] }}
 */
export function parseImportPaste(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: 'empty', structured: false, profile: {}, evidence: {}, freeNote: '', covered: [] };
  if (text.length < 8 || !/[\u4e00-\u9fa5a-zA-Z]/.test(text)) {
    return { ok: false, reason: 'garbage', structured: false, profile: {}, evidence: {}, freeNote: '', covered: [] };
  }

  const { structured, sections } = splitSections(text);
  const profile = {};
  const evidence = {};
  const covered = [];
  const noteParts = [];

  const take = (key, value, sectionLabel) => {
    if (value === undefined || value === null || value === '') return;
    let v = typeof value === 'number' ? value : stripFieldLabel(value);
    if (typeof v === 'string' && unknownish(v)) return;
    profile[key] = v;
    evidence[key] = { value: v, evidence: `冷启动画像·${sectionLabel}`, source: 'import-paste' };
    if (!covered.includes(key)) covered.push(key);
  };

  if (structured) {
    const basic = sections['基本'] || '';
    const status = sections['现状'] || '';
    const goals = sections['目标'] || '';
    const stuck = sections['卡点'] || '';
    const style = sections['风格'] || '';
    const taboo = sections['忌讳'] || '';

    take('name', pickName(basic), '基本');
    take('age', pickAge(basic), '基本');
    take('city', pickCity(basic), '基本');
    take('role', pickRole(basic) || firstLineBits(basic).find((b) => !/称呼|年龄|城市|家庭/.test(b)), '基本');
    const family = firstLineBits(basic).find((b) => /家庭|孩子|伴侣|父母|关系/.test(b));
    if (family) take('family', family.slice(0, 200), '基本');

    const hours = pickHours(status);
    if (hours !== undefined) take('hours', hours, '现状');
    const statusBits = firstLineBits(status);
    const doing = statusBits.find((b) => /正在|目前|现在/.test(b)) || statusBits[0];
    if (doing) take('experience', doing.slice(0, 500), '现状');
    const resource = statusBits.find((b) => /资源|预算|设备|人脉/.test(b));
    if (resource) take('resources', resource.slice(0, 400), '现状');
    const constrainBits = statusBits.filter((b) => /约束|时间|钱|健康|精力|加班|预算/.test(b));
    if (constrainBits.length) take('constraints', constrainBits.join('；').slice(0, 800), '现状');

    const goalBits = firstLineBits(goals);
    if (goalBits.length) {
      take('goal', goalBits.slice(0, 3).join('；').slice(0, 500), '目标');
      take('dream', goalBits[0].slice(0, 300), '目标');
    }

    const stuckBits = firstLineBits(stuck);
    if (stuckBits.length) {
      take('obstacles', stuckBits.join('；').slice(0, 600), '卡点');
      const prev = profile.constraints ? profile.constraints + '；' : '';
      take('constraints', (prev + stuckBits.join('；')).slice(0, 800), '卡点');
    }

    const styleBits = firstLineBits(style);
    if (styleBits.length) {
      take('preference', styleBits.join('；').slice(0, 500), '风格');
      take('interests', styleBits[0].slice(0, 200), '风格');
    }

    const tabooClean = String(taboo || '').replace(/\n*依据来自[\s\S]*$/m, '').trim();
    const tabooBits = firstLineBits(tabooClean).filter((b) => !/^依据/.test(b));
    if (tabooBits.length && !unknownish(tabooBits.join(''))) {
      take('taboo', tabooBits.join('；').slice(0, 400), '忌讳');
      noteParts.push('忌讳：' + tabooBits.join('；').slice(0, 400));
    }

    for (const k of SECTIONS) {
      if (sections[k] && !unknownish(sections[k])) noteParts.push(`【${k}】\n${sections[k].slice(0, 400)}`);
    }
  } else {
    noteParts.push(text.slice(0, 1800));
    // Best-effort light extraction from free text
    take('goal', (text.match(/(?:目标|想达成|希望)[：:\s]*([^\n]{4,80})/) || [])[1], '自由备注');
    take('role', pickRole(text), '自由备注');
    take('city', pickCity(text), '自由备注');
    take('age', pickAge(text), '自由备注');
    take('name', pickName(text), '自由备注');
  }

  const freeNote = noteParts.join('\n\n').slice(0, 2400);
  if (freeNote) profile.importNotes = freeNote;

  // Always allow continuing if we have anything useful OR free note (structured miss → free note path)
  const hasCore = Boolean(profile.goal || profile.role || profile.constraints || profile.name || freeNote);
  if (!hasCore) return { ok: false, reason: 'unusable', structured, profile: {}, evidence: {}, freeNote: '', covered: [] };

  profile.kind = profile.kind || 'custom';
  if (profile.goal && !profile.dream) profile.dream = profile.goal;
  return { ok: true, structured, profile, evidence, freeNote, covered };
}

/** Analytics: never include paste body. */
export function trackColdstart(event, meta = {}) {
  try {
    const safe = { event, at: new Date().toISOString(), ...meta };
    delete safe.paste;
    delete safe.text;
    delete safe.raw;
    delete safe.body;
    const w = globalThis.window;
    if (w) {
      w.__bfColdstartEvents = w.__bfColdstartEvents || [];
      w.__bfColdstartEvents.push(safe);
    }
  } catch { /* ignore */ }
}

export function demoModeOn(search = globalThis.location?.search || '') {
  try {
    return new URLSearchParams(search).get('demo') === '1';
  } catch {
    return false;
  }
}

export default { STAMP, MAIN_PROMPT, parseImportPaste, trackColdstart, demoModeOn, stripFieldLabel };
