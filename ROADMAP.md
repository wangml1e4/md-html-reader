# 📋 后续开发计划

## 🔧 阶段 1：Bug 修复完善（1-2 天）

### 优先级 1：中等优先级 Bug（影响用户体验）

**1. MilkdownEditor 生命周期内存泄漏**
- **文件**: `src/components/MilkdownEditor.vue`
- **问题**: 嵌套 lifecycle hook 导致事件监听器累积
- **修复**: 重构 `onMounted` 和 `onUnmounted` 结构
- **预估**: 30 分钟

**2. FileTree 递归组件状态同步**
- **文件**: `src/components/FileTree.vue`
- **问题**: 多个实例的 `selected` 状态不同步
- **修复方案**:
  ```typescript
  // 使用 provide/inject 共享选中状态
  provide('selectedFile', selectedFile)
  const selectedFile = inject('selectedFile')
  ```
- **预估**: 1 小时

**3. getTextNodes 行为统一**
- **文件**: `src/utils/comment-highlight.ts`, `src/utils/comment-anchor.ts`
- **问题**: 两处空白节点过滤逻辑不一致
- **修复**: 提取为统一的工具函数
- **预估**: 45 分钟

### 优先级 2：低优先级 Bug（边缘情况）

**4. search.rs 符号链接安全**
- **文件**: `src-tauri/src/search.rs`
- **修复**: 改为 `follow_links(false)`
- **预估**: 15 分钟

**5. comment-highlight.ts 跨节点高亮**
- **文件**: `src/utils/comment-highlight.ts`
- **修复**: 支持多 Range 或遍历所有节点
- **预估**: 2 小时

**6. CommentSystem.fromJSON 防御性编程**
- **文件**: `src/lib/comments/commentSystem.ts`
- **修复**: 添加 `parseInt` 结果验证
- **预估**: 30 分钟

---

## 🎨 阶段 2：UI/UX 优化（2-3 天）

### 集成增强功能

**1. 启用 CommentSidebarEnhanced**
- **当前**: 基础版 `CommentSidebar.vue` 功能简单
- **目标**: 启用功能更完整的 `CommentSidebarEnhanced.vue`
- **新增功能**:
  - 置信度警告显示
  - hover 状态联动
  - 相对时间显示（"5 分钟前"）
  - 显示/隐藏已解决评论
  - 评论卡片位置追踪
- **文件修改**:
  - `src/App-vue.vue`: 替换组件导入
  - 删除旧的 `CommentSidebar.vue`
- **预估**: 1 小时

**2. 集成 CommentHighlightOverlay**
- **当前**: 评论没有高亮显示
- **目标**: 在编辑器中显示评论高亮和连线
- **实现**:
  ```vue
  <!-- MilkdownEditor.vue -->
  <CommentHighlightOverlay
    :highlights="highlightPositions"
    :connectionLines="connectionLines"
    :editorWidth="editorWidth"
    :editorHeight="editorHeight"
    @clickHighlight="handleClickHighlight"
  />
  ```
- **预估**: 3 小时

**3. 集成 SearchPanel 快捷键**
- **当前**: SearchPanel 组件已创建但未使用
- **目标**: Cmd+P 打开文件搜索，Cmd+Shift+F 打开内容搜索
- **实现**: 在 `App-vue.vue` 中注册快捷键和显示逻辑
- **预估**: 2 小时

**4. 集成 shortcuts.ts 系统**
- **当前**: 完整的快捷键管理类未使用
- **目标**: 统一管理所有快捷键
- **实现**:
  ```typescript
  // main-vue.ts
  import { shortcutManager, defaultShortcuts } from './utils/shortcuts'
  
  shortcutManager.register({
    ...defaultShortcuts.quickOpen,
    handler: () => showSearchPanel('files')
  })
  
  shortcutManager.start()
  ```
- **预估**: 2 小时

---

## 🚀 阶段 3：性能优化（1-2 天）

### 大文件支持

**1. 虚拟滚动文件树**
- **问题**: 1000+ 个文件时渲染卡顿
- **方案**: 使用 `vue-virtual-scroller`
- **预估**: 3 小时

**2. 锚点重定位性能优化**
- **问题**: Levenshtein 算法在大文件上慢
- **方案**:
  - 使用 Web Worker 后台处理
  - 引入 `fastest-levenshtein` 库（性能提升 3-5x）
- **预估**: 4 小时

**3. 编辑器大文件处理**
- **问题**: > 100KB Markdown 文件加载慢
- **方案**:
  - 延迟加载（分块渲染）
  - 虚拟滚动
- **预估**: 5 小时

---

## 📦 阶段 4：代码重构（2-3 天）

### 消除重复代码

**1. 提取共享工具函数**
- **TreeWalker 文本遍历**: 3 处重复 → 统一为 `utils/dom.ts`
- **Range 偏移计算**: 2 处重复 → 统一为 `utils/range.ts`
- **时间格式化**: 2 处重复 → 统一为 `utils/time.ts`
- **预估**: 2 小时

**2. 替换手动实现为库**
- **Levenshtein 距离**: 使用 `fastest-levenshtein`
- **防抖/节流**: 使用 `@vueuse/core` 的 `useDebounceFn`
- **预估**: 1 小时

**3. 统一类型定义**
- **问题**: `stores/comments.ts` 和 `lib/anchor/anchorTypes.ts` 类型定义重复
- **方案**: 统一使用一套类型定义
- **预估**: 1.5 小时

**4. 清理死代码**
- 删除 `src/lib/comments/commentSystem.ts` (93 行，未使用)
- 删除 `src/lib/anchor/anchorTypes.ts` (55 行，未使用)
- 删除 `src/utils/shortcuts.ts` 或集成使用
- **预估**: 30 分钟

---

## ✨ 阶段 5：新增功能（3-5 天）

### 高价值功能

**1. 评论线程（回复功能）**
- **当前**: 评论独立，无法回复
- **目标**: 支持嵌套回复
- **数据结构**:
  ```typescript
  interface Comment {
    id: string
    parentId: string | null  // null = 顶级评论
    replies: Comment[]       // 子评论
  }
  ```
- **UI**: 缩进显示回复
- **预估**: 1 天

**2. 评论协作（多用户）**
- **目标**: 显示评论作者
- **实现**:
  ```typescript
  interface Comment {
    author: {
      name: string
      email: string
      avatar?: string
    }
  }
  ```
- **配置**: 用户在设置中配置身份
- **预估**: 1 天

**3. 评论导出**
- **格式**: Markdown、HTML、JSON
- **场景**: 代码审查报告、文档反馈
- **实现**: Tauri `export_comments` 命令
- **预估**: 0.5 天

**4. 文件历史版本**
- **目标**: 查看文件编辑历史（基于 git）
- **实现**: 调用 `git log --follow <file>`
- **UI**: 时间线视图
- **预估**: 2 天

**5. Markdown 预览模式**
- **当前**: WYSIWYG 模式
- **新增**: 分屏预览（编辑器 | 预览）
- **切换**: 工具栏按钮
- **预估**: 1 天

**6. 图片粘贴和拖拽**
- **目标**: 从剪贴板粘贴图片，自动保存到 `assets/` 文件夹
- **实现**: 监听 `paste` 事件，调用 Tauri 文件 API
- **预估**: 1 天

---

## 🧪 阶段 6：测试和文档（2-3 天）

### 单元测试

**1. 锚点算法测试**
- `comment-anchor.ts` 的 Levenshtein 距离
- 三层重定位策略
- 边界情况（空文件、超长文件）
- **预估**: 1 天

**2. Rust 后端测试**
- 文件系统操作
- 评论 CRUD
- 搜索功能
- **预估**: 1 天

### E2E 测试

**1. 关键流程测试**
- 打开文件夹 → 编辑文件 → 添加评论 → 保存
- 搜索文件 → 打开文件
- 文件切换 → 未保存警告
- **工具**: Playwright 或 Tauri 的 WebDriver
- **预估**: 1 天

### 用户文档

**1. 用户手册**
- 安装指南
- 功能使用教程
- 快捷键列表
- 常见问题
- **预估**: 0.5 天

**2. API 文档**
- Rust 后端 API
- Vue 组件 props/events
- **工具**: rustdoc + VuePress
- **预估**: 0.5 天

---

## 🌐 阶段 7：部署和发布（1-2 天）

### 打包优化

**1. 减小应用体积**
- 移除未使用的依赖
- Tree-shaking 优化
- 压缩资源文件
- **目标**: < 10MB
- **预估**: 0.5 天

**2. 多平台构建**
- macOS (dmg + app)
- Windows (msi + exe)
- Linux (AppImage + deb)
- **预估**: 0.5 天

### 发布流程

**1. 版本管理**
- 语义化版本（SemVer）
- CHANGELOG.md 生成
- Git tag 标记
- **预估**: 2 小时

**2. 发布到 GitHub Releases**
- 自动化 CI/CD（GitHub Actions）
- 构建所有平台
- 上传安装包
- **预估**: 4 小时

**3. 文档站点**
- GitHub Pages 部署
- 项目主页
- 在线演示（可选）
- **预估**: 4 小时

---

## 📊 总体时间规划

| 阶段 | 内容 | 预估时间 | 优先级 |
|------|------|---------|--------|
| **阶段 1** | Bug 修复完善 | 1-2 天 | ⭐⭐⭐ 高 |
| **阶段 2** | UI/UX 优化 | 2-3 天 | ⭐⭐⭐ 高 |
| **阶段 3** | 性能优化 | 1-2 天 | ⭐⭐ 中 |
| **阶段 4** | 代码重构 | 2-3 天 | ⭐⭐ 中 |
| **阶段 5** | 新增功能 | 3-5 天 | ⭐ 低（可选）|
| **阶段 6** | 测试和文档 | 2-3 天 | ⭐⭐⭐ 高 |
| **阶段 7** | 部署和发布 | 1-2 天 | ⭐⭐⭐ 高 |
| **总计** | | **12-20 天** | |

---

## 🎯 推荐执行顺序

### 近期（1 周内）
1. ✅ **阶段 1：Bug 修复** - 保证功能稳定
2. ✅ **阶段 2：UI/UX 优化** - 提升用户体验
3. ⏳ **阶段 6（部分）：基础测试** - 验证核心功能

### 中期（2-3 周）
4. ⏳ **阶段 3：性能优化** - 支持大文件
5. ⏳ **阶段 4：代码重构** - 提升可维护性
6. ⏳ **阶段 6（完成）：完整测试** - 全面验证

### 长期（1 个月+）
7. ⏳ **阶段 5：新增功能** - 根据用户反馈决定
8. ⏳ **阶段 7：发布** - 正式发布 v1.0

---

## 💡 建议

### 最小可发布产品（MVP）
如果要快速发布，建议完成：
- ✅ 阶段 1（Bug 修复）
- ✅ 阶段 2（UI 优化）
- ✅ 阶段 6（基础测试）
- ✅ 阶段 7（打包发布）

**时间**: 5-7 天  
**版本**: v0.9.0 (Beta)

### 完整产品（v1.0）
建议完成所有阶段：
- 所有 bug 修复
- 性能优化
- 代码重构
- 完整测试

**时间**: 12-20 天  
**版本**: v1.0.0 (Stable)

---

## 📝 后续维护计划

### 持续优化
- 每月发布一次小版本（bug 修复）
- 每季度发布一次大版本（新功能）
- 根据用户反馈迭代

### 社区建设
- GitHub Issues 管理
- 用户反馈收集
- 贡献者指南

---

## 🔄 版本规划

### v0.9.0 (Beta) - 当前版本
- ✅ 核心功能完成
- ✅ 关键 bug 已修复
- ⏳ 待集成 UI 增强组件

### v0.9.5 (RC)
- 阶段 1 + 2 完成
- 所有 UI 组件集成
- 基础测试完成

### v1.0.0 (Stable)
- 所有阶段完成
- 完整测试覆盖
- 文档齐全
- 性能优化

### v1.1.0+
- 根据用户反馈添加新功能
- 持续性能优化
- 社区贡献集成

---

**当前状态**: v0.9.0 - 核心功能完成，关键 bug 已修复  
**下一步**: 阶段 1（Bug 修复）→ 阶段 2（UI/UX 优化）
