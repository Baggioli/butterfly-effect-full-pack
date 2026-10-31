# 蝴蝶效应 · V0.3设计记录

## 参考机制

- LifePilot：https://getlifepilot.org/ai-goal-planner/ — 目标拆解、有限每日行动、按实际执行重排。
- TheGreatMe：https://www.thegreatme.app/ — 长期主线与日常行动、进展/障碍记录、周期复盘。
- Habitica：https://habitica.com/ — 行动的游戏化反馈。本产品不采用断签惩罚。

## 美术资源

使用内置 image_gen 生成原创生活岛屿，用作装饰性场景，不承载精确数据。资源路径：`/workspace/sites/butterfly-effect/dist/assets/life-world-v3.png`。通过原文件直接复制到项目，未使用外部游戏或品牌素材。

最终提示词：

Use case: stylized-concept. Asset type: an original mobile life-goal simulation app's decorative world illustration. Create a beautiful small isometric diorama, wide 3:2 framing, on a pale warm ivory background. A gently winding pale sand path connects a cozy mint-roof home with a laptop desk visible, a small peach-colored creative studio, a tiny outdoor coffee meeting spot, and a sunlit hill with a golden butterfly flag. One tiny adult character stands by the home. Rounded clay-like 3D forms, exquisitely clean soft ambient occlusion, sage green trees, pastel apricot, cream and muted golden accents, calm hopeful adult aesthetic, premium indie life simulation game art. The path is artistic scenery not an exact information diagram. Keep buildings readable at mobile width. No writing, no text, no UI, no labels, no logo, no watermark, no franchise characters. All important details within generous margins.

## 核心限制

场景与故事为原创规则模板，并非已经接入通用大模型。长期叙述是条件式路线而非人生预测。真实微信键盘需后续真机验收。当前发布为浏览器Demo。
