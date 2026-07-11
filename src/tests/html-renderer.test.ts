import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { convertFileSrc } from '@tauri-apps/api/core'
import HtmlRenderer from '../components/HtmlRenderer.vue'

describe('HtmlRenderer', () => {
  it('通过 Tauri asset URL 直接加载 HTML 文件', () => {
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.html', content: '<h1>Rendered Page</h1>' },
        openHtmlPreview: vi.fn(),
      },
    })

    const iframe = wrapper.get('iframe')

    expect(convertFileSrc).toHaveBeenCalledWith('/tmp/workspace/page.html')
    expect(iframe.attributes('src')).toBe('asset://localhost/%2Ftmp%2Fworkspace%2Fpage.html')
    expect(iframe.attributes('srcdoc')).toBeUndefined()
    expect(wrapper.text()).toContain('page.html')
  })

  it('完整预览模式允许脚本、同源相对资源和常见页面能力', () => {
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.html', content: '<script>window.ready = true</script>' },
        openHtmlPreview: vi.fn(),
      },
    })

    const sandbox = wrapper.get('iframe').attributes('sandbox')

    expect(sandbox).toContain('allow-scripts')
    expect(sandbox).toContain('allow-same-origin')
    expect(sandbox).toContain('allow-forms')
    expect(sandbox).toContain('allow-popups')
    expect(sandbox).toContain('allow-downloads')
  })

  it('可以调用本地默认浏览器预览', async () => {
    const openHtmlPreview = vi.fn()
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.html', content: '<h1>Rendered Page</h1>' },
        openHtmlPreview,
      },
    })

    await wrapper.get('button').trigger('click')

    expect(openHtmlPreview).toHaveBeenCalledTimes(1)
  })
})
