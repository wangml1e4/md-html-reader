import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import { invoke } from '@tauri-apps/api/core'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from '../stores/workspace'
import { useCommentsStore } from '../stores/comments'

const milkdownLifecycle = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
  switchRequests: 0,
  saveCurrentContentRequests: 0,
  saveCurrentContentError: null as Error | null,
  replacementRequests: [] as string[],
  allowSwitch: true,
  actions: [] as string[],
}))

const windowLifecycle = vi.hoisted(() => ({
  closeHandler: null as null | ((event: { preventDefault: () => void }) => Promise<void>),
  unlisten: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => Promise<void>) => {
      windowLifecycle.closeHandler = handler
      return windowLifecycle.unlisten
    },
  }),
}))

vi.mock('../components/FileTree.vue', () => ({
  default: {
    props: ['files', 'filter', 'displayMode', 'currentPath', 'locateToken'],
    emits: ['select'],
    template: `
      <div data-testid="file-tree">
        <span data-testid="tree-state">{{ filter }}|{{ displayMode }}|{{ currentPath }}|{{ locateToken }}</span>
        <button
          v-for="file in files"
          :key="file.path"
          data-testid="file-item"
          @click="$emit('select', file.path)"
        >
          {{ file.name }}
        </button>
      </div>
    `,
  },
}))

vi.mock('../components/MilkdownEditor.vue', () => ({
  default: {
    props: ['file', 'saveContent'],
    emits: ['createComment', 'translate'],
    mounted() {
      milkdownLifecycle.mountCount++
    },
    unmounted() {
      milkdownLifecycle.unmountCount++
    },
    setup(props: { file: { content: string }, saveContent: (content: string) => Promise<void> }, { expose }: { expose: (value: unknown) => void }) {
      expose({
        async requestDiscardChanges(action: string) {
          milkdownLifecycle.switchRequests++
          milkdownLifecycle.actions.push(action)
          return milkdownLifecycle.allowSwitch
        },
        async saveCurrentContent() {
          milkdownLifecycle.saveCurrentContentRequests++
          if (milkdownLifecycle.saveCurrentContentError) {
            throw milkdownLifecycle.saveCurrentContentError
          }
        },
        getCurrentContent() {
          return props.file.content
        },
        async replaceContent(content: string) {
          milkdownLifecycle.replacementRequests.push(content)
          await props.saveContent(content)
        },
        scrollToHeading() {},
      })
    },
    template: `
      <div data-testid="editor">
        <pre data-testid="editor-content">{{ file.content }}</pre>
        <button data-testid="save-edited" @click="saveContent('# E2E Note\\n\\nEdited keyword')">
          保存编辑
        </button>
        <button
          data-testid="add-comment"
          @click="$emit('createComment', { quote: 'Edited keyword', offset: 12, length: 14 }, 'Review note')"
        >
          添加评论
        </button>
        <button
          data-testid="translate-selection"
          @click="$emit('translate', { text: 'Hello', start: 0, end: 5, rect: { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 } })"
        >
          翻译选区
        </button>
      </div>
    `,
  },
}))

vi.mock('../components/HtmlRenderer.vue', () => ({
  default: {
    props: ['file'],
    template: `
      <div data-testid="html-renderer">
        <div data-testid="rendered-html" v-html="file.content" />
      </div>
    `,
  },
}))

vi.mock('../components/CommentSidebar.vue', () => ({
  default: {
    props: ['comments'],
    emits: ['resolve', 'delete'],
    template: `
      <div data-testid="comment-sidebar">
        <div v-for="comment in comments" :key="comment.id">
          {{ comment.content }}|{{ comment.status }}
          <button data-testid="resolve-comment" @click="$emit('resolve', comment.id)">解决评论</button>
        </div>
      </div>
    `,
  },
}))

vi.mock('../components/SearchPanel.vue', () => ({
  default: {
    props: ['show', 'mode', 'workspacePath'],
    emits: ['close', 'openFile'],
    template: `
      <div v-if="show" data-testid="search-panel">
        <span>{{ mode }}:{{ workspacePath }}</span>
        <button data-testid="search-open" @click="$emit('openFile', '/tmp/workspace/note.md', 2)">
          打开搜索结果
        </button>
      </div>
    `,
  },
}))

vi.mock('../components/DocumentOutline.vue', () => ({
  default: {
    props: ['content'],
    emits: ['select'],
    template: `
      <div data-testid="document-outline">
        <span>{{ content }}</span>
        <button data-testid="outline-select" @click="$emit('select', { level: 2, text: 'Details', line: 3 })">
          Details
        </button>
      </div>
    `,
  },
}))

vi.mock('../components/TranslationCard.vue', () => ({
  default: {
    props: ['state', 'original', 'translated', 'service', 'error'],
    template: `
      <div v-if="state !== 'idle'" data-testid="translation-card">
        {{ state }}|{{ original }}|{{ translated }}|{{ service }}|{{ error }}
      </div>
    `,
  },
}))

vi.mock('../components/DocumentAssistantPanel.vue', () => ({
  default: {
    props: ['mode', 'original', 'content', 'applying', 'permanentWritePermission', 'permissionScope'],
    emits: ['close', 'apply', 'update:permanentWritePermission'],
    template: `
      <div data-testid="document-assistant-panel">
        {{ mode }}|{{ original }}|{{ content }}|{{ permanentWritePermission }}|{{ permissionScope }}
        <button data-testid="assistant-apply" @click="$emit('apply')">应用优化稿</button>
        <input
          data-testid="assistant-permanent-write"
          type="checkbox"
          :checked="permanentWritePermission"
          @change="$emit('update:permanentWritePermission', $event.target.checked)"
        />
      </div>
    `,
  },
}))

describe('App core user flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    milkdownLifecycle.mountCount = 0
    milkdownLifecycle.unmountCount = 0
    milkdownLifecycle.switchRequests = 0
    milkdownLifecycle.saveCurrentContentRequests = 0
    milkdownLifecycle.saveCurrentContentError = null
    milkdownLifecycle.replacementRequests = []
    milkdownLifecycle.allowSwitch = true
    milkdownLifecycle.actions = []
    windowLifecycle.closeHandler = null
    windowLifecycle.unlisten.mockReset()
    window.localStorage.clear()
  })

  it('覆盖打开文件夹、打开文件、保存、评论、重开、搜索和导出 HTML', async () => {
    let fileContent = '# E2E Note\n\nOriginal keyword'
    const savedComments: any[] = []

    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(save).mockResolvedValue('/tmp/workspace/note.html')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          {
            name: 'note.md',
            path: '/tmp/workspace/note.md',
            type: 'file',
            extension: '.md',
          },
        ]
      }

      if (command === 'read_file') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        if (args.path === '/tmp/workspace/note.md') return fileContent
        if (args.path === '/tmp/workspace/note.html') return '<h1>E2E HTML</h1>'
        throw new Error(`Unexpected file: ${args.path}`)
      }

      if (command === 'write_file') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        expect(args.path).toBe('/tmp/workspace/note.md')
        fileContent = args.content
        return undefined
      }

      if (command === 'calculate_file_hash') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        return fileContent.includes('Edited') ? 'hash-edited' : 'hash-original'
      }

      if (command === 'load_comments') {
        return savedComments
      }

      if (command === 'save_comment') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        savedComments.push(args.comment)
        return undefined
      }

      if (command === 'export_as_html') {
        expect(args).toEqual({
          workspacePath: '/tmp/workspace',
          filePath: '/tmp/workspace/note.md',
          outputPath: '/tmp/workspace/note.html',
          cssContent: null,
          includeMarkdownSource: false,
        })
        return undefined
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    expect(invoke).toHaveBeenCalledWith('list_files', { path: '/tmp/workspace' })
    expect(wrapper.get('[data-testid="file-tree"]').text()).toContain('note.md')

    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('Original keyword')

    await wrapper.get('[data-testid="save-edited"]').trigger('click')
    await flushPromises()
    expect(fileContent).toContain('Edited keyword')

    await wrapper.get('[data-testid="add-comment"]').trigger('click')
    await flushPromises()
    expect(savedComments).toHaveLength(1)
    expect(savedComments[0]).toEqual(expect.objectContaining({
      fileHash: 'hash-edited',
      content: 'Review note',
    }))
    expect(wrapper.get('[data-testid="comment-sidebar"]').text()).toContain('Review note')

    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="comment-sidebar"]').text()).toContain('Review note')

    await wrapper.findAll('button').find(button => button.text() === 'Search content')!.trigger('click')
    await wrapper.get('[data-testid="search-open"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('Edited keyword')

    await wrapper.findAll('button').find(button => button.text() === 'Export HTML')!.trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledWith({
      defaultPath: '/tmp/workspace/note.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    expect(wrapper.text()).toContain('HTML reading version created and opened')
  })

  it('切换不同文件时重建编辑器实例，避免 Milkdown 保留旧文档', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          {
            name: 'first.md',
            path: '/tmp/workspace/first.md',
            type: 'file',
            extension: '.md',
          },
          {
            name: 'second.md',
            path: '/tmp/workspace/second.md',
            type: 'file',
            extension: '.md',
          },
        ]
      }

      if (command === 'read_file') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        return args.path.endsWith('second.md') ? '# Second' : '# First'
      }

      if (command === 'calculate_file_hash') {
        expect(args.workspacePath).toBe('/tmp/workspace')
        return args.path.endsWith('second.md') ? 'hash-second' : 'hash-first'
      }

      if (command === 'load_comments') {
        return []
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    const fileButtons = wrapper.findAll('[data-testid="file-item"]')
    await fileButtons[0].trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# First')

    await fileButtons[1].trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# Second')
    expect(milkdownLifecycle.switchRequests).toBe(1)
    expect(milkdownLifecycle.actions).toEqual(['switch-file'])
    expect(milkdownLifecycle.mountCount).toBe(2)
    expect(milkdownLifecycle.unmountCount).toBe(1)
  })

  it('编辑器拒绝切换时保留当前文件和未保存内容', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          { name: 'first.md', path: '/tmp/workspace/first.md', type: 'file', extension: '.md' },
          { name: 'second.md', path: '/tmp/workspace/second.md', type: 'file', extension: '.md' },
        ]
      }
      if (command === 'read_file') return args.path.endsWith('second.md') ? '# Second' : '# First'
      if (command === 'calculate_file_hash') return 'hash'
      if (command === 'load_comments') return []
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    const fileButtons = wrapper.findAll('[data-testid="file-item"]')
    await fileButtons[0].trigger('click')
    await flushPromises()
    milkdownLifecycle.allowSwitch = false

    await fileButtons[1].trigger('click')
    await flushPromises()

    expect(milkdownLifecycle.switchRequests).toBe(1)
    expect(milkdownLifecycle.actions).toEqual(['switch-file'])
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# First')
    expect(milkdownLifecycle.mountCount).toBe(1)
    expect(invoke).not.toHaveBeenCalledWith('read_file', expect.objectContaining({
      path: '/tmp/workspace/second.md',
    }))
  })

  it('切换工作区应经过未保存确认，取消时保留原状态，确认后清理旧状态', async () => {
    vi.mocked(open).mockResolvedValueOnce('/tmp/workspace').mockResolvedValue('/tmp/other')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return args.path === '/tmp/other'
          ? [{ name: 'other.md', path: '/tmp/other/other.md', type: 'file', extension: '.md' }]
          : [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Note'
      if (command === 'calculate_file_hash') return 'hash'
      if (command === 'load_comments') return []
      throw new Error(`Unexpected command: ${command}`)
    })

    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    const workspace = useWorkspaceStore(pinia)
    const comments = useCommentsStore(pinia)
    comments.list = [{
      id: 'comment-1', fileHash: 'hash', anchor: { quote: 'Note', offset: 0, length: 4 },
      content: 'comment', status: 'open', createdAt: 1, updatedAt: 1,
    }]
    milkdownLifecycle.allowSwitch = false

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    expect(workspace.folderPath).toBe('/tmp/workspace')
    expect(workspace.currentFile?.path).toBe('/tmp/workspace/note.md')
    expect(comments.list).toHaveLength(1)

    milkdownLifecycle.allowSwitch = true
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    expect(milkdownLifecycle.actions).toEqual(['switch-workspace', 'switch-workspace'])
    expect(workspace.folderPath).toBe('/tmp/other')
    expect(workspace.currentFile).toBeNull()
    expect(comments.list).toEqual([])
  })

  it('关闭窗口时取消应阻止关闭，允许后卸载监听器', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file' }]
      if (command === 'read_file') return '# Note'
      if (command === 'calculate_file_hash') return 'hash'
      if (command === 'load_comments') return []
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    const preventDefault = vi.fn()
    milkdownLifecycle.allowSwitch = false
    await windowLifecycle.closeHandler?.({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(milkdownLifecycle.actions).toEqual(['close-window'])

    milkdownLifecycle.allowSwitch = true
    await windowLifecycle.closeHandler?.({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(milkdownLifecycle.actions).toEqual(['close-window', 'close-window'])

    wrapper.unmount()
    expect(windowLifecycle.unlisten).toHaveBeenCalledOnce()
  })

  it('左侧工具条支持筛选、显示标题和定位当前文件', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          {
            name: 'note.md',
            path: '/tmp/workspace/note.md',
            type: 'file',
            extension: '.md',
            title: 'Markdown Title',
          },
          {
            name: 'page.html',
            path: '/tmp/workspace/page.html',
            type: 'file',
            extension: '.html',
            title: 'HTML Title',
          },
        ]
      }

      if (command === 'read_file') {
        return '# Note'
      }

      if (command === 'calculate_file_hash') {
        return 'hash-note'
      }

      if (command === 'load_comments') {
        return []
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('all|filename||0')

    await wrapper.findAll('button').find(button => button.text() === 'Markdown')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('markdown|filename||0')

    await wrapper.findAll('button').find(button => button.text() === 'HTML')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('html|filename||0')

    await wrapper.findAll('button').find(button => button.text() === 'Show titles')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('html|title||0')

    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Locate current file')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('all|title|/tmp/workspace/note.md|1')
  })

  it('Markdown 文件支持打开标题大纲栏', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') {
        return [
          {
            name: 'note.md',
            path: '/tmp/workspace/note.md',
            type: 'file',
            extension: '.md',
          },
        ]
      }

      if (command === 'read_file') {
        return '# Intro\n\n## Details'
      }

      if (command === 'calculate_file_hash') {
        return 'hash-note'
      }

      if (command === 'load_comments') {
        return []
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Show outline')!.trigger('click')

    expect(wrapper.get('[data-testid="document-outline"]').text()).toContain('# Intro')
    expect(wrapper.get('[data-testid="document-outline"]').text()).toContain('## Details')
  })

  it('选中文本后调用翻译命令并显示译文', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          {
            name: 'note.md',
            path: '/tmp/workspace/note.md',
            type: 'file',
            extension: '.md',
          },
        ]
      }

      if (command === 'read_file') {
        return '# Note'
      }

      if (command === 'calculate_file_hash') {
        return 'hash-note'
      }

      if (command === 'load_comments') {
        return []
      }

      if (command === 'translate_text') {
        expect(args).toEqual({
          service: 'ollama',
          text: 'Hello',
        })
        return {
          original: 'Hello',
          translated: '你好',
          sourceLang: 'en',
          targetLang: 'zh',
          service: 'ollama',
        }
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="translate-selection"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="translation-card"]').text()).toContain('你好')
    expect(wrapper.get('[data-testid="translation-card"]').text()).toContain('ollama')
  })

  it('将 OpenAI 兼容配置传给翻译命令且不持久化 API Key', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Note'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'translate_text') {
        expect(args).toEqual({
          service: 'openai-compatible',
          text: 'Hello',
          openaiConfig: {
            baseUrl: 'https://api.deepseek.com/v1',
            model: 'deepseek-chat',
            apiKey: 'test-api-key',
          },
        })
        return {
          original: 'Hello',
          translated: '你好',
          sourceLang: 'en',
          targetLang: 'zh',
          service: 'openai-compatible',
        }
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.get('[aria-label="Translation service"]').setValue('openai-compatible')
    await wrapper.get('input[placeholder="https://api.deepseek.com/v1"]').setValue('https://api.deepseek.com/v1')
    await wrapper.get('input[placeholder="deepseek-chat"]').setValue('deepseek-chat')
    await wrapper.get('input[placeholder="sk-..."]').setValue('test-api-key')
    await wrapper.get('[data-testid="translate-selection"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="translation-card"]').text()).toContain('openai-compatible')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.baseUrl')).toBe('https://api.deepseek.com/v1')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.model')).toBe('deepseek-chat')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.apiKey')).toBeNull()
  })

  it('保存、测试并拉取 OpenAI 兼容模型配置', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'test_openai_compatible_connection') {
        expect(args).toEqual({
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'test-api-key',
        })
        return { modelCount: 2 }
      }
      if (command === 'fetch_openai_compatible_models') {
        expect(args).toEqual({
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'test-api-key',
        })
        return ['deepseek-chat', 'deepseek-reasoner']
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    useWorkspaceStore(pinia).folderPath = '/tmp/workspace'
    await wrapper.vm.$nextTick()
    await wrapper.get('[aria-label="Configure OpenAI-compatible model"]').trigger('click')
    await wrapper.get('input[placeholder="https://api.deepseek.com/v1"]').setValue('https://api.deepseek.com/v1')
    await wrapper.get('input[placeholder="sk-..."]').setValue('test-api-key')

    await wrapper.findAll('button').find(button => button.text() === 'Test connection')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Connected. 2 models are available.')

    await wrapper.findAll('button').find(button => button.text() === 'Load models')!.trigger('click')
    await flushPromises()
    expect((wrapper.get('input[placeholder="deepseek-chat"]').element as HTMLInputElement).value)
      .toBe('deepseek-chat')
    expect(wrapper.findAll('#openai-compatible-models option').map(option => option.attributes('value')))
      .toEqual(['deepseek-chat', 'deepseek-reasoner'])

    await wrapper.findAll('button').find(button => button.text() === 'Save settings')!.trigger('click')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.baseUrl')).toBe('https://api.deepseek.com/v1')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.model')).toBe('deepseek-chat')
    expect(window.localStorage.getItem('md-html-reader.openai-compatible.apiKey')).toBeNull()
  })

  it('经授权后生成并在应用内打开 AI 苹果风阅读版', async () => {
    let generated = false
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return generated
          ? [
              { name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' },
              { name: 'note.reading.html', path: '/tmp/workspace/note.reading.html', type: 'file', extension: '.html' },
            ]
          : [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') {
        return args.path.endsWith('.reading.html') ? '<h1>AI Reading</h1>' : '# Note\n\nDocument body.'
      }
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'generate_ai_reading_html') {
        expect(args).toEqual({
          service: 'ollama',
          workspacePath: '/tmp/workspace',
          filePath: '/tmp/workspace/note.md',
          includeMarkdownSource: true,
        })
        generated = true
        return {
          outputPath: '/tmp/workspace/note.reading.html',
          summaryCharacters: 96,
        }
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.get('[aria-label="HTML export mode"]').setValue('ai-reading')
    await wrapper.get('[aria-label="Include source Markdown"]').setValue(true)
    await wrapper.findAll('button').find(button => button.text() === 'Create reading version')!.trigger('click')
    await flushPromises()

    expect(ask).toHaveBeenCalledWith(
      expect.stringContaining('current Markdown file'),
      { title: 'Allow AI reading version', kind: 'warning' },
    )
    expect(milkdownLifecycle.saveCurrentContentRequests).toBe(1)
    expect(useWorkspaceStore(pinia).currentFile?.path).toBe('/tmp/workspace/note.reading.html')
    expect(wrapper.text()).toContain('AI reading version created and opened (96 summary characters)')
  })

  it('文件夹选择失败时显示原因而不是静默失败', async () => {
    vi.mocked(open).mockRejectedValue(new Error('dialog permission denied'))

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Could not open folder: dialog permission denied')
  })

  it('解决评论失败时保留原状态并显示原因', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Note'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') {
        return [{
          id: 'comment-1',
          fileHash: 'hash-note',
          anchor: { quote: 'Note', offset: 2, length: 4 },
          content: 'Review note',
          status: 'open',
          createdAt: 1,
          updatedAt: 1,
        }]
      }
      if (command === 'update_comment') throw new Error('disk full')
      throw new Error(`Unexpected command: ${command}`)
    })

    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="resolve-comment"]').trigger('click')
    await flushPromises()

    expect(useCommentsStore(pinia).list[0]).toMatchObject({ status: 'open', updatedAt: 1 })
    expect(wrapper.text()).toContain('Could not resolve comment: disk full')
  })

  it('保存当前 Markdown 后生成并打开中文翻译副本', async () => {
    let translated = false
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return translated
          ? [
              { name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' },
              { name: 'note.zh.md', path: '/tmp/workspace/note.zh.md', type: 'file', extension: '.md' },
            ]
          : [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }

      if (command === 'read_file') {
        return args.path === '/tmp/workspace/note.zh.md' ? '# 你好' : '# Hello'
      }

      if (command === 'calculate_file_hash') {
        return args.filePath === '/tmp/workspace/note.zh.md' ? 'hash-zh' : 'hash-note'
      }

      if (command === 'load_comments') {
        return []
      }

      if (command === 'translate_markdown_to_chinese') {
        expect(args).toEqual({
          service: 'ollama',
          workspacePath: '/tmp/workspace',
          filePath: '/tmp/workspace/note.md',
        })
        translated = true
        return {
          outputPath: '/tmp/workspace/note.zh.md',
          translatedCharacters: 5,
          translatedSegments: 1,
        }
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: { plugins: [createPinia()] },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Translate to Chinese copy')!
      .trigger('click')
    await flushPromises()

    expect(milkdownLifecycle.saveCurrentContentRequests).toBe(1)
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# 你好')
    expect(wrapper.text()).toContain('Chinese translation copy created: note.zh.md')
  })

  it('全文翻译期间不允许文件或工作区导航覆盖结果', async () => {
    let translated = false
    let resolveTranslation!: (value: {
      outputPath: string
      translatedCharacters: number
      translatedSegments: number
    }) => void
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        const files = [
          { name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' },
          { name: 'other.md', path: '/tmp/workspace/other.md', type: 'file', extension: '.md' },
        ]
        return translated
          ? [...files, { name: 'note.zh.md', path: '/tmp/workspace/note.zh.md', type: 'file', extension: '.md' }]
          : files
      }
      if (command === 'read_file') {
        if (args.path === '/tmp/workspace/note.zh.md') return '# 你好'
        if (args.path === '/tmp/workspace/other.md') return '# Other'
        return '# Hello'
      }
      if (command === 'calculate_file_hash') return 'hash'
      if (command === 'load_comments') return []
      if (command === 'translate_markdown_to_chinese') {
        return new Promise(resolve => {
          resolveTranslation = resolve
        })
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    const fileButtons = wrapper.findAll('[data-testid="file-item"]')
    await fileButtons[0].trigger('click')
    await flushPromises()

    const translateButton = wrapper.findAll('button').find(button => button.text() === 'Translate to Chinese copy')!
    await translateButton.trigger('click')
    await flushPromises()

    expect((wrapper.findAll('button').find(button => button.text() === 'Open folder')!.element as HTMLButtonElement).disabled).toBe(true)
    await fileButtons[1].trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# Hello')
    expect(milkdownLifecycle.switchRequests).toBe(0)
    expect(open).toHaveBeenCalledTimes(1)

    translated = true
    resolveTranslation({
      outputPath: '/tmp/workspace/note.zh.md',
      translatedCharacters: 5,
      translatedSegments: 1,
    })
    await flushPromises()
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# 你好')
  })

  it('全文翻译失败时保留当前文件并显示错误', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }

      if (command === 'read_file') return '# Hello'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'translate_markdown_to_chinese') {
        throw new Error('中文翻译副本已存在，未覆盖原有文件')
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: { plugins: [createPinia()] },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Translate to Chinese copy')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# Hello')
    expect(wrapper.text()).toContain('中文翻译副本已存在，未覆盖原有文件')
  })

  it('经读取确认后只把当前 Markdown 和当前文件评论发送给模型以生成建议', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Current document'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') {
        return [
          {
            id: 'comment-1', fileHash: 'hash-note', anchor: { quote: 'Current document', offset: 2, length: 16 },
            content: '补充一个具体例子', status: 'open', createdAt: 1, updatedAt: 1,
          },
          {
            id: 'comment-2', fileHash: 'hash-note', anchor: { quote: 'Resolved comment', offset: 0, length: 8 },
            content: '已解决的评论不应发送', status: 'resolved', createdAt: 1, updatedAt: 1,
          },
        ]
      }
      if (command === 'suggest_document_improvements') {
        expect(args).toEqual({
          service: 'ollama',
          markdown: '# Current document',
          comments: [{
            anchor: { quote: 'Current document' },
            content: '补充一个具体例子',
            status: 'open',
          }],
        })
        expect(args).not.toHaveProperty('workspacePath')
        return { content: '- 在开头补充一个具体例子。' }
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Suggest from comments')!.trigger('click')
    await flushPromises()

    expect(ask).toHaveBeenCalledWith(
      expect.stringContaining('1 unresolved comments'),
      { title: 'Allow AI access', kind: 'warning' },
    )
    expect(wrapper.get('[data-testid="document-assistant-panel"]').text()).toContain('补充一个具体例子')
  })

  it('优化稿必须经二次写入确认，取消时保留原文', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Original'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'optimize_document_with_comments') return { content: '# Optimized' }
      if (command === 'write_file') throw new Error('write should not be called')
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Improve current document')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="assistant-apply"]').trigger('click')
    await flushPromises()

    expect(ask).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('write the AI draft to the current file'),
      { title: 'Confirm applying AI draft', kind: 'warning' },
    )
    expect(milkdownLifecycle.replacementRequests).toEqual([])
  })

  it('永久修改权只跳过二次确认，仍要求每次读取确认', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Original'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'optimize_document_with_comments') return { content: '# Optimized' }
      if (command === 'write_file') {
        expect(args).toEqual({
          workspacePath: '/tmp/workspace',
          path: '/tmp/workspace/note.md',
          content: '# Optimized',
        })
        return undefined
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === 'Improve current document')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="assistant-permanent-write"]').setValue(true)
    await wrapper.get('[data-testid="assistant-apply"]').trigger('click')
    await flushPromises()

    expect(ask).toHaveBeenCalledTimes(1)
    expect(milkdownLifecycle.replacementRequests).toEqual(['# Optimized'])
    const permissionKey = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .find(key => key?.startsWith('md-html-reader.assistant.permanent-write-permission.'))
    expect(permissionKey).toBeDefined()
    expect(JSON.parse(decodeURIComponent(permissionKey!.split('.permanent-write-permission.')[1]))).toEqual({
      workspacePath: '/tmp/workspace',
      filePath: '/tmp/workspace/note.md',
      service: 'ollama',
      model: 'ollama-default',
    })
  })

  it('永久修改权不会跨文件沿用', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          { name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' },
          { name: 'other.md', path: '/tmp/workspace/other.md', type: 'file', extension: '.md' },
        ]
      }
      if (command === 'read_file') return args.path.endsWith('other.md') ? '# Other' : '# Original'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') return []
      if (command === 'optimize_document_with_comments') {
        return { content: args.markdown === '# Other' ? '# Other optimized' : '# Original optimized' }
      }
      if (command === 'write_file') return undefined
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()

    const fileButtons = wrapper.findAll('[data-testid="file-item"]')
    await fileButtons[0].trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Improve current document')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="assistant-permanent-write"]').setValue(true)
    await wrapper.get('[data-testid="assistant-apply"]').trigger('click')
    await flushPromises()

    await fileButtons[1].trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Improve current document')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="document-assistant-panel"]').text()).toContain('false')
    await wrapper.get('[data-testid="assistant-apply"]').trigger('click')
    await flushPromises()

    expect(ask).toHaveBeenCalledTimes(3)
  })

  it('AI 输入超限时显示后端返回的具体原因', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(ask).mockResolvedValue(true)
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'list_files') {
        return [{ name: 'note.md', path: '/tmp/workspace/note.md', type: 'file', extension: '.md' }]
      }
      if (command === 'read_file') return '# Current document'
      if (command === 'calculate_file_hash') return 'hash-note'
      if (command === 'load_comments') {
        return [{
          id: 'comment-1', fileHash: 'hash-note', anchor: { quote: 'Current document', offset: 2, length: 16 },
          content: '需要处理', status: 'open', createdAt: 1, updatedAt: 1,
        }]
      }
      if (command === 'suggest_document_improvements') {
        throw new Error('当前文件的未解决评论总长度不能超过 10000 字符')
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Suggest from comments')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('当前文件的未解决评论总长度不能超过 10000 字符')
  })

  it('HTML 文件使用独立预览组件并禁用全文翻译', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/workspace')
    vi.mocked(invoke).mockImplementation(async (command: string, args?: any) => {
      if (command === 'list_files') {
        return [
          {
            name: 'page.html',
            path: '/tmp/workspace/page.html',
            type: 'file',
            extension: '.html',
          },
        ]
      }

      if (command === 'read_file') {
        return '<h1>Page</h1>'
      }

      if (command === 'calculate_file_hash') {
        return 'hash-page'
      }

      if (command === 'load_comments') {
        return []
      }

      throw new Error(`Unexpected command: ${command}`)
    })

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Open folder')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="html-renderer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="rendered-html"]').text()).toContain('Page')
    expect(
      wrapper.findAll('button').find(button => button.text() === 'Translate to Chinese copy')!
        .attributes('disabled')
    ).toBeDefined()

  })
})
