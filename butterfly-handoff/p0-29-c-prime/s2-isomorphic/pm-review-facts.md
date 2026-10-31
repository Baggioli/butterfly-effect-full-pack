# P0-29 S2 同构包 · 产品核事实摘录（无 PASS/FAIL）

> 来源目录：`/workspace/butterfly-handoff/p0-29-c-prime/s2-isomorphic/`  
> 对照 backlog：`/workspace/butterfly-pm/蝴蝶效应-可投放定义与Backlog-v1.md`（P0-29 行 + S1）  
> 先验上下文（v1.26.49）：⑤ 未过（plan≠projection 同深）；② 半过（缺每节点强制处境·行动·变化·代价）。S2 声称修补上述两项。  
> 本文件只记可核对事实，不做过关判定。

---

## 1. File list

| 文件 | 字节（约） | 备注 |
|------|-----------|------|
| `PRODUCT-NOTES.md` | 1070 | 增量交核说明 |
| `README.md` | 217 | 复现命令 |
| `plan-deepseek-s2.json` | 22869 | DeepSeek plan 主样例 |
| `projection-deepseek-s2.json` | 17312 | DeepSeek projection 主样例 |
| `self-check.json` | 14270 | 自动化自检 + persona + ruleFacts |
| `sidebyside-summary.md` | 30061 | 并排可读摘要（含自检 JSON 摘录） |

共 6 个文件（不含本 `pm-review-facts.md`）。

---

## 2. PRODUCT-NOTES / self-check.json 声称

### PRODUCT-NOTES.md

- 分支：`feat/p0-29-c-prime-32b`
- tip：`8d102ab`（文称「本刀 tip」；**本核未在本机 git 仓核对 tip**——`/workspace` 非 git 仓）
- **未 push / 未 merge main / 未热更 A2**
- 契约：`p0-29-s2-isomorphic-v1`
- 时间戳原文：`2026-10-31T02:47:21.936Z` → **Asia/Shanghai 2026-10-31 10:47:21**
- 主样例：同次新鲜 DeepSeek plan + DeepSeek projection
- 不开 B；故事层 `withDepthStoryProj` 同构 4 段脊柱；周界 ≤ ruleFacts（本档案 13 周）
- 自检表声称：硬条② plan 四元 4/4 PASS；⑤ 同 provider true；proj≤规则周界 true（maxHi=13/13）；近端双侧 true；proj 四元 true；① narr≥1500 true（1634）；**可否再交产品核 = YES**
- 边界：不热更、不 merge、不开 B、不动周边 UI、不催 Micheal、secrets 不进 git
- **未写**现网戳 `1.4-p0-28`（该戳仅见于开发交核话术，不在本目录文件内）

### self-check.json（关键字段）

- `contractVersion` / `ruleFacts.version` / plan `depthVersion` / proj `depthVersion`：**均为** `p0-29-s2-isomorphic-v1`
- persona：虚构便利店试单甲；22；高中/中专；便利店店员；无编程、刚学 Excel；预算 0；每周 4h；目标「90天内完成一个Excel表格自动化服务的付费试单」；约束「不辞职，不购买课程，不编造收入与客户」
- `ruleFacts.deadlineDays=90`，`deadlineWeeks=13`；4 阶段 week 边界：0–2 / 2–6 / 6–13 / 10–13
- plan：`provider=DeepSeek API`，`model=deepseek-chat`，`narr=1634`，`quadExplicit=true`，`status=200`，`ms=23119`
- projection：`provider=deepseek`，`providerKind=online`，`model=deepseek-chat`，`chars=2520`，`validation=true`，`depth=true`，`depthSpine=true`，`ruleHorizonWeeks=13`，`rawProjectionHorizon={lo:19,hi:40}`，`ms=23228`
- `hard.readyForProductReview`: **true**
- `hard.pass5` / `hard.pass2`: 均为 true（开发自检结论，非产品结论）
- `hard.5_same_provider`: true（对照字符串：`DeepSeek API` vs `deepseek`）
- 热更相关：本 JSON **无** hotUpdate / merge 字段；热更否定仅见 PRODUCT-NOTES / README 边界叙述

### README.md

- 复现：`BUTTERFLY_LLM_ENV_FILE=... node scripts/p0-29-s2-isomorphic.mjs`
- 输出目录即本目录

---

## 3. Hard bar criteria quotes（原文）

### P0-29 首包验收（Backlog 表行，①–⑥）

摘自 `蝴蝶效应-可投放定义与Backlog-v1.md` P0-29 状态列：

> 首包验收：①确认档案后主路径可见 **≥1500 字**连贯叙事（可分幕折叠），读感像短篇非条目表；②全轨迹按阶段/周期覆盖至用户中期目标；每节点强制 **处境·行动·变化·代价** + ≥1 可执行任务（时限/交付物/验收）；③含具名或可查动作细节；数字只来自规则层；④用户 5 分钟内能复述「本周第一步做什么、做到什么算过」；⑤「规划你的下一步」与推演页为**同一深度产物**（或异步补齐且主路径可见长文），禁止只出薄草案；⑥同卡重复结构稳；DGX 不够则接线上更强模（他可开权限）；法务「模拟非承诺」仍守。

同文件变更头 v1.26.49 对首包的先验诊断（供对照，非本刀结论）：

> 硬条①④⑥主路径可过；②半过（散文内嵌变化/代价，缺每节点强制处境·行动·变化·代价同构字段/标签，S1 未满）；**⑤未过**（规划=DeepSeek 4幕≤13周+近端quest，推演=32b reuse 6节点至~40周、无对等今天本周卡，非同一深度产物）。

### S1（验收清单）

> - [ ] S1 详细故事字数 ≥1500（可折叠），且每计划线节点含处境/行动/变化/代价四要素

---

## 4. Plan（`plan-deepseek-s2.json`）

### 4.1 叙事汉字数与计数口径

- 文件字段 `narr` / self-check `planNarr` = **1634**
- **独立复算**：4 个 chapter 的 `narrative` 字段中文汉字合计 = **1634**
  - ch0: 430；ch1: 396；ch2: 415；ch3: 393
- **计入**：仅 `chapters[].narrative`（含文内【处境】【行动】【变化】【代价】标签汉字）
- **未计入** `narr`：`title`(23)、`baseline`(179)、各章独立字段 `situation/action/change/cost`（四字段汉字合计 **1602**）、`gate`、`quests` 正文
- 结构事实：每章 `narrative` **精确等于**  
  `【处境】{situation}\n【行动】{action}\n【变化】{change}\n【代价】{cost}`  
  （标签汉字使 narr 比「纯四字段合计」多 32：4 章 × 4 标签名各 2 字）

### 4.2 每章四元

| 章 | period | name | 字段 situation/action/change/cost | 叙事内【处境】【行动】【变化】【代价】 |
|----|--------|------|-----------------------------------|----------------------------------------|
| 0 | 第0—2周（近期） | 今天：把一张虚构样表跑通 | 四字段均有（cn 109/118/100/95） | 四标签均有 |
| 1 | 第2—6周（能力与证据积累） | 用一张可展示的样表做需求证据 | 四字段均有（95/126/99/68） | 四标签均有 |
| 2 | 第6—13周（中期目标验证前夜） | 不靠熟人，去问一句真实需求 | 四字段均有（106/119/96/86） | 四标签均有 |
| 3 | 第10—13周（阶段目标验证，不越界） | 若有人愿意看，就把下一步做成可交付的小样 | 四字段均有（95/122/83/85） | 四标签均有 |

**Chapter 0 摘录（各字段首句级短摘）：**

- **situation**：`虚构便利店试单甲22岁，高中/中专毕业，在便利店上早晚轮班，下班后只剩零碎时间。…预算为0，也不打算辞职或买课。`
- **action**：`第一天夜里，他在自己电脑上新建一个文件，取名____（自拟），只做减法：编三列虚构数据——日期、营业额、备注，写下3行。…不打开教程网站，不买课，只面对自己的表。`
- **change**：`做完后，他第一次看到“自动化”不是遥远的技术词，而是自己表格里某个每天要重复的动作。…而不是继续泛泛看视频。`
- **cost**：`代价是下班后的疲惫和怀疑：只有3行数据，离“付费试单”看起来很远；…并接受可能做不出可交付服务、需要调整方向的条件性风险。`

### 4.3 今天 / 本周 quests（近端）

来自 ch0 `quests` + 顶层 `weekFirst`（标题一致）：

| 槽位 | title | minutes | deliverable / 验收（摘要） |
|------|-------|---------|---------------------------|
| 今天 | 今天：用虚构样表做一次3行清理 | **25** | Excel：3 行虚构数据 + 1 列重复劳动记录 + 1 张排序截图；验收：能打开、3 行齐全、记录列有 1 条具体文字 |
| 本周 | 本周：给虚构样表加一个可数的自动动作 | **30** | 含 1 个求和公式 + 1 条待确认问题；验收：公式可复算、待确认问题成句 |

后续章另有本周型任务（非「今天」）：ch1 前后对照 40min；ch2 公开需求询问 40min；ch3 小样说明或改写询问 45min。每章均有 ≥1 quest，含 steps / output / minutes。

### 4.4 Stage horizon vs ruleFacts

- ruleFacts `deadlineWeeks=13`
- 四幕 period 出现数字：0,2 / 2,6 / 6,13 / 10,13 → **最大数字 13**，与 `planPeriodMaxDigit=13` 一致
- 阶段与 ruleFacts.stages 标签对齐（近期 / 能力与证据积累 / 中期目标验证前夜 / 阶段目标验证）；末两幕 week 区间重叠（6–13 与 10–13）

### 4.5 Template markers

- 全 plan JSON 中 `____` 子串出现 **28** 次（多在 quests steps/example 与 action 文件名占位）
- 四章 `branches` **完全相同**（1 组唯一分支模板复用于 4 章）：
  - 「获得支持性反馈」→「保留证据，由你确认推进。」
  - 「执行了，效果不理想」→「检验路径与方法。」
  - 「时间或条件变了」→「先调整节奏，再审核路线。」
- `scene` 四幕不同：起点小屋 / 交流街角 / 创作工坊 / 远方花园

---

## 5. Projection（`projection-deepseek-s2.json`）

### 5.1 Provider / model vs plan

| | Plan | Projection |
|--|------|------------|
| provider 字符串 | `DeepSeek API` | `deepseek` |
| model | `deepseek-chat` | `deepseek-chat` |
| via / kind | invokeMeta.via=`deepseek` | providerKind=`online`，attempts.via=`online` |

同 model；provider 字面不同，自检仍标 `5_same_provider=true`。

### 5.2 Contract id

- `depthVersion` = `p0-29-s2-isomorphic-v1`（与 plan `story.depthVersion` / self-check `contractVersion` 相同）

### 5.3 Structure

- **节点**：`perNode` **4** 条（`d_near` / `d_build` / `d_mid` / `d_verify`）；无独立 `chapters` 数组
- **显式四元**：每节点均有 `situation` / `action` / `change` / `cost` 字段（无【】标签；longForm 用「处境：」「行动：」等冒号体例）
- **每节点可执行任务**：`perNode` **无** quests/tasks 字段；近端任务仅在顶层 `nearTerm.today|week`
- `longForm`：完整拼接叙事；中文汉字 **2255**；去空白字符长度 **2520**（= 字段 `chars`）
- `validation=true`；`depthSpine=true`
- attempts：d_build 第 1 次因 `cost:cn_count` 拒绝后第 2 次成功；其余节点 1 次成功

### 5.4 Time horizon vs ruleFacts 13

- 各节点 `tRange`：`{1,2}` / `{2,6}` / `{6,13}` / `{10,13}` → **maxHi = 13** ≤ `ruleHorizonWeeks=13`
- 仍保留 **`rawProjectionHorizon: {lo:19, hi:40}`**；sidebyside 注明「未用于叙事」——即深度脊柱已夹到 13，但底层行动线原始周界痕迹仍在产物里

### 5.5 今天 / 本周近端卡

**存在**，但与 plan 内容不同：

| 槽位 | title | minutes | output 摘要 |
|------|-------|---------|-------------|
| 今天 | 今天：列出3个可自动化的Excel痛点并选定试单方向 | **20** | 纸/备忘录写 3 条痛点（谁在做/多久/耗时）并圈定 1 条方向 |
| 本周 | 本周：用模拟数据做出该方向的Excel自动化小样并自测 | **30** | Excel+操作说明，自测跑通 2 次，记 1 条待改进 |

### 5.6 主叙事汉字

- `longForm` 中文汉字：**2255**
- 字段 `chars`：**2520**（= longForm 去空白后长度，**不是**纯汉字数）
- 四节点四元字段汉字合计：**1964**（不含 longForm 前后说明段）

---

## 6. Same-depth comparison table

| 维度 | Plan | Projection | 观察 |
|------|------|------------|------|
| Provider 字面 | DeepSeek API | deepseek | 同厂商/同 model；字面不等 |
| Model | deepseek-chat | deepseek-chat | 同 |
| Contract | p0-29-s2-isomorphic-v1 | 同 | 同 |
| 结构粒度 | 4 chapters + 每章 quests | 4 perNode + 顶层 nearTerm only | 幕数同；任务挂载位置不同 |
| Horizon（叙事用） | period 最大 13 | maxHi 13 | 同夹到 13 |
| Horizon（原始残留） | 无 raw 字段 | raw lo=19 hi=**40** | 残留仍可见 |
| 近端今天/本周 | 有（虚构样表 3 行清理 / 求和公式） | 有（列 3 痛点 / 模拟小样自测） | **形态同、内容不同** |
| 四元形态 | 字段 + 【】标签（narrative=标签拼接） | 字段；longForm 用「处境：」体 | 双侧有显式四元 |
| 字数 | narr 汉字 1634 | longForm 汉字 2255 / chars 2520 | 双侧均 ≥1500 汉字量级 |
| 空白模板 | `____` ×28 | 0 | plan 重模板占位 |
| 分支 | 4 章完全同文 | 无 branches | plan 分支未分化 |

---

## 7. Gaps vs claims（事实层）

1. **reuse / 原始周界残留**：叙事脊柱 maxHi=13，但产物仍携带 `rawProjectionHorizon.hi=40`（与 S1 先验「推演至~40周」同源数量级）；sidebyside 自承「未用于叙事」。
2. **「同深度产物」内容层**：双侧同 provider 族、同契约、同 4 段、同 ≤13 周、同有今天/本周卡；但 **今天/本周任务文案不一致**（plan=虚构样表清理；proj=列痛点选型），中后期路径亦分歧（plan 强调「不靠熟人 / 公开询问」；proj 行动写「帮熟人整理」「在熟人、同事…之间留意」）。
3. **硬条② 任务挂载不对称**：plan 每章有 ≥1 可执行 quest（时限/交付/验收）；projection **节点级无任务**，仅全局 nearTerm 两卡——相对「每节点 … + ≥1 可执行任务」字面，推演侧未按节点挂齐。
4. **四元「显式」方式**：plan 为字段 + 标签复制进 narrative（短篇读感上接近四段标签清单，而非无标签散文）；projection longForm 亦按「处境/行动/变化/代价」分段。
5. **合规词扫描（上下文均为否定/边界，未见正向「预测/保证成功」承诺）**：
   - 「预测」：0
   - 「保证成功」：仅出现在「**不**保证成功」
   - 「保证成交 / 必然成功」：出现在「不把计划写成…」类否定句
   - 「买课 / 购买课程 / 编造客户 / 编造收入」：均在约束复述或「不买课 / 不编造…」语境
6. **约束张力（非直接违反「去买课/编造客户」，但与档案摩擦）**：
   - persona「没有编程经验」 vs proj 近段行动「试着用公式和**简单脚本**把它简化」
   - 约束「不购买课程」 vs proj「先照着**教程**把常用函数逐个敲一遍」（免费教程 vs 买课边界未在文中厘清）
   - plan「不靠熟人」路径 vs proj 多处「熟人」获客/练习场景
7. **模板感**：plan 28 处 `____`；四章 branches 逐字相同——与硬条⑥「同卡重复结构稳」可并存，但削弱「详细可信」读感。
8. **自检 vs 字面 provider**：`5_same_provider=true` 建立在 `DeepSeek API`≈`deepseek` 的归一，而非字符串相等。
9. **tip 可核性**：材料声称 tip `8d102ab`；本执行环境未检出对应 git 仓，**无法在此复验 commit**。

---

## 8. 对 Micheal「详细可信可落地」仍偏弱的点（即便 ②⑤ 形态已补齐）

1. **近端第一步双侧不一致**：用户若同时看「规划」与「推演」，今天该做「3 行虚构样表」还是「列 3 个痛点」——5 分钟复述（硬条④）可能对不上号。
2. **Plan 叙事=标签块拼接**：1634 字达标靠四元字段复制；读感更像结构化填空短篇，而非连续故事；大量 `____` 进一步像未填模板。
3. **Projection 可执行粒度偏虚**：节点正文多「固定时段 / 整理场景 / 补知识点」级描述；缺与 plan 同级的「打开 Excel→具体列名→截图验收」步骤；节点下无 quest 清单。
4. **路径策略打架**：公开冷启动（plan）vs 熟人网络（proj）——同一档案两条「可落地」故事，可信度互相稀释。
5. **能力假设爬升过快**：无编程基础 + 预算 0，却在早期节点出现「脚本」、中期「可重复运行的表格操作 / 完整实践」，缺少可检验的技能门槛证据链。
6. **raw 40 周幽灵**：即便叙事已夹 13 周，产物仍暴露原始行动线 19–40 周——审查者易怀疑「同构」是后贴脊柱而非算法真正合并。
7. **目标终点仍悬空**：90 天「付费试单」在两侧均条件化（可能无人回应 / 不急谈报酬）；可落地的是练习与询问，不是试单闭环——与「能实现」期待之间仍有鸿沟（文中有诚实免责，但趣味/成就感可能仍不足）。
8. **重复结构**：同文 branches、同构四段标签，稳定性有余、差异化细节不足——「好玩」所依赖的具名场景仍薄。

---

## 附录：关键数字速查

- plan narr 汉字：**1634**（仅 chapters[].narrative）
- plan 四元字段汉字合计：**1602**（另计）
- proj longForm 汉字：**2255**；chars（去空白）：**2520**
- 叙事周界 max：**13** / ruleFacts：**13**；raw hi：**40**
- plan `____`：**28**；相同 branches：**4/4**
- 近端 minutes：plan 今天 25 / 本周 30；proj 今天 20 / 本周 30
- readyForProductReview（开发自检）：**true**；热更/merge：**否**（材料声称）
