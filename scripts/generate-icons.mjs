import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'src', 'assets', 'logo-sixth-order.svg')
const buildDir = join(root, 'build')

const BG = { r: 15, g: 20, b: 25, alpha: 1 }
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function renderSquarePng(svg, size) {
  return sharp(svg, { density: 300 })
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toBuffer()
}

async function main() {
  const svg = await readFile(svgPath)
  await mkdir(buildDir, { recursive: true })

  const png512 = await renderSquarePng(svg, 512)
  await writeFile(join(buildDir, 'icon.png'), png512)

  const favicon = await renderSquarePng(svg, 64)
  await writeFile(join(root, 'src', 'assets', 'icon.png'), favicon)

  const icoBuffers = await Promise.all(ICO_SIZES.map((size) => renderSquarePng(svg, size)))
  const ico = await pngToIco(icoBuffers)
  await writeFile(join(buildDir, 'icon.ico'), ico)

  console.log(`Icons written to ${buildDir}`)
  console.log('  icon.png (512×512)')
  console.log('  src/assets/icon.png (64×64 favicon)')
  console.log(`  icon.ico (${ICO_SIZES.join(', ')} px)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
