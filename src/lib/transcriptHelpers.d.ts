import type { DersNotu } from '@/types'

export type TranscriptTermKind = 'fall' | 'spring' | 'summer'

export interface TranscriptCourse {
  code: string
  title: string
  letterGrade: string
  ects: string
}

export interface ParsedTranscriptTerm {
  sourceLabel: string
  academicYear: string
  kind: TranscriptTermKind
  courses: TranscriptCourse[]
  termAverage: string
  generalAverage: string
}

export interface TranscriptImportTarget {
  sourceLabel: string
  targetPeriod: string
  courseCount: number
  isSummer: boolean
}

export interface TranscriptImportPlan {
  akademikNotlar: Record<string, DersNotu[]>
  donemOrtalamalari: Record<string, string>
  genelOrt: string
  targets: TranscriptImportTarget[]
  warnings: string[]
}

export function parseTranscriptLines(lines: string[]): ParsedTranscriptTerm[]

export function buildTranscriptImportPlan(
  parsedTerms: ParsedTranscriptTerm[],
  firstPeriod: string,
  existingNotes?: Record<string, DersNotu[]>,
  existingAverages?: Record<string, string>,
  existingGeneralAverage?: string,
): TranscriptImportPlan
