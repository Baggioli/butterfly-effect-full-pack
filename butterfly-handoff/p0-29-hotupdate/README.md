# P0-29 热更 handoff（Asia/Shanghai）

**时间**：2026-10-31 11:19 CST  
**分支**：`feat/p0-29-c-prime-32b`  
**tip**：`653dfda`（含 stamp `1.4-p0-29` + DeepSeek 主路径 + 近端同源 wire + slim handoff）  
**戳**：`1.4-p0-29`  
**入口**：https://spark-864f.tailfb7e5f.ts.net:8443/  
**未 merge main；未开 B；未催 Micheal；不过烟不宣【可测】→ 现冒烟全绿，可交产品再核宣【可测】**

## 备份 / 密钥
- 备份：`~/apps/butterfly-effect-a2/.runtime/pre-p0-29-20261031-110013`（热更前快照）
- A2 密钥文件：`~/apps/butterfly-effect-a2/.runtime/butterfly-llm.env`，**chmod 600**（不进 git；日志无明文）
- 启动：`BUTTERFLY_LLM_ENV_FILE=.../.runtime/butterfly-llm.env` → `/api/ai/status` 显示 DeepSeek API / `deepseek-chat` / `onlineReady:true` / `hasApiKey:true` / `depthVersion:p0-29-s2-isomorphic-v1`

## 热更范围
- 深度契约 + DeepSeek 主路径（plan↔proj 同构）
- 近端以 plan `chapters[0].quests` 为权威同源（`nearTermSource=plan`）
- slim plan handoff（保 chapters/quests，截 narrative）+ `/api/projection/*` body 上限 120KB（防 413）
- **未动**同意门 / 周边 UI；follow-up（熟人路径 / `____` / 脚本张力）未修

## 同入口冒烟（脚本 `scripts/e2e-p0-29-hotupdate-8443.mjs`）

| 项 | 结果 |
|---|---|
| 戳 HTML `1.4-p0-29` | PASS |
| `/api/ai/status` DeepSeek + depth + onlineReady | PASS |
| 登录 / 同意门未破 | PASS |
| 规划 narr≥1500（本跑 2045）+ 四元显式可辨 | PASS |
| 规划无 raw40 / 无算命保证成功 | PASS |
| 推演同深 depthVersion + 4 节点 | PASS |
| 今天/本周近端字节同源 + `nearTermSource=plan` | PASS |
| 推演用户可见无 raw40 | PASS |

证据：`smoke-report.json` / `smoke-run.log` / `plan-live-sample.json` / `proj-live-raw.json`

## 回滚
`cd ~/apps/butterfly-effect-a2 && tar -C .runtime/pre-p0-29-20261031-110013 -cf - . | tar xf -`（或按该目录内文件覆盖 public/worker/scripts）后按原方式重启 dgx-server（**勿**带错 LLM env 路径）；Serve 8443 代理不变。

## 请产品
同入口再核后决定是否宣【可测】。开发侧冒烟全绿，建议可宣；follow-up 不挡。
