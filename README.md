# 正念木鱼

一个优雅简约的正念木鱼渐进式网页应用（PWA），帮助用户在数字世界中获得片刻宁静。

## 特色功能

- 精美的木鱼敲击动画效果
- 真实的木鱼音效，带来沉浸式体验
- 完整的PWA支持，可安装到桌面使用
- 正念积分系统，激励持续练习
- 优雅的气泡动画效果
- 积分统计和历史记录
- 响应式设计，完美适配各种设备
- 离线使用功能

## 技术栈

- HTML5 + CSS3 + JavaScript
- PWA (Progressive Web App)
- LocalStorage 用于数据持久化
- Service Worker 实现离线功能
- Web Audio API 处理音频
- CSS3 动画效果

## 安装说明

### 方式一：直接使用

1. 访问在线地址：[https://maikami.com/woodenfish/](https://maikami.com/woodenfish/)
2. 在支持PWA的浏览器中，可以点击地址栏的"安装"按钮将应用添加到桌面

### 方式二：本地部署

1. 克隆项目到本地
2. 确保所有资源文件齐全：
   - `woodfish.png` - 木鱼主图
   - `stick.png` - 木鱼棒图片
   - `woodfish-sound.mp3` - 基础音效
   - `woodfish-sound1.mp3` - 随机音效1
   - `woodfish-sound2.mp3` - 随机音效2
   - `颂钵.mp3` - 特殊音效
   - 其他图标文件在 `icons` 目录下
3. 使用本地服务器（如 Live Server）运行项目

## 使用指南

1. **基本操作**
   - 点击木鱼发出敲击音效
   - 长按木鱼可以触发连续敲击
   - 每敲击5下会随机获得1-5个正念积分

2. **积分系统**
   - 积分会以气泡动画形式显示
   - 累计积分会保存在本地
   - 可以查看历史积分记录

3. **离线使用**
   - 首次访问后，应用可离线使用
   - 所有音效和图片资源都会被缓存

4. **设备支持**
   - 支持电脑和移动设备
   - 支持触屏和鼠标操作
   - 支持键盘空格键操作

## 贡献指南

欢迎提交 Issue 和 Pull Request 来完善这个项目。在提交代码前，请确保：

1. 代码风格保持一致
2. 新功能有充分的注释说明
3. 所有资源文件都已正确引用

## 开源协议

本项目采用 MIT 协议开源，详见 LICENSE 文件。

## 致谢

感谢所有为这个项目提供反馈和建议的用户。
