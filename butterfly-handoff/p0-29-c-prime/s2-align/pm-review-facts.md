# P0-29 S2-align · 产品核事实摘录（无 PASS/FAIL）

> 来源目录：`/workspace/butterfly-handoff/p0-29-c-prime/s2-align/`  
> 先验（v1.26.50 / S2 PRODUCT-VERDICT）：硬条⑤形态过、② plan 四元过；热更暂缓，待 (1) 近端今天/本周以 plan 为权威字面同源；(2) 用户可见 plan/proj JSON 不暴露 `rawProjectionHorizon`（hi=40 仅允许 internal）。  
> 本文件只记可核对事实，不做过关判定。

---

## 1. File list

| 文件 | 字节 | 备注 |
|------|------|------|
| `PRODUCT-NOTES.md` | 1407 | 热更前极小对齐交核说明 |
| `README.md` | 213 | 复现：`node scripts/p0-29-s2-align.mjs` |
| `plan-deepseek-s2.json` | 27110 | DeepSeek plan |
| `projection-deepseek-s2.json` | 16419 | DeepSeek projection（声称 nearTerm←plan） |
| `self-check.json` | 14811 | 自检 + persona + ruleFacts + `internal` |
| `sidebyside-summary.md` | 33227 | 并排摘要 |

共 6 个文件（不含本 `pm-review-facts.md`）。对照目录 `../s2-isomorphic/` 仍在，供差分。

---

## 2. PRODUCT-NOTES / self-check 声称（原文级）

### PRODUCT-NOTES.md

- 分支：`feat/p0-29-c-prime-32b`（文称「本刀本地 commit，未 push / 未 merge main / 未热更 A2」）
- **未写 tip hash**（交核话术中的 `030a407` **不在本目录任何文件**）
- **未写**现网戳 `1.4-p0-28`（亦不在本目录）
- 契约：`p0-29-s2-isomorphic-v1` · 对齐 `p0-29-s2-align-v1`
- 时间戳原文：`2026-10-31T02:54:46.405Z` → **Asia/Shanghai 2026-10-31 10:54:46**
- 对齐点声称：① 推演 `nearTerm` 复用 plan 第一章今天/本周（`nearTermSource=plan`），标题+产出字面一致；② 用户可见 plan/proj **不含** `rawProjectionHorizon`，行动线 raw 仅在 `self-check.json → internal`
- 自检表声称：② 4/4；⑤ 同 provider / proj≤13 / 近端双侧；④ titles=true outputs=true source=true；用户可见无 raw40；① narr=1966；**可否再交产品核议热更 = YES**
- 边界句：不热更、不 merge、不开 B、不动周边 UI、不催 Micheal、secrets 不进 git

### self-check.json（关键）

- `at`: `2026-10-31T02:54:46.405Z`
- `contractVersion` = `alignVersion` 侧：`p0-29-s2-isomorphic-v1` / `p0-29-s2-align-v1`
- `ruleFacts.deadlineWeeks=13`，`deadlineDays=90`；阶段 0–2 / 2–6 / 6–13 / 10–13
- persona 与 S2 同档：虚构便利店试单甲；约束「不辞职，不购买课程，不编造收入与客户」
- `hard`（开发自检布尔，非产品结论）：`pass5/pass2/pass4_align/pass_raw_strip/readyForProductReview` 均为 true；`planNarr=1966`；`projMaxHi=13`；`ruleDeadlineWeeks=13`
- `internal`（见 §5）：**不是**键名 `rawProjectionHorizon`，而是 `actionLineHorizonRaw: {lo:19, hi:40}`，附注「行动线算法 raw horizon，非用户可见产物」

### README.md

- 复现命令指向 `scripts/p0-29-s2-align.mjs`；输出即本目录

---

## 3. 热更阻断项核验（本刀焦点）

### 3.1 近端同源（blocker #1）

| 字段 | plan (`weekFirst`) | proj (`nearTerm`) | `==`（字节级 `==`） |
|------|--------------------|-------------------|---------------------|
| 今天·标题 | `今天：用虚构便利店样表做出一张可截图的四列表` | `today.title` 同上 | **true**（len=22） |
| 今天·产出 | `一份自编虚构数据的xlsx与一张截图；验收标准：四列列名齐全、恰好10行数据、有一次求和结果可见、截图内有“虚构数据”字样。` | `today.output` 同上 | **true**（len=62） |
| 本周·标题 | `本周：把样本整理成一页展示稿并保存` | `week.title` 同上 | **true**（len=17） |
| 本周·产出 | `一个“试单准备”文件夹，内含展示版xlsx与整页截图；验收标准：列名四列齐全、10行数据、文件名含“虚构数据样本”、截图能看清表头与求和结果。` | `week.output` 同上 | **true**（len=71） |

- `proj.nearTermSource` = **`"plan"`**（字面）
- 对照 S2（`../s2-isomorphic/`）：当时 plan 今天=`今天：用虚构样表做一次3行清理`，proj 今天=`今天：列出3个可自动化的Excel痛点并选定试单方向`，**标题双侧不等**；且旧包 **无** `nearTermSource` 字段
- 附注：proj `nearTerm.*.minutes`（40 / 35）为推演侧附加字段，plan `weekFirst` 无对应键；**不进入**标题/产出字面比对

**事实结论（blocker #1）**：标题+产出四元组字节相同，且 `nearTermSource=plan` → **cleared: yes**

### 3.2 用户可见无 `rawProjectionHorizon`（blocker #2）

| 位置 | 键名 `rawProjectionHorizon` | 其它 hi=40 / raw |
|------|-----------------------------|------------------|
| `plan-deepseek-s2.json` | **无**（全文检索 0） | 无 `"hi": 40` / 无「40周」 |
| `projection-deepseek-s2.json` | **无**（全文检索 0） | 仅有 `ruleHorizonWeeks=13`；无 actionLineHorizonRaw |
| `self-check.json` | **无此键名** | `internal.actionLineHorizonRaw = {lo:19, hi:40}` |
| 对照 S2 proj | 曾有 `$.rawProjectionHorizon = {lo:19, hi:40}` | 本刀已从用户可见 proj 移除 |

- PRODUCT-NOTES 写「`self-check.json → internal`」存 raw —— **路径方向对**，但实际键名是 **`actionLineHorizonRaw`**，不是文称的 `rawProjectionHorizon`
- `sidebyside-summary.md` / PRODUCT-NOTES 正文仍**文字提及** raw40 / rawProjectionHorizon（说明性 markdown，非用户可见 JSON 产物）

**事实结论（blocker #2）**：用户可见 plan/proj JSON 无 `rawProjectionHorizon` 键 → **cleared: yes**（hi=40 仅见 `self-check.json → internal.actionLineHorizonRaw.hi`）

---

## 4. 仍保持的形态事实（⑤/②/①/周界）

### 4.1 Provider / model / contract

| | plan | projection |
|--|------|------------|
| provider 字符串 | `DeepSeek API` | `deepseek` |
| model | `deepseek-chat` | `deepseek-chat` |
| providerKind | — | `online` |
| depthVersion | `p0-29-s2-isomorphic-v1`（story） | `p0-29-s2-isomorphic-v1` |
| invoke/via | `invokeMeta.via=deepseek` | — |

- 同 model 字面 `deepseek-chat`；provider 标签仍为 `DeepSeek API` vs `deepseek`（与 S2 相同口径，self-check 记 `5_same_provider=true`）
- 同契约 `p0-29-s2-isomorphic-v1`；另加 align 标记 `p0-29-s2-align-v1`（仅 self-check / 摘要）

### 4.2 Plan 四元（4/4）

- `quadExplicit=true`（顶层与 story）
- 4 章均有非空 `situation/action/change/cost`
- 每章 `narrative` **精确等于**（无换行拼接）  
  `【处境】{situation}【行动】{action}【变化】{change}【代价】{cost}`  
  → 四标签均在 narrative 内可检索
- quests：ch0=2（今天+本周），ch1–3 各 1；合计 5 个可执行任务

### 4.3 叙事汉字数（独立复算）

- 文件字段 `narr` / self-check `planNarr` = **1966**
- **独立复算**：4×`chapters[].narrative` 内 Unicode 中日韩统一表意文字 `[\u4e00-\u9fff]` 合计 = **1966**  
  - ch0: 452；ch1: 535；ch2: 475；ch3: 504
- 口径与 S2 核事实一致（只计 narrative 汉字；不计独立四字段、gate、quests）
- 相对 S2 的 1634：**+332**（新鲜 DeepSeek 重跑，非同一 narr 文本）
- 阈值：`1966 ≥ 1500`

### 4.4 叙事周界 ≤13

- plan `period`：`第0—2周` / `第2—6周` / `第6—13周` / `第10—13周` → period 数字 max=**13**
- proj `perNode` tRange：`(1–2)(2–6)(6–13)(10–13)` → **maxHi=13**；`ruleHorizonWeeks=13`
- 与 ruleFacts 四段脊柱对齐；节点数 4

### 4.5 热更 / merge 声称

- 包内仅 PRODUCT-NOTES 边界叙述「未热更 / 未 merge」；JSON **无** hotUpdate/merge 字段
- **无**「已热更」「已上线」「已 merge main」类肯定句

---

## 5. `internal` raw 路径（精确）

```
self-check.json
  └─ internal
       ├─ note: "行动线算法 raw horizon，非用户可见产物"
       └─ actionLineHorizonRaw: { "lo": 19, "hi": 40 }
```

- 键名：**`actionLineHorizonRaw`**（非 `rawProjectionHorizon`）
- 数值与 S2 用户可见残留相同量级（lo=19, hi=40）

---

## 6. 相对 S2 的差分 / 回归扫描（简）

| 项 | S2 | S2-align | 备注 |
|----|----|----------|------|
| 近端标题/产出双侧 | 不一致 | 字节一致 + `nearTermSource=plan` | 对准 blocker #1 |
| proj `rawProjectionHorizon` | 有 `{lo:19,hi:40}` | **已删除** | 对准 blocker #2 |
| model / contract / 4 段≤13 | 同 | 同 | 形态保持 |
| plan narr 汉字 | 1634 | 1966 | 新鲜重跑，文本整体更换 |
| `____` 占位（plan+proj 扁平文本） | 28 | **37** | 模板感加重（quests steps/example） |
| 「脚本」 | 1 | 1 | 仍在 proj `d_build.action`：「录制和简单脚本」 |
| 「录制」 | 0 | 4 | plan 侧新增屏幕录制 quest（ch1） |
| 「买课」 | 5（多为「不买课」） | 6（多为「不买课」） | 约束肯定，非推销买课 |
| 路径策略：熟人 | plan 主张「不靠熟人」；proj 曾有张力 | **仍在**：plan 第三幕名「在不靠熟人的情况下找需求证据」；proj `d_verify.action` 写「线上社区和**熟人圈**里…主动留言询问」 | 规划/推演获客路径打架未消 |
| proj `d_build` | — | `source=mixed`；attempts 两次均 `rejected: situation:cn_number`，**无** ok=true 的 build 尝试 | 该节点非纯 llm 过检 |

未发现新的「购买课程」推销句；「买课」出现均为「不买课 / 不购买课程」约束语境。

---

## 7. 其它可观察事实（热更决策参考，非本刀阻断清单）

1. **proj attempts**：`d_near` 第 1 次因 `cost:cn_count` 拒、第 2 次 ok；`d_build` 连续 2 次 `situation:cn_number` 拒后落入 `mixed`；`d_mid`/`d_verify` 一次过。`proj.source=mixed`。
2. **短篇感**：narrative = 四标签块无换行拼接；quests 大量 `____`（文件名/价格/时间/复盘模板）→ 清单感仍强（S2 已记，本刀计数升至 37）。
3. **档案张力**：persona「没有编程经验」vs proj build「录制和简单脚本」；plan 用「免费教程 / 不买课」绕开，proj 未同步「不买课」措辞。
4. **戳 / tip**：包内无现网戳、无 tip hash；开发交核话术声称 tip `030a407`、戳仍 `1.4-p0-28` —— **无法从本目录证伪或证实**（`/workspace` 交核树非 git 仓，本核未另查仓）。
5. **Micheal 五维**：本包无人工分材料。

---

## 8. 关键数字速查

| 指标 | 值 |
|------|-----|
| plan narr 汉字（复算） | 1966 |
| plan 幕数 / 四元显式 | 4 / 4 |
| proj 节点 / maxHi | 4 / 13 |
| ruleDeadlineWeeks | 13 |
| model（双侧） | deepseek-chat |
| depthVersion | p0-29-s2-isomorphic-v1 |
| nearTermSource | plan |
| 近端标题+产出字节一致 | 4/4 true |
| 用户可见 rawProjectionHorizon | 0 |
| internal hi | 40（`actionLineHorizonRaw`） |
| `____` 计数（扁平） | 37 |
| plan ms / proj ms | 26429 / 23637 |

---

*核验时间：Asia/Shanghai 2026-10-31（本 executor 读盘核验）。*
