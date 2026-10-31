# P0-24 故事主线勿误写成转型 — smoke（Asia/Shanghai）

Generated: 2026-10-25 23:03 CST
Tip: feat/projection-engine `a19d858`（本项）⊂ tip `523173c`（其上已叠 P0-25/26）
Cache: `v=1.4-p0-24-arc`（本项）/ tip 另含 `v=1.4-p0-25-26-demo`
A2: DGX `~/apps/butterfly-effect-a2` :18887（仅 A2，未动现网）；已让路并叠上 tip 的 P0-25 delta

## 根因
无硬编码「从X到Y」模板；`aiStory.title` 由 plan LLM 生成后经 `Story.buildStory` 展示为人生主线。模型漂移 + 建档「工作更自主」被误读为身份跃迁 → 已是经营者仍出「从…到自主经营者的转型」。

## 修复（a19d858）
- `worker/api.js`：`isAlreadyOperator` / `wantsBecomeOperator` / `applyStoryArcFraming` + plan/repair `storyArcPromptHint`；`validateStory(..., profile)` 后处理
- `public/story.js`：`frameArcTitle` 覆盖缓存坏标题
- `test-plan-story.mjs`：已是经营者禁转型 / 想成为允许 / 工作更自主≠成为
- 未合并 main

## 冒烟
| # | 项 | 结果 |
|---|----|------|
| 1 | 合成：已是自主经营者 + 痛点用户理解不够 → title 无「转型…经营者」，体现洞察/理解 | PASS（unit + A2 →「深化对用户的理解与洞察」） |
| 2 | 对照：想成为经营者 → 仍允许转型 title | PASS |
| 3 | 工作更自主 ≠ wantsBecomeOperator | PASS |
| 4 | A2 live plan（合成画像） | PASS title=`深化用户洞察，提升模型精准度`，~34s |
| 5 | 服务端 markers framing + cache | PASS |

## 产品仍拥有
- Micheal 真机档是否需「按纠正重生成主线」抽查（可测不收回）
- **不**据此宣称 Micheal-ready
