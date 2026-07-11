# 阶段性实施报告

## 当前结论

当前主线是 **Vue + Milkdown + Tauri**。历史 HTML 原型继续保留为早期验证材料，但不再作为当前工程架构或发布完成度口径。

项目已经具备可运行主线、核心数据链路、一组自动化验证、`.app` 构建、ad-hoc 签名的 headless DMG 产物、本地 DMG 启动 smoke，以及 Developer ID 签名/公证脚本；但还不能写成发布完成，因为原生系统对话框、真实键盘编辑、手工关闭重开操作的验收记录，以及带真实证书的 Developer ID 签名、公证和 notarized 安装后启动验证仍未闭环。

## 完成度口径

| 维度 | 当前判断 | 依据 |
|------|----------|------|
| 文档完成度 | 中高 | README、测试指南、路线图和总结文档已统一到当前主线；历史原型说明保留但已标注为历史材料 |
| 工程完成度 | 阶段性可验证 | 前端单测、App 级流、Rust 命令层、Tauri `.app` 构建和窗口核心 E2E 已有验证入口 |
| 发布完成度 | 未闭环 | 缺少人工端到端验收记录，headless DMG、本地启动 smoke 和 `release:notarize` 脚本可验证，但当前机器没有有效 Developer ID identity |

## 已闭环内容

- 可重复安装入口：`CI=true pnpm install --frozen-lockfile`
- 前端测试入口：`pnpm test -- --run`
- 类型检查入口：`pnpm exec vue-tsc --noEmit`
- 前端构建入口：`pnpm build`
- Rust 测试入口：`cd src-tauri && cargo test`
- Tauri `.app` 构建入口：`pnpm run tauri:build`
- headless DMG 构建入口：`pnpm run tauri:build:dmg`
- 本地 DMG 启动 smoke：`pnpm run smoke:dmg`
- Developer ID 签名/公证入口：`pnpm run release:notarize`
- Tauri 窗口核心 E2E：`pnpm run test:e2e`，包含新 Tauri 进程重开后的评论持久化验证
- 评论数据契约：前端 `fileHash/createdAt/updatedAt` 与 Rust camelCase 序列化兼容，并保留旧 snake_case sidecar 读取能力
- 评论存储 ID：sidecar 路径由稳定文档路径派生，内容 hash 只作为版本信息
- 评论锚点重定位：打开文件加载评论时会基于当前内容刷新 offset 和 confidence
- 保存状态：只在父级写盘 Promise 成功后显示已保存
- 搜索/导出：已有主工具栏入口、App 级测试、Rust 命令层测试和窗口 E2E 覆盖

## Milestone 状态

| Milestone | 当前状态 | 说明 |
|-----------|----------|------|
| M1 Tauri 基础 + 文件树 | 基本闭环 | 文件扫描、读取、写入有 Rust 命令和测试覆盖 |
| M2 Milkdown 编辑器 | 基本闭环 | 编辑器接入主线，保存状态测试覆盖成功/失败路径 |
| M3 评论锚点和持久化 | 基本闭环 | 锚点算法、加载时重定位、评论 store、字段契约、路径稳定 sidecar 有测试覆盖 |
| M4 评论 UI | 部分闭环 | 创建评论、侧栏持久化已有集成测试和窗口 E2E；高亮、联动和视觉体验仍需人工验收 |
| M5 搜索 + 导出 | 基本闭环 | 命令层、入口测试和真实窗口 E2E 已覆盖；原生保存对话框仍需人工验收 |

## 未闭环风险

| 优先级 | 风险 | 下一步 |
|--------|------|--------|
| P0 | 缺少人工端到端验收记录 | 按 `TESTING.md` 手工跑通原生打开目录、真实键盘编辑保存、手工关闭重开、搜索、导出 |
| P0 | Developer ID 签名、公证和 notarized 安装后启动验证未完成 | 基于 `pnpm run tauri:build:dmg` 生成的 headless DMG 补齐 Developer ID 签名、公证、staple 和安装后启动验证 |
| P1 | WebdriverIO 仍包含测试专用编辑钩子和程序化文本选择辅助 | 评估更稳定的 Milkdown 输入和评论鼠标拖选自动化方案 |
| P1 | 评论高亮和定位反馈仍弱 | 补视觉联动测试与手工验收记录 |
| P2 | 大文件性能未压测 | 构造 1MB+ Markdown 进行编辑、搜索、评论重定位压测 |

## 后续开发计划

1. 跑完 `TESTING.md` 的手工端到端验收，并记录结果。
2. 将原生对话框、真实键盘编辑和手工关闭重开操作的验收结果补入测试文档。
3. 基于 headless DMG 补齐 Developer ID 签名、公证和 notarized 安装后启动验证。
4. 增强评论高亮、评论卡片联动和失效评论提示。
5. 在现有 WebdriverIO 核心 E2E 基础上，逐步减少测试专用编辑钩子和程序化选择辅助。

**当前状态**：阶段性可验证，不是发布完成。
