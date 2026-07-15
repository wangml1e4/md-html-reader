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
    await flushPromises()
    expect(wrapper.get('[data-testid="search-panel"]').text()).toBe('files:/tmp/workspace')

    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await flushPromises()
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
    expect((wrapper.get('[aria-label="嵌入原 Markdown（支持分屏）"]').element as HTMLInputElement).checked).toBe(false)

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
      includeMarkdownSource: false,
    })
    expect(wrapper.text()).toContain('已生成并打开 HTML 阅读版')
  })

  it('工作区外导出路径显示明确限制说明', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(save).mockResolvedValue('/tmp/outside/note.html')
    vi.mocked(invoke).mockRejectedValue(new Error('路径不在已授权工作区内'))

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    const workspace = useWorkspaceStore()
    workspace.folderPath = '/tmp/workspace'
    workspace.currentFile = { path: '/tmp/workspace/note.md', content: '# Note' }
    await wrapper.vm.$nextTick()

    await wrapper.get('button:nth-of-type(3)').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toBe('导出位置必须位于当前工作区内')
    errorSpy.mockRestore()
  })
})
