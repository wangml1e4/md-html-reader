# 测试指南

本指南只描述当前主线：Vue + Milkdown + Tauri。历史 HTML 原型可以单独打开验证，但不作为桌面应用发布验收标准。

## 当前验证命令

从仓库根目录执行：

前置版本：Node.js 24+、pnpm 11.7.0、Rust 1.96+。仓库已包含 `.npmrc` 固定 npm registry，并在 `package.json` 通过 `packageManager` 固定 pnpm 版本。

最新本地验证还覆盖了不含 `node_modules`、`dist` 和 `src-tauri/target` 的临时副本，用于模拟新用户首次安装、测试、构建和本地 DMG smoke。

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
CI=true pnpm install --frozen-lockfile
pnpm test -- --run
pnpm build
(cd src-tauri && cargo test)
pnpm run tauri:build
pnpm run tauri:build:dmg
pnpm run smoke:dmg
pnpm run test:e2e
```

命令覆盖范围：

| 命令 | 验证范围 |
|------|----------|
| `CI=true pnpm install --frozen-lockfile` | 锁文件、依赖版本、pnpm 安装策略 |
| `pnpm test -- --run` | 前端单元测试、store 测试、组件保存状态测试、搜索/导出入口测试 |
| `pnpm build` | Vite 生产构建、前端资源输出到 `dist/` |
| `(cd src-tauri && cargo test)` | Rust 命令和评论 sidecar 行为测试 |
| `pnpm run tauri:build` | Tauri release 二进制和 macOS `.app` 产物 |
| `pnpm run tauri:build:dmg` | headless macOS DMG 产物，包含 App 和 Applications 链接；App 做 ad-hoc 签名，未 Developer ID 签名、未公证 |
| `pnpm run smoke:dmg` | 本地 macOS smoke：挂载 DMG、复制 App、校验签名、启动 App 进程并清理 |
| `pnpm run release:notarize` | 正式发布路径：需要 Developer ID 证书和 notarytool keychain profile；执行签名、公证、staple 和验证 |
| `pnpm run test:e2e` | WebdriverIO embedded provider 启动真实 Tauri WebView，覆盖核心窗口路径和新进程重开后的评论持久化 |

## 自动化覆盖

### 前端测试

| 文件 | 覆盖点 |
|------|--------|
| `src/tests/comment-anchor.test.ts` | 锚点创建、精确重定位、模糊重定位、附近搜索、短文件边界 |
| `src/tests/comments.store.test.ts` | 评论加载、保存、删除、状态更新、失败回滚和加载时锚点重定位 |
| `src/tests/workspace.store.test.ts` | 文件夹加载、文件读取、文件写入和失败状态 |
| `src/tests/milkdown-editor.save.test.ts` | 保存中状态、写盘成功后显示已保存、写盘失败不误报已保存 |
| `src/tests/search-panel.test.ts` | 文件名搜索、内容搜索和打开搜索结果 |
| `src/tests/app.shell.test.ts` | 主工具栏打开搜索面板、导出 HTML 调用 Tauri 命令 |
| `src/tests/app.flow.test.ts` | App 级用户流：打开文件夹、打开文件、保存、评论、重开、搜索打开、导出 HTML |

### Rust 测试

| 测试 | 覆盖点 |
|------|--------|
| `comment_deserializes_from_frontend_camel_case` | 前端 `fileHash/createdAt/updatedAt` 能被 Rust 读取并按 camelCase 写出 |
| `comment_deserializes_from_legacy_snake_case` | 旧 sidecar 中的 `file_hash/created_at/updated_at` 仍可读取 |
| `comments_survive_content_hash_changes_for_same_path` | 同一路径内容变化后，评论仍可加载、更新、删除 |
| `core_file_comment_search_export_path_works` | 文件夹扫描、读写、评论保存/重开、搜索、导出 HTML 的命令层路径 |

### Tauri 窗口测试

| 文件 | 覆盖点 |
|------|--------|
| `test/e2e/app.spec.ts` | 真实 Tauri WebView 加载、WDIO Tauri bridge、打开临时目录、打开 Markdown、设置编辑内容、保存写盘、添加评论、刷新后评论仍存在、文件名搜索、内容搜索、导出 HTML |
| `test/e2e/reopen.spec.ts` | 第一轮 Tauri 进程创建评论，第二轮新 Tauri 进程打开同一临时目录并确认评论仍存在 |

说明：窗口 E2E 使用 `e2e` 构建模式绕过原生目录选择和保存对话框，并通过测试专用钩子设置 Milkdown 当前内容；评论选区由程序化文本选择辅助。它验证真实 Tauri WebView、真实 Rust 命令、真实临时文件系统链路和新进程重开后的 sidecar 读取，但不替代原生系统对话框、真实键盘输入、手工鼠标选择和手工关闭重开操作验收。

已尝试用 WebDriver actions、WebDriver 粘贴和 macOS System Events 替代编辑钩子。当前 embedded provider 对 WebView printable 输入不稳定，System Events 在当前机器缺少发送按键权限，因此真实键盘输入仍保留为人工验收项。

WebdriverIO Tauri service 使用 embedded provider 时，日志里仍可能出现 `tauri-driver not found` 诊断错误；只要 spec summary 通过且命令退出码为 0，就不需要额外安装外部 `tauri-driver`。

## 手工端到端验收清单

当前已有真实 Tauri 窗口核心路径自动化。发布前仍至少手工执行一次并记录结果，重点覆盖自动化刻意绕开的原生交互：

先生成验收工作区和结果模板：

```bash
pnpm run manual:prepare
pnpm exec tauri dev
```

`manual:prepare` 会在 `/tmp/markdown-html-manual-acceptance` 下创建可选目录、Markdown 样例和 `manual-acceptance-results.md`。实际验收结果只写入该结果模板；不要把未执行的步骤标为通过。

1. 点击「打开文件夹」，选择脚本生成的 `workspace` 目录。
2. 打开 `manual-e2e-note.md`，确认内容进入 Milkdown 编辑器。
3. 修改正文并点击保存，确认 UI 只在写盘成功后显示保存状态，并检查磁盘文件内容。
4. 选中文本并添加评论，确认右侧评论栏出现新评论。
5. 关闭应用后重新打开同一目录和同一文件，确认评论仍存在。
6. 修改文件内容后再次打开，确认评论没有因内容 hash 变化丢失。
7. 验证文件名搜索和内容搜索路径。
8. 验证导出 HTML 路径。

更详细的流程见 [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md)。

建议记录格式：

| 步骤 | 结果 | 备注 |
|------|------|------|
| 打开文件夹 | 待记录 | |
| 编辑保存 | 待记录 | |
| 添加评论 | 待记录 | |
| 关闭重开评论仍存在 | 待记录 | |
| 内容变化后评论仍存在 | 待记录 | |
| 搜索 | 待记录 | |
| 导出 HTML | 待记录 | |

## 后续测试计划

优先补齐：

- `selection.ts` 文本选择工具测试
- `comment-highlight.ts` 高亮渲染测试
- 扩展 WebdriverIO + `@wdio/tauri-service` embedded WebDriver，尽量减少测试专用编辑钩子和程序化选择辅助
- Developer ID 签名、公证和 notarized DMG 安装后启动验证

## 正式发布验证

`release:notarize` 需要以下环境变量：

```bash
export DEVELOPER_ID_APPLICATION='Developer ID Application: Example, Inc. (TEAMID)'
export NOTARY_KEYCHAIN_PROFILE='md-html-reader'
pnpm run release:notarize
```

前置条件：

- 本机钥匙串中存在匹配的 Developer ID Application 证书。
- 已通过 `xcrun notarytool store-credentials <profile-name>` 保存 Apple Notary Service 凭证。
- 可访问 Apple Notary Service。

当前本机检查结果是 `security find-identity -v -p codesigning` 返回 0 个有效 identity，因此该正式发布验证仍不能在当前机器闭环。

说明：macOS 上不要直接依赖 `tauri-driver` 路线；Tauri 官方建议使用 WebdriverIO 的 Tauri service embedded provider 来支持 macOS。

## 调试命令

```bash
pnpm test -- --reporter=verbose
pnpm test -- comment-anchor
pnpm test -- --run --reporter=verbose --bail
pnpm test:ui
pnpm test:coverage
```

## CI 建议

```yaml
name: Validate

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - uses: dtolnay/rust-toolchain@stable
      - run: CI=true pnpm install --frozen-lockfile
      - run: pnpm test -- --run
      - run: pnpm build
      - run: cargo test
        working-directory: src-tauri
      - run: pnpm run tauri:build
      - run: pnpm run tauri:build:dmg
```

**当前测试状态**：自动化测试已覆盖核心数据链路、App 级用户流、搜索/导出入口、Rust 命令层核心路径、真实窗口核心 E2E、新进程重开后的评论持久化、`.app` 构建、ad-hoc 签名的 headless DMG 生成和本地 DMG 启动 smoke；上述链路也已在不含 `node_modules`、`dist` 和 `src-tauri/target` 的临时副本中验证。Developer ID 签名/公证脚本已就绪，但当前机器没有有效 Developer ID identity。发布判断仍依赖一次真实 Tauri 窗口人工端到端验收记录、Developer ID 签名、公证与 notarized 安装后启动验证。
