export const DATA_VERSION = 1 as const

export type ModuleId = 'confidence' | 'prepare' | 'pressure' | 'setbacks'
export type EvidenceType = 'Effort' | 'Success' | 'Progress' | 'Preparation'

export interface SessionMeta {
  complete?: boolean
  durationSeconds?: number
}

export interface SetbackReflection {
  facts: string
  meaning: string
  control: string
}

export interface PracticeEntry extends SessionMeta {
  id: string
  createdAt: string
  updatedAt: string
  localDate: string
  effort: string
  success: string
  progress: string
  nextAction: string
  setback?: SetbackReflection
}

export interface ConfidenceItem {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  detail: string
  sourcePracticeId?: string
  type?: EvidenceType
}

export interface EventReview {
  createdAt: string
  updatedAt: string
  worked: string
  change: string
  practiseNext: string
}

export interface Preparation extends SessionMeta {
  id: string
  createdAt: string
  updatedAt: string
  localDate: string
  challenge: string
  routine: 'quick' | 'expanded'
  confidenceItemId?: string
  confidenceSnapshot?: string
  focusCue: string
  firstAction: string
  setting: string
  rehearsalActions: string
  likelyDifficulty: string
  plannedResponse: string
  evidence?: string
  breathing?: string
  rehearsal?: string
  review?: EventReview
}

export interface WeeklyReview {
  id: string
  createdAt: string
  updatedAt: string
  localDate: string
  evidence: string
  helped: string
  practiseNextWeek: string
}

export interface ReflectionSession extends SessionMeta {
  id: string
  createdAt: string
  updatedAt: string
  localDate: string
  module: 'pressure' | 'setbacks'
  answers: Record<string, string>
}

export interface AppData {
  version: typeof DATA_VERSION
  practiceEntries: PracticeEntry[]
  confidenceItems: ConfidenceItem[]
  preparations: Preparation[]
  weeklyReviews: WeeklyReview[]
  reflectionSessions?: ReflectionSession[]
  completedActions?: string[]
}

export const emptyData = (): AppData => ({
  version: DATA_VERSION,
  practiceEntries: [],
  confidenceItems: [],
  preparations: [],
  weeklyReviews: [],
})

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `pl-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const localDate = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const lastLocalDates = (count: number, today = new Date()): string[] => {
  const result: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    result.push(localDate(date))
  }
  return result
}

export const countDistinctPracticeDays = (entries: PracticeEntry[], days: string[]): number => {
  const window = new Set(days)
  return new Set(entries.filter((entry) => window.has(entry.localDate)).map((entry) => entry.localDate)).size
}

export const hasMeaningfulText = (...values: Array<string | undefined>): boolean =>
  values.some((value) => Boolean(value?.trim()))

export const weekStartDate = (date = new Date()): string => {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - (day.getDay() + 6) % 7)
  return localDate(day)
}
