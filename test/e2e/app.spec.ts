import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const workspacePath = '/tmp/markdown-html-e2e-workspace'
const notePath = join(workspacePath, 'note.md')
const secondNotePath = join(workspacePath, 'second.md')
const exportPath = join(workspacePath, 'note.html')

function buttonWithText(text: string) {
  return $(`//button[normalize-space(.)="${text}"]`)
}

function buttonContaining(text: string) {
  return $(`//button[contains(normalize-space(.), "${text}")]`)
}

async function waitForBodyText(text: string) {
  await browser.waitUntil(
    async () => (await $('body').getText()).includes(text),
    { timeoutMsg: `Expected body text to include: ${text}` }
  )
}

async function setEditorContent(text: string, expectedText = 'Edited keyword') {
  const updated = await browser.execute((content) => {
    const helpers = (window as any).__markdownHtmlE2E
    if (!helpers) return false
    helpers.setEditorContent(content)
    return true
  }, text)

  expect(updated).toBe(true)
  await waitForBodyText(expectedText)
}

async function selectEditorText(text: string) {
  const selected = await browser.execute((target) => {
    const root = document.querySelector('.milkdown-container')
    if (!root) return false

    const editor = root.querySelector<HTMLElement>('.ProseMirror, [contenteditable="true"]')
    editor?.focus()

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const index = node.textContent?.indexOf(target) ?? -1
      if (index >= 0) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + target.length)

        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        return true
      }
    }

    return false
  }, text)

  expect(selected).toBe(true)
  await waitForBodyText('添加评论')
}

async function openE2EWorkspaceAndNote() {
  await buttonWithText('打开文件夹').click()
  await waitForBodyText('note.md')

  await buttonContaining('note.md').click()
  await waitForBodyText('Original keyword')
}

describe('MD+HTML Reader Tauri window', () => {
  beforeEach(() => {
    rmSync(workspacePath, { recursive: true, force: true })
    mkdirSync(workspacePath, { recursive: true })
    writeFileSync(
      notePath,
      '# Manual E2E Note\n\nOriginal keyword for validation.\n\nSecond paragraph for comment target.\n'
    )
    writeFileSync(secondNotePath, '# Second Note\n\nSecond file content.\n')
  })

  it('loads the real Tauri webview and exposes the WDIO Tauri bridge', async () => {
    await browser.pause(500)

    await expect($('h1')).toHaveText('Markdown HTML Editor')

    const hasBridge = await browser.execute(() => 'wdioTauri' in window)
    expect(hasBridge).toBe(true)

    const hasTauri = await browser.execute(() => '__TAURI__' in window)
    expect(hasTauri).toBe(true)
  })

  it('validates the core file, edit, comment, search, and export flow', async () => {
    await openE2EWorkspaceAndNote()

    await setEditorContent('# Manual E2E Note\n\nEdited keyword for validation.\n\nSecond paragraph for comment target.')
    await buttonContaining('保存').click()
    await waitForBodyText('刚刚保存')
    expect(readFileSync(notePath, 'utf8')).toContain('Edited keyword')

    await selectEditorText('Second paragraph')
    await buttonContaining('添加评论').click()
    await $('textarea[placeholder="输入评论内容..."]').setValue('Review note')
    await buttonWithText('提交').click()
    await waitForBodyText('Review note')
    expect(existsSync(join(workspacePath, '.comments'))).toBe(true)

    await browser.refresh()
    await waitForBodyText('Markdown HTML Editor')
    await buttonWithText('打开文件夹').click()
    await waitForBodyText('note.md')
    await buttonContaining('note.md').click()
    await waitForBodyText('Review note')

    await buttonWithText('搜索文件').click()
    await $('input[placeholder="搜索文件名... (输入文件名)"]').setValue('note')
    await waitForBodyText('markdown-html-e2e-workspace')
    await browser.keys('Escape')

    await buttonWithText('搜索内容').click()
    const directContentResults = await browser.execute(async (rootPath) => {
      return await (window as any).__TAURI__.core.invoke('search_content', {
        workspacePath: rootPath,
        query: 'Edited',
        maxResults: 50,
      })
    }, workspacePath)
    expect(directContentResults).toHaveLength(1)

    await $('input[placeholder="搜索文件内容... (输入关键词)"]').setValue('Edited')
    await waitForBodyText('第 3 行')
    await buttonContaining('note.md').click()

    await buttonWithText('导出 HTML').click()
    await waitForBodyText('HTML 已导出')
    expect(readFileSync(exportPath, 'utf8')).toContain('Edited keyword')
  })

  it('protects unsaved content during file and workspace switches', async () => {
    await buttonWithText('打开文件夹').click()
    await waitForBodyText('second.md')
    await buttonContaining('second.md').click()
    await waitForBodyText('Second file content')
    await buttonContaining('note.md').click()
    await waitForBodyText('Original keyword')
    await setEditorContent('# Unsaved draft\n\nDo not discard.', 'Unsaved draft')

    await browser.execute(() => {
      ;(window as any).__confirmMessages = []
      window.confirm = (message?: string) => {
        ;(window as any).__confirmMessages.push(message ?? '')
        return false
      }
    })
    await buttonContaining('second.md').click()
    const confirmMessages = await browser.execute(() => (window as any).__confirmMessages)

    expect(confirmMessages).toHaveLength(1)
    expect(confirmMessages[0]).toContain('当前文件有未保存的更改')
    await waitForBodyText('Unsaved draft')
    expect(await $('body').getText()).not.toContain('Second file content')
    expect(readFileSync(notePath, 'utf8')).toContain('Original keyword')

    await buttonWithText('打开文件夹').click()
    const workspaceCancelMessages = await browser.execute(() => (window as any).__confirmMessages)
    expect(workspaceCancelMessages).toHaveLength(2)
    expect(workspaceCancelMessages[1]).toContain('切换工作区会丢失这些更改')
    await waitForBodyText('Unsaved draft')

    await browser.execute(() => {
      window.confirm = () => true
    })
    await buttonWithText('打开文件夹').click()
    await waitForBodyText('点击"打开文件夹"开始编辑')
    expect(await $('body').getText()).not.toContain('Unsaved draft')
    expect(readFileSync(notePath, 'utf8')).toContain('Original keyword')
  })
})
