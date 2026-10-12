import { useState } from 'react'
import type { CloudAccount } from './useCloud'
import { download, Notice } from './ui'

export default function Account({ cloud }: { cloud: CloudAccount }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const { state, user } = cloud
  const choice = state.mode === 'choice' || state.mode === 'conflict'
  return <section className="panel cloud-panel" aria-labelledby="cloud-title"><h2 id="cloud-title">Cloud storage</h2>
    {!cloud.configured ? <p>Cloud storage is not connected to this deployment yet. Your entries are saved in this browser only. Export backups until the owner connects the service.</p> : !cloud.authReady ? <p role="status">Checking sign-in…</p> : !user ? <>
      <p>Sign in to keep your routines and memories in your private account and use them across devices. Signing in sends your email to Supabase; connecting your entries sends them to your account.</p>
      <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); const result = await cloud.signIn(email.trim()); setMessage(result.message); setError(!result.ok); setBusy(false) }}><label className="field">Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>
    </> : <>
      <p>Signed in as <strong>{user.email}</strong></p><p role="status">{state.message}</p>{state.updatedAt && <p className="muted">Last cloud save: {new Date(state.updatedAt).toLocaleString()}</p>}
      {choice && <div className="cloud-conflict"><h3>{state.remote ? 'Choose a copy' : 'Connect your entries'}</h3><p>{state.remote ? 'Using the cloud copy replaces the entries in this browser. Using this browser’s copy replaces the entries in your account. Download both copies first if you need to combine them by hand.' : 'Upload this browser’s entries to your private cloud account. Future saved changes will sync automatically.'}</p><div className="button-row">
        <button className="button" disabled={state.mode === 'conflict' && !state.remote} onClick={() => { if (!state.remote || window.confirm('Replace your cloud entries with all entries from this browser? Download both backups first if needed.')) cloud.useLocal() }}>{state.remote ? 'Use browser copy' : 'Start cloud storage'}</button>
        {state.remote && <><button className="button secondary" onClick={() => { if (window.confirm('Replace this browser’s entries with your cloud copy? Export your browser backup first if needed.')) cloud.useRemote() }}>Use cloud copy</button><button className="text-button" onClick={() => download(JSON.stringify(state.remote!.data, null, 2), 'confidence-lab-cloud-backup.json')}>Download cloud copy</button></>}
      </div></div>}
      {['error', 'conflict'].includes(state.mode) && <button className="button secondary" onClick={cloud.retry}>Retry cloud connection</button>}
      <button className="text-button" disabled={busy} onClick={async () => { if (state.pending && !window.confirm('Some changes are not confirmed in cloud storage. Sign out and keep them in this browser? Export a backup before clearing browser data.')) return; setBusy(true); try { await cloud.signOut() } catch { setError(true); setMessage('Sign-out failed. Please retry.') } finally { setBusy(false) } }}>Sign out</button><p className="muted">Signing out keeps entries on this device. On a shared device, sign out and clear this browser’s entries after confirming a cloud save.</p>
    </>}
    {message && <Notice error={error}>{message}</Notice>}{cloud.authError && <Notice error>{cloud.authError}</Notice>}
  </section>
}
