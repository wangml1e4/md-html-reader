# 原生交互人工验收记录（2026-07-11）

## 验收对象

- 应用：`MD+HTML Reader 0.9.0`
- 构建：非 E2E 调试 `.app`
- 应用路径：`src-tauri/target/debug/bundle/macos/MD+HTML Reader.app`
- 工作区：`/tmp/markdown-html-manual-acceptance/workspace`

## 验收结果

| 验收项 | 操作与证据 | 结果 |
|---|---|---|
| 原生目录选择 | 点击“打开文件夹”，macOS 原生 Open 面板出现；通过“前往文件夹”定位验收工作区并确认，文件树显示两个 Markdown 文件 | 通过 |
| 真实键盘编辑与保存 | 在 Milkdown 可编辑区选中 `Original manual acceptance keyword.`，通过真实键盘输入替换为 `Edited manual acceptance keyword.`；点击“保存”后界面显示“刚刚保存” | 通过 |
| 原生保存对话框 | 点击“导出 HTML”，macOS 原生 Save 面板出现，默认目录为当前工作区、文件名为 `manual-e2e-note`；确认后界面显示“HTML 已导出” | 通过 |
| 关闭并重开 | 关闭应用窗口，通过同一非 E2E `.app` 重新启动；再次用原生 Open 面板打开工作区和原 Markdown，编辑后的文本仍可见 | 通过 |

## 磁盘复核

- `manual-e2e-note.md` 第 3 行包含 `Edited manual acceptance keyword.`。
- `manual-e2e-note.html` 已生成，正文包含 `<p>Edited manual acceptance keyword.</p>`。
- 导出 HTML 大小约 1.2 KB，Markdown 大小约 149 B。

## 结论

本次目标要求的四项原生交互路径全部通过。评论、搜索及跨进程评论持久化由同轮 WebDriverIO E2E 覆盖，不以本记录替代其自动化结果。
