import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'hydra-context': '/src/index.js',
    },
  },
})
