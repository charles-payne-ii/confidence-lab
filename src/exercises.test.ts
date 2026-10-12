import { describe, expect, it } from 'vitest'
import { addSession, getSteps } from './exercises'
import { emptyData, lastLocalDates, weekStartDate } from './model'
import { DataStore, parseImport } from './storage'

const date = new Date(2026, 9, 12, 11, 30)
const base = { complete: true, durationSeconds: 25 }

describe('Connected exercises', () => {
  it('rejects empty routines, including choosing only a routine length', () => {
    expect(addSession(emptyData(), { ...base, module: 'confidence', answers: { effort: '  ' } })).toBeNull()
    expect(addSession(emptyData(), { ...base, module: 'prepare', answers: { routine: 'expanded' } })).toBeNull()
  })

  it('saves partial practices and only the evidence explicitly selected', () => {
    const saved = addSession(emptyData(), { ...base, module: 'confidence', complete: false, answers: { effort: '  Completed a focused session  ', success: 'Recovered after a mistake' }, bankFields: ['success'] }, date)!
    expect(saved.data.practiceEntries[0]).toMatchObject({ effort: 'Completed a focused session', complete: false, localDate: '2026-10-12' })
    expect(saved.data.confidenceItems).toHaveLength(1)
    expect(saved.data.confidenceItems[0]).toMatchObject({ type: 'Success', detail: 'Recovered after a mistake', sourcePracticeId: saved.id })
    expect(parseImport(JSON.stringify(saved.data)).ok).toBe(true)
  })

  it('keeps selected evidence as a snapshot when a bank example is later deleted', () => {
    const first = addSession(emptyData(), { ...base, module: 'confidence', answers: { effort: 'Practised calmly' }, bankFields: ['effort'] }, date)!
    const example = first.data.confidenceItems[0]
    const evidenceOnly = addSession(first.data, { ...base, module: 'prepare', answers: { routine: 'quick' }, confidenceItemId: example.id }, date)!
    expect(evidenceOnly.data.preparations[0].evidence).toBe('')
    expect(evidenceOnly.data.preparations[0].confidenceSnapshot).toContain('Practised calmly')
    const prepared = addSession(first.data, { ...base, module: 'prepare', answers: { challenge: 'Client pitch', cue: 'Slow and clear', first: 'Greet the room' }, confidenceItemId: example.id }, date)!
    prepared.data.confidenceItems = []
    expect(prepared.data.preparations[0].confidenceSnapshot).toContain('Practised calmly')
  })

  it('records expanded rehearsal and ignores hidden expanded answers in quick routines', () => {
    const expanded = addSession(emptyData(), { ...base, module: 'prepare', answers: { routine: 'expanded', challenge: 'Pitch', setting: 'Meeting room', actions: 'Stand, speak, pause', difficulty: 'Hard question', plan: 'Pause, then answer' } }, date)!
    expect(expanded.data.preparations[0]).toMatchObject({ setting: 'Meeting room', rehearsalActions: 'Stand, speak, pause', plannedResponse: 'Pause, then answer' })
    const quick = addSession(emptyData(), { ...base, module: 'prepare', answers: { routine: 'quick', setting: 'Hidden text' } })
    expect(quick).toBeNull()
    expect(getSteps('prepare').some((step) => step.key === 'rehearse')).toBe(false)
  })

  it('round-trips new pressure and setback entries together with original data', () => {
    const first = addSession(emptyData(), { ...base, module: 'confidence', answers: { progress: 'Steadier opening' } }, date)!
    const pressure = addSession(first.data, { ...base, module: 'pressure', answers: { breath: 'Completed (60s)', next: 'Read the first line' } }, date)!
    const setback = addSession(pressure.data, { ...base, module: 'setbacks', answers: { facts: 'Missed a deadline', next: 'Ask for a revised schedule' } }, date)!
    expect(setback.data.reflectionSessions).toHaveLength(2)
    expect(parseImport(JSON.stringify(setback.data))).toEqual({ ok: true, data: setback.data })
    expect(setback.data.practiceEntries).toHaveLength(1)
  })

  it('uses local calendar arithmetic around the week and month boundary', () => {
    expect(weekStartDate(new Date(2026, 10, 1, 23, 59))).toBe('2026-10-26')
    expect(lastLocalDates(3, new Date(2026, 10, 1))).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('leaves unreadable storage untouched if reads fail', () => {
    let written = false
    const store = new DataStore({ getItem() { throw new Error('read denied') }, setItem() { written = true } })
    expect(store.load().status).toBe('unavailable')
    expect(store.save(emptyData(), true).ok).toBe(false)
    expect(written).toBe(false)
  })

  it('rejects malformed new fields throughout an import', () => {
    const saved = addSession(emptyData(), { ...base, module: 'pressure', answers: { next: 'Pause' } }, date)!
    expect(parseImport(JSON.stringify({ ...saved.data, reflectionSessions: [{ ...saved.data.reflectionSessions![0], answers: { next: 3 } }] })).ok).toBe(false)
    expect(parseImport(JSON.stringify({ ...saved.data, completedActions: ['ok', 1] })).ok).toBe(false)
    expect(parseImport(JSON.stringify({ ...saved.data, practiceEntries: [{ id: saved.id }] })).ok).toBe(false)
  })
})
