# Markdown Reader

[English](README.md) | 中文

<p align="center"><img src="src-tauri/icons/icon.png" alt="Markdown Reader Logo" width="128"></p>

> 本地优先的 macOS Markdown 编辑与审阅工具：锚定评论、工作区搜索、中文翻译副本和独立 HTML 导出。

## 审阅流程

1. 打开你控制的文件夹，直接编辑 Markdown 源文件。
2. 选中段落，添加与源文件分开存储的锚定评论。
3. 搜索工作区，再导出独立 HTML 阅读版交付他人。

应用也能另建中文翻译副本。可选 AI 操作会在把当前文档发送给你选择的服务商前征求同意。

## 隐私与测试版状态

本地编辑、评论、搜索和导出无需账号或 API Key。桌面应用没有内置使用分析。保存的 OpenAI 兼容服务 API Key 位于当前用户的应用配置目录；详情见[隐私声明](PRIVACY.zh-CN.md)。

v0.9.2 是 Apple 芯片版 macOS 测试版，尚未完成 Developer ID 签名或公证。请为重要文档保留副本，并阅读[测试版限制](BETA_LIMITATIONS.zh-CN.md)。

## 本地运行

需要 macOS、Node.js 24+、pnpm 11.7.0 和 Rust 1.96+。

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

此公开源码镜像不包含内部测试和项目记录。依据 [MIT 许可证](LICENSE)开放源码。
