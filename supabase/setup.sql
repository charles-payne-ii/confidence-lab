-- Run once in your own Supabase project's SQL Editor.
-- Authenticated users can access only the row belonging to auth.uid().
begin;
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'version' = '1'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "Read own entries" on public.user_data;
create policy "Read own entries" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Insert own entries" on public.user_data;
create policy "Insert own entries" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own entries" on public.user_data;
create policy "Update own entries" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

-- An atomic compare-and-swap prevents silent cross-device overwrites.
create or replace function public.save_user_data(new_payload jsonb, expected_revision bigint)
returns table(payload jsonb, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if jsonb_typeof(new_payload) <> 'object' or new_payload->>'version' is distinct from '1' then
    raise exception 'Invalid data format' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    begin
      return query insert into public.user_data as saved (user_id, payload) values (current_user_id, new_payload)
        returning saved.payload, saved.revision, saved.updated_at;
    exception when unique_violation then
      raise exception 'Cloud copy changed' using errcode = '40001';
    end;
  else
    return query update public.user_data as saved set payload = new_payload, revision = saved.revision + 1, updated_at = clock_timestamp()
      where saved.user_id = current_user_id and saved.revision = expected_revision
      returning saved.payload, saved.revision, saved.updated_at;
    if not found then raise exception 'Cloud copy changed' using errcode = '40001'; end if;
  end if;
end;
$$;
revoke all on function public.save_user_data(jsonb,bigint) from public, anon;
grant execute on function public.save_user_data(jsonb,bigint) to authenticated;
commit;
