# 蝴蝶效应 · 独立协作版

以自然语音聊天了解一个人，把愿望变成角色卡、人生故事和具体行动。

先阅读 [START_HERE.md](START_HERE.md)，再读 [项目构思](PROJECT_VISION.md)、[当前状态](CURRENT_STATE.md) 和 [架构](ARCHITECTURE.md)。

独立项目，禁止推送到 moongrains。当前是移动优先Web应用，尚非已发布微信原生小程序。

Node20.19+，无需npm install。验证：`npm test && npm run build && npm run validate`。

个人数据、密钥、模型权重不在GitHub仓库内；模型提供可重复下载脚本和环境约束。新开发版本不要直接执行原DGX部署脚本，先分配独立目录和端口。
