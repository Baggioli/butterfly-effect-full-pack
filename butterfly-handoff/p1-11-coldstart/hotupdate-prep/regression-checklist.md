# P1-11 热更后回归清单

目标环境：（填写 A2 URL 或 8443）  
戳：（应为 `1.4-p1-11b` 或产品指定；热更前现网仍是 `1.4-p0-23c`）

## 必过
- [ ] **同意门 P0-23**：登录后敏感同意默认 gated；勾选后可点「同意并继续」；失败提示不被清掉
- [ ] **CS1 直接开始聊**：闸上主按钮可见；点后进入文字/语音开聊，不强制导入
- [ ] **CS2 导入路径**：次按钮 → 复制主版提示词 → 粘贴样例 → 角色卡字段无「偏好：/身份：」前缀 → 确认进故事（模板或定制草案）
- [ ] **CS3**：空粘贴 / 乱码有友好提示，可回「直接开始聊」
- [ ] **CS4 `?demo=1`**：无导入入口（或跳过闸直达开聊）；埋点/日志无粘贴原文
- [ ] **ai-plan 可选**：断网或 API 失败时仍停在模板故事，toast 提示可稍后「展开故事」
- [ ] **主路径零回归**：不点导入的老用户建档不受阻

## 本地预跑（不碰 A2）
```bash
cd /workspace/butterfly-dev
node scripts/smoke-p1-11-coldstart.mjs
# 可选 E2E（需本机 Chrome + puppeteer-core）
node scripts/e2e-p1-11-coldstart.mjs
```

## 证据回填
把新截图/报告覆写或追加到 `/workspace/butterfly-handoff/p1-11-coldstart/`，并更新 `report.json` 的 deploy 字段。
