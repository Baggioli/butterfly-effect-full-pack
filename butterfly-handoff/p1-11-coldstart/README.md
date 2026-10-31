# P1-11 冷启动导入 — 热更完成

- 时间：2026-10-29 11:07 CST（Asia/Shanghai）
- tip：`aca18ac`（功能）/ `66810af`（live E2E 脚本）· 戳 `1.4-p1-11b`
- 分支 `feat/p1-11-coldstart-import`：**未** merge main
- 同入口：https://spark-864f.tailfb7e5f.ts.net:8443/ 已出 `1.4-p1-11b`

## 热更
- 备份：`/home/lq/apps/butterfly-effect-a2/.runtime/backup-p1-11-20261029-110104`
- 同步：coldstart-import.js / app.js / style.css / index.html；story.js 未动
- embed build + 重启 A2 dgx-server（现 PID 见 report.json）
- **未改** Tailscale Serve `:8443 → 127.0.0.1:18888`

## 同入口回归（全 PASS）
| 项 | 结果 | 证据 |
|---|---|---|
| 戳 | PASS | HTML + coldstart-import.js |
| 同意门 | PASS | 05–07 / consent_to_gate |
| 直接开始聊 | PASS | S08b-direct.png |
| 导入去标签 | PASS 阿凯 / 独立咨询顾问 | S11-card.png |
| 忌讳旁路 | PASS | live-regression-strict.json |
| 确认进骨架 | PASS | S13-route.png |
| ai-plan 可选留模板 | PASS | toast + route 保留 |
| ?demo=1 无导入闸 | PASS | S15-demo.png |

详见 `live-regression-strict.json`、`live-e2e-shots/`。

## 回滚（未执行；仅预案）
恢复 backup-p1-11 的 public 四件套 + worker-index.js，再重启 dgx-server。
