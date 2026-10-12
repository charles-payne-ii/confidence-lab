import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  emptyData,
  countDistinctPracticeDays,
  hasMeaningfulText,
  lastLocalDates,
  localDate,
  newId,
  type AppData,
  type ConfidenceItem,
  type PracticeEntry,
  type Preparation,
  type WeeklyReview,
} from './model'
import { DataStore, parseImport, type LoadResult } from './storage'

type Route = 'home' | 'practice' | 'prepare' | 'history'
type Commit = (next: AppData) => boolean

const routes: Route[] = ['home', 'practice', 'prepare', 'history']
const routeFromHash = (): Route => {
  const candidate = window.location.hash.replace(/^#\/?/, '') as Route
  return routes.includes(candidate) ? candidate : 'home'
}

const navigate = (route: Route) => {
  window.location.hash = route === 'home' ? '#/' : `#/${route}`
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

const clone = <T,>(value: T): T => structuredClone(value)

function Field({ label, hint, value, onChange, rows = 3, required = false }: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
}) {
  const id = useMemo(() => `field-${newId()}`, [])
  return (
    <label className="field" htmlFor={id}>
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      {hint && <small>{hint}</small>}
      <textarea id={id} rows={rows} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><p>{children}</p>{action}</div>
}

function Home({ data }: { data: AppData }) {
  const days = lastLocalDates(7)
  const practiced = new Set(data.practiceEntries.map((entry) => entry.localDate))
  const count = countDistinctPracticeDays(data.practiceEntries, days)
  return (
    <main id="main" className="page home-page">
      <section className="hero">
        <p className="eyebrow">Personal mental performance training</p>
        <h1>Prepare clearly. Learn from what happened.</h1>
        <p className="lede">Short exercises that turn effort, experience, and next steps into useful evidence.</p>
      </section>

      <section aria-labelledby="actions-title">
        <h2 id="actions-title">What would help now?</h2>
        <div className="action-grid">
          <button className="action-card primary-card" onClick={() => navigate('practice')}>
            <span className="action-time">2–5 min</span>
            <strong>Daily Practice</strong>
            <span>Notice today’s effort, success, progress, and next action.</span>
          </button>
          <button className="action-card" onClick={() => navigate('prepare')}>
            <span className="action-time">About 1 min</span>
            <strong>Prepare for a Challenge</strong>
            <span>Choose what to focus on and how you will begin.</span>
          </button>
          <button className="action-card" onClick={() => navigate('history')}>
            <span className="action-time">At your pace</span>
            <strong>Review My History</strong>
            <span>Use past evidence, add a weekly review, or make a backup.</span>
          </button>
        </div>
      </section>

      <section className="week-card" aria-labelledby="week-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Last seven local days</p>
            <h2 id="week-title">Practice days</h2>
          </div>
          <p className="week-count"><strong>{count}</strong> {count === 1 ? 'day' : 'days'}</p>
        </div>
        <div className="days" aria-label={`${count} distinct practice days in the last seven days`}>
          {days.map((day) => {
            const [year, month, date] = day.split('-').map(Number)
            const parsed = new Date(year, month - 1, date)
            const active = practiced.has(day)
            return (
              <div key={day} className={`day ${active ? 'active' : ''}`} title={formatDate(day)}>
                <span>{new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(parsed)}</span>
                <strong>{date}</strong>
                <span className="day-mark" aria-label={active ? 'Practised' : 'No practice recorded'} />
              </div>
            )
          })}
        </div>
        {data.practiceEntries.length === 0 && (
          <EmptyState action={<button className="button" onClick={() => navigate('practice')}>Start with today’s effort</button>}>
            Your history is empty. A useful first step is to name one thing you worked at today—even if it is still unfinished.
          </EmptyState>
        )}
      </section>
    </main>
  )
}

const blankPractice = () => ({ effort: '', success: '', progress: '', nextAction: '', facts: '', meaning: '', control: '' })

function PracticePage({ data, commit }: { data: AppData; commit: Commit }) {
  const [form, setForm] = useState(blankPractice)
  const [showSetback, setShowSetback] = useState(false)
  const [bankField, setBankField] = useState('')
  const [error, setError] = useState('')
  const update = (key: keyof ReturnType<typeof blankPractice>, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const save = (event: FormEvent) => {
    event.preventDefault()
    const meaningfulValues = [form.effort, form.success, form.progress, form.nextAction, ...(showSetback ? [form.facts, form.meaning, form.control] : [])]
    if (!hasMeaningfulText(...meaningfulValues)) {
      setError('Add at least one meaningful answer before saving.')
      return
    }
    const now = new Date().toISOString()
    const id = newId()
    const entry: PracticeEntry = {
      id, createdAt: now, updatedAt: now, localDate: localDate(),
      effort: form.effort.trim(), success: form.success.trim(), progress: form.progress.trim(), nextAction: form.nextAction.trim(),
      ...(showSetback && hasMeaningfulText(form.facts, form.meaning, form.control) ? {
        setback: { facts: form.facts.trim(), meaning: form.meaning.trim(), control: form.control.trim() },
      } : {}),
    }
    const next = clone(data)
    next.practiceEntries.unshift(entry)
    if (bankField && form[bankField as keyof typeof form].trim()) {
      const labels: Record<string, string> = { effort: 'Effort', success: 'Success', progress: 'Progress', nextAction: 'Next action' }
      next.confidenceItems.unshift({
        id: newId(), createdAt: now, updatedAt: now, title: `${labels[bankField]} · ${formatDate(entry.localDate)}`,
        detail: form[bankField as keyof typeof form].trim(), sourcePracticeId: id,
      })
    }
    if (commit(next)) navigate('home')
  }

  return (
    <main id="main" className="page narrow-page">
      <div className="page-intro">
        <button className="back-link" onClick={() => navigate('home')}>← Home</button>
        <p className="eyebrow">Daily practice · 2–5 minutes</p>
        <h1>Notice what today is teaching you.</h1>
        <p>Partial entries are welcome. Specific details are more useful than polished answers.</p>
      </div>
      <form className="stack" onSubmit={save}>
        <section className="panel numbered-section">
          <span className="number">01</span>
          <Field label="Effort: What did I work at?" value={form.effort} onChange={(value) => update('effort', value)} />
        </section>
        <section className="panel numbered-section">
          <span className="number">02</span>
          <Field label="Success: What went well?" hint="Small, concrete examples count." value={form.success} onChange={(value) => update('success', value)} />
        </section>
        <section className="panel numbered-section">
          <span className="number">03</span>
          <Field label="Progress: What can I do better now than before?" value={form.progress} onChange={(value) => update('progress', value)} />
        </section>
        <section className="panel numbered-section">
          <span className="number">04</span>
          <Field label="Next action: What specific action will I take next?" value={form.nextAction} onChange={(value) => update('nextAction', value)} />
        </section>

        <section className="panel">
          <button type="button" className="disclosure" aria-expanded={showSetback} onClick={() => setShowSetback(!showSetback)}>
            <span><strong>Optional setback reflection</strong><small>Record it plainly; no positive interpretation is required.</small></span>
            <span aria-hidden="true">{showSetback ? '−' : '+'}</span>
          </button>
          {showSetback && <div className="subform">
            <Field label="What happened?" hint="Record observable facts." value={form.facts} onChange={(value) => update('facts', value)} />
            <Field label="What meaning did I give it?" value={form.meaning} onChange={(value) => update('meaning', value)} />
            <Field label="What can I control next?" value={form.control} onChange={(value) => update('control', value)} />
          </div>}
        </section>

        <section className="panel compact-panel">
          <label className="field" htmlFor="bank-example">
            <span>Add one answer to my Confidence Bank</span>
            <small>Optional. Choose an example you may want before a future challenge.</small>
            <select id="bank-example" value={bankField} onChange={(event) => setBankField(event.target.value)}>
              <option value="">Do not add an example</option>
              {(['effort', 'success', 'progress', 'nextAction'] as const).map((field) => (
                <option key={field} value={field} disabled={!form[field].trim()}>{field === 'nextAction' ? 'Next action' : field[0].toUpperCase() + field.slice(1)}</option>
              ))}
            </select>
          </label>
        </section>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-actions"><button className="button primary" type="submit">Save practice</button></div>
      </form>
    </main>
  )
}

function BreathingPause() {
  const [remaining, setRemaining] = useState(60)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, remaining])
  useEffect(() => { if (remaining === 0) setRunning(false) }, [remaining])
  const reset = () => { setRunning(false); setRemaining(60) }
  return (
    <div className="pause-box">
      <div>
        <strong>Optional pause</strong>
        <p>Let your breathing stay comfortable and unforced. There is nothing to achieve here.</p>
      </div>
      <div className="timer" aria-live="polite"><strong>{remaining}s</strong><span>{remaining === 0 ? 'Complete' : running ? 'Pause in progress' : 'Optional'}</span></div>
      <div className="button-row">
        {remaining === 60 && !running && <button type="button" className="button secondary" onClick={() => setRunning(true)}>Start 60 seconds</button>}
        {running && <button type="button" className="button secondary" onClick={() => setRunning(false)}>Pause timer</button>}
        {remaining < 60 && !running && remaining > 0 && <button type="button" className="button secondary" onClick={() => setRunning(true)}>Resume</button>}
        {remaining < 60 && <button type="button" className="text-button" onClick={reset}>{remaining === 0 ? 'Reset' : 'Skip and reset'}</button>}
      </div>
    </div>
  )
}

const blankPreparation = () => ({ challenge: '', confidenceItemId: '', focusCue: '', firstAction: '', setting: '', rehearsalActions: '', likelyDifficulty: '', plannedResponse: '' })

function PreparePage({ data, commit }: { data: AppData; commit: Commit }) {
  const [routine, setRoutine] = useState<'quick' | 'expanded'>('quick')
  const [form, setForm] = useState(blankPreparation)
  const [error, setError] = useState('')
  const update = (key: keyof ReturnType<typeof blankPreparation>, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!form.challenge.trim() || !form.focusCue.trim() || !form.firstAction.trim()) {
      setError('Name the challenge, choose a focus cue, and name your first action.')
      return
    }
    const now = new Date().toISOString()
    const bankItem = data.confidenceItems.find((item) => item.id === form.confidenceItemId)
    const preparation: Preparation = {
      id: newId(), createdAt: now, updatedAt: now, localDate: localDate(), routine,
      challenge: form.challenge.trim(), focusCue: form.focusCue.trim(), firstAction: form.firstAction.trim(),
      ...(bankItem ? { confidenceItemId: bankItem.id, confidenceSnapshot: `${bankItem.title}: ${bankItem.detail}` } : {}),
      setting: routine === 'expanded' ? form.setting.trim() : '',
      rehearsalActions: routine === 'expanded' ? form.rehearsalActions.trim() : '',
      likelyDifficulty: routine === 'expanded' ? form.likelyDifficulty.trim() : '',
      plannedResponse: routine === 'expanded' ? form.plannedResponse.trim() : '',
    }
    const next = clone(data)
    next.preparations.unshift(preparation)
    if (commit(next)) navigate('history')
  }
  return (
    <main id="main" className="page narrow-page">
      <div className="page-intro">
        <button className="back-link" onClick={() => navigate('home')}>← Home</button>
        <p className="eyebrow">Pre-performance</p>
        <h1>Decide how you want to enter the moment.</h1>
        <p>Use the quick routine when time is tight, or add rehearsal when you have a few minutes.</p>
      </div>
      <div className="segmented" role="group" aria-label="Routine length">
        <button className={routine === 'quick' ? 'active' : ''} type="button" aria-pressed={routine === 'quick'} onClick={() => setRoutine('quick')}><strong>Quick routine</strong><span>About 1 minute</span></button>
        <button className={routine === 'expanded' ? 'active' : ''} type="button" aria-pressed={routine === 'expanded'} onClick={() => setRoutine('expanded')}><strong>Expanded</strong><span>Add rehearsal</span></button>
      </div>
      <form className="stack" onSubmit={save}>
        <section className="panel"><Field label="Name the upcoming challenge" required value={form.challenge} onChange={(value) => update('challenge', value)} rows={2} /></section>
        <section className="panel"><BreathingPause /></section>
        <section className="panel">
          <label className="field" htmlFor="confidence-example">
            <span>Review one relevant example</span>
            <small>Optional. Choose evidence from your Confidence Bank.</small>
            <select id="confidence-example" value={form.confidenceItemId} onChange={(event) => update('confidenceItemId', event.target.value)}>
              <option value="">No example selected</option>
              {data.confidenceItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          {form.confidenceItemId && <blockquote>{data.confidenceItems.find((item) => item.id === form.confidenceItemId)?.detail}</blockquote>}
          {data.confidenceItems.length === 0 && <p className="hint-line">Your Confidence Bank is empty. You can add an example in History.</p>}
        </section>
        <section className="panel two-column">
          <Field label="Choose a focus cue" hint="A short phrase that directs your attention." required rows={2} value={form.focusCue} onChange={(value) => update('focusCue', value)} />
          <Field label="Name your first action" hint="Make the opening move concrete." required rows={2} value={form.firstAction} onChange={(value) => update('firstAction', value)} />
        </section>
        {routine === 'expanded' && <section className="panel rehearsal">
          <div><p className="eyebrow">Mental rehearsal</p><h2>Run through useful details.</h2></div>
          <Field label="Imagine the setting" hint="What will you see, hear, or notice?" value={form.setting} onChange={(value) => update('setting', value)} />
          <Field label="Rehearse two or three specific actions" value={form.rehearsalActions} onChange={(value) => update('rehearsalActions', value)} />
          <div className="two-column">
            <Field label="One likely difficulty" value={form.likelyDifficulty} onChange={(value) => update('likelyDifficulty', value)} />
            <Field label="My planned response" value={form.plannedResponse} onChange={(value) => update('plannedResponse', value)} />
          </div>
        </section>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-actions"><button className="button primary" type="submit">Save preparation</button></div>
      </form>
    </main>
  )
}

function PracticeHistoryCard({ entry, data, commit }: { entry: PracticeEntry; data: AppData; commit: Commit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry)
  const save = () => {
    if (!hasMeaningfulText(draft.effort, draft.success, draft.progress, draft.nextAction, draft.setback?.facts, draft.setback?.meaning, draft.setback?.control)) return
    const next = clone(data)
    next.practiceEntries = next.practiceEntries.map((item) => item.id === entry.id ? { ...draft, updatedAt: new Date().toISOString() } : item)
    if (commit(next)) setEditing(false)
  }
  const remove = () => {
    if (!window.confirm(`Delete the practice from ${formatDate(entry.localDate)}? This cannot be undone.`)) return
    const next = clone(data)
    next.practiceEntries = next.practiceEntries.filter((item) => item.id !== entry.id)
    commit(next)
  }
  return <article className="history-card">
    <div className="card-heading"><div><p className="eyebrow">Daily practice</p><h3>{formatDate(entry.localDate)}</h3></div><div className="card-actions"><button className="text-button" onClick={() => { if (!editing) setDraft(clone(entry)); setEditing(!editing) }}>{editing ? 'Cancel' : 'Edit'}</button><button className="text-button danger" onClick={remove}>Delete</button></div></div>
    {editing ? <div className="edit-form">
      <Field label="Effort" value={draft.effort} onChange={(value) => setDraft({ ...draft, effort: value })} />
      <Field label="Success" value={draft.success} onChange={(value) => setDraft({ ...draft, success: value })} />
      <Field label="Progress" value={draft.progress} onChange={(value) => setDraft({ ...draft, progress: value })} />
      <Field label="Next action" value={draft.nextAction} onChange={(value) => setDraft({ ...draft, nextAction: value })} />
      {draft.setback && <><Field label="Setback facts" value={draft.setback.facts} onChange={(value) => setDraft({ ...draft, setback: { ...draft.setback!, facts: value } })} /><Field label="Meaning I gave it" value={draft.setback.meaning} onChange={(value) => setDraft({ ...draft, setback: { ...draft.setback!, meaning: value } })} /><Field label="What I can control" value={draft.setback.control} onChange={(value) => setDraft({ ...draft, setback: { ...draft.setback!, control: value } })} /></>}
      <button className="button" type="button" onClick={save}>Save changes</button>
    </div> : <div className="entry-values">
      {entry.effort && <div><dt>Effort</dt><dd>{entry.effort}</dd></div>}
      {entry.success && <div><dt>Success</dt><dd>{entry.success}</dd></div>}
      {entry.progress && <div><dt>Progress</dt><dd>{entry.progress}</dd></div>}
      {entry.nextAction && <div><dt>Next action</dt><dd>{entry.nextAction}</dd></div>}
      {entry.setback && hasMeaningfulText(entry.setback.facts, entry.setback.meaning, entry.setback.control) && <div className="setback-summary"><dt>Setback reflection</dt><dd>{entry.setback.facts}</dd>{entry.setback.meaning && <dd><em>Meaning:</em> {entry.setback.meaning}</dd>}{entry.setback.control && <dd><em>Control:</em> {entry.setback.control}</dd>}</div>}
    </div>}
  </article>
}

function PreparationHistoryCard({ preparation, data, commit }: { preparation: Preparation; data: AppData; commit: Commit }) {
  const [editing, setEditing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [draft, setDraft] = useState(preparation)
  const [review, setReview] = useState(preparation.review ?? { createdAt: '', updatedAt: '', worked: '', change: '', practiseNext: '' })
  const updateItem = (item: Preparation) => {
    const next = clone(data)
    next.preparations = next.preparations.map((candidate) => candidate.id === preparation.id ? item : candidate)
    return commit(next)
  }
  const saveEdit = () => {
    if (!draft.challenge.trim() || !draft.focusCue.trim() || !draft.firstAction.trim()) return
    if (updateItem({ ...draft, updatedAt: new Date().toISOString() })) setEditing(false)
  }
  const saveReview = () => {
    if (!hasMeaningfulText(review.worked, review.change, review.practiseNext)) return
    const now = new Date().toISOString()
    if (updateItem({ ...preparation, updatedAt: now, review: { ...review, createdAt: review.createdAt || now, updatedAt: now } })) setReviewing(false)
  }
  const remove = () => {
    if (!window.confirm(`Delete the preparation for “${preparation.challenge}” and its review? This cannot be undone.`)) return
    const next = clone(data); next.preparations = next.preparations.filter((item) => item.id !== preparation.id); commit(next)
  }
  const removeReview = () => {
    if (!window.confirm('Delete this linked event review?')) return
    const item = { ...preparation }; delete item.review; item.updatedAt = new Date().toISOString(); updateItem(item)
  }
  return <article className="history-card">
    <div className="card-heading"><div><p className="eyebrow">{preparation.routine} preparation</p><h3>{preparation.challenge}</h3><small>{formatDate(preparation.localDate)}</small></div><div className="card-actions"><button className="text-button" onClick={() => { if (!editing) setDraft(clone(preparation)); setEditing(!editing) }}>{editing ? 'Cancel' : 'Edit'}</button><button className="text-button danger" onClick={remove}>Delete</button></div></div>
    {editing ? <div className="edit-form">
      <Field label="Challenge" value={draft.challenge} onChange={(value) => setDraft({ ...draft, challenge: value })} />
      <Field label="Focus cue" value={draft.focusCue} onChange={(value) => setDraft({ ...draft, focusCue: value })} />
      <Field label="First action" value={draft.firstAction} onChange={(value) => setDraft({ ...draft, firstAction: value })} />
      {draft.routine === 'expanded' && <><Field label="Setting" value={draft.setting} onChange={(value) => setDraft({ ...draft, setting: value })} /><Field label="Rehearsal actions" value={draft.rehearsalActions} onChange={(value) => setDraft({ ...draft, rehearsalActions: value })} /><Field label="Likely difficulty" value={draft.likelyDifficulty} onChange={(value) => setDraft({ ...draft, likelyDifficulty: value })} /><Field label="Planned response" value={draft.plannedResponse} onChange={(value) => setDraft({ ...draft, plannedResponse: value })} /></>}
      <button className="button" onClick={saveEdit}>Save changes</button>
    </div> : <div className="entry-values">
      {preparation.confidenceSnapshot && <div><dt>Evidence reviewed</dt><dd>{preparation.confidenceSnapshot}</dd></div>}
      <div><dt>Focus cue</dt><dd>{preparation.focusCue}</dd></div><div><dt>First action</dt><dd>{preparation.firstAction}</dd></div>
      {preparation.setting && <div><dt>Setting</dt><dd>{preparation.setting}</dd></div>}{preparation.rehearsalActions && <div><dt>Rehearsed actions</dt><dd>{preparation.rehearsalActions}</dd></div>}{preparation.likelyDifficulty && <div><dt>Likely difficulty</dt><dd>{preparation.likelyDifficulty}</dd></div>}{preparation.plannedResponse && <div><dt>Planned response</dt><dd>{preparation.plannedResponse}</dd></div>}
    </div>}
    <div className="linked-review">
      <div className="card-heading"><div><p className="eyebrow">After the event</p><h4>{preparation.review ? 'Linked review' : 'Learn from what happened'}</h4></div>{preparation.review && <div className="card-actions"><button className="text-button" onClick={() => { if (!reviewing) setReview(clone(preparation.review!)); setReviewing(!reviewing) }}>{reviewing ? 'Cancel' : 'Edit'}</button><button className="text-button danger" onClick={removeReview}>Delete</button></div>}</div>
      {!preparation.review && !reviewing && <button className="button secondary" onClick={() => { setReview({ createdAt: '', updatedAt: '', worked: '', change: '', practiseNext: '' }); setReviewing(true) }}>Add event review</button>}
      {preparation.review && !reviewing && <div className="entry-values"><div><dt>What worked</dt><dd>{preparation.review.worked || '—'}</dd></div><div><dt>What to change</dt><dd>{preparation.review.change || '—'}</dd></div><div><dt>Practise next</dt><dd>{preparation.review.practiseNext || '—'}</dd></div></div>}
      {reviewing && <div className="edit-form"><Field label="What worked?" value={review.worked} onChange={(value) => setReview({ ...review, worked: value })} /><Field label="What should I change?" value={review.change} onChange={(value) => setReview({ ...review, change: value })} /><Field label="What will I practise next?" value={review.practiseNext} onChange={(value) => setReview({ ...review, practiseNext: value })} /><button className="button" onClick={saveReview}>Save review</button></div>}
    </div>
  </article>
}

function ConfidenceBank({ data, commit }: { data: AppData; commit: Commit }) {
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ConfidenceItem | null>(null)
  const add = (event: FormEvent) => {
    event.preventDefault(); if (!title.trim() || !detail.trim()) return
    const now = new Date().toISOString(); const next = clone(data)
    next.confidenceItems.unshift({ id: newId(), createdAt: now, updatedAt: now, title: title.trim(), detail: detail.trim() })
    if (commit(next)) { setTitle(''); setDetail('') }
  }
  const save = () => {
    if (!draft?.title.trim() || !draft.detail.trim()) return
    const next = clone(data); next.confidenceItems = next.confidenceItems.map((item) => item.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : item)
    if (commit(next)) { setEditing(null); setDraft(null) }
  }
  const remove = (item: ConfidenceItem) => {
    if (!window.confirm(`Delete “${item.title}” from your Confidence Bank? Past preparations keep their saved snapshot.`)) return
    const next = clone(data); next.confidenceItems = next.confidenceItems.filter((candidate) => candidate.id !== item.id); commit(next)
  }
  return <section className="history-section" aria-labelledby="confidence-title">
    <div className="section-heading"><div><p className="eyebrow">Reusable evidence</p><h2 id="confidence-title">Confidence Bank</h2></div><span className="count-pill">{data.confidenceItems.length}</span></div>
    <p className="section-copy">Keep specific examples of preparation, skill, persistence, or recovery. You can select any of them before a challenge.</p>
    <form className="panel inline-add" onSubmit={add}>
      <label className="field"><span>Example name</span><input value={title} required onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Recovered after a difficult start" /></label>
      <Field label="What does this show?" value={detail} required rows={2} onChange={setDetail} />
      <button className="button" type="submit">Add example</button>
    </form>
    <div className="card-list">{data.confidenceItems.map((item) => <article className="history-card bank-card" key={item.id}>
      {editing === item.id && draft ? <div className="edit-form"><label className="field"><span>Example name</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><Field label="What does this show?" value={draft.detail} onChange={(value) => setDraft({ ...draft, detail: value })} /><div className="button-row"><button className="button" onClick={save}>Save changes</button><button className="text-button" onClick={() => setEditing(null)}>Cancel</button></div></div> : <><div className="card-heading"><div><h3>{item.title}</h3><small>Added {formatTime(item.createdAt)}</small></div><div className="card-actions"><button className="text-button" onClick={() => { setEditing(item.id); setDraft(clone(item)) }}>Edit</button><button className="text-button danger" onClick={() => remove(item)}>Delete</button></div></div><p>{item.detail}</p></>}
    </article>)}</div>
    {data.confidenceItems.length === 0 && <EmptyState>Add your first concrete example above, or save one from Daily Practice.</EmptyState>}
  </section>
}

function WeeklyReviews({ data, commit }: { data: AppData; commit: Commit }) {
  const blank = { evidence: '', helped: '', practiseNextWeek: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<WeeklyReview | null>(null)
  const add = (event: FormEvent) => {
    event.preventDefault(); if (!hasMeaningfulText(form.evidence, form.helped, form.practiseNextWeek)) return
    const now = new Date().toISOString(); const next = clone(data)
    next.weeklyReviews.unshift({ id: newId(), createdAt: now, updatedAt: now, localDate: localDate(), ...form })
    if (commit(next)) setForm(blank)
  }
  const save = () => {
    if (!draft || !hasMeaningfulText(draft.evidence, draft.helped, draft.practiseNextWeek)) return
    const next = clone(data); next.weeklyReviews = next.weeklyReviews.map((item) => item.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : item)
    if (commit(next)) { setEditing(null); setDraft(null) }
  }
  const remove = (item: WeeklyReview) => {
    if (!window.confirm(`Delete the weekly review from ${formatDate(item.localDate)}?`)) return
    const next = clone(data); next.weeklyReviews = next.weeklyReviews.filter((candidate) => candidate.id !== item.id); commit(next)
  }
  return <section className="history-section" aria-labelledby="weekly-title">
    <div className="section-heading"><div><p className="eyebrow">Look across the week</p><h2 id="weekly-title">Weekly review</h2></div><span className="count-pill">{data.weeklyReviews.length}</span></div>
    <form className="panel stack" onSubmit={add}><Field label="What evidence of progress do I see?" value={form.evidence} onChange={(value) => setForm({ ...form, evidence: value })} /><Field label="What helped?" value={form.helped} onChange={(value) => setForm({ ...form, helped: value })} /><Field label="What will I practise next week?" value={form.practiseNextWeek} onChange={(value) => setForm({ ...form, practiseNextWeek: value })} /><button className="button" type="submit">Save weekly review</button></form>
    <div className="card-list">{data.weeklyReviews.map((item) => <article className="history-card" key={item.id}>
      <div className="card-heading"><div><p className="eyebrow">Weekly review</p><h3>{formatDate(item.localDate)}</h3></div><div className="card-actions"><button className="text-button" onClick={() => { setEditing(item.id); setDraft(clone(item)) }}>{editing === item.id ? 'Cancel' : 'Edit'}</button><button className="text-button danger" onClick={() => remove(item)}>Delete</button></div></div>
      {editing === item.id && draft ? <div className="edit-form"><Field label="Evidence of progress" value={draft.evidence} onChange={(value) => setDraft({ ...draft, evidence: value })} /><Field label="What helped" value={draft.helped} onChange={(value) => setDraft({ ...draft, helped: value })} /><Field label="Practise next week" value={draft.practiseNextWeek} onChange={(value) => setDraft({ ...draft, practiseNextWeek: value })} /><button className="button" onClick={save}>Save changes</button></div> : <div className="entry-values"><div><dt>Evidence of progress</dt><dd>{item.evidence || '—'}</dd></div><div><dt>What helped</dt><dd>{item.helped || '—'}</dd></div><div><dt>Practise next week</dt><dd>{item.practiseNextWeek || '—'}</dd></div></div>}
    </article>)}</div>
  </section>
}

function BackupPanel({ data, replaceData }: { data: AppData; replaceData: (data: AppData) => boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<AppData | null>(null)
  const [message, setMessage] = useState('')
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `performance-lab-backup-${localDate()}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(''); setPending(null)
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try {
      const parsed = parseImport(await file.text())
      if (!parsed.ok) { setMessage(parsed.message); return }
      setPending(parsed.data)
    } catch { setMessage('The selected file could not be read. Existing data was not changed.') }
  }
  const confirmImport = () => {
    if (!pending) return
    if (replaceData(pending)) { setPending(null); setMessage('Backup imported. Your previous local data was replaced.') }
  }
  return <section className="history-section backup-panel" aria-labelledby="backup-title">
    <div><p className="eyebrow">Local data</p><h2 id="backup-title">Backups</h2></div>
    <p>Entries stay in this browser. They do not sync between devices and can disappear if browser data is cleared. Export a JSON backup you can keep elsewhere.</p>
    <div className="button-row"><button className="button" onClick={exportData}>Export JSON</button><button className="button secondary" onClick={() => input.current?.click()}>Choose backup to import</button></div>
    <input ref={input} className="visually-hidden" type="file" accept="application/json,.json" onChange={readFile} />
    {message && <Notice tone={message.startsWith('Backup') ? 'success' : 'error'}>{message}</Notice>}
    {pending && <div className="confirm-box" role="alertdialog" aria-labelledby="import-title" aria-describedby="import-description">
      <h3 id="import-title">Replace all existing local data?</h3>
      <p id="import-description">Importing replaces your current practices, preparations, reviews, and Confidence Bank. This valid backup contains {pending.practiceEntries.length} practices, {pending.preparations.length} preparations, {pending.weeklyReviews.length} weekly reviews, and {pending.confidenceItems.length} confidence examples.</p>
      <div className="button-row"><button className="button danger-button" onClick={confirmImport}>Replace and import</button><button className="button secondary" onClick={() => setPending(null)}>Cancel</button></div>
    </div>}
  </section>
}

function HistoryPage({ data, commit, replaceData }: { data: AppData; commit: Commit; replaceData: (data: AppData) => boolean }) {
  return <main id="main" className="page history-page">
    <div className="page-intro history-intro"><button className="back-link" onClick={() => navigate('home')}>← Home</button><p className="eyebrow">Your records</p><h1>History and evidence</h1><p>Review what you recorded, change what needs correcting, and use specific examples when preparing.</p></div>
    <ConfidenceBank data={data} commit={commit} />
    <section className="history-section" aria-labelledby="preparations-title"><div className="section-heading"><div><p className="eyebrow">Before and after</p><h2 id="preparations-title">Preparations & event reviews</h2></div><span className="count-pill">{data.preparations.length}</span></div><div className="card-list">{data.preparations.map((item) => <PreparationHistoryCard key={item.id} preparation={item} data={data} commit={commit} />)}</div>{data.preparations.length === 0 && <EmptyState action={<button className="button" onClick={() => navigate('prepare')}>Prepare for a challenge</button>}>No preparations yet. A quick routine takes about one minute.</EmptyState>}</section>
    <section className="history-section" aria-labelledby="practices-title"><div className="section-heading"><div><p className="eyebrow">Daily observations</p><h2 id="practices-title">Practice entries</h2></div><span className="count-pill">{data.practiceEntries.length}</span></div><div className="card-list">{data.practiceEntries.map((item) => <PracticeHistoryCard key={item.id} entry={item} data={data} commit={commit} />)}</div>{data.practiceEntries.length === 0 && <EmptyState action={<button className="button" onClick={() => navigate('practice')}>Start daily practice</button>}>No practice entries yet.</EmptyState>}</section>
    <WeeklyReviews data={data} commit={commit} />
    <BackupPanel data={data} replaceData={replaceData} />
  </main>
}

function App() {
  const storeRef = useRef<DataStore | null>(null)
  if (!storeRef.current) storeRef.current = new DataStore()
  const initialRef = useRef<LoadResult | null>(null)
  if (!initialRef.current) initialRef.current = storeRef.current.load()
  const [data, setData] = useState(initialRef.current.data)
  const [route, setRoute] = useState(routeFromHash)
  const [storageMessage, setStorageMessage] = useState(initialRef.current.status === 'ok' || initialRef.current.status === 'empty' ? '' : initialRef.current.message)
  const [corruptRaw, setCorruptRaw] = useState(initialRef.current.status === 'corrupt' ? initialRef.current.raw : '')

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const commit: Commit = (next) => {
    if (corruptRaw) { setStorageMessage('Resolve the unreadable saved data before making changes.'); return false }
    const result = storeRef.current!.save(next)
    setData(next)
    setStorageMessage(result.ok ? '' : result.message)
    return true
  }
  const replaceData = (next: AppData) => {
    const result = storeRef.current!.save(next, true)
    if (!result.ok) { setStorageMessage(result.message); return false }
    setData(next); setCorruptRaw(''); setStorageMessage(''); return true
  }
  const downloadCorrupt = () => {
    const blob = new Blob([corruptRaw], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `performance-lab-unreadable-${localDate()}.txt`; link.click(); URL.revokeObjectURL(url)
  }
  const resetCorrupt = () => {
    if (!window.confirm('Replace the unreadable saved value with an empty Performance Lab? Download it first if you may need to recover it.')) return
    replaceData(emptyData())
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><button className="brand" onClick={() => navigate('home')} aria-label="Performance Lab home"><span className="brand-mark">P</span><span>Performance Lab<small>Private by design</small></span></button><nav aria-label="Main navigation"><button className={route === 'home' ? 'active' : ''} aria-current={route === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>Home</button><button className={route === 'practice' ? 'active' : ''} aria-current={route === 'practice' ? 'page' : undefined} onClick={() => navigate('practice')}>Practice</button><button className={route === 'prepare' ? 'active' : ''} aria-current={route === 'prepare' ? 'page' : undefined} onClick={() => navigate('prepare')}>Prepare</button><button className={route === 'history' ? 'active' : ''} aria-current={route === 'history' ? 'page' : undefined} onClick={() => navigate('history')}>History</button></nav></header>
    {storageMessage && <div className="global-notice"><Notice tone="error"><strong>Local storage needs attention.</strong> {storageMessage}{corruptRaw && <span className="notice-actions"><button className="text-button" onClick={downloadCorrupt}>Download unreadable data</button><button className="text-button danger" onClick={resetCorrupt}>Start fresh</button></span>}</Notice></div>}
    {route === 'home' && <Home data={data} />}
    {route === 'practice' && <PracticePage data={data} commit={commit} />}
    {route === 'prepare' && <PreparePage data={data} commit={commit} />}
    {route === 'history' && <HistoryPage data={data} commit={commit} replaceData={replaceData} />}
    <footer><p>Entries remain in this browser and are never sent anywhere by Performance Lab.</p><p>Exercises are original and informed by performance psychology, including ideas explored in Nate Zinsser’s <cite>The Confident Mind</cite>. No endorsement is implied.</p><p>Version 0.1 · Educational self-reflection, not clinical care.</p></footer>
  </div>
}

export default App
