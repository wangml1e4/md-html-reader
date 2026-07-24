# Contributing to MD+HTML Reader

Thanks for considering a contribution. MD+HTML Reader is a local-first macOS app for reviewing Markdown in place, leaving anchored comments, and exporting standalone HTML.

## Before you start

- Read the [README](README.md), [beta limitations](BETA_LIMITATIONS.md), and [privacy statement](PRIVACY.md).
- For a small first contribution, look for the [`good first issue`](https://github.com/wangml1e4/md-html-reader/labels/good%20first%20issue) label. Issues that need outside help use [`help wanted`](https://github.com/wangml1e4/md-html-reader/labels/help%20wanted).
- For a defect, feature idea, or beta experience, use the relevant issue form instead of opening an unstructured issue.
- Please do not include confidential document content, API keys, or other secrets in issues, pull requests, screenshots, or test fixtures.

## Development setup

The supported development platform is macOS. Install Node.js 24+, pnpm 11.7.0, and Rust 1.96+, then run:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm exec tauri dev
```

## Verify your change

Run the checks relevant to your change before opening a pull request. The normal full set is:

```bash
pnpm exec vue-tsc --noEmit
pnpm test -- --run
pnpm build
(cd src-tauri && cargo test)
```

For changes to the native user flow, also run the affected manual acceptance steps in [MANUAL_ACCEPTANCE.md](MANUAL_ACCEPTANCE.md). For a full desktop smoke path, use `pnpm run test:e2e` when the local environment supports it.

## Pull requests

1. Start from the latest default branch and keep each pull request focused on one problem.
2. Explain the user-visible behavior, the implementation approach, and the verification you ran.
3. Add or update tests when behavior changes.
4. Include before-and-after screenshots or a short recording for visible UI changes.
5. Update the README, privacy statement, beta limitations, or release notes when the product claim or user workflow changes.

Please avoid unrelated formatting changes and do not rewrite existing history. A maintainer may ask for a smaller follow-up pull request when a change mixes unrelated work.

## Project conventions

- Markdown files remain the user-controlled source of truth. Review comments are sidecar data and must not silently alter source content.
- The local workflow must not require an account or API key.
- AI features are optional and must retain their explicit approval boundary.
- Keep product claims accurate for a macOS beta; do not imply notarized distribution or real-time multi-user editing.

## Getting help

See [SUPPORT.md](SUPPORT.md) for the right place to ask a question, report feedback, or disclose a security issue. Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
