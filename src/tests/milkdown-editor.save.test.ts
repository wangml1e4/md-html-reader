import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MilkdownEditor from '../components/MilkdownEditor.vue'

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

  it('存在未保存内容时由编辑器决定是否允许父级切换文件', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(MilkdownEditor, {
      props: {
        file: { path: '/tmp/note.md', content: '# Note' },
        saveContent: vi.fn().mockResolvedValue(undefined),
      },
    })
    await flushPromises()

    editorHarness.markdownUpdated?.({}, '# Edited')

    expect((wrapper.vm as any).requestFileSwitch()).toBe(false)
    expect(confirmSpy).toHaveBeenCalledWith(
      '当前文件有未保存的更改，切换文件会丢失这些更改。是否继续？'
    )

    confirmSpy.mockReturnValue(true)
    expect((wrapper.vm as any).requestFileSwitch()).toBe(true)
    wrapper.unmount()
  })

})
