<template>
  <div id="app" class="h-screen flex flex-col bg-gray-50">
    <!-- 顶部工具栏 -->
    <header class="h-12 bg-white border-b border-gray-200 flex items-center px-4">
      <h1 class="text-lg font-semibold text-gray-800">Markdown HTML Editor</h1>
      <div class="ml-auto flex gap-2">
        <button
          @click="openSearch('files')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!workspace.folderPath || isMarkdownTranslating"
        >
          搜索文件
        </button>
        <button
          @click="openSearch('content')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!workspace.folderPath || isMarkdownTranslating"
        >
          搜索内容
        </button>
        <button
          @click="exportHtml"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!workspace.currentFile || isExporting"
        >
          导出 HTML
        </button>
        <select
          v-model="translationService"
          @change="handleTranslationServiceChange"
          class="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
          aria-label="翻译服务"
        >
          <option value="ollama">Ollama</option>
          <option value="tencent">腾讯翻译</option>
          <option value="openai-compatible">OpenAI 兼容</option>
        </select>
        <button
          @click="openAiConfigOpen = !openAiConfigOpen"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          aria-label="配置 OpenAI 兼容模型"
        >
          模型配置
        </button>
        <button
          @click="translateMarkdownFile"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isMarkdownTranslating || (translationService === 'openai-compatible' && !openAiConfigComplete)"
        >
          {{ isMarkdownTranslating ? '翻译中...' : '一键翻译为中文副本' }}
        </button>
        <button
          @click="runDocumentAssistant('suggestions')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || !comments.list.length || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        >
          {{ isAssistantRunning && assistantMode === 'suggestions' ? '分析中...' : '根据评论提出建议' }}
        </button>
        <button
          @click="runDocumentAssistant('optimize')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        >
          {{ isAssistantRunning && assistantMode === 'optimize' ? '优化中...' : '优化当前文档' }}
        </button>
        <button
          @click="openFolder"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          :disabled="isMarkdownTranslating || isFolderOpening"
        >
          {{ isFolderOpening ? '打开中...' : '打开文件夹' }}
        </button>
      </div>
    </header>

    <div
      v-if="workspaceError"
      class="px-4 py-2 text-sm border-b bg-red-50 text-red-600 border-red-100"
    >
      {{ workspaceError }}
    </div>

    <div
      v-if="markdownTranslationMessage || markdownTranslationError"
      class="px-4 py-2 text-sm border-b"
      :class="markdownTranslationError ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'"
    >
      {{ markdownTranslationError || markdownTranslationMessage }}
    </div>

    <div
      v-if="assistantMessage || assistantError"
      class="px-4 py-2 text-sm border-b"
      :class="assistantError ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'"
    >
      {{ assistantError || assistantMessage }}
    </div>

    <section
      v-if="openAiConfigOpen"
      aria-label="OpenAI 兼容模型配置"
      class="px-4 py-3 bg-white border-b border-gray-200"
    >
      <div class="max-w-4xl space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-gray-800">OpenAI 兼容模型配置</div>
          <button class="text-xs text-gray-500 hover:text-gray-700" @click="openAiConfigOpen = false">关闭</button>
        </div>
        <div class="grid gap-2 md:grid-cols-3">
          <label class="text-xs text-gray-600">
            Base URL
            <input
              v-model.trim="openAiBaseUrl"
              @change="persistOpenAiSettings"
              class="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
              placeholder="https://api.deepseek.com/v1"
              autocomplete="url"
            />
          </label>
          <label class="text-xs text-gray-600">
            模型
            <input
              v-model.trim="openAiModel"
              @change="persistOpenAiSettings"
              class="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
              placeholder="deepseek-chat"
              autocomplete="off"
              list="openai-compatible-models"
            />
          </label>
          <label class="text-xs text-gray-600">
            API Key
            <input
              v-model="openAiApiKey"
              class="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
              type="password"
              placeholder="sk-..."
              autocomplete="off"
            />
          </label>
        </div>
        <datalist id="openai-compatible-models">
          <option v-for="model in openAiModels" :key="model" :value="model" />
        </datalist>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete"
            @click="saveOpenAiConfiguration"
          >
            保存配置
          </button>
          <button
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isTestingOpenAiConnection"
            @click="testOpenAiConnection"
          >
            {{ isTestingOpenAiConnection ? '测试中...' : '测试连接' }}
          </button>
          <button
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isLoadingOpenAiModels"
            @click="loadOpenAiModels"
          >
            {{ isLoadingOpenAiModels ? '拉取中...' : '拉取模型列表' }}
          </button>
        </div>
        <p class="text-xs text-gray-500">
          使用 OpenAI Chat Completions 兼容协议。DeepSeek 示例：Base URL 为 https://api.deepseek.com/v1，模型为 deepseek-chat。
          “保存配置”会保存 Base URL 和模型；API Key 只保存在本次运行内，不写入磁盘。
        </p>
        <p v-if="openAiConfigError" class="text-xs text-red-600">{{ openAiConfigError }}</p>
        <p v-else-if="openAiConfigMessage" class="text-xs text-green-700">{{ openAiConfigMessage }}</p>
        <p v-if="translationService === 'openai-compatible' && !openAiConfigComplete" class="text-xs text-red-600">
          请填写 Base URL、模型和 API Key 后再翻译。
        </p>
        <p v-if="permanentAssistantWritePermission" class="text-xs text-amber-700">
          已授予永久修改权（{{ assistantWritePermissionScopeLabel }}）：每次模型读取仍会询问，但应用优化稿时不会再弹出二次写入确认。
          <button class="underline" @click="setPermanentAssistantWritePermission(false)">撤销授权</button>
        </p>
      </div>
    </section>

    <!-- 主工作区 -->
    <main class="flex-1 flex overflow-hidden">
      <!-- 左侧文件树 -->
      <aside
        v-if="workspace.folderPath"
        class="w-64 bg-white border-r border-gray-200 overflow-auto"
      >
        <div class="p-2 border-b border-gray-200 space-y-2">
          <div class="flex gap-1">
            <button
              class="px-2 py-1 text-xs rounded"
              :class="fileFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="fileFilter = 'all'"
            >
              全部
            </button>
            <button
              class="px-2 py-1 text-xs rounded"
              :class="fileFilter === 'markdown' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="fileFilter = 'markdown'"
            >
              只看 Markdown
            </button>
            <button
              class="px-2 py-1 text-xs rounded"
              :class="fileFilter === 'html' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="fileFilter = 'html'"
            >
              只看 HTML
            </button>
          </div>
          <div class="flex gap-1">
            <button
              class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              :disabled="!workspace.currentFile"
              @click="locateCurrentFile"
            >
              定位当前文件
            </button>
            <button
              class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              @click="toggleDisplayMode"
            >
              {{ displayMode === 'filename' ? '显示标题' : '显示文档名' }}
            </button>
          </div>
          <button
            class="w-full px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!currentIsMarkdown"
            @click="outlineOpen = !outlineOpen"
          >
            {{ outlineOpen && currentIsMarkdown ? '关闭标题大纲' : '打开标题大纲' }}
          </button>
        </div>
        <FileTree
          :files="workspace.files"
          :filter="fileFilter"
          :display-mode="displayMode"
          :current-path="workspace.currentFile?.path || null"
          :locate-token="locateToken"
          :disabled="isMarkdownTranslating"
          @select="openFile"
        />
      </aside>

      <aside
        v-if="outlineOpen && currentIsMarkdown"
        class="w-56 bg-white border-r border-gray-200 overflow-hidden"
      >
        <DocumentOutline
          :content="workspace.currentFile?.content || ''"
          @select="handleOutlineSelect"
        />
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
          <HtmlRenderer
            v-if="currentIsHtml"
            :key="workspace.currentFile.path"
            :file="workspace.currentFile"
          />

          <MilkdownEditor
            v-else
            ref="editorRef"
            :key="workspace.currentFile.path"
            :file="workspace.currentFile"
            :save-content="saveFile"
            @createComment="handleCreateComment"
            @translate="handleTranslate"
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

    <SearchPanel
      :show="showSearchPanel"
      :mode="searchMode"
      :workspace-path="workspace.folderPath"
      @close="showSearchPanel = false"
      @openFile="openFileFromSearch"
    />

    <div
      v-if="exportMessage"
      role="status"
      class="fixed bottom-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded shadow-lg"
    >
      {{ exportMessage }}
    </div>

    <TranslationCard
      v-if="translationState !== 'idle'"
      :state="translationState"
      :original="translationOriginal"
      :translated="translationTranslated"
      :service="translationService"
      :error="translationError"
      @close="translationState = 'idle'"
    />

    <DocumentAssistantPanel
      v-if="assistantResult"
      :mode="assistantResult.mode"
      :original="assistantResult.sourceContent"
      :content="assistantResult.content"
      :applying="isAssistantApplying"
      :permanent-write-permission="permanentAssistantWritePermission"
      :permission-scope="describeAssistantWritePermissionScope(assistantResult.permissionScope)"
      @close="assistantResult = null"
      @apply="applyAssistantOptimization"
      @update:permanent-write-permission="setPermanentAssistantWritePermission"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from './stores/workspace'
import { useCommentsStore } from './stores/comments'
import FileTree from './components/FileTree.vue'
import HtmlRenderer from './components/HtmlRenderer.vue'
import CommentSidebar from './components/CommentSidebar.vue'
import DocumentOutline from './components/DocumentOutline.vue'
import type { Selection } from './utils/selection'

const MilkdownEditor = defineAsyncComponent(() =>
  import('./components/MilkdownEditor.vue').then(module => module.default)
)
const SearchPanel = defineAsyncComponent(() =>
  import('./components/SearchPanel.vue').then(module => module.default)
)
const TranslationCard = defineAsyncComponent(() =>
  import('./components/TranslationCard.vue').then(module => module.default)
)
const DocumentAssistantPanel = defineAsyncComponent(() =>
  import('./components/DocumentAssistantPanel.vue').then(module => module.default)
)

type SearchMode = 'files' | 'content'
type FileFilter = 'all' | 'markdown' | 'html'
type DisplayMode = 'filename' | 'title'
type TranslationService = 'ollama' | 'tencent' | 'openai-compatible'
type TranslationState = 'idle' | 'loading' | 'success' | 'error'
type DocumentAssistantMode = 'suggestions' | 'optimize'
interface OutlineHeading {
  level: number
  text: string
  line: number
}
interface TranslationResult {
  original: string
  translated: string
  sourceLang: string
  targetLang: string
  service: TranslationService
}
interface MarkdownTranslationResult {
  outputPath: string
  translatedCharacters: number
  translatedSegments: number
}
interface OpenAiCompatibleConfig {
  baseUrl: string
  model: string
  apiKey: string
}
interface DocumentAssistantComment {
  anchor: { quote: string }
  content: string
  status: 'open' | 'resolved'
}
interface DocumentAssistantResult {
  content: string
}
interface AssistantWritePermissionScope {
  workspacePath: string
  filePath: string
  service: TranslationService
  model: string
}
interface DocumentAssistantSession {
  mode: DocumentAssistantMode
  sourcePath: string
  sourceContent: string
  content: string
  permissionScope: AssistantWritePermissionScope
}
interface EditorHandle {
  requestDiscardChanges: (action: 'switch-file' | 'switch-workspace' | 'close-window') => Promise<boolean>
  saveCurrentContent: () => Promise<void>
  getCurrentContent: () => string
  replaceContent: (content: string) => Promise<void>
  scrollToHeading: (text: string, level: number) => void
}

const workspace = useWorkspaceStore()
const comments = useCommentsStore()
const showSearchPanel = ref(false)
const searchMode = ref<SearchMode>('files')
const fileFilter = ref<FileFilter>('all')
const displayMode = ref<DisplayMode>('filename')
const locateToken = ref(0)
const outlineOpen = ref(false)
const editorRef = ref<EditorHandle | null>(null)
const translationService = ref<TranslationService>('ollama')
const openAiConfigOpen = ref(false)
const openAiBaseUrl = ref(readOpenAiSetting('baseUrl'))
const openAiModel = ref(readOpenAiSetting('model'))
const openAiApiKey = ref('')
const openAiModels = ref<string[]>([])
const isTestingOpenAiConnection = ref(false)
const isLoadingOpenAiModels = ref(false)
const openAiConfigMessage = ref<string | null>(null)
const openAiConfigError = ref<string | null>(null)
const translationState = ref<TranslationState>('idle')
const translationOriginal = ref('')
const translationTranslated = ref('')
const translationError = ref<string | null>(null)
const isExporting = ref(false)
const exportMessage = ref<string | null>(null)
const isMarkdownTranslating = ref(false)
const markdownTranslationMessage = ref<string | null>(null)
const markdownTranslationError = ref<string | null>(null)
const isFolderOpening = ref(false)
const workspaceError = ref<string | null>(null)
const assistantMode = ref<DocumentAssistantMode | null>(null)
const isAssistantRunning = ref(false)
const isAssistantApplying = ref(false)
const assistantResult = ref<DocumentAssistantSession | null>(null)
const assistantMessage = ref<string | null>(null)
const assistantError = ref<string | null>(null)
const assistantPermissionVersion = ref(0)
const assistantSessionPermissions = new Set<string>()
let unlistenCloseRequested: (() => void) | null = null
let appUnmounted = false
const isE2E = import.meta.env.MODE === 'e2e'
const e2eWorkspacePath = '/tmp/markdown-html-e2e-workspace'
const e2eExportPath = `${e2eWorkspacePath}/note.html`
const currentIsMarkdown = computed(() => {
  return workspace.currentFile?.path.toLowerCase().endsWith('.md') || false
})
const currentIsHtml = computed(() => {
  const path = workspace.currentFile?.path.toLowerCase() || ''
  return path.endsWith('.html') || path.endsWith('.htm') || path.endsWith('.xhtml')
})
const openAiConfigComplete = computed(() => {
  return Boolean(openAiBaseUrl.value.trim() && openAiModel.value.trim() && openAiApiKey.value.trim())
})
const openAiConnectionConfigComplete = computed(() => {
  return Boolean(openAiBaseUrl.value.trim() && openAiApiKey.value.trim())
})
const assistantServiceReady = computed(() => {
  return translationService.value !== 'tencent'
    && (translationService.value !== 'openai-compatible' || openAiConfigComplete.value)
})
const assistantDisabledReason = computed(() => {
  if (translationService.value === 'tencent') return 'AI 助手仅支持 Ollama 或 OpenAI 兼容服务'
  if (translationService.value === 'openai-compatible' && !openAiConfigComplete.value) {
    return '请先填写 OpenAI 兼容服务的 Base URL、模型和 API Key'
  }
  if (!currentIsMarkdown.value) return '仅支持当前打开的 Markdown 文件'
  return ''
})
const assistantWritePermissionScope = computed<AssistantWritePermissionScope | null>(() => {
  const workspacePath = workspace.folderPath
  const filePath = workspace.currentFile?.path
  if (!workspacePath || !filePath) return null

  return {
    workspacePath,
    filePath,
    service: translationService.value,
    model: translationService.value === 'openai-compatible'
      ? `${openAiBaseUrl.value.trim()}|${openAiModel.value.trim()}`
      : 'ollama-default',
  }
})
const permanentAssistantWritePermission = computed(() => {
  assistantPermissionVersion.value
  const scope = assistantWritePermissionScope.value
  return Boolean(scope && hasPermanentAssistantWritePermission(scope))
})
const assistantWritePermissionScopeLabel = computed(() => {
  return describeAssistantWritePermissionScope(assistantWritePermissionScope.value)
})

function describeAssistantWritePermissionScope(scope: AssistantWritePermissionScope | null) {
  if (!scope) return '当前文件与模型'
  const fileName = scope.filePath.split('/').pop() || scope.filePath
  const modelName = scope.model.split('|').slice(-1)[0] || ''
  const serviceName = scope.service === 'openai-compatible'
    ? `OpenAI 兼容模型 ${modelName}`
    : 'Ollama 默认模型'
  return `文件 ${fileName}，${serviceName}`
}

function readOpenAiSetting(name: 'baseUrl' | 'model') {
  try {
    return window.localStorage.getItem(`md-html-reader.openai-compatible.${name}`) || ''
  } catch {
    return ''
  }
}

function persistOpenAiSettings() {
  try {
    for (const [name, value] of [
      ['baseUrl', openAiBaseUrl.value],
      ['model', openAiModel.value],
    ] as const) {
      const key = `md-html-reader.openai-compatible.${name}`
      if (value.trim()) window.localStorage.setItem(key, value.trim())
      else window.localStorage.removeItem(key)
    }
  } catch {
    // 浏览器存储不可用时仍保留当前运行内的配置。
  }
}

function openAiConnectionPayload() {
  const baseUrl = openAiBaseUrl.value.trim()
  const apiKey = openAiApiKey.value.trim()
  if (!baseUrl || !apiKey) {
    throw new Error('请先填写 Base URL 和 API Key')
  }
  return { baseUrl, apiKey }
}

function saveOpenAiConfiguration() {
  try {
    openAiConnectionPayload()
    persistOpenAiSettings()
    openAiConfigError.value = null
    openAiConfigMessage.value = '配置已保存；API Key 仅保留在本次运行内'
  } catch (error) {
    openAiConfigMessage.value = null
    openAiConfigError.value = error instanceof Error ? error.message : String(error)
  }
}

async function testOpenAiConnection() {
  try {
    const { baseUrl, apiKey } = openAiConnectionPayload()
    isTestingOpenAiConnection.value = true
    openAiConfigError.value = null
    openAiConfigMessage.value = null
    const result = await invoke<{ modelCount: number }>('test_openai_compatible_connection', {
      baseUrl,
      apiKey,
    })
    openAiConfigMessage.value = `连接成功，可获取 ${result.modelCount} 个模型`
  } catch (error) {
    openAiConfigError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isTestingOpenAiConnection.value = false
  }
}

async function loadOpenAiModels() {
  try {
    const { baseUrl, apiKey } = openAiConnectionPayload()
    isLoadingOpenAiModels.value = true
    openAiConfigError.value = null
    openAiConfigMessage.value = null
    const models = await invoke<string[]>('fetch_openai_compatible_models', { baseUrl, apiKey })
    openAiModels.value = models
    if (!openAiModel.value.trim() && models.length) {
      openAiModel.value = models[0]
      persistOpenAiSettings()
    }
    openAiConfigMessage.value = models.length
      ? `已加载 ${models.length} 个模型，可在“模型”输入框中选择或输入自定义名称`
      : '连接成功，但服务未返回可用模型'
  } catch (error) {
    openAiConfigError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoadingOpenAiModels.value = false
  }
}

function assistantWritePermissionKey(scope: AssistantWritePermissionScope) {
  return `md-html-reader.assistant.permanent-write-permission.${encodeURIComponent(JSON.stringify(scope))}`
}

function hasPermanentAssistantWritePermission(scope: AssistantWritePermissionScope) {
  const key = assistantWritePermissionKey(scope)
  if (assistantSessionPermissions.has(key)) return true
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function setPermanentAssistantWritePermission(granted: boolean) {
  const scope = assistantWritePermissionScope.value
  if (!scope) return

  const key = assistantWritePermissionKey(scope)
  if (granted) assistantSessionPermissions.add(key)
  else assistantSessionPermissions.delete(key)
  try {
    if (granted) window.localStorage.setItem(key, 'true')
    else window.localStorage.removeItem(key)
  } catch {
    // 浏览器存储不可用时仍在当前运行内保留授权状态。
  }
  assistantPermissionVersion.value += 1
}

function handleTranslationServiceChange() {
  if (translationService.value === 'openai-compatible') openAiConfigOpen.value = true
}

function openAiConfigPayload(): OpenAiCompatibleConfig | undefined {
  if (translationService.value !== 'openai-compatible') return undefined
  persistOpenAiSettings()
  return {
    baseUrl: openAiBaseUrl.value,
    model: openAiModel.value,
    apiKey: openAiApiKey.value,
  }
}

async function openFolder() {
  if (isMarkdownTranslating.value || isFolderOpening.value) return

  isFolderOpening.value = true
  workspaceError.value = null
  try {
    const selected = isE2E
      ? e2eWorkspacePath
      : await open({
          directory: true,
          multiple: false,
          title: '选择工作区文件夹',
          defaultPath: workspace.folderPath || undefined,
        })

    const selectedPath = Array.isArray(selected) ? selected[0] : selected
    if (!selectedPath) return

    if (editorRef.value && !(await editorRef.value.requestDiscardChanges('switch-workspace'))) return
    if (!(await workspace.loadFolder(selectedPath))) {
      throw new Error('无法读取所选文件夹，请检查访问权限后重试')
    }
    comments.clearCurrentFile()
  } catch (error) {
    console.error('打开文件夹失败:', error)
    const message = error instanceof Error ? error.message : String(error)
    workspaceError.value = `打开文件夹失败：${message}`
  } finally {
    isFolderOpening.value = false
  }
}

async function openFile(filePath: string) {
  if (isMarkdownTranslating.value) return
  if (!workspace.folderPath) return
  if (workspace.currentFile?.path === filePath) return
  if (editorRef.value && !(await editorRef.value.requestDiscardChanges('switch-file'))) return

  if (!(await workspace.openFile(filePath))) return
  await comments.loadComments(workspace.folderPath, filePath, workspace.currentFile?.content)
}

async function openFileFromSearch(filePath: string) {
  await openFile(filePath)
}

function openSearch(mode: SearchMode) {
  if (isMarkdownTranslating.value) return
  if (!workspace.folderPath) return
  searchMode.value = mode
  showSearchPanel.value = true
}

function locateCurrentFile() {
  if (!workspace.currentFile) return
  fileFilter.value = 'all'
  locateToken.value += 1
}

function toggleDisplayMode() {
  displayMode.value = displayMode.value === 'filename' ? 'title' : 'filename'
}

function handleOutlineSelect(heading: OutlineHeading) {
  editorRef.value?.scrollToHeading?.(heading.text, heading.level)
}

async function saveFile(content: string) {
  const filePath = workspace.currentFile?.path
  const folderPath = workspace.folderPath
  await workspace.saveCurrentFile(content)
  if (folderPath && filePath && workspace.folderPath === folderPath && workspace.currentFile?.path === filePath) {
    await comments.refreshCurrentFileHash(folderPath, filePath)
  }
}

async function exportHtml() {
  if (!workspace.folderPath || !workspace.currentFile) return

  isExporting.value = true
  exportMessage.value = null
  try {
    const defaultPath = workspace.currentFile.path.replace(/\.[^/.]+$/, '.html')
    const outputPath = isE2E
      ? e2eExportPath
      : await save({
          defaultPath,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        })

    if (!outputPath || typeof outputPath !== 'string') return

    await invoke('export_as_html', {
      workspacePath: workspace.folderPath,
      filePath: workspace.currentFile.path,
      outputPath,
      cssContent: null,
    })
    exportMessage.value = 'HTML 已导出'
  } catch (error) {
    console.error('导出 HTML 失败:', error)
    const message = error instanceof Error ? error.message : String(error)
    exportMessage.value = message.includes('路径不在已授权工作区内')
      ? '导出位置必须位于当前工作区内'
      : `HTML 导出失败：${message}`
  } finally {
    isExporting.value = false
  }
}

async function translateMarkdownFile() {
  const workspacePath = workspace.folderPath
  const sourceFile = workspace.currentFile
  const service = translationService.value
  if (!workspacePath || !sourceFile || !currentIsMarkdown.value || isMarkdownTranslating.value) return

  isMarkdownTranslating.value = true
  markdownTranslationMessage.value = null
  markdownTranslationError.value = null

  try {
    if (!editorRef.value) {
      throw new Error('编辑器尚未就绪，请稍后重试')
    }
    await editorRef.value.saveCurrentContent()
    const openaiConfig = openAiConfigPayload()
    const result = await invoke<MarkdownTranslationResult>('translate_markdown_to_chinese', {
      service,
      workspacePath,
      filePath: sourceFile.path,
      ...(openaiConfig ? { openaiConfig } : {}),
    })

    if (!(await workspace.loadFolder(workspacePath))) {
      throw new Error('刷新文件列表失败')
    }
    comments.clearCurrentFile()
    if (!(await workspace.openFile(result.outputPath))) {
      throw new Error('打开中文翻译副本失败')
    }
    await comments.loadComments(
      workspacePath,
      result.outputPath,
      workspace.currentFile?.content
    )

    const outputName = result.outputPath.split('/').pop() || result.outputPath
    markdownTranslationMessage.value = `已生成中文翻译副本：${outputName}`
  } catch (error) {
    console.error('生成中文翻译副本失败:', error)
    markdownTranslationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isMarkdownTranslating.value = false
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

async function handleTranslate(selection: Selection) {
  translationOriginal.value = selection.text
  translationTranslated.value = ''
  translationError.value = null
  translationState.value = 'loading'

  try {
    const openaiConfig = openAiConfigPayload()
    const result = await invoke<TranslationResult>('translate_text', {
      service: translationService.value,
      text: selection.text,
      ...(openaiConfig ? { openaiConfig } : {}),
    })
    translationOriginal.value = result.original
    translationTranslated.value = result.translated
    translationState.value = 'success'
  } catch (error) {
    console.error('翻译失败:', error)
    translationError.value = error instanceof Error ? error.message : String(error)
    translationState.value = 'error'
  }
}

function documentAssistantComments(): DocumentAssistantComment[] {
  return comments.list
    .filter(comment => comment.status === 'open')
    .map(comment => ({
    anchor: { quote: comment.anchor.quote },
    content: comment.content,
    status: comment.status,
    }))
}

async function runDocumentAssistant(mode: DocumentAssistantMode) {
  const sourceFile = workspace.currentFile
  if (!sourceFile || !currentIsMarkdown.value || isAssistantRunning.value || !assistantServiceReady.value) return
  const assistantComments = documentAssistantComments()
  if (mode === 'suggestions' && !assistantComments.length) return
  const permissionScope = assistantWritePermissionScope.value
  if (!permissionScope) return

  const actionLabel = mode === 'suggestions' ? '根据评论提出建议' : '优化当前文档'
  const approved = await ask(
    `将向当前模型发送“${sourceFile.path.split('/').pop() || sourceFile.path}”的完整 Markdown（${editorRef.value?.getCurrentContent().length || sourceFile.content.length} 字符）和该文件的 ${assistantComments.length} 条未解决评论，用于${actionLabel}。不会发送整个工作区，也不会自动写入文件。是否继续？`,
    { title: 'AI 读取授权', kind: 'warning' },
  )
  if (!approved) return

  isAssistantRunning.value = true
  assistantMode.value = mode
  assistantMessage.value = null
  assistantError.value = null
  assistantResult.value = null
  try {
    if (!editorRef.value) throw new Error('编辑器尚未就绪，请稍后重试')
    await editorRef.value.saveCurrentContent()

    const currentFile = workspace.currentFile
    if (!currentFile || currentFile.path !== sourceFile.path) {
      throw new Error('当前文件已切换，请重新发起 AI 操作')
    }
    const sourceContent = editorRef.value.getCurrentContent()
    const openaiConfig = openAiConfigPayload()
    const result = await invoke<DocumentAssistantResult>(
      mode === 'suggestions' ? 'suggest_document_improvements' : 'optimize_document_with_comments',
      {
        service: translationService.value,
        markdown: sourceContent,
        comments: assistantComments,
        ...(openaiConfig ? { openaiConfig } : {}),
      },
    )

    assistantResult.value = {
      mode,
      sourcePath: sourceFile.path,
      sourceContent,
      content: result.content,
      permissionScope,
    }
  } catch (error) {
    console.error('AI 文档处理失败:', error)
    assistantError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isAssistantRunning.value = false
    assistantMode.value = null
  }
}

async function applyAssistantOptimization() {
  const result = assistantResult.value
  if (!result || result.mode !== 'optimize' || isAssistantApplying.value) return
  if (!editorRef.value || workspace.currentFile?.path !== result.sourcePath) {
    assistantError.value = '当前文件已切换，不能应用这份优化稿'
    return
  }
  if (editorRef.value.getCurrentContent() !== result.sourceContent) {
    assistantError.value = '文档在 AI 处理期间已被修改，请重新生成优化稿以避免覆盖更改'
    return
  }

  const currentPermissionScope = assistantWritePermissionScope.value
  if (
    !currentPermissionScope
    || assistantWritePermissionKey(currentPermissionScope) !== assistantWritePermissionKey(result.permissionScope)
  ) {
    assistantError.value = '模型服务或文件已变更，请重新生成优化稿后再应用'
    return
  }

  if (!permanentAssistantWritePermission.value) {
    const approved = await ask(
      '即将把预览中的优化稿写入当前文件。该操作会覆盖当前文档内容，是否确认应用？',
      { title: '确认写入优化稿', kind: 'warning' },
    )
    if (!approved) return
  }

  isAssistantApplying.value = true
  assistantError.value = null
  try {
    await editorRef.value.replaceContent(result.content)
    if (workspace.folderPath && workspace.currentFile?.path === result.sourcePath) {
      await comments.loadComments(
        workspace.folderPath,
        result.sourcePath,
        workspace.currentFile.content,
      )
    }
    assistantResult.value = null
    assistantMessage.value = '已应用优化稿并保存当前文档'
  } catch (error) {
    console.error('应用优化稿失败:', error)
    assistantError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isAssistantApplying.value = false
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

function handleKeyDown(event: KeyboardEvent) {
  if (!workspace.folderPath) return

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    openSearch('content')
    return
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    openSearch('files')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)
  const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
    if (editorRef.value && !(await editorRef.value.requestDiscardChanges('close-window'))) {
      event.preventDefault()
    }
  })
  if (appUnmounted) unlisten()
  else unlistenCloseRequested = unlisten
})

onUnmounted(() => {
  appUnmounted = true
  window.removeEventListener('keydown', handleKeyDown)
  unlistenCloseRequested?.()
})
</script>
