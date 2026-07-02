/**
 * 文本选择工具
 * 监听文本选择，显示评论按钮
 */

export interface Selection {
  text: string
  start: number
  end: number
  rect: DOMRect
}

/**
 * 获取当前选中的文本和位置
 */
export function getSelection(): Selection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const text = selection.toString().trim()

  if (text.length === 0) return null

  // 计算在文档中的绝对偏移
  const { start, end } = calculateOffsets(range)

  return {
    text,
    start,
    end,
    rect: range.getBoundingClientRect(),
  }
}

/**
 * 计算 Range 在整个文档中的字符偏移
 */
function calculateOffsets(range: Range): { start: number; end: number } {
  const root = document.querySelector('.milkdown-container')
  if (!root) return { start: 0, end: 0 }

  const preRange = document.createRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.startContainer, range.startOffset)

  const start = preRange.toString().length
  const end = start + range.toString().length

  return { start, end }
}

/**
 * 清除文本选择
 */
export function clearSelection() {
  window.getSelection()?.removeAllRanges()
}

/**
 * 选中指定范围的文本（用于点击评论时高亮）
 */
export function selectRange(start: number, end: number) {
  const root = document.querySelector('.milkdown-container')
  if (!root) return

  const { node: startNode, offset: startOffset } = findNodeAtOffset(root, start)
  const { node: endNode, offset: endOffset } = findNodeAtOffset(root, end)

  if (!startNode || !endNode) return

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)

  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  // 滚动到可见区域
  const rect = range.getBoundingClientRect()
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    range.startContainer.parentElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}

/**
 * 根据字符偏移找到对应的文本节点和偏移
 */
function findNodeAtOffset(
  root: Element,
  targetOffset: number
): { node: Node | null; offset: number } {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  )

  let currentOffset = 0
  let node: Node | null

  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent?.length || 0

    if (currentOffset + nodeLength >= targetOffset) {
      return {
        node,
        offset: targetOffset - currentOffset,
      }
    }

    currentOffset += nodeLength
  }

  return { node: null, offset: 0 }
}

/**
 * 监听文本选择事件
 */
export function onSelectionChange(
  callback: (selection: Selection | null) => void
): () => void {
  const handler = () => {
    // 延迟一点，让选择稳定
    setTimeout(() => {
      const selection = getSelection()
      callback(selection)
    }, 10)
  }

  document.addEventListener('mouseup', handler)
  document.addEventListener('keyup', handler)

  // 返回清理函数
  return () => {
    document.removeEventListener('mouseup', handler)
    document.removeEventListener('keyup', handler)
  }
}
