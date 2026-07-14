import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FileTree from '../components/FileTree.vue'
import type { FileItem } from '../stores/workspace'

const files: FileItem[] = [
  {
    name: 'docs',
    path: '/tmp/workspace/docs',
    type: 'directory',
    children: [
      {
        name: 'note.md',
        path: '/tmp/workspace/docs/note.md',
        type: 'file',
        extension: '.md',
        title: 'Markdown Title',
      },
      {
        name: 'page.html',
        path: '/tmp/workspace/docs/page.html',
        type: 'file',
        extension: '.html',
        title: 'HTML Title',
      },
    ],
  },
]

describe('FileTree', () => {
  it('按文件类型筛选显示文件', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files,
        filter: 'markdown',
        displayMode: 'filename',
        currentPath: null,
        locateToken: 0,
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('note.md')
    expect(wrapper.text()).not.toContain('page.html')

    await wrapper.setProps({ filter: 'html' })
    expect(wrapper.text()).not.toContain('note.md')
    expect(wrapper.text()).toContain('page.html')
  })

  it('显示标题时使用标题并保留文件名兜底', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files,
        filter: 'all',
        displayMode: 'title',
        currentPath: null,
        locateToken: 0,
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Markdown Title')
    expect(wrapper.text()).toContain('HTML Title')
    expect(wrapper.text()).not.toContain('note.md')
  })

  it('定位当前文件时展开目录并高亮当前文件', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files,
        filter: 'all',
        displayMode: 'filename',
        currentPath: '/tmp/workspace/docs/note.md',
        locateToken: 1,
      },
    })

    expect(wrapper.text()).toContain('note.md')
    expect(wrapper.get('[data-file-path="/tmp/workspace/docs/note.md"]').classes()).toContain('bg-blue-100')
  })

  it('禁用时不触发文件选择', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: [files[0].children![0]],
        disabled: true,
      },
    })

    const button = wrapper.get('[data-file-path="/tmp/workspace/docs/note.md"]')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    await button.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
