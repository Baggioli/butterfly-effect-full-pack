# P0-29 热更冒烟 · 产品核结论（v1.26.52）

- 时间：2026-10-31 Asia/Shanghai
- 材料：本目录；`smoke-report.json` / `smoke-run.log` / `plan-live-sample.json` / `proj-live-raw.json`
- 分支声称：`feat/p0-29-c-prime-32b` tip `653dfda`；戳 `1.4-p0-29`
- 入口：https://spark-864f.tailfb7e5f.ts.net:8443/

## 结论

**同入口热更冒烟过关 → 宣布核心推演（规划+推演）【可测】。** 不开 B、不 merge main、不催 Micheal；follow-up 不挡本刀。

| 冒烟最低条（S2-align 约定） | 事实 |
|------------------------------|------|
| 开页戳 `1.4-p0-29` | PASS |
| `/api/ai/status` DeepSeek + depth + onlineReady | PASS（`deepseek-chat` / `p0-29-s2-isomorphic-v1` / hasApiKey） |
| 登录 / 同意门未破 | PASS |
| 规划 ≥1500 + 四元可辨 | PASS（narr=2045；4 章处境·行动·变化·代价+quests） |
| 推演同深 | PASS（longForm 2366；4 节点均有四元；validation S1–S3/numberLock 全绿） |
| 今天/本周字面同源 + `nearTermSource=plan` | PASS（字节相同） |
| 用户面无 raw40；合规「模拟非承诺」 | PASS |

抽查：推演长文短篇感成立；近端可复述；密钥仅 A2 env（chmod 600）不进仓。已知 follow-up（不挡宣可测）：路径「不靠熟人」vs 推演触达身边小店张力；plan gate/`____` 模板留白；中段偶见「考试」等旁支措辞。

## 产品动作

1. **宣布**【可测】：演示入口同 `…:8443/`，现网戳以 `1.4-p0-29` 为准；范围含「规划你的下一步」深度叙事 + 推演页同深故事（核心好玩点）。
2. 请 Grok **私转** Micheal：硬刷新；**先开手机 Tailscale**；可点测规划生成与推演故事；可选五维打分（不催）。主路径「直接开始聊」仍可用；改目标/导入打磨仍后置。
3. 开发：本刀闭环；未开事项照旧——不 merge、不开 B；follow-up 另排不挡。
4. 备份保留：`pre-p0-29-20261031-110013`。

## 产品不在本刀做的事

- 不开 B 真阶段算法
- 不以 follow-up 再挡宣可测
- 不把密钥写入仓或群聊
