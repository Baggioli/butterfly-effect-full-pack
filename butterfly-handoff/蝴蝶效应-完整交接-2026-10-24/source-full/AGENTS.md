# 本地开发约定

- 正式开发目录：`/Users/lq/Documents/Codex/butterfly-effect`。该目录是独立本地 Git 仓库。旧聊天镜像里的同名目录是迁移快照，不应与主目录轮流开发。
- 手机端原型已交接。云端最新保存版本为第5版，提交 `d6220b53b42dcaf0b48ae29ece34bcc3867dd770`；本地仓库历史从迁移快照开始，不冒充云端原始 Git 历史。
- 前端源文件在 `public/`；`worker/api.js` 是模型接口；`worker/index.js` 和 `dist/` 由构建生成，不直接编辑生成内容。
- Mac 预览 `127.0.0.1:4173` 读取本目录前端源文件。模型接口经本机 SSH 隧道 `127.0.0.1:8787` 调用 DGX 上的后端。前端修改刷新可见；后端修改需先测试，再执行 `npm run deploy:dgx` 才进入真实模型运行环境。
- `npm test` 执行功能/接口/认证/开发代理测试；`npm run build` 与 `npm run validate` 检查构建。静态文案小改按风险选择必要检查。
- 凭据不写入源码、聊天、日志或 Git。`.runtime/` 只放忽略的运行状态与不含用户档案的服务日志。
- 复用 `ssh dgx`，保持主机密钥校验。不要修改现有 OpenClaw、Ollama、Docker、Tailscale 或其他服务配置。
- 不自动切换外部模型，不把模板当作真实推理。年龄学历不作为能力上限；未知保持未知；计划先审核，保留历史与撤销。
- 浏览器 localStorage 不会随代码迁移。不得声称手机用户记录已自动迁移。
- 默认只在本地开发/部署 DGX。未获用户要求不重新发布云端 Site，不扩大访问范围。

- 面向使用者的按钮、提示与标签使用普通产品语言，不显示AI、DGX、Ollama等技术名称；不将示例路线冒充定制结果。
- 本机4173按用户明确要求免口令，仅监听回环并限制跨来源写入，不要恢复口令界面。手机8443仅允许本人Tailscale身份，不开启公网Funnel。验证使用test-direct-access.mjs和scripts/check-browser-flow.mjs。
- 用户已授权新增手机专用Tailscale HTTPS8443入口，维护时保留原443及其Funnel配置。手机独立服务为butterfly-effect-mobile.service；部署后需重启该服务加载新构建。

- 聊天建档入口在public/onboarding.js，公共证据与问序逻辑在public/onboarding-core.js。维护时运行test-onboarding.mjs；事实与有待确认的理解必须分开，未知可跳过。14天近况支持文字，不清空旧任务。
- 私有语音为butterfly-effect-speech.service，回环8791，模型与环境不入Git，录音不落盘。保持av==18.1.0兼容固定版本，运行时离线。

- 首次首页采用连续语音优先：public/voice-turn.js控制自然停顿，test-voice.mjs验证轮次。不得恢复每轮转写后点击发送为默认方式；切文字、后台、关闭必须取消待完成的麦克风请求。版面用minmax(0,1fr)和min-width:0，避免快捷选项撑宽。

- 系统提问与回应必须实际播报：public/voice-output.js优先播放私有/api/speech/speak音频，本地设备中文声音只作回退。需运行test-voice-output.mjs；不能只模拟朗读API就声称实际播放。声音模型.tts-model不入Git，语音服务同时提供synthesis与transcription状态。

- 语音验收区分：试听、真实硬件音量、合成流两轮端到端、真人交流。不得将前三者冒充真人完成。静音和字幕幻觉不能推进建档；speech_quality.py与test_speech_quality.py维护服务端人声质量。优先使用已安装.speech-model-turbo，CPU int8，旧模型保留回退。

- 自然语音升级保持两套Python3.12环境分离：qwen-tts依赖transformers4.57.3，qwen-asr依赖4.57.6。新服务回环8792/8793；8791只在BUTTERFLY_NATURAL_SPEECH=1时转用新模型，保留原模型回退。运行离线，禁止记录录音、对话音频与转写；speechChunks分段预取的整轮末尾才开启麦克风。

- 部署包仅包含运行源码public/worker/scripts、package.json、.openai与.gitignore；真人验证文档和报告只保留本机，不随部署同步。

- 用户声音偏好：稍慢、柔和。natural-speech-server.py使用speech_pacing.py固定0.85语速，保持音高；更改时在DGX自然人声环境运行scripts/test_speech_pacing.py并验证真实播报。
