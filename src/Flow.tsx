import { useEffect, useRef, useState } from 'react'
import { addSession, getSteps, MODULES } from './exercises'
import { hasMeaningfulText, type AppData, type ModuleId } from './model'
import { Notice, type Commit } from './ui'

function Timer({ seconds, breathing, onRecord }: { seconds: number; breathing: boolean; onRecord: (value: string) => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef(0)
  const elapsedRef = useRef(0)
  const recordRef = useRef(onRecord)
  recordRef.current = onRecord
  useEffect(() => {
    if (!running) return
    startedAt.current = Date.now() - elapsedRef.current * 1000
    const interval = window.setInterval(() => {
      const value = Math.min(seconds, (Date.now() - startedAt.current) / 1000)
      elapsedRef.current = value
      setElapsed(value)
      recordRef.current(value >= seconds ? `Completed (${seconds}s)` : `Paused after ${Math.floor(value)}s`)
      if (value >= seconds) setRunning(false)
    }, 200)
    return () => window.clearInterval(interval)
  }, [running, seconds])
  const done = elapsed >= seconds
  const remaining = Math.ceil(seconds - elapsed)
  const phase = elapsed % 10 < 4 ? 'Breathe in' : 'Breathe out'
  const scale = elapsed % 10 < 4 ? .75 + elapsed % 10 / 4 * .25 : 1 - (elapsed % 10 - 4) / 6 * .25
  return <div className="timer-block">
    <div className="timer-ring">
      {breathing && <div className="breath-disc" aria-hidden="true" style={{ transform: `scale(${running ? scale : .85})` }} />}
      <svg viewBox="0 0 248 248" aria-hidden="true"><circle cx="124" cy="124" r="118" /><circle cx="124" cy="124" r="118" className="timer-progress" style={{ strokeDashoffset: 741.4 * (1 - elapsed / seconds) }} /></svg>
      <div className="timer-label"><strong>{done ? 'Complete' : running && breathing ? phase : running ? 'Rehearse' : elapsed ? 'Paused' : 'Optional pause'}</strong><span>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span></div>
    </div>
    <div className="button-row"><button className="button secondary" disabled={done} onClick={() => setRunning(!running)}>{done ? 'Complete' : running ? 'Pause' : elapsed ? 'Resume' : 'Start'}</button>{elapsed > 0 && <button className="text-button" onClick={() => { setRunning(false); setElapsed(0); elapsedRef.current = 0; onRecord('') }}>Restart</button>}</div>
    <p className="muted">Timers are optional. Continue or skip at any time.</p>
    {done && <span className="visually-hidden" role="status">Timer complete.</span>}
  </div>
}

export default function Flow({ module, data, commit, exit, registerGuard }: {
  module: ModuleId; data: AppData; commit: Commit; exit: (history?: boolean) => void; registerGuard: (dirty: boolean) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({ routine: 'quick' })
  const [index, setIndex] = useState(0)
  const [bankFields, setBankFields] = useState<string[]>([])
  const [confidenceItemId, setConfidenceItemId] = useState('')
  const [saved, setSaved] = useState<'saved' | 'memory' | null>(null)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const startedAt = useRef(Date.now())
  const promptRef = useRef<HTMLHeadingElement>(null)
  const steps = getSteps(module, answers.routine === 'expanded')
  const step = steps[index]
  const info = MODULES.find((item) => item.id === module)!
  const dirty = !saved && (hasMeaningfulText(...Object.entries(answers).filter(([key]) => key !== 'routine').map(([, value]) => value)) || Boolean(confidenceItemId))

  useEffect(() => { registerGuard(dirty); return () => registerGuard(false) }, [dirty, registerGuard])
  useEffect(() => {
    setError('')
    window.scrollTo(0, 0)
    promptRef.current?.focus({ preventScroll: true })
  }, [index, saved])

  const finish = (isComplete: boolean, values = answers) => {
    const result = addSession(data, {
      module, answers: values,
      complete: isComplete, durationSeconds: Math.round((Date.now() - startedAt.current) / 1000), bankFields, confidenceItemId,
    })
    if (!result) { setError('Add at least one meaningful answer before saving. You can go back to any step.'); return }
    const outcome = commit(result.data)
    if (outcome) { setSaved(outcome); setComplete(isComplete) }
  }
  const advance = (skip = false) => {
    const next = skip ? { ...answers, [step.key]: '' } : answers
    if (skip && step.type === 'evidence') setConfidenceItemId('')
    setAnswers(next)
    if (index === steps.length - 1) finish(true, next)
    else setIndex(index + 1)
  }
  const highlights = module === 'prepare' ? ['cue', 'first'] : module === 'setbacks' ? ['lesson', 'next'] : ['next']

  return <div className="flow-shell">
    <header className="flow-header"><div className="flow-header-row">
      <button className="text-button" aria-label={saved ? 'Close summary' : 'Exit routine'} onClick={() => exit()}><span aria-hidden="true">×</span> {saved ? 'Close' : 'Exit'}</button>
      <strong>{info.title}</strong>
      {!saved && <button className="button secondary small" aria-label="Save and exit" onClick={() => finish(false)}>Save</button>}
    </div>{!saved && <div className="progress" role="progressbar" aria-label="Routine progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>{steps.map((item, i) => <span key={item.key} className={i <= index ? 'on' : ''} />)}</div>}</header>
    <main id="main" tabIndex={-1} className="flow-main">
      {saved ? <>
        <div className="summary-mark" aria-hidden="true">·</div>
        <p className="eyebrow">{info.title} · {complete ? 'Complete' : 'Partial entry'}</p>
        <h1 ref={promptRef} tabIndex={-1}>{saved === 'saved' ? 'Your entry is saved.' : 'Your entry is kept in this tab.'}</h1>
        <p className="intro">{saved === 'memory' ? 'Browser storage could not save it. Export a backup from Data & privacy before closing this tab.' : module === 'confidence' ? bankFields.length ? 'The examples you selected were also added to your Confidence Bank.' : 'Your observations and next action are ready to revisit.' : module === 'prepare' ? 'Take your focus cue and first action into the event. Add a linked review in History afterwards.' : module === 'pressure' ? 'Return to the task with your next action.' : 'The facts, lesson, and next action are saved in your history.'}</p>
        {highlights.some((key) => answers[key]?.trim()) && <div className="highlights">{steps.filter((item) => highlights.includes(item.key) && answers[item.key]?.trim()).map((item) => <div key={item.key}><span className="eyebrow">{item.label}</span><p>{answers[item.key]}</p></div>)}</div>}
        <dl className="summary-rows">{steps.filter((item) => !highlights.includes(item.key) && answers[item.key]?.trim()).map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{answers[item.key]}</dd></div>)}</dl>
        {confidenceItemId && <dl className="summary-rows"><div><dt>Evidence reviewed</dt><dd>{data.confidenceItems.find((item) => item.id === confidenceItemId)?.detail}</dd></div></dl>}
        <div className="button-row summary-actions"><button className="button" onClick={() => exit()}>Back to home</button><button className="button secondary" onClick={() => exit(true)}>View history</button></div>
      </> : <>
        <p className="eyebrow">{index + 1} of {steps.length} · {step.label}</p>
        <h1 id="prompt" ref={promptRef} tabIndex={-1}>{step.prompt}</h1>
        <p id="hint" className="intro">{step.hint}</p>
        {step.type === 'choice' && <fieldset className="routine-choice"><legend className="visually-hidden">Routine length</legend>{(['quick', 'expanded'] as const).map((value) => <label className={`choice-card ${answers.routine === value ? 'selected' : ''}`} key={value}><input type="radio" name="routine" value={value} checked={answers.routine === value} onChange={() => setAnswers({ ...answers, routine: value })} /><span><strong>{value === 'quick' ? 'Quick' : 'Expanded'}</strong><small>{value === 'quick' ? 'About 1 minute with timers skipped. Evidence, focus cue, first action.' : 'About 5 minutes. Add a difficulty, an if–then plan, and rehearsal.'}</small></span></label>)}</fieldset>}
        {step.type === 'evidence' && <div className="evidence-options"><p className="eyebrow">From your Confidence Bank</p><label className={`evidence-card ${!confidenceItemId ? 'selected' : ''}`}><input type="radio" name="evidence" checked={!confidenceItemId} onChange={() => setConfidenceItemId('')} /><span>No saved example selected</span></label>{data.confidenceItems.map((item) => <label key={item.id} className={`evidence-card ${confidenceItemId === item.id ? 'selected' : ''}`}><input type="radio" name="evidence" checked={confidenceItemId === item.id} onChange={() => setConfidenceItemId(item.id)} /><span><small>{item.title}</small>{item.detail}</span></label>)}{!data.confidenceItems.length && <p className="muted">Your bank is empty. You can record your own evidence below.</p>}</div>}
        {(step.type === 'text' || step.type === 'evidence') && <>
          <textarea id="answer" aria-labelledby="prompt" aria-describedby="hint" rows={4} value={answers[step.key] || ''} placeholder={step.placeholder} onChange={(event) => setAnswers({ ...answers, [step.key]: event.target.value })} />
          <p className="input-tip">A sentence is enough. Leave any answer blank if it does not help.</p>
          {module === 'confidence' && ['effort', 'success', 'progress'].includes(step.key) && <label className="checkbox-label"><input type="checkbox" checked={bankFields.includes(step.key)} onChange={(event) => setBankFields(event.target.checked ? [...bankFields, step.key] : bankFields.filter((field) => field !== step.key))} />Add this example to my Confidence Bank</label>}
        </>}
        {(step.type === 'breath' || step.type === 'timer') && <Timer key={step.key} seconds={step.seconds!} breathing={step.type === 'breath'} onRecord={(value) => setAnswers((current) => ({ ...current, [step.key]: value }))} />}
        {error && <Notice error>{error}</Notice>}
      </>}
    </main>
    {!saved && <footer className="flow-footer"><div><button className="button secondary" disabled={index === 0} aria-label="Previous step" onClick={() => setIndex(index - 1)}>Back</button><span /><button className="text-button" aria-label="Skip this step" onClick={() => advance(true)}>Skip</button><button className="button" onClick={() => advance()}>{index === steps.length - 1 ? 'Save entry' : 'Continue'}</button></div></footer>}
  </div>
}
