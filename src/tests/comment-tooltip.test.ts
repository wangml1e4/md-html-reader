import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CommentTooltip from '../components/CommentTooltip.vue'
import type { Selection } from '../utils/selection'

describe('CommentTooltip', () => {
  it('提交时使用打开对话框时的选区快照', async () => {
    const selection: Selection = {
      text: 'Comment target phrase',
      start: 5,
      end: 26,
      rect: new DOMRect(10, 20, 100, 20),
    }

    const wrapper = mount(CommentTooltip, {
      props: {
        show: true,
        selection,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.find('button').trigger('click')
    await wrapper.setProps({ selection: null })
    await wrapper.find('textarea').setValue('Manual acceptance comment')
    await wrapper.findAll('button').find(button => button.text() === '提交')!.trigger('click')

    expect(wrapper.emitted('addComment')).toEqual([
      ['Manual acceptance comment', selection],
    ])
  })

  it('点击翻译时发出当前选区', async () => {
    const selection: Selection = {
      text: 'Translate me',
      start: 0,
      end: 12,
      rect: new DOMRect(10, 20, 100, 20),
    }

    const wrapper = mount(CommentTooltip, {
      props: {
        show: true,
        selection,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.findAll('button').find(button => button.text() === '翻译')!.trigger('click')

    expect(wrapper.emitted('translate')).toEqual([[selection]])
  })
})
