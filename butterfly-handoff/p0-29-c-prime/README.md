# P0-29 C′ / 正式首包复现

## 分支
`feat/p0-29-c-prime-32b` @ `5e9367c`（不 merge main、不热更 A2）

## 环境
1. Ollama 隧道：`ssh -L 11434:127.0.0.1:11434` 到 DGX（本机需有 qwen2.5:7b / 32b）
2. 线上密钥文件（chmod 600，勿提交）：`/workspace/butterfly-secrets/butterfly-llm.env`
3. `node scripts/embed-assets.mjs`
4. `BUTTERFLY_LLM_ENV_FILE=/workspace/butterfly-secrets/butterfly-llm.env node scripts/p0-29-c-prime-sidebyside.mjs`

## 切换模型
- 线上主候选：env 内 `BUTTERFLY_LLM_PROVIDER=deepseek` + key
- 仅本地 32b：`AI_PROVIDER=ollama AI_MODEL=qwen2.5:32b`
- 回退 7b 基线：`AI_MODEL=qwen2.5:7b AI_DEPTH_CONTRACT=0`
- 关深度契约：`AI_DEPTH_CONTRACT=0`

## 产物
- `sidebyside-summary.md` / `sidebyside-report.json`

## 打分材料
- `PRODUCT-NOTES.md`
- `plan-deepseek-primary.json`（主样例）
