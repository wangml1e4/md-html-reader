import { describe, it, expect } from 'vitest'
import {
  createAnchor,
  relocateAnchor,
} from '../utils/comment-anchor'

describe('comment-anchor.ts - 评论锚点算法', () => {
  describe('createAnchor', () => {
    it('应该创建正确的锚点（标准情况）', () => {
      const fullText = 'a'.repeat(100) + 'selected text' + 'b'.repeat(100)
      const selectionStart = 100
      const selectionEnd = 113

      const anchor = createAnchor(fullText, selectionStart, selectionEnd)

      expect(anchor.offset).toBe(100)
      expect(anchor.length).toBe(13)
      expect(anchor.quote).toContain('selected text')
      expect(anchor.quote.length).toBeLessThanOrEqual(163) // 50 + 13 + 50 = 113 max
    })

    it('应该处理文件开头的选择', () => {
      const fullText = 'selected text at start' + 'b'.repeat(100)
      const selectionStart = 0
      const selectionEnd = 22

      const anchor = createAnchor(fullText, selectionStart, selectionEnd)

      expect(anchor.offset).toBe(0)
      expect(anchor.length).toBe(22)
      expect(anchor.quote).toContain('selected text at start')
    })

    it('应该处理文件结尾的选择', () => {
      const fullText = 'a'.repeat(100) + 'selected text at end'
      const selectionStart = 100
      const selectionEnd = 120

      const anchor = createAnchor(fullText, selectionStart, selectionEnd)

      expect(anchor.offset).toBe(100)
      expect(anchor.length).toBe(20)
      expect(anchor.quote).toContain('selected text at end')
    })

    it('应该处理短文件（< 100 字符）', () => {
      const fullText = 'short file with selected text'
      const selectionStart = 16
      const selectionEnd = 29

      const anchor = createAnchor(fullText, selectionStart, selectionEnd)

      expect(anchor.offset).toBe(16)
      expect(anchor.length).toBe(13)
      expect(anchor.quote).toBe(fullText) // 整个文件都是 quote
    })
  })

  describe('relocateAnchor - 精确匹配策略', () => {
    it('应该精确匹配未修改的文本', () => {
      const originalText = 'a'.repeat(50) + 'target text' + 'b'.repeat(50)
      const anchor = createAnchor(originalText, 50, 61)

      const result = relocateAnchor(anchor, originalText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(1.0)
      expect(result.newOffset).toBe(50)
    })

    it('应该在前面插入文本后重新定位', () => {
      const originalText = 'a'.repeat(50) + 'target text' + 'b'.repeat(50)
      const anchor = createAnchor(originalText, 50, 61)

      const newText = 'INSERTED TEXT\n' + originalText

      const result = relocateAnchor(anchor, newText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(1.0)
      expect(result.newOffset).toBe(64) // 50 + 14 (插入文本长度)
    })
  })

  describe('relocateAnchor - 模糊匹配策略', () => {
    it('应该模糊匹配轻微修改的文本', () => {
      const originalText = 'a'.repeat(50) + 'target text' + 'b'.repeat(50)
      const anchor = createAnchor(originalText, 50, 61)

      // 修改一个字符
      const newText = 'a'.repeat(50) + 'target teXt' + 'b'.repeat(50)

      const result = relocateAnchor(anchor, newText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.newOffset).toBeCloseTo(50, 2)
    })

    it('应该在多处修改后仍能定位', () => {
      const originalText = 'prefix text here. The target text is important. suffix text here.'
      const anchor = createAnchor(originalText, 22, 40)

      // 修改前缀和后缀
      const newText = 'DIFFERENT prefix. The target text is important. DIFFERENT suffix.'

      const result = relocateAnchor(anchor, newText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('relocateAnchor - 边界情况', () => {
    it('应该处理空文本', () => {
      const anchor = {
        quote: 'some text',
        offset: 0,
        length: 9,
      }

      const result = relocateAnchor(anchor, '')

      expect(result.isValid).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('应该处理完全不同的文本（置信度低）', () => {
      const originalText = 'original text content'
      const anchor = createAnchor(originalText, 0, 8)

      const completelyDifferentText = 'xyz'.repeat(100)

      const result = relocateAnchor(anchor, completelyDifferentText)

      expect(result.isValid).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('应该处理目标文本被删除的情况', () => {
      const originalText = 'prefix text. TARGET DELETED. suffix text.'
      const anchor = createAnchor(originalText, 13, 28)

      const newText = 'prefix text. suffix text.'

      const result = relocateAnchor(anchor, newText)

      expect(result.isValid).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })
  })

  describe('relocateAnchor - 短文件特殊处理', () => {
    it('应该处理短文件（< 50 字符）的锚点', () => {
      const shortText = 'This is a short file with text'
      const anchor = createAnchor(shortText, 10, 21)

      // 轻微修改
      const newText = 'This is a short file with TEXT'

      const result = relocateAnchor(anchor, newText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('应该防止短 quote 导致的空字符串问题（bug #8 修复验证）', () => {
      const shortText = 'Only thirty characters here!!'
      const anchor = createAnchor(shortText, 5, 11)

      const result = relocateAnchor(anchor, shortText)

      expect(result.isValid).toBe(true)
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内处理大文件（10KB）', () => {
      const largeText = 'a'.repeat(5000) + 'target text' + 'b'.repeat(5000)
      const anchor = createAnchor(largeText, 5000, 5011)

      const startTime = Date.now()
      const result = relocateAnchor(anchor, largeText)
      const endTime = Date.now()

      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // 应该在 100ms 内完成
    })
  })
})
