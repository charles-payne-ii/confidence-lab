import { DATA_VERSION, emptyData, type AppData } from './model'

export const STORAGE_KEY = 'performance-lab:data'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export type LoadResult =
  | { status: 'ok'; data: AppData }
  | { status: 'empty'; data: AppData }
  | { status: 'unavailable'; data: AppData; message: string }
  | { status: 'corrupt'; data: AppData; raw: string; message: string }

export type SaveResult = { ok: true } | { ok: false; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const isNonemptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0

const isTimestamp = (value: unknown): value is string =>
  isString(value) && value.length > 0 && !Number.isNaN(Date.parse(value))

const isLocalDate = (value: unknown): value is string => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

const hasBaseFields = (value: Record<string, unknown>): boolean =>
  isNonemptyString(value.id) && isTimestamp(value.createdAt) && isTimestamp(value.updatedAt)

const validMeta = (value: Record<string, unknown>): boolean =>
  (value.complete === undefined || typeof value.complete === 'boolean') &&
  (value.durationSeconds === undefined || (typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0))

const validSetback = (value: unknown): boolean =>
  isRecord(value) && isString(value.facts) && isString(value.meaning) && isString(value.control)

const validPractice = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value) || !validMeta(value)) return false
  return (
    isLocalDate(value.localDate) &&
    isString(value.effort) &&
    isString(value.success) &&
    isString(value.progress) &&
    isString(value.nextAction) &&
    (value.setback === undefined || validSetback(value.setback))
  )
}

const validConfidence = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value)) return false
  return (
    isString(value.title) &&
    isString(value.detail) &&
    (value.type === undefined || (isString(value.type) && ['Effort', 'Success', 'Progress', 'Preparation'].includes(value.type))) &&
    (value.sourcePracticeId === undefined || isString(value.sourcePracticeId))
  )
}

const validReview = (value: unknown): boolean =>
  isRecord(value) &&
  isTimestamp(value.createdAt) &&
  isTimestamp(value.updatedAt) &&
  isString(value.worked) &&
  isString(value.change) &&
  isString(value.practiseNext)

const validPreparation = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value) || !validMeta(value)) return false
  return (
    isLocalDate(value.localDate) &&
    isString(value.challenge) &&
    (value.routine === 'quick' || value.routine === 'expanded') &&
    (value.confidenceItemId === undefined || isString(value.confidenceItemId)) &&
    (value.confidenceSnapshot === undefined || isString(value.confidenceSnapshot)) &&
    isString(value.focusCue) &&
    isString(value.firstAction) &&
    isString(value.setting) &&
    isString(value.rehearsalActions) &&
    isString(value.likelyDifficulty) &&
    isString(value.plannedResponse) &&
    (value.evidence === undefined || isString(value.evidence)) &&
    (value.breathing === undefined || isString(value.breathing)) &&
    (value.rehearsal === undefined || isString(value.rehearsal)) &&
    (value.review === undefined || validReview(value.review))
  )
}

const validReflection = (value: unknown): boolean =>
  isRecord(value) && hasBaseFields(value) && validMeta(value) && isLocalDate(value.localDate) &&
  (value.module === 'pressure' || value.module === 'setbacks') &&
  isRecord(value.answers) && Object.entries(value.answers).every(([key, answer]) =>
    ['breath', 'see', 'next', 'facts', 'story', 'alt', 'lesson'].includes(key) && isString(answer))

const validWeekly = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value)) return false
  return (
    isLocalDate(value.localDate) &&
    isString(value.evidence) &&
    isString(value.helped) &&
    isString(value.practiseNextWeek)
  )
}

const meaningfulStrings = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(isNonemptyString)

const validBank = (value: unknown): boolean => {
  if (!isRecord(value) || !Array.isArray(value.memories) || value.memories.length > 10 || !Array.isArray(value.rotation) || !value.rotation.every(isNonemptyString)) return false
  if (value.lastDailyDate !== undefined && !isLocalDate(value.lastDailyDate)) return false
  if (value.dailyRecallWhenFull !== undefined && typeof value.dailyRecallWhenFull !== 'boolean') return false
  const valid = value.memories.every((memory) => isRecord(memory) && hasBaseFields(memory) && isNonemptyString(memory.title) && isNonemptyString(memory.happened) && memory.happened.length <= 300 && meaningfulStrings(memory.evidence) && meaningfulStrings(memory.feelings) && (memory.type === undefined || (isString(memory.type) && ['success', 'effort', 'progress'].includes(memory.type))))
  const ids = value.memories.map((memory) => isRecord(memory) ? memory.id : undefined)
  return valid && new Set(value.rotation).size === value.rotation.length && value.rotation.every((id) => ids.includes(id))
}

export const validateData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.version !== DATA_VERSION) return false
  if (
    !Array.isArray(value.practiceEntries) ||
    !Array.isArray(value.confidenceItems) ||
    !Array.isArray(value.preparations) ||
    !Array.isArray(value.weeklyReviews)
  ) return false

  if (value.reflectionSessions !== undefined && (!Array.isArray(value.reflectionSessions) || !value.reflectionSessions.every(validReflection))) return false
  if (value.completedActions !== undefined && (!Array.isArray(value.completedActions) || !value.completedActions.every(isNonemptyString))) return false
  if (value.bank !== undefined && !validBank(value.bank)) return false

  const records = [...value.practiceEntries, ...value.confidenceItems, ...value.preparations, ...value.weeklyReviews, ...(Array.isArray(value.reflectionSessions) ? value.reflectionSessions : []), ...(isRecord(value.bank) && Array.isArray(value.bank.memories) ? value.bank.memories : [])]
  const ids = records.map((record) => isRecord(record) ? record.id : undefined)
  if (ids.some((id) => !isNonemptyString(id)) || new Set(ids).size !== ids.length) return false

  return (
    value.practiceEntries.every(validPractice) &&
    value.confidenceItems.every(validConfidence) &&
    value.preparations.every(validPreparation) &&
    value.weeklyReviews.every(validWeekly)
  )
}

export const parseImport = (text: string): { ok: true; data: AppData } | { ok: false; message: string } => {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!validateData(parsed)) {
      return { ok: false, message: 'This file is not a complete Confidence Lab version 1 backup.' }
    }
    return { ok: true, data: parsed }
  } catch {
    return { ok: false, message: 'This file is not valid JSON.' }
  }
}

export class DataStore {
  private storage: StorageLike | null
  private corrupt = false
  private readFailed = false
  private lastRaw: string | null | undefined

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? this.browserStorage() : storage
  }

  private browserStorage(): StorageLike | null {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  load(): LoadResult {
    if (!this.storage) {
      return { status: 'unavailable', data: emptyData(), message: 'Browser storage is unavailable. Changes will last only for this tab.' }
    }
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      this.lastRaw = raw
      if (raw === null) return { status: 'empty', data: emptyData() }
      const parsed = parseImport(raw)
      if (!parsed.ok) {
        this.corrupt = true
        return { status: 'corrupt', data: emptyData(), raw, message: `${parsed.message} The original saved value has been left untouched.` }
      }
      return { status: 'ok', data: parsed.data }
    } catch {
      this.readFailed = true
      return { status: 'unavailable', data: emptyData(), message: 'Saved data could not be read. Changes will last only for this tab.' }
    }
  }

  save(data: AppData, allowReplaceCorrupt = false): SaveResult {
    if (!validateData(data)) return { ok: false, message: 'This change has invalid data and was not stored.' }
    if (!this.storage) return { ok: false, message: 'Browser storage is unavailable. Export a backup before closing this tab.' }
    if (this.readFailed) return { ok: false, message: 'Existing storage could not be read and has been left untouched. Export your tab data and try again after reloading.' }
    if (this.corrupt && !allowReplaceCorrupt) {
      return { ok: false, message: 'The unreadable saved data must be downloaded or deliberately replaced before new changes can be stored.' }
    }
    try {
      if (!allowReplaceCorrupt && this.lastRaw !== undefined && this.storage.getItem(STORAGE_KEY) !== this.lastRaw) return { ok: false, message: 'Another tab changed this browser’s saved entries. Your changes are kept in this tab. Export a tab backup, then reload or reconcile your cloud copy.' }
      const raw = JSON.stringify(data)
      this.storage.setItem(STORAGE_KEY, raw)
      this.lastRaw = raw
      this.corrupt = false
      return { ok: true }
    } catch {
      return { ok: false, message: 'The browser could not save this change. Export a backup before closing this tab.' }
    }
  }
}
