# Markdown Reader

[English](README.md) | 中文

<p align="center"><img src="src-tauri/icons/icon.png" alt="Markdown Reader Logo" width="128"></p>

> 本地优先的 macOS Markdown 编辑与审阅工具：锚定评论、工作区搜索、中文翻译副本和独立 HTML 导出。

Markdown Reader 可在原文件夹编辑 Markdown、留下锚定审阅评论、搜索工作区并导出独立 HTML。核心流程无需账号或 API Key；可选 AI 请求会先征求同意。

## 本地运行

需要 macOS、Node.js 24+、pnpm 11.7.0 和 Rust 1.96+。

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

此公开源码镜像不包含内部测试和项目记录。当前 macOS 测试版尚未完成 Developer ID 签名与公证。请查看[测试版限制](BETA_LIMITATIONS.zh-CN.md)和[隐私声明](PRIVACY.zh-CN.md)。

依据 [MIT 许可证](LICENSE)开放源码。
