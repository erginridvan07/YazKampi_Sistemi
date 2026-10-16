export type CalendarDot = 'geldi' | 'gelmedi' | 'izinli' | 'bos'

export interface CalendarDayCell {
  key: string
  day: number | null
  dots: CalendarDot[]
}

export const CALENDAR_WEEKDAY_LABELS: string[]

export function buildCalendarGrid(
  year: number,
  month: number,
  days: Array<{ day: number; dots: CalendarDot[] }>,
): CalendarDayCell[]
