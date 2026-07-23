import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../App.vue'
import { useWorkspaceStore } from '../stores/workspace'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { setLocale } from '../i18n'

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
    setLocale('en')
    vi.clearAllMocks()
  })

  it('shows a no-API onboarding path and explains privacy limits before a folder is opened', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })

    expect(wrapper.text()).toContain('MD+HTML Reader')
    expect(wrapper.text()).toContain('Edit, review, and export Markdown without giving up control of your files.')
    expect(wrapper.text()).toContain('work without an account or API key')
    expect(wrapper.text()).not.toContain('Document tools')

    await wrapper.findAll('button').find(button => button.text() === 'View the 30-second walkthrough')!.trigger('click')
    expect(wrapper.get('[role="dialog"][aria-label="Quick start"]').text()).toContain('Your first review in 30 seconds')
    expect(wrapper.text()).toContain('AI tools are opt-in')

    await wrapper.findAll('button').find(button => button.text() === 'Privacy & Beta notes')!.trigger('click')
    expect(wrapper.get('[role="dialog"][aria-label="Privacy and Beta notes"]').text()).toContain('Comment highlights can be less precise after major edits')
  })

  it('switches the desktop interface to Chinese and remembers the preference', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })

    await wrapper.get('select[aria-label="Language"]').setValue('zh-CN')

    expect(wrapper.text()).toContain('编辑、审阅和导出 Markdown，同时始终掌控你的文件。')
    expect(wrapper.text()).toContain('打开文档文件夹')
    expect(window.localStorage.getItem('md-html-reader.locale')).toBe('zh-CN')
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

    await wrapper.findAll('button').find(button => button.text() === 'Find files')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="search-panel"]').text()).toBe('files:/tmp/workspace')

    await wrapper.findAll('button').find(button => button.text() === 'Search content')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="search-panel"]').text()).toBe('content:/tmp/workspace')
  })

  it('YAML 文件使用原始文本编辑器而不是 Markdown 编辑器', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    const workspace = useWorkspaceStore()
    workspace.folderPath = '/tmp/workspace'
    workspace.currentFile = {
      path: '/tmp/workspace/config.yaml',
      content: 'enabled: true',
    }
    await wrapper.vm.$nextTick()

    expect((wrapper.get('textarea[aria-label="YAML editor"]').element as HTMLTextAreaElement).value)
      .toContain('enabled: true')
    expect(wrapper.find('[data-testid="editor"]').exists()).toBe(false)
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
    expect((wrapper.get('[aria-label="Include source Markdown"]').element as HTMLInputElement).checked).toBe(false)

    await wrapper.findAll('button').find(button => button.text() === 'Export HTML')!.trigger('click')
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
    expect(wrapper.text()).toContain('HTML reading version created and opened')
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

    await wrapper.findAll('button').find(button => button.text() === 'Export HTML')!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toBe('Export location must be inside the current workspace')
    errorSpy.mockRestore()
  })
})
