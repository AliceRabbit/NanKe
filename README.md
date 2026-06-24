# 🌙 NanKe (南柯)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: WIP](https://img.shields.io/badge/status-WIP-orange.svg)
![Stars Welcome](https://img.shields.io/badge/stars-welcome-yellow.svg?logo=github)
![Issues Welcome](https://img.shields.io/badge/issues-welcome-brightgreen.svg?logo=github)
![Package Manager: pnpm](https://img.shields.io/badge/package%20manager-pnpm-F69220.svg?logo=pnpm)

> **重构“酒馆式”对话体验 —— 更轻、更稳、更纯粹。**

NanKe 致力于打造一个现代化的 AI 角色扮演与文本创作平台。本项目并非对已有酒馆项目的简单复刻，而是从零开始的重新思考：抛弃沉重的历史包袱，使用现代化的技术栈与架构，专注真正重要的“角色对话”与“设定管理”。

我们相信，一个优秀的对话工具应该轻盈、稳定且克制。拒绝无意义的功能堆叠，回归创作与陪伴的本质。

## ✨ 核心理念与特性

- 🪶 **体验优先，保持克制：** 以真实的日常使用体验为中心，不为了增加功能而牺牲界面的流畅感与逻辑的直观性。
- 🧩 **现代架构，轻装上阵：** 摒弃为了强行兼容旧系统而产生的冗余代码，保持项目结构清晰，降低后续开发与维护的门槛。
- 📦 **资产兼容，无缝衔接：** 兼容社区中有价值的旧资产，但不继承不必要的历史数据结构。
- 🛡️ **稳定可靠，聚焦核心：** 认真对待并妥善保护用户长期积累的对话数据。优先打磨核心对话体验，再逐步扩展周边能力。

## 🚧 项目状态

**目前项目仍处于早期开发阶段 (WIP)。**
底层架构与 UI 正在快速迭代调整中，随时可能发生破坏性变更。欢迎点亮 ⭐️ Star 关注项目的最新进展！

## 🚀 快速开始

### 前置要求
- [Node.js](https://nodejs.org/) (推荐较新版本)

### 安装与启动

1. **克隆项目并进入目录**
```bash
git clone https://github.com/你的用户名/NanKe.git
cd NanKe
```

2. **配置包管理器并安装依赖**
```bash
# 启用预设的 pnpm 版本
corepack prepare pnpm@11.5.1 --activate
pnpm install
```

3. **启动开发环境**
```bash
pnpm dev
```
启动成功后，在浏览器中访问终端提供的地址即可体验（默认通常为 `http://127.0.0.1:5173/`）。

## 🛠️ 常用开发指令

在项目根目录下，你可以运行以下命令：

| 命令 | 说明 |
| :--- | :--- |
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 打包构建生产版本 |
| `pnpm check` | 运行代码语法与类型检查 |

## 🤝 参与贡献

欢迎通过 Issue 反馈问题、提出建议或补充兼容性案例。Pull Request 也同样欢迎，但在项目早期快速迭代阶段，建议先通过 Issue 简要说明想调整的方向，避免重复工作。

## 📄 开源协议

NanKe 使用 [MIT License](LICENSE) 开源。你可以自由使用、修改、分发和二次开发本项目。
