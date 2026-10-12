import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { MODULES, getSteps } from './exercises'
import { emptyData, hasMeaningfulText, localDate, newId, weekStartDate, type AppData, type EvidenceType, type ModuleId } from './model'
import { parseImport } from './storage'
import { download, Field, formatDate, Notice, type Commit } from './ui'

interface RecordField { key: string; label: string; value: string; readonly?: boolean }
interface HistoryRecord { id: string; kind: 'practice' | 'preparation' | 'reflection' | 'weekly'; title: string; date: string; createdAt: string; complete?: boolean; fields: RecordField[] }

const fields = (values: Array<[string, string, string | undefined]>): RecordField[] => values.map(([key, label, value]) => ({ key, label, value: value || '' }))

export function historyRecords(data: AppData): HistoryRecord[] {
  return [
    ...data.practiceEntries.map((item): HistoryRecord => ({ id: item.id, kind: 'practice', title: 'Build Confidence', date: item.localDate, createdAt: item.createdAt, complete: item.complete,
      fields: fields([['effort', 'Effort', item.effort], ['success', 'Success', item.success], ['progress', 'Progress', item.progress], ['nextAction', 'Next action', item.nextAction],
        ...(item.setback ? [['facts', 'Setback facts', item.setback.facts], ['meaning', 'Meaning I gave it', item.setback.meaning], ['control', 'What I can control', item.setback.control]] as Array<[string, string, string]> : []),
      ]) })),
    ...data.preparations.map((item): HistoryRecord => ({ id: item.id, kind: 'preparation', title: 'Prepare to Perform', date: item.localDate, createdAt: item.createdAt, complete: item.complete,
      fields: [{ key: 'confidenceSnapshot', label: 'Evidence reviewed', value: item.confidenceSnapshot || '', readonly: true }, ...fields([
        ['challenge', 'Challenge', item.challenge], ['evidence', 'Preparation evidence', item.evidence], ['focusCue', 'Focus cue', item.focusCue], ['firstAction', 'First action', item.firstAction],
        ...(item.routine === 'expanded' ? [['setting', 'Setting', item.setting], ['rehearsalActions', 'Rehearsed actions', item.rehearsalActions], ['likelyDifficulty', 'Likely difficulty', item.likelyDifficulty], ['plannedResponse', 'Planned response', item.plannedResponse]] as Array<[string, string, string]> : []),
      ])] })),
    ...(data.reflectionSessions ?? []).map((item): HistoryRecord => ({ id: item.id, kind: 'reflection', title: MODULES.find((module) => module.id === item.module)!.title, date: item.localDate, createdAt: item.createdAt, complete: item.complete,
      fields: getSteps(item.module).map((step) => ({ key: step.key, label: step.label, value: item.answers[step.key] || '' })) })),
    ...data.weeklyReviews.map((item): HistoryRecord => ({ id: item.id, kind: 'weekly', title: 'Weekly Review', date: item.localDate, createdAt: item.createdAt,
      fields: fields([['evidence', 'Evidence of progress', item.evidence], ['helped', 'What helped', item.helped], ['practiseNextWeek', 'Practise next week', item.practiseNextWeek]]) })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function EventReview({ id, data, commit }: { id: string; data: AppData; commit: Commit }) {
  const preparation = data.preparations.find((item) => item.id === id)!
  const [editing, setEditing] = useState(false)
  const blank = { worked: '', change: '', practiseNext: '' }
  const [draft, setDraft] = useState(blank)
  const [error, setError] = useState('')
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!hasMeaningfulText(...Object.values(draft))) { setError('Write at least one answer before saving.'); return }
    const now = new Date().toISOString()
    const review = { ...draft, createdAt: preparation.review?.createdAt || now, updatedAt: now }
    const next = { ...data, preparations: data.preparations.map((item) => item.id === id ? { ...item, review, updatedAt: now } : item) }
    if (commit(next)) setEditing(false)
  }
  const remove = () => {
    if (!window.confirm('Delete this event review? The preparation will remain.')) return
    const next = structuredClone(data)
    const item = next.preparations.find((item) => item.id === id)!
    delete item.review
    item.updatedAt = new Date().toISOString()
    commit(next)
  }
  return <section className="linked-review" aria-label="Linked event review"><h3>After the event</h3>
    {preparation.review && !editing && <><p className="muted">Reviewed {formatDate(localDate(new Date(preparation.review.createdAt)))}</p><dl className="summary-rows">{fields([['worked', 'What worked', preparation.review.worked], ['change', 'What should change', preparation.review.change], ['practiseNext', 'Practise next', preparation.review.practiseNext]]).filter((field) => field.value).map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><button className="text-button danger" onClick={remove}>Delete review</button></>}
    {!editing && <button className="button secondary" onClick={() => { setDraft(preparation.review ? { worked: preparation.review.worked, change: preparation.review.change, practiseNext: preparation.review.practiseNext } : blank); setError(''); setEditing(true) }}>{preparation.review ? 'Edit event review' : 'Add event review'}</button>}
    {editing && <form className="stack" onSubmit={save}><Field label="What worked?" value={draft.worked} onChange={(value) => setDraft({ ...draft, worked: value })} /><Field label="What should I change?" value={draft.change} onChange={(value) => setDraft({ ...draft, change: value })} /><Field label="What will I practise next?" value={draft.practiseNext} onChange={(value) => setDraft({ ...draft, practiseNext: value })} />{error && <Notice error>{error}</Notice>}<div className="button-row"><button className="button">Save review</button><button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button></div></form>}
  </section>
}

function HistoryCard({ record, data, commit }: { record: HistoryRecord; data: AppData; commit: Commit }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState('')
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft || !hasMeaningfulText(...Object.values(draft))) { setError('Keep at least one meaningful answer.'); return }
    const next = structuredClone(data)
    const now = new Date().toISOString()
    if (record.kind === 'practice') {
      const item = next.practiceEntries.find((item) => item.id === record.id)!
      Object.assign(item, { effort: draft.effort, success: draft.success, progress: draft.progress, nextAction: draft.nextAction, updatedAt: now })
      if (item.setback) item.setback = { facts: draft.facts, meaning: draft.meaning, control: draft.control }
    } else if (record.kind === 'preparation') {
      const item = next.preparations.find((item) => item.id === record.id)!
      Object.assign(item, draft, { updatedAt: now })
    } else if (record.kind === 'reflection') {
      const item = next.reflectionSessions!.find((item) => item.id === record.id)!
      item.answers = draft
      item.updatedAt = now
    } else {
      const item = next.weeklyReviews.find((item) => item.id === record.id)!
      Object.assign(item, draft, { updatedAt: now })
    }
    if (commit(next)) setDraft(null)
  }
  const remove = () => {
    if (!window.confirm(`Delete this ${record.title} entry from ${formatDate(record.date)}?${record.kind === 'preparation' ? ' Its event review will also be deleted.' : ''} This cannot be undone.`)) return
    const next = structuredClone(data)
    if (record.kind === 'practice') next.practiceEntries = next.practiceEntries.filter((item) => item.id !== record.id)
    else if (record.kind === 'preparation') next.preparations = next.preparations.filter((item) => item.id !== record.id)
    else if (record.kind === 'reflection') next.reflectionSessions = next.reflectionSessions!.filter((item) => item.id !== record.id)
    else next.weeklyReviews = next.weeklyReviews.filter((item) => item.id !== record.id)
    next.completedActions = (next.completedActions ?? []).filter((key) => !key.startsWith(`${record.id}:`))
    commit(next)
  }
  return <article className="history-card">
    <button className="record-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><strong>{record.title}</strong><small>{formatDate(record.date)}</small><span>{record.fields.find((field) => field.value && !field.readonly)?.value || 'Saved entry'}</span><small>{record.complete === false ? 'Partial' : 'View'} {open ? '−' : '+'}</small></button>
    {open && <div className="record-body">
      {draft ? <form className="stack" onSubmit={save}>{record.fields.filter((field) => !field.readonly).map((field) => <Field key={field.key} label={field.label} value={draft[field.key]} onChange={(value) => setDraft({ ...draft, [field.key]: value })} />)}{error && <Notice error>{error}</Notice>}<div className="button-row"><button className="button">Save changes</button><button className="text-button" type="button" onClick={() => setDraft(null)}>Cancel</button></div></form> : <><dl className="summary-rows">{record.fields.filter((field) => field.value).map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl><div className="card-actions"><button className="button secondary" onClick={() => { setDraft(Object.fromEntries(record.fields.filter((field) => !field.readonly).map((field) => [field.key, field.value]))); setError('') }}>Edit entry</button><button className="text-button danger" onClick={remove}>Delete entry</button></div></>}
      {record.kind === 'preparation' && <EventReview id={record.id} data={data} commit={commit} />}
    </div>}
  </article>
}

export function History({ data, commit }: { data: AppData; commit: Commit }) {
  const records = historyRecords(data)
  return <>{!records.length && <div className="empty">No entries yet. Saved routines and reviews appear here.</div>}<div className="card-list">{records.map((record) => <HistoryCard key={record.id} record={record} data={data} commit={commit} />)}</div></>
}

export function ConfidenceBank({ data, commit }: { data: AppData; commit: Commit }) {
  const [type, setType] = useState<EvidenceType>('Success')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', detail: '' })
  const [error, setError] = useState('')
  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) { setError('Add one concrete example.'); return }
    const now = new Date().toISOString()
    const next = { ...data, confidenceItems: [{ id: newId(), createdAt: now, updatedAt: now, title: type, type, detail: text.trim() }, ...data.confidenceItems] }
    if (commit(next)) { setText(''); setError('') }
  }
  return <>
    <form className="panel stack" onSubmit={add}><label className="field"><span>Type of evidence</span><select value={type} onChange={(event) => setType(event.target.value as EvidenceType)}>{(['Effort', 'Success', 'Progress', 'Preparation'] as const).map((value) => <option key={value}>{value}</option>)}</select></label><Field label="Add evidence" hint="Something you did, achieved, or improved." value={text} onChange={setText} /><button className="button">Add example</button>{error && <Notice error>{error}</Notice>}</form>
    <p className="count-label">{data.confidenceItems.length} {data.confidenceItems.length === 1 ? 'example' : 'examples'}</p>
    {!data.confidenceItems.length && <div className="empty">Nothing here yet. Add an example above, or select one during Build Confidence.</div>}
    <div className="card-list">{data.confidenceItems.map((item) => <article key={item.id} className="bank-card panel">
      {editing === item.id ? <form className="stack" onSubmit={(event) => { event.preventDefault(); if (!draft.title.trim() || !draft.detail.trim()) return; const next = { ...data, confidenceItems: data.confidenceItems.map((value) => value.id === item.id ? { ...value, ...draft, updatedAt: new Date().toISOString() } : value) }; if (commit(next)) setEditing(null) }}><Field required rows={1} label="Example name" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><Field required label="Evidence" value={draft.detail} onChange={(value) => setDraft({ ...draft, detail: value })} /><div className="button-row"><button className="button">Save changes</button><button className="text-button" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form> : <><p className="eyebrow">{item.type || item.title}</p>{item.type && item.title !== item.type && <h3>{item.title}</h3>}<p className="entry-text">{item.detail}</p><small className="muted">{formatDate(localDate(new Date(item.createdAt)))}</small><div className="card-actions"><button className="text-button" onClick={() => { setEditing(item.id); setDraft({ title: item.title, detail: item.detail }) }}>Edit example</button><button className="text-button danger" onClick={() => { if (!window.confirm('Delete this example? Preparations will keep their saved evidence snapshot.')) return; commit({ ...data, confidenceItems: data.confidenceItems.filter((value) => value.id !== item.id) }) }}>Delete example</button></div></>}
    </article>)}</div>
  </>
}

export function WeeklyReview({ data, commit }: { data: AppData; commit: Commit }) {
  const start = weekStartDate()
  const today = localDate()
  const inWeek = (date: string) => date >= start && date <= today
  const [form, setForm] = useState({ evidence: '', helped: '', practiseNextWeek: '' })
  const [message, setMessage] = useState('')
  const actions = [
    ...data.practiceEntries.filter((item) => inWeek(item.localDate) && item.nextAction).map((item) => ({ id: `${item.id}:next`, text: item.nextAction, meta: 'Build Confidence' })),
    ...data.preparations.filter((item) => inWeek(item.localDate) && item.firstAction).map((item) => ({ id: `${item.id}:first`, text: item.firstAction, meta: item.challenge || 'Prepare to Perform' })),
    ...(data.reflectionSessions ?? []).filter((item) => inWeek(item.localDate) && item.answers.next).map((item) => ({ id: `${item.id}:next`, text: item.answers.next, meta: MODULES.find((module) => module.id === item.module)!.title })),
  ]
  const counts: Record<ModuleId, number> = {
    confidence: data.practiceEntries.filter((item) => inWeek(item.localDate)).length,
    prepare: data.preparations.filter((item) => inWeek(item.localDate)).length,
    pressure: (data.reflectionSessions ?? []).filter((item) => item.module === 'pressure' && inWeek(item.localDate)).length,
    setbacks: (data.reflectionSessions ?? []).filter((item) => item.module === 'setbacks' && inWeek(item.localDate)).length,
  }
  return <>
    <p className="muted">Week beginning {formatDate(start)}</p><div className="review-counts">{MODULES.map((module) => <div className="panel" key={module.id}><strong>{counts[module.id]}</strong><span>{module.title}</span></div>)}</div>
    <h2>Actions you set</h2><p className="muted">Mark the ones you followed through on.</p>
    {!actions.length && <div className="empty">No actions recorded this week.</div>}
    <div className="action-list">{actions.map((action) => <label className="action-check" key={action.id}><input type="checkbox" checked={(data.completedActions ?? []).includes(action.id)} onChange={(event) => commit({ ...data, completedActions: event.target.checked ? [...(data.completedActions ?? []), action.id] : (data.completedActions ?? []).filter((id) => id !== action.id) })} /><span>{action.text}<small>{action.meta}</small></span></label>)}</div>
    <h2>Reflection</h2><form className="panel stack" onSubmit={(event) => { event.preventDefault(); if (!hasMeaningfulText(...Object.values(form))) { setMessage('Write at least one answer before saving.'); return } const now = new Date().toISOString(); const result = commit({ ...data, weeklyReviews: [{ ...form, id: newId(), createdAt: now, updatedAt: now, localDate: localDate() }, ...data.weeklyReviews] }); if (result) { setForm({ evidence: '', helped: '', practiseNextWeek: '' }); setMessage(result === 'saved' ? 'Weekly review saved. You can view and edit it in History.' : 'Review kept in this tab. Export a backup before closing.') } }}>
      <Field label="What evidence of progress do I see?" value={form.evidence} onChange={(value) => setForm({ ...form, evidence: value })} /><Field label="What helped most this week?" value={form.helped} onChange={(value) => setForm({ ...form, helped: value })} /><Field label="What will I practise next week?" value={form.practiseNextWeek} onChange={(value) => setForm({ ...form, practiseNextWeek: value })} /><button className="button">Save weekly review</button>{message && <Notice>{message}</Notice>}
    </form>
  </>
}

export function DataPrivacy({ data, replace, corruptRaw }: { data: AppData; replace: (next: AppData) => boolean; corruptRaw: string | null }) {
  const [pending, setPending] = useState<AppData | null>(null)
  const [message, setMessage] = useState('')
  const confirmRef = useRef<HTMLHeadingElement>(null)
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; setPending(null); setMessage('')
    if (!file) return
    try {
      const parsed = parseImport(await file.text())
      if (!parsed.ok) { setMessage(`${parsed.message} Existing entries were not changed.`); return }
      setPending(parsed.data)
      window.setTimeout(() => confirmRef.current?.focus(), 0)
    } catch { setMessage('This file could not be read. Existing entries were not changed.') }
  }
  return <>
    <section className="panel privacy-copy"><h2>Where your entries live</h2><p>Everything you write stays in this browser’s local storage on this device. Entries do not sync between devices or browsers.</p><p>Clearing site data can remove entries. Private browsing may not retain them. Export a backup to keep a copy or move to another device.</p></section>
    <section className="data-rows" aria-label="Backups and storage">
      <div><span><strong>Export backup</strong><small>{historyRecords(data).length} entries and {data.confidenceItems.length} bank examples</small></span><button className="button secondary" onClick={() => download(JSON.stringify(data, null, 2), `confidence-lab-${localDate()}.json`)}>Download .json</button></div>
      <div><span><strong>Import backup</strong><small>Replaces all entries in this browser after confirmation</small></span><label className="file-picker button secondary">Choose file<input aria-label="Import backup file" type="file" accept="application/json,.json" onChange={readFile} /></label></div>
      {corruptRaw !== null && <div><span><strong>Recover unreadable data</strong><small>The original saved value is preserved</small></span><button className="button secondary" onClick={() => download(corruptRaw, `confidence-lab-unreadable-${localDate()}.txt`, 'text/plain')}>Download original</button></div>}
      <div><span><strong>{corruptRaw !== null ? 'Start fresh' : 'Delete all entries'}</strong><small>Cannot be undone. Export a backup first.</small></span><button className="button danger-button" onClick={() => { if (window.confirm('Delete all entries from this browser? This cannot be undone. Export a backup first.')) { if (replace(emptyData())) setMessage('All entries deleted.') } }}>Delete all</button></div>
    </section>
    {pending && <section className="confirm-box" aria-labelledby="import-title"><h2 id="import-title" tabIndex={-1} ref={confirmRef}>Replace all existing local data?</h2><p>This valid backup contains {historyRecords(pending).length} entries and {pending.confidenceItems.length} confidence examples. Importing will replace every entry, review, and action check in this browser. Export your current data first if you want to keep it.</p><div className="button-row"><button className="button danger-button" onClick={() => { if (replace(pending)) { setPending(null); setMessage('Backup imported. Previous local data was replaced.') } }}>Replace and import</button><button className="button secondary" onClick={() => setPending(null)}>Cancel</button></div></section>}
    {message && <Notice error={!message.startsWith('Backup imported') && !message.startsWith('All entries')}>{message}</Notice>}
    <section className="about-copy"><h2>About Confidence Lab</h2><p>Free personal mental performance practice. Original wording informed by broader performance psychology and themes explored in Nate Zinsser’s <cite>The Confident Mind</cite>. No endorsement or clinical benefit is implied.</p><p>No accounts, analytics, or transmission of your entries. Source code is public on <a href="https://github.com/charles-payne-ii/confidence-lab" target="_blank" rel="noreferrer">GitHub</a>.</p></section>
  </>
}
