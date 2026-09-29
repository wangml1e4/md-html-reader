import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],

  build: {
    manifest: true,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        // Shared CommonJS helpers must not pull the lazy editor into reading mode.
        manualChunks(id) {
          if (id.includes('commonjsHelpers')) return 'runtime'
          const mermaid = id.match(/mermaid\/dist\/chunks\/mermaid\.core\/([^/]+)\.mjs$/)
          if (mermaid) return `mermaid-${mermaid[1]}`
          const cm = id.match(/node_modules\/(@codemirror\/[^/]+|@lezer\/[^/]+)\//)
          if (cm) return cm[1].replace(/[@/]/g, '-')
          if (id.includes('/node_modules/elkjs/')) return 'diagram-layout-elk'
          if (id.includes('/node_modules/cytoscape/')) return 'diagram-layout-cytoscape'
          if (id.includes('/node_modules/@milkdown/prose/') || id.includes('/node_modules/prosemirror-')) return 'richtext-prosemirror'

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
