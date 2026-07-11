# Manual Acceptance

This file defines the current manual acceptance process for the Vue + Milkdown + Tauri mainline. It does not claim the manual path has passed; it defines how to produce auditable evidence.

## Prepare

```bash
pnpm run manual:prepare
pnpm exec tauri dev
```

The prepare command creates a temporary workspace and a result template under:

```text
/tmp/markdown-html-manual-acceptance
```

Use the app's native "打开文件夹" button to select the generated `workspace` directory. Record the actual results in the generated `manual-acceptance-results.md`.

## Acceptance Path

1. Open folder.
2. Open `manual-e2e-note.md`.
3. Edit and save.
4. Add a comment.
5. Quit and reopen the app.
6. Confirm the comment remains.
7. Change content and confirm the comment still loads.
8. Search by file name and content.
9. Export HTML.

## Current Status

Manual acceptance remains open until a human records the generated checklist results. Automated E2E covers the real Tauri WebView, Rust commands, temporary filesystem path, search, export, and new-process comment persistence, but still uses an e2e fixed path, a test-only editor helper, and programmatic text selection.
