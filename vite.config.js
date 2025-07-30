import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4173',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:4173',
        changeOrigin: true
      }
    }
  }
})