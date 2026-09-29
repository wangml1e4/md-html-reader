<template>
  <div id="app" class="h-screen flex flex-col bg-gray-50">
    <header class="apple-global-nav shrink-0 flex items-center px-4 sm:px-6">
      <div>
        <h1 class="text-xs font-semibold tracking-tight text-white">Markdown Reader</h1>
        <p class="sr-only">{{ t('appSubtitle') }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <select
          :value="locale"
          class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white"
          :aria-label="t('language')"
          @change="changeLocale"
        >
          <option value="en">English</option>
          <option value="zh-CN">中文</option>
        </select>
        <IconButton
          icon="help"
          :label="t('quickStart')"
          class="apple-utility-button apple-nav-secondary"
          @click="showGettingStarted = true"
        />
        <IconButton v-if="workspace.folderPath" icon="connection" label="MCP" class="apple-utility-button apple-nav-secondary" @click="showMcp = !showMcp" />
        <details v-if="workspace.folderPath" class="apple-nav-document-tools relative">
          <summary class="icon-disclosure apple-utility-button cursor-pointer list-none" :title="t('documentTools')" :aria-label="t('documentTools')"><AppIcon name="tools" /><span class="sr-only">{{ t('documentTools') }}</span></summary>
          <div class="apple-modal absolute right-0 z-30 mt-2 w-[44rem] max-w-[calc(100vw-2rem)] p-4">
            <div class="flex flex-wrap gap-2">
        <IconButton
          icon="find-file"
          :label="t('findFiles')"
          @click="openSearch('files')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="isMarkdownTranslating"
        />
        <IconButton
          icon="search"
          :label="t('searchContent')"
          @click="openSearch('content')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="isMarkdownTranslating"
        />
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
        <IconButton
          icon="export"
          :label="isExporting ? t('exporting') : htmlGenerationMode === 'ai-reading' ? t('createReadingVersion') : t('exportHtml')"
          @click="generateHtml"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isExporting || (htmlGenerationMode === 'ai-reading' && !assistantServiceReady)"
          :title="htmlGenerationMode === 'ai-reading' ? assistantDisabledReason : ''"
        />
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
        <IconButton
          icon="settings"
          :label="t('modelSettings')"
          :aria-label="t('configureModel')"
          @click="openAiConfigOpen = !openAiConfigOpen"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        />
        <IconButton
          icon="comment"
          :label="isAssistantRunning && assistantMode === 'suggestions' ? t('reviewing') : t('suggestFromComments')"
          @click="runDocumentAssistant('suggestions')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || !comments.list.length || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        />
        <IconButton
          icon="improve"
          :label="isAssistantRunning && assistantMode === 'optimize' ? t('improving') : t('improveDocument')"
          @click="runDocumentAssistant('optimize')"
          class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          :disabled="!currentIsMarkdown || isAssistantRunning || !assistantServiceReady"
          :title="assistantDisabledReason"
        />
            </div>
          </div>
        </details>
        <button
          @click="openFolder"
          class="apple-primary-button disabled:opacity-50"
          :disabled="isMarkdownTranslating || isFolderOpening"
        >
          {{ isFolderOpening ? t('opening') : t('openFolder') }}
        </button>
      </div>
    </header>
    <section v-if="showMcp && workspace.folderPath" class="apple-panel p-4 border-b text-sm">
      <p>将此配置加入 MCP 客户端。仅授权当前工作区，默认只读；服务访问磁盘文件，不读取未保存草稿。</p>
      <label><input v-model="mcpWritable" type="checkbox" @change="loadMcpConfig" /> 允许客户端写入此工作区的已有文档（需匹配文件版本）</label>
      <IconButton class="ml-4" icon="config" label="生成配置" @click="loadMcpConfig" />
      <pre class="text-xs whitespace-pre-wrap">{{ mcpConfig }}</pre>
    </section>


    <div
      v-if="workspaceError || workspace.openError"
      role="alert"
      class="px-4 py-2 text-sm border-b bg-red-50 text-red-600 border-red-100"
    >
      {{ workspaceError || workspace.openError }}
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
      class="apple-panel px-4 py-3 border-b"
    >
      <div class="max-w-4xl space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-gray-800">{{ t('modelSettingsTitle') }}</div>
          <IconButton class="text-gray-500 hover:text-gray-700" icon="close" :label="t('close')" @click="openAiConfigOpen = false" />
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
          <IconButton
            icon="save"
            :label="t('saveSettings')"
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete"
            @click="saveOpenAiConfiguration"
          />
          <IconButton
            icon="link"
            :label="isTestingOpenAiConnection ? t('testing') : t('testConnection')"
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isTestingOpenAiConnection"
            @click="testOpenAiConnection"
          />
          <IconButton
            icon="refresh"
            :label="isLoadingOpenAiModels ? t('loading') : t('loadModels')"
            class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            :disabled="!openAiConnectionConfigComplete || isLoadingOpenAiModels"
            @click="loadOpenAiModels"
          />
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
          <IconButton class="underline" icon="unlock" :label="t('revokePermission')" @click="setPermanentAssistantWritePermission(false)" />
        </p>
      </div>
    </section>

    <main class="relative flex-1 flex overflow-hidden">
      <aside
        v-if="workspace.folderPath"
        v-show="!focusMode"
        class="apple-workspace-sidebar bg-white border-r border-gray-200 overflow-auto"
        :style="{ '--workspace-sidebar-width': `${workspaceSidebarWidth}px` }"
      >
        <div class="workspace-file-tools" role="toolbar" :aria-label="t('fileTools')">
          <IconButton
            icon="all-files"
            :label="t('allFiles')"
            class="workspace-file-tool"
            :class="{ 'is-active': fileFilter === 'all' }"
            :aria-pressed="fileFilter === 'all'"
            @click="fileFilter = 'all'"
          />
          <IconButton
            icon="markdown"
            :label="t('markdown')"
            class="workspace-file-tool"
            :class="{ 'is-active': fileFilter === 'markdown' }"
            :aria-pressed="fileFilter === 'markdown'"
            @click="fileFilter = 'markdown'"
          />
          <IconButton
            icon="html"
            :label="t('html')"
            class="workspace-file-tool"
            :class="{ 'is-active': fileFilter === 'html' }"
            :aria-pressed="fileFilter === 'html'"
            @click="fileFilter = 'html'"
          />
          <IconButton
            icon="locate"
            :label="t('locateCurrentFile')"
            class="workspace-file-tool"
            :disabled="!workspace.currentFile"
            @click="locateCurrentFile"
          />
          <IconButton
            icon="new-file"
            :label="t('newMarkdownFile')"
            class="workspace-file-tool"
            :disabled="isMarkdownTranslating || isCreatingMarkdown"
            @click="openCreateMarkdownDialog"
          />
          <IconButton
            icon="delete"
            :label="t('deleteMarkdownFile')"
            class="workspace-file-tool is-danger"
            :disabled="!currentIsMarkdown || isMarkdownTranslating || isDeletingMarkdown"
            @click="deleteCurrentMarkdownFile"
          />
          <IconButton
            icon="titles"
            :label="displayMode === 'filename' ? t('showTitles') : t('showFileNames')"
            class="workspace-file-tool"
            @click="toggleDisplayMode"
          />
          <IconButton
            icon="outline"
            :label="outlineOpen && currentIsMarkdown ? t('hideOutline') : t('showOutline')"
            class="workspace-file-tool"
            :aria-pressed="outlineOpen"
            :disabled="!currentIsMarkdown"
            @click="outlineOpen = !outlineOpen"
          />
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
      <div
        v-if="workspace.folderPath && !focusMode"
        class="sidebar-resize-handle sidebar-resize-handle-left"
        role="separator"
        tabindex="0"
        aria-label="调整文件侧边栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="WORKSPACE_SIDEBAR_MIN"
        :aria-valuemax="WORKSPACE_SIDEBAR_MAX"
        :aria-valuenow="workspaceSidebarWidth"
        @pointerdown="startSidebarResize('workspace', $event)"
        @keydown="resizeSidebarWithKeyboard('workspace', $event)"
      />

      <aside
        v-if="outlineOpen && currentIsMarkdown && !focusMode"
        class="w-56 bg-white border-r border-gray-200 overflow-hidden"
      >
        <DocumentOutline
          :content="workspace.currentFile?.content || ''"
          :headings="documentHeadings"
          @select="handleOutlineSelect"
        />
      </aside>

      <section class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div v-if="workspace.openingPath" role="status" class="px-4 py-2 text-sm">Opening {{ workspace.openingPath.split('/').pop() }}…</div>
        <div v-if="!workspace.folderPath" class="apple-onboarding flex-1 overflow-auto px-6 py-10 sm:px-10">
          <section class="apple-onboarding-copy mx-auto flex min-h-full flex-col justify-center">
            <p class="text-sm font-medium text-blue-700">Markdown Reader</p>
            <h2 class="apple-onboarding-title mt-3">
              {{ t('onboardingTitle') }}
            </h2>
            <p class="apple-onboarding-description mt-4 max-w-2xl">
              {{ t('onboardingDescription') }}
            </p>
            <div class="mt-7 flex flex-wrap gap-3">
              <button
                class="apple-primary-button disabled:opacity-50"
                :disabled="isFolderOpening"
                @click="openFolder"
              >
                {{ isFolderOpening ? t('openingFolder') : t('openDocumentFolder') }}
              </button>
              <button
                class="apple-secondary-button"
                @click="showGettingStarted = true"
              >
                {{ t('walkthrough') }}
              </button>
              <button
                class="px-2 py-2 text-sm text-blue-700 hover:text-blue-600"
                @click="showTrustInfo = true"
              >
                {{ t('privacyBetaNotes') }}
              </button>
            </div>
            <ol class="mt-10 grid gap-3 text-sm sm:grid-cols-3">
              <li class="apple-onboarding-step"><span class="apple-step-number">1.</span> {{ t('onboardingStepOne') }}</li>
              <li class="apple-onboarding-step"><span class="apple-step-number">2.</span> {{ t('onboardingStepTwo') }}</li>
              <li class="apple-onboarding-step"><span class="apple-step-number">3.</span> {{ t('onboardingStepThree') }}</li>
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

        <div v-else class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <nav role="tablist" aria-label="文档标签" class="flex shrink-0 overflow-x-auto border-b bg-[#fafafc] px-2 pt-2">
            <div v-for="tab in workspace.tabs" :key="tab.path" class="flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm" :class="{ 'bg-white border border-b-white border-gray-200': tab.path === workspace.currentFile?.path }">
              <button role="tab" :aria-selected="tab.path === workspace.currentFile?.path" @click="openFile(tab.path)">{{ tab.path.split('/').pop() }}{{ tab.draft !== undefined && tab.draft !== tab.content ? ' ●' : '' }}</button>
              <IconButton icon="close" :label="'关闭 ' + tab.path.split('/').pop()" @click="closeTab(tab.path)" />
            </div>
          </nav>
          <div v-for="tab in workspace.tabs" v-show="tab.path === workspace.currentFile?.path" :data-active-document="tab.path === workspace.currentFile?.path" :key="tab.path" class="flex-1 min-h-0 overflow-hidden">
            <HtmlRenderer v-if="/\.(html?|xhtml)$/i.test(tab.path)" :file="tab" />
            <YamlEditor v-else-if="/\.yaml$/i.test(tab.path)" :ref="(el: any) => setTabEditor(tab.path, el)" :file="tab" :save-content="(content: string) => saveTabFile(tab.path, content)" />
            <MarkdownDocument v-else :ref="(el: any) => setTabEditor(tab.path, el)" :file="tab" :save-content="(content: string) => saveTabFile(tab.path, content)"
              :is-markdown-translating="isMarkdownTranslating" :translation-disabled="isMarkdownTranslating || (translationService === 'openai-compatible' && !openAiConfigComplete)"
              @change="tab.draft = $event" @start-comment="handleStartComment" @translate="handleTranslate"
              @translate-chinese-copy="translateMarkdownFile"
              @headings="tabHeadings.set(tab.path, $event); tab.path === workspace.currentFile?.path && (documentHeadings = $event)" @focus="focusMode = $event" />
          </div>
        </div>
      </section>

      <div
        v-if="showDocumentSidebar"
        class="sidebar-resize-handle sidebar-resize-handle-right"
        role="separator"
        tabindex="0"
        aria-label="调整文档工具侧边栏宽度"
        aria-orientation="vertical"
        :aria-valuemin="DOCUMENT_SIDEBAR_MIN"
        :aria-valuemax="DOCUMENT_SIDEBAR_MAX"
        :aria-valuenow="documentSidebarWidth"
        @pointerdown="startSidebarResize('document', $event)"
        @keydown="resizeSidebarWithKeyboard('document', $event)"
      />
      <aside
        v-if="showDocumentSidebar"
        class="apple-document-sidebar shrink-0 overflow-hidden border-l border-gray-200 bg-white"
        :style="{ '--document-sidebar-width': `${documentSidebarWidth}px` }"
        aria-label="Document tools"
      >
        <div class="apple-document-sidebar-tabs" role="tablist" :aria-label="t('documentTools')">
          <button
            role="tab"
            class="apple-document-sidebar-tab"
            :class="{ 'is-active': activeSidebarPanel === 'comments' }"
            :aria-selected="activeSidebarPanel === 'comments'"
            @click="activeSidebarPanel = 'comments'"
          >
            {{ t('comments', { count: comments.list.length }) }}
          </button>
          <button
            role="tab"
            class="apple-document-sidebar-tab"
            :class="{ 'is-active': activeSidebarPanel === 'translation' }"
            :aria-selected="activeSidebarPanel === 'translation'"
            :disabled="translationState === 'idle'"
            @click="activeSidebarPanel = 'translation'"
          >
            {{ t('translation') }}
          </button>
        </div>
        <CommentSidebar
          v-if="activeSidebarPanel === 'comments'"
          :comments="comments.list"
          :draft="commentDraft"
          :submitting="isSubmittingComment"
          @locate="locateComment"
          @resolve="handleResolveComment"
          @delete="handleDeleteComment"
          @submit="submitComment"
          @cancel="commentDraft = null"
        />
        <TranslationCard
          v-else
          :state="translationState"
          :original="translationOriginal"
          :translated="translationTranslated"
          :service="translationService"
          :error="translationError"
          @close="closeTranslationSidebar"
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
      class="apple-modal fixed bottom-4 right-4 px-4 py-2 text-sm text-gray-800"
    >
      {{ exportMessage }}
    </div>

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

    <div v-if="showCreateMarkdown" class="apple-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" :aria-label="t('newMarkdownFile')">
      <section class="apple-modal w-full max-w-md p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-blue-700">{{ t('fileTools') }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ t('newMarkdownFile') }}</h2>
          </div>
          <IconButton class="text-slate-500 hover:text-slate-800" icon="close" :label="t('close')" @click="closeCreateMarkdownDialog" />
        </div>
        <form class="mt-6" @submit.prevent="createMarkdownFile">
          <label for="new-markdown-file-name" class="block text-sm font-medium text-slate-800">{{ t('markdownFileName') }}</label>
          <input
            id="new-markdown-file-name"
            v-model="newMarkdownName"
            class="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            :placeholder="t('markdownFileNamePlaceholder')"
            autocomplete="off"
          />
          <p class="mt-2 text-xs leading-5 text-slate-500">{{ t('newMarkdownFileHint') }}</p>
          <p v-if="newMarkdownError" class="mt-3 text-sm text-red-700" role="alert">{{ newMarkdownError }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="text-sm font-medium text-slate-600 underline underline-offset-4" @click="closeCreateMarkdownDialog">{{ t('cancel') }}</button>
            <button class="apple-primary-button" :disabled="!newMarkdownName.trim() || isCreatingMarkdown">
              {{ isCreatingMarkdown ? t('creatingMarkdownFile') : t('createMarkdownFile') }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="showGettingStarted" class="apple-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" :aria-label="t('quickStartDialog')">
      <section class="apple-modal w-full max-w-lg p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-blue-700">{{ t('quickStartLabel') }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ t('quickStartTitle') }}</h2>
          </div>
          <IconButton class="text-slate-500 hover:text-slate-800" icon="close" :label="t('close')" @click="showGettingStarted = false" />
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
          <button class="apple-primary-button" @click="showGettingStarted = false; openFolder()">{{ t('openFolder') }}</button>
        </div>
      </section>
    </div>

    <div v-if="showTrustInfo" class="apple-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" :aria-label="t('privacyDialog')">
      <section class="apple-modal w-full max-w-lg p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-blue-700">{{ t('privacyLabel') }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-900">{{ t('privacyTitle') }}</h2>
          </div>
          <IconButton class="text-slate-500 hover:text-slate-800" icon="close" :label="t('close')" @click="showTrustInfo = false" />
        </div>
        <div class="mt-5 space-y-4 text-sm leading-6 text-slate-700">
          <p>{{ t('privacyLocal') }}</p>
          <p>{{ t('privacyAi') }}</p>
          <p>{{ t('privacyBeta') }}</p>
        </div>
        <button class="apple-primary-button mt-6" @click="showTrustInfo = false">{{ t('gotIt') }}</button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from './stores/workspace'
import { useCommentsStore } from './stores/comments'
import AppIcon from './components/AppIcon.vue'
import IconButton from './components/IconButton.vue'
import FileTree from './components/FileTree.vue'
import HtmlRenderer from './components/HtmlRenderer.vue'
import YamlEditor from './components/YamlEditor.vue'
import CommentSidebar from './components/CommentSidebar.vue'
import type { OutlineHeading } from './lib/markdown/renderer'
import './styles/markdown.css'
import type { Selection } from './utils/selection'
import type { CommentAnchor } from './utils/comment-anchor'
import { locale, setLocale, t, type AppLocale } from './i18n'

const MarkdownDocument = defineAsyncComponent(() =>
  import('./components/MarkdownDocument.vue').then(module => module.default)
)
const DocumentOutline = defineAsyncComponent(() => import('./components/DocumentOutline.vue').then(module => module.default))
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
type SidebarPanel = 'comments' | 'translation'
type DocumentAssistantMode = 'suggestions' | 'optimize'
type HtmlGenerationMode = 'default' | 'ai-reading'
interface TranslationResult {
  original: string
  translated: string
  sourceLang: string
  targetLang: string
  service: TranslationService
}
interface PendingComment {
  anchor: CommentAnchor
  text: string
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
  scrollToSource?: (start: number, length: number) => void
  requestDiscardChanges: (action: 'switch-file' | 'switch-workspace' | 'close-window') => Promise<boolean>
  saveCurrentContent: () => Promise<void>
  getCurrentContent: () => string
  replaceContent: (content: string) => Promise<void>
  scrollToHeading: (text: string, level: number, line?: number) => void
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
const documentHeadings = ref<OutlineHeading[]>([])
const focusMode = ref(false)
const WORKSPACE_SIDEBAR_MIN = 208
const WORKSPACE_SIDEBAR_MAX = 416
const DOCUMENT_SIDEBAR_MIN = 288
const DOCUMENT_SIDEBAR_MAX = 560
type ResizableSidebar = 'workspace' | 'document'
const sidebarStorageKey = 'md-html-reader.sidebar-widths'
const sidebarWidths = readSidebarWidths()
const workspaceSidebarWidth = ref(sidebarWidths.workspace)
const documentSidebarWidth = ref(sidebarWidths.document)
let removeSidebarResizeListeners: (() => void) | null = null
const activeSidebarPanel = ref<SidebarPanel>('comments')
const commentDraft = ref<PendingComment | null>(null)
watch(() => workspace.currentFile?.path, path => {
  documentHeadings.value = path ? tabHeadings.get(path) || [] : []
  focusMode.value = false
  commentDraft.value = null
  resetTranslationSidebar()
  activeSidebarPanel.value = 'comments'
})
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
const isSubmittingComment = ref(false)
let translationRequest = 0
const isExporting = ref(false)
const showMcp = ref(false), mcpWritable = ref(false), mcpConfig = ref('')
async function loadMcpConfig() {
  try { mcpConfig.value = JSON.stringify(await invoke('mcp_configuration', { workspacePath: workspace.folderPath, allowWrite: mcpWritable.value }), null, 2) }
  catch (error) { mcpConfig.value = String(error) }
}
const exportMessage = ref<string | null>(null)
const isMarkdownTranslating = ref(false)
const markdownTranslationMessage = ref<string | null>(null)
const markdownTranslationError = ref<string | null>(null)
const isFolderOpening = ref(false)
const workspaceError = ref<string | null>(null)
const showCreateMarkdown = ref(false)
const newMarkdownName = ref('')
const newMarkdownError = ref<string | null>(null)
const isCreatingMarkdown = ref(false)
const isDeletingMarkdown = ref(false)
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
const showDocumentSidebar = computed(() => {
  return Boolean(
    workspace.currentFile
    && !focusMode.value
    && (comments.list.length > 0 || commentDraft.value || translationState.value !== 'idle')
  )
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

function readSidebarWidths() {
  const fallback = { workspace: 256, document: 352 }
  try {
    const stored = JSON.parse(window.localStorage.getItem(sidebarStorageKey) || '')
    return {
      workspace: clampSidebarWidth(stored.workspace, WORKSPACE_SIDEBAR_MIN, WORKSPACE_SIDEBAR_MAX, fallback.workspace),
      document: clampSidebarWidth(stored.document, DOCUMENT_SIDEBAR_MIN, DOCUMENT_SIDEBAR_MAX, fallback.document),
    }
  } catch {
    return fallback
  }
}

function clampSidebarWidth(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
}

function persistSidebarWidths() {
  try {
    window.localStorage.setItem(sidebarStorageKey, JSON.stringify({ workspace: workspaceSidebarWidth.value, document: documentSidebarWidth.value }))
  } catch {
    // Keep the active-session widths when browser storage is unavailable.
  }
}

function resizeSidebar(kind: ResizableSidebar, width: number) {
  if (kind === 'workspace') {
    workspaceSidebarWidth.value = clampSidebarWidth(width, WORKSPACE_SIDEBAR_MIN, WORKSPACE_SIDEBAR_MAX, workspaceSidebarWidth.value)
  } else {
    documentSidebarWidth.value = clampSidebarWidth(width, DOCUMENT_SIDEBAR_MIN, DOCUMENT_SIDEBAR_MAX, documentSidebarWidth.value)
  }
}

function startSidebarResize(kind: ResizableSidebar, event: PointerEvent) {
  if (event.button !== 0) return
  removeSidebarResizeListeners?.()
  event.preventDefault()
  const startX = event.clientX
  const startWidth = kind === 'workspace' ? workspaceSidebarWidth.value : documentSidebarWidth.value
  const onMove = (move: PointerEvent) => resizeSidebar(kind, startWidth + (kind === 'workspace' ? move.clientX - startX : startX - move.clientX))
  const onEnd = () => {
    removeSidebarResizeListeners?.()
    persistSidebarWidths()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onEnd, { once: true })
  removeSidebarResizeListeners = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onEnd)
    removeSidebarResizeListeners = null
  }
}

function resizeSidebarWithKeyboard(kind: ResizableSidebar, event: KeyboardEvent) {
  const increase = kind === 'workspace' ? 'ArrowRight' : 'ArrowLeft'
  const decrease = kind === 'workspace' ? 'ArrowLeft' : 'ArrowRight'
  const min = kind === 'workspace' ? WORKSPACE_SIDEBAR_MIN : DOCUMENT_SIDEBAR_MIN
  const max = kind === 'workspace' ? WORKSPACE_SIDEBAR_MAX : DOCUMENT_SIDEBAR_MAX
  const current = kind === 'workspace' ? workspaceSidebarWidth.value : documentSidebarWidth.value
  if (event.key === 'Home') resizeSidebar(kind, min)
  else if (event.key === 'End') resizeSidebar(kind, max)
  else if (event.key === increase) resizeSidebar(kind, current + 16)
  else if (event.key === decrease) resizeSidebar(kind, current - 16)
  else return
  event.preventDefault()
  persistSidebarWidths()
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

async function loadOpenAiApiKey() {
  try {
    openAiApiKey.value = (await invoke<string | null>('load_openai_api_key')) || ''
  } catch {
    // Keep the empty field when the user configuration file is unavailable.
  }
}

async function persistOpenAiApiKey() {
  try {
    const apiKey = openAiApiKey.value.trim()
    if (!apiKey) return
    await invoke('save_openai_api_key', { apiKey })
    openAiConfigError.value = null
  } catch (error) {
    openAiConfigError.value = error instanceof Error ? error.message : String(error)
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

async function saveOpenAiConfiguration() {
  try {
    openAiConnectionPayload()
    persistOpenAiSettings()
    await persistOpenAiApiKey()
    if (openAiConfigError.value) return
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
      model: openAiModel.value.trim(),
      apiKey,
      verifyChat: false,
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

    if (!(await protectTabs('switch-workspace'))) return
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

const tabEditors = new Map<string, NonNullable<typeof editorRef.value>>()
const tabHeadings = new Map<string, OutlineHeading[]>()
function setTabEditor(path: string, editor: NonNullable<typeof editorRef.value> | null) {
  if (editor) tabEditors.set(path, editor)
  else { tabEditors.delete(path); tabHeadings.delete(path) }
  if (workspace.currentFile?.path === path) editorRef.value = editor
}
async function protectTabs(action: 'switch-workspace' | 'close-window') {
  for (const editor of tabEditors.values()) if (!(await editor.requestDiscardChanges(action))) return false
  return true
}
async function closeTab(path: string) {
  if (isMarkdownTranslating.value) return
  const editor = tabEditors.get(path)
  if (editor && !(await editor.requestDiscardChanges('switch-file'))) return
  workspace.closeTab(path); tabEditors.delete(path); tabHeadings.delete(path)
  const current = workspace.currentFile
  editorRef.value = current ? tabEditors.get(current.path) || null : null
  documentHeadings.value = current ? tabHeadings.get(current.path) || [] : []
  if (current && workspace.folderPath) await comments.loadComments(workspace.folderPath, current.path, current.content)
  else comments.clearCurrentFile()
}

async function openFile(filePath: string) {
  if (isMarkdownTranslating.value) return
  if (!workspace.folderPath) return
  if (workspace.currentFile?.path === filePath) return

  if (!(await workspace.openFile(filePath))) return
  editorRef.value = tabEditors.get(filePath) || null
  documentHeadings.value = tabHeadings.get(filePath) || []
  await comments.loadComments(workspace.folderPath, filePath, workspace.currentFile?.content)
}

function openCreateMarkdownDialog() {
  if (!workspace.folderPath || isMarkdownTranslating.value) return
  newMarkdownName.value = ''
  newMarkdownError.value = null
  showCreateMarkdown.value = true
}

function closeCreateMarkdownDialog() {
  if (isCreatingMarkdown.value) return
  showCreateMarkdown.value = false
  newMarkdownError.value = null
}

async function createMarkdownFile() {
  const workspacePath = workspace.folderPath
  const name = newMarkdownName.value.trim()
  if (!workspacePath || !name || isCreatingMarkdown.value) return

  isCreatingMarkdown.value = true
  newMarkdownError.value = null
  try {
    const filePath = await invoke<string>('create_markdown_file', { workspacePath, name })
    if (!(await workspace.refreshFiles())) throw new Error(t('refreshFiles'))
    showCreateMarkdown.value = false
    await openFile(filePath)
  } catch (error) {
    newMarkdownError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isCreatingMarkdown.value = false
  }
}

async function deleteCurrentMarkdownFile() {
  const currentFile = workspace.currentFile
  const workspacePath = workspace.folderPath
  if (!currentFile || !workspacePath || !currentIsMarkdown.value || isDeletingMarkdown.value) return

  const fileName = currentFile.path.split('/').pop() || currentFile.path
  const approved = isE2E
    ? confirm(t('deleteMarkdownConfirm', { name: fileName }))
    : await ask(t('deleteMarkdownConfirm', { name: fileName }), { title: t('deleteMarkdownFile'), kind: 'warning' })
  if (!approved) return

  const editor = tabEditors.get(currentFile.path)
  if (editor && !(await editor.requestDiscardChanges('switch-file'))) return

  isDeletingMarkdown.value = true
  try {
    await invoke('delete_markdown_file', { workspacePath, path: currentFile.path })
    workspace.closeTab(currentFile.path)
    tabEditors.delete(currentFile.path)
    tabHeadings.delete(currentFile.path)
    const nextFile = workspace.currentFile
    editorRef.value = nextFile ? tabEditors.get(nextFile.path) || null : null
    documentHeadings.value = nextFile ? tabHeadings.get(nextFile.path) || [] : []
    if (nextFile) await comments.loadComments(workspacePath, nextFile.path, nextFile.content)
    else comments.clearCurrentFile()
    if (!(await workspace.refreshFiles())) workspaceError.value = t('refreshFiles')
  } catch (error) {
    workspaceError.value = t('deleteMarkdownFailed', {
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    isDeletingMarkdown.value = false
  }
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

function locateComment(id: string) {
  const comment = comments.list.find(item => item.id === id)
  if (comment) editorRef.value?.scrollToSource?.(comment.anchor.offset, comment.anchor.length)
}
function handleOutlineSelect(heading: OutlineHeading) {
  editorRef.value?.scrollToHeading?.(heading.text, heading.level, heading.line)
}

async function saveTabFile(filePath: string, content: string) {
  const folderPath = workspace.folderPath
  await workspace.saveFile(filePath, content)
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
  if (!(await workspace.refreshFiles())) {
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
  const sourceEditor = editorRef.value
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

    await sourceEditor?.saveCurrentContent()
    const sourceContent = sourceEditor?.getCurrentContent() ?? sourceFile.content

    const { exportMarkdown } = await import('./lib/markdown/export')
    const html = await exportMarkdown(sourceContent, sourceFile.path, workspacePath, includeMarkdownSource.value)
    await invoke('export_rendered_html', { workspacePath, outputPath, html })
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

    if (!(await workspace.refreshFiles())) {
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

function handleStartComment(anchor: CommentAnchor, text: string) {
  focusMode.value = false
  commentDraft.value = { anchor, text }
  activeSidebarPanel.value = 'comments'
}

async function handleCreateComment(anchor: CommentAnchor, content: string) {
  if (!workspace.currentFile) return false

  try {
    await comments.saveComment({
      fileHash: comments.currentFileHash!,
      anchor,
      content,
      status: 'open',
    })

    console.log('Comment created')
    return true
  } catch (error) {
    console.error('Failed to create comment:', error)
    return false
  }
}

async function submitComment(content: string) {
  const draft = commentDraft.value
  if (!draft || isSubmittingComment.value) return

  isSubmittingComment.value = true
  try {
    if (await handleCreateComment(draft.anchor, content)) {
      commentDraft.value = null
    }
  } finally {
    isSubmittingComment.value = false
  }
}

async function handleTranslate(selection: Selection) {
  focusMode.value = false
  const request = ++translationRequest
  activeSidebarPanel.value = 'translation'
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
    if (request !== translationRequest) return
    translationOriginal.value = result.original
    translationTranslated.value = result.translated
    translationState.value = 'success'
  } catch (error) {
    if (request !== translationRequest) return
    console.error('Translation failed:', error)
    translationError.value = error instanceof Error ? error.message : String(error)
    translationState.value = 'error'
  }
}

function closeTranslationSidebar() {
  resetTranslationSidebar()
  activeSidebarPanel.value = 'comments'
}

function resetTranslationSidebar() {
  translationRequest += 1
  translationState.value = 'idle'
  translationOriginal.value = ''
  translationTranslated.value = ''
  translationError.value = null
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
  void loadOpenAiApiKey()
  const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
    if (!(await protectTabs('close-window'))) {
      event.preventDefault()
    }
  })
  if (appUnmounted) unlisten()
  else unlistenCloseRequested = unlisten
})

onUnmounted(() => {
  appUnmounted = true
  removeSidebarResizeListeners?.()
  window.removeEventListener('keydown', handleKeyDown)
  unlistenCloseRequested?.()
})
</script>
