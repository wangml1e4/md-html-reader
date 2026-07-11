# 项目实施总结

## 当前工程状态

项目当前主线是 **Vue + Milkdown + Tauri**。历史 HTML 原型仍保留在仓库中，用于说明早期验证过程，但不再代表当前架构。

当前工程完成度可以判断为：**核心主线已具备，发布闭环未完成**。

## 已具备能力

- Tauri 2 桌面应用入口
- Vue 3 + Pinia 状态管理
- Milkdown Markdown 编辑器
- Rust 文件夹扫描、读取、写入命令
- 评论锚点算法和评论 sidecar 存储
- 前端 camelCase 评论字段与 Rust 序列化兼容
- 稳定路径派生的评论 sidecar ID
- 打开文件加载评论时的锚点重定位和 confidence 标记
- 保存状态与真实写盘 Promise 对齐
- 文件名搜索、内容搜索和 HTML 导出入口
- App 级用户流测试和 Rust 命令层核心路径测试
- WebdriverIO 真实 Tauri 窗口核心 E2E，包含新进程重开后的评论持久化验证
- headless DMG 构建入口，包含 App 和 Applications 链接，并对 App 做 ad-hoc 签名
- 本地 DMG 启动 smoke，覆盖挂载、复制、签名校验和启动进程
- Developer ID 签名/公证脚本入口，缺少证书时会安全失败并提示前置条件

## 文档与工程完成度对比

| 维度 | 当前判断 | 说明 |
|------|----------|------|
| 文档完成度 | 较高 | 主 README、总结报告、目标报告、测试指南、路线图已统一当前主线口径 |
| 工程完成度 | 中高 | 核心模块有实现、命令层测试、App 级测试和真实窗口核心 E2E |
| 发布完成度 | 中 | `.app`、ad-hoc 签名的 headless DMG、本地启动 smoke 和 `release:notarize` 脚本可验证，当前机器没有有效 Developer ID identity，完整人工验收也未完成 |

## 自动化验证范围

| 层级 | 覆盖内容 |
|------|----------|
| 前端单测 | 锚点、store、保存状态、搜索面板、App shell |
| App 级集成测试 | 打开文件夹、打开文件、保存、评论、重开、搜索打开、导出 HTML |
| Rust 测试 | 文件读写、评论字段契约、sidecar 稳定路径、搜索、导出 |
| Tauri 窗口测试 | 真实 WebView、WDIO bridge、打开临时目录、打开 Markdown、保存、评论持久化、新进程重开后读取评论、文件名搜索、内容搜索、导出 HTML |

## 未闭环事项

1. 真实 Tauri 窗口完整手工验收还未记录，尤其是原生系统对话框、真实键盘编辑和手工关闭重开操作。
2. WebdriverIO 窗口 E2E 仍使用 `e2e` 模式固定路径、测试专用编辑钩子和程序化文本选择辅助。
3. headless DMG 可生成，App 会做 ad-hoc 签名，本地启动 smoke 可通过；Developer ID 签名、公证和 notarized 安装后启动验证仍需补齐。原 Tauri Finder-style DMG 路线保留在 `pnpm run tauri:build:dmg:tauri`，当前环境仍会卡在 `bundle_dmg.sh` 的 Finder/AppleScript 美化阶段。
4. 评论高亮、侧栏联动和失效提示需要 UI 验收。
5. 大文件性能和边界文档还未压测。

## 后续计划

1. 执行 `TESTING.md` 手工验收清单并记录结果。
2. 补 Developer ID 签名、公证和 notarized 安装后启动验证说明。
3. 在现有窗口核心 E2E 基础上减少测试专用编辑钩子和程序化选择辅助。
4. 补评论高亮和评论定位体验。
5. 增加大文件编辑、搜索和评论重定位压测。

**结论**：项目已从原型进入可验证主线阶段，但当前不能写成发布完成。
