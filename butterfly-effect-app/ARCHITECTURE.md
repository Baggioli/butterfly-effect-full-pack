# 架构与数据

## 源码地图
- public/app.js：主应用、旅程/行动/反馈、localStorage；public/story.js：四幕和任务规则。
- public/onboarding.js：聊天建档与语音会话；onboarding-core.js：事实证据、字段、问序与跳过。
- public/voice-output.js：私有音频播放、分句预取；voice-turn.js：自然停顿检测；audio-devices.js：设备识别。
- worker/api.js：业务接口及本地Ollama调用；worker/index.js、dist/由构建生成，不直接改产物。
- scripts/dev.mjs：Mac4173前端和私有API代理；dgx-server.mjs：DGX8787后端。
- scripts/mobile-server.mjs/private-gateway.mjs：手机私有入口。
- scripts/speech-server.py：8791语音网关，先做人声检测。BUTTERFLY_NATURAL_SPEECH=1转用新语音模型。
- scripts/natural-speech-server.py：独立tts模式8792、asr模式8793；speech_pacing.py：保持音高放慢；speech_quality.py：噪声假设拦截。
- scripts/download-natural-models.py：官方ModelScope下载与SHA-256校验；各requirements.txt：环境约束。

## 接口
GET /api/speech/status；POST /api/speech/speak {text}→WAV；POST /api/speech/transcribe 原始音频→{text}或422。
POST /api/ai 使用 mode=interview/plan/adjust/extract。interview返回事实证据和单个后续问题；plan返回四幕故事。数据校验、同来源限制和私有身份验证在后端执行。

## 数据
浏览器键 butterfly-v1：{active, users, chatDraft?}。users保存角色信息、任务、历史版本、观察、成果、笔记和旅程状态；chatDraft包含消息、profile、evidence、interpretations、asked、skipped和当前阶段。实际结构以public/app.js及onboarding.js为准。
角色字段包括goal、role、constraints、age、education、skills、hours、resources、experience、interests、recentUpdate，姓名单独保留。证据要能回指用户原话，推测不得伪装事实。
数据库当前在各浏览器localStorage，没有服务端统一账户数据库。应用不持久化录音或对话音频。Github仓库不包含真人资料。

## 原环境连线（仅参考，未经授权不得更新原运行实例）
Mac127.0.0.1:4173→SSH隧道127.0.0.1:8787→DGX后端→Ollama127.0.0.1:11434。
原DGX应用目录~/apps/butterfly-effect；模型接口回环监听，原SSH别名dgx。手机独立服务127.0.0.1:8790，经Tailscale私有HTTPS8443；原443另有服务/Funnel，必须保留。
新环境需要自己的安全凭据与主机授权，本仓库不附任何口令、密钥或登录令牌。
