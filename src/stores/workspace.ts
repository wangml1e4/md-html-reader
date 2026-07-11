import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

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

  async function loadFolder(path: string) {
    try {
      const result = await invoke<FileItem[]>('list_files', { path })
      folderPath.value = path
      files.value = result
    } catch (error) {
      console.error('加载文件夹失败:', error)
      folderPath.value = null
      files.value = []
    }
  }

  async function openFile(path: string) {
    if (!folderPath.value) return

    try {
      const content = await invoke<string>('read_file', {
        workspacePath: folderPath.value,
        path,
      })
      currentFile.value = { path, content }
    } catch (error) {
      console.error('打开文件失败:', error)
      currentFile.value = null
    }
  }

  async function saveCurrentFile(content: string) {
    if (!currentFile.value) return
    if (!folderPath.value) throw new Error('未加载工作区')

    try {
      await invoke('write_file', {
        workspacePath: folderPath.value,
        path: currentFile.value.path,
        content,
      })
      currentFile.value.content = content
    } catch (error) {
      console.error('保存文件失败:', error)
      throw error
    }
  }

  return {
    folderPath,
    files,
    currentFile,
    loadFolder,
    openFile,
    saveCurrentFile,
  }
})
