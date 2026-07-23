import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentOutline from '../components/DocumentOutline.vue'

describe('DocumentOutline', () => {
  it('解析 Markdown H1-H6 并点击发出标题选择', async () => {
    const wrapper = mount(DocumentOutline, {
      props: {
        content: '# Intro\n\nText\n\n## Details\n\n### Deep Dive',
      },
    })

    expect(wrapper.text()).toContain('Intro')
    expect(wrapper.text()).toContain('Details')
    expect(wrapper.text()).toContain('Deep Dive')

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('select')![0][0]).toMatchObject({
      level: 2,
      text: 'Details',
      line: 5,
    })
  })

  it('shows an English empty state when the document has no headings', () => {
    const wrapper = mount(DocumentOutline, {
      props: {
        content: 'plain text',
      },
    })

    expect(wrapper.text()).toContain('This document has no headings')
  })
})
