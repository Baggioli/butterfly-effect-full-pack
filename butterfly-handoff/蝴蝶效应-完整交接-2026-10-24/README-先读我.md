# 蝴蝶效应完整交接包 · 2026-10-24

- handoff-docs/：先读START_HERE.md，含项目构思、需求、当前状态、待办和架构。
- source-full/：原本地项目提交f00320b4ef2acef7d427b34c33007835fcd36af1的全部已跟踪源码、素材、文档、测试及原有报告。
- history/local-history.bundle：完整本地Git历史，可用git clone local-history.bundle恢复。不是手机云端原始Git全历史。
- data-private/：本机当前浏览器的真实聊天建档草稿与完整数据库备份，含私人信息，默认不上传任何平台。
- original-handoff/：用户最初提供的手机转本地交接原始zip，原样保留。
- audio-examples/：几次合成语音试听，包含最后的柔和慢速版本；不是用户真人录音。
- runtime/（若存在）：已脱敏的服务定义、依赖清单和模型信息，不含凭据。
- SHA256SUMS.txt：文件清单与校验值。

没有包含：SSH私钥、密码、访问令牌、登录Cookie、模型权重本体、Python环境、其他设备浏览器数据、无法完整导出的历史聊天。大型公开模型通过源码脚本下载；版本环境在requirements和runtime中说明。

这是用户授权生成的私人交接包。分享给其他大模型前，注意data-private/中是你的真实资料；GitHub另有不含个人数据的独立协作版本。

本包不是已经完成微信原生小程序或全部真人验收的证明。最新音色仍需用户主观确认；曾出现的展开故事失败需继续复测。

独立私有GitHub仓库：https://github.com/Baggioli/butterfly-effect-app
其他模型接续入口：START_HERE.md。需要为其GitHub连接授权此新仓库。完整私人数据只在本交接包，不在GitHub。
