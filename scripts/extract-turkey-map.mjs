import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const htmlPath = process.argv[2] || path.join(process.env.TEMP || '/tmp', 'turkey-map.html')
const html = fs.readFileSync(htmlPath, 'utf8')

const svgMatch = html.match(/<svg[^>]*id="svg-turkiye-haritasi"[^>]*>[\s\S]*<\/svg>/)
if (!svgMatch) {
  console.error('SVG not found')
  process.exit(1)
}

const svg = svgMatch[0]
fs.mkdirSync(path.join(root, 'public/maps'), { recursive: true })
fs.writeFileSync(path.join(root, 'public/maps/turkey-provinces.svg'), svg)

const groupRegex = /<g id="([^"]+)" data-plakakodu="(\d+)"[^>]*data-iladi="([^"]+)"/g
const provinces = []

for (const match of html.matchAll(groupRegex)) {
  const [, id, plate, name] = match
  if (id === 'turkiye' || id === 'guney-kibris') continue

  const blockEnd = html.indexOf('</g>', match.index)
  const block = html.slice(match.index, blockEnd > 0 ? blockEnd : match.index + 80000)
  const pathRegex = /\sd="([^"]+)"/g
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const pathMatch of block.matchAll(pathRegex)) {
    const nums = pathMatch[1].match(/-?\d+\.?\d*/g)
    if (!nums) continue
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = Number(nums[i])
      const y = Number(nums[i + 1])
      if (Number.isFinite(x) && Number.isFinite(y)) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (!Number.isFinite(minX)) continue

  provinces.push({
    id,
    plate,
    name,
    cx: Number(((minX + maxX) / 2).toFixed(1)),
    cy: Number(((minY + maxY) / 2).toFixed(1)),
  })
}

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true })
fs.writeFileSync(
  path.join(root, 'src/data/turkeyProvinceMeta.json'),
  JSON.stringify(provinces, null, 2),
)

console.log(`Extracted ${provinces.length} provinces, SVG ${svg.length} bytes`)
