# 故事经过样 · 产品笔记

- 时间：2026/10/31 19:58:37（Asia/Shanghai，UTC+8）
- 分支 `feat/p0-29-c-prime-32b` tip `653dfda`；以下为本地未提交改动（未 commit/merge/热更，未碰 A2·8443）
- 契约：`p0-29-s2-isomorphic-v1+story-arc-2`（opt-in：ruleFacts.storyArc=true 时生效；默认路径仍 `p0-29-s2-isomorphic-v1` 不变）

## 改动文件

- `worker/depth-contract.js`：新增 STORY_ARC_CONTRACT_VERSION / contractVersionFor / STORY_ARC_BANNED_RE / storyArcPlanContractText / storyArcProjectionAddon；planDepthContractText 增 storyArc 选项；ensureChapterQuad 在 narrativeMode='story-arc' 时保留散文 narrative（四元走字段）；projectionStoryDepthAddon 在 rf.storyArc 时追加故事经过规则
- `worker/projection-story.js`：buildStoryNodePrompt 在 rf.storyArc 时注入「本段故事线/本段财富杠杆」（plan 同源、去数字）；depthVersion 用 contractVersionFor(rf)
- `scripts/p0-29-story-arc-sample.mjs`（新建；旧便利店/grand-goal/richest 脚本未改）

## 已知限制

- worker/index.js（打包产物）未同步；上线需另排构建+热更
- proj 字段仍受「无数字」规则与每段字数上限约束，故事密度低于 plan

## v1.26.58 叙事算法最低集（story-arc-2）

- `worker/depth-contract.js`：版本 → `…+story-arc-2`；新增 NARRATIVE_ALGO_PROMPT（研究稿 §② 草案原样，系统+用户双注入）；门控链/幕结构/第一人称回望/幕尾「这一幕的第一步」/meta 字段要求；禁词表加「清单/文件名/项目编号」与 预测|预言|注定|命运|你失败了；推演附加段要求只在第一段开头回望、第一步只写在行动末、不得写中文数量词、不复述系统状态句
- `worker/projection-story.js`：story-arc 且有 gateChain 时，每段注入「本段要跨的门/本段情绪/回扣物件/开头口吻（第一段才回望）」，去掉「本段结束时的状态」（之前漏出“按计划推进/具备检验”）；节点重试次数 ≥3
- `scripts/p0-29-story-arc-sample.mjs`：ruleFacts 加 gateChain G1–G7（G7 只写门前）与阶段 emotion/tier/beatHint；algoCheck 自检；规划未过算法时同稿定点修补一次；推演最多 5 次取首个全过；支持 P0_29_REUSE_PLAN 复用已过规划

## 本样已知弱点

- 规划 meta 的 emotion 四幕都填了 1（低谷靠正文第 3 幕场面+“换来”成立，但情绪曲线字段没起伏）
- 第四幕一次跨 G4–G6 三门，节奏偏快
- 规划首稿过算法的比例不高（本次靠一次定点修补；3 轮内整稿直过并不稳定）
