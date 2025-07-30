import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'copy-html-files',
      closeBundle() {
        // Copy HTML files to dist after build
        try {
          copyFileSync(
            resolve(__dirname, 'public/account.html'),
            resolve(__dirname, 'dist/account.html')
          )
          copyFileSync(
            resolve(__dirname, 'public/share.html'),
            resolve(__dirname, 'dist/share.html')
          )
          console.log('Copied HTML files to dist')
        } catch (error) {
          console.error('Error copying HTML files:', error)
        }
      }
    }
  ],
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