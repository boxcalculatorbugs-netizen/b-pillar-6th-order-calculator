import { defineConfig } from 'vite'
import { resolve } from 'path'

const base = process.env.GITHUB_PAGES_BASE || './'

export default defineConfig({
  root: resolve('src'),
  base,
  build: {
    outDir: resolve('dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/index.html')
    }
  }
})
