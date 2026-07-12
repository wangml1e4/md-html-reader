import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCommentsStore } from '../stores/comments'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core')

describe('comments store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('clearCurrentFile 应清空评论和当前文件元数据', () => {
    const store = useCommentsStore()
    store.list = [{
      id: 'comment-1',
      fileHash: 'hash',
      anchor: { quote: 'text', offset: 0, length: 4 },
      content: 'comment',
      status: 'open',
      createdAt: 1,
      updatedAt: 1,
    }]
    store.currentWorkspacePath = '/test'
    store.currentFileHash = 'hash'
    store.currentFilePath = '/test/note.md'

    store.clearCurrentFile()

    expect(store.list).toEqual([])
    expect(store.currentWorkspacePath).toBeNull()
    expect(store.currentFileHash).toBeNull()
    expect(store.currentFilePath).toBeNull()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadComments', () => {
    it('应该正确加载评论并设置状态（验证 bug #1 修复）', async () => {
      const store = useCommentsStore()
      const mockHash = 'abc123'
      const mockComments = [
        {
          id: 'comment-1',
          fileHash: mockHash,
          anchor: { quote: 'test', offset: 0, length: 4 },
          content: 'Test comment',
          status: 'open' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      vi.mocked(invoke).mockImplementation((cmd: string) => {
        if (cmd === 'calculate_file_hash') return Promise.resolve(mockHash)
        if (cmd === 'load_comments') return Promise.resolve(mockComments)
        return Promise.reject(new Error('Unknown command'))
      })

      await store.loadComments('/path/to', '/path/to/file.md')

      // 验证调用参数包含 filePath（bug #1 修复）
      expect(invoke).toHaveBeenCalledWith('load_comments', {
        workspacePath: '/path/to',
        fileHash: mockHash,
        filePath: '/path/to/file.md',
      })

      expect(store.currentFileHash).toBe(mockHash)
      expect(store.currentFilePath).toBe('/path/to/file.md')
      expect(store.currentWorkspacePath).toBe('/path/to')
      expect(store.list).toEqual(mockComments)
    })

    it('加载评论时应该根据当前文件内容重定位锚点', async () => {
      const store = useCommentsStore()
      const mockHash = 'hash-edited'
      const originalText = `${'a'.repeat(50)}target text${'b'.repeat(50)}`
      const currentText = `INSERTED TEXT\n${originalText}`
      const mockComments = [
        {
          id: 'comment-1',
          fileHash: 'hash-original',
          anchor: { quote: originalText, offset: 50, length: 11 },
          content: 'Test comment',
          status: 'open' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      vi.mocked(invoke).mockImplementation((cmd: string) => {
        if (cmd === 'calculate_file_hash') return Promise.resolve(mockHash)
        if (cmd === 'load_comments') return Promise.resolve(mockComments)
        return Promise.reject(new Error('Unknown command'))
      })

      await store.loadComments('/path/to', '/path/to/file.md', currentText)

      expect(store.list[0].anchor.offset).toBe(64)
      expect(store.list[0].confidence).toBe(1)
    })

    it('应该处理加载失败的情况', async () => {
      const store = useCommentsStore()
      store.currentWorkspacePath = '/old'
      store.currentFileHash = 'old-hash'
      store.currentFilePath = '/old/file.md'

      vi.mocked(invoke).mockRejectedValue(new Error('Load failed'))

      await store.loadComments('/path/to', '/path/to/file.md')

      expect(store.list).toEqual([])
      expect(store.currentWorkspacePath).toBeNull()
      expect(store.currentFileHash).toBeNull()
      expect(store.currentFilePath).toBeNull()
    })
  })

  describe('saveComment', () => {
    it('应该正确保存评论（验证 bug #2 修复）', async () => {
      const store = useCommentsStore()
      store.currentWorkspacePath = '/path/to'
      store.currentFileHash = 'abc123'
      store.currentFilePath = '/path/to/file.md'

      vi.mocked(invoke).mockResolvedValue(undefined)

      const comment = {
        fileHash: 'abc123',
        anchor: { quote: 'test', offset: 0, length: 4 },
        content: 'New comment',
        status: 'open' as const,
      }

      await store.saveComment(comment)

      // 验证调用参数包含 filePath（bug #2 修复）
      expect(invoke).toHaveBeenCalledWith('save_comment', expect.objectContaining({
        workspacePath: '/path/to',
        fileHash: 'abc123',
        filePath: '/path/to/file.md',
        comment: expect.objectContaining({
          id: expect.any(String),
          content: 'New comment',
        }),
      }))

      expect(store.list).toHaveLength(1)
      expect(store.list[0].content).toBe('New comment')
    })

    it('应该在保存失败时抛出错误且不修改状态', async () => {
      const store = useCommentsStore()
      store.currentWorkspacePath = '/path/to'
      store.currentFileHash = 'abc123'
      store.currentFilePath = '/path/to/file.md'

      vi.mocked(invoke).mockRejectedValue(new Error('Save failed'))

      const comment = {
        fileHash: 'abc123',
        anchor: { quote: 'test', offset: 0, length: 4 },
        content: 'New comment',
        status: 'open' as const,
      }

      await expect(store.saveComment(comment)).rejects.toThrow('Save failed')
      expect(store.list).toHaveLength(0) // 状态未被修改
    })

    it('应该生成唯一 ID 和时间戳', async () => {
      const store = useCommentsStore()
      store.currentWorkspacePath = '/path/to'
      store.currentFileHash = 'abc123'
      store.currentFilePath = '/path/to/file.md'

      vi.mocked(invoke).mockResolvedValue(undefined)

      const comment = {
        fileHash: 'abc123',
        anchor: { quote: 'test', offset: 0, length: 4 },
        content: 'Test',
        status: 'open' as const,
      }

      const result = await store.saveComment(comment)

      expect(result?.id).toBeTruthy()
      expect(result?.createdAt).toBeGreaterThan(0)
      expect(result?.updatedAt).toBeGreaterThan(0)
    })

    it('没有当前工作区或文件状态时拒绝保存评论', async () => {
      const store = useCommentsStore()

      await expect(store.saveComment({
        fileHash: 'abc123',
        anchor: { quote: 'test', offset: 0, length: 4 },
        content: 'New comment',
        status: 'open',
      })).rejects.toThrow('未加载评论文件')
      expect(invoke).not.toHaveBeenCalled()
    })
  })

  describe('deleteComment', () => {
    it('应该正确删除评论（验证 bug #3 修复）', async () => {
      const store = useCommentsStore()
      store.currentWorkspacePath = '/path/to'
      store.currentFileHash = 'abc123'
      store.currentFilePath = '/path/to/file.md'
      store.list = [
        {
          id: 'comment-1',
          fileHash: 'abc123',
          anchor: { quote: 'test', offset: 0, length: 4 },
          content: 'Test',
          status: 'open',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      vi.mocked(invoke).mockResolvedValue(undefined)

      await store.deleteComment('comment-1')

      // 验证调用参数包含 filePath（bug #3 修复）
      expect(invoke).toHaveBeenCalledWith('delete_comment', {
        workspacePath: '/path/to',
        fileHash: 'abc123',
        filePath: '/path/to/file.md',
        commentId: 'comment-1',
      })

      expect(store.list).toHaveLength(0)
    })
  })

  describe('updateCommentStatus', () => {
    it('应该正确更新评论状态（验证 bug #4 修复）', async () => {
      const now = 1000
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const store = useCommentsStore()
      store.currentWorkspacePath = '/path/to'
      store.currentFileHash = 'abc123'
      store.currentFilePath = '/path/to/file.md'
      store.list = [
        {
          id: 'comment-1',
          fileHash: 'abc123',
          anchor: { quote: 'test', offset: 0, length: 4 },
          content: 'Test',
          status: 'open',
          createdAt: now,
          updatedAt: now,
        },
      ]

      vi.mocked(invoke).mockResolvedValue(undefined)

      vi.setSystemTime(now + 10)
      await store.updateCommentStatus('comment-1', 'resolved')

      // 验证调用参数包含 filePath（bug #4 修复）
      expect(invoke).toHaveBeenCalledWith('update_comment', {
        workspacePath: '/path/to',
        fileHash: 'abc123',
        filePath: '/path/to/file.md',
        comment: expect.objectContaining({
          id: 'comment-1',
          status: 'resolved',
        }),
      })

      expect(store.list[0].status).toBe('resolved')
      expect(store.list[0].updatedAt).toBeGreaterThanOrEqual(now + 10)
    })

    it('应该忽略不存在的评论', async () => {
      const store = useCommentsStore()

      await store.updateCommentStatus('non-existent', 'resolved')

      expect(invoke).not.toHaveBeenCalled()
    })
  })
})
