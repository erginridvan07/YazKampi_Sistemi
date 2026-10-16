import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logoPng = join(root, 'public/icons/gaye-logo.png')
const logoSvg = join(root, 'public/icons/gaye-emblem.svg')

const emblemPath = existsSync(logoPng) ? logoPng : logoSvg
const emblem = readFileSync(emblemPath)

const BRAND_GREEN = '#5CB1A1'
const WHITE = '#ffffff'

async function squareIcon(size, { maskable = false, fill = 0.94 } = {}) {
  if (maskable) {
    const inner = Math.round(size * 0.8)
    const padded = await sharp(emblem)
      .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer()

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND_GREEN,
      },
    }).composite([{ input: padded, gravity: 'center' }])
  }

  const inner = Math.round(size * fill)
  const padded = await sharp(emblem)
    .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE,
    },
  }).composite([{ input: padded, gravity: 'center' }])
}

const outputs = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icons/apple-touch-icon-152.png', size: 152 },
  { file: 'public/icons/apple-touch-icon-167.png', size: 167 },
  { file: 'public/icons/apple-touch-icon-180.png', size: 180 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, maskable: true },
  { file: 'public/favicon.png', size: 48, fill: 0.9 },
]

for (const item of outputs) {
  const outPath = join(root, item.file)
  mkdirSync(dirname(outPath), { recursive: true })
  const pipeline = await squareIcon(item.size, {
    maskable: item.maskable,
    fill: item.fill ?? 0.94,
  })
  await pipeline.png().toFile(outPath)
  console.log(`✓ ${item.file}`)
}
