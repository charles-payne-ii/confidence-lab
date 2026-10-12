import { describe, expect, it } from 'vitest'
import { deleteMemory, emptyDraft, milestoneLine, planBankOpen, readBank, saveMemory } from './bank'
import { emptyData, localDate, type AppData } from './model'
import { DataStore, parseImport, validateData } from './storage'
import { addSession } from './exercises'

const date = new Date(2026, 9, 12, 10)
const draft = { title: 'Led the presentation', happened: 'The client asked hard questions. I answered each with data.', evidence: ['Preparation', 'Stayed with it'], feelings: ['Proud', 'Relieved'], type: 'success' as const }
function populated(count: number): AppData {
  let data = emptyData()
  for (let i = 0; i < count; i++) { const saved = saveMemory(data, { ...draft, title: `${draft.title} ${i}` }, undefined, date); if (!saved.ok) throw new Error(saved.message); data = saved.data }
  return data
}

describe('Confidence Bank', () => {
  it('saves only user words and preserves stable IDs and creation dates while editing', () => {
    const first = populated(1), memory = readBank(first).memories[0]
    const edited = saveMemory(first, { ...draft, title: 'Led another presentation', feelings: ['Uncertain'] }, memory.id, new Date(2026, 9, 13))
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(readBank(edited.data).memories[0]).toMatchObject({ id: memory.id, createdAt: memory.createdAt, feelings: ['Uncertain'], happened: draft.happened, evidence: draft.evidence })
    expect(readBank(edited.data).memories[0].updatedAt).not.toBe(memory.updatedAt)
  })
  it('requires all four meaningful answers and a 300 character limit', () => {
    for (const incomplete of [emptyDraft(), { ...draft, title: '  ' }, { ...draft, happened: '  ' }, { ...draft, evidence: [' '] }, { ...draft, feelings: [] }, { ...draft, happened: 'x'.repeat(301) }]) expect(saveMemory(emptyData(), incomplete).ok).toBe(false)
    expect(saveMemory(emptyData(), { ...draft, happened: 'x'.repeat(300) }).ok).toBe(true)
  })
  it('enforces ten memories but still allows edits at capacity', () => {
    const full = populated(10)
    expect(saveMemory(full, draft).ok).toBe(false)
    expect(saveMemory(full, draft, readBank(full).memories[0].id).ok).toBe(true)
    expect(saveMemory(full, draft, 'missing').ok).toBe(false)
  })
  it('opens Intro only once on the local day, even when skipped', () => {
    const first = planBankOpen(emptyData(), date)
    expect(first.screen).toBe('intro')
    expect(readBank(first.data).lastDailyDate).toBe(localDate(date))
    expect(planBankOpen(first.data, new Date(2026, 9, 12, 23, 59)).screen).toBe('home')
    expect(planBankOpen(first.data, new Date(2026, 9, 13)).screen).toBe('intro')
  })
  it('offers Recall with one through nine memories and marks the day on opening', () => {
    for (let i = 1; i < 10; i++) {
      const first = planBankOpen(populated(i), date, () => .5)
      expect(first.screen).toBe('remember')
      expect(first.memory).toBeDefined()
      expect(planBankOpen(first.data, date).screen).toBe('home')
    }
  })
  it('opens Home at capacity by default and has a runtime recall setting', () => {
    const full = populated(10)
    const first = planBankOpen(full, date)
    expect(first.screen).toBe('home')
    const removed = deleteMemory(first.data, readBank(first.data).memories[0].id)
    expect(planBankOpen(removed, date).screen).toBe('home')
    full.bank!.dailyRecallWhenFull = true
    expect(planBankOpen(full, date).screen).toBe('remember')
  })
  it('recalls each memory once before refilling the rotation', () => {
    let data = populated(4)
    const recalled: string[] = []
    for (let i = 0; i < 4; i++) {
      const next = planBankOpen(data, new Date(2026, 9, 12 + i), () => .25)
      recalled.push(next.memory!.id); data = next.data
    }
    expect(new Set(recalled).size).toBe(4)
    expect(readBank(data).rotation).toEqual([])
    expect(planBankOpen(data, new Date(2026, 9, 16)).memory).toBeDefined()
  })
  it('removes deleted IDs from rotation and appends new memories to an active queue', () => {
    const opened = planBankOpen(populated(3), date)
    const queued = readBank(opened.data).rotation
    const added = saveMemory(opened.data, draft)
    if (!added.ok) throw new Error(added.message)
    expect(readBank(added.data).rotation.slice(0, -1)).toEqual(queued)
    const removed = deleteMemory(added.data, queued[0])
    expect(readBank(removed).rotation).not.toContain(queued[0])
    expect(readBank(removed).memories).toHaveLength(3)
  })
  it('round-trips the complete bank with older version 1 backups still accepted', () => {
    const data = planBankOpen(populated(3), date).data
    const values = new Map<string,string>()
    const store = new DataStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } })
    expect(store.save(data).ok).toBe(true)
    expect(store.load().data).toEqual(data)
    expect(parseImport(JSON.stringify(data))).toEqual({ ok: true, data })
    expect(parseImport(JSON.stringify(emptyData())).ok).toBe(true)
  })
  it('rejects invalid banks throughout an import', () => {
    const data = populated(1), bank = readBank(data), memory = bank.memories[0]
    for (const invalid of [{ ...bank, memories: [...Array(11)].map((_, i) => ({ ...memory, id: `${i}` })) }, { ...bank, rotation: ['missing'] }, { ...bank, rotation: [memory.id, memory.id] }, { ...bank, lastDailyDate: '2026-02-31' }, { ...bank, dailyRecallWhenFull: 'yes' }, ...[{ ...memory, evidence: [false] }, { ...memory, feelings: [] }, { ...memory, happened: 'x'.repeat(301) }, { ...memory, type: 'invented' }].map((bad) => ({ ...bank, memories: [bad] }))]) {
      expect(validateData({ ...data, bank: invalid })).toBe(false)
    }
    expect(validateData({ ...data, bank: { ...bank, memories: [memory, memory] } })).toBe(false)
  })
  it('keeps preparation evidence after its source memory is deleted', () => {
    const data = populated(1), memory = readBank(data).memories[0]
    const saved = addSession(data, { module: 'prepare', answers: {}, complete: false, durationSeconds: 1, confidenceItemId: memory.id })!
    const removed = deleteMemory(saved.data, memory.id)
    expect(removed.preparations[0].confidenceSnapshot).toBe(`${memory.title}: ${memory.happened}`)
  })
  it('uses the specified milestone wording at each boundary', () => {
    expect([0, 1, 2, 3, 6, 7, 9, 10].map(milestoneLine)).toEqual(['Three set your foundation.', 'Two more set your foundation.', 'One more sets your foundation.', 'Foundation set. Four more for a strong bank.', 'Foundation set. One more for a strong bank.', 'Strong bank. Three more to complete it.', 'Strong bank. One more to complete it.', 'Your Confidence Bank is complete.'])
  })
})
