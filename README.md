# Markdown Reader

[中文](README.zh-CN.md) | English

<p align="center"><img src="src-tauri/icons/icon.png" alt="Markdown Reader logo" width="128"></p>

> A local-first macOS Markdown editing and review workspace with anchored comments, workspace search, Chinese translation copies, and standalone HTML export.

Markdown Reader is a local-first macOS app for editing Markdown in place, leaving anchored review comments, searching a workspace, and exporting standalone HTML. Core work requires no account or API key. Optional AI requests ask for approval.

## Run locally

Requires macOS, Node.js 24+, pnpm 11.7.0, and Rust 1.96+.

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

This source mirror omits internal tests and project notes. The current macOS beta is not Developer ID signed or notarized. See [beta limitations](BETA_LIMITATIONS.md) and the [privacy statement](PRIVACY.md).

Released under the [MIT License](LICENSE).
