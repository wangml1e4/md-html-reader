#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_ROOT="/tmp/markdown-html-manual-acceptance"
ACCEPTANCE_ROOT="${1:-$DEFAULT_ROOT}"
WORKSPACE_DIR="$ACCEPTANCE_ROOT/workspace"
RESULT_FILE="$ACCEPTANCE_ROOT/manual-acceptance-results.md"
NOTE_FILE="$WORKSPACE_DIR/manual-e2e-note.md"
SECOND_FILE="$WORKSPACE_DIR/manual-search-target.md"

rm -rf "$ACCEPTANCE_ROOT"
mkdir -p "$WORKSPACE_DIR"

cat > "$NOTE_FILE" <<'EOF'
# Manual Acceptance Note

Original manual acceptance keyword.

Comment target phrase for manual acceptance.

Content search token: manual-search-token
EOF

cat > "$SECOND_FILE" <<'EOF'
# Manual Search Target

This file exists so manual file-name search can find manual-search-target.md.
EOF

cat > "$RESULT_FILE" <<EOF
# Manual Acceptance Results

Generated at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
Repository: $ROOT_DIR
Workspace: $WORKSPACE_DIR
Primary file: $NOTE_FILE
Expected export path: $WORKSPACE_DIR/manual-e2e-note.html

## Preconditions

- Run \`pnpm exec tauri dev\` from the repository root.
- In the app, click "打开文件夹" and choose the workspace above.
- Do not mark a step passed until the UI behavior and filesystem artifact are both checked where applicable.

## Checklist

| Step | Expected Evidence | Result | Notes |
|------|-------------------|--------|-------|
| Open folder | File tree shows \`manual-e2e-note.md\` and \`manual-search-target.md\` | TODO | |
| Open Markdown | Editor shows \`Original manual acceptance keyword\` | TODO | |
| Edit and save | Replace the original keyword with \`Edited manual acceptance keyword\`; saved file on disk contains it after Save | TODO | |
| Add comment | Select \`Comment target phrase\`, add a comment, and confirm the side panel shows it | TODO | |
| Close and reopen | Quit the app, restart it, reopen the same folder/file, and confirm the comment remains | TODO | |
| Content change keeps comment | Add another sentence, save, reopen the file, and confirm the comment still loads | TODO | |
| File search | Search \`manual-search-target\` and open the second file | TODO | |
| Content search | Search \`manual-search-token\` and confirm the result points to \`manual-e2e-note.md\` | TODO | |
| Export HTML | Export to \`manual-e2e-note.html\` and confirm the file exists and contains edited content | TODO | |

## Blockers

- None recorded yet.

## Final Decision

- Manual acceptance status: TODO
- Reviewer:
- Date:
EOF

echo "Prepared manual acceptance workspace:"
echo "  $WORKSPACE_DIR"
echo "Prepared result template:"
echo "  $RESULT_FILE"
echo
echo "Next: run pnpm exec tauri dev, open the workspace in the app, and record results in the template."
