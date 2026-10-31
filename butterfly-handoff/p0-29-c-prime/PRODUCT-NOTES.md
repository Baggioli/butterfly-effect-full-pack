# P0-29 正式首包 · 产品核 / Micheal 打分材料

- 分支：`feat/p0-29-c-prime-32b` @ `5e9367c`（未 merge main、未热更 A2，stamp 仍 1.4-p0-28）
- 时间：2026-10-31 Asia/Shanghai
- 档案：便利店店员 · 90天 Excel 自动化付费试单 · 周 4h · 预算 0
- 主候选：**DeepSeek `deepseek-chat` 线上**（密钥仅 `/workspace/butterfly-secrets/butterfly-llm.env`，chmod 600，不入库）
- 对照：同档案强制 `qwen2.5:32b`；可选 `qwen2.5:7b` 基线（关深度契约）
- 推演故事：32b mixed，chars≈2048，validation=pass

## 硬门槛（主候选 DeepSeek）

| # | 项 | 结果 |
|---|----|------|
| 1 | 主路径 narrative ≥1500 汉字 | **PASS 1562** |
| 2 | 四幕到中期 + 四元 + 今天/本周可执行 | PASS |
| 3 | 具名动作 + 禁保证成功 | PASS |
| 4 | 5 分钟可复述本周第一步 | PASS |
| 5 | plan vs projection 同深度 | plan 1562 / proj 2048 |
| 6 | 结构 4 幕 | PASS |

## Micheal 五维（自动启发式，供人工覆核）

| 维 | DeepSeek | 32b | 7b |
|----|----------|-----|----|
| 详细 | 2 | 0 | 0 |
| 细节 | 2 | 2 | 2 |
| 可信 | 2 | 2 | 2 |
| 可实现可落地 | 2 | 2 | 2 |
| 阶段清晰 | 2 | 2 | 2 |
| clearWins | **5** | 4 | 4 |

## 今天/本周（DeepSeek）

- 今天：用自编虚构数据做出一个可截图的 Excel 汇总样表
- 本周：把今天的样表操作写成一张可复述的步骤卡

## 产物路径

`/workspace/butterfly-handoff/p0-29-c-prime/`
- `plan-deepseek-primary.json` / `plan-32b-contrast.json` / `plan-7b-baseline.json`
- `projection-story-32b.json`
- `sidebyside-summary.md` / `sidebyside-report.json`

## 产品结论（3–5 句）

1. DeepSeek 线上作为正式首包主验收候选：四幕短篇感、近端可执行、规则层 90 天/13 周对齐，硬门槛全过，五维启发式满分。  
2. 同档案 32b/7b 对照仍偏薄（narrative 285/94），说明深度契约在本地小模型上不足以单独过「详细」维，线上主路径是必要的。  
3. 推演故事 32b 已到约 2k 字且校验通过，与 plan 同口径可对照阅读。  
4. **不建议热更现网、不 merge main**；交产品核 / Grok→Micheal 人工打分后再定是否进下一轮。  
5. Blocker：无密钥/隧道类阻塞；人工分未回前不催 Micheal。
