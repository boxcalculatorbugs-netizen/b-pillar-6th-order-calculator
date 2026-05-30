import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  saveDesignFile: (content) => ipcRenderer.invoke('design:save', content),
  loadDesignFile: () => ipcRenderer.invoke('design:load')
})
