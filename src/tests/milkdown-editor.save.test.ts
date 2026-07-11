import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MilkdownEditor from '../components/MilkdownEditor.vue'

vi.mock('@milkdown/core', () => ({
  Editor: {
    make: () => ({
      config(callback: any) {
        callback({
          set: () => {},
          get: () => ({
            markdownUpdated: () => {},
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

})
