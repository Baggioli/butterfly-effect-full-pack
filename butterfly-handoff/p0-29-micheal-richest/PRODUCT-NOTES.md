# Micheal 首富路径样 · 产品笔记

- 时间：2026/10/31 15:44:20（Asia/Shanghai，UTC+8）
- tip：`653dfda` · 分支 `feat/p0-29-c-prime-32b`（本地样例，未 merge / 未热更 / 未碰 A2·8443）
- 契约：`p0-29-s2-isomorphic-v1` · backlog v1.26.55
- 脚本：`scripts/p0-29-micheal-richest-sample.mjs`（新建；旧 grand-goal 脚本未改）
- 生成路径：plan 本地直调 DeepSeek（同 grand-goal 套路，现网 buildRuleFacts 锁 90/13 周，故脚本内注入自拟 520 周 ruleFacts）；proj 走 worker generateStoryLLM（env.__ruleFacts 注入同一 ruleFacts → withDepthStoryProj 四段同构脊柱）

## 硬条

见 `self-check.md`。readyForProductReview=true

## 边界

不热更、不 merge、不开 B、不做 32b/7b、secrets 不进 git、不催 Micheal。
