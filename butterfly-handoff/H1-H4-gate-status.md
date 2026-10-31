# H1–H4 门禁自测报告（开发 · 2026-10-24）

**环境**：A2 `~/apps/butterfly-effect-a2` @ DGX `:18887`（loopback）；Mac SSH 隧道 `:18887` + `/tmp/a2-host-proxy.py` `:18888`（Basic 注入、Origin 改写、Bearer→`X-Butterfly-Session`）。  
**入口**：Wi‑Fi `http://192.168.0.109:18888` · Tailscale `http://100.65.242.127:18888`。  
**测法**：API 等价主链路（Origin=`http://192.168.0.109:18888`）×2 + H3 并发失败恢复；脚本 `/Users/lq/gate-revalidate.mjs`；证据 `/workspace/butterfly-handoff/gate-h1-h4-result-v3.json`。  
**未做**：未联系 Micheal；未动 prod `:8787`/`:8791` / `~/apps/butterfly-effect`；未 merge main。

## 门禁结果

| 门禁 | 结果 | 证据摘要 |
|------|------|----------|
| **H1** 主链路连续 2 次 | **PASS** | Run D：login→consent→journey→plan **200** / 4 章 / 今日「今天：确定项目主题」（~30s）。Run E：同上 / 「今天：启动自我介绍文档」（~35s）。角色卡均在。 |
| **H2** 展开故事超时内完成 | **PASS** | 两次 plan 均 ≪300s（~30–36s）；进度文案侧有「约需 2–3 分钟」；并发时网关 **429**（上一项仍在处理）。 |
| **H3** 失败可恢复 | **PASS** | 并发第二请求 **429**；中途 journey/角色卡仍在；首轮 plan 随后 **200**（4 章）；无需重建档。 |
| **H4** 无阻断认证/UI/入口/红线 | **PASS** | `:18888` phone Origin / Wi‑Fi / TS 均 **200**；直连 `:18887` 无 Basic → **401**（预期）。公开 UI 未见算命/成功率承诺/DGX/Ollama；法务页为「**不提供**命运预测…」免责声明。 |
| **H5** 已知问题 + P0=0 | **PASS（P0=0）** | 见下表。 |

**是否建议产品经理宣布「可测」**：**是（就 H1–H5 硬标准而言）**。由 **@产品经理** 在群里发「【可测】…」后，再由 Grok Bot 转 Micheal。开发侧不再直接请真机。

## 本轮修复（A2 only）

1. **根因**：生产路径走 `worker/index.js` 内嵌 `normalizeStoryDraft`，与 `worker/api.js` 不同步；仅改 api.js 时 H3 仍报 `CHAPTER1_QUEST_COUNT`。  
2. **修复**：两边统一：schema `quests.minItems:2`；ch1 过滤非 object quest；0/1 条时结构补「今天/本周」双任务（不编造用户事实）；重启 **仅** A2 `:18887`。  
3. 仓库分支：`feat/plan-timeout-300s`（box `/workspace/butterfly-dev`）。

## 已知问题清单

| ID | 优先级 | 现象 | 阻断 H1–H4？ | 状态 / 备注 |
|----|--------|------|--------------|-------------|
| K1 | ~~P0~~ → 已清 | 敏感同意 Basic/Bearer 抢头 | 曾阻断 | 代理 + `X-Butterfly-Session` 已修；冒烟 200 |
| K2 | ~~P0~~ → 已清 | plan `CHAPTER1_QUEST_COUNT`（index.js 无 pad） | 曾使 H3 失败 | index.js/api.js 已对齐 pad；本轮 H1×2+H3 PASS |
| K3 | P1 | 预览依赖 Mac 隧道+代理；隧道断则入口不可用 | 否（入口约定下当前可用） | 运维注意保活；非产品逻辑 |
| K4 | P1 | 直连 `:18887` 无口令 401；必须走 `:18888` | 否（约定入口） | 文档已说明 |
| K5 | P1 | `worker/index.js` 与 `api.js` 双份逻辑易再漂移 | 否（本轮已对齐） | 后续应收口为单一模块 |
| K6 | P2 | MagicDNS 不可用，需 IP | 否 | 已用局域网/TS IP |
| K7 | P2 | A2 内存会话重启即清空 | 否 | Demo 预期；测前需重新验证码登录 |
| K8 | P2 | UI 真机手势/键盘遮挡未在本轮 API 测覆盖 | 否（H1 允许 API 等价；真机体验交可测后） | 产品「可测」后 Micheal 真机补一眼 |

**P0 阻断计数：0**

## UI 缺口说明（相对完整真机）

本轮 H1 以 **API 等价** 验证登录/建档/角色卡/展开故事/今日任务标题；未跑浏览器点击「重新展开故事」按钮，但 `mode=plan` 重试与并发 429 + 卡仍在已覆盖 H3 语义。进度条依赖前端 `busyAI` 文案，API 侧可见耗时与 429。

## 时间（Asia/Shanghai）

- 终轮自测完成：约 2026-10-24 17:29（UTC+8）  
- 证据 JSON `at`：`2026-10-24T09:27:36.677Z` ≈ 17:27 Asia/Shanghai

## 浏览器点击流补测（2026-10-24 17:42 Asia/Shanghai）

**入口**：box 经 Tailscale SOCKS 转发到约定 Mac 预览 `100.65.242.127:18888`（浏览器地址栏为 `http://127.0.0.1:18888/`，同源代理栈）。未联系 Micheal。

| 项 | 结果 |
|----|------|
| A 完整点击流 → 今日任务 | **PASS** |
| B 「展开故事 / 调整路线」再点一次 | **PASS**（首次 Failed to fetch，重试成功） |
| 敏感同意保存失败 | **未再现** |
| Basic 弹窗 / Origin 报错 | **无** |

### 逐步

1. Welcome — PASS · `ui-smoke/step-01-welcome.png`
2. 手机号登录 `13900005555` / `000000` — PASS（首次获取验证码 Failed to fetch，重试成功）· `step-02-login.png`
3. 敏感同意 → 同意并继续 — PASS · `step-03-consent.png`
4. 文字建档 → AI 草案 → 接受这个故事 — PASS · `step-04-*.png`
5. 今日「先让这一小步发生」/ 主线「今天：启动文档」— PASS · `step-05-today.png`
6. 再点「展开故事 / 调整路线」→ 同意并生成草案 — PASS（首次 Failed to fetch，重试出审核稿；点「暂不采用」保留已接受故事）· `step-06-reexpand.png`

### 补测后问题分级

| ID | 优先级 | 现象 | 是否阻断交测 |
|----|--------|------|--------------|
| U1 | **P1** | 登录取码 / 再展开故事偶发英文 `Failed to fetch`；同会话有 `ERR_CONNECTION_RESET`、图标 `ERR_CONTENT_LENGTH_MISMATCH` | 否（重试可过；非认证逻辑）——建议交测前尽量稳住代理，真机若再现先下拉重试 |
| U2 | P2 | 世界图 `life-world-v3.png` 加载失败导致今日卡片视觉叠字 | 否（任务卡可读） |
| U3 | P2 | 首稿 baseline 写「年龄、学历待补充」但角色卡已有 35/本科 | 否 |
| U4 | P2 | 角色卡阶段首页偶发卡住「我在认真整理…」 | 否 |

**P0 阻断计数（含浏览器补测）：仍为 0**（偶发 fetch 失败归 P1，因重试可完成主链路）。

请 @产品经理 复核截图与上表后决定是否发「【可测】」。
