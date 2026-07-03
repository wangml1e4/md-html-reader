// Vitest 测试环境设置
import { beforeAll, vi } from 'vitest'

// Mock Tauri API
beforeAll(() => {
  // @ts-ignore
  global.window = global.window || {}

  // Mock Tauri invoke
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
  }))

  // Mock Tauri dialog
  vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
  }))
})
