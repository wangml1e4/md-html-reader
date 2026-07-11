import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'editor-framework': [
            '@milkdown/core',
            '@milkdown/ctx',
            '@milkdown/prose',
            '@milkdown/vue',
          ],
          'editor-presets': [
            '@milkdown/preset-commonmark',
            '@milkdown/preset-gfm',
          ],
          'editor-plugins': [
            '@milkdown/plugin-history',
            '@milkdown/plugin-listener',
            '@milkdown/plugin-prism',
          ],
        },
      },
    },
  },

  // Tauri 需要固定端口
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
})
