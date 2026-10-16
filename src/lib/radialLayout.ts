/**
 * Responsive radial fan layout (from Design 3 prototype).
 * Positions include icon + rotated label collision bounds.
 */

export interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface Slot {
  x: number
  y: number
  angle: number
  radius: number
  rot: number
}

export interface Playfield {
  width: number
  height: number
  hubX: number
  hubY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  hubClear: number
}

/** Degrees: 0 = up, negative = left, positive = right */
export function polar(radius: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180
  return {
    x: Math.sin(a) * radius,
    y: -Math.cos(a) * radius,
    angle: angleDeg,
    radius,
  }
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function rotatedAABB(cx: number, cy: number, w: number, h: number, deg = 0): Rect {
  const rad = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const bw = w * c + h * s
  const bh = w * s + h * c
  return {
    left: cx - bw / 2,
    right: cx + bw / 2,
    top: cy - bh / 2,
    bottom: cy + bh / 2,
  }
}

export function inflate(rect: Rect, pad: number): Rect {
  return {
    left: rect.left - pad,
    right: rect.right + pad,
    top: rect.top - pad,
    bottom: rect.bottom + pad,
  }
}

export function intersects(a: Rect, b: Rect) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
}

export function measurePlayfield(fab: HTMLElement, topSafe = 78): Playfield {
  const fabRect = fab.getBoundingClientRect()
  const width = window.innerWidth
  const height = window.innerHeight
  const hubX = fabRect.left + fabRect.width / 2
  const hubY = fabRect.top + fabRect.height / 2
  const edge = 18
  const hubClear = fabRect.height / 2 + 22

  return {
    width,
    height,
    hubX,
    hubY,
    minX: edge - hubX,
    maxX: width - edge - hubX,
    minY: topSafe - hubY,
    maxY: -hubClear,
    hubClear,
  }
}

export function syncStageToHub(stage: HTMLElement, fab: HTMLElement, root: HTMLElement) {
  const rootRect = root.getBoundingClientRect()
  const fabRect = fab.getBoundingClientRect()
  const cx = fabRect.left + fabRect.width / 2 - rootRect.left
  const cy = fabRect.top + fabRect.height / 2 - rootRect.top
  stage.style.left = `${cx}px`
  stage.style.top = `${cy}px`
  stage.style.bottom = 'auto'
  stage.style.right = 'auto'
  stage.style.transform = 'none'
}

export function fanAngles(count: number, spanDeg: number) {
  if (count <= 1) return [0]
  const start = -spanDeg / 2
  const step = spanDeg / (count - 1)
  return Array.from({ length: count }, (_, i) => start + step * i)
}

export function labelRotationFromAngle(angleDeg: number) {
  return clamp(angleDeg * 0.4, -30, 30)
}

export function estimateLabelWidth(label: string, fontSize = 11) {
  return Math.ceil(label.length * fontSize * 0.56 + 16)
}

function layoutOk(playfield: Playfield, boxes: Rect[], hubRect: Rect, pad = 6) {
  for (const b of boxes) {
    if (
      b.left < playfield.minX ||
      b.right > playfield.maxX ||
      b.top < playfield.minY ||
      b.bottom > playfield.maxY
    ) {
      return false
    }
    if (intersects(inflate(b, 2), hubRect)) return false
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (intersects(inflate(boxes[i], pad), inflate(boxes[j], pad))) return false
    }
  }
  return true
}

export function fitRadialFan({
  count,
  playfield,
  itemBox,
  preferSpan = 128,
  preferRadius,
  minRadius = 132,
  hubRect = { left: -44, right: 44, top: -44, bottom: 44 },
}: {
  count: number
  playfield: Playfield
  itemBox: (i: number, slot: Slot) => Rect
  preferSpan?: number
  preferRadius?: number
  minRadius?: number
  hubRect?: Rect
}): Slot[] {
  const maxR = Math.min(
    preferRadius ?? 168,
    Math.abs(playfield.minX) - 12,
    Math.abs(playfield.minY) - 12,
    Math.abs(playfield.maxX) - 12,
  )

  let radius = Math.max(minRadius, Math.min(168, maxR))
  let span = preferSpan

  let best: Slot[] | null = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < 40; attempt++) {
    const angles = fanAngles(count, span)
    const slots: Slot[] = angles.map((angle) => {
      const p = polar(radius, angle)
      return { ...p, rot: labelRotationFromAngle(angle) }
    })
    const boxes = slots.map((slot, i) => itemBox(i, slot))
    const ok = layoutOk(playfield, boxes, hubRect, 4)
    const score = radius * 2 + (140 - Math.abs(span - 128)) + (ok ? 2000 : 0)
    if (score > bestScore) {
      bestScore = score
      best = slots
    }
    if (ok) return slots

    if (attempt % 2 === 0 && span > 108) {
      span -= 3
    } else if (radius > minRadius) {
      radius = Math.max(minRadius, radius - 3)
    } else if (span > 96) {
      span -= 2
    } else {
      radius = Math.max(minRadius - 8, radius - 2)
    }
  }

  return (
    best ??
    fanAngles(count, span).map((angle) => {
      const p = polar(radius, angle)
      return { ...p, rot: labelRotationFromAngle(angle) }
    })
  )
}

export function labelOffset(slot: Slot, gap: number) {
  const ux = slot.radius ? slot.x / slot.radius : 0
  const uy = slot.radius ? slot.y / slot.radius : -1
  const t = Math.min(1, Math.abs(slot.angle) / 72)
  return {
    lx: ux * gap * (1 - t * 0.5),
    ly: uy * gap * (1 - t * 0.2) - gap * 0.4 * t,
  }
}
