import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'pdf-lib': fileURLToPath(new URL('./node_modules/pdf-lib/es/index.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['pdf-lib'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
