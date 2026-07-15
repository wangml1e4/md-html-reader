# 后续开发计划

本文按当前主线 Vue + Milkdown + Tauri 评估，不再把历史 HTML 原型作为工程完成度口径。

## 当前已闭环

- 可重复安装：`CI=true pnpm install --frozen-lockfile` 可执行。
- 前端测试：`pnpm test -- --run` 可执行，覆盖锚点、评论 store、工作区 store 和保存状态。
- 前端构建：`pnpm build` 可输出 `dist/`。
- Rust 验证：`cd src-tauri && cargo test` 可执行。
- Tauri App 构建：`pnpm run tauri:build` 可生成 macOS `.app`。
- headless DMG 构建：`pnpm run tauri:build:dmg` 可生成包含 App 和 Applications 链接的普通 DMG，并对 App 做 ad-hoc 签名。
- 本地 DMG smoke：`pnpm run smoke:dmg` 可挂载 DMG、复制 App、校验签名并启动 App 进程。
- 正式签名/公证脚本：`pnpm run release:notarize` 已提供，但需要 Developer ID 证书和 notarytool keychain profile。
- 真实窗口核心 E2E：`pnpm run test:e2e` 可启动 Tauri WebView，覆盖打开临时目录、打开 Markdown、保存、评论持久化、新进程重开后读取评论、文件名搜索、内容搜索和导出 HTML。
- 评论契约：前端 camelCase 与 Rust 结构体可互通，同时兼容旧 snake_case sidecar。
- 评论存储 ID：sidecar 文件名由稳定文档路径派生，内容 hash 只作为版本信息。
- 评论锚点重定位：打开文件加载评论时会基于当前内容刷新 offset 和 confidence。
- 保存状态：只有父级写盘 Promise 成功后才显示已保存。
- 搜索和导出 HTML：主工具栏已有入口，并有前端入口测试和 Rust 命令层核心路径测试。

## 未闭环风险

| 优先级 | 风险 | 影响 | 验证方式 |
|--------|------|------|----------|
| P0 | Developer ID 签名、公证和 notarized 安装后启动验证未闭环 | `release:notarize` 已就绪，但当前机器没有有效 Developer ID identity，不能作为正式可信分发包发布 | 配置 Developer ID 证书和 notarytool profile 后执行 `pnpm run release:notarize` |
| P1 | GitHub Actions 尚无该分支的远端通过记录 | 已添加 CI 工作流，但首次 push 或 pull request 前不能证明托管环境可复现本地门禁 | 确认 [CI 工作流](.github/workflows/ci.yml) 对目标提交通过 |
| P1 | 窗口 E2E 仍含测试专用编辑钩子和程序化文本选择辅助 | 自动化不能证明 Milkdown 真实键盘输入和评论鼠标拖选链路 | 后续减少测试钩子，或补人工键盘输入和鼠标选择记录 |
| P1 | 评论高亮和重定位的视觉反馈仍弱 | 评论存在但用户不一定能准确看到关联文本 | 组件测试 + 手工 UI 检查 |
| P2 | 大文件性能未压测 | 大文档编辑、搜索、重定位可能卡顿 | 构造 1MB+ Markdown 压测 |

## 下一步计划

### 阶段 1：发布前验证

1. 在 GitHub 上运行 [CI 工作流](.github/workflows/ci.yml)，确认目标提交通过。
2. 按 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) 复核已有人工验收和自动化证据。
3. 跑 `pnpm run tauri:build`，确认 `.app` 产物能启动。
4. 跑 `pnpm run tauri:build:dmg`，确认 headless DMG 产物能生成。
5. 配置 Developer ID 证书和 notarytool profile 后执行 `pnpm run release:notarize`，补齐公证和 notarized 安装后启动验证。

### 阶段 2：补齐核心用户路径

1. 原生交互变更后，按 [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) 重新验收受影响路径。
2. 继续减少 E2E 对测试专用编辑钩子和程序化选择辅助的依赖。
3. 增强评论显示：高亮、选中联动、已解决评论过滤。
4. 继续收敛 WebdriverIO E2E，减少测试专用编辑钩子和程序化选择辅助。

### 阶段 3：工程质量

1. 清理 Rust 未使用 import 警告。
2. 统一 `Comment` 类型来源，减少重复定义。
3. 为 `selection.ts` 和 `comment-highlight.ts` 增加测试。
4. 扩展核心路径 E2E，优先沿用 WebdriverIO Tauri service embedded provider；macOS 不走直接 `tauri-driver` 路线。

### 阶段 4：发布准备

1. 明确版本号、发布说明和已知问题。
2. 建立 macOS Developer ID 签名、公证和 notarized 安装后启动验证流程。
3. 保持 GitHub Actions 验证流水线对每个发布候选提交通过。
4. 准备用户使用说明和故障排查说明。

## 暂不优先

- 多用户协作评论。
- 评论线程和回复。
- Git 历史版本视图。
- 多平台发布。
- 大规模 UI 重构。

这些能力有价值，但不应早于当前 P0/P1 闭环。

**当前状态**：发布门禁以 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) 为准。已有人工验收记录和本地自动化证据；正式发布仍缺 GitHub Actions 对目标提交的通过记录，以及 Developer ID 签名、公证和 notarized 安装验证。
