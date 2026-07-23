import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const workspacePath = '/tmp/markdown-html-e2e-workspace'
const notePath = join(workspacePath, 'note.md')
const secondNotePath = join(workspacePath, 'second.md')
const previewPath = join(workspacePath, 'preview.html')
const previewAssetsPath = join(workspacePath, 'assets')
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
  await waitForBodyText('Add comment')
}

async function openE2EWorkspaceAndNote() {
  await buttonWithText('Open folder').click()
  await waitForBodyText('note.md')

  await buttonContaining('note.md').click()
  await waitForBodyText('Original keyword')
}

async function openDocumentTools() {
  await $('//summary[normalize-space(.)="Document tools"]').click()
}

async function waitForPreviewWindow(mainWindow: string) {
  await browser.waitUntil(async () => {
    const windowHandles = await browser.getWindowHandles()
    return windowHandles.some(handle => handle !== mainWindow)
  }, { timeoutMsg: 'Expected the complete HTML preview window to open' })

  return (await browser.getWindowHandles()).find(handle => handle !== mainWindow)!
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
    writeFileSync(
      previewPath,
      '<!doctype html><html><head><base href="./assets/"><link rel="stylesheet" href="preview.css"></head><body><main id="preview-status">Waiting</main><img id="preview-image" src="preview.svg" alt="preview asset"><script type="module" src="preview.js"></script></body></html>'
    )
    mkdirSync(previewAssetsPath, { recursive: true })
    writeFileSync(join(previewAssetsPath, 'preview.css'), '#preview-status { color: rgb(12, 34, 56); }')
    writeFileSync(
      join(previewAssetsPath, 'preview.js'),
      "const status = document.querySelector('#preview-status'); status.textContent = 'Rendered inside app'; document.documentElement.dataset.moduleReady = 'true'"
    )
    writeFileSync(
      join(previewAssetsPath, 'preview.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#0c2238"/></svg>'
    )
  })

  it('loads the real Tauri webview and exposes the WDIO Tauri bridge', async () => {
    await browser.pause(500)

    await expect($('h1')).toHaveText('MD+HTML Reader')

    const hasBridge = await browser.execute(() => 'wdioTauri' in window)
    expect(hasBridge).toBe(true)

    const hasTauri = await browser.execute(() => '__TAURI__' in window)
    expect(hasTauri).toBe(true)
  })

  it('validates the core file, edit, comment, search, and export flow', async () => {
    await openE2EWorkspaceAndNote()

    await setEditorContent('# Manual E2E Note\n\nEdited keyword for validation.\n\nSecond paragraph for comment target.')
    await buttonContaining('Save').click()
    await waitForBodyText('Saved just now')
    expect(readFileSync(notePath, 'utf8')).toContain('Edited keyword')

    await selectEditorText('Second paragraph')
    await buttonContaining('Add comment').click()
    await $('textarea[placeholder="Write a comment..."]').setValue('Review note')
    await buttonWithText('Submit').click()
    await waitForBodyText('Review note')
    expect(existsSync(join(workspacePath, '.comments'))).toBe(true)

    await browser.refresh()
    await waitForBodyText('MD+HTML Reader')
    await buttonWithText('Open folder').click()
    await waitForBodyText('note.md')
    await buttonContaining('note.md').click()
    await waitForBodyText('Review note')

    await openDocumentTools()
    await buttonWithText('Find files').click()
    await $('input[placeholder="Find a file..."]').setValue('note')
    await waitForBodyText('markdown-html-e2e-workspace')
    await browser.keys('Escape')

    await buttonWithText('Search content').click()
    const directContentResults = await browser.execute(async (rootPath) => {
      return await (window as any).__TAURI__.core.invoke('search_content', {
        workspacePath: rootPath,
        query: 'Edited',
        maxResults: 50,
      })
    }, workspacePath)
    expect(directContentResults).toHaveLength(1)

    await $('input[placeholder="Search workspace content..."]').setValue('Edited')
    await waitForBodyText('Line 3')
    await buttonContaining('note.md').click()

    await buttonWithText('Export HTML').click()
    await waitForBodyText('HTML reading version created and opened')
    const exported = readFileSync(exportPath, 'utf8')
    expect(exported).toContain('Edited keyword')
    expect(exported).toContain('document-outline')
    expect(exported).not.toContain('data-markdown-source')
  })

  it('exports an optional Markdown source panel that defaults to reading mode', async () => {
    await openE2EWorkspaceAndNote()
    await openDocumentTools()
    await $('[aria-label="Include source Markdown"]').click()
    await buttonWithText('Export HTML').click()
    await waitForBodyText('HTML reading version created and opened')

    const exported = readFileSync(exportPath, 'utf8')
    expect(exported).toContain('data-markdown-source')
    expect(exported).toContain('show-source')
    expect(exported).toContain('data-view="reading"')

    const mainWindow = await browser.getWindowHandle()
    await buttonWithText('Open full preview').click()
    const previewWindow = await waitForPreviewWindow(mainWindow)

    try {
      await browser.switchToWindow(previewWindow)
      await expect($('#reader-layout')).toHaveAttribute('data-view', 'reading')
      await expect($('#show-source')).toHaveText('Split view')

      await browser.execute(() => document.getElementById('show-source')?.click())
      await expect($('#reader-layout')).toHaveAttribute('data-view', 'split')
      const markdownSource = await browser.execute(() => document.getElementById('markdown-source')?.textContent)
      expect(markdownSource).toContain('Original keyword')

      await browser.setWindowSize(800, 800)
      await browser.waitUntil(
        async () => await browser.execute(() => document.getElementById('show-source')?.textContent) === 'Markdown',
        { timeoutMsg: 'Expected narrow preview to switch to Markdown/reading tabs' }
      )
      await expect($('#reader-layout')).toHaveAttribute('data-view', 'source')
      await browser.execute(() => document.getElementById('show-reading')?.click())
      await expect($('#reader-layout')).toHaveAttribute('data-view', 'reading')
    } finally {
      await browser.switchToWindow(previewWindow)
      await browser.closeWindow()
      await browser.waitUntil(async () => (await browser.getWindowHandles()).includes(mainWindow), {
        timeoutMsg: 'Expected the main window to remain after closing the preview window',
      })
      await browser.switchToWindow(mainWindow)
    }
  })

  it('uses runtime asset scope to render local CSS, module scripts, images, and author base in an isolated preview window', async () => {
    await buttonWithText('Open folder').click()
    await waitForBodyText('preview.html')
    const previewFileButton = buttonContaining('preview.html')
    const previewFilePath = await previewFileButton.getAttribute('data-file-path')
    if (!previewFilePath) throw new Error('Expected the preview file path in the file tree')
    const dynamicAssetStatus = await browser.execute(async (assetPath) => {
      const assetUrl = (window as any).__TAURI_INTERNALS__.convertFileSrc(assetPath)
      return (await fetch(assetUrl)).status
    }, join(dirname(previewFilePath), 'assets', 'preview.js'))
    expect(dynamicAssetStatus).toBe(200)

    await previewFileButton.click()
    const mainWindow = await browser.getWindowHandle()
    await buttonWithText('Open full preview').click()
    const previewWindow = await waitForPreviewWindow(mainWindow)

    try {
      await browser.switchToWindow(previewWindow)

      await expect($('#preview-status')).toHaveText('Rendered inside app')
      const previewState = await browser.execute(() => {
        const status = document.querySelector<HTMLElement>('#preview-status')
        const image = document.querySelector<HTMLImageElement>('#preview-image')
        return {
          baseUri: document.baseURI,
          color: status ? getComputedStyle(status).color : '',
          imageLoaded: (image?.naturalWidth || 0) > 0,
          moduleReady: document.documentElement.dataset.moduleReady,
        }
      })
      expect(previewState).toEqual({
        baseUri: expect.stringContaining('/assets/'),
        color: 'rgb(12, 34, 56)',
        imageLoaded: true,
        moduleReady: 'true',
      })

      const ipcAccess = await browser.execute(async (rootPath) => {
        const invoke = (window as any).__TAURI__?.core?.invoke
        if (!invoke) return { bridgeExposed: false, commandAllowed: false }

        try {
          await invoke('list_files', { path: rootPath })
          return { bridgeExposed: true, commandAllowed: true }
        } catch {
          return { bridgeExposed: true, commandAllowed: false }
        }
      }, workspacePath)
      expect(ipcAccess.commandAllowed).toBe(false)
    } finally {
      await browser.switchToWindow(previewWindow)
      await browser.closeWindow()
      await browser.waitUntil(async () => (await browser.getWindowHandles()).includes(mainWindow), {
        timeoutMsg: 'Expected the main window to remain after closing the preview window',
      })
      await browser.switchToWindow(mainWindow)
    }
  })

  it('protects unsaved content during file and workspace switches', async () => {
    await buttonWithText('Open folder').click()
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
    expect(confirmMessages[0]).toContain('This file has unsaved changes')
    await waitForBodyText('Unsaved draft')
    expect(await $('body').getText()).not.toContain('Second file content')
    expect(readFileSync(notePath, 'utf8')).toContain('Original keyword')

    await buttonWithText('Open folder').click()
    const workspaceCancelMessages = await browser.execute(() => (window as any).__confirmMessages)
    expect(workspaceCancelMessages).toHaveLength(2)
    expect(workspaceCancelMessages[1]).toContain('Switching workspaces will discard them')
    await waitForBodyText('Unsaved draft')

    await browser.execute(() => {
      window.confirm = () => true
    })
    await buttonWithText('Open folder').click()
    await waitForBodyText('Choose a document to begin')
    expect(await $('body').getText()).not.toContain('Unsaved draft')
    expect(readFileSync(notePath, 'utf8')).toContain('Original keyword')
  })
})
