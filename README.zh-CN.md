# MD+HTML Reader

[English](README.md) | 中文

> 一个本地优先的 Markdown 工作区，用于编辑、审阅并导出可分享的 HTML。

MD+HTML Reader 是一款面向 macOS 的桌面应用，适合撰写和审阅 Markdown 文件。打开你拥有控制权的文件夹，直接编辑文档、留下锚定评论，再导出独立的 HTML 阅读版。核心编辑、评论、搜索和导出均无需账号或 API 密钥。

## 可以做什么

- 使用所见即所得编辑器编辑 Markdown，文件仍保留在原文件夹中。
- 以原始文本方式查看和编辑 YAML，并保留其语法。
- 添加与源文档分开存储的锚定审阅评论。
- 搜索文件名和工作区内容。
- 将 Markdown 导出为独立 HTML，并可选择嵌入源文件视图。
- 在你明确配置并同意使用 AI 服务商后，生成中文翻译副本或 AI 阅读版。

## 30 秒上手

1. 打开一个包含 Markdown 或 YAML 文件的文件夹。
2. 选择一段文本并添加评论。
3. 打开 **文档工具**，导出 HTML 阅读版。

以上流程无需配置 AI。

## 本地运行

要求：macOS、Node.js 24+、pnpm 11.7.0 和 Rust 1.96+。

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

## 隐私与 AI

应用默认在本地运行。打开、编辑、评论、搜索和 HTML 导出均在你选择的文件夹中执行。

AI 工具完全可选。在创建 AI 阅读版或发起文档助手请求前，应用会征求确认，并只向你选择的服务商发送当前 Markdown 以及必要的未解决评论。API 密钥仅保存在当前会话内存中，不会写入磁盘。详见[隐私声明](PRIVACY.zh-CN.md)。

## Beta 限制

大幅编辑文档后，评论高亮的位置可能不够准确；超大 Markdown 文档尚未完成性能测试。重要工作请保留副本，并在关键工作流中使用前查看 [Beta 限制](BETA_LIMITATIONS.zh-CN.md)。

## 发布状态

这是一款 macOS Beta 版本。项目流程覆盖本地类型检查、前端测试、Rust 测试和生产构建。Developer ID 签名、公证和已公证 DMG 的安装验证仍在进行中；在完成前，请不要将当前产物描述为已完成公证的 macOS 正式版。详见 [发布检查清单](RELEASE_CHECKLIST.md)。

## 开发检查

```bash
pnpm exec vue-tsc --noEmit
pnpm test -- --run
pnpm build
(cd src-tauri && cargo test)
```

## 产品文档

- [隐私声明](PRIVACY.zh-CN.md)
- [Beta 限制](BETA_LIMITATIONS.zh-CN.md)
- [发布检查清单](RELEASE_CHECKLIST.md)
- [人工验收指南](MANUAL_ACCEPTANCE.md)

## 许可证

目前尚未发布许可证。未经项目所有者许可，请勿再分发源代码或二进制文件。
