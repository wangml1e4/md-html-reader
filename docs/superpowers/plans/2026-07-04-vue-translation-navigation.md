# Vue Translation Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Vue + Tauri translation, file-tree filtering, title display, current-file locate, Markdown outline, and HTML default-browser preview features.

**Architecture:** Keep the current Vue + Pinia + Milkdown + Tauri structure. Add focused backend modules for metadata, translation, and browser preview; add small frontend components for document outline and translation card while extending existing `App.vue`, `FileTree.vue`, `MilkdownEditor.vue`, and tests.

**Tech Stack:** Vue 3, Pinia, Vitest, Milkdown, Tauri 2, Rust, serde, sha2, walkdir, reqwest, hmac, url, shell open.

---

### Task 1: Backend Document Metadata

**Files:**
- Modify: `src-tauri/src/fs_handler.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/fs_handler.rs`

- [ ] **Step 1: Write failing Rust tests**

Add tests that create Markdown and HTML files and assert `list_files` returns `title`:

```rust
assert_eq!(files[0].title.as_deref(), Some("Markdown Title"));
assert_eq!(files[1].title.as_deref(), Some("HTML Title"));
```

Run: `cd src-tauri && cargo test fs_handler::tests::list_files_extracts_document_titles`

Expected: FAIL because `FileItem` has no `title`.

- [ ] **Step 2: Implement metadata extraction**

Add `title: Option<String>` to `FileItem`. Read at most 64KB per file. Markdown title is first ATX heading. HTML title is `<title>`, falling back to first `<h1>`.

- [ ] **Step 3: Verify**

Run: `cd src-tauri && cargo test fs_handler::tests::list_files_extracts_document_titles`

Expected: PASS.

### Task 2: Backend Translation And Browser Preview

**Files:**
- Create: `src-tauri/src/translation.rs`
- Create: `src-tauri/src/browser_preview.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/translation.rs`
- Test: `src-tauri/src/browser_preview.rs`

- [ ] **Step 1: Write failing Rust tests**

Cover:

```rust
assert!(validate_translate_request("ollama", "hello").is_ok());
assert!(validate_translate_request("unknown", "hello").is_err());
assert!(validate_translate_request("ollama", "").is_err());
assert!(validate_translate_request("ollama", &"a".repeat(5001)).is_err());
```

For preview path:

```rust
assert!(validate_html_preview_path(workspace, html_path).is_ok());
assert!(validate_html_preview_path(workspace, markdown_path).is_err());
assert!(validate_html_preview_path(workspace, outside_html_path).is_err());
```

Run: `cd src-tauri && cargo test translation::tests browser_preview::tests`

Expected: FAIL because modules do not exist.

- [ ] **Step 2: Implement translation module**

Add:

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationResult {
    pub original: String,
    pub translated: String,
    pub source_lang: String,
    pub target_lang: String,
    pub service: String,
}
```

Implement `translate_text(service, text)` with input validation, language detection, Ollama request, Tencent env-var validation, Tencent request signing, and clear error messages. Keep network paths out of unit tests.

- [ ] **Step 3: Implement browser preview module**

Add `open_html_in_default_browser(workspace_path, file_path)` that validates the file is inside workspace and `.html`, then opens the `file://` URL through Tauri shell opener.

- [ ] **Step 4: Verify**

Run: `cd src-tauri && cargo test translation::tests browser_preview::tests`

Expected: PASS.

### Task 3: File Tree Filtering, Title Display, Current File Locate

**Files:**
- Modify: `src/stores/workspace.ts`
- Modify: `src/components/FileTree.vue`
- Modify: `src/App.vue`
- Test: `src/tests/file-tree.test.ts`
- Test: `src/tests/app.flow.test.ts`

- [ ] **Step 1: Write failing Vue tests**

Add tests that mount `FileTree` with nested `.md` and `.html` files and assert:

```ts
expect(wrapper.text()).toContain('note.md')
expect(wrapper.text()).not.toContain('page.html')
expect(wrapper.text()).toContain('Markdown Title')
expect(wrapper.text()).not.toContain('note.md')
```

Add app-flow assertions for `只看 Markdown`, `只看 HTML`, `全部`, `显示标题`, and `定位当前文件`.

Run: `pnpm test -- --run src/tests/file-tree.test.ts src/tests/app.flow.test.ts`

Expected: FAIL because UI props and controls do not exist.

- [ ] **Step 2: Implement FileItem title typing**

Add `title?: string` to frontend `FileItem`.

- [ ] **Step 3: Extend FileTree**

Add props:

```ts
filter: 'all' | 'markdown' | 'html'
displayMode: 'filename' | 'title'
currentPath: string | null
locateToken: number
```

Filter files recursively, retain directories with visible children, display `title || name` when display mode is `title`, auto-expand and scroll to current file when `locateToken` changes.

- [ ] **Step 4: Add App controls**

Add left-panel controls: `全部`, `只看 Markdown`, `只看 HTML`, `定位当前文件`, `显示标题` / `显示文档名`.

- [ ] **Step 5: Verify**

Run: `pnpm test -- --run src/tests/file-tree.test.ts src/tests/app.flow.test.ts`

Expected: PASS.

### Task 4: Markdown Outline

**Files:**
- Create: `src/components/DocumentOutline.vue`
- Modify: `src/components/MilkdownEditor.vue`
- Modify: `src/App.vue`
- Test: `src/tests/document-outline.test.ts`
- Test: `src/tests/app.flow.test.ts`

- [ ] **Step 1: Write failing Vue tests**

Add tests for `DocumentOutline`:

```ts
expect(wrapper.text()).toContain('Intro');
expect(wrapper.text()).toContain('Details');
await wrapper.findAll('button')[1].trigger('click');
expect(wrapper.emitted('select')![0][0]).toMatchObject({ text: 'Details', level: 2 });
```

Run: `pnpm test -- --run src/tests/document-outline.test.ts src/tests/app.flow.test.ts`

Expected: FAIL because component and controls do not exist.

- [ ] **Step 2: Implement outline parser and component**

Parse ATX headings from current Markdown content into `{ level, text, line }`.

- [ ] **Step 3: Wire outline selection**

Expose `scrollToHeading(text, level)` from `MilkdownEditor` via `defineExpose`. App stores a ref and calls it when outline emits `select`.

- [ ] **Step 4: Verify**

Run: `pnpm test -- --run src/tests/document-outline.test.ts src/tests/app.flow.test.ts`

Expected: PASS.

### Task 5: Translation UI

**Files:**
- Create: `src/components/TranslationCard.vue`
- Modify: `src/components/CommentTooltip.vue`
- Modify: `src/components/MilkdownEditor.vue`
- Modify: `src/App.vue`
- Test: `src/tests/translation-card.test.ts`
- Test: `src/tests/comment-tooltip.test.ts`
- Test: `src/tests/app.flow.test.ts`

- [ ] **Step 1: Write failing Vue tests**

Test that `CommentTooltip` emits `translate` with current selection. Test that `TranslationCard` shows loading, success, error, and copy button. Test that App calls:

```ts
invoke('translate_text', { service: 'ollama', text: 'Hello' })
```

Run: `pnpm test -- --run src/tests/translation-card.test.ts src/tests/comment-tooltip.test.ts src/tests/app.flow.test.ts`

Expected: FAIL because translation UI does not exist.

- [ ] **Step 2: Add translation card**

Render selected original, translated text, service label, error message, and copy button.

- [ ] **Step 3: Extend selection tooltip**

Add a `翻译` button next to `添加评论`, emit `translate(selection)`.

- [ ] **Step 4: Wire App translation state**

Add service selector `Ollama` / `腾讯翻译`, invoke Tauri command, and pass card state to `TranslationCard`.

- [ ] **Step 5: Verify**

Run: `pnpm test -- --run src/tests/translation-card.test.ts src/tests/comment-tooltip.test.ts src/tests/app.flow.test.ts`

Expected: PASS.

### Task 6: HTML Default Browser Preview

**Files:**
- Modify: `src/components/MilkdownEditor.vue`
- Modify: `src/App.vue`
- Test: `src/tests/milkdown-editor.save.test.ts`
- Test: `src/tests/app.flow.test.ts`

- [ ] **Step 1: Write failing Vue tests**

Assert `.html` files show `浏览器预览`, `.md` files do not, and click calls:

```ts
invoke('open_html_in_default_browser', {
  workspacePath: '/tmp/workspace',
  filePath: '/tmp/workspace/page.html',
})
```

Run: `pnpm test -- --run src/tests/milkdown-editor.save.test.ts src/tests/app.flow.test.ts`

Expected: FAIL because preview button is not implemented.

- [ ] **Step 2: Add preview callback**

Pass `openHtmlPreview` from `App.vue` to `MilkdownEditor.vue` and show button for `.html` files only.

- [ ] **Step 3: Verify**

Run: `pnpm test -- --run src/tests/milkdown-editor.save.test.ts src/tests/app.flow.test.ts`

Expected: PASS.

### Task 7: Full Verification

**Files:**
- Modify as needed based on verification failures.

- [ ] **Step 1: Run all frontend tests**

Run: `pnpm test -- --run`

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `pnpm exec vue-tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Run Rust tests**

Run: `cd src-tauri && cargo test`

Expected: all tests pass.

- [ ] **Step 4: Run production build**

Run: `pnpm build`

Expected: exit 0.

- [ ] **Step 5: Run whitespace and documentation checks**

Run: `git diff --check`

Expected: exit 0.
