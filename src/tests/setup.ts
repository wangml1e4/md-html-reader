// Vitest 测试环境设置
import { beforeAll, vi } from 'vitest'

// Mock Tauri API
beforeAll(() => {
  // @ts-ignore
  global.window = global.window || {}

  // Mock Tauri invoke
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
    convertFileSrc: vi.fn((filePath: string) => `asset://localhost/${encodeURIComponent(filePath)}`),
  }))

  vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: vi.fn(() => ({
      onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    })),
  }))

  // Mock Tauri dialog
  vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
    save: vi.fn(),
    ask: vi.fn(),
  }))
})
