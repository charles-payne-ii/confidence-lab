import { localDate, newId, type AppData, type BankState, type Memory } from './model'

export const BANK_LIMIT = 10
export const DAILY_RECALL_WHEN_FULL = false
export const EVIDENCE = ['Courage', 'Preparation', 'Persistence', 'Skill', 'Judgment', 'Leadership', 'Calm']
export const FEELINGS = ['Proud', 'Calm', 'Strong', 'Relieved', 'Energized', 'Capable', 'Focused']
export type MemoryDraft = Pick<Memory, 'title' | 'happened' | 'evidence' | 'feelings' | 'type'>
export const emptyDraft = (): MemoryDraft => ({ title: '', happened: '', evidence: [], feelings: [] })
export const readBank = (data: AppData): BankState => data.bank ?? { memories: [], rotation: [] }

const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
export const milestoneLabel = (count: number) => count >= 10 ? 'Complete' : count >= 7 ? 'Strong bank' : count >= 3 ? 'Foundation set' : ''
export function milestoneLine(count: number): string {
  if (count <= 0) return 'Three set your foundation.'
  if (count < 3) return `${words[3 - count]} more ${count === 2 ? 'sets' : 'set'} your foundation.`
  if (count < 7) return `Foundation set. ${words[7 - count]} more for a strong bank.`
  if (count < 10) return `Strong bank. ${words[10 - count]} more to complete it.`
  return 'Your Confidence Bank is complete.'
}

export function saveMemory(data: AppData, draft: MemoryDraft, editingId?: string, date = new Date()): { ok: true; data: AppData } | { ok: false; message: string } {
  const bank = readBank(data)
  const previous = editingId ? bank.memories.find((memory) => memory.id === editingId) : undefined
  if (editingId && !previous) return { ok: false, message: 'That memory no longer exists. Return to the bank and try again.' }
  if (!previous && bank.memories.length >= BANK_LIMIT) return { ok: false, message: 'Your bank has ten memories. Delete one before adding another.' }
  if (!draft.title.trim() || !draft.happened.trim() || draft.happened.length > 300 || !draft.evidence.some((value) => value.trim()) || !draft.feelings.some((value) => value.trim())) return { ok: false, message: 'Complete all four memory steps. Keep What happened within 300 characters.' }
  const now = date.toISOString()
  const memory: Memory = { ...draft, id: previous?.id ?? newId(), title: draft.title.trim(), happened: draft.happened.trim(), evidence: draft.evidence.filter((value) => value.trim()), feelings: draft.feelings.filter((value) => value.trim()), createdAt: previous?.createdAt ?? now, updatedAt: now }
  const memories = previous ? bank.memories.map((item) => item.id === previous.id ? memory : item) : [...bank.memories, memory]
  const rotation = !previous && bank.rotation.length ? [...bank.rotation, memory.id] : bank.rotation
  return { ok: true, data: { ...data, bank: { ...bank, memories, rotation } } }
}

export function deleteMemory(data: AppData, id: string): AppData {
  const bank = readBank(data)
  return { ...data, bank: { ...bank, memories: bank.memories.filter((memory) => memory.id !== id), rotation: bank.rotation.filter((item) => item !== id) } }
}

export function planBankOpen(data: AppData, date = new Date(), random = Math.random): { screen: 'home' | 'intro' | 'remember'; data: AppData; memory?: Memory } {
  const bank = readBank(data)
  const today = localDate(date)
  if (bank.lastDailyDate === today) return { screen: 'home', data }
  // Mark the first open even at capacity, so deleting later cannot trigger a second daily gate.
  const next = { ...bank, lastDailyDate: today }
  if (!next.memories.length) return { screen: 'intro', data: { ...data, bank: next } }
  if (next.memories.length === BANK_LIMIT && !(next.dailyRecallWhenFull ?? DAILY_RECALL_WHEN_FULL)) return { screen: 'home', data: { ...data, bank: next } }
  let rotation = next.rotation.filter((id) => next.memories.some((memory) => memory.id === id))
  if (!rotation.length) {
    rotation = next.memories.map((memory) => memory.id)
    for (let i = rotation.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[rotation[i], rotation[j]] = [rotation[j], rotation[i]]
    }
  }
  const memory = next.memories.find((item) => item.id === rotation[0])!
  return { screen: 'remember', memory, data: { ...data, bank: { ...next, rotation: rotation.slice(1) } } }
}

export function bankEvidence(data: AppData) {
  return [...readBank(data).memories.map((memory) => ({ id: memory.id, title: memory.title, detail: memory.happened })), ...data.confidenceItems.map(({ id, title, detail }) => ({ id, title, detail }))]
}
