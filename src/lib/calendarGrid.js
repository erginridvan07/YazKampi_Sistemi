export const CALENDAR_WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

/**
 * Places a month's dated cells into a Monday-first calendar grid. Leading and
 * trailing blanks make the real weekday of every date visible to both report
 * screens without changing the attendance data itself.
 */
export function buildCalendarGrid(year, month, days) {
  const mondayFirstOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const cells = [
    ...Array.from({ length: mondayFirstOffset }, (_, index) => ({
      key: `blank-before-${index}`,
      day: null,
      dots: [],
    })),
    ...days.map((item) => ({ ...item, key: `day-${item.day}` })),
  ]
  const trailingBlanks = (7 - (cells.length % 7)) % 7

  cells.push(
    ...Array.from({ length: trailingBlanks }, (_, index) => ({
      key: `blank-after-${index}`,
      day: null,
      dots: [],
    })),
  )

  return cells
}
