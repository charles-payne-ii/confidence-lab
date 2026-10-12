import { describe, expect, it, vi } from 'vitest'
import { CloudConflict, CloudSync, CLOUD_JOURNAL_KEY, sameData, type CloudBackend, type CloudSnapshot, type CloudState } from './cloud'
import { emptyData, type AppData } from './model'
import { saveMemory } from './bank'

const stamp = '2026-10-12T12:00:00.000Z'
const snapshot = (data: AppData, revision = 1): CloudSnapshot => ({ data: structuredClone(data), revision, updatedAt: stamp })
const populated = (title = 'Answered a question') => {
  const result = saveMemory(emptyData(), { title, happened: 'Paused, checked the figures, and answered.', evidence: ['Preparation'], feelings: ['Calm'] })
  if (!result.ok) throw new Error(result.message)
  return result.data
}
function setup(local = populated(), remote: CloudSnapshot | null = null, journal?: { userId: string; snapshot: CloudSnapshot }) {
  let current = local
  const values = new Map<string, string>(journal ? [[CLOUD_JOURNAL_KEY, JSON.stringify(journal)]] : [])
  const states: CloudState[] = []
  let cloud = remote
  const backend: CloudBackend = {
    read: vi.fn(async () => cloud && structuredClone(cloud)),
    write: vi.fn(async (_id, data, revision) => {
      if ((cloud?.revision ?? 0) !== revision) throw new CloudConflict()
      cloud = snapshot(data, revision + 1)
      return structuredClone(cloud)
    }),
  }
  const apply = vi.fn((data: AppData) => { current = data; return true })
  const sync = new CloudSync(backend, { get: () => current, apply }, (state) => states.push(state), { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } })
  return { sync, backend, states, values, apply, local: () => current, cloud: () => cloud, change: (data: AppData) => { current = data; sync.changed() }, setRemote: (data: CloudSnapshot) => { cloud = data } }
}
const settled = async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }

describe('Cloud reconciliation and persistence', () => {
  it('sends no entries before an account is connected and the first upload is chosen', async () => {
    const test = setup()
    test.change(populated('Practised'))
    expect(test.backend.write).not.toHaveBeenCalled()
    await test.sync.connect('a')
    expect(test.states.at(-1)?.mode).toBe('choice')
    expect(test.backend.write).not.toHaveBeenCalled()
    test.sync.useLocal(); await settled()
    expect(test.cloud()?.data).toEqual(test.local())
    expect(test.states.at(-1)?.mode).toBe('ready')
  })
  it('restores cloud entries into an empty browser', async () => {
    const remote = snapshot(populated()), test = setup(emptyData(), remote)
    await test.sync.connect('a')
    expect(test.local()).toEqual(remote.data)
    expect(test.backend.write).not.toHaveBeenCalled()
    expect(test.states.at(-1)?.mode).toBe('ready')
  })
  it('serializes saves and drains newer edits made while a write is in flight', async () => {
    const original = populated(), test = setup(original, snapshot(original))
    await test.sync.connect('a')
    const first = populated('First edit'), second = populated('Second edit')
    let release: ((value: CloudSnapshot) => void) | undefined
    vi.mocked(test.backend.write).mockImplementationOnce(async () => new Promise((resolve) => { release = resolve }))
    test.change(first); test.change(second)
    expect(test.backend.write).toHaveBeenCalledTimes(1)
    test.setRemote(snapshot(first, 2)); release!(snapshot(first, 2)); await settled()
    expect(test.backend.write).toHaveBeenCalledTimes(2)
    expect(test.cloud()?.data).toEqual(second)
    expect(test.cloud()?.revision).toBe(3)
    expect(test.states.at(-1)?.pending).toBe(false)
  })
  it('uploads offline edits when the known cloud revision has not changed', async () => {
    const old = populated(), local = populated('Offline edit'), remote = snapshot(old, 3)
    const test = setup(local, remote, { userId: 'a', snapshot: remote })
    await test.sync.connect('a'); await settled()
    expect(test.cloud()?.data).toEqual(local)
    expect(test.cloud()?.revision).toBe(4)
  })
  it('requires an explicit choice when both copies changed', async () => {
    const known = snapshot(populated(), 1), local = populated('Local edit'), remote = snapshot(populated('Other device'), 2)
    const test = setup(local, remote, { userId: 'a', snapshot: known })
    await test.sync.connect('a')
    expect(test.states.at(-1)?.mode).toBe('choice')
    expect(test.local()).toEqual(local)
    expect(test.cloud()).toEqual(remote)
    test.sync.useCloud()
    expect(test.local()).toEqual(remote.data)
    expect(test.backend.write).not.toHaveBeenCalled()
  })
  it('detects another device changing the cloud copy before a write', async () => {
    const original = populated(), test = setup(original, snapshot(original))
    await test.sync.connect('a')
    const remote = snapshot(populated('Other device'), 2)
    test.setRemote(remote)
    const local = populated('Local edit'); test.change(local); await settled()
    expect(test.states.at(-1)?.mode).toBe('conflict')
    expect(test.local()).toEqual(local)
    expect(test.cloud()).toEqual(remote)
    test.sync.useLocal(); await settled()
    expect(test.cloud()?.revision).toBe(3)
    expect(test.cloud()?.data).toEqual(local)
  })
  it('keeps local edits after failure and reconciles before retrying', async () => {
    const original = populated(), test = setup(original, snapshot(original))
    await test.sync.connect('a')
    vi.mocked(test.backend.write).mockRejectedValueOnce(new Error('offline'))
    const local = populated('Still here'); test.change(local); await settled()
    expect(test.local()).toEqual(local)
    expect(test.states.at(-1)?.mode).toBe('error')
    expect(test.cloud()?.data).toEqual(original)
    await test.sync.connect('a'); await settled()
    expect(test.cloud()?.data).toEqual(local)
  })
  it('does not replace corrupt cloud data or a form currently being edited', async () => {
    const test = setup(emptyData(), snapshot(populated()))
    test.apply.mockImplementation(() => false)
    await test.sync.connect('a')
    expect(test.states.at(-1)?.mode).toBe('choice')
    expect(test.local()).toEqual(emptyData())
    const broken = setup()
    vi.mocked(broken.backend.read).mockResolvedValue({ ...snapshot(emptyData()), data: { version: 99 } as unknown as AppData })
    await broken.sync.connect('a')
    expect(broken.states.at(-1)?.mode).toBe('error')
    expect(broken.backend.write).not.toHaveBeenCalled()
  })
  it('does not carry one account’s entries into another account automatically', async () => {
    const remote = snapshot(populated()), local = populated('Belongs to account A')
    const test = setup(local, remote, { userId: 'a', snapshot: remote })
    await test.sync.connect('b')
    expect(test.states.at(-1)?.mode).toBe('choice')
    expect(test.backend.write).not.toHaveBeenCalled()
    expect(test.local()).toEqual(local)
  })
  it('ignores in-flight completions after signing out', async () => {
    const original = populated(), test = setup(original, snapshot(original))
    await test.sync.connect('a')
    let release: ((value: CloudSnapshot) => void) | undefined
    vi.mocked(test.backend.write).mockImplementationOnce(async () => new Promise((resolve) => { release = resolve }))
    test.change(populated('Edit')); test.sync.stop(); release!(snapshot(populated(), 2)); await settled()
    expect(test.states.at(-1)?.mode).toBe('signed-out')
    expect(JSON.parse(test.values.get(CLOUD_JOURNAL_KEY)!).snapshot.revision).toBe(1)
  })
  it('recognizes an acknowledged-late save after a network failure', async () => {
    const original = populated(), test = setup(original, snapshot(original))
    await test.sync.connect('a')
    vi.mocked(test.backend.write).mockImplementationOnce(async (_id, data) => { test.setRemote(snapshot(data, 2)); throw new Error('lost acknowledgement') })
    const edit = populated('New'); test.change(edit); await settled()
    await test.sync.connect('a')
    expect(test.states.at(-1)?.mode).toBe('ready')
    expect(test.backend.write).toHaveBeenCalledTimes(1)
  })
  it('compares JSON content regardless of Postgres object key order', () => {
    const data = emptyData(), reordered = { weeklyReviews: [], confidenceItems: [], preparations: [], practiceEntries: [], version: 1 } as AppData
    expect(sameData(data, reordered)).toBe(true)
  })
})
