<template>
  <div id="app" class="h-screen flex flex-col bg-gray-50">
    <!-- 顶部工具栏 -->
    <header class="h-12 bg-white border-b border-gray-200 flex items-center px-4">
      <h1 class="text-lg font-semibold text-gray-800">Markdown HTML Editor</h1>
      <div class="ml-auto flex gap-2">
        <button
          @click="openFolder"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          打开文件夹
        </button>
      </div>
    </header>

    <!-- 主工作区 -->
    <main class="flex-1 flex overflow-hidden">
      <!-- 左侧文件树 -->
      <aside
        v-if="workspace.folderPath"
        class="w-64 bg-white border-r border-gray-200 overflow-auto"
      >
        <FileTree :files="workspace.files" @select="openFile" />
      </aside>

      <!-- 中间编辑区 -->
      <section class="flex-1 flex flex-col">
        <div v-if="!workspace.currentFile" class="flex-1 flex items-center justify-center text-gray-400">
          <div class="text-center">
            <p class="text-xl mb-2">欢迎使用 Markdown HTML Editor</p>
            <p class="text-sm">点击"打开文件夹"开始编辑</p>
          </div>
        </div>

        <div v-else class="flex-1 overflow-hidden">
          <MilkdownEditor
            :file="workspace.currentFile"
            :save-content="saveFile"
            @createComment="handleCreateComment"
          />
        </div>
      </section>

      <!-- 右侧评论栏 -->
      <aside
        v-if="workspace.currentFile && comments.list.length > 0"
        class="w-80 bg-white border-l border-gray-200 overflow-auto"
      >
        <CommentSidebar
          :comments="comments.list"
          @resolve="handleResolveComment"
          @delete="handleDeleteComment"
        />
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from './stores/workspace'
import { useCommentsStore } from './stores/comments'
import FileTree from './components/FileTree.vue'
import MilkdownEditor from './components/MilkdownEditor.vue'
import CommentSidebar from './components/CommentSidebar.vue'

const workspace = useWorkspaceStore()
const comments = useCommentsStore()

async function openFolder() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (selected && typeof selected === 'string') {
      await workspace.loadFolder(selected)
    }
  } catch (error) {
    console.error('打开文件夹失败:', error)
  }
}

async function openFile(filePath: string) {
  if (!workspace.folderPath) return
  await workspace.openFile(filePath)
  await comments.loadComments(workspace.folderPath, filePath, workspace.currentFile?.content)
}

async function saveFile(content: string) {
  const filePath = workspace.currentFile?.path
  await workspace.saveCurrentFile(content)
  if (workspace.folderPath && filePath) {
    await comments.refreshCurrentFileHash(workspace.folderPath, filePath)
  }
}

async function handleCreateComment(anchor: any, content: string) {
  if (!workspace.currentFile) return

  try {
    await comments.saveComment({
      fileHash: comments.currentFileHash!,
      anchor,
      content,
      status: 'open',
    })

    console.log('评论创建成功')
  } catch (error) {
    console.error('创建评论失败:', error)
  }
}

async function handleResolveComment(commentId: string) {
  try {
    await comments.updateCommentStatus(commentId, 'resolved')
  } catch (error) {
    console.error('解决评论失败:', error)
  }
}

async function handleDeleteComment(commentId: string) {
  try {
    await comments.deleteComment(commentId)
  } catch (error) {
    console.error('删除评论失败:', error)
  }
}
</script>
