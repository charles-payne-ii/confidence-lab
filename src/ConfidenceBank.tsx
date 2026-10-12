import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { deleteMemory, emptyDraft, EVIDENCE, FEELINGS, milestoneLabel, milestoneLine, readBank, saveMemory, type MemoryDraft } from './bank'
import type { AppData, Memory } from './model'
import Pillar from './Pillar'
import ZeusMark from './ZeusMark'
import { Notice, type Commit } from './ui'

export function BankBand({ data, open, add, dark }: { data: AppData; open: () => void; add: () => void; dark: boolean }) {
  const count = readBank(data).memories.length
  return <section className="bank-band" aria-label="Confidence Bank"><button className="pillar-link" onClick={open} aria-label="Open Confidence Bank"><Pillar count={count} tierHeight={8} onDark={dark} /></button><div><p className="eyebrow">Confidence Bank</p><p className="bank-count">{count} of 10 memories</p><p className="bank-milestone">{milestoneLine(count)}</p>{count < 10 && <button className="text-button bank-add-link" onClick={add}>Add a memory ›</button>}</div></section>
}

export function BankIntro({ add, home, dark }: { add: () => void; home: () => void; dark: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  return <main id="main" tabIndex={-1} className={`bank-frame ${dark ? 'bank-dark' : 'bank-light'} bank-intro`}>
    <ZeusMark className="intro-zeus zeus-glow" /><p className="eyebrow">Confidence Lab</p><h1 ref={heading} tabIndex={-1}>Build your<br />Confidence Bank</h1><p className="bank-intro-copy">Your past holds evidence of what you can do. Start with three specific moments of effort, success, or progress.</p>
    <div className="intro-pillar"><Pillar count={0} tierHeight={14} onDark={dark} /><div><p className="eyebrow">Your bank</p><p className="bank-count">0 of 10 memories</p><p className="bank-milestone">Three set your foundation.</p></div></div>
    <div className="bank-bottom"><button className="bank-primary" onClick={add}>Add my first memory</button><button className="text-button" onClick={home}>Start my day</button></div>
  </main>
}

function Chips({ choices, values, onChange, label }: { choices: string[]; values: string[]; onChange: (values: string[]) => void; label: string }) {
  const selected = values.filter((value) => choices.includes(value))
  const other = values.filter((value) => !choices.includes(value)).join(', ')
  return <>
    <div className="memory-chips" role="group" aria-label={label}>{choices.map((choice) => <button key={choice} type="button" aria-pressed={selected.includes(choice)} className={selected.includes(choice) ? 'selected' : ''} onClick={() => onChange(values.includes(choice) ? values.filter((value) => value !== choice) : [...values, choice])}>{choice}</button>)}</div>
    <label className="memory-field"><span>In your own words <small>(optional)</small></span><input value={other} onChange={(event) => onChange([...selected, ...(event.target.value ? [event.target.value] : [])])} /></label>
  </>
}

function MemoryCard({ draft }: { draft: MemoryDraft }) {
  return <article className="memory-review-card"><div><h2>{draft.title}</h2>{draft.type && <span className="memory-type">{draft.type}</span>}</div><p>{draft.happened}</p><dl><div><dt>Evidence</dt><dd>{draft.evidence.join(', ')}</dd></div><div><dt>Feeling</dt><dd>{draft.feelings.join(', ')}</dd></div></dl></article>
}

export function MemoryCapture({ data, commit, editingId, initialDraft, home, bank, registerGuard }: { data: AppData; commit: Commit; editingId?: string; initialDraft?: MemoryDraft; home: () => void; bank: () => void; registerGuard: (dirty: boolean) => void }) {
  const fieldId = useId()
  const existing = readBank(data).memories.find((memory) => memory.id === editingId)
  const [draft, setDraft] = useState<MemoryDraft>(() => existing ? { title: existing.title, happened: existing.happened, evidence: existing.evidence, feelings: existing.feelings, type: existing.type } : initialDraft ?? emptyDraft())
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'capture' | 'review' | 'saved'>(existing ? 'review' : 'capture')
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<'saved' | 'memory' | false>(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const count = readBank(data).memories.length
  const dirty = phase !== 'saved' && JSON.stringify(draft) !== JSON.stringify(existing ? { title: existing.title, happened: existing.happened, evidence: existing.evidence, feelings: existing.feelings, type: existing.type } : emptyDraft())
  useEffect(() => { registerGuard(dirty); return () => registerGuard(false) }, [dirty, registerGuard])
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [phase, step])
  const canContinue = step === 0 ? Boolean(draft.title.trim()) : step === 1 ? Boolean(draft.happened.trim()) && draft.happened.length <= 300 : step === 2 ? draft.evidence.some((value) => value.trim()) : draft.feelings.some((value) => value.trim())
  const titles = ['Name the moment', 'What happened?', 'What does this show about you?', 'Return to that moment. What did you feel?']
  const hints = ['A short title in the past tense, without “I”.', 'Be specific: the situation, what you did, the result.', 'Choose what this moment shows. You can add your own words.', 'Choose words for what you felt then. You can add your own.']
  const save = () => {
    const result = saveMemory(data, draft, editingId)
    if (!result.ok) { setError(result.message); return }
    const status = commit(result.data)
    if (!status) return
    setOutcome(status); registerGuard(false)
    if (editingId) { bank(); return }
    setPhase('saved')
  }
  const back = () => { if (phase === 'review') { if (editingId) bank(); else { setPhase('capture'); setStep(3) } } else if (step > 0) setStep(step - 1); else bank() }

  if (phase === 'saved') return <main id="main" tabIndex={-1} className="bank-frame bank-light bank-progress">
    <p className="eyebrow">{count === 3 ? 'Foundation set · 3 of 10' : outcome === 'memory' ? 'Kept in this tab' : 'Added to your bank'}</p><h1 ref={heading} tabIndex={-1}>{count === 3 ? 'Your Confidence Bank is ready.' : `${count} of 10 memories`}</h1><p className="bank-intro-copy">{count === 3 ? 'Five to seven memories make it stronger.' : milestoneLine(count)}</p><Pillar count={count} tierHeight={22} highlightNewest />{outcome === 'memory' && <Notice error>Browser storage could not save this memory. Export a backup before closing the tab.</Notice>}
    <div className="bank-bottom">{count === 3 ? <><button className="bank-primary" onClick={home}>Start my day</button><button className="bank-secondary" onClick={() => { setDraft(emptyDraft()); setStep(0); setPhase('capture'); setOutcome(false) }}>Add another</button></> : <>{count < 10 && <button className="bank-primary" onClick={() => { setDraft(emptyDraft()); setStep(0); setPhase('capture'); setOutcome(false) }}>Add another</button>}<button className={count === 10 ? 'bank-primary' : 'text-button'} onClick={home}>{count < 3 ? 'Finish later' : 'Done'}</button></>}</div>
  </main>

  return <main id="main" tabIndex={-1} className="bank-frame bank-light memory-capture">
    <div className="memory-top"><button className="text-button back-arrow" aria-label="Back" onClick={back}>‹</button>{phase === 'capture' && <div className="step-dots" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>}<button className="text-button" onClick={home}>Exit</button></div>
    <p className="eyebrow">{editingId ? 'Edit memory' : `Memory ${count + 1}`} · {phase === 'review' ? 'Review' : `Step ${step + 1} of 4`}</p><h1 ref={heading} tabIndex={-1}>{phase === 'review' ? 'Your memory' : titles[step]}</h1>
    {phase === 'review' ? <><MemoryCard draft={draft} /><div className="bank-bottom"><button className="bank-primary" onClick={save}>{editingId ? 'Save changes' : 'Add to Bank'}</button><button className="bank-secondary" onClick={() => { setPhase('capture'); setStep(0) }}>Edit</button></div></> : <>
      <p className="memory-hint">{hints[step]}</p>
      {step === 0 && <><label className="memory-field"><span>Title</span><input value={draft.title} placeholder="Led the difficult client presentation" onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><fieldset className="memory-type-picker"><legend>Type <small>(optional)</small></legend><div className="memory-chips">{(['success', 'effort', 'progress'] as const).map((type) => <button type="button" aria-pressed={draft.type === type} className={draft.type === type ? 'selected' : ''} key={type} onClick={() => setDraft({ ...draft, type: draft.type === type ? undefined : type })}>{type[0].toUpperCase() + type.slice(1)}</button>)}</div></fieldset></>}
      {step === 1 && <><div className="memory-field"><label htmlFor={`${fieldId}-happened`}>What happened</label><textarea id={`${fieldId}-happened`} rows={6} maxLength={300} placeholder="The situation, what you did, and the result…" value={draft.happened} onChange={(event) => setDraft({ ...draft, happened: event.target.value })} /></div><p className="character-count">{draft.happened.length} / 300</p></>}
      {step === 2 && <Chips label="Evidence" choices={EVIDENCE} values={draft.evidence} onChange={(evidence) => setDraft({ ...draft, evidence })} />}
      {step === 3 && <Chips label="Feelings" choices={FEELINGS} values={draft.feelings} onChange={(feelings) => setDraft({ ...draft, feelings })} />}
      <div className="bank-bottom"><button className="bank-primary" disabled={!canContinue} onClick={() => step === 3 ? setPhase('review') : setStep(step + 1)}>{step === 3 ? 'Review memory' : 'Continue'}</button></div>
    </>}{error && <Notice error>{error}</Notice>}
  </main>
}

export function Remember({ memory, data, home, add }: { memory: Memory; data: AppData; home: () => void; add: () => void }) {
  const [stage, setStage] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const count = readBank(data).memories.length
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [stage])
  const title = [...memory.title]
  title[0] = title[0].toLocaleLowerCase()
  return <main id="main" tabIndex={-1} className={`bank-frame bank-dark remember remember-${stage}`}>
    <div className="remember-bars" aria-label={`Stage ${stage + 1} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={i <= stage ? 'on' : ''} />)}</div>
    {stage === 0 && <><p className="eyebrow">Remember when you…</p><h1 className="memory-fade" ref={heading} tabIndex={-1}>{title.join('')}</h1><div className="remember-rule" /><blockquote className="memory-fade quote-fade">“{memory.happened}”</blockquote></>}
    {stage === 1 && <><div className="pause-mark"><span className="pause-ring" aria-hidden="true" /><ZeusMark className="pause-zeus zeus-glow" /></div><h1 ref={heading} tabIndex={-1}>Take one slow breath.</h1><p className="memory-hint">Picture where you were and what you did.</p></>}
    {stage === 2 && <><h1 className="eyebrow" ref={heading} tabIndex={-1}>You felt</h1><div className="feeling-words">{memory.feelings.map((feeling, i) => <p className="memory-fade" key={`${i}-${feeling}`} style={{ '--fade-delay': `${i * 1.2}s` } as CSSProperties}>{feeling}</p>)}</div><div className="remember-rule" /><p className="remember-carry">Let it come back. That’s still you.</p></>}
    {stage === 3 && <><h1 className="eyebrow" ref={heading} tabIndex={-1}>Confidence Bank</h1><Pillar count={count} onDark tierHeight={20} /><p className="bank-count">{count} of 10 memories</p><p className="bank-milestone">{milestoneLabel(count) || milestoneLine(count)}</p></>}
    <div className="bank-bottom">{stage < 3 ? <button className="remember-next" onClick={() => setStage(stage + 1)}>{stage === 1 ? 'Tap when ready' : 'Tap to continue'}</button> : <><button className="bank-primary" onClick={home}>Start my day</button>{count < 10 && <button className="bank-secondary" onClick={add}>Fill the bank</button>}</>}</div>
  </main>
}

export function BankList({ data, commit, edit, add, dark }: { data: AppData; commit: Commit; edit: (id: string) => void; add: () => void; dark: boolean }) {
  const memories = readBank(data).memories
  return <div className="bank-list"><header><Pillar count={memories.length} tierHeight={8} onDark={dark} /><div><h1>Confidence<br />Bank</h1><p className="bank-count">{memories.length} of 10 memories</p><p className="bank-milestone">{milestoneLabel(memories.length) || milestoneLine(memories.length)}</p></div></header>
    {!memories.length && <p className="empty">Add a specific moment of effort, success, or progress to begin.</p>}
    {memories.map((memory) => <article key={memory.id}><div><h2>{memory.title}</h2>{memory.type && <span className="memory-type">{memory.type}</span>}</div><p>Showed {memory.evidence.join(', ')}</p><div className="button-row"><button className="text-button" onClick={() => edit(memory.id)}>View and edit</button><button className="text-button danger" onClick={() => { if (window.confirm(`Delete “${memory.title}” from your bank? This cannot be undone.`)) commit(deleteMemory(data, memory.id)) }}>Delete</button></div></article>)}
    {memories.length < 10 && <button className="bank-primary" onClick={add}>Add a memory</button>}
  </div>
}
