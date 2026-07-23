<template>
  <div id="app" class="h-screen flex flex-col bg-gray-50">
    <header class="h-14 bg-white border-b border-gray-200 flex items-center px-4">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">MD+HTML Reader</h1>
        <p class="text-xs text-gray-500">{{ t('appSubtitle') }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <select
          :value="locale"
          class="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
          :aria-label="t('language')"
          @change="changeLocale"
        >
          <option value="en">English</option>
          <option value="zh-CN">中文</option>
        </select>
        <button
          class="px-3 py-1 text-sm text-gray-600 rounded hover:bg-gray-100"
          :aria-label="t('quickStart')"
          @click="showGettingStarted = true"
        >
          {{ t('quickStart') }}
        </button>
        <details v-if="workspace.folderPath" class="relative">
          <summary class="cursor-pointer list-none px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            {{ t('documentTools') }}
          </summary>
          <div class="absolute right-0 z-30 mt-2 w-[44rem] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
            <div class="flex flex-wrap gap-2">
        <button
          @click="openSearch('files')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="isMarkdownTranslating"
        >
          {{ t('findFiles') }}
        </button>
        <button
          @click="openSearch('content')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="isMarkdownTranslating"
        >
          {{ t('searchContent') }}
        </button>
        <select
          v-model="htmlGenerationMode"
          class="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
          :aria-label="t('htmlExportMode')"
        >
          <option value="default">{{ t('htmlExport') }}</option>
          <option value="ai-reading">{{ t('aiReadingVersion') }}</option>
        </select>
        <label
          class="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 bg-gray-100 rounded disabled:opacity-50"
          :title="t('includeMarkdownTitle')"
        >
          <input
            v-model="includeMarkdownSource"
            type="checkbox"
            :aria-label="t('includeSourceMarkdown')"
            :disabled="!currentIsMarkdown || isExporting"
          />
          {{ t('includeMarkdown') }}
        </label>
        <button
          @click="generateHtml"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isExporting || (htmlGenerationMode === 'ai-reading' && !assistantServiceReady)"
          :title="htmlGenerationMode === 'ai-reading' ? assistantDisabledReason : ''"
        >
          {{ isExporting ? t('exporting') : htmlGenerationMode === 'ai-reading' ? t('createReadingVersion') : t('exportHtml') }}
        </button>
        <select
          v-model="translationService"
          @change="handleTranslationServiceChange"
          class="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
          :aria-label="t('translationService')"
        >
          <option value="ollama">Ollama</option>
          <option value="tencent">Tencent Translate</option>
          <option value="openai-compatible">OpenAI-compatible</option>
        </select>
        <button
          @click="openAiConfigOpen = !openAiConfigOpen"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          :aria-label="t('configureModel')"
        >
          {{ t('modelSettings') }}
        </button>
        <button
          @click="translateMarkdownFile"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isMarkdownTranslating || (translationService === 'openai-compatible' && !openAiConfigComplete)"
        >
          {{ isMarkdownTranslating ? t('translating') : t('translateChineseCopy') }}
        </button>
        <button
          @click="runDocumentAssistant('suggestions')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || !comments.list.length || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        >
          {{ isAssistantRunning && assistantMode === 'suggestions' ? t('reviewing') : t('suggestFromComments') }}
        </button>
        <button
          @click="runDocumentAssistant('optimize')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        >
          {{ isAssistantRunning && assistantMode === 'optimize' ? t('improving') : t('improveDocument') }}
        </button>
            </div>
          </div>
        </details>
        <button
          @click="openFolder"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          :disabled="isMarkdownTranslating || isFolderOpening"
        >
          {{ isFolderOpening ? t('opening') : t('openFolder') }}
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
      :aria-label="t('modelSettingsTitle')"
      class="px-4 py-3 bg-white border-b border-gray-200"
    >
      <div class="max-w-4xl space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-gray-800">{{ t('modelSettingsTitle') }}</div>
          <button class="text-xs text-gray-500 hover:text-gray-700" @click="openAiConfigOpen = false">{{ t('close') }}</button>
        </div>
        <div class="grid gap-2 md:grid-cols-3">
          <label class="text-xs text-gray-600">
            {{ t('baseUrl') }}
            <input
              v-model.trim="openAiBaseUrl"
              @change="persistOpenAiSettings"
              class="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded"
              placeholder="https://api.deepseek.com/v1"
              autocomplete="url"
            />
          </label>
          <label class="text-xs text-gray-600">
            {{ t('model') }}
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
            {{ t('apiKey') }}
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
            {{ t('saveSettings') }}
          </button>
          <button
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isTestingOpenAiConnection"
            @click="testOpenAiConnection"
          >
            {{ isTestingOpenAiConnection ? t('testing') : t('testConnection') }}
          </button>
          <button
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isLoadingOpenAiModels"
            @click="loadOpenAiModels"
          >
            {{ isLoadingOpenAiModels ? t('loading') : t('loadModels') }}
          </button>
        </div>
        <p class="text-xs text-gray-500">
          {{ t('modelSettingsHelp') }}
        </p>
        <p v-if="openAiConfigError" class="text-xs text-red-600">{{ openAiConfigError }}</p>
        <p v-else-if="openAiConfigMessage" class="text-xs text-green-700">{{ openAiConfigMessage }}</p>
        <p v-if="translationService === 'openai-compatible' && !openAiConfigComplete" class="text-xs text-red-600">
          {{ t('enterModelDetails') }}
        </p>
        <p v-if="permanentAssistantWritePermission" class="text-xs text-amber-700">
          {{ t('permanentPermission', { scope: assistantWritePermissionScopeLabel }) }}
          <button class="underline" @click="setPermanentAssistantWritePermission(false)">{{ t('revokePermission') }}</button>
        </p>
      </div>
    </section>

    <main class="flex-1 flex overflow-hidden">
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
              {{ t('allFiles') }}
            </button>
            <button
              class="px-2 py-1 text-xs rounded"
              :class="fileFilter === 'markdown' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="fileFilter = 'markdown'"
            >
              {{ t('markdown') }}
            </button>
            <button
              class="px-2 py-1 text-xs rounded"
              :class="fileFilter === 'html' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'"
              @click="fileFilter = 'html'"
            >
              {{ t('html') }}
            </button>
          </div>
          <div class="flex gap-1">
            <button
              class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              :disabled="!workspace.currentFile"
              @click="locateCurrentFile"
            >
              {{ t('locateCurrentFile') }}
            </button>
            <button
              class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              @click="toggleDisplayMode"
            >
              {{ displayMode === 'filename' ? t('showTitles') : t('showFileNames') }}
            </button>
          </div>
          <button
            class="w-full px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!currentIsMarkdown"
            @click="outlineOpen = !outlineOpen"
          >
            {{ outlineOpen && currentIsMarkdown ? t('hideOutline') : t('showOutline') }}
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

      <section class="flex-1 flex flex-col">
        <div v-if="!workspace.folderPath" class="flex-1 overflow-auto bg-slate-50 p-6 sm:p-10">
          <section class="mx-auto flex min-h-full max-w-4xl flex-col justify-center">
            <p class="text-sm font-medium text-blue-700">MD+HTML Reader</p>
            <h2 class="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {{ t('onboardingTitle') }}
            </h2>
            <p class="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {{ t('onboardingDescription') }}
            </p>
            <div class="mt-7 flex flex-wrap gap-3">
              <button
                class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                :disabled="isFolderOpening"
                @click="openFolder"
              >
                {{ isFolderOpening ? t('openingFolder') : t('openDocumentFolder') }}
              </button>
              <button
                class="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                @click="showGettingStarted = true"
              >
                {{ t('walkthrough') }}
              </button>
              <button
                class="px-2 py-2 text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
                @click="showTrustInfo = true"
              >
                {{ t('privacyBetaNotes') }}
              </button>
            </div>
            <ol class="mt-10 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              <li class="rounded-lg border border-slate-200 bg-white p-4"><span class="font-semibold text-blue-700">1.</span> {{ t('onboardingStepOne') }}</li>
              <li class="rounded-lg border border-slate-200 bg-white p-4"><span class="font-semibold text-blue-700">2.</span> {{ t('onboardingStepTwo') }}</li>
              <li class="rounded-lg border border-slate-200 bg-white p-4"><span class="font-semibold text-blue-700">3.</span> {{ t('onboardingStepThree') }}</li>
            </ol>
          </section>
        </div>

        <div v-else-if="!workspace.currentFile" class="flex-1 flex items-center justify-center p-6 text-gray-500">
          <div class="max-w-sm text-center">
            <p class="text-xl font-semibold text-gray-800">{{ t('chooseDocument') }}</p>
            <p class="mt-2 text-sm">{{ t('chooseDocumentDescription') }}</p>
            <button class="mt-4 text-sm font-medium text-blue-700 underline underline-offset-4" @click="showGettingStarted = true">{{ t('openQuickStart') }}</button>
          </div>
        </div>

        <div v-else class="flex-1 overflow-hidden">
          <HtmlRenderer
            v-if="currentIsHtml"
            :key="workspace.currentFile.path"
            :file="workspace.currentFile"
          />

          <YamlEditor
            v-else-if="currentIsYaml"
            ref="editorRef"
            :key="workspace.currentFile.path"
            :file="workspace.currentFile"
            :save-content="saveFile"
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

    <div v-if="showGettingStarted" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6" role="dialog" aria-modal="true" :aria-label="t('quickStartDialog')">
      <section class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-blue-700">{{ t('quickStartLabel') }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ t('quickStartTitle') }}</h2>
          </div>
          <button class="text-sm text-slate-500 hover:text-slate-800" @click="showGettingStarted = false">{{ t('close') }}</button>
        </div>
        <ol class="mt-5 space-y-4 text-sm leading-6 text-slate-700">
          <li><strong>1.</strong> {{ t('quickStartStepOne') }}</li>
          <li><strong>2.</strong> {{ t('quickStartStepTwo') }}</li>
          <li><strong>3.</strong> {{ t('quickStartStepThree') }}</li>
        </ol>
        <p class="mt-5 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          {{ t('quickStartNote') }}
        </p>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button class="text-sm font-medium text-slate-600 underline underline-offset-4" @click="showTrustInfo = true">{{ t('privacyBetaNotes') }}</button>
          <button class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" @click="showGettingStarted = false; openFolder()">{{ t('openFolder') }}</button>
        </div>
      </section>
    </div>

    <div v-if="showTrustInfo" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-6" role="dialog" aria-modal="true" :aria-label="t('privacyDialog')">
      <section class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-blue-700">{{ t('privacyLabel') }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ t('privacyTitle') }}</h2>
          </div>
          <button class="text-sm text-slate-500 hover:text-slate-800" @click="showTrustInfo = false">{{ t('close') }}</button>
        </div>
        <div class="mt-5 space-y-4 text-sm leading-6 text-slate-700">
          <p>{{ t('privacyLocal') }}</p>
          <p>{{ t('privacyAi') }}</p>
          <p>{{ t('privacyBeta') }}</p>
        </div>
        <button class="mt-6 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" @click="showTrustInfo = false">{{ t('gotIt') }}</button>
      </section>
    </div>
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
import YamlEditor from './components/YamlEditor.vue'
import CommentSidebar from './components/CommentSidebar.vue'
import DocumentOutline from './components/DocumentOutline.vue'
import type { Selection } from './utils/selection'
import { locale, setLocale, t, type AppLocale } from './i18n'

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
type HtmlGenerationMode = 'default' | 'ai-reading'
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
interface AiReadingHtmlResult {
  outputPath: string
  summaryCharacters: number
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
const showGettingStarted = ref(false)
const showTrustInfo = ref(false)
const showSearchPanel = ref(false)
const searchMode = ref<SearchMode>('files')
const fileFilter = ref<FileFilter>('all')
const displayMode = ref<DisplayMode>('filename')
const locateToken = ref(0)
const outlineOpen = ref(false)
const editorRef = ref<EditorHandle | null>(null)
const translationService = ref<TranslationService>('ollama')
const htmlGenerationMode = ref<HtmlGenerationMode>('default')
const includeMarkdownSource = ref(false)
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
const currentIsYaml = computed(() => {
  return workspace.currentFile?.path.toLowerCase().endsWith('.yaml') || false
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
  if (translationService.value === 'tencent') return t('aiAssistantTencent')
  if (translationService.value === 'openai-compatible' && !openAiConfigComplete.value) {
    return t('enterModelFirst')
  }
  if (!currentIsMarkdown.value) return t('requiresMarkdown')
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

function changeLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  setLocale(value === 'zh-CN' ? 'zh-CN' : 'en' as AppLocale)
}

function describeAssistantWritePermissionScope(scope: AssistantWritePermissionScope | null) {
  if (!scope) return t('thisDocumentModel')
  const fileName = scope.filePath.split('/').pop() || scope.filePath
  const modelName = scope.model.split('|').slice(-1)[0] || ''
  const serviceName = scope.service === 'openai-compatible'
    ? t('openAiModel', { model: modelName })
    : t('defaultOllamaModel')
  return t('scopeLabel', { file: fileName, service: serviceName })
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
    // Keep settings for this session when browser storage is unavailable.
  }
}

function openAiConnectionPayload() {
  const baseUrl = openAiBaseUrl.value.trim()
  const apiKey = openAiApiKey.value.trim()
  if (!baseUrl || !apiKey) {
    throw new Error(t('enterBaseUrlApiKey'))
  }
  return { baseUrl, apiKey }
}

function saveOpenAiConfiguration() {
  try {
    openAiConnectionPayload()
    persistOpenAiSettings()
    openAiConfigError.value = null
    openAiConfigMessage.value = t('settingsSaved')
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
    openAiConfigMessage.value = t('connectedModels', { count: result.modelCount })
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
      ? t('modelsLoaded', { count: models.length })
      : t('noModels')
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
    // Keep permission for this session when browser storage is unavailable.
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
          title: t('chooseWorkspaceFolder'),
          defaultPath: workspace.folderPath || undefined,
        })

    const selectedPath = Array.isArray(selected) ? selected[0] : selected
    if (!selectedPath) return

    if (editorRef.value && !(await editorRef.value.requestDiscardChanges('switch-workspace'))) return
    if (!(await workspace.loadFolder(selectedPath))) {
      throw new Error(t('folderReadError'))
    }
    comments.clearCurrentFile()
  } catch (error) {
    console.error('Failed to open folder:', error)
    const message = error instanceof Error ? error.message : String(error)
    workspaceError.value = t('couldNotOpenFolder', { message })
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

async function saveMarkdownBeforeHtmlGeneration(sourcePath: string) {
  if (editorRef.value?.saveCurrentContent) {
    await editorRef.value.saveCurrentContent()
  }
  if (workspace.currentFile?.path !== sourcePath) {
    throw new Error(t('currentFileChanged'))
  }
}

async function openGeneratedHtml(workspacePath: string, outputPath: string) {
  if (!(await workspace.loadFolder(workspacePath))) {
    throw new Error(t('refreshFiles'))
  }
  comments.clearCurrentFile()
  if (!(await workspace.openFile(outputPath))) {
    throw new Error(t('couldNotOpenHtml'))
  }
}

async function generateHtml() {
  if (htmlGenerationMode.value === 'ai-reading') {
    await generateAiReadingHtml()
    return
  }
  await exportHtml()
}

async function exportHtml() {
  const workspacePath = workspace.folderPath
  const sourceFile = workspace.currentFile
  if (!workspacePath || !sourceFile || !currentIsMarkdown.value) return

  isExporting.value = true
  exportMessage.value = null
  try {
    await saveMarkdownBeforeHtmlGeneration(sourceFile.path)
    const defaultPath = sourceFile.path.replace(/\.[^/.]+$/, '.html')
    const outputPath = isE2E
      ? e2eExportPath
      : await save({
          defaultPath,
          filters: [{ name: 'HTML', extensions: ['html'] }],
        })

    if (!outputPath || typeof outputPath !== 'string') return

    await invoke('export_as_html', {
      workspacePath,
      filePath: sourceFile.path,
      outputPath,
      cssContent: null,
      includeMarkdownSource: includeMarkdownSource.value,
    })
    await openGeneratedHtml(workspacePath, outputPath)
    exportMessage.value = t('htmlCreated')
  } catch (error) {
    console.error('Failed to export HTML:', error)
    const message = error instanceof Error ? error.message : String(error)
    exportMessage.value = message.includes('路径不在已授权工作区内')
      ? t('exportLocationWorkspace')
      : t('htmlExportFailed', { message })
  } finally {
    isExporting.value = false
  }
}

async function generateAiReadingHtml() {
  const workspacePath = workspace.folderPath
  const sourceFile = workspace.currentFile
  if (!workspacePath || !sourceFile || !currentIsMarkdown.value || !assistantServiceReady.value) return

  const approved = await ask(
    t('aiReadingConfirm', {
      file: sourceFile.path.split('/').pop() || sourceFile.path,
      count: editorRef.value?.getCurrentContent().length || sourceFile.content.length,
      markdown: includeMarkdownSource.value ? t('aiReadingIncludesMarkdown') : '',
    }),
    { title: t('allowAiReading'), kind: 'warning' },
  )
  if (!approved) return

  isExporting.value = true
  exportMessage.value = null
  try {
    await saveMarkdownBeforeHtmlGeneration(sourceFile.path)
    const openaiConfig = openAiConfigPayload()
    const result = await invoke<AiReadingHtmlResult>('generate_ai_reading_html', {
      service: translationService.value,
      workspacePath,
      filePath: sourceFile.path,
      includeMarkdownSource: includeMarkdownSource.value,
      ...(openaiConfig ? { openaiConfig } : {}),
    })
    await openGeneratedHtml(workspacePath, result.outputPath)
    exportMessage.value = t('aiReadingCreated', { count: result.summaryCharacters })
  } catch (error) {
    console.error('Failed to create AI reading version:', error)
    const message = error instanceof Error ? error.message : String(error)
    exportMessage.value = t('aiReadingFailed', { message })
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
      throw new Error(t('editorNotReady'))
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
      throw new Error(t('refreshFiles'))
    }
    comments.clearCurrentFile()
    if (!(await workspace.openFile(result.outputPath))) {
      throw new Error(t('couldNotOpenChineseCopy'))
    }
    await comments.loadComments(
      workspacePath,
      result.outputPath,
      workspace.currentFile?.content
    )

    const outputName = result.outputPath.split('/').pop() || result.outputPath
    markdownTranslationMessage.value = t('chineseCopyCreated', { name: outputName })
  } catch (error) {
    console.error('Failed to create Chinese translation copy:', error)
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

    console.log('Comment created')
  } catch (error) {
    console.error('Failed to create comment:', error)
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
    console.error('Translation failed:', error)
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

  const actionLabel = mode === 'suggestions' ? t('suggestImprovements') : t('improveCurrentDocument')
  const approved = await ask(
    t('assistantConfirm', {
      file: sourceFile.path.split('/').pop() || sourceFile.path,
      count: editorRef.value?.getCurrentContent().length || sourceFile.content.length,
      comments: assistantComments.length,
      action: actionLabel,
    }),
    { title: t('allowAiAccess'), kind: 'warning' },
  )
  if (!approved) return

  isAssistantRunning.value = true
  assistantMode.value = mode
  assistantMessage.value = null
  assistantError.value = null
  assistantResult.value = null
  try {
    if (!editorRef.value) throw new Error(t('editorNotReady'))
    await editorRef.value.saveCurrentContent()

    const currentFile = workspace.currentFile
    if (!currentFile || currentFile.path !== sourceFile.path) {
      throw new Error(t('currentFileChangedStartAgain'))
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
    console.error('AI document action failed:', error)
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
    assistantError.value = t('draftCannotApply')
    return
  }
  if (editorRef.value.getCurrentContent() !== result.sourceContent) {
    assistantError.value = t('documentChangedDraft')
    return
  }

  const currentPermissionScope = assistantWritePermissionScope.value
  if (
    !currentPermissionScope
    || assistantWritePermissionKey(currentPermissionScope) !== assistantWritePermissionKey(result.permissionScope)
  ) {
    assistantError.value = t('serviceFileChanged')
    return
  }

  if (!permanentAssistantWritePermission.value) {
    const approved = await ask(
      t('applyDraftConfirm'),
      { title: t('confirmApply'), kind: 'warning' },
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
    assistantMessage.value = t('aiDraftApplied')
  } catch (error) {
    console.error('Failed to apply AI draft:', error)
    assistantError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isAssistantApplying.value = false
  }
}

async function handleResolveComment(commentId: string) {
  workspaceError.value = null
  try {
    await comments.updateCommentStatus(commentId, 'resolved')
  } catch (error) {
    console.error('Failed to resolve comment:', error)
    const message = error instanceof Error ? error.message : String(error)
    workspaceError.value = t('couldNotResolveComment', { message })
  }
}

async function handleDeleteComment(commentId: string) {
  try {
    await comments.deleteComment(commentId)
  } catch (error) {
    console.error('Failed to delete comment:', error)
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
