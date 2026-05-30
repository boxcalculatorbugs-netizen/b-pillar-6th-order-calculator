import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'

export function registerDesignHandlers() {
  ipcMain.handle('design:save', async (event, content) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Save Design',
      defaultPath: '6th-order-design.json',
      filters: [{ name: 'Design Files', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    await writeFile(filePath, content, 'utf8')
    return { ok: true, filePath }
  })

  ipcMain.handle('design:load', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Load Design',
      filters: [{ name: 'Design Files', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true }
    const content = await readFile(filePaths[0], 'utf8')
    return { ok: true, content, filePath: filePaths[0] }
  })
}
