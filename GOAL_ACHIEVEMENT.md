# 目标进展报告

## 目标状态：阶段性达成，发布验证未闭环

当前主线是 **Vue + Milkdown + Tauri**。文档完成度和工程完成度已统一为同一套口径：主线能力已有代码和自动化验证支撑，`.app`、ad-hoc 签名的 headless DMG、本地 DMG 启动 smoke 和 Developer ID 签名/公证脚本可验证，但发布前还缺人工端到端验收记录，以及带真实证书的 Developer ID 签名、公证和 notarized 安装后启动验证。

## 完成度对比

| 维度 | 当前完成度 | 客观说明 |
|------|------------|----------|
| 文档完成度 | 较高 | README、FINAL_REPORT、GOAL_ACHIEVEMENT、PROJECT_SUMMARY、TESTING、ROADMAP 已按当前主线重写或修正 |
| 工程完成度 | 中高 | 核心编辑、保存、评论、搜索、导出路径已有实现和测试入口 |
| 发布完成度 | 中 | 缺少原生系统交互人工验收记录；headless DMG、本地启动 smoke 和 `release:notarize` 脚本可验证，但当前机器没有有效 Developer ID identity |

## 已验证或已有验证入口

| 项目 | 状态 |
|------|------|
| 可重复安装 | `CI=true pnpm install --frozen-lockfile` |
| 前端测试 | `pnpm test -- --run` |
| 类型检查 | `pnpm exec vue-tsc --noEmit` |
| 前端构建 | `pnpm build` |
| Rust 测试 | `cd src-tauri && cargo test` |
| Tauri `.app` 构建 | `pnpm run tauri:build` |
| headless DMG 构建 | `pnpm run tauri:build:dmg` |
| 本地 DMG 启动 smoke | `pnpm run smoke:dmg` |
| Developer ID 签名/公证入口 | `pnpm run release:notarize` |
| 真实窗口核心 E2E | `pnpm run test:e2e` |

## 已完成的关键修正

- 评论字段契约统一为前端 camelCase 与 Rust camelCase 输出兼容，同时兼容旧 snake_case。
- 评论 sidecar 存储 ID 改为稳定文档路径派生，不再依赖内容 hash。
- 打开文件加载评论时会基于当前内容刷新锚点 offset 和 confidence。
- 保存状态等待真实写盘 Promise 成功后才显示已保存。
- App 级测试覆盖打开文件夹、打开文件、保存、评论、重开、搜索打开、导出 HTML。
- Rust 命令层测试覆盖文件读写、评论持久化、内容变化后评论仍可加载、搜索和 HTML 导出。
- WebdriverIO + Tauri embedded provider 已接入，覆盖真实窗口加载、打开临时目录、打开 Markdown、保存、评论持久化、文件名搜索、内容搜索、导出 HTML，以及新 Tauri 进程重开后的评论读取。

## 仍未达成

- 尚未完成一次真实 Tauri 窗口人工端到端验收记录，尤其是原生系统对话框、真实键盘编辑和手工关闭重开操作。
- WebdriverIO 窗口 E2E 仍使用 `e2e` 模式固定路径、测试专用编辑钩子和程序化文本选择辅助，不能替代全部人工验收。
- headless DMG 构建和本地启动 smoke 已具备，App 会做 ad-hoc 签名，但 Developer ID 签名、公证和 notarized 安装后启动验证仍未闭环；原 Tauri Finder-style DMG 路线保留在 `pnpm run tauri:build:dmg:tauri`，当前环境仍会卡在 `bundle_dmg.sh` 的 Finder/AppleScript 美化阶段。
- 评论高亮和评论卡片联动还需要真实 UI 验收。

## 下一步

1. 按 `TESTING.md` 跑完整手工端到端验收。
2. 补 Developer ID 签名、公证和 notarized 安装后启动验证。
3. 收敛窗口级 E2E 自动化，减少测试专用编辑钩子和程序化选择辅助。
4. 补评论高亮和大文件性能验证。

**当前结论**：目标已进入可验证阶段，但不能声明发布完成。
