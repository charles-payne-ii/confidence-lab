import { useCallback, useEffect, useRef, useState } from 'react'
import Flow from './Flow'
import ZeusMark from './ZeusMark'
import { MODULES } from './exercises'
import { countDistinctPracticeDays, lastLocalDates, type AppData, type ModuleId } from './model'
import { ConfidenceBank as LegacyExamples, DataPrivacy, History, WeeklyReview } from './Records'
import { BankBand, BankIntro, BankList, MemoryCapture, Remember } from './ConfidenceBank'
import { emptyDraft, planBankOpen, readBank, type MemoryDraft } from './bank'
import { useCloud } from './useCloud'
import Account from './CloudAccount'
import { DataStore } from './storage'
import { download, formatDate, Notice, type Commit } from './ui'

type View = 'home' | 'history' | 'bank' | 'review' | 'data' | 'intro' | 'remember' | 'capture' | ModuleId
const navItems = [['home', 'Home'], ['history', 'History'], ['bank', 'Confidence Bank'], ['review', 'Weekly Review'], ['data', 'Data & privacy']] as const
const views: View[] = ['home', 'history', 'bank', 'review', 'data', 'confidence', 'prepare', 'pressure', 'setbacks']

function routeFromHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const candidate = hash === 'practice' ? 'confidence' : hash
  return views.includes(candidate as View) ? candidate as View : 'home'
}

function initialTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function Home({ data, start, openBank, addMemory, dark }: { data: AppData; start: (module: ModuleId) => void; openBank: () => void; addMemory: () => void; dark: boolean }) {
  const days = lastLocalDates(7)
  const practiced = new Set(data.practiceEntries.map((entry) => entry.localDate))
  const count = countDistinctPracticeDays(data.practiceEntries, days)
  return <div className="home-content">
    <section className="home-lead" aria-labelledby="lead-title"><p className="eyebrow">I · Daily · 3 min</p><h1 id="lead-title">Build Confidence</h1><p>Record your progress, one day at a time.</p><button className="button begin-button" onClick={() => start('confidence')}>Begin entry</button></section>
    <BankBand data={data} open={openBank} add={addMemory} dark={dark} />
    {!data.practiceEntries.length && <p className="first-entry">A useful first entry: name one thing you worked at today. One answer is enough.</p>}
    <ul className="module-list">{MODULES.slice(1).map((module) => <li key={module.id}><button onClick={() => start(module.id)}><span className="module-number">{module.number}</span><span><strong>{module.title}</strong><small>{module.description}</small></span><span className="module-time">{module.time} ›</span></button></li>)}</ul>
    <section className="week" aria-label={`${count} distinct practice days in the last seven local calendar days`}><h2 className="eyebrow">The week</h2><ul>{days.map((day) => {
      const [year, month, date] = day.split('-').map(Number)
      const letter = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(year, month - 1, date))
      return <li key={day} aria-label={`${formatDate(day)}: ${practiced.has(day) ? 'practice recorded' : 'no practice recorded'}`} title={formatDate(day)}><span className="day-letter">{letter}</span><span aria-hidden="true" className={`day-box ${practiced.has(day) ? 'on' : ''}`}>{practiced.has(day) ? '✓' : ''}</span></li>
    })}</ul><p>{count} {count === 1 ? 'practice day' : 'practice days'}</p></section>
  </div>
}

export default function App() {
  const [initial] = useState(() => {
    const store = new DataStore()
    const result = store.load()
    const route = routeFromHash()
    const plan = route === 'home' && (result.status === 'ok' || result.status === 'empty') ? planBankOpen(result.data) : { screen: route, data: result.data }
    return { store, result, plan }
  })
  const [data, setData] = useState(initial.plan.data)
  const [storageMessage, setStorageMessage] = useState(initial.result.status === 'ok' || initial.result.status === 'empty' ? '' : initial.result.message)
  const [corruptRaw, setCorruptRaw] = useState<string | null>(initial.result.status === 'corrupt' ? initial.result.raw : null)
  const [view, setView] = useState<View>(initial.plan.screen)
  const [recalled, setRecalled] = useState('memory' in initial.plan ? initial.plan.memory : undefined)
  const [capture, setCapture] = useState<{ id?: string; draft?: MemoryDraft; key: number }>({ key: 0 })
  const [theme, setTheme] = useState(initialTheme)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 880px)').matches)
  const [sideOpen, setSideOpen] = useState(wide)
  const [themeMessage, setThemeMessage] = useState('')
  const dirtyRef = useRef(false)
  const memoryOnlyRef = useRef(false)
  const currentViewRef = useRef(view)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const flowModule = MODULES.find((module) => module.id === view)?.id
  const fullScreen = Boolean(flowModule || ['intro', 'remember', 'capture'].includes(view))
  const registerGuard = useCallback((dirty: boolean) => { dirtyRef.current = dirty }, [])
  const closeMenu = useCallback(() => {
    setSideOpen(false)
    window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }, [])

  const canLeave = () => !dirtyRef.current || window.confirm('Exit without saving? Your answers in this routine will be lost. Use Save to keep a partial entry.')
  const go = (next: View) => {
    if (next !== view && !canLeave()) return
    dirtyRef.current = false
    currentViewRef.current = next
    setView(next)
    if (!wide) setSideOpen(false)
    const hash = next === 'home' ? '#/' : `#/${next}`
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash()
      if (next === currentViewRef.current) return
      if (dirtyRef.current && !window.confirm('Leave this routine without saving your answers?')) {
        window.history.pushState(null, '', currentViewRef.current === 'home' ? '#/' : `#/${currentViewRef.current}`)
        return
      }
      dirtyRef.current = false
      currentViewRef.current = next
      setView(next)
      window.scrollTo(0, 0)
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || memoryOnlyRef.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); window.removeEventListener('beforeunload', beforeUnload) }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1e1428' : '#f4f3f6')
  }, [theme])
  useEffect(() => {
    const media = window.matchMedia('(min-width: 880px)')
    const resize = () => { setWide(media.matches); setSideOpen(media.matches) }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
  useEffect(() => { if (!fullScreen) (headingRef.current ?? mainRef.current)?.focus({ preventScroll: true }) }, [view, fullScreen])

  useEffect(() => {
    if (!sideOpen || wide || fullScreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeMenu(); return }
      if (event.key !== 'Tab') return
      const targets = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button, a') ?? [])
      const first = targets[0], last = targets.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown) }
  }, [sideOpen, wide, fullScreen, closeMenu])

  useEffect(() => {
    if (initial.plan.data === initial.result.data) return
    const result = initial.store.save(initial.plan.data)
    if (!result.ok) { setStorageMessage(result.message); memoryOnlyRef.current = true }
  }, [initial])

  const commit: Commit = (next) => {
    if (corruptRaw !== null) { setStorageMessage('Resolve the unreadable saved data in Data & privacy before changing entries.'); return false }
    const result = initial.store.save(next)
    setData(next)
    setStorageMessage(result.ok ? '' : result.message)
    memoryOnlyRef.current = !result.ok
    return result.ok ? 'saved' : 'memory'
  }
  const replace = (next: AppData): boolean => {
    const result = initial.store.save(next, true)
    if (!result.ok) { setStorageMessage(`${result.message} Existing data was not replaced.`); return false }
    setData(next); setStorageMessage(''); setCorruptRaw(null); memoryOnlyRef.current = false
    return true
  }
  const cloud = useCloud(data, (next, explicit) => {
    if (!explicit && (dirtyRef.current || corruptRaw !== null)) return false
    if (explicit && !canLeave()) return false
    const result = initial.store.save(next, explicit)
    if (!result.ok && corruptRaw !== null) { setStorageMessage(result.message); return false }
    setData(next); setStorageMessage(result.ok ? '' : result.message); memoryOnlyRef.current = !result.ok
    if (explicit) setCorruptRaw(null)
    if (explicit || (!dirtyRef.current && fullScreen)) {
      const plan = planBankOpen(next)
      if (plan.data !== next) {
        setData(plan.data)
        const saved = initial.store.save(plan.data)
        if (!saved.ok) { setStorageMessage(saved.message); memoryOnlyRef.current = true }
      }
      setRecalled(plan.memory); go(plan.screen)
    }
    return true
  })
  memoryOnlyRef.current = Boolean(storageMessage && cloud.state.mode !== 'ready')
  const addMemory = (draft?: MemoryDraft, id?: string) => {
    if (!canLeave()) return
    setCapture((current) => ({ key: current.key + 1, draft, id }))
    dirtyRef.current = false
    go('capture')
  }
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('confidence-lab.theme', next); setThemeMessage('') }
    catch { setThemeMessage('Theme changed for this tab. Browser storage could not remember it.') }
  }

  const titles: Record<string, [string, string]> = {
    history: ['History', 'Every saved routine and review, newest first. Select an entry to view, edit, or delete it.'],
    bank: ['Confidence Bank', 'Specific evidence of effort, success, and progress. Select relevant examples before an event.'],
    review: ['Weekly Review', 'A short look back before the next week.'],
    data: ['Data & privacy', 'Manage your account, entries, and backups.'],
  }
  const storageNotice = storageMessage && <Notice error><strong>Local storage needs attention.</strong><p>{storageMessage}</p><div className="button-row">{corruptRaw !== null ? <button className="text-button" onClick={() => download(corruptRaw, 'confidence-lab-unreadable.txt', 'text/plain')}>Download original data</button> : <button className="text-button" onClick={() => download(JSON.stringify(data, null, 2), 'confidence-lab-tab-backup.json')}>Export tab backup</button>}{view !== 'data' && <button className="text-button" onClick={() => go('data')}>Data & privacy</button>}</div></Notice>
  const cloudStatus = <div className="cloud-status" role="status">{cloud.state.message} {cloud.user && cloud.state.mode !== 'ready' ? <button className="text-button" onClick={() => go('data')}>Manage cloud storage</button> : !cloud.user && <button className="text-button" onClick={() => go('data')}>Cloud storage & backups</button>}</div>

  return <>
    <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
    {fullScreen ? <><div className="flow-notices">{storageNotice}{cloud.user && cloud.state.mode !== 'ready' && cloudStatus}</div>
      {flowModule && <Flow key={flowModule} module={flowModule} data={data} commit={commit} addMemory={addMemory} exit={(history) => go(history ? 'history' : 'home')} registerGuard={registerGuard} />}
      {view === 'intro' && <BankIntro dark={theme === 'dark'} add={() => addMemory()} home={() => go('home')} />}
      {view === 'remember' && recalled && <Remember memory={recalled} data={data} home={() => go('home')} add={() => addMemory()} />}
      {view === 'capture' && <MemoryCapture key={capture.key} data={data} commit={commit} editingId={capture.id} initialDraft={capture.draft ?? emptyDraft()} home={() => go('home')} bank={() => go('bank')} registerGuard={registerGuard} />}
    </> : <div className="app-layout">
      {sideOpen && <>
        {!wide && <button tabIndex={-1} className="menu-overlay" aria-label="Close menu" onClick={closeMenu} />}
        <aside ref={sidebarRef} className="sidebar" role={!wide ? 'dialog' : undefined} aria-modal={!wide ? true : undefined} aria-label="Main menu">
          <div className="sidebar-brand"><button className="brand" aria-label="Confidence Lab home" onClick={() => go('home')}><ZeusMark className="brand-mark" /><span>Confidence Lab</span></button><button className="collapse-menu" aria-label="Collapse menu" onClick={closeMenu}>‹</button></div>
          <nav aria-label="Main navigation">{navItems.map(([route, label]) => <button key={route} className={route === view ? 'current' : ''} aria-current={route === view ? 'page' : undefined} onClick={() => go(route)}><span className="nav-dot" aria-hidden="true" />{label}</button>)}</nav>
          <div className="sidebar-bottom"><button className="theme-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'} mode</button>{themeMessage && <p role="status">{themeMessage}</p>}<p>{cloud.user ? 'Your private account can sync entries across devices.' : 'Sign in to connect cloud storage. Otherwise entries stay in this browser.'}</p></div>
        </aside>
      </>}
      <button ref={menuButtonRef} className={`open-menu ${sideOpen ? 'menu-hidden' : ''}`} aria-label="Open menu" title="Open menu" aria-expanded={sideOpen} onClick={() => setSideOpen(true)}><ZeusMark className="brand-mark" /></button>
      <div className="content-column" inert={sideOpen && !wide ? true : undefined}>
        <main ref={mainRef} tabIndex={-1} id="main" className="page"><div className="global-notices">{storageNotice}</div>{cloudStatus}
          {view === 'home' ? <Home data={data} start={go} openBank={() => go('bank')} addMemory={() => addMemory()} dark={theme === 'dark'} /> : <><button className="back-link" onClick={() => go('home')}>← Home</button>{view !== 'bank' && <><h1 ref={headingRef} tabIndex={-1}>{titles[view][0]}</h1><p className="intro">{titles[view][1]}</p></>}{view === 'history' && <><History data={data} commit={commit} /><button className="button secondary" onClick={() => go('bank')}>Open Confidence Bank</button></>}{view === 'bank' && <BankList data={data} commit={commit} edit={(id) => addMemory(undefined, id)} add={() => addMemory()} dark={theme === 'dark'} />}{view === 'review' && <WeeklyReview data={data} commit={commit} />}{view === 'data' && <><Account cloud={cloud} /><DataPrivacy data={data} replace={replace} corruptRaw={corruptRaw} connected={Boolean(cloud.user)} /><section className="recall-setting"><h2>Daily recall</h2><label><input type="checkbox" checked={readBank(data).dailyRecallWhenFull ?? false} onChange={(event) => commit({ ...data, bank: { ...readBank(data), dailyRecallWhenFull: event.target.checked } })} />Keep daily recall when my bank has ten memories</label><p>By default, a full bank opens straight to Home. With one to nine memories, the first open each local day offers a recall.</p></section>{data.confidenceItems.length > 0 && <details><summary>Earlier bank examples</summary><p>These examples remain available before challenges. Add them as full memories yourself when you want to record evidence and feelings.</p><LegacyExamples data={data} commit={commit} /></details>}</>}</>}
        </main>
      </div>
    </div>}
  </>
}
