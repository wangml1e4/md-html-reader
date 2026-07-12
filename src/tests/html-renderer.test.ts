import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { convertFileSrc } from '@tauri-apps/api/core'
import { readFileSync } from 'node:fs'
import HtmlRenderer from '../components/HtmlRenderer.vue'

describe('HtmlRenderer', () => {
  it('启用 Tauri asset protocol 以加载用户选择的本地 HTML', () => {
    const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    const e2eConfig = JSON.parse(readFileSync('src-tauri/tauri.e2e.conf.json', 'utf8'))

    expect(tauriConfig.app.security.assetProtocol).toEqual({
      enable: true,
      scope: [],
    })
    expect(e2eConfig.app.security.assetProtocol).toEqual({
      enable: true,
      scope: [
        '/tmp/markdown-html-e2e-workspace/**/*',
        '/private/tmp/markdown-html-e2e-workspace/**/*',
      ],
    })
  })

  it('通过目录级 Tauri asset URL 为 HTML 注入相对资源基址', () => {
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: {
          path: '/tmp/workspace/page.html',
          content: '<html><head><title>Page</title></head><body><h1>Rendered Page</h1></body></html>',
        },
        openHtmlPreview: vi.fn(),
      },
    })

    const iframe = wrapper.get('iframe')

    expect(convertFileSrc).toHaveBeenCalledWith('/tmp/workspace')
    expect(iframe.attributes('src')).toBeUndefined()
    expect(iframe.attributes('srcdoc')).toContain(
      '<base href="asset://localhost/%2Ftmp%2Fworkspace/">'
    )
    expect(iframe.attributes('srcdoc')).toContain('<h1>Rendered Page</h1>')
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
