# 架构重构指南

## 已完成的修复

### ✅ 立即修复（安全）
1. **Mermaid XSS 漏洞** - 添加 DOMPurify 清理 SVG 输出
2. **配置 securityLevel: 'strict'** - 防御已知 CVE (CVE-2025-54881, CVE-2025-54880)

### ✅ 高优先级修复
1. **mermaidCounter ID 冲突** - 改用时间戳+索引保证唯一性
2. **串行渲染性能** - 改用 Promise.allSettled 并行渲染（性能提升 N 倍）
3. **错误消息未转义** - 使用 textContent 方式转义 err.message

### ✅ 中优先级修复（部分）
1. **循环依赖风险** - highlight 函数改用 window.markdownit().utils
2. **lang 参数注入** - 转义 lang 防止属性注入
3. **共享模块创建** - 创建 shared-markdown.js 解决代码重复

### ⏳ 待完成（架构重构）

#### 1. 使用共享模块重构现有文件

**shared-markdown.js** 已创建，包含：
- `createMarkdownRenderer()` - 创建配置好的 markdown-it 实例
- `initMermaid()` - 初始化 Mermaid 配置
- `renderMarkdown()` - 核心渲染函数（并行、安全、防注入）
- `createSessionIdGenerator()` - 会话 ID 生成器

**重构步骤：**

##### enhanced.html 重构示例：
```html
<!-- 添加共享模块 -->
<script type="module">
  import { 
    createMarkdownRenderer, 
    initMermaid, 
    renderMarkdown,
    createSessionIdGenerator
  } from './shared-markdown.js';

  // 初始化
  initMermaid();
  const md = createMarkdownRenderer();
  const getSessionId = createSessionIdGenerator();

  // 简化的渲染函数
  async function render() {
    const source = document.getElementById('editor').value;
    const preview = document.getElementById('preview');
    await renderMarkdown(md, source, preview, getSessionId());
  }

  // 保留其他功能（打开、保存、导出等）
  window.openFile = async function() { ... };
  window.saveFile = async function() { ... };
</script>
```

##### editor.html 重构示例：
```html
<script type="module">
  import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6.0.1';
  import { markdown } from 'https://esm.sh/@codemirror/lang-markdown@6';
  import { EditorState } from 'https://esm.sh/@codemirror/state@6';
  
  import { 
    createMarkdownRenderer, 
    initMermaid, 
    renderMarkdown,
    createSessionIdGenerator
  } from './shared-markdown.js';

  initMermaid();
  const md = createMarkdownRenderer();
  const getSessionId = createSessionIdGenerator();

  let editorView;

  async function render() {
    if (!editorView) return;
    const source = editorView.state.doc.toString();
    const preview = document.getElementById('preview');
    await renderMarkdown(md, source, preview, getSessionId());
  }

  // 编辑器初始化和其他功能保持不变
</script>
```

##### comments.html 同步更新：
**重要**：comments.html 当前的 renderMarkdown 仍是同步函数，需要改为 async 并使用共享模块。

#### 2. markdown-it 插件方式重构（更深层次）

当前实现是 DOM 后处理（workaround），正确的架构应该使用 markdown-it 插件：

```javascript
// 创建 markdown-it-mermaid-safe.js
export default function markdownItMermaidSafe(md) {
  const defaultFence = md.renderer.rules.fence || 
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info.trim();
    
    if (info === 'mermaid') {
      // 生成占位符，在 DOMContentLoaded 后异步渲染
      const id = `mermaid-placeholder-${Math.random().toString(36).substr(2, 9)}`;
      return `<div class="mermaid-placeholder" data-mermaid-id="${id}" data-mermaid-code="${encodeURIComponent(token.content)}"></div>`;
    }
    
    return defaultFence(tokens, idx, options, env, self);
  };
}

// 使用：
const md = window.markdownit({ html: false }).use(markdownItMermaidSafe);
```

这种方式的优势：
- 不依赖脆弱的 CSS 类名契约
- 可以处理嵌套场景
- 符合 markdown-it 的扩展机制
- 可以单独测试和发布

#### 3. 测试验证

创建测试文件验证重构后的行为：

```javascript
// test-shared-markdown.html
import { createMarkdownRenderer, renderMarkdown, createSessionIdGenerator } from './shared-markdown.js';

const md = createMarkdownRenderer();
const getSessionId = createSessionIdGenerator();

// 测试 1: XSS 防护
const xssTest = `
\`\`\`mermaid
graph TD
    A["<img src=x onerror=alert('XSS')>"]
\`\`\`
`;

// 测试 2: ID 唯一性
async function testIdUniqueness() {
  for (let i = 0; i < 3; i++) {
    const preview = document.getElementById('preview');
    await renderMarkdown(md, xssTest, preview, getSessionId());
    // 验证 DOM 中没有重复 ID
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
    const uniqueIds = new Set(ids);
    console.assert(ids.length === uniqueIds.size, 'ID 冲突检测失败');
  }
}

// 测试 3: 并行渲染性能
const multiMermaid = `
\`\`\`mermaid
graph TD; A-->B;
\`\`\`
\`\`\`mermaid
graph TD; C-->D;
\`\`\`
\`\`\`mermaid
graph TD; E-->F;
\`\`\`
`;

async function testParallelPerformance() {
  const start = performance.now();
  await renderMarkdown(md, multiMermaid, preview, getSessionId());
  const duration = performance.now() - start;
  console.log(`3 个图表并行渲染耗时: ${duration}ms`);
  // 预期：< 500ms（串行会 > 1000ms）
}
```

## 优先级建议

### 现在可以完成的（不破坏现有功能）：
1. ✅ 安全修复已完成（enhanced.html + editor.html）
2. ⏳ **下一步**：更新 comments.html 使用相同的安全修复
3. ⏳ **下一步**：逐个文件重构为使用 shared-markdown.js

### 后续架构升级（需要更多测试）：
4. 创建 markdown-it-mermaid-safe 插件
5. 重写所有文件使用插件方式
6. 添加完整的测试套件

## 风险评估

| 任务 | 风险 | 影响 | 建议 |
|------|------|------|------|
| 当前的安全修复 | 低 | 立即生效 | ✅ 已完成 |
| 使用 shared-markdown.js | 中 | 需要测试三个文件 | 逐个迁移 + 回归测试 |
| 插件方式重构 | 高 | 改变渲染机制 | 新分支开发 + 充分测试 |

## 验证清单

- [x] Mermaid XSS 修复（DOMPurify）
- [x] ID 冲突修复（时间戳+索引）
- [x] 并行渲染（Promise.allSettled）
- [x] 错误消息转义
- [x] 循环依赖修复
- [x] lang 参数转义
- [x] 共享模块创建
- [ ] comments.html 同步更新
- [ ] 三个文件使用共享模块
- [ ] markdown-it 插件实现
- [ ] 完整测试套件

## 下一步行动

**立即行动**（低风险，高价值）：
```bash
# 1. 更新 comments.html 的安全修复
# 2. 验证三个文件都能正常工作
# 3. 提交安全修复的完整版本
```

**中期规划**（1-2 周）：
```bash
# 1. 创建使用 shared-markdown.js 的分支
# 2. 逐个文件迁移并测试
# 3. 合并后删除重复代码
```

**长期架构**（1-2 月）：
```bash
# 1. 研究 markdown-it 插件最佳实践
# 2. 实现 markdown-it-mermaid-safe
# 3. 发布为独立 npm 包（可选）
```
