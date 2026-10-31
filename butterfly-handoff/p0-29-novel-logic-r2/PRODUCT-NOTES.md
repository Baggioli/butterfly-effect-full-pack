# novel-logic r2 · 产品笔记

- 时间：2026/10/31 21:40:57（Asia/Shanghai，UTC+8）
- tip `653dfda` 本地未提交；契约 `p0-29-s2-isomorphic-v1+novel-logic-2`（由 novel-logic-1 升至 2）
- 对照：`/workspace/butterfly-handoff/p0-29-novel-logic/PRODUCT-VERDICT.md`

## 改动文件

- `worker/projection-story.js`：novelLogic 时 `storyLongForm`/`psIntro`/`psSummary` 不再输出处境/行动小标题与「每一段都写了处境…」
- `worker/depth-contract.js`：契约升 `…+novel-logic-2`；proj/plan addon 强调财富阶梯与禁截图当转折
- `scripts/p0-29-novel-logic-r2.mjs`（新建）：拷 plan→修 act1/重写 act4→抽 gateLogic→重跑 proj；第二段 cost 数字锁失败后定点补写 llm

## 定点怎么改的

- **proj**：拼装层去说明书腔（硬）；字段仍内置 situation/action/change/cost，读者可见 longForm 为连续章节。
- **G5**：第四幕——控股权+水数据/水基础设施资产 → 个人净资产逼近公开入榜门槛；回购/锁定=守榜；截图降权，真正坐直的是控股权。
- **G4–G6**：上市前「咨询现金流养智能产品+水循环模型精度」；上市后沙漠冷却赢标扩表；对比图只是媒体动作。
- **第1幕**：删文末 worldShiftHint 照抄，旧硬盘+声控灯/蝉感官收束。
- **SCORECARD**：自读摘本样「旧硬盘」原文；三问与正文一致且互异；`readyForProductReview` 仅 fails=[] 时 YES。

## 已知弱

- 第四幕为定点 LLM 重写，前三幕保留原样微调；若产品要整稿统一声腔可再开一刀。
- 三问摘句为正文抽句，产品仍只认正文。
- 未 commit / 未热更 / 未开 B / 未做 32b；过闸前不请 Grok。

## 契约判断

升 `novel-logic-2`：proj 拼装去标签 + 财富阶梯 addon 写进契约，便于与 r1 区分抽核。
