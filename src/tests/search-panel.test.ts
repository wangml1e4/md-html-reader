import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SearchPanel from '../components/SearchPanel.vue'
import { invoke } from '@tauri-apps/api/core'

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('文件名搜索调用 search_files 并能打开结果', async () => {
    vi.mocked(invoke).mockResolvedValue([
      { path: '/tmp/workspace/note.md', name: 'note.md', directory: 'workspace' },
    ])

    const wrapper = mount(SearchPanel, {
      props: {
        show: true,
        mode: 'files',
        workspacePath: '/tmp/workspace',
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    await wrapper.get('input').setValue('note')
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(invoke).toHaveBeenCalledWith('search_files', {
      workspacePath: '/tmp/workspace',
      query: 'note',
    })

    expect(wrapper.html()).toContain('<mark')
    expect(wrapper.html()).toContain('note')

    await wrapper.get('[class*="cursor-pointer"]').trigger('click')
    expect(wrapper.emitted('openFile')?.[0]).toEqual(['/tmp/workspace/note.md', undefined])
  })

  it('内容搜索调用 search_content 并能打开命中行所在文件', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        file_path: '/tmp/workspace/note.md',
        file_name: 'note.md',
        line_number: 2,
        line_content: 'hello keyword',
        match_start: 6,
        match_end: 13,
      },
    ])

    const wrapper = mount(SearchPanel, {
      props: {
        show: true,
        mode: 'content',
        workspacePath: '/tmp/workspace',
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    await wrapper.get('input').setValue('keyword')
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(invoke).toHaveBeenCalledWith('search_content', {
      workspacePath: '/tmp/workspace',
      query: 'keyword',
      maxResults: 50,
    })

    expect(wrapper.html()).toContain('<mark')
    expect(wrapper.html()).toContain('keyword')

    await wrapper.get('[class*="cursor-pointer"]').trigger('click')
    expect(wrapper.emitted('openFile')?.[0]).toEqual(['/tmp/workspace/note.md', 2])
  })
})
