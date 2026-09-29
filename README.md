# Markdown Reader

[中文](README.zh-CN.md) | English

<p align="center"><img src="src-tauri/icons/icon.png" alt="Markdown Reader logo" width="128"></p>

> A local-first macOS Markdown editing and review workspace with anchored comments, workspace search, Chinese translation copies, and standalone HTML export.

## Review workflow

1. Open a folder you control and edit Markdown in place.
2. Select a passage to add an anchored comment stored beside the source.
3. Search the workspace, then export a standalone HTML reading version for handoff.

The app can also create a separate Chinese translation copy. Optional AI actions ask for approval before sending the current document to your chosen provider.

## Privacy and beta status

Local editing, comments, search, and export need no account or API key. The desktop app has no built-in analytics. Saved OpenAI-compatible API keys reside in the current user's application configuration directory; see the [privacy statement](PRIVACY.md) for details.

Version 0.9.2 is an Apple Silicon macOS beta without Developer ID signing or notarization. Keep a copy of important documents and read the [beta limitations](BETA_LIMITATIONS.md).

## Run locally

Requires macOS, Node.js 24+, pnpm 11.7.0, and Rust 1.96+.

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

This source mirror omits internal tests and project notes. Released under the [MIT License](LICENSE).
