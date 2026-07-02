/**
 * 全局快捷键系统
 */

export type ShortcutHandler = () => void | Promise<void>

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  handler: ShortcutHandler
}

class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map()
  private isListening = false

  register(config: ShortcutConfig) {
    const key = this.normalizeKey(config)
    this.shortcuts.set(key, config)
  }

  unregister(key: string) {
    this.shortcuts.delete(this.normalizeKeyString(key))
  }

  start() {
    if (this.isListening) return

    document.addEventListener('keydown', this.handleKeyDown)
    this.isListening = true
  }

  stop() {
    document.removeEventListener('keydown', this.handleKeyDown)
    this.isListening = false
  }

  getAll(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values())
  }

  private handleKeyDown = async (e: KeyboardEvent) => {
    const key = this.getKeyFromEvent(e)
    const config = this.shortcuts.get(key)

    if (config) {
      // 阻止默认行为（如 Cmd+S 保存页面）
      e.preventDefault()
      e.stopPropagation()

      try {
        await config.handler()
      } catch (error) {
        console.error('快捷键处理失败:', error)
      }
    }
  }

  private normalizeKey(config: ShortcutConfig): string {
    const parts: string[] = []

    if (config.ctrl) parts.push('Ctrl')
    if (config.shift) parts.push('Shift')
    if (config.alt) parts.push('Alt')
    if (config.meta) parts.push('Meta')
    parts.push(config.key.toUpperCase())

    return parts.join('+')
  }

  private normalizeKeyString(key: string): string {
    return key.toUpperCase()
  }

  private getKeyFromEvent(e: KeyboardEvent): string {
    const parts: string[] = []

    if (e.ctrlKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    if (e.metaKey) parts.push('Meta')
    parts.push(e.key.toUpperCase())

    return parts.join('+')
  }
}

export const shortcutManager = new ShortcutManager()

/**
 * 预定义的快捷键
 */
export const defaultShortcuts = {
  // 文件操作
  save: {
    key: 's',
    meta: true,
    description: '保存当前文件',
  },
  newFile: {
    key: 'n',
    meta: true,
    description: '新建文件',
  },
  closeFile: {
    key: 'w',
    meta: true,
    description: '关闭当前文件',
  },
  openFolder: {
    key: 'o',
    meta: true,
    description: '打开文件夹',
  },

  // 搜索
  quickOpen: {
    key: 'p',
    meta: true,
    description: '快速打开文件',
  },
  searchContent: {
    key: 'f',
    meta: true,
    shift: true,
    description: '搜索文件内容',
  },

  // 编辑
  undo: {
    key: 'z',
    meta: true,
    description: '撤销',
  },
  redo: {
    key: 'z',
    meta: true,
    shift: true,
    description: '重做',
  },

  // 评论
  addComment: {
    key: 'm',
    meta: true,
    description: '添加评论',
  },

  // 导航
  nextFile: {
    key: 'ArrowDown',
    meta: true,
    description: '下一个文件',
  },
  prevFile: {
    key: 'ArrowUp',
    meta: true,
    description: '上一个文件',
  },

  // 视图
  toggleSidebar: {
    key: 'b',
    meta: true,
    description: '切换侧边栏',
  },
  toggleComments: {
    key: 'c',
    meta: true,
    shift: true,
    description: '切换评论面板',
  },

  // 帮助
  showShortcuts: {
    key: '/',
    meta: true,
    description: '显示快捷键列表',
  },
}

/**
 * 格式化快捷键显示
 */
export function formatShortcut(config: Pick<ShortcutConfig, 'key' | 'ctrl' | 'shift' | 'alt' | 'meta'>): string {
  const parts: string[] = []
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  if (config.ctrl) parts.push(isMac ? '⌃' : 'Ctrl')
  if (config.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (config.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (config.meta) parts.push(isMac ? '⌘' : 'Win')

  // 特殊键显示
  const specialKeys: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
    Escape: 'Esc',
    ' ': 'Space',
  }

  parts.push(specialKeys[config.key] || config.key.toUpperCase())

  return parts.join(isMac ? '' : '+')
}
