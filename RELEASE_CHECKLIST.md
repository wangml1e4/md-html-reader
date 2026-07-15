# 发布清单

本文是当前 Vue + Milkdown + Tauri 主线的唯一发布状态来源。README、路线图和人工验收文档只说明各自范围，不重复判定发布是否完成。

## 当前结论

- 内测构建：核心自动化与已记录的人工原生交互可作为依据。
- 正式 macOS 发布：**未完成**。Developer ID 签名、公证和 notarized DMG 安装验证尚未完成。

## 发布门禁

| 门禁 | 当前状态 | 证据或执行方式 |
|------|----------|----------------|
| 前端类型检查、单元测试和生产构建 | 已在本地验证 | `pnpm exec vue-tsc --noEmit`、`pnpm test -- --run`、`pnpm build` |
| Rust 命令层测试 | 已在本地验证 | `(cd src-tauri && cargo test)` |
| 真实 Tauri 窗口 E2E | 已在本地验证 | `pnpm run test:e2e`，覆盖核心路径与跨进程评论持久化 |
| 原生人工交互 | 已通过 | [2026-07-11 记录](docs/manual-acceptance-2026-07-11.md) 与 [2026-07-12 补充](docs/manual-acceptance-2026-07-12.md) |
| GitHub Actions 复现上述自动化门禁 | 待首次远端通过 | [CI 工作流](.github/workflows/ci.yml) 在 push 和 pull request 时执行 |
| Developer ID 签名、公证和 notarized DMG 安装验证 | 未完成 | 配置证书和 `NOTARY_KEYCHAIN_PROFILE` 后执行 `pnpm run release:notarize` |

## 复核规则

1. 每次准备发布时，先确认 GitHub Actions 对该提交已通过。
2. 若原生目录选择、保存对话框、键盘编辑、鼠标选区或窗口关闭行为有改动，按 [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md) 重新记录受影响路径。
3. 只有表中全部门禁完成，才可将构建标记为正式 macOS 发布；签名和公证未闭环前，只能称为内测或 ad-hoc 构建。
