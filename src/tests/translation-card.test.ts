import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationCard from '../components/TranslationCard.vue'

describe('TranslationCard', () => {
  it('显示翻译结果并支持复制译文', async () => {
    const writeText = vi.fn()
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    const wrapper = mount(TranslationCard, {
      props: {
        state: 'success',
        original: 'Hello',
        translated: '你好',
        service: 'ollama',
        error: null,
      },
    })

    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.text()).toContain('你好')
    expect(wrapper.text()).toContain('Ollama')

    await wrapper.findAll('button').find(button => button.text() === '复制译文')!.trigger('click')

    expect(writeText).toHaveBeenCalledWith('你好')
  })

  it('显示 loading 和错误状态', async () => {
    const wrapper = mount(TranslationCard, {
      props: {
        state: 'loading',
        original: 'Hello',
        translated: '',
        service: 'tencent',
        error: null,
      },
    })

    expect(wrapper.text()).toContain('翻译中')

    await wrapper.setProps({
      state: 'error',
      error: '腾讯翻译未配置密钥',
    })

    expect(wrapper.text()).toContain('腾讯翻译未配置密钥')
  })
})
