# 蝴蝶效应 · 全量代码与资料包（2026-10-31）

供 Micheal 转交其他大模型继续推演/开发用。

## 目录

- `butterfly-effect-app/` — GitHub 仓库检出（文档 + worker 等）
- `butterfly-dev/` — 当前主要开发工作区（含 dist/public/scripts/worker；已排除 node_modules / .runtime 本地模型）
- `butterfly-pm/` — 产品文档与 backlog 相关
- `butterfly-handoff/` — 交接与各刀样例（含 P0-29 各版本 SCORECARD / plan / proj）
- `butterfly-a2-sync.tgz` — A2 同步包
- `a2-host-proxy-dgx.py` — DGX 代理脚本

## 刻意未打入本包

- API 密钥与 `butterfly-secrets/`（请单独取用，勿进公开对话）
- `node_modules/`、`.runtime/` 本地模型权重
- `.git/`（远端：https://github.com/Baggioli/butterfly-effect-app ）

## 当前产品定调（摘）

- 核心：人生推演；小说体 + 逻辑可信
- 宏大目标：定「世界首富」就必须摸通往终局的路径；本人现状只作起点；中后段跨出纯水务；成败归用户
- 合规：模拟非承诺
- 最新送分样：`butterfly-handoff/p0-29-beyond-water/`（v1.26.64）

## 入口（参考）

- `https://spark-864f.tailfb7e5f.ts.net:8443/`
