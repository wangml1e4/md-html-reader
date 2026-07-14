import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from '../stores/workspace'
import { useCommentsStore } from '../stores/comments'

const milkdownLifecycle = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
  switchRequests: 0,
  saveCurrentContentRequests: 0,
  saveCurrentContentError: null as Error | null,
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
    setup(_props: unknown, { expose }: { expose: (value: unknown) => void }) {
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
    props: ['file', 'openHtmlPreview'],
    template: `
      <div data-testid="html-renderer">
        <div data-testid="rendered-html" v-html="file.content" />
        <button data-testid="preview-html" @click="openHtmlPreview()">
          浏览器预览
        </button>
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
          {{ comment.content }}
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

describe('App core user flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    milkdownLifecycle.mountCount = 0
    milkdownLifecycle.unmountCount = 0
    milkdownLifecycle.switchRequests = 0
    milkdownLifecycle.saveCurrentContentRequests = 0
    milkdownLifecycle.saveCurrentContentError = null
    milkdownLifecycle.allowSwitch = true
    milkdownLifecycle.actions = []
    windowLifecycle.closeHandler = null
    windowLifecycle.unlisten.mockReset()
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
        expect(args).toEqual({
          workspacePath: '/tmp/workspace',
          path: '/tmp/workspace/note.md',
        })
        return fileContent
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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

    await wrapper.findAll('button').find(button => button.text() === '搜索内容')!.trigger('click')
    await wrapper.get('[data-testid="search-open"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('Edited keyword')

    await wrapper.findAll('button').find(button => button.text() === '导出 HTML')!.trigger('click')
    await flushPromises()
    expect(save).toHaveBeenCalledWith({
      defaultPath: '/tmp/workspace/note.html',
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    expect(wrapper.text()).toContain('HTML 已导出')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    expect(workspace.folderPath).toBe('/tmp/workspace')
    expect(workspace.currentFile?.path).toBe('/tmp/workspace/note.md')
    expect(comments.list).toHaveLength(1)

    milkdownLifecycle.allowSwitch = true
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('all|filename||0')

    await wrapper.findAll('button').find(button => button.text() === '只看 Markdown')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('markdown|filename||0')

    await wrapper.findAll('button').find(button => button.text() === '只看 HTML')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('html|filename||0')

    await wrapper.findAll('button').find(button => button.text() === '显示标题')!.trigger('click')
    expect(wrapper.get('[data-testid="tree-state"]').text()).toContain('html|title||0')

    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '定位当前文件')!.trigger('click')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text() === '打开标题大纲')!.trigger('click')

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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="translate-selection"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="translation-card"]').text()).toContain('你好')
    expect(wrapper.get('[data-testid="translation-card"]').text()).toContain('ollama')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find(button => button.text() === '一键翻译为中文副本')!
      .trigger('click')
    await flushPromises()

    expect(milkdownLifecycle.saveCurrentContentRequests).toBe(1)
    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# 你好')
    expect(wrapper.text()).toContain('已生成中文翻译副本：note.zh.md')
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
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()

    const fileButtons = wrapper.findAll('[data-testid="file-item"]')
    await fileButtons[0].trigger('click')
    await flushPromises()

    const translateButton = wrapper.findAll('button').find(button => button.text() === '一键翻译为中文副本')!
    await translateButton.trigger('click')
    await flushPromises()

    expect((wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.element as HTMLButtonElement).disabled).toBe(true)
    await fileButtons[1].trigger('click')
    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find(button => button.text() === '一键翻译为中文副本')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-content"]').text()).toContain('# Hello')
    expect(wrapper.text()).toContain('中文翻译副本已存在，未覆盖原有文件')
  })

  it('HTML 文件可调用默认浏览器预览命令', async () => {
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

      if (command === 'open_html_in_default_browser') {
        expect(args).toEqual({
          workspacePath: '/tmp/workspace',
          filePath: '/tmp/workspace/page.html',
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

    await wrapper.findAll('button').find(button => button.text() === '打开文件夹')!.trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="file-item"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="html-renderer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="rendered-html"]').text()).toContain('Page')
    expect(
      wrapper.findAll('button').find(button => button.text() === '一键翻译为中文副本')!
        .attributes('disabled')
    ).toBeDefined()

    await wrapper.get('[data-testid="preview-html"]').trigger('click')
    await flushPromises()

    expect(invoke).toHaveBeenCalledWith('open_html_in_default_browser', {
      workspacePath: '/tmp/workspace',
      filePath: '/tmp/workspace/page.html',
    })
  })
})
