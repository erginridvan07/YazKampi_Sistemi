import test from 'node:test'
import assert from 'node:assert/strict'
import { CALENDAR_WEEKDAY_LABELS, buildCalendarGrid } from '../src/lib/calendarGrid.js'

function monthDays(count) {
  return Array.from({ length: count }, (_, index) => ({ day: index + 1, dots: ['bos'] }))
}

test('October 2026 starts on Thursday in a Monday-first calendar', () => {
  const grid = buildCalendarGrid(2026, 9, monthDays(31))

  assert.deepEqual(CALENDAR_WEEKDAY_LABELS, ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'])
  assert.deepEqual(grid.slice(0, 3).map((cell) => cell.day), [null, null, null])
  assert.equal(grid[3].day, 1)
  assert.equal(grid[33].day, 31)
  assert.equal(grid.length, 35)
})

test('a Sunday-starting month places day one in the final column', () => {
  const grid = buildCalendarGrid(2023, 9, monthDays(31))

  assert.deepEqual(grid.slice(0, 6).map((cell) => cell.day), [null, null, null, null, null, null])
  assert.equal(grid[6].day, 1)
  assert.equal(grid.length, 42)
})

test('a Monday-starting month needs no leading blank cells', () => {
  const grid = buildCalendarGrid(2026, 5, monthDays(30))

  assert.equal(grid[0].day, 1)
  assert.equal(grid.length, 35)
})
