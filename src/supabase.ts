import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CloudConflict, validSnapshot, type CloudBackend, type CloudSnapshot } from './cloud'
import { validateData } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const cloudConfigured = Boolean(url && key)
let client: SupabaseClient | null = null
// A partial or malformed deployment configuration must not crash the local app.
export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null
  try {
    client ??= createClient(url!, key!, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
    return client
  } catch { return null }
}
function parseRow(row: { payload: unknown; revision: number; updated_at: string }): CloudSnapshot {
  const snapshot = { data: row.payload, revision: Number(row.revision), updatedAt: row.updated_at }
  if (!validSnapshot(snapshot)) throw new Error('Your cloud copy is unreadable. Existing entries have not been replaced.')
  return snapshot
}
export function supabaseBackend(supabase: SupabaseClient): CloudBackend {
  const forUser = async (userId: string) => {
    const { data, error } = await supabase.auth.getSession()
    if (error || data.session?.user.id !== userId) throw new Error('Your sign-in changed. Reconnect cloud storage before saving.')
    // Pin this request to its account, even if sign-out/account switching occurs mid-flight.
    const token = data.session.access_token
    return createClient(url!, key!, { accessToken: async () => token })
  }
  return {
    async read(userId) {
      const account = await forUser(userId)
      const { data, error } = await account.from('user_data').select('payload,revision,updated_at').eq('user_id', userId).maybeSingle()
      if (error) throw new Error('Could not read cloud storage. Check your connection and retry. Your browser entries are intact.')
      return data ? parseRow(data) : null
    },
    async write(userId, payload, expectedRevision) {
      if (!validateData(payload)) throw new Error('Invalid data was not uploaded.')
      const account = await forUser(userId)
      const { data, error } = await account.rpc('save_user_data', { new_payload: payload, expected_revision: expectedRevision })
      if (error?.code === '40001') throw new CloudConflict('Cloud copy changed on another device.')
      if (error) throw new Error('Cloud save failed. Check your connection and retry. Your browser entries are intact.')
      if (!Array.isArray(data) || data.length !== 1) throw new Error('Cloud save was not confirmed. Retry to check your account.')
      return parseRow(data[0])
    },
  }
}
