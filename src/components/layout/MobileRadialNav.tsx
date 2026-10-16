import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Globe,
  Home,
  Megaphone,
  Settings,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { isNavPathActive, useNavItems, type NavIconKey } from '@/hooks/useNavItems'
import {
  estimateLabelWidth,
  fitRadialFan,
  labelOffset,
  measurePlayfield,
  polar,
  rotatedAABB,
  syncStageToHub,
  type Slot,
} from '@/lib/radialLayout'
import { cn } from '@/lib/utils'
import '@/styles/mobile-radial-nav.css'

const ICON = 44
const LABEL_H = 18
const LABEL_GAP = 34

const iconMap: Record<NavIconKey, LucideIcon> = {
  home: Home,
  users: Users,
  'check-circle': CheckCircle2,
  megaphone: Megaphone,
  'graduation-cap': GraduationCap,
  'bar-chart': BarChart3,
  'wallet-cards': WalletCards,
  settings: Settings,
  globe: Globe,
}

interface LaidOutSlot extends Slot {
  lx: number
  ly: number
  line: { x1: number; y1: number; x2: number; y2: number; len: number }
}

export function MobileRadialNav() {
  const items = useNavItems()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<LaidOutSlot[]>([])

  const rootRef = useRef<HTMLElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const activeId = useMemo(() => {
    const match = items.find((item) => isNavPathActive(item.path, location.pathname))
    return match?.id ?? items[0]?.id ?? ''
  }, [items, location.pathname])

  const applyLayout = useCallback(() => {
    const fab = fabRef.current
    const stage = stageRef.current
    const root = rootRef.current
    if (!fab || !stage || !root || items.length === 0) return

    syncStageToHub(stage, fab, root)
    const playfield = measurePlayfield(fab, 78)
    const hubRect = { left: -44, right: 44, top: -44, bottom: 44 }

    const computed = fitRadialFan({
      count: items.length,
      playfield,
      itemBox: (i, slot) => {
        const label = items[i]?.label ?? ''
        const lw = Math.min(estimateLabelWidth(label, 11), 88)
        const iconBox = rotatedAABB(slot.x, slot.y, ICON + 8, ICON + 8, 0)
        const { lx, ly } = labelOffset(slot, LABEL_GAP)
        const labBox = rotatedAABB(slot.x + lx, slot.y + ly, lw, LABEL_H, slot.rot ?? 0)
        return {
          left: Math.min(iconBox.left, labBox.left),
          right: Math.max(iconBox.right, labBox.right),
          top: Math.min(iconBox.top, labBox.top),
          bottom: Math.max(iconBox.bottom, labBox.bottom),
        }
      },
      preferSpan: 128,
      preferRadius: Math.min(168, Math.abs(playfield.minX) - 36, Math.abs(playfield.minY) - 40),
      minRadius: 132,
      hubRect,
    })

    const hubStart = 40
    const lineEndPad = ICON / 2 + 12

    setSlots((prev) => {
      const next = computed.map((slot) => {
        const { lx, ly } = labelOffset(slot, LABEL_GAP)
        const endR = Math.max(hubStart + 10, slot.radius - lineEndPad)
        const start = polar(hubStart, slot.angle)
        const end = polar(endR, slot.angle)
        const len = Math.hypot(end.x - start.x, end.y - start.y)
        return {
          ...slot,
          lx,
          ly,
          line: {
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            len,
          },
        }
      })

      if (
        prev.length === next.length &&
        prev.every((slot, i) => {
          const other = next[i]
          return (
            other &&
            Math.abs(slot.x - other.x) < 0.5 &&
            Math.abs(slot.y - other.y) < 0.5 &&
            Math.abs((slot.rot ?? 0) - (other.rot ?? 0)) < 0.5 &&
            Math.abs(slot.lx - other.lx) < 0.5 &&
            Math.abs(slot.ly - other.ly) < 0.5
          )
        })
      ) {
        return prev
      }

      return next
    })
  }, [items])

  useEffect(() => {
    applyLayout()
    const onResize = () => applyLayout()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [applyLayout, open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleNavigate = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  if (items.length === 0) return null

  return createPortal(
    <nav
      ref={rootRef}
      className={cn('mrad-root lg:hidden', open && 'is-open')}
      aria-label="Ana navigasyon"
    >
      <div
        className="mrad-scrim"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <div ref={stageRef} className="mrad-stage" aria-hidden={!open}>
        <svg className="mrad-spokes" overflow="visible" aria-hidden="true">
          {slots.map((slot, i) => (
            <line
              key={`spoke-${items[i]?.id ?? i}`}
              className="mrad-spoke"
              style={{ ['--i' as string]: i, ['--len' as string]: String(slot.line.len) }}
              x1={slot.line.x1}
              y1={slot.line.y1}
              x2={slot.line.x2}
              y2={slot.line.y2}
            />
          ))}
        </svg>

        {items.map((item, i) => {
          const slot = slots[i]
          const Icon = iconMap[item.icon]
          const isActive = item.id === activeId
          const paintOrder = isActive ? items.length + 1 : i

          return (
            <div
              key={item.id}
              className={cn('mrad-item', isActive && 'is-active')}
              style={{
                ['--x' as string]: `${slot?.x ?? 0}px`,
                ['--y' as string]: `${slot?.y ?? -120}px`,
                ['--rot' as string]: `${slot?.rot ?? 0}deg`,
                ['--lx' as string]: `${slot?.lx ?? 0}px`,
                ['--ly' as string]: `${slot?.ly ?? -28}px`,
                ['--i' as string]: i,
                zIndex: open ? (isActive ? 12 : 2 + paintOrder) : undefined,
              }}
            >
              <button
                type="button"
                className="mrad-item__hit"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleNavigate(item.path)}
              >
                <span className="mrad-item__icon" aria-hidden="true">
                  <Icon className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <span className="mrad-item__label">{item.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="mrad-hub">
        <button
          ref={fabRef}
          type="button"
          className="mrad-fab"
          aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="mrad-burger" aria-hidden="true">
            <span className="mrad-burger__line" />
            <span className="mrad-burger__line" />
            <span className="mrad-burger__line" />
          </span>
        </button>
      </div>
    </nav>,
    document.body,
  )
}
