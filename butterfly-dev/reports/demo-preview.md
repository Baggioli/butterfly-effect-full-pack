# Demo 预览说明（薄 mock）

**目的**：本地看手机号登录 / 双协议勾选 / 敏感同意 / 导出·注销，不接真短信、不接 DGX。

## 一键（含 mock API）

在仓库根目录：

```bash
cd /workspace/butterfly-dev
npm run demo
# 或：DEMO_PREVIEW_PORT=18080 node scripts/demo-preview.mjs
```

- 地址：<http://127.0.0.1:18080>
- 端口范围：`18000–18999`（默认 `18080`）
- Mock 验证码：`000000`（`SMS_PROVIDER=mock`）
- 协议页：`/legal/terms.html`、`/legal/privacy.html`（草稿，非正式生效）

演示路径建议：欢迎页 → 登录 → 勾选两协议 → 获取验证码 → 输入 `000000` → 敏感信息同意 → 示例人生；「我的」→ 导出我的数据 / 注销。

## 仅 UI（无 `/api`）

```bash
cd /workspace/butterfly-dev/public
python3 -m http.server 18081 --bind 127.0.0.1
```

打开 <http://127.0.0.1:18081>。登录/导出等会请求失败，只适合看静态页与法律草稿。

## 注意

- 不推 remote、不碰现网 DGX 端口、不调真实短信。
- 服务端账号存内存 Map，进程退出即清空；不迁移旧设备 localStorage。
