import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { relocateAnchor } from '../utils/comment-anchor'

export interface Comment {
  id: string
  fileHash: string
  anchor: {
    quote: string
    offset: number
    length: number
  }
  content: string
  status: 'open' | 'resolved'
  confidence?: number
  createdAt: number
  updatedAt: number
}

export const useCommentsStore = defineStore('comments', () => {
  const list = ref<Comment[]>([])
  const currentWorkspacePath = ref<string | null>(null)
  const currentFileHash = ref<string | null>(null)
  const currentFilePath = ref<string | null>(null)

  function clearCurrentFile() {
    list.value = []
    currentWorkspacePath.value = null
    currentFileHash.value = null
    currentFilePath.value = null
  }

  async function loadComments(workspacePath: string, filePath: string, currentContent?: string) {
    try {
      const hash = await invoke<string>('calculate_file_hash', {
        workspacePath,
        path: filePath,
      })
      currentWorkspacePath.value = workspacePath
      currentFileHash.value = hash
      currentFilePath.value = filePath

      const comments = await invoke<Comment[]>('load_comments', {
        workspacePath,
        fileHash: hash,
        filePath: filePath
      })
      list.value = currentContent
        ? relocateComments(comments, currentContent)
        : [...comments]
    } catch (error) {
      console.error('加载评论失败:', error)
      clearCurrentFile()
    }
  }

  function relocateComments(comments: Comment[], currentContent: string) {
    return comments.map(comment => {
      const result = relocateAnchor(comment.anchor, currentContent)

      return {
        ...comment,
        confidence: result.confidence,
        anchor: {
          ...comment.anchor,
          offset: result.newOffset,
        },
      }
    })
  }

  async function refreshCurrentFileHash(
    workspacePath = currentWorkspacePath.value,
    filePath = currentFilePath.value,
  ) {
    if (!workspacePath || !filePath) return

    const hash = await invoke<string>('calculate_file_hash', {
      workspacePath,
      path: filePath,
    })
    currentWorkspacePath.value = workspacePath
    currentFileHash.value = hash
    currentFilePath.value = filePath
  }

  async function saveComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!currentWorkspacePath.value || !currentFileHash.value || !currentFilePath.value) {
      throw new Error('未加载评论文件')
    }

    try {
      const newComment: Comment = {
        ...comment,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await invoke('save_comment', {
        workspacePath: currentWorkspacePath.value,
        fileHash: currentFileHash.value,
        filePath: currentFilePath.value,
        comment: newComment,
      })

      list.value.push(newComment)
      return newComment
    } catch (error) {
      console.error('保存评论失败:', error)
      throw error
    }
  }

  async function deleteComment(commentId: string) {
    if (!currentWorkspacePath.value || !currentFileHash.value || !currentFilePath.value) {
      throw new Error('未加载评论文件')
    }

    try {
      await invoke('delete_comment', {
        workspacePath: currentWorkspacePath.value,
        fileHash: currentFileHash.value,
        filePath: currentFilePath.value,
        commentId,
      })

      list.value = list.value.filter(c => c.id !== commentId)
    } catch (error) {
      console.error('删除评论失败:', error)
      throw error
    }
  }

  async function updateCommentStatus(commentId: string, status: 'open' | 'resolved') {
    const comment = list.value.find(c => c.id === commentId)
    if (!comment) return

    if (!currentWorkspacePath.value || !currentFileHash.value || !currentFilePath.value) {
      throw new Error('未加载评论文件')
    }

    comment.status = status
    comment.updatedAt = Date.now()

    try {
      await invoke('update_comment', {
        workspacePath: currentWorkspacePath.value,
        fileHash: currentFileHash.value,
        filePath: currentFilePath.value,
        comment,
      })
    } catch (error) {
      console.error('更新评论失败:', error)
      throw error
    }
  }

  return {
    list,
    currentWorkspacePath,
    currentFileHash,
    currentFilePath,
    clearCurrentFile,
    loadComments,
    refreshCurrentFileHash,
    saveComment,
    deleteComment,
    updateCommentStatus,
  }
})
