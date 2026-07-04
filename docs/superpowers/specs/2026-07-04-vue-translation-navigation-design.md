# Vue Translation And Navigation Feature Design

## 背景

当前主线是 Vue + Milkdown + Tauri。历史文件 `translation-feature.js`、`enhanced.html` 和 `TRANSLATION_GUIDE.md` 保留了翻译原型说明，但没有接入当前 Vue 主应用。本次功能以当前主线为准，不复用旧 HTML 页面作为运行入口。

## 已确认范围

1. 翻译服务使用 Ollama 本地翻译 + 腾讯翻译。
2. “只看 HTML / 只看 Markdown”是左侧文件树筛选，新增按钮，不改变当前编辑区逻辑。
3. “一键定位选中文件位置”是应用内定位当前打开文件：自动展开目录、滚动并高亮当前文件。
4. “显示名称”只作用于左侧文件树，在“显示标题 / 显示文档名”之间切换。
5. Markdown 标题侧边栏放在左侧文件树旁边，可开关，显示 H1-H6，点击后定位到正文标题。
6. HTML “本地默认浏览器预览”打开当前 HTML 文件的 `file://` URL，使用系统默认浏览器。

## 非目标

1. 不做在线账户系统、翻译历史、术语库、批量翻译。
2. 不把腾讯云 SecretId / SecretKey 写入前端 bundle、配置文件或文档示例真实值。
3. 不把历史 HTML 原型迁回主线作为第二套应用。
4. 不重构整套布局，只做为本次功能必要的局部拆分。

## 用户界面设计

### 文件树工具条

左侧文件树顶部增加一行工具条：

- `全部`
- `只看 Markdown`
- `只看 HTML`
- `定位当前文件`
- `显示标题` / `显示文档名`

筛选模式只影响文件树显示，不影响搜索命令、不影响当前已打开文件。若当前打开文件在筛选模式下不可见，编辑区继续保持打开状态；点击“定位当前文件”时，如果当前筛选隐藏了该文件，自动切回 `全部` 并定位。

“显示标题”模式中：

- Markdown 文件显示第一个 ATX 标题，例如 `# 项目说明`。
- HTML 文件优先显示 `<title>`，没有 `<title>` 时显示第一个 `<h1>`。
- 没有可识别标题时回退真实文件名。
- tooltip 或 title 属性保留真实文件路径，避免显示名造成误判。

### Markdown 大纲栏

文件树右侧增加一个可开关的大纲栏。仅当前文件扩展名是 `.md` 时启用。

显示规则：

- 解析 H1-H6 ATX 标题。
- 保留标题层级，使用缩进表达层级。
- 点击标题后让编辑器滚动到对应标题位置。
- 如果当前 Markdown 没有标题，显示空状态“当前文档没有标题”。

定位实现优先使用编辑器 DOM 中可匹配的标题文本。无法可靠匹配时，降级为滚动到顶部并给出轻量提示，不阻断编辑。

### 翻译交互

复用当前文本选择能力。选中文本后，评论浮层中增加“翻译”入口，或者在同一选择位置显示翻译按钮。第一版采用同一浮层内增加“翻译”按钮，减少新的选择监听。

点击“翻译”后：

1. 前端将选中文本和当前服务类型发送给 Tauri 命令。
2. Tauri 后端根据服务类型调用 Ollama 或腾讯翻译。
3. 前端在选择位置附近显示翻译结果卡片。
4. 翻译卡片显示原文、译文、服务来源、复制译文按钮、错误状态。

默认服务为 Ollama。用户可在翻译卡片或顶部工具栏选择 `Ollama` / `腾讯翻译`。服务选择只保存在当前前端会话内。

### HTML 默认浏览器预览

当前文件是 `.html` 时，编辑器工具栏显示“浏览器预览”按钮。点击后调用 Tauri 后端命令校验路径在当前工作区内，然后用系统默认浏览器打开本地文件 URL。

当前文件不是 `.html` 时不显示该按钮。

## 后端设计

### 路径安全

所有新增 Tauri 命令都必须接收 `workspacePath` 和目标文件路径，并复用 `path_guard::document_file_in_workspace` 做 canonicalize 和工作区边界校验。

### 翻译命令

新增模块 `src-tauri/src/translation.rs`。

命令：

```rust
translate_text(service: String, text: String) -> Result<TranslationResult, String>
```

输入限制：

- `text.trim()` 不能为空。
- 文本长度上限为 5000 字符。
- `service` 只允许 `ollama` 或 `tencent`。

语言方向：

- 含 CJK 字符时按中文到英文。
- 否则按英文到中文。

Ollama：

- 默认 endpoint 为 `http://localhost:11434/api/generate`。
- 默认模型从环境变量 `OLLAMA_TRANSLATION_MODEL` 读取，没有则使用 `qwen3.5:2b`。
- 请求失败时返回“本地 Ollama 服务不可用或模型未安装”。

腾讯翻译：

- 从环境变量读取 `TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、`TENCENT_REGION`。
- `TENCENT_REGION` 未设置时使用 `ap-beijing`。
- 后端完成腾讯云 API v3 签名，前端不接触密钥。
- 缺少密钥时返回“腾讯翻译未配置密钥”。

### 浏览器预览命令

新增命令：

```rust
open_html_in_default_browser(workspace_path: String, file_path: String) -> Result<(), String>
```

行为：

- 校验文件在工作区内。
- 校验扩展名为 `.html`。
- 使用系统默认浏览器打开 `file://` URL。

## 前端设计

### 状态

在 `App.vue` 或小型 composable 中维护：

- 文件类型筛选：`all | markdown | html`
- 文件显示名模式：`filename | title`
- 当前翻译服务：`ollama | tencent`
- 大纲栏开关：`boolean`
- 翻译卡片状态：`idle | loading | success | error`

### 文件元数据

扩展 `FileItem`：

```ts
interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  title?: string
  children?: FileItem[]
}
```

后端 `list_files` 返回标题元数据。这样显示标题和文件定位都基于同一棵树，不额外重复扫描。

### 组件

新增或修改：

- 修改 `FileTree.vue`：支持筛选后的树、显示名、当前文件路径、定位滚动。
- 新增 `DocumentOutline.vue`：显示当前 Markdown 文件标题大纲。
- 修改 `MilkdownEditor.vue`：暴露标题定位能力，接收 HTML 预览回调，选择浮层增加翻译入口。
- 新增 `TranslationCard.vue`：显示翻译结果、错误和复制按钮。
- 修改 `App.vue`：串联工具条状态、翻译服务、HTML 预览、文件定位和大纲栏。

## 测试设计

### 前端单测

1. 文件树筛选：
   - `只看 Markdown` 只显示 `.md` 文件。
   - `只看 HTML` 只显示 `.html` 文件。
   - `全部` 显示两者。

2. 显示名称：
   - `title` 存在时显示标题。
   - `title` 不存在时回退文件名。

3. 定位当前文件：
   - 点击定位按钮后，当前文件所在目录展开并高亮。
   - 当前筛选隐藏该文件时，先切回 `全部`。

4. 翻译：
   - 选中文本后点击翻译会调用 `translate_text`。
   - loading、success、error 状态可见。
   - 复制译文调用 clipboard。

5. HTML 预览：
   - 当前 `.html` 文件显示“浏览器预览”按钮。
   - 当前 `.md` 文件不显示该按钮。
   - 点击后调用 `open_html_in_default_browser`。

### Rust 单测

1. 标题提取：
   - Markdown 提取第一个 ATX 标题。
   - HTML 优先提取 `<title>`，其次 `<h1>`。

2. 翻译输入校验：
   - 空文本报错。
   - 超过 5000 字符报错。
   - 未知服务报错。

3. 浏览器预览路径校验：
   - 工作区内 `.html` 允许。
   - 工作区外路径拒绝。
   - `.md` 路径拒绝。

### 集成验证

保留并扩展现有验证命令：

- `pnpm test -- --run`
- `pnpm exec vue-tsc --noEmit`
- `cd src-tauri && cargo test`
- `pnpm build`
- 视实现范围运行 `pnpm run test:e2e`

## 风险和处理

1. Milkdown 标题定位可能受编辑器 DOM 结构影响。第一版按标题文本定位，失败时不阻断主流程。
2. 腾讯翻译需要真实密钥，自动化测试只测签名输入校验和缺少配置错误，不访问真实腾讯云。
3. Ollama 本地模型名称可能和用户机器不一致，因此用环境变量覆盖默认模型。
4. 文件标题扫描会增加 `list_files` 成本，但只读取 `.md/.html` 文件的前部内容，第一版限制读取前 64KB。

## 人工验收清单

1. 打开一个包含 `.md` 和 `.html` 的文件夹。
2. 点击 `只看 Markdown`，左侧只显示 Markdown 文件。
3. 点击 `只看 HTML`，左侧只显示 HTML 文件。
4. 点击 `全部`，两类文件都恢复显示。
5. 切到 `显示标题`，有标题的文件显示标题；切回 `显示文档名`，恢复真实文件名。
6. 打开嵌套目录中的文件，点击 `定位当前文件`，左侧展开并高亮该文件。
7. 打开 Markdown 文件，打开标题侧边栏，点击二级或三级标题，编辑区滚动到对应位置。
8. 选中文本并点击翻译，Ollama 启动时显示译文；Ollama 未启动时显示可理解错误。
9. 配置腾讯翻译环境变量后，切换腾讯翻译并验证可返回译文。
10. 打开 HTML 文件，点击 `浏览器预览`，系统默认浏览器打开该本地 HTML 文件。
