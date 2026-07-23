# Beta limitations

[中文](BETA_LIMITATIONS.zh-CN.md) | English

Last updated: 2026-07-16

MD+HTML Reader is currently a macOS beta. Use it with a copy of important documents.

- **Comment anchors:** comments use text and position information to recover after edits. After substantial rewriting, a highlight can be less precise or become detached from its original text.
- **Large documents:** performance for very large Markdown files has not yet been benchmarked. Editing, search, or comment relocation can be slower on large files.
- **AI output:** AI-generated translations, reading versions, and document drafts can be inaccurate. Review every result before sharing or applying it.
- **Distribution:** the current build is not yet Developer ID signed, notarized, or verified through a notarized-DMG installation flow. See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

Please report reproducible issues with the document size, operation, expected result, and actual result. Do not include confidential document content in a public report.
