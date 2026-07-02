/**
 * 评论锚点定位算法
 * 基于文本引用（quote）+ 字符偏移（offset）+ 模糊匹配
 */

export interface CommentAnchor {
  quote: string    // 被评论的文本片段（前后各 50 字符）
  offset: number   // 文本在文件中的字符偏移
  length: number   // 高亮文本长度
}

export interface AnchorRelocateResult {
  newOffset: number
  confidence: number  // 置信度 0-1
  isValid: boolean    // 是否有效（confidence > 0.5）
}

/**
 * 创建评论锚点
 * @param fullText 完整文本内容
 * @param selectionStart 选中开始位置
 * @param selectionEnd 选中结束位置
 */
export function createAnchor(
  fullText: string,
  selectionStart: number,
  selectionEnd: number
): CommentAnchor {
  const selectedText = fullText.substring(selectionStart, selectionEnd)

  // 提取前后文本作为 quote（各取 50 字符）
  const quoteStart = Math.max(0, selectionStart - 50)
  const quoteEnd = Math.min(fullText.length, selectionEnd + 50)
  const quote = fullText.substring(quoteStart, quoteEnd)

  return {
    quote,
    offset: selectionStart,
    length: selectedText.length,
  }
}

/**
 * 重新定位锚点（文件编辑后）
 * 使用模糊匹配算法找到最佳位置
 * @param anchor 原始锚点
 * @param newText 新的文件内容
 */
export function relocateAnchor(
  anchor: CommentAnchor,
  newText: string
): AnchorRelocateResult {
  // 策略 1：精确匹配 quote
  const exactMatch = newText.indexOf(anchor.quote)
  if (exactMatch !== -1) {
    const offsetInQuote = anchor.quote.indexOf(
      anchor.quote.substring(50, 50 + anchor.length)
    )
    return {
      newOffset: exactMatch + offsetInQuote,
      confidence: 1.0,
      isValid: true,
    }
  }

  // 策略 2：模糊匹配核心文本（去除前后各 50 字符）
  const coreText = extractCoreText(anchor.quote, anchor.length)
  const fuzzyMatch = fuzzySearch(coreText, newText)

  if (fuzzyMatch.confidence > 0.5) {
    return {
      newOffset: fuzzyMatch.offset,
      confidence: fuzzyMatch.confidence,
      isValid: true,
    }
  }

  // 策略 3：基于原 offset 附近搜索
  const nearbyMatch = searchNearby(coreText, newText, anchor.offset, 200)

  if (nearbyMatch.confidence > 0.3) {
    return {
      newOffset: nearbyMatch.offset,
      confidence: nearbyMatch.confidence,
      isValid: nearbyMatch.confidence > 0.5,
    }
  }

  // 失败：返回原 offset，置信度为 0
  return {
    newOffset: anchor.offset,
    confidence: 0,
    isValid: false,
  }
}

/**
 * 提取锚点核心文本（去除前后文）
 */
function extractCoreText(quote: string, length: number): string {
  // 如果 quote 长度不足 50 字符，直接返回全部内容
  if (quote.length < 50) {
    return quote
  }

  const start = 50 // 跳过前 50 字符
  const end = Math.min(start + length, quote.length) // 防止超出边界
  return quote.substring(start, end)
}

/**
 * 模糊搜索文本
 * 使用滑动窗口 + 相似度计算
 */
function fuzzySearch(
  needle: string,
  haystack: string
): { offset: number; confidence: number } {
  if (needle.length === 0) {
    return { offset: 0, confidence: 0 }
  }

  let bestOffset = 0
  let bestScore = 0

  const windowSize = needle.length
  const step = Math.max(1, Math.floor(windowSize / 4)) // 跳步搜索，提高性能

  for (let i = 0; i <= haystack.length - windowSize; i += step) {
    const window = haystack.substring(i, i + windowSize)
    const score = similarity(needle, window)

    if (score > bestScore) {
      bestScore = score
      bestOffset = i
    }

    // 如果找到高相似度匹配，提前退出
    if (score > 0.95) break
  }

  return {
    offset: bestOffset,
    confidence: bestScore,
  }
}

/**
 * 在 offset 附近搜索（文本可能只是轻微移动）
 */
function searchNearby(
  needle: string,
  haystack: string,
  centerOffset: number,
  radius: number
): { offset: number; confidence: number } {
  const start = Math.max(0, centerOffset - radius)
  const end = Math.min(haystack.length, centerOffset + radius + needle.length)
  const nearbyText = haystack.substring(start, end)

  const result = fuzzySearch(needle, nearbyText)

  return {
    offset: start + result.offset,
    confidence: result.confidence,
  }
}

/**
 * 计算两个字符串的相似度（Levenshtein 距离归一化）
 * 返回 0-1，1 表示完全相同
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0

  const distance = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)

  return 1 - distance / maxLen
}

/**
 * Levenshtein 距离（编辑距离）
 * 动态规划实现
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * 高亮文本在编辑器中的位置
 * 用于渲染高亮和连线
 */
export function calculateHighlightPosition(
  editorElement: HTMLElement,
  offset: number,
  length: number
): { top: number; left: number; height: number } | null {
  const textNodes = getTextNodes(editorElement)
  let currentOffset = 0

  for (const node of textNodes) {
    const nodeLength = node.textContent?.length || 0

    if (currentOffset + nodeLength >= offset) {
      const range = document.createRange()
      const startInNode = offset - currentOffset
      const endInNode = Math.min(startInNode + length, nodeLength)

      range.setStart(node, startInNode)
      range.setEnd(node, endInNode)

      const rect = range.getBoundingClientRect()
      const editorRect = editorElement.getBoundingClientRect()

      return {
        top: rect.top - editorRect.top,
        left: rect.left - editorRect.left,
        height: rect.height,
      }
    }

    currentOffset += nodeLength
  }

  return null
}

/**
 * 获取元素下所有文本节点
 */
function getTextNodes(element: HTMLElement): Text[] {
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  )

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text)
    }
  }

  return textNodes
}
