import { getMapProvinces, getProvinceName } from '@/lib/turkeyProvinces'

export interface ProvinceLabelPosition {
  plate: string
  label: string
  cx: number
  cy: number
  width: number
  height: number
}

const SKIP_IDS = new Set(['turkiye', 'guney-kibris', 'kuzey-kibris'])

export function computeProvinceLabelPositions(svg: SVGSVGElement): ProvinceLabelPosition[] {
  const boxes = new Map<
    string,
    { minX: number; minY: number; maxX: number; maxY: number; label: string }
  >()

  for (const province of getMapProvinces()) {
    if (SKIP_IDS.has(province.id)) continue

    const group = svg.querySelector(`#${CSS.escape(province.id)}`) as SVGGElement | null
    if (!group) continue

    let bbox: DOMRect
    try {
      bbox = group.getBBox()
    } catch {
      continue
    }

    if (bbox.width <= 0 || bbox.height <= 0) continue

    const plate = province.plate
    if (plate === '00') continue

    const current = boxes.get(plate)
    if (!current) {
      boxes.set(plate, {
        minX: bbox.x,
        minY: bbox.y,
        maxX: bbox.x + bbox.width,
        maxY: bbox.y + bbox.height,
        label: getProvinceName(plate),
      })
      continue
    }

    current.minX = Math.min(current.minX, bbox.x)
    current.minY = Math.min(current.minY, bbox.y)
    current.maxX = Math.max(current.maxX, bbox.x + bbox.width)
    current.maxY = Math.max(current.maxY, bbox.y + bbox.height)
  }

  return [...boxes.entries()].map(([plate, box]) => {
    const width = box.maxX - box.minX
    const height = box.maxY - box.minY

    return {
      plate,
      label: box.label,
      cx: box.minX + width / 2,
      cy: box.minY + height / 2,
      width,
      height,
    }
  })
}

function shortProvinceName(name: string, maxWidth: number): string {
  if (maxWidth < 28) {
    return name.length > 6 ? `${name.slice(0, 5)}.` : name
  }

  if (name.length <= 11) return name

  return name
    .replace('Karahisar', 'Karah.')
    .replace('Merkez', 'M.')
}

export function renderProvinceLabels(
  svg: SVGSVGElement,
  positions: ProvinceLabelPosition[],
  options: {
    counts: Map<string, number>
    hoveredPlate: string | null
    isDark?: boolean
  },
) {
  const ns = 'http://www.w3.org/2000/svg'
  let labelsGroup = svg.querySelector('#province-labels') as SVGGElement | null

  if (!labelsGroup) {
    labelsGroup = document.createElementNS(ns, 'g')
    labelsGroup.setAttribute('id', 'province-labels')
    labelsGroup.setAttribute('pointer-events', 'none')
    svg.appendChild(labelsGroup)
  }

  labelsGroup.replaceChildren()

  const isDark = Boolean(options.isDark)
  const labelFill = isDark ? '#e2e8f0' : '#334155'
  const labelStroke = isDark ? '#0f172a' : '#ffffff'
  // Light: keep teal fill, dark ink for AA contrast (~7:1). Dark: deeper teal + white (~6.2:1).
  const badgeFill = isDark ? '#2d6b62' : '#5cb1a1'
  const badgeText = isDark ? '#ffffff' : '#0f172a'

  for (const province of positions) {
    const count = options.counts.get(province.plate) || 0
    const isActive = options.hoveredPlate === province.plate
    const showCount = count > 0
    const label = shortProvinceName(province.label, province.width)
    const fontSize = Math.min(9, Math.max(5.5, province.width / 10))
    const group = document.createElementNS(ns, 'g')
    group.setAttribute('opacity', showCount || isActive ? '1' : isDark ? '0.55' : '0.62')

    const text = document.createElementNS(ns, 'text')
    text.setAttribute('x', String(province.cx))
    text.setAttribute('y', String(province.cy - (showCount ? 4 : 0)))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('fill', labelFill)
    text.setAttribute('font-size', String(fontSize))
    text.setAttribute('font-weight', showCount || isActive ? '700' : '500')
    text.setAttribute('paint-order', 'stroke')
    text.setAttribute('stroke', labelStroke)
    text.setAttribute('stroke-width', '2')
    text.textContent = label
    group.appendChild(text)

    if (showCount) {
      const badgeRadius = count > 9 ? 9 : 7
      const badgeY = province.cy + Math.max(8, fontSize)

      const circle = document.createElementNS(ns, 'circle')
      circle.setAttribute('cx', String(province.cx))
      circle.setAttribute('cy', String(badgeY))
      circle.setAttribute('r', String(badgeRadius))
      circle.setAttribute('fill', badgeFill)
      group.appendChild(circle)

      const countText = document.createElementNS(ns, 'text')
      countText.setAttribute('x', String(province.cx))
      countText.setAttribute('y', String(badgeY + 3))
      countText.setAttribute('text-anchor', 'middle')
      countText.setAttribute('fill', badgeText)
      countText.setAttribute('font-size', '7.5')
      countText.setAttribute('font-weight', '800')
      countText.textContent = String(count)
      group.appendChild(countText)
    }

    labelsGroup.appendChild(group)
  }
}
