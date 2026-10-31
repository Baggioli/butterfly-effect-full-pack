# 独立协作约定

- 从此仓库新建开发分支，作为独立版本迭代；先验证，再通过提交或补丁合并。
- 不擅自修改原 DGX 现有应用、Ollama、Docker、Tailscale、OpenClaw、驱动或其他服务。
- 需要实机部署时，先确认使用者授权的独立目录、端口和服务名称；原仓库的部署脚本会更新原应用，不要直接执行。
- Node 20.19+；前端与接口不需要 npm install。执行 `npm test`、`npm run build`、`npm run validate`。
- Python 语音依赖必须在独立环境安装，TTS 和 ASR 的 transformers 版本不同，不要混装。
- 不把示例任务、模拟接口或合成语音测试冒充真实用户验收。
- 个人真实数据在另一个本机交接压缩包内，没有上传到本仓库。未知资料不能自行填充。


- public/为源文件；worker/index.js与dist/由构建生成。
- 个人数据、验证原始记录、口令、密钥、.runtime、模型权重与Python环境禁止提交。
- 项目规格与已知问题以PROJECT_VISION.md、CURRENT_STATE.md、ARCHITECTURE.md为准。
- 不复制原Site project_id作为本版本发布身份；需要发布时建立独立目标。
- 修改语音必须验证播报结束后才录音、取消/切文字释放设备、静音不推进、未知保持未知。
