import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { t } from '../i18n'

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  title?: string
  children?: FileItem[]
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const folderPath = ref<string | null>(null)
  const files = ref<FileItem[]>([])
  const currentFile = ref<{ path: string; content: string } | null>(null)
  const tabs = ref<{ path: string; content: string; draft?: string }[]>([])
  const openingPath = ref<string | null>(null)
  const openError = ref<string | null>(null)
  watch(currentFile, file => { if (file && !tabs.value.some(tab => tab.path === file.path)) tabs.value.push(file) }, { flush: 'sync' })
  let folderRequest = 0
  let fileRequest = 0

  async function loadFolder(path: string): Promise<boolean> {
    const request = ++folderRequest
    ++fileRequest
    openingPath.value = null
    try {
      const result = await invoke<FileItem[]>('list_files', { path })
      if (request !== folderRequest) return false
      ++fileRequest
      openingPath.value = null
      openError.value = null
      folderPath.value = path
      files.value = result
      currentFile.value = null
      tabs.value = []
      return true
    } catch (error) {
      console.error('Failed to load folder:', error)
      return false
    }
  }

  async function refreshFiles() {
    const path = folderPath.value
    if (!path) return false
    try { const result = await invoke<FileItem[]>('list_files', { path }); if (folderPath.value !== path) return false; files.value = result; return true } catch { return false }
  }
  async function openFile(path: string): Promise<boolean> {
    if (!folderPath.value) return false
    const request = ++fileRequest
    const workspacePath = folderPath.value
    openingPath.value = path
    openError.value = null
    try {
      const existing = tabs.value.find(tab => tab.path === path)
      if (existing) { currentFile.value = existing; return true }
      const content = await invoke<string>('read_file', {
        workspacePath,
        path,
      })
      if (request !== fileRequest || workspacePath !== folderPath.value) return false
      const tab = { path, content }
      tabs.value.push(tab)
      currentFile.value = tabs.value[tabs.value.length - 1]
      return true
    } catch (error) {
      if (request !== fileRequest) return false
      openError.value = `打开文件失败：${error instanceof Error ? error.message : String(error)}`
      console.error('打开文件失败:', error)
      return false
    } finally {
      if (request === fileRequest) openingPath.value = null
    }
  }

  async function saveFile(path: string, content: string) {
    const file = tabs.value.find(tab => tab.path === path) || currentFile.value
    if (!file || file.path !== path) return
    if (!folderPath.value) throw new Error(t('noWorkspaceOpen'))

    const workspacePath = folderPath.value
    const targetFile = file
    const targetPath = targetFile.path

    try {
      await invoke('write_file_checked', {
        workspacePath,
        path: targetPath,
        content,
        expectedContent: targetFile.content,
      })
      targetFile.content = content
    } catch (error) {
      console.error('Failed to save file:', error)
      throw error
    }
  }

  async function saveCurrentFile(content: string) { if (currentFile.value) await saveFile(currentFile.value.path, content) }
  function closeTab(path: string) {
    const index = tabs.value.findIndex(tab => tab.path === path)
    if (index < 0) return
    tabs.value.splice(index, 1)
    if (currentFile.value?.path === path) currentFile.value = tabs.value[Math.min(index, tabs.value.length - 1)] || null
  }
  return {
    tabs, saveFile, closeTab, refreshFiles,
    folderPath,
    files,
    currentFile,
    openingPath,
    openError,
    loadFolder,
    openFile,
    saveCurrentFile,
  }
})
