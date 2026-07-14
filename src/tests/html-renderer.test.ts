import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { convertFileSrc } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { readFileSync } from 'node:fs'
import HtmlRenderer from '../components/HtmlRenderer.vue'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn(),
}))

const mockWebviewWindow = WebviewWindow as unknown as {
  mockImplementation: (implementation: (...args: any[]) => any) => void
}

function mockCreatedPreviewWindow() {
  mockWebviewWindow.mockImplementation(() => ({
    once: (event: string, callback: (event: { payload: string }) => void) => {
      if (event === 'tauri://created') callback({ payload: '' })
    },
  }))
}

describe('HtmlRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatedPreviewWindow()
  })

  it('生产与 E2E 配置都依赖运行时工作区 asset scope', () => {
    const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    const e2eConfig = JSON.parse(readFileSync('src-tauri/tauri.e2e.conf.json', 'utf8'))

    expect(tauriConfig.app.security.assetProtocol).toEqual({
      enable: true,
      scope: [],
    })
    expect(e2eConfig.app.security.assetProtocol).toEqual({
      enable: true,
      scope: [],
    })
  })

  it('仅主窗口拥有应用命令权限，完整预览窗口不匹配该能力', () => {
    const capability = JSON.parse(readFileSync('src-tauri/capabilities/main.json', 'utf8'))

    expect(capability.windows).toEqual(['main'])
    expect(capability.permissions).toContain('allow-list-files')
    expect(capability.permissions).toContain('allow-translate-markdown-to-chinese')
    expect(capability.windows).not.toContain('html-preview-*')
  })

  it('完整预览以原始 asset URL 打开独立窗口，不改写作者的 base', async () => {
    const content = '<html><head><base href="https://example.com/app/"></head><body><h1>Rendered Page</h1></body></html>'
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: {
          path: '/tmp/workspace/page.html',
          content,
        },
      },
    })

    expect(wrapper.find('iframe').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(convertFileSrc).toHaveBeenCalledWith('/tmp/workspace/page.html', 'preview')
    expect(WebviewWindow).toHaveBeenCalledWith(
      expect.stringMatching(/^html-preview-\d+-0$/),
      expect.objectContaining({
        url: 'preview://localhost/tmp/workspace/page.html',
        title: 'HTML 预览：page.html',
      })
    )
    expect(wrapper.text()).not.toContain('完整预览打开失败')
  })

  it('安全静态预览保留原文但禁用脚本和同源权限', async () => {
    const content = '<html><head><base href="https://example.com/app/"></head><body><script>window.ready = true</script><h1>Static Page</h1></body></html>'
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.htm', content },
      },
    })

    await wrapper.get('button:nth-of-type(2)').trigger('click')

    const iframe = wrapper.get('iframe[title="HTML 安全静态预览"]')
    expect(iframe.attributes('sandbox')).toBe('')
    expect(iframe.attributes('srcdoc')).toBe(content)
    expect(iframe.attributes('sandbox')).not.toContain('allow-scripts')
    expect(iframe.attributes('sandbox')).not.toContain('allow-same-origin')
  })

  it('完整预览窗口创建失败时显示错误', async () => {
    mockWebviewWindow.mockImplementation(() => ({
      once: (event: string, callback: (event: { payload: string }) => void) => {
        if (event === 'tauri://error') callback({ payload: 'asset scope denied' })
      },
    }))
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.xhtml', content: '<h1>Page</h1>' },
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('asset scope denied')
  })

  it('安全静态 iframe 报错时给出可见提示', async () => {
    const wrapper = mount(HtmlRenderer, {
      props: {
        file: { path: '/tmp/workspace/page.html', content: '<h1>Page</h1>' },
      },
    })

    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await wrapper.get('iframe').trigger('error')

    expect(wrapper.get('[role="alert"]').text()).toContain('安全静态预览加载失败')
  })
})
