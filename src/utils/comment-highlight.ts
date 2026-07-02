/**
 * 评论高亮管理
 * 在 Milkdown 编辑器中渲染评论高亮和连线
 */

import type { Comment } from '../stores/comments'
import { relocateAnchor } from './comment-anchor'

export interface HighlightPosition {
  commentId: string
  top: number
  left: number
  width: number
  height: number
  isValid: boolean
  confidence: number
}

/**
 * 计算所有评论的高亮位置
 */
export function calculateHighlightPositions(
  comments: Comment[],
  editorContent: string,
  editorElement: HTMLElement
): HighlightPosition[] {
  const positions: HighlightPosition[] = []

  for (const comment of comments) {
    // 重新定位锚点
    const result = relocateAnchor(comment.anchor, editorContent)

    if (result.isValid) {
      const pos = calculateSingleHighlight(
        editorElement,
        result.newOffset,
        comment.anchor.length
      )

      if (pos) {
        positions.push({
          commentId: comment.id,
          ...pos,
          isValid: true,
          confidence: result.confidence,
        })
      }
    } else {
      // 锚点失效，但仍记录（用于显示警告）
      positions.push({
        commentId: comment.id,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        isValid: false,
        confidence: result.confidence,
      })
    }
  }

  return positions
}

/**
 * 计算单个评论的高亮位置
 */
function calculateSingleHighlight(
  editorElement: HTMLElement,
  offset: number,
  length: number
): { top: number; left: number; width: number; height: number } | null {
  const textNodes = getTextNodes(editorElement)
  let currentOffset = 0

  for (const node of textNodes) {
    const nodeLength = node.textContent?.length || 0

    // 找到包含 offset 的文本节点
    if (currentOffset + nodeLength >= offset) {
      const range = document.createRange()
      const startInNode = offset - currentOffset
      const endInNode = Math.min(startInNode + length, nodeLength)

      try {
        range.setStart(node, startInNode)
        range.setEnd(node, endInNode)

        const rect = range.getBoundingClientRect()
        const editorRect = editorElement.getBoundingClientRect()

        return {
          top: rect.top - editorRect.top + editorElement.scrollTop,
          left: rect.left - editorRect.left + editorElement.scrollLeft,
          width: rect.width,
          height: rect.height,
        }
      } catch (error) {
        console.error('Range 创建失败:', error)
        return null
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
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      textNodes.push(node as Text)
    }
  }

  return textNodes
}

/**
 * 生成 SVG 连线路径
 */
export function generateConnectionLine(
  highlightPos: HighlightPosition,
  sidebarCardTop: number,
  editorWidth: number
): { x1: number; y1: number; x2: number; y2: number } {
  // 左侧高亮右边缘
  const x1 = highlightPos.left + highlightPos.width + 10
  const y1 = highlightPos.top + highlightPos.height / 2

  // 右侧评论卡片左边缘
  const x2 = editorWidth + 20
  const y2 = sidebarCardTop + 20 // 评论卡片垂直中心

  return { x1, y1, x2, y2 }
}
