import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { emptyData } from './model'

// Exercise the exact migration and policies in an embedded PostgreSQL engine.
// Supabase's auth.uid() reads the authenticated JWT claim on production.
describe('PostgreSQL cloud policies', () => {
  let db: PGlite
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
  const asUser = async (id: string) => {
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  }
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const sql = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql) // Setup can be run again without dropping saved entries.
    await db.query('insert into auth.users values ($1), ($2)', [a, b])
  }, 20_000)
  afterAll(async () => { await db?.close() })
  it('creates and updates an account copy using an expected revision', async () => {
    await asUser(a)
    const first = await db.query<{ revision: number }>('select * from public.save_user_data($1::jsonb,0)', [JSON.stringify(emptyData())])
    expect(Number(first.rows[0].revision)).toBe(1)
    const edited = { ...emptyData(), bank: { memories: [], rotation: [], dailyRecallWhenFull: true } }
    const second = await db.query<{ revision: number; payload: unknown }>('select * from public.save_user_data($1::jsonb,1)', [JSON.stringify(edited)])
    expect(Number(second.rows[0].revision)).toBe(2)
    expect(second.rows[0].payload).toEqual(edited)
  })
  it('rejects stale revisions without replacing the newer data', async () => {
    await asUser(a)
    await expect(db.query('select * from public.save_user_data($1::jsonb,1)', [JSON.stringify(emptyData())])).rejects.toMatchObject({ code: '40001' })
    await expect(db.query('select * from public.save_user_data($1::jsonb,0)', [JSON.stringify(emptyData())])).rejects.toMatchObject({ code: '40001' })
    expect((await db.query<{ revision: number }>('select revision from public.user_data')).rows[0].revision).toBe(2)
  })
  it('prevents reading, inserting, or updating another account’s entries', async () => {
    await asUser(b)
    expect((await db.query('select * from public.user_data')).rows).toEqual([])
    await expect(db.query('insert into public.user_data(user_id,payload) values($1,$2)', [a, JSON.stringify(emptyData())])).rejects.toMatchObject({ code: '42501' })
    expect((await db.query('update public.user_data set payload=$1 where user_id=$2 returning *', [JSON.stringify(emptyData()), a])).rows).toEqual([])
    await db.query('select * from public.save_user_data($1::jsonb,0)', [JSON.stringify(emptyData())])
    expect((await db.query('select * from public.user_data')).rows).toHaveLength(1)
    await asUser(a)
    expect((await db.query('select * from public.user_data')).rows).toHaveLength(1)
  })
  it('rejects anonymous reads and writes', async () => {
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from public.user_data')).rejects.toMatchObject({ code: '42501' })
    await expect(db.query('select * from public.save_user_data($1::jsonb,0)', [JSON.stringify(emptyData())])).rejects.toMatchObject({ code: '42501' })
  })
  it('rejects an invalid payload before altering an account copy', async () => {
    await asUser(a)
    await expect(db.query('select * from public.save_user_data($1::jsonb,2)', ['{"version":99}'])).rejects.toMatchObject({ code: '22023' })
    expect((await db.query<{ revision: number }>('select revision from public.user_data')).rows[0].revision).toBe(2)
  })
})
