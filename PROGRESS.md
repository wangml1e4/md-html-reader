# 开发进度报告

**项目**：MD+HTML Reader 复刻版  
**更新时间**：2026-06-30  
**当前状态**：阶段 1 原型完成（受网络限制采用 CDN 方案）

---

## 已完成

### ✅ 阶段 0 — 项目脚手架
- [x] Tauri 2.x + Svelte 5 + TypeScript 项目结构
- [x] Rust 后端骨架（`src-tauri/`）
- [x] 前端模块化架构（`src/lib/`）
- [x] 锚点类型系统定义（`anchorTypes.ts`）
- [x] Apple 风格基础 CSS（SF Pro 字体栈、Action Blue #0066cc）

**提交**：`fcc3f30`

### ✅ 阶段 1 — 基础预览原型
- [x] 纯 HTML/CDN 原型（`prototype.html`）
- [x] markdown-it 集成（CDN 版本）
- [x] 双栏布局：编辑器 + 实时预览
- [x] Apple 风格 UI 应用
- [x] 测试文档（`test-doc.md`）
- [x] Preview.svelte 组件骨架

**提交**：`f681c0a`

**原型功能**：
- ✅ Markdown 基础渲染（标题、段落、列表、加粗、代码）
- ✅ 实时预览（输入即渲染）
- ✅ 加载外部 .md 文件
- ⚠️  **暂缺**：代码高亮、Mermaid 图表、文件系统集成（受限于 CDN 方案）

**访问方式**：直接在预览面板打开 `prototype.html`

---

## 技术债务与限制

### 🚧 网络环境问题
**症状**：npm registry（官方 + 淘宝镜像）均返回 403 Forbidden  
**根因**：环境配置的代理（localhost:62029/62032）拒绝请求  
**影响**：无法通过 npm/pnpm 安装依赖，阻塞完整 Tauri 应用构建

**当前绕过方案**：
- 采用纯 HTML + CDN（markdown-it）快速验证核心功能
- Tauri 后端代码已就绪，前端依赖安装等网络问题解决

### 📦 依赖安装失败日志
```
npm ERR! 403 Forbidden - GET https://registry.npmmirror.com/@sveltejs%2fvite-plugin-svelte
npm ERR! 403 Forbidden - GET https://registry.npmjs.org/@tauri-apps/api
```

**需要解决的环境配置**：
1. 检查 `HTTP_PROXY`/`HTTPS_PROXY` 环境变量（当前指向 localhost:62029）
2. 临时禁用代理：`NO_PROXY="*" npm install`（已尝试，仍失败）
3. 或配置代理认证/修复证书信任（见日志："failed to copy trust settings of system certificate"）

---

## 下一步计划

### 方案 A：解决网络问题后继续
1. 修复 npm 访问（清除代理/修复证书）
2. 安装完整依赖（`npm install` 或 `pnpm install`）
3. 启动 Tauri 开发服务器（`npm run tauri dev`）
4. 将原型功能迁移到 Svelte 组件
5. 添加代码高亮（Shiki）+ Mermaid 图表

### 方案 B：继续扩展 CDN 原型（临时）
如果网络问题短期无法解决，可以：
1. 在原型中添加代码高亮（CDN: highlight.js）
2. 在原型中添加 Mermaid 图表（CDN: mermaid.js）
3. 用 Web API（File System Access API）模拟文件打开
4. 实现阶段 2 的编辑器（CodeMirror 6 CDN 版本）

**推荐方案 A**，因为：
- Tauri 桌面应用是最终目标（原生文件访问、菜单、窗口管理）
- CDN 方案无法实现 Rust 侧的文件原子写、sidecar 管理
- 网络问题应该是环境配置可修复的

---

## 文件清单

### 核心代码
- `prototype.html` — 可运行的 Markdown 预览原型（CDN 方案）
- `test-doc.md` — 测试文档
- `src/lib/anchor/anchorTypes.ts` — 评论锚点类型系统
- `src/lib/markdown/renderer.ts` — Markdown 渲染器接口
- `src/components/Preview.svelte` — 预览组件（待集成）
- `src-tauri/` — Rust 后端骨架（已就绪，待前端依赖）

### 配置文件
- `package.json` — npm 依赖定义
- `tsconfig.json` — TypeScript 配置
- `vite.config.ts` — Vite 配置
- `src-tauri/tauri.conf.json` — Tauri 应用配置
- `src-tauri/Cargo.toml` — Rust 依赖

### 文档
- `PROJECT_PLAN.md` — 完整项目方案与实施路径
- `docs/UI-system/DESIGN.md` — Apple 风格设计系统规范
- `.gitignore` — Git 忽略规则

---

## 里程碑状态

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| 阶段 0：脚手架 | ✅ 完成 | 100% |
| 阶段 1：只读预览 | 🟡 原型完成 | 60% (受网络限制) |
| 阶段 2：编辑功能 | ⏸️  待开始 | 0% |
| 阶段 3：评论系统 | ⏸️  待开始 | 0% |
| 阶段 4：打磨 | ⏸️  待开始 | 0% |

**阶段 1 剩余任务**：
- [ ] 解决 npm 依赖安装（阻塞项）
- [ ] 启动 Tauri 开发环境
- [ ] 文件打开（菜单/拖拽）
- [ ] 代码高亮（Shiki）
- [ ] Mermaid 图表支持
- [ ] 沙箱化 HTML 预览

---

**总结**：核心架构和类型系统已就绪，功能原型可验证。当前受网络环境限制无法安装完整依赖，需解决后继续推进。
