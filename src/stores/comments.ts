import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

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
  createdAt: number
  updatedAt: number
}

export const useCommentsStore = defineStore('comments', () => {
  const list = ref<Comment[]>([])
  const currentFileHash = ref<string | null>(null)
  const currentFilePath = ref<string | null>(null)

  async function loadComments(filePath: string) {
    try {
      const hash = await invoke<string>('calculate_file_hash', { path: filePath })
      currentFileHash.value = hash
      currentFilePath.value = filePath

      const comments = await invoke<Comment[]>('load_comments', {
        fileHash: hash,
        filePath: filePath
      })
      list.value = comments
    } catch (error) {
      console.error('加载评论失败:', error)
      list.value = []
    }
  }

  async function saveComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const newComment: Comment = {
        ...comment,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await invoke('save_comment', {
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
    try {
      await invoke('delete_comment', {
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

    comment.status = status
    comment.updatedAt = Date.now()

    try {
      await invoke('update_comment', {
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
    currentFileHash,
    loadComments,
    saveComment,
    deleteComment,
    updateCommentStatus,
  }
})
