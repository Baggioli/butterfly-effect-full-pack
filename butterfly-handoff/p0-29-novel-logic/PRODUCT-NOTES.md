# 小说体+逻辑可信样 · 产品笔记

- 时间：2026/10/31 21:33:53（Asia/Shanghai，UTC+8）
- 分支 `feat/p0-29-c-prime-32b` tip `653dfda`；本地未提交（未 commit/merge/热更，未开 B，未做 32b）
- 契约：`p0-29-s2-isomorphic-v1+novel-logic-1`（opt-in：ruleFacts.novelLogic=true；与 storyArc 独立；默认 isomorphic-v1 不变）

## 改动文件

- `worker/depth-contract.js`：NOVEL_LOGIC_CONTRACT_VERSION / NOVEL_LOGIC_META_RE / novelLogicPlanContractText / novelLogicAlgoText / novelLogicProjectionAddon；isProseArc；contractVersionFor 优先 novelLogic
- `worker/projection-story.js`：prose-arc 共用注入；novelLogic META 校验；firstStep 自然注入（无「这一幕的第一步」标签）
- `scripts/p0-29-novel-logic-sample.mjs`（新建）

## 已知弱

- 三问以语义勾选（卡点类型 + 水/模型/逸泓杠杆 + 世界变语言）；gateLogic 字段为正文摘句，偶需后处理对齐，产品抽核以正文可读性为准。
- 「可替换主角」是语义判断，自动化仅用杠杆关键词弱验。
- 第四幕汉字约 700+（本样 713），未强追 900；若产品要更厚终局可再扩一刀。
- 直过率未做 N 次统计（本刀交 1 样）；不挡交样。
- worker/index.js 打包产物未同步；上线另排构建+热更。
- story-arc 旧路径保留但本刀不走。
