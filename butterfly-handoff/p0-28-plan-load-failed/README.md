# P0-28 「规划你的下一步」Load failed — 修复与同入口冒烟
时间：2026-10-29 16:36–16:50 CST（Asia/Shanghai）· 戳 1.4-p0-28 · 分支 fix/p0-28-plan-load-failed @ e8dffa2（基于 66810af，未 merge main、未 push）

## 根因
Micheal 手机当时未连上 Tailscale（DGX `tailscale status`：iphone171 offline，last seen ≈11:3x CST；截图状态栏无 VPN 标；
a2-host-proxy 日志 11:12 之后到 16:34 无任何来自手机的请求）。点「同意并生成草案」→ POST /api/ai 根本没出手机 →
iOS Safari fetch 抛 TypeError「Load failed」→ app.js busyAI 把 e.message 原样写进 #quick-error。8443/代理/A2/模型均健康。
弹层打开本身不发请求（失败是点击瞬间网络失败，看起来像"未点就失败"）。

## 修复（只改前端 4 件 + 重新 embed）
- app.js：新增 aiErrMsg()，TypeError/Load failed/Failed to fetch 等 → 中文「暂时连不上私人规划服务（网络中断，或手机 Tailscale 未连接）…重试；资料已保留」；
  ai-plan 弹层打开时 8s 预检 /api/ai/status，网络不通即提前显示同一中文提示
- onboarding.js：建档故事生成同类网络错误中文化
- coldstart-import.js STAMP、index.html ?v → 1.4-p0-28
- worker/index.js 仅 assets 变（API 部分 diff 相同），build + 重启 dgx-server（新 PID 2691644）；proxy / Serve 未动

## 备份 / 回滚
备份：/home/lq/apps/butterfly-effect-a2/.runtime/pre-p0-28-20261029-163625/{public,worker,dist}
回滚：cp 回 public 四件 + worker/index.js + dist/，重启 dgx-server（env 同前：DGX_APP_PORT=18887, DGX_APP_PASSWORD_FILE=.runtime/dgx-app-password）

## 同入口冒烟（box→SOCKS→8443，headless Chrome）
p0-28-live-report.json / run.log / live-e2e-shots/
- stamp 1.4-p0-28 PASS；同意门 gated→ungated PASS；直接开始聊 / 导入入口 PASS；?demo=1 无导入闸 PASS
- P28-01 弹层打开：无 Load failed PASS
- P28-03 真生成：35s 出「审核你的人生故事 · 定制草案」PASS（自动 plan 亦 200，37s）
- P28-05 模拟断网（拦截 /api/ai）：打开即中文提示，点击后中文可重试，无英文 PASS
- CS2_strip_labels 显示 FAIL 为脚本误报（把含原文的粘贴 textarea 也算进去），11-role-card.png 字段已去标签
