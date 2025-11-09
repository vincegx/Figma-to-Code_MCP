import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Ignore non-code files to prevent auto-reload during analysis
      // BUT allow .tsx/.jsx so Vite can transform them for dynamic imports
      ignored: [
        '**/src/generated/**/*.html',
        '**/src/generated/**/*.png',
        '**/src/generated/**/*.jpg',
        '**/src/generated/**/*.svg',
        '**/src/generated/**/*.json',
        '**/src/generated/**/*.xml',
        '**/src/generated/**/*.md',
        '**/src/generated/**/*.css',
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
})
