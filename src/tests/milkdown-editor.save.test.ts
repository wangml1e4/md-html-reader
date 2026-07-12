import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MilkdownEditor from '../components/MilkdownEditor.vue'
import { ask } from '@tauri-apps/plugin-dialog'

const editorHarness = vi.hoisted(() => ({
  markdownUpdated: null as null | ((ctx: unknown, markdown: string) => void),
}))

vi.mock('@milkdown/core', () => ({
  Editor: {
    make: () => ({
      config(callback: any) {
        callback({
          set: () => {},
          get: () => ({
            markdownUpdated: (callback: (ctx: unknown, markdown: string) => void) => {
              editorHarness.markdownUpdated = callback
            },
          }),
        })
        return this
      },
      use() {
        return this
      },
      create: async () => ({
        destroy: () => {},
        action: async (callback: any) => callback({ set: () => {} }),
      }),
    }),
  },
  rootCtx: Symbol('rootCtx'),
  defaultValueCtx: Symbol('defaultValueCtx'),
}))

vi.mock('@milkdown/preset-commonmark', () => ({ commonmark: {} }))
vi.mock('@milkdown/preset-gfm', () => ({ gfm: {} }))
vi.mock('@milkdown/plugin-history', () => ({ history: {} }))
vi.mock('@milkdown/plugin-listener', () => ({
  listener: {},
  listenerCtx: Symbol('listenerCtx'),
}))
vi.mock('@milkdown/plugin-prism', () => ({ prism: {} }))

describe('MilkdownEditor save state', () => {
  afterEach(() => {
    editorHarness.markdownUpdated = null
    vi.restoreAllMocks()
  })

  it('只在父级保存完成后显示已保存', async () => {
    let resolveSave!: () => void
    const saveContent = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))

    const wrapper = mount(MilkdownEditor, {
      props: {
        file: { path: '/tmp/note.md', content: '# Note' },
        saveContent,
      },
    })
    await flushPromises()

    await wrapper.find('button').trigger('click')

    expect(saveContent).toHaveBeenCalledWith('# Note')
    expect(wrapper.text()).toContain('保存中')
    expect(wrapper.text()).not.toContain('刚刚保存')

    resolveSave()
    await flushPromises()

    expect(wrapper.text()).toContain('刚刚保存')
    wrapper.unmount()
  })

  it('父级保存失败时不显示已保存', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveContent = vi.fn().mockRejectedValue(new Error('write failed'))

    const wrapper = mount(MilkdownEditor, {
      props: {
        file: { path: '/tmp/note.md', content: '# Note' },
        saveContent,
      },
    })
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('保存失败')
    expect(wrapper.text()).not.toContain('刚刚保存')

    wrapper.unmount()
    errorSpy.mockRestore()
  })

  it('存在未保存内容时根据操作类型确认是否放弃', async () => {
    vi.mocked(ask).mockResolvedValue(false)
    const wrapper = mount(MilkdownEditor, {
      props: {
        file: { path: '/tmp/note.md', content: '# Note' },
        saveContent: vi.fn().mockResolvedValue(undefined),
      },
    })
    await flushPromises()

    editorHarness.markdownUpdated?.({}, '# Edited')

    await expect((wrapper.vm as any).requestDiscardChanges('switch-file')).resolves.toBe(false)
    await expect((wrapper.vm as any).requestDiscardChanges('switch-workspace')).resolves.toBe(false)
    await expect((wrapper.vm as any).requestDiscardChanges('close-window')).resolves.toBe(false)
    expect(vi.mocked(ask).mock.calls.map(call => call[0])).toEqual([
      '当前文件有未保存的更改，切换文件会丢失这些更改。是否继续？',
      '当前文件有未保存的更改，切换工作区会丢失这些更改。是否继续？',
      '当前文件有未保存的更改，关闭应用会丢失这些更改。是否继续？',
    ])
    expect(ask).toHaveBeenLastCalledWith(
      '当前文件有未保存的更改，关闭应用会丢失这些更改。是否继续？',
      { title: '未保存的更改', kind: 'warning' }
    )

    vi.mocked(ask).mockResolvedValue(true)
    await expect((wrapper.vm as any).requestDiscardChanges('switch-file')).resolves.toBe(true)
    wrapper.unmount()
  })

  it('导航确认应等待正在进行的保存完成', async () => {
    const file = { path: '/tmp/note.md', content: '# Note' }
    let resolveSave!: () => void
    const saveContent = vi.fn((content: string) => new Promise<void>((resolve) => {
      resolveSave = () => {
        file.content = content
        resolve()
      }
    }))
    const askMock = vi.mocked(ask)
    const wrapper = mount(MilkdownEditor, {
      props: { file, saveContent },
    })
    await flushPromises()

    editorHarness.markdownUpdated?.({}, '# Edited')
    await wrapper.find('button').trigger('click')
    const navigationPromise = (wrapper.vm as any).requestDiscardChanges('switch-file')

    expect(askMock).not.toHaveBeenCalled()
    resolveSave()
    await expect(navigationPromise).resolves.toBe(true)
    expect(askMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('确认框打开期间暂停自动保存，取消操作后恢复', async () => {
    vi.useFakeTimers()
    let resolveAsk!: (value: boolean) => void
    vi.mocked(ask).mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveAsk = resolve
    }))
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(MilkdownEditor, {
      props: {
        file: { path: '/tmp/note.md', content: '# Note' },
        saveContent,
      },
    })
    await flushPromises()

    editorHarness.markdownUpdated?.({}, '# Edited')
    const navigationPromise = (wrapper.vm as any).requestDiscardChanges('switch-file')
    await vi.advanceTimersByTimeAsync(3000)
    expect(saveContent).not.toHaveBeenCalled()

    resolveAsk(false)
    await expect(navigationPromise).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saveContent).toHaveBeenCalledWith('# Edited')
    wrapper.unmount()
  })

})
