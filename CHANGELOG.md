# 变更记录

本文只记录当前主线：Vue + Milkdown + Tauri。历史 HTML 原型保留为早期验证材料，不作为当前架构或发布完成度口径。

## 0.9.0 验证版

### 当前能力

- 可重复安装：`CI=true pnpm install --frozen-lockfile`
- 前端测试和构建：`pnpm test -- --run`、`pnpm build`
- Rust 命令层验证：`cd src-tauri && cargo test`
- Tauri `.app` 构建：`pnpm run tauri:build`
- headless DMG 构建：`pnpm run tauri:build:dmg`
- 本地 DMG 启动 smoke：`pnpm run smoke:dmg`
- 真实窗口核心 E2E：`pnpm run test:e2e`

### 已收敛

- 评论字段契约统一为前端 camelCase 与 Rust camelCase 序列化兼容，并保留旧 snake_case sidecar 读取能力。
- 评论 sidecar 文件名改为稳定文档路径派生，内容 hash 只作为版本字段。
- 打开文件加载评论时会基于当前内容刷新锚点 offset 和 confidence。
- 保存状态只在真实写盘 Promise 成功后显示。
- 核心 E2E 覆盖打开临时目录、打开 Markdown、保存、评论持久化、新进程重开后读取评论、文件名搜索、内容搜索和导出 HTML。
- headless DMG 内 App 做 ad-hoc 签名，并通过本地挂载、复制、签名校验和启动 smoke。
- 安装、测试、构建、Rust 验证、`.app` 构建、headless DMG 和本地 DMG smoke 已在不含 `node_modules`、`dist` 和 `src-tauri/target` 的临时副本中跑通。
- 新增 `pnpm run release:notarize`，用于 Developer ID 签名、notarytool 公证、staple 和 Gatekeeper 验证；缺少证书或 notarytool profile 时会安全失败。
- 新增 `pnpm run manual:prepare` 和 `MANUAL_ACCEPTANCE.md`，用于生成手工验收工作区和结果模板。

### 已知未闭环

- 真实人工端到端验收尚未记录，尤其是原生目录选择、真实键盘编辑、原生保存对话框和手工关闭重开操作。
- WebdriverIO 窗口 E2E 仍使用 `e2e` 固定路径、测试专用编辑钩子和程序化文本选择辅助。
- 当前机器没有有效 Developer ID identity，Developer ID 签名、公证、staple 和 notarized 安装后启动验证未完成。
- 原 Tauri Finder-style DMG 路线保留为 `pnpm run tauri:build:dmg:tauri`，当前环境仍会卡在 `bundle_dmg.sh` 的 Finder/AppleScript 美化阶段。
- 评论高亮、侧栏联动和大文件性能仍需要补充 UI 验收和压测。
