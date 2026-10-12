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

const validSetback = (value: unknown): boolean =>
  isRecord(value) && isString(value.facts) && isString(value.meaning) && isString(value.control)

const validPractice = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value)) return false
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
  if (!isRecord(value) || !hasBaseFields(value)) return false
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
    (value.review === undefined || validReview(value.review))
  )
}

const validWeekly = (value: unknown): boolean => {
  if (!isRecord(value) || !hasBaseFields(value)) return false
  return (
    isLocalDate(value.localDate) &&
    isString(value.evidence) &&
    isString(value.helped) &&
    isString(value.practiseNextWeek)
  )
}

export const validateData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.version !== DATA_VERSION) return false
  if (
    !Array.isArray(value.practiceEntries) ||
    !Array.isArray(value.confidenceItems) ||
    !Array.isArray(value.preparations) ||
    !Array.isArray(value.weeklyReviews)
  ) return false

  const records = [...value.practiceEntries, ...value.confidenceItems, ...value.preparations, ...value.weeklyReviews]
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
      return { ok: false, message: 'This file is not a complete Performance Lab version 1 backup.' }
    }
    return { ok: true, data: parsed }
  } catch {
    return { ok: false, message: 'This file is not valid JSON.' }
  }
}

export class DataStore {
  private storage: StorageLike | null
  private corrupt = false

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
      if (raw === null) return { status: 'empty', data: emptyData() }
      const parsed = parseImport(raw)
      if (!parsed.ok) {
        this.corrupt = true
        return { status: 'corrupt', data: emptyData(), raw, message: `${parsed.message} The original saved value has been left untouched.` }
      }
      return { status: 'ok', data: parsed.data }
    } catch {
      return { status: 'unavailable', data: emptyData(), message: 'Saved data could not be read. Changes will last only for this tab.' }
    }
  }

  save(data: AppData, allowReplaceCorrupt = false): SaveResult {
    if (!this.storage) return { ok: false, message: 'Browser storage is unavailable. Export a backup before closing this tab.' }
    if (this.corrupt && !allowReplaceCorrupt) {
      return { ok: false, message: 'The unreadable saved data must be downloaded or deliberately replaced before new changes can be stored.' }
    }
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
      this.corrupt = false
      return { ok: true }
    } catch {
      return { ok: false, message: 'The browser could not save this change. Export a backup before closing this tab.' }
    }
  }
}
