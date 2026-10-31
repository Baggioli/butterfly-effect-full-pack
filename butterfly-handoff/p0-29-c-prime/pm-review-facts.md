# P0-29 正式首包 · PM 核事实报告（仅事实，无 PASS/FAIL）

- 核阅时间：2026-10-31 Asia/Shanghai
- 材料目录：`/workspace/butterfly-handoff/p0-29-c-prime/`
- Backlog：`/workspace/butterfly-pm/蝴蝶效应-可投放定义与Backlog-v1.md`（文首标 v1.26.48，2026-10-31）
- 本文件为产品核事实摘录；不替代 Micheal 五维人工分。

---

## 1. 交接目录文件清单

| 文件 | 大小约 | 内容简述 |
|------|--------|----------|
| `PRODUCT-NOTES.md` | 2.3 KB | 开发交核说明：分支 tip、主候选/对照、硬门槛自检表、五维启发式、今天/本周摘要、不热更结论 |
| `README.md` | 0.9 KB | 复现说明：分支、Ollama 隧道、密钥路径、脚本入口、模型切换环境变量 |
| `persona.json` | 1.5 KB | 合成档案「虚构便利店试单甲」+ `ruleFacts`（90 天/13 周、周 4h、四阶段周界） |
| `plan-deepseek-primary.json` | 16.7 KB | 主候选规划样例：DeepSeek API / `deepseek-chat`，4 幕 chapters |
| `plan-32b-contrast.json` | 10.6 KB | 同档案对照：DGX `qwen2.5:32b`，4 幕 |
| `plan-7b-baseline.json` | 8.9 KB | 基线：DGX `qwen2.5:7b`（README 写可关深度契约），4 幕 |
| `projection-story-32b.json` | 12.1 KB | 推演故事：`qwen2.5:32b`，`longForm` + 6 个 `perNode`（situation/action/change/cost） |
| `sidebyside-summary.md` | 21.1 KB | 并排跑次摘要 + 三份 plan 全文 + projection 全文 + 硬条/五维/建议 JSON |
| `sidebyside-report.json` | 63.1 KB | 机器可读全量报告（persona、runs、hardBars、michealFive、recommendation、projection） |
| `run.log` | 2.3 KB | 运行日志：密钥加载、DeepSeek 生成、32b/7b/proj 标注 reuse、收尾 hard/recommendation |
| `pm-review-facts.md` | （本文件） | PM 事实核阅输出 |

说明：目录内**无**现网 stamp / A2 部署截图；stamp「仍 1.4-p0-28」仅见于 `PRODUCT-NOTES.md` 文字声明。

---

## 2. PRODUCT-NOTES / sidebyside-summary 中的陈述主张

### 2.1 分支 / 部署 / 时间

- 分支：`feat/p0-29-c-prime-32b` @ `5e9367c`
- 声明：**未 merge main、未热更 A2**；stamp **仍 `1.4-p0-28`**
- `sidebyside-summary.md` 时间戳：`2026-10-31T02:35:44.765Z` → Asia/Shanghai **2026-10-31 10:35:44**
- 契约版本：`p0-29-c-prime-v1`
- `recommendation.hotUpdateNow`: **false**；文案「不热更现网」

### 2.2 模型与字数主张

| 样例 | 模型 / provider | 主张 narr 汉字 | 五维启发式（自动） |
|------|-----------------|---------------|-------------------|
| plan-deepseek-primary | deepseek-chat / DeepSeek API | **1562** | 详细/细节/可信/可实现可落地/阶段清晰 皆 2；clearWins=5 |
| plan-32b-contrast | qwen2.5:32b / DGX | **285** | 详细=0，其余 2；clearWins=4 |
| plan-7b-baseline | qwen2.5:7b / DGX | **94** | 详细=0，其余 2；clearWins=4 |
| projection-story-32b | qwen2.5:32b | chars≈**2048**，validation=**pass**/true | （未给五维） |

### 2.3 档案主张

- 便利店店员；目标「90天内完成一个Excel表格自动化服务的付费试单」；每周 4h；预算 0；不辞职、不购买课程、不编造收入与客户。

### 2.4 今天 / 本周（DeepSeek 主张）

- 今天：用自编虚构数据做出一个可截图的 Excel 汇总样表
- 本周：把今天的样表操作写成一张可复述的步骤卡

### 2.5 做过 / 未做（材料内声明）

- 做了：线上 DeepSeek 主样例；同档案 32b/7b 对照；32b 推演故事；并排 summary/report；密钥运行时加载、不入库
- 未做 / 不做（声明）：不热更现网、不 merge main；人工五维「供覆核」、未宣称 Micheal 已打分；`run.log` 显示 32b plan / 7b / projection 为 **`reuse`**（本轮未重跑，复用既有产物）

### 2.6 开发硬门槛自检表（PRODUCT-NOTES 原文结构）

| # | 项（开发写法） | 结果（开发自标） |
|---|---------------|-----------------|
| 1 | 主路径 narrative ≥1500 汉字 | PASS 1562 |
| 2 | 四幕到中期 + 四元 + 今天/本周可执行 | PASS |
| 3 | 具名动作 + 禁保证成功 | PASS |
| 4 | 5 分钟可复述本周第一步 | PASS |
| 5 | plan vs projection 同深度 | plan 1562 / proj 2048 |
| 6 | 结构 4 幕 | PASS |

`sidebyside-summary.md` / `run.log` 中对应机器标志：`1_main_path_ge_1500`…`6_structure_ok` 全部为 true（硬条 5 记为字符串 `"plan_narr=1562; proj=2048"`）。

---

## 3. 硬条 1–6：验收原文摘录

### 3.1 Backlog P0-29「首包验收」原文（v1.26.48 表行）

> 首包验收：①确认档案后主路径可见 **≥1500 字**连贯叙事（可分幕折叠），读感像短篇非条目表；②全轨迹按阶段/周期覆盖至用户中期目标；每节点强制 **处境·行动·变化·代价** + ≥1 可执行任务（时限/交付物/验收）；③含具名或可查动作细节；数字只来自规则层；④用户 5 分钟内能复述「本周第一步做什么、做到什么算过」；⑤「规划你的下一步」与推演页为**同一深度产物**（或异步补齐且主路径可见长文），禁止只出薄草案；⑥同卡重复结构稳；DGX 不够则接线上更强模（他可开权限）；法务「模拟非承诺」仍守。

同文件相关补充（非替换上列编号，供对照）：

- v1.26.48 文首：正式首包 = 统一深度契约 + 规则层数字/期限注入 + 允许线上强模；**C′ 只作对照**；两点钉死：①合并规划与推演同一深度；②允许上线上模；合规不松；形态=中长期阶段轨迹+近端可执行。
- S1（故事验收清单）：`详细故事字数 ≥1500（可折叠），且每计划线节点含处境/行动/变化/代价四要素`
- 定位段：叙事须有细节（处境/行动/变化/代价），任务须可当天执行。

### 3.2 PRODUCT-NOTES 硬门槛表原文（开发缩写口径）

见 §2.6 表；与 Backlog ①–⑥ 语义大致对应，但 PRODUCT-NOTES 把「四元」与「今天/本周」并入条 2，把「具名动作+禁保证成功」并入条 3，条 5 仅用两侧字数并列，条 6 写「结构 4 幕」。

---

## 4. DeepSeek 主候选 plan（`plan-deepseek-primary.json`）

### 4.1 实测字数（本核独立计数）

- 计数对象：4 个 `chapters[].narrative` 字段拼接
- **汉字（`[\u4e00-\u9fff]`）合计 = 1562**（分幕：440 / 386 / 395 / 341）
- 与主张 `score.nChars=1562`、PRODUCT-NOTES「1562」**一致**
- 另：`baseline` 汉字 121（未计入上述 narrative 合计）
- `score.quadOk`: **4**（JSON 字段；计数器含义以开发脚本为准，材料未另释）

### 4.2 结构

- `story.chapters`：**4** 幕  
  - 第0—2周（近期）「今天先做出一张自己的样表」  
  - 第2—6周（能力与证据积累）  
  - 第6—13周（中期目标验证前夜）  
  - 第10—13周（阶段目标验证，不越界）
- 周界与 `persona.ruleFacts.stages`（0–2 / 2–6 / 6–13 / 10–13）及 deadlineWeeks=13 **对齐**
- 每幕字段：`name, scene, period, narrative, gate, branches, quests`
- **无**独立键名 `situation` / `action` / `change` / `cost`（或「处境/行动/…」字段）
- 叙事为连贯短篇散文；四幕 narrative 均出现「变化…」「代价…」字样；**未**以「处境：/行动：」标签分块
- 每幕 `quests` ≥1；第 0 幕 2 个（今天+本周），其后各 1 个；quests 含 `title, steps, output, example, tool, minutes, why`

### 4.3 今天 / 本周可执行物

- **今天** quest 标题：`今天：用自编虚构数据做出一个可截图的Excel汇总样表`（minutes=25）  
  - 步骤含：建「数据」三列（日期/品名/数量）、删重复、数据透视表、「结果」页、截图  
  - 交付：`1个Excel文件与1张截图` + 可指出「先删重复再建透视表」
- **本周** quest 标题：`本周：把今天的样表操作写成一张可复述的步骤卡`（minutes=30）  
  - 交付：步骤卡（≥5 编号步骤 + 卡住补救说明）、可独立从空表复现  
- 材料内为文字描述与验收句，**无**实际 `.xlsx` / 截图二进制附件

### 4.4 样例摘录（偏密段落）

**幕 0 narrative（汉字 440，开篇～变化）：**

> 夜班结束，虚构便利店试单甲把工牌塞进包里，回到合租房时已经过了十点。电脑是旧的，风扇响得厉害，桌上摊着便利店小票和一本从店里拿来的空白盘点本。他清楚自己手里没有客户，也没有作品，直接去问别人要不要自动化服务，连一句像样的介绍都说不出来。于是他给自己定了第一条限制：不辞职，不买课，每周只从休息时间里挤出总共4小时，先用自己编的样表做一件能拿得出手的小东西。今天他把店里的盘点场景改写成虚构数据，在Excel里建了三列：日期、品名、数量，故意混入重复行和空格，又单建一个“结果”页。他没用复杂代码，只点开“数据—删除重复值”，再插入数据透视表，让“结果”页自动汇总每个品名的数量。卡住的地方是透视表刷新后格式会乱，他记下这个障碍，没有因为一次做不成而怀疑自己。变化很小：他第一次有了一张能截图说明问题的样表，也第一次知道“自动化”在别人的具体工作里可能只是一个按钮和一张汇总表。代价是那天少玩了四十分钟手机，第二天早起有点难。

**幕 2 narrative（汉字 395，服务说明段）：**

> 进入第六周后，虚构便利店试单甲的需求记录表已经不像最初那样空，但他仍然没有付费客户。他意识到，光有记录不够，别人要的是能听懂的一句话。于是他挑出表里最常出现的一个动作：把杂乱清单变成按类别汇总。他用自己的虚构样表做了一份一页说明，页面上不写“精通Excel”，只写“可把____类清单整理成按____汇总的表，先看样表再谈”。他把这份说明存成空白模板，价格和交付时间都留空，因为还没有验证过。现实障碍很快出现：他发现自己说不清“多久能做完”，也怕对方问“能不能保证准确”。他给自己定的回应是：先请对方发一份脱敏样表，自己只承诺“先做一版样表供看”，不承诺结果。变化是，他开始用“条件—动作—可看证据”的方式说话，而不是把会一点点操作说成一项服务；代价是他必须承认有些需求接不了，也要接受发出去的说明可能没有回音。

### 4.5 其他可观察点

- 全 JSON 中占位符 `____` 出现 **32** 次（叙事与 quests/example/output 中）
- 「保证」1 次：语境为角色担心被问「能不能保证准确」，随后写「不承诺结果」（非向用户承诺成功）
- 「预测」：**0**；「承诺」多处，多为「不承诺结果」类边界句
- 四幕 `branches` 三选项文案**完全相同**（模板复用）

---

## 5. 32b / 7b plan 对照（简要实测）

### 5.1 plan-32b-contrast

- narrative 汉字：**285**（76+68+74+67），与主张一致；`quadOk`: **0**
- 4 幕；period 写作 `0-2周` / `2-6周` / `6-13周` / `10-13周`
- narrative **无**「变化」「代价」字样；偏摘要句
- 今天/本周：`今天：学习基础函数`（20 分）；`本周：寻找潜在客户`（潜在客户名单 + 介绍邮件）
- 后续幕：VLOOKUP/IF、联系潜在客户、报价单与试单合同等；gate 含「成功联系到潜在客户」「成功获得一个试单」等结果导向表述
- 样本 narrative：「甲决定利用下班后的空闲时间，开始学习Excel的高级功能，以期能够提供自动化服务。他首先从网上找到了一些免费的教程，开始自学。今天，他决定先从简单的函数开始，逐步提升自己的技能。」

### 5.2 plan-7b-baseline

- narrative 汉字：**94**（30+22+23+19），与主张一致
- 4 幕 period 偏「近期（今天）/近期（本周）/中期/远期」，与 ruleFacts 周界标签不完全同形
- baseline 汉字仅写「年龄、学历待补充」（与 persona 已填 22 / 高中中专不一致）
- 今天/本周：`启动自动化梦想` →「简单的 Excel VBA 脚本」；`寻找试单机会` →「同事同意试用」
- gate/quest 含「获得一个付费试单」「获得至少两个付费试单」「服务范围扩大至其他部门」等
- depth 字段仍为 `True` / `p0-29-c-prime-v1`（尽管 README 称 7b 可 `AI_DEPTH_CONTRACT=0`）

---

## 6. projection-story-32b

### 6.1 计数字段

| 口径 | 数值 |
|------|------|
| JSON `chars` 字段（主张） | **2048** |
| `validation` | **true**（bool；summary 写作 pass） |
| `source` | `mixed`（node0=mixed，其余 5 个=llm） |
| `longForm` 全文字符长度 | 2107 |
| `longForm` 汉字数 | **1737** |
| 6×(situation+action+change+cost) 汉字合计 | **1401** |

→ 主张「≈2048」与 `longForm` 汉字 1737 / 全文长度 2107 **并非同一口径**；材料未说明 `chars` 的精确算法。

### 6.2 结构 vs DeepSeek plan

| 维 | DeepSeek plan | projection-32b |
|----|---------------|----------------|
| 分段 | 4 chapters | **6** perNode + 首尾说明 |
| 四元形态 | 散文内嵌「变化/代价」 | **显式** situation / action / change / cost |
| 时间跨度 | 约第 0–13 周（对齐 90 天） | tRange 最高至 **第 19–40 周**（节点：3–5, 7–14, 11–24, 14–31, 18–39, 19–40） |
| 近端今天/本周任务卡 | 有（Excel 样表 + 步骤卡） | longForm/perNode **无**对等「今天/本周」quest 结构 |
| 读感粒度 | 具名 UI 操作（删除重复值、透视表） | 多为「固定时间学习/交流/发布服务」概括 |

开篇合规句（longForm）：「这是一份按你所给条件写成的模拟故事，不是对未来的承诺。」

### 6.3 与档案约束并读时可见的内容点

- 文中出现「通过在线课程和实践练习」「VBA编程」
- 变化段出现「你完成了一次真实的收费服务」（完成态表述）
- 约束原文含「不购买课程」「不编造收入与客户」；projection 是否算违规取决于产品对「在线课程/收费完成态」的解释——此处只记录文本存在

---

## 7. 合规 / 法务措辞 / stamp / 热更

- Backlog / 产品定位：对外「推演/模拟」、法务「模拟非承诺」；不用「预测」
- DeepSeek plan：未见「预测」；多处「不承诺结果」；「AI生成·模拟非承诺」标识**未**作为独立字段出现在 plan JSON（本包为 API 故事体，非 UI 截图）
- Projection：明确「模拟故事，不是对未来的承诺」；未见「预测」
- Stamp：仅 PRODUCT-NOTES 声明仍 **`1.4-p0-28`**；本目录无页面/响应头/构建戳佐证
- 热更 / merge：PRODUCT-NOTES、README、recommendation 一致声明 **不热更、不 merge main**；`hotUpdateNow=false`

---

## 8. 主张自检 vs JSON 可见落差 / 不一致点（事实罗列）

1. **硬条②「每节点强制处境·行动·变化·代价」形态**：DeepSeek plan 为散文 + 文内「变化/代价」，**无**四元分字段；开发 `quadOk=4` 与 Backlog/S1「四要素」是否等价，材料未定义。Projection 有显式四元，但 plan 主路径没有同构字段。
2. **硬条⑤「规划 vs 推演同一深度」**：开发用字数 1562 vs 2048 判同深；结构上 plan=4 幕/13 周+近端 quest，projection=6 节点/最长至约 40 周、无对等今天·本周卡，**粒度与时间轴不一致**。
3. **`chars≈2048` 口径**：`longForm` 汉字实计 **1737**，全文长 2107；与 2048 字段并存，需产品知悉计数定义。
4. **占位符 / 模板感**：DeepSeek 全文 `____`×32；四幕 branches 文案完全相同；quests 的 example/output 大量留空槽——与「短篇感」并存的填空模板痕迹。
5. **对照样例偏薄且结果导向**：32b narr 285、无变化/代价；7b narr 94；二者 gate/quest 多处「获得付费试单/客户」完成态；7b 还含 VBA、同事试用（与「无编程经验 / 不编造客户」张力）。开发已自标详细维=0，并称线上主路径必要。
6. **7b baseline 字段**：`baseline` 写「年龄、学历待补充」，与同包 `persona.json` 已填值不符；`depth: true` 与「关深度契约基线」说明可能不一致。
7. **run.log `reuse`**：本包 32b plan、7b、projection 标注复用，非与 DeepSeek 同一次新生成；并排「同时刻新鲜度」仅 DeepSeek 本轮 `plan-done`。
8. **规则层数字**：plan 周界大体跟 ruleFacts；projection tRange **越出** deadlineWeeks=13 / 90 天目标窗，与 ruleFacts.note「期限合计不得越界」并读时存在张力。
9. **今天=可截图 Excel / 本周=步骤卡**：仅以 quest 文案与验收句呈现，包内**无**可打开的样表文件或步骤卡截图实物。
10. **Stamp / 现网**：stamp 与未热更均为文字主张；本核未打开 8443 验证戳值。
11. **五维满分**：标注为「自动启发式，供人工覆核」；非 Micheal 人工分。
12. **形态「中长期人生阶段轨迹」vs 本档案 90 天**：主候选 plan 叙事主轴落在 90 天/13 周试单证据链；Backlog v1.26.47/48 强调「不是只做 90 天任务剧本 / 中长期为主轴」——本样例时间窗选择本身是产品需知情的范围事实。

---

## 附录 A · persona / ruleFacts 摘要

- name：虚构便利店试单甲；age 22；education 高中/中专；role 便利店店员  
- hours 4；budget 0；goal 90天 Excel 自动化付费试单；constraints：不辞职、不购买课程、不编造收入与客户  
- ruleFacts：deadlineDays 90；deadlineWeeks 13；stages near/build/mid/verify 如上；note：模型不得另编天数/周数/收入/成功概率  

## 附录 B · 机器 hardBars（原文键）

```json
{
  "1_main_path_ge_1500": true,
  "1_narrative_chars": 1562,
  "2_stages_to_mid": true,
  "2_quad_chapters": 4,
  "2_executable_today_week": true,
  "3_named_actions": true,
  "3_banned_success": true,
  "4_five_min_retell": true,
  "5_plan_vs_projection": "plan_narr=1562; proj=2048",
  "6_structure_ok": true
}
```

（以上为开发脚本输出；本文件不对各 true 作产品判定。）
