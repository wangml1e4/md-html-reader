import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  extension?: string
  children?: FileItem[]
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const folderPath = ref<string | null>(null)
  const files = ref<FileItem[]>([])
  const currentFile = ref<{ path: string; content: string } | null>(null)

  async function loadFolder(path: string) {
    try {
      folderPath.value = path
      const result = await invoke<FileItem[]>('list_files', { path })
      files.value = result
    } catch (error) {
      console.error('加载文件夹失败:', error)
      throw error
    }
  }

  async function openFile(path: string) {
    try {
      const content = await invoke<string>('read_file', { path })
      currentFile.value = { path, content }
    } catch (error) {
      console.error('打开文件失败:', error)
      throw error
    }
  }

  async function saveCurrentFile(content: string) {
    if (!currentFile.value) return

    try {
      await invoke('write_file', {
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
