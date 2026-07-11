// 简化版评论系统 - 阶段 3 原型
// 实现核心功能：选中文本 → 创建评论 → 高亮显示

interface PrototypeComment {
  id: string
  author: string
  body: string
  createdAt: string
}

interface PrototypeThread {
  id: string
  anchor: {
    exact: string
  }
  comments: PrototypeComment[]
  createdAt: string
}

interface PrototypeSidecar {
  threads?: PrototypeThread[]
}

export class CommentSystem {
  private threads: PrototypeThread[]
  private nextThreadId: number

  constructor() {
    this.threads = []
    this.nextThreadId = 1
  }

  // 从选区创建评论
  createCommentFromSelection(selection: Selection, author: string, body: string): PrototypeThread {
    const range = selection.getRangeAt(0)
    const text = range.toString()

    if (!text.trim()) {
      throw new Error('请先选中文本')
    }

    // 简化版：仅记录选中的文本内容作为锚点
    // 完整版需要实现源偏移计算（阶段 3a）
    const thread = {
      id: `thread-${this.nextThreadId++}`,
      anchor: {
        exact: text,
        // TODO: 计算 position (start, end)
        // TODO: 计算 quote (prefix, suffix)
      },
      comments: [{
        id: `comment-${Date.now()}`,
        author,
        body,
        createdAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    }

    this.threads.push(thread)
    return thread
  }

  // 高亮所有评论区间
  highlightAllThreads(previewElement: Element) {
    // 简化版：用 CSS.highlights API（如果支持）
    if (!CSS.highlights) {
      console.warn('浏览器不支持 CSS Custom Highlight API')
      return
    }

    const highlight = new Highlight()

    this.threads.forEach(thread => {
      // 查找匹配的文本节点
      const walker = document.createTreeWalker(
        previewElement,
        NodeFilter.SHOW_TEXT,
        null
      )

      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? ''
        const index = text.indexOf(thread.anchor.exact)

        if (index !== -1) {
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + thread.anchor.exact.length)
          highlight.add(range)
        }
      }
    })

    CSS.highlights.set('comment', highlight)
  }

  // 导出为 sidecar JSON
  toJSON() {
    return {
      schemaVersion: 1,
      documentFile: 'document.md',
      lastKnownDocHash: '', // TODO: 计算文档哈希
      threads: this.threads
    }
  }

  // 从 JSON 加载
  fromJSON(data: PrototypeSidecar) {
    this.threads = data.threads || []
    this.nextThreadId = Math.max(...this.threads.map(t =>
      parseInt(t.id.replace('thread-', '')) || 0
    ), 0) + 1
  }
}
