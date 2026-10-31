# M1 人生推演 · 交付报告（income-v1-2026-10-24d）

- **时间**：2026-10-24 22:45 Asia/Shanghai
- **分支**：`feat/projection-engine`
- **提交**：`e79a79a`（相对 origin ahead 3；未 merge main；未 push moongrains）
- **环境**：A2 `~/apps/butterfly-effect-a2` @ DGX `127.0.0.1:18887`（单进程；prod 8787/8791 未动）
- **收入表**：`income-v1-2026-10-24d` · 参数行 172 · 台账 45 · scopes city/province/region
- **Fallback**：同城 L1→L2→L3 → 区域（川渝）→ 省级（台账 sampleLabel）→ 无区间 + 用户自填；不用其他城市近似

## 本轮关键（薪资再导入）

1. 重导 `salary_reference.xlsx`（补充-其他城市 / 补充-京沪杭 / 省级兜底）+ 标准台账 45 行。
2. 分位口径按行：`percentileLow/Mid/High` + `bandLabel`；南京为 **P10/P50/P90（低–高）**，禁止 UI/文案写死「P25–P75」。
3. 北京无职业 L1 → L2 行业均值（`bandKind=industry_mean`），来源展示行业名。
4. 上海行业均值缺失 → 现网证据为同城 L3 应届起薪（或用户自填路径仍可用）。
5. 武汉/长沙：跳过城市 L3 应届混合行，走省级「省级样本 ≠ 单市」。
6. 成都/重庆：走川渝区域「区域样本 ≠ 单市」。
7. 西安等城市保留较完整 L1。

## 离线 R 校验

`node scripts/test-projection.mjs`：**全部通过**（R1–R3、R6、R8–R12、R17、危机、薪资表规则、incomeFallback 含南京/武汉/成都/北京新断言）。

证据：`/workspace/butterfly-handoff/offline-projection-test-2026-10-24d.txt`

## A2 在线收入证据（API）

脚本在 DGX 本机跑：OTP mock `000000` + 敏感同意 → gap → confirm → skeleton。

| case | city | scope | tier | bandLabel | sample/industry | latency | result |
|------|------|-------|------|-----------|-----------------|---------|--------|
| nanjing_l1 | 南京 | city | L1 | P10–P90（低–高） | — | 3888ms | PASS |
| beijing_l2_mean | 北京 | city | L2 | 行业平均 | 信息传输、软件和信息技术服务业 | 3870ms | PASS |
| wuhan_province | 武汉 | province | L1 | P25–P75 | 省级样本 ≠ 单市 | 3860ms | PASS |
| chengdu_region | 成都 | region | L1 | P25–P75 | 区域样本 ≠ 单市 | 3860ms | PASS |
| shanghai_sparse | 上海 | city | L3 | P50–P75（应届起薪） | — | 3871ms | PASS |
| xian_l1 | 西安 | city | L1 | P25–P75 | — | 3865ms | PASS |

- **汇总**：6/6 PASS · tableVersions=['income-v1-2026-10-24d']
- 证据 JSON：`/workspace/butterfly-handoff/a2-income-evidence-2026-10-24d.json`
- 骨架规则耗时（含 gap LLM）：约 **3.8–3.9s/案**（gapExtract ~3.8s；ruleMs 亚秒级，见各案 steps）

### 关键核对

- 南京：`P10–P90（低–高）` · L1 · city
- 北京：`行业平均` + 行业名「信息传输、软件和信息技术服务业」· L2 · industry_mean
- 武汉：scope=province · sample「省级样本 ≠ 单市」
- 成都：scope=region · sample「区域样本 ≠ 单市」
- 上海：city L3 应届起薪（无行业均值 L2）
- 西安：city L1

## UI

`public/projection.js` incomeCard：按行展示 `bandLabel` / `sampleLabel`；行业均值显示「约 X · 行业平均」。已随 tar 部署到 A2 并 `npm run build`。

浏览器 R4 全链路（Mac 隧道 `:18888` 手机预览）本轮以 API 证据为主；UI 文案已在源码与 dist 侧核对。若需截图，可经既有 SSH 隧道打开推演页复核标签。

## 部署

- tar-pipe → `~/apps/butterfly-effect-a2` only（未动 `~/apps/butterfly-effect` / 8787 / 8791）
- `npm run build` → 重启 `node scripts/dgx-server.mjs` · `unauth=401`

## 阻断 / 未做

- 未 merge main；未 push moongrains；未触达生产 DGX 应用目录。
- 大规模薪资采集已暂停（按 steering）。
- 上海仍缺行业均值 L2；用户自填路径保持开启。
- 浏览器端 R4 截图未在本轮重跑（API 6/6 + 离线全绿）。

## 父代理可接手

- 分支/提交：`feat/projection-engine` @ `e79a79a`
- 在线表版本：`income-v1-2026-10-24d`
- R：离线全绿；在线收入 6/6 PASS
- 延迟：gap+骨架 ~3.9s/案（LLM gap 主导）

### 区间样例（税前应发·每月，规则层输出）

| case | low–high | percentiles | bandKind | R10 | shareCard.income |
|------|----------|-------------|----------|-----|------------------|
| nanjing_l1 | 7000–16600 | P10–P90 | percentile | pass | absent |
| beijing_l2_mean | 约 28400 | — | industry_mean | pass | absent |
| wuhan_province | 6300–9900 | P25–P75 | percentile | pass | absent |
| chengdu_region | 4800–8900 | P25–P75 | percentile | pass | absent |
| shanghai_sparse | 6800–7400 | P50–P75（应届） | percentile | pass | absent |
| xian_l1 | 4300–9400 | P25–P75 | percentile | pass | absent |

禁止词「失败」族：推演 JSON 扫描 **0 hits**。分享卡不含 income。

## 浏览器挂死修复（2026-10-24 22:45 Asia/Shanghai）

### 根因
- A2 在「确认并生成推演」后 **服务端已成功落盘**（gap LLM ~6s；skeleton 规则层 ~7–16ms），并非 confirm 误走 LLM、进程崩溃或 generating 锁。
- 浏览器经 box `:18888` → SOCKS → Mac `a2-host-proxy` → SSH 隧道 → DGX `:18887` 时，偶发 **空响应 / 连接中断**（`ERR_EMPTY_RESPONSE`、`UND_ERR_SOCKET`、Content-Length 错配），客户端一直停在「正在生成推演…」；刷新后再卡「正在读取你的推演记录…」。
- 差距弹窗显示 `ability` 等英文 key：`params.dims` 为数组，UI 误用 `dims[k].label` 映射。

### 修复
1. **UI**（`public/projection.js`）：`dimLabel` + `DIM_FALLBACK`（能力/资质…）；`confirm` 改为单次 `generate:true`；`fetch` 超时 + 一次重试；失败清 loading、toast「暂未生成成功，请重试」（无「失败」字）；`loadLatest` 失败退出「正在读取…」。
2. **API**（`worker/projection-api.js`）：`gap/confirm` 支持 `generate:true` 同响应返回骨架；响应带 `dimLabels`。
3. **DGX**（`scripts/dgx-server.mjs`）：响应显式 `Content-Length`（按 buffer 长度），降低代理错配。

### 复验（本轮，无浏览器）
| 路径 | gap | confirm+generate | latest | 备注 |
|------|-----|------------------|--------|------|
| DGX loopback `:18887` | 4433ms | **16ms**（ruleMs 11） | 3ms | dimLabels=能力…；validation pass |
| box→Mac 预览 `:18888` | 4746ms | **905ms**（ruleMs 2） | 835ms | PROXY_OK；Bearer→会话头正常 |

- 离线：`node scripts/test-projection.mjs` / `node test-projection-api.mjs` 全绿（含 generate:true）。
- 部署：仅 A2 目录；kill 旧 A2 pid、新 pid 监听 18887；prod `8787`/`8791` 仍在。
- Mac：HTTP 预览路径可用；经 SOCKS 的 Mac SSH 本轮偶发失败（可能休眠/隧道抖），**未重启** Mac 上 `a2-host-proxy`（box→Mac:18888 TCP 仍通）。

### 父代理下一步
请用 computerUse 重跑浏览器点击流；API 侧 gap+confirm+skeleton 经代理已 <10s。

## 浏览器点击流（直连预览，2026-10-24 23:30 Asia/Shanghai）

- **路径**：box `127.0.0.1:18890` → SSH tunnel → DGX A2 `:18887`（绕过 Mac `:18888`）
- **分支/提交**：`feat/projection-engine` @ `e5b1f9d`（含 chart milestones 修复 + R15 占位）
- **A2**：重启后 pid 见部署日志；未动 8787/8791

### 结果：PASS（结果页）

| 步骤 | 结果 |
|------|------|
| 登录 / 角色卡（南京 · 软件工程师） | PASS |
| 打开「推演」离开「正在读取…」 | PASS（约 2.5s，展示已有推演） |
| 徽章「AI生成·模拟非承诺」 | PASS |
| 计划线节点 + SVG 图 | PASS（4 节点，约 0–13 周） |
| R15 灰色占位 | PASS |
| 「按计划执行」假设句 | PASS |
| 节点依据可展开 | PASS |
| 收入 | R10 正确不出区间（`occupation_not_in_table`：表内职业名与「软件工程师」未对齐） |
| 控制台 TypeError | 0 |

### 截图

- `/workspace/butterfly-handoff/projection-ui-smoke/step-02-fix-role-nanjing-engineer.png`
- `/workspace/butterfly-handoff/projection-ui-smoke/step-03-fix-projection-result.png`
- `/workspace/butterfly-handoff/projection-ui-smoke/step-04-fix-node-evidence.png`
- `/workspace/butterfly-handoff/projection-ui-smoke/step-05-fix-income-insufficient.png`

### 已知跟进（不挡演示门禁）

1. Mac `:18888` 预览链路仍不稳定（空响应）；真机预览需改用 box 直连或修好 Mac 代理。
2. 职业别名映射：UI「软件工程师」未命中薪资表职业名 → 不出收入区间（符合 R10）；后续加别名表即可。
3. 部署静态资源后若 Node 内嵌旧 bundle，需重启 A2 进程（本次已重启）。
