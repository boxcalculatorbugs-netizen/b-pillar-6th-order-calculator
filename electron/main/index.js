import { app, BrowserWindow, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { registerDesignHandlers } from './designHandlers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function resolveAppIcon() {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath, 'icon.png')
  ]
  for (const iconPath of candidates) {
    if (existsSync(iconPath)) {
      const image = nativeImage.createFromPath(iconPath)
      if (!image.isEmpty()) return image
    }
  }
  return undefined
}

function createWindow() {
  const icon = resolveAppIcon()
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'B-Pillar 6th Order Calculator',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

registerDesignHandlers()

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
