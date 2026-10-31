# DGX 私有运行

这是独立于云端演示地址的本地运行入口。2026-10-21 已完成 Mac SSH 到 DGX 的独立部署与真实推理测试；当前状态、实测耗时、质量限制和启动方式见[本地部署与实测报告](本地部署与实测报告.md)。下面保留手动运行说明。

## 数据路径

在DGX上运行应用和Ollama。Mac通过现有SSH/Tailscale连接转发本地端口，浏览器访问本机入口。档案仍保存在浏览器，模型请求经SSH加密到DGX，不经过Sites云端后端或外部模型API。

应用服务仅监听DGX的127.0.0.1:8787；Ollama仅从同机127.0.0.1:11434调用。不要将11434映射到公网。当前本地入口适用于所有者个人测试；多人账户隔离、手机号登录、服务端资料库和正式微信小程序尚未包含。

## DGX上准备

将项目完整源代码放到DGX的独立目录，保留现有服务不动。需要Node.js 20.19+，无需安装npm依赖。

1. 用 `ollama list` 确认本地模型和名称，不能选云模型。
2. `bash scripts/build.sh` 构建应用。
3. 使用会话环境变量设置至少16字符的 `DGX_APP_PASSWORD`，不要写入Git或把密码发到聊天。
4. 可设置 `AI_MODEL` 为已安装的本地模型，例如 `qwen2.5:7b` 或 `deepseek-r1:32b`。模型选择须以实际测试的JSON完整性、剧情质量和耗时为准。
5. 运行 `node scripts/dgx-server.mjs`，窗口保持开启。启动程序不修改现有Ollama、OpenClaw、Docker或防火墙。

推荐在DGX终端隐藏读取口令（输入不会回显）：

```bash
read -rsp '设置应用访问口令（至少16位）: ' DGX_APP_PASSWORD
export DGX_APP_PASSWORD
node scripts/dgx-server.mjs
```

## Mac访问

在Mac终端用现有DGX的SSH连接信息建立转发，将下方占位符替换为已确认的连接信息：

```bash
ssh -N -L 127.0.0.1:8787:127.0.0.1:8787 用户名@DGX的Tailscale地址
```

浏览器打开 `http://127.0.0.1:8787`，用户名 `owner`，密码为上述应用访问口令。SSH负责跨机器的加密传输；不要直接把这个HTTP/Basic入口暴露到公网。

手机远程访问需要另行配置受限的Tailscale HTTPS入口与身份验证，本版不自动配置。已有云端网页不能通过浏览器跨域直接调用DGX的HTTP接口，也不会自动加入Tailscale私网。

## 隐私边界与验证

- 默认模型提供者为Ollama；未连通时明确报错，不自动切换外部模型。
- 先查询本地模型元数据，发现远程模型标记时拒绝发送用户资料；API请求限制为环回、内网或Tailscale地址，并禁止重定向。
- 应用不记录提示词、档案、生成内容或访问口令到服务日志；浏览器数据、操作系统日志、SSH配置、备份及Ollama自身日志仍需实际部署时检查。
- “已配置”不代表实机推理已验证；请在DGX上分别执行一次档案提取、完整故事生成、根据反馈重规划，检查耗时、JSON完整性和个性化差异。
- 当前代码测试使用模拟响应，不包含实际DGX模型质量或吞吐量测试。

API依据：https://docs.ollama.com/api/chat 与 https://docs.ollama.com/capabilities/structured-outputs 。

## 自然中文语音（2026-10-23）

运行库与旧语音服务隔离，不修改现有容器或系统驱动。
- `.venv-voice-natural`：Python3.12，`scripts/natural-tts-requirements.txt`，Qwen3-TTS 1.7B CustomVoice，Serena中文预置音色，温和日常聊天指令，CUDA bfloat16/SDPA。
- `.venv-asr-natural`：Python3.12，`scripts/natural-asr-requirements.txt`，Qwen3-ASR 1.7B，CUDA bfloat16/SDPA。两库transformers版本不同，必须保持独立。
- 模型下载：`python scripts/download-natural-models.py`，从Qwen官方ModelScope仓库下载，校验每个文件SHA-256。运行时HF_HUB_OFFLINE=1，不下载、不上传录音。
- 独立服务`butterfly-effect-natural-tts.service`（127.0.0.1:8792）与`butterfly-effect-natural-asr.service`（127.0.0.1:8793），入口均为`natural-speech-server.py`，分别传入tts/asr。
- 既有8791语音服务设置`BUTTERFLY_NATURAL_SPEECH=1`后，静音检测通过才把音频转到新识别模型；合成请求转到新音色。没有该设置时仍可运行原模型，回退时仅移除本项目speech.service的natural.conf并重启该服务。
- 新版前端按自然句分段、预取下一段，所有段播完才开始聆听。私人文本、录音与生成的对话音频不写磁盘或请求日志。
- 8条独立Mac系统声音样本：旧模型平均3.392秒，新模型0.439秒；新模型归一化标点后的字符错误0/118。旧模型5/118中有3处来自45/四十五的书写形式差异，不能把全部差异称为语义错误。此为合成样本，不代表真人识别率。
