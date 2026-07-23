import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import YamlEditor from '../components/YamlEditor.vue'

describe('YamlEditor', () => {
  it('编辑并保存原始 YAML 内容', async () => {
    const saveContent = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(YamlEditor, {
      props: {
        file: {
          path: '/tmp/workspace/config.yaml',
          content: 'services:\n  api:\n    enabled: true',
        },
        saveContent,
      },
    })

    const editor = wrapper.get('textarea[aria-label="YAML editor"]')
    expect((editor.element as HTMLTextAreaElement).value).toContain('enabled: true')

    await editor.setValue('services:\n  api:\n    enabled: false')
    await wrapper.findAll('button').find(button => button.text() === 'Save (⌘S)')!.trigger('click')

    expect(saveContent).toHaveBeenCalledWith('services:\n  api:\n    enabled: false')
  })
})
