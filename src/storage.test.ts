import { describe, expect, it } from 'vitest'
import { countDistinctPracticeDays, emptyData, lastLocalDates, localDate, type AppData } from './model'
import { DataStore, STORAGE_KEY, parseImport, validateData } from './storage'

class MemoryStorage {
  value: string | null = null
  failWrite = false
  getItem() { return this.value }
  setItem(_key: string, value: string) {
    if (this.failWrite) throw new Error('full')
    this.value = value
  }
}

const populated = (): AppData => ({
  ...emptyData(),
  practiceEntries: [{
    id: 'practice-1', createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z',
    localDate: localDate(new Date(2026, 9, 12)), effort: 'Serving consistently', success: 'Stayed composed',
    progress: '', nextAction: 'Practise ten serves',
  }],
})

describe('Performance Lab storage', () => {
  it('persists a complete dataset and restores it', () => {
    const memory = new MemoryStorage()
    const store = new DataStore(memory)
    const data = populated()
    expect(store.save(data)).toEqual({ ok: true })
    expect(store.load()).toEqual({ status: 'ok', data })
  })

  it('supports editing and deletion through whole-dataset saves', () => {
    const memory = new MemoryStorage()
    const store = new DataStore(memory)
    const data = populated()
    data.practiceEntries[0].success = 'Recovered after an error'
    expect(store.save(data).ok).toBe(true)
    const edited = store.load()
    expect(edited.data.practiceEntries[0].success).toBe('Recovered after an error')
    const deleted = { ...edited.data, practiceEntries: [] }
    expect(store.save(deleted).ok).toBe(true)
    expect(store.load().data.practiceEntries).toHaveLength(0)
  })

  it('validates the entire backup before accepting it', () => {
    const exported = JSON.stringify(populated())
    expect(parseImport(exported)).toEqual({ ok: true, data: populated() })
    expect(validateData({ ...populated(), preparations: [{ id: 4 }] })).toBe(false)
    expect(parseImport('{"version":1}').ok).toBe(false)
    expect(parseImport('not json').ok).toBe(false)
  })

  it('counts distinct local calendar days rather than entries', () => {
    const first = populated().practiceEntries[0]
    const entries = [first, { ...first, id: 'practice-2' }, { ...first, id: 'practice-3', localDate: '2026-10-11' }]
    const days = lastLocalDates(7, new Date(2026, 9, 12, 23, 30))
    expect(countDistinctPracticeDays(entries, days)).toBe(2)
  })

  it('does not touch existing storage when an import is invalid', () => {
    const memory = new MemoryStorage()
    memory.value = JSON.stringify(populated())
    expect(parseImport('{"version":1}').ok).toBe(false)
    expect(memory.value).toBe(JSON.stringify(populated()))
  })

  it('rejects malformed dates and duplicate stable IDs', () => {
    const malformedDate = populated()
    malformedDate.practiceEntries[0].localDate = '2026-02-31'
    expect(validateData(malformedDate)).toBe(false)

    const duplicate = populated()
    duplicate.confidenceItems.push({
      id: 'practice-1', createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z',
      title: 'Duplicate', detail: 'Should be rejected',
    })
    expect(validateData(duplicate)).toBe(false)
  })

  it('leaves corrupt saved data intact and blocks accidental overwrite', () => {
    const memory = new MemoryStorage()
    memory.value = '{broken'
    const store = new DataStore(memory)
    expect(store.load().status).toBe('corrupt')
    expect(store.save(populated()).ok).toBe(false)
    expect(memory.value).toBe('{broken')
    expect(store.save(populated(), true).ok).toBe(true)
  })

  it('reports failed writes without changing the existing backup', () => {
    const memory = new MemoryStorage()
    memory.value = JSON.stringify(emptyData())
    memory.failWrite = true
    const store = new DataStore(memory)
    expect(store.save(populated()).ok).toBe(false)
    expect(memory.value).toBe(JSON.stringify(emptyData()))
  })

  it('uses the stable storage key', () => {
    expect(STORAGE_KEY).toBe('performance-lab:data')
  })

  it('keeps another tab’s newer entries intact instead of overwriting them', () => {
    const memory = new MemoryStorage()
    memory.value = JSON.stringify(emptyData())
    const first = new DataStore(memory), second = new DataStore(memory)
    first.load(); second.load()
    expect(second.save(populated()).ok).toBe(true)
    const latest = memory.value
    expect(first.save(emptyData()).ok).toBe(false)
    expect(memory.value).toBe(latest)
    expect(first.save(emptyData(), true).ok).toBe(true)
  })
})
