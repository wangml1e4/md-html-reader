import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  // Tauri expects a fixed port
  server: {
    port: 1420,
    strictPort: true,
  },

  // 生产环境使用相对路径
  base: './',

  // 优化构建
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // 防止 vite 清除 rust 错误
  clearScreen: false,
})
