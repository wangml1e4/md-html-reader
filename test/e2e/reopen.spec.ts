import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const workspacePath = '/tmp/markdown-html-e2e-workspace'
const notePath = join(workspacePath, 'note.md')
const phase = process.env.E2E_REOPEN_PHASE

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

async function setEditorContent(text: string) {
  const updated = await browser.execute((content) => {
    const helpers = (window as any).__markdownHtmlE2E
    if (!helpers) return false
    helpers.setEditorContent(content)
    return true
  }, text)

  expect(updated).toBe(true)
  await waitForBodyText('Edited after app restart')
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

async function openE2EWorkspaceAndNote(expectedText: string) {
  await buttonWithText('Open folder').click()
  await waitForBodyText('note.md')

  await buttonContaining('note.md').click()
  await waitForBodyText(expectedText)
}

describe('MD+HTML Reader app restart persistence', () => {
  before(() => {
    if (phase === 'create') {
      rmSync(workspacePath, { recursive: true, force: true })
      mkdirSync(workspacePath, { recursive: true })
      writeFileSync(
        notePath,
        '# Restart E2E Note\n\nOriginal restart text.\n\nRestart comment target.\n'
      )
      return
    }

    if (phase === 'verify' && !existsSync(notePath)) {
      throw new Error('Missing reopen fixture; run E2E_REOPEN_PHASE=create first')
    }
  })

  it('creates a saved comment or verifies it after a fresh app process', async () => {
    if (phase === 'create') {
      await openE2EWorkspaceAndNote('Original restart text')
      await setEditorContent('# Restart E2E Note\n\nEdited after app restart.\n\nRestart comment target.')
      await buttonContaining('Save').click()
      await waitForBodyText('Saved just now')
      expect(readFileSync(notePath, 'utf8')).toContain('Edited after app restart')

      await selectEditorText('Restart comment target')
      await buttonContaining('Add comment').click()
      await $('textarea[placeholder="Write a comment..."]').setValue('Reopen review note')
      await buttonWithText('Submit').click()
      await waitForBodyText('Reopen review note')
      expect(existsSync(join(workspacePath, '.comments'))).toBe(true)
      return
    }

    expect(phase).toBe('verify')
    await openE2EWorkspaceAndNote('Edited after app restart')
    await waitForBodyText('Reopen review note')
  })
})
