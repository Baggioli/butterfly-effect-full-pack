# P0-29 S2-align · 热更前极小对齐交核

- 分支：`feat/p0-29-c-prime-32b`（本刀本地 commit，未 push / 未 merge main / 未热更 A2）
- 契约：`p0-29-s2-isomorphic-v1` · 对齐 `p0-29-s2-align-v1`
- 时间：2026-10-31T02:54:46.405Z（Asia/Shanghai）
- 主样例：同次新鲜 **DeepSeek plan** + **DeepSeek projection**（nearTerm←plan）

## 对齐点

1. **近端同源**：推演 `nearTerm` 直接复用 plan 第一章今天/本周（`nearTermSource=plan`）；标题+产出字面一致。
2. **清 raw40**：用户可见 `projection-deepseek-s2.json` / plan 产物 **不含** `rawProjectionHorizon`；行动线 raw 仅在 `self-check.json → internal`。

## 自检

| 项 | 结果 |
|----|------|
| 硬条② plan 四元显式 | PASS（4/4） |
| 硬条⑤ 同 provider | true（plan=DeepSeek API / proj=deepseek） |
| 硬条⑤ proj≤规则周界 | true（maxHi=13 / 13） |
| 硬条⑤ 近端双侧 | plan=true proj=true |
| 硬条④ 近端字面同源 | titles=true outputs=true source=true |
| 用户可见无 raw40 | true |
| 硬条① narr≥1500 | true（1966） |
| **可否再交产品核议热更** | **YES** |

## 产物

- `plan-deepseek-s2.json` / `projection-deepseek-s2.json`（用户可见，无 raw40）
- `self-check.json` / `sidebyside-summary.md`

## 边界

不热更、不 merge、不开 B、不动周边 UI、不催 Micheal、secrets 不进 git。
