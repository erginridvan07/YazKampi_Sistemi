export interface RawDutyScheduleRow {
  tarih: string
  gun: string
  imam: string
  muezzin: string
}

export interface ParsedDutyScheduleEntry {
  tarih: string
  gunLabel: string
  imam: string
  muezzin: string
}

export interface ParsedDutySchedule {
  rangeLabel: string
  entries: ParsedDutyScheduleEntry[]
}

export interface DutyRosterNameMatch {
  name: string
  match: 'exact' | 'normalized' | 'expanded' | 'similar'
}

export function normalizeDutyName(value: unknown): string
export function resolveDutyRosterName(value: unknown, rosterNames: unknown[]): DutyRosterNameMatch | null
export function parseDutyScheduleRows(
  rangeText: string,
  rows: RawDutyScheduleRow[],
): ParsedDutySchedule
