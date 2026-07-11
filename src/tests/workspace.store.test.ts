import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../stores/workspace'
import { invoke } from '@tauri-apps/api/core'
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/core')

describe('workspace store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadFolder', () => {
    it('应该加载文件夹并设置文件列表', async () => {
      const store = useWorkspaceStore()
      const mockFiles = [
        { path: '/test/file1.md', name: 'file1.md', isDirectory: false },
        { path: '/test/file2.md', name: 'file2.md', isDirectory: false },
      ]

      vi.mocked(invoke).mockResolvedValue(mockFiles)

      await store.loadFolder('/test')

      expect(invoke).toHaveBeenCalledWith('list_files', {
        path: '/test',
      })

      expect(store.folderPath).toBe('/test')
      expect(store.files).toEqual(mockFiles)
    })

    it('应该处理加载失败', async () => {
      const store = useWorkspaceStore()

      vi.mocked(invoke).mockRejectedValue(new Error('Failed to load'))

      await store.loadFolder('/test')

      expect(store.folderPath).toBeNull()
      expect(store.files).toEqual([])
    })
  })

  describe('openFile', () => {
    it('应该打开文件并读取内容', async () => {
      const store = useWorkspaceStore()
      const mockContent = '# Test Markdown\n\nContent here.'

      store.folderPath = '/test'
      vi.mocked(invoke).mockResolvedValue(mockContent)

      await store.openFile('/test/file.md')

      expect(invoke).toHaveBeenCalledWith('read_file', {
        workspacePath: '/test',
        path: '/test/file.md',
      })

      expect(store.currentFile).toEqual({
        path: '/test/file.md',
        content: mockContent,
      })
    })

    it('应该处理读取失败', async () => {
      const store = useWorkspaceStore()

      store.folderPath = '/test'
      vi.mocked(invoke).mockRejectedValue(new Error('Read failed'))

      await store.openFile('/test/file.md')

      expect(store.currentFile).toBeNull()
    })
  })

  describe('saveCurrentFile', () => {
    it('应该保存当前文件内容', async () => {
      const store = useWorkspaceStore()
      store.folderPath = '/test'
      store.currentFile = {
        path: '/test/file.md',
        content: 'old content',
      }

      vi.mocked(invoke).mockResolvedValue(undefined)

      await store.saveCurrentFile('new content')

      expect(invoke).toHaveBeenCalledWith('write_file', {
        workspacePath: '/test',
        path: '/test/file.md',
        content: 'new content',
      })

      expect(store.currentFile.content).toBe('new content')
    })

    it('应该在没有打开文件时不执行操作', async () => {
      const store = useWorkspaceStore()

      await store.saveCurrentFile('content')

      expect(invoke).not.toHaveBeenCalled()
    })

    it('没有加载工作区时不读取或写入文件', async () => {
      const store = useWorkspaceStore()

      await store.openFile('/test/file.md')
      expect(invoke).not.toHaveBeenCalled()

      store.currentFile = {
        path: '/test/file.md',
        content: 'old content',
      }
      await expect(store.saveCurrentFile('new content')).rejects.toThrow('未加载工作区')
      expect(invoke).not.toHaveBeenCalled()
    })
  })
})
