# P0-29 S2 同构 · 增量交核说明

- 分支：`feat/p0-29-c-prime-32b`（本刀 tip `8d102ab`，未 push / 未 merge main / 未热更 A2）
- 契约：`p0-29-s2-isomorphic-v1`
- 时间：2026-10-31T02:47:21.936Z（Asia/Shanghai）
- 主样例：同次新鲜 **DeepSeek plan** + **DeepSeek projection**
- 不开 B：行动线算法未改；故事层用 `withDepthStoryProj` 同构 4 段脊柱，周界≤ ruleFacts（本档案 13 周）

## 自检

| 项 | 结果 |
|----|------|
| 硬条② plan 四元显式 | PASS（4/4） |
| 硬条⑤ 同 provider | true（plan=DeepSeek API / proj=deepseek） |
| 硬条⑤ proj≤规则周界 | true（maxHi=13 / 13） |
| 硬条⑤ 近端今天/本周双侧 | plan=true proj=true |
| 硬条⑤ proj 四元字段 | true |
| 硬条① narr≥1500 | true（1634） |
| **可否再交产品核** | **YES** |

## 产物

- `plan-deepseek-s2.json` / `projection-deepseek-s2.json`
- `self-check.json` / `sidebyside-summary.md`

## 边界

不热更、不 merge、不开 B、不动周边 UI、不催 Micheal、secrets 不进 git。
