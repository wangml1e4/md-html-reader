# 测试指南

## 🧪 测试框架

项目使用 **Vitest** 作为测试框架，配合 Vue Test Utils 进行组件测试。

### 技术栈
- **Vitest**: 快速的单元测试框架（兼容 Vite）
- **@vue/test-utils**: Vue 3 组件测试工具
- **jsdom**: DOM 环境模拟
- **@vitest/coverage-v8**: 代码覆盖率报告

---

## 📦 安装依赖

```bash
# 确保使用 Vue 版本的 package.json
mv package.json package-svelte-backup.json
mv package-vue.json package.json

# 安装依赖
npm install
```

---

## 🚀 运行测试

### 运行所有测试
```bash
npm test
```

### 监视模式（自动重新运行）
```bash
npm test -- --watch
```

### UI 模式（浏览器界面）
```bash
npm run test:ui
```

### 代码覆盖率
```bash
npm run test:coverage
```

---

## 📊 当前测试覆盖

### 已测试模块

#### 1. **comment-anchor.ts** (核心算法)
- ✅ createAnchor() - 锚点创建
- ✅ relocateAnchor() - 三层重定位策略
  - 精确匹配策略
  - 模糊匹配策略（Levenshtein）
  - 附近搜索策略
- ✅ 边界情况：空文本、短文件、完全不同文本
- ✅ 性能测试：10KB 文件 < 100ms
- ✅ Bug #8 修复验证：短文件边界检查

**测试用例数**: 15+  
**覆盖场景**: 标准情况、边界情况、错误处理、性能

#### 2. **comments store** (状态管理)
- ✅ loadComments() - Bug #1 修复验证
- ✅ saveComment() - Bug #2 修复验证
- ✅ deleteComment() - Bug #3 修复验证
- ✅ updateCommentStatus() - Bug #4 修复验证
- ✅ 错误处理和状态回滚

**测试用例数**: 10+  
**验证**: 所有 Tauri 调用包含 filePath 参数

#### 3. **workspace store** (文件管理)
- ✅ loadFolder() - 文件夹加载
- ✅ openFile() - 文件读取
- ✅ saveCurrentFile() - 文件保存
- ✅ 错误处理

**测试用例数**: 7+

---

## 📝 测试文件结构

```
src/tests/
├── setup.ts                      # Vitest 全局配置
├── comment-anchor.test.ts        # 锚点算法测试（15+ 用例）
├── comments.store.test.ts        # 评论 store 测试（10+ 用例）
└── workspace.store.test.ts       # 工作区 store 测试（7+ 用例）
```

---

## 🎯 测试策略

### 单元测试
- **目标**: 测试独立函数和模块
- **覆盖**: 核心算法、工具函数、状态管理
- **工具**: Vitest + Mock

### 组件测试
- **目标**: 测试 Vue 组件行为
- **覆盖**: 用户交互、事件触发、props/emits
- **工具**: Vue Test Utils

### 集成测试
- **目标**: 测试多个模块协同工作
- **覆盖**: 完整用户流程
- **工具**: Vitest + Mock Tauri API

---

## ✅ 验证的 Bug 修复

测试套件验证了以下 bug 修复：

### Bug #1-4: comments.ts 参数缺失
```typescript
// 每个测试验证 invoke 调用包含 filePath
expect(invoke).toHaveBeenCalledWith('load_comments', {
  fileHash: expect.any(String),
  filePath: expect.any(String), // ← 必须存在
})
```

### Bug #8: extractCoreText 短文件
```typescript
it('应该防止短 quote 导致的空字符串问题', () => {
  const shortText = 'Only thirty characters here!!'
  const anchor = createAnchor(shortText, 5, 11)
  const result = relocateAnchor(anchor, shortText)
  
  expect(result.isValid).toBe(true)
  expect(result.confidence).toBe(1.0)
})
```

---

## 📈 测试覆盖目标

| 模块 | 当前覆盖 | 目标覆盖 | 状态 |
|------|---------|---------|------|
| **comment-anchor.ts** | 90%+ | 95% | ✅ 优秀 |
| **stores/comments.ts** | 85%+ | 90% | ✅ 良好 |
| **stores/workspace.ts** | 80%+ | 85% | ✅ 良好 |
| **utils/selection.ts** | 0% | 70% | ⏳ 待添加 |
| **components/*.vue** | 0% | 60% | ⏳ 待添加 |

---

## 🔧 编写新测试

### 测试模板

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('模块名', () => {
  beforeEach(() => {
    // 测试前设置
  })

  describe('功能组', () => {
    it('应该做正确的事情', () => {
      // Arrange: 准备数据
      const input = 'test'

      // Act: 执行操作
      const result = someFunction(input)

      // Assert: 验证结果
      expect(result).toBe('expected')
    })

    it('应该处理错误情况', () => {
      expect(() => someFunction(null)).toThrow()
    })
  })
})
```

### Mock Tauri API

```typescript
import { vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

// 在测试中
vi.mocked(invoke).mockResolvedValue('mock result')
```

---

## 🐛 调试测试

### 查看详细输出
```bash
npm test -- --reporter=verbose
```

### 只运行特定测试
```bash
npm test -- comment-anchor
```

### 只运行失败的测试
```bash
npm test -- --run --reporter=verbose --bail
```

### 使用 UI 调试
```bash
npm run test:ui
# 打开 http://localhost:51204/__vitest__/
```

---

## 📊 持续集成

### GitHub Actions 配置示例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

## 🎯 下一步测试计划

### 优先级 1：核心功能
- [ ] selection.ts 文本选择工具
- [ ] comment-highlight.ts 高亮渲染
- [ ] SearchPanel.vue 搜索面板

### 优先级 2：UI 组件
- [ ] MilkdownEditor.vue 编辑器组件
- [ ] FileTree.vue 文件树
- [ ] CommentSidebar.vue 评论边栏

### 优先级 3：E2E 测试
- [ ] 完整用户流程
- [ ] 文件操作流程
- [ ] 评论创建流程

---

## 💡 最佳实践

1. **测试先行**: 修复 bug 前先写失败的测试
2. **独立性**: 每个测试应该独立运行
3. **可读性**: 测试名称应该清楚描述预期行为
4. **边界情况**: 测试空值、极端值、错误输入
5. **性能**: 避免慢速测试（> 1s）

---

## 🔗 相关资源

- [Vitest 文档](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**当前测试状态**: ✅ 核心模块已覆盖，32+ 测试用例通过
