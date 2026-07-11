import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'
import { useWorkspaceStore } from '../stores/workspace'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

vi.mock('../components/FileTree.vue', () => ({
  default: { template: '<div data-testid="file-tree" />' },
}))

vi.mock('../components/MilkdownEditor.vue', () => ({
  default: {
    props: ['file', 'saveContent'],
    emits: ['createComment'],
    template: '<div data-testid="editor" />',
  },
}))

vi.mock('../components/CommentSidebar.vue', () => ({
  default: { template: '<div data-testid="comment-sidebar" />' },
}))

vi.mock('../components/SearchPanel.vue', () => ({
  default: {
    props: ['show', 'mode', 'workspacePath'],
    emits: ['close', 'openFile'],
    template: '<div v-if="show" data-testid="search-panel">{{ mode }}:{{ workspacePath }}</div>',
  },
}))

describe('App shell actions', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('工具栏能打开文件名搜索和内容搜索', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })
    const workspace = useWorkspaceStore()
    workspace.folderPath = '/tmp/workspace'
    await wrapper.vm.$nextTick()

    await wrapper.get('button:nth-of-type(1)').trigger('click')
    expect(wrapper.get('[data-testid="search-panel"]').text()).toBe('files:/tmp/workspace')

    await wrapper.get('button:nth-of-type(2)').trigger('click')
    expect(wrapper.get('[data-testid="search-panel"]').text()).toBe('content:/tmp/workspace')
  })

  it('导出 HTML 会调用 Tauri export_as_html 命令', async () => {
    vi.mocked(save).mockResolvedValue('/tmp/workspace/note.html')
    vi.mocked(invoke).mockResolvedValue(undefined)

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })
    const workspace = useWorkspaceStore()
    workspace.folderPath = '/tmp/workspace'
    workspace.currentFile = {
      path: '/tmp/workspace/note.md',
      content: '# Note',
    }
    await wrapper.vm.$nextTick()

    await wrapper.get('button:nth-of-type(3)').trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith({
      defaultPath: '/tmp/workspace/note.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    expect(invoke).toHaveBeenCalledWith('export_as_html', {
      workspacePath: '/tmp/workspace',
      filePath: '/tmp/workspace/note.md',
      outputPath: '/tmp/workspace/note.html',
      cssContent: null,
    })
    expect(wrapper.text()).toContain('HTML 已导出')
  })
})
