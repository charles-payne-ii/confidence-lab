import type { AppData } from './model'
import { validateData } from './storage'

export interface CloudSnapshot { data: AppData; revision: number; updatedAt: string }
export interface CloudBackend {
  read(userId: string): Promise<CloudSnapshot | null>
  write(userId: string, data: AppData, expectedRevision: number): Promise<CloudSnapshot>
}
export class CloudConflict extends Error {}
export type CloudMode = 'signed-out' | 'loading' | 'choice' | 'ready' | 'saving' | 'error' | 'conflict'
export interface CloudState { mode: CloudMode; message: string; updatedAt?: string; remote?: CloudSnapshot; pending: boolean }
interface Journal { userId: string; snapshot: CloudSnapshot }
export const CLOUD_JOURNAL_KEY = 'confidence-lab:cloud-journal'
type JournalStorage = Pick<Storage, 'getItem' | 'setItem'> | null

// Postgres jsonb may reorder keys. Compare actual content rather than key order.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}
export const sameData = (a: AppData, b: AppData) => canonical(a) === canonical(b)
export const hasEntries = (data: AppData) => Boolean(data.practiceEntries.length || data.confidenceItems.length || data.preparations.length || data.weeklyReviews.length || data.reflectionSessions?.length || data.bank?.memories.length)
export const validSnapshot = (value: unknown): value is CloudSnapshot => {
  if (!value || typeof value !== 'object') return false
  const row = value as CloudSnapshot
  return validateData(row.data) && Number.isSafeInteger(row.revision) && row.revision > 0 && typeof row.updatedAt === 'string' && !Number.isNaN(Date.parse(row.updatedAt))
}

/** Separate from React and local storage. All writes use an expected revision. */
export class CloudSync {
  private epoch = 0
  private userId: string | null = null
  private base: CloudSnapshot | null = null
  private state: CloudState = { mode: 'signed-out', message: 'Saved in this browser only.', pending: false }
  private journal: Journal | null = null
  constructor(private backend: CloudBackend, private local: { get: () => AppData; apply: (data: AppData, explicit: boolean) => boolean }, private notify: (state: CloudState) => void, private storage: JournalStorage = null) {
    try {
      const value: unknown = JSON.parse(storage?.getItem(CLOUD_JOURNAL_KEY) ?? 'null')
      if (value && typeof value === 'object' && 'userId' in value && typeof value.userId === 'string' && 'snapshot' in value && validSnapshot(value.snapshot)) this.journal = value as Journal
    } catch { /* A missing journal requires explicit reconciliation, never an overwrite. */ }
  }
  private publish(next: CloudState) { this.state = next; this.notify(next) }
  private record(snapshot: CloudSnapshot) {
    this.base = snapshot
    this.journal = { userId: this.userId!, snapshot }
    try { this.storage?.setItem(CLOUD_JOURNAL_KEY, JSON.stringify(this.journal)) } catch { /* Cloud data is safe; next startup will ask which copy to use. */ }
  }
  stop() { this.epoch++; this.userId = null; this.base = null; this.publish({ mode: 'signed-out', message: 'Saved in this browser only.', pending: false }) }
  async connect(userId: string) {
    const epoch = ++this.epoch
    this.userId = userId
    this.publish({ mode: 'loading', message: 'Checking your cloud copy…', pending: true })
    try {
      const remote = await this.backend.read(userId)
      if (epoch !== this.epoch) return
      if (remote && !validSnapshot(remote)) throw new Error('The cloud copy is unreadable. It was not replaced.')
      const local = this.local.get()
      const known = this.journal?.userId === userId ? this.journal.snapshot : null
      if (remote && (sameData(local, remote.data) || ((!hasEntries(local) || (known && sameData(local, known.data))) && this.local.apply(remote.data, false)))) {
        this.record(remote)
        this.publish({ mode: 'ready', message: 'Saved to your cloud account.', updatedAt: remote.updatedAt, pending: false })
        return
      }
      if (remote && known && sameData(remote.data, known.data)) {
        this.record(remote)
        this.publish({ mode: 'ready', message: 'Uploading changes from this browser…', pending: true })
        this.changed()
        return
      }
      this.base = remote
      this.publish({ mode: 'choice', message: remote ? 'Choose which copy to use. Neither copy has been replaced.' : 'Start cloud storage with the entries in this browser.', remote: remote ?? undefined, pending: true })
    } catch (error) {
      if (epoch === this.epoch) this.publish({ mode: 'error', message: error instanceof Error ? error.message : 'Cloud storage could not be reached. Your browser copy remains available.', pending: true })
    }
  }
  useCloud() {
    const remote = this.state.remote
    if (!remote || !this.local.apply(remote.data, true)) return
    this.record(remote)
    this.publish({ mode: 'ready', message: 'Saved to your cloud account.', updatedAt: remote.updatedAt, pending: false })
  }
  useLocal() {
    if (!this.userId || !['choice', 'conflict'].includes(this.state.mode)) return
    this.base = this.state.remote ?? null
    this.publish({ mode: 'ready', message: 'Uploading this browser’s copy…', pending: true })
    this.changed()
  }
  changed() {
    if (!this.userId || !['ready', 'saving'].includes(this.state.mode)) return
    if (this.state.mode === 'saving') return // The active writer drains the latest local copy.
    if (this.base && sameData(this.base.data, this.local.get())) return
    void this.flush()
  }
  private async flush() {
    const epoch = this.epoch, userId = this.userId!
    this.publish({ mode: 'saving', message: 'Saving to your cloud account…', updatedAt: this.base?.updatedAt, pending: true })
    try {
      while (epoch === this.epoch) {
        const data = structuredClone(this.local.get())
        if (!validateData(data)) throw new Error('Invalid entries were not sent to cloud storage.')
        const snapshot = await this.backend.write(userId, data, this.base?.revision ?? 0)
        if (epoch !== this.epoch) return
        if (!validSnapshot(snapshot)) throw new Error('The cloud save returned unreadable data. Check your account before retrying.')
        this.record(snapshot)
        if (sameData(data, this.local.get())) {
          this.publish({ mode: 'ready', message: 'Saved to your cloud account.', updatedAt: snapshot.updatedAt, pending: false })
          return
        }
      }
    } catch (error) {
      if (epoch !== this.epoch) return
      if (error instanceof CloudConflict) {
        let remote: CloudSnapshot | null = null
        try { remote = await this.backend.read(userId) } catch { /* Retry will reconcile when online. */ }
        if (epoch !== this.epoch) return
        this.publish({ mode: 'conflict', message: 'Another device changed your cloud copy. Choose which copy to keep; your browser entries remain intact.', remote: remote && validSnapshot(remote) ? remote : undefined, pending: true })
      } else this.publish({ mode: 'error', message: error instanceof Error ? error.message : 'Cloud save failed. Your browser copy remains available.', updatedAt: this.base?.updatedAt, pending: true })
    }
  }
}
