# Manual Acceptance

This file defines the current manual acceptance process for the Vue + Milkdown + Tauri mainline and links the latest auditable result.

It covers only the native manual-interaction gate. The overall release decision and every remaining gate are maintained in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

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

The native interaction checklist requested for the current release passed on 2026-07-11. The auditable record is in `docs/manual-acceptance-2026-07-11.md` and covers the native folder picker, real keyboard editing and save, the native export save dialog, and close/reopen persistence.

The unsaved-content follow-up was validated on 2026-07-12. See `docs/manual-acceptance-2026-07-12.md` for the native Yes/No dialog, paused auto-save, discard behavior, automated close-lifecycle evidence, and the remaining Computer Use limitation around activating the macOS close control.

Automated E2E separately covers the real Tauri WebView, Rust commands, temporary filesystem path, comments, search, export, and new-process comment persistence. It still uses an e2e fixed path, a test-only editor helper, and programmatic text selection, so the manual record remains the evidence for native dialogs and real keyboard input.

When a native interaction changes, rerun the affected path and update its auditable record before marking the corresponding release-checklist gate complete.
