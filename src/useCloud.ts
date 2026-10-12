import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { CloudSync, type CloudState } from './cloud'
import type { AppData } from './model'
import { cloudConfigured, getSupabase, supabaseBackend } from './supabase'

export function useCloud(data: AppData, apply: (data: AppData, explicit: boolean) => boolean) {
  const dataRef = useRef(data); dataRef.current = data
  const applyRef = useRef(apply); applyRef.current = apply
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [state, setState] = useState<CloudState>({ mode: 'signed-out', message: 'Saved in this browser only.', pending: false })
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [clientLoaded, setClientLoaded] = useState(false)
  const syncRef = useRef<CloudSync | null>(null)
  const currentUser = useRef<User | null>(null)
  currentUser.current = user
  useEffect(() => {
    let active = true
    void getSupabase().then((client) => {
      if (!active) return
      setSupabase(client); setClientLoaded(true)
      if (cloudConfigured && !client) setAuthError('Cloud sign-in could not start. Check browser storage settings or the service configuration, then reload. Keep a JSON backup of unsynced entries.')
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!clientLoaded) return
    if (!supabase) { setAuthReady(true); return }
    let active = true
    let storage: Storage | null = null
    try { storage = window.localStorage } catch { /* Cloud still works for this session. */ }
    const sync = new CloudSync(supabaseBackend(supabase), { get: () => dataRef.current, apply: (next, explicit) => applyRef.current(next, explicit) }, (next) => { if (active) setState(next) }, storage)
    syncRef.current = sync
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setAuthReady(true) }
    })
    void supabase.auth.getSession().then(({ data: session, error }) => {
      if (!active) return
      if (error) setAuthError('Sign-in could not be restored. Sign in again to sync your entries.')
      setUser(session.session?.user ?? null); setAuthReady(true)
    }).catch(() => { if (active) { setAuthError('Sign-in could not be restored.'); setAuthReady(true) } })
    const retry = () => {
      if (currentUser.current && !['loading', 'saving', 'choice', 'conflict'].includes(stateRef.current.mode)) void sync.connect(currentUser.current.id)
    }
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => { active = false; sync.stop(); syncRef.current = null; subscription.subscription.unsubscribe(); window.removeEventListener('online', retry); window.removeEventListener('focus', retry) }
  }, [supabase, clientLoaded])
  const stateRef = useRef(state); stateRef.current = state
  useEffect(() => {
    if (!authReady || !syncRef.current) return
    if (user) void syncRef.current.connect(user.id)
    else syncRef.current.stop()
  }, [user?.id, authReady])
  useEffect(() => { syncRef.current?.changed() }, [data])
  return {
    user, state, authReady, authError, configured: cloudConfigured,
    async signIn(email: string) {
      if (!supabase) return { ok: false, message: cloudConfigured ? 'Cloud sign-in is unavailable in this browser. Check the message above and reload.' : 'Cloud storage has not been connected to this deployment yet.' }
      try {
        const redirect = new URL(import.meta.env.BASE_URL, window.location.origin).href
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
        return error ? { ok: false, message: 'The sign-in email could not be sent. Check the address and try again shortly.' } : { ok: true, message: 'Check your email and open the sign-in link in this browser. Then return to Data & privacy to finish connecting your entries.' }
      } catch { return { ok: false, message: 'Sign-in could not reach the service. Check your connection and retry.' } }
    },
    async signOut() {
      if (!supabase) return
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) { setAuthError('Sign-out failed. Please try again.'); return }
      syncRef.current?.stop(); setUser(null); setAuthError('')
    },
    retry: () => { if (user) void syncRef.current?.connect(user.id) },
    useLocal: () => syncRef.current?.useLocal(),
    useRemote: () => syncRef.current?.useCloud(),
  }
}
export type CloudAccount = ReturnType<typeof useCloud>
