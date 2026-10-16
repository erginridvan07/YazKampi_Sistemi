import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Users } from 'lucide-react'
import { GraduateCard } from '@/components/graduate/GraduateCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import {
  countMappedGraduates,
  getMapProvinces,
  getProvinceIdsForPlate,
  getProvinceName,
  groupGraduatesByProvince,
} from '@/lib/turkeyProvinces'
import {
  computeProvinceLabelPositions,
  renderProvinceLabels,
  type ProvinceLabelPosition,
} from '@/lib/turkeyMapLabels'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme.store'
import type { Graduate } from '@/types'

interface TurkeyGraduateMapProps {
  graduates: Graduate[]
  className?: string
}

/** Light: darker teal = more graduates. Dark: same density order, slate empty + tuned teals. */
function countColor(count: number, max: number, isDark: boolean): string {
  if (count <= 0) return isDark ? '#334155' : '#e2e8f0'
  if (max <= 1) return isDark ? '#4a9e92' : '#5cb1a1'

  const ratio = count / max
  if (isDark) {
    // Same semantic as light: darker teal = higher density
    if (ratio < 0.25) return '#5cb1a1'
    if (ratio < 0.5) return '#4a9e92'
    if (ratio < 0.75) return '#3d8f82'
    return '#2d6b62'
  }

  if (ratio < 0.25) return '#a8d8cf'
  if (ratio < 0.5) return '#7ec8bc'
  if (ratio < 0.75) return '#5cb1a1'
  return '#3d8f82'
}

function provinceStroke(isHovered: boolean, isDark: boolean): string {
  if (isHovered) return isDark ? '#94a3b8' : '#1e4f47'
  return isDark ? '#0f172a' : '#ffffff'
}

export function TurkeyGraduateMap({ graduates, className }: TurkeyGraduateMapProps) {
  const mapHostRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [svgReady, setSvgReady] = useState(false)
  const [labelPositions, setLabelPositions] = useState<ProvinceLabelPosition[]>([])
  const [hoveredPlate, setHoveredPlate] = useState<string | null>(null)
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    plate: string
    hostWidth: number
  } | null>(null)

  const provinceGroups = useMemo(() => groupGraduatesByProvince(graduates), [graduates])
  const mappedCount = useMemo(() => countMappedGraduates(provinceGroups), [provinceGroups])
  const unknownCount = provinceGroups.get('unknown')?.length || 0
  const activeProvinceCount = useMemo(() => {
    let count = 0
    for (const [plate] of provinceGroups) {
      if (plate !== 'unknown') count += 1
    }
    return count
  }, [provinceGroups])

  const maxCount = useMemo(() => {
    let max = 0
    for (const [plate, list] of provinceGroups) {
      if (plate === 'unknown') continue
      max = Math.max(max, list.length)
    }
    return max
  }, [provinceGroups])

  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const [plate, list] of provinceGroups) {
      if (plate === 'unknown') continue
      counts.set(plate, list.length)
    }
    return counts
  }, [provinceGroups])

  const selectedGraduates = selectedPlate ? provinceGroups.get(selectedPlate) || [] : []

  const paintProvince = useCallback(
    (plate: string, isHovered: boolean) => {
      const count = provinceGroups.get(plate)?.length || 0
      const fill = countColor(count, maxCount, isDark)
      const stroke = provinceStroke(isHovered, isDark)
      const ids = getProvinceIdsForPlate(plate)

      for (const id of ids) {
        const group = mapHostRef.current?.querySelector(`#${id}`)
        if (!group) continue

        const paths = group.querySelectorAll('path')
        paths.forEach((path) => {
          path.setAttribute('fill', fill)
          path.setAttribute('stroke', stroke)
          path.setAttribute('stroke-width', isHovered ? '1.6' : '0.9')
          path.style.cursor = count > 0 ? 'pointer' : 'default'
          path.style.transition = 'fill 150ms ease, stroke 150ms ease'
        })
      }
    },
    [isDark, maxCount, provinceGroups],
  )

  const paintAllProvinces = useCallback(() => {
    const painted = new Set<string>()
    for (const province of getMapProvinces()) {
      if (painted.has(province.plate)) continue
      painted.add(province.plate)
      paintProvince(province.plate, hoveredPlate === province.plate)
    }
  }, [hoveredPlate, paintProvince])

  useEffect(() => {
    let cancelled = false

    async function loadMap() {
      const response = await fetch('/maps/turkey-provinces.svg')
      const markup = await response.text()
      if (cancelled || !mapHostRef.current) return

      mapHostRef.current.innerHTML = markup
      const svg = mapHostRef.current.querySelector('svg')
      if (svg) {
        svg.setAttribute('class', 'h-full w-full')
        svg.removeAttribute('width')
        svg.removeAttribute('height')
        setLabelPositions(computeProvinceLabelPositions(svg))
      }

      const skipIds = new Set(['turkiye', 'guney-kibris', 'kuzey-kibris'])
      for (const province of getMapProvinces()) {
        const group = mapHostRef.current.querySelector(`#${province.id}`)
        if (!group || skipIds.has(province.id)) continue

        group.querySelectorAll('path').forEach((path) => {
          path.style.pointerEvents = 'all'
        })
      }

      setSvgReady(true)
    }

    loadMap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!svgReady || !mapHostRef.current) return
    paintAllProvinces()
  }, [paintAllProvinces, svgReady, provinceGroups, isDark])

  useEffect(() => {
    if (!svgReady || !mapHostRef.current) return

    const svg = mapHostRef.current.querySelector('svg')
    if (!svg) return

    renderProvinceLabels(svg, labelPositions, {
      counts: provinceCounts,
      hoveredPlate,
      isDark,
    })
  }, [hoveredPlate, isDark, labelPositions, provinceCounts, svgReady])

  useEffect(() => {
    if (!svgReady || !mapHostRef.current) return

    const host = mapHostRef.current

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target as Element | null
      const group = target?.closest('g[id]') as SVGGElement | null
      if (!group || !host.contains(group)) return

      const plate = group.getAttribute('data-plakakodu')
      if (!plate || plate === '00') return

      setHoveredPlate(plate)
      const rect = host.getBoundingClientRect()
      setTooltip({
        plate,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        hostWidth: host.clientWidth,
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      setTooltip((current) =>
        current
          ? {
              ...current,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              hostWidth: host.clientWidth,
            }
          : current,
      )
    }

    const onPointerOut = (event: PointerEvent) => {
      const related = event.relatedTarget as Node | null
      if (related && host.contains(related)) return
      setHoveredPlate(null)
      setTooltip(null)
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const group = target?.closest('g[id]') as SVGGElement | null
      if (!group || !host.contains(group)) return

      const plate = group.getAttribute('data-plakakodu')
      if (!plate || plate === '00') return

      const count = provinceGroups.get(plate)?.length || 0
      if (count === 0) return

      setSelectedPlate(plate)
    }

    host.addEventListener('pointerover', onPointerOver)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerout', onPointerOut)
    host.addEventListener('click', onClick)

    return () => {
      host.removeEventListener('pointerover', onPointerOver)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerout', onPointerOut)
      host.removeEventListener('click', onClick)
    }
  }, [provinceGroups, svgReady])

  useEffect(() => {
    if (!svgReady) return
    const host = mapHostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      const width = host.clientWidth
      setTooltip((current) => {
        if (!current || current.hostWidth === width) return current
        return { ...current, hostWidth: width }
      })
    })

    observer.observe(host)
    return () => observer.disconnect()
  }, [svgReady])

  return (
    <>
      <Card className={cn('overflow-hidden border-primary-100 p-0 dark:border-primary-900/40', className)}>
        <div className="border-b border-slate-100 bg-gradient-to-r from-primary-50 to-white px-5 py-4 dark:border-slate-800 dark:from-primary-950/40 dark:to-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
                <MapPin className="h-4 w-4" />
                Türkiye Haritası
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Mezunların Şehir Dağılımı
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                İllere tıklayarak o şehirdeki mezunları görebilirsiniz. Koyu renkli illerde daha fazla mezun bulunur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">
                <Users className="mr-1 inline h-3.5 w-3.5" />
                {mappedCount} konumlu
              </Badge>
              <Badge tone="default">{activeProvinceCount} il</Badge>
              {unknownCount > 0 ? (
                <Badge tone="default">{unknownCount} şehirsiz</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative bg-slate-50 px-3 py-4 dark:bg-slate-950/40 sm:px-5">
          <div className="relative mx-auto max-w-5xl">
            <div
              ref={mapHostRef}
              className="relative aspect-[1007/527] w-full overflow-hidden rounded-2xl bg-white shadow-inner ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800"
              aria-label="Türkiye mezun dağılım haritası"
            />

            {tooltip ? (
              <div
                className="pointer-events-none absolute z-20 rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
                style={{
                  left: Math.min(tooltip.x + 12, tooltip.hostWidth - 160),
                  top: Math.max(tooltip.y - 48, 8),
                }}
              >
                <p className="font-bold">{getProvinceName(tooltip.plate)}</p>
                <p className="text-slate-300">
                  {(provinceGroups.get(tooltip.plate)?.length || 0) > 0
                    ? `${provinceGroups.get(tooltip.plate)?.length} mezun`
                    : 'Bu ilde kayıtlı mezun yok'}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Az</span>
              <div className="flex h-2.5 overflow-hidden rounded-full ring-1 ring-slate-200 dark:ring-slate-700">
                {isDark ? (
                  <>
                    <span className="w-8 bg-slate-700" />
                    <span className="w-8 bg-[#5cb1a1]" />
                    <span className="w-8 bg-[#4a9e92]" />
                    <span className="w-8 bg-[#3d8f82]" />
                    <span className="w-8 bg-[#2d6b62]" />
                  </>
                ) : (
                  <>
                    <span className="w-8 bg-slate-200" />
                    <span className="w-8 bg-[#a8d8cf]" />
                    <span className="w-8 bg-[#7ec8bc]" />
                    <span className="w-8 bg-[#5cb1a1]" />
                    <span className="w-8 bg-[#3d8f82]" />
                  </>
                )}
              </div>
              <span>Çok</span>
            </div>
            <p>Mezun bulunan illere tıklayın</p>
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(selectedPlate)}
        onClose={() => setSelectedPlate(null)}
        title={selectedPlate ? `${getProvinceName(selectedPlate)} Mezunları` : ''}
        description={
          selectedPlate
            ? `${selectedGraduates.length} mezun bu ilde kayıtlı`
            : undefined
        }
        className="max-w-3xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {selectedGraduates.map((graduate) => (
            <GraduateCard key={graduate.id} graduate={graduate} />
          ))}
        </div>
      </Modal>
    </>
  )
}
