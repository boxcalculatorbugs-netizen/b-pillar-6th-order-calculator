import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('electron/main/index.js')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload/index.js')
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve('src'),
    build: {
      rollupOptions: {
        input: resolve('src/index.html')
      }
    }
  }
})
