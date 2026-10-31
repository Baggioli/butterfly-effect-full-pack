# P1-11 热更准备包（已于 2026-10-29 11:01 CST 执行）

> 产品已下令；A2 已热更至 `1.4-p1-11b`。本目录脚本仍默认 dry-run，真写需 `EXECUTE=1`。
> Tailscale Serve `:8443` 拓扑**未改**。


## 前提
- 分支 tip：见上级 `report.json` / git `feat/p1-11-coldstart-import`
- 本地戳：`1.4-p1-11b`
- A2 路径（DGX）：`~/apps/butterfly-effect-a2`（:18887）
- SSH：`lq@spark-864f`，key `~/.ssh/id_dgx`；优先 box→DGX，不经 Mac
- **不要**改 Tailscale Serve `:8443` 指向，除非产品明确要求切戳

## 步骤清单（下令后按序）
1. **备份 A2**  
   `ssh -i ~/.ssh/id_dgx lq@spark-864f 'ts=$(date +%Y%m%d-%H%M%S); cp -a ~/apps/butterfly-effect-a2 ~/apps/butterfly-effect-a2.bak-p1-11-$ts && echo BAK=$ts'`
2. **同步 public 文件**（仅下列，勿整仓乱盖）  
   - `public/coldstart-import.js`  
   - `public/app.js`  
   - `public/style.css`  
   - `public/index.html`（戳改为 `1.4-p1-11b` 或产品指定）  
   - `story.js` 可保持现网若未改
3. **进程/缓存**  
   - 若 A2 是静态+worker：按现网惯例重启 worker（参考既有 `dgx.sh` / deploy 脚本）  
   - 浏览器硬刷新；确认 HTML 里 `?v=` 已是新戳
4. **回归**（本机对 A2 或经 TS 8443）跑 `regression-checklist.md` + 可选 `../smoke.mjs` 对本地副本  
5. **产品再宣可测戳** 前：确认同意门、直接开始聊、demo 隐藏、导入路径四条绿
6. **回滚**：`mv` 备份目录盖回 A2，恢复旧 `index.html` 戳 `1.4-p0-23c`

## 草稿脚本
- `backup-a2.sh` — 仅备份，默认 dry-run 需 `EXECUTE=1`
- `sync-public-draft.sh` — rsync 文件列表，默认 dry-run
- `regression-checklist.md` — 人工/半自动回归项

**本准备包不会也不应自动 SSH 写生产。**
