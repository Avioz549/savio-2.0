-- Run in the Supabase SQL editor. Financial aggregates belong to one auth user.
begin;
create table if not exists public.finance_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{"transactions":[],"workplaces":[],"shifts":[],"goals":[],"budgets":{},"profile":{"name":"","currency":"ILS","language":"en","theme":"dark"}}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint valid_financial_shape check (jsonb_typeof(data) = 'object' and data ?& array['transactions','workplaces','shifts','goals','budgets','profile'] and jsonb_typeof(data->'transactions')='array' and jsonb_typeof(data->'workplaces')='array' and jsonb_typeof(data->'shifts')='array' and jsonb_typeof(data->'goals')='array' and jsonb_typeof(data->'budgets')='object' and jsonb_typeof(data->'profile')='object' and octet_length(data::text)<2000000)
);
alter table public.finance_data enable row level security;
drop policy if exists owner_select on public.finance_data;
create policy owner_select on public.finance_data for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists owner_insert on public.finance_data;
create policy owner_insert on public.finance_data for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists owner_update on public.finance_data;
create policy owner_update on public.finance_data for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists owner_delete on public.finance_data;
create policy owner_delete on public.finance_data for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.finance_data from anon;
grant select,insert,update,delete on public.finance_data to authenticated;
create table if not exists public.request_limits (user_id uuid references auth.users(id) on delete cascade, action text not null, last_request timestamptz not null, primary key(user_id,action));
alter table public.request_limits enable row level security;
revoke all on public.request_limits from anon,authenticated;
create or replace function public.take_request(request_action text, seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
 if auth.uid() is null then return false; end if;
 insert into public.request_limits(user_id,action,last_request) values(auth.uid(),request_action,now())
 on conflict(user_id,action) do update set last_request=now() where request_limits.last_request < now()-make_interval(secs=>seconds);
 get diagnostics affected = row_count;
 return affected=1;
end; $$;
revoke all on function public.take_request(text,integer) from public,anon,authenticated;
create or replace function public.take_ai_request() returns boolean language sql security definer set search_path=public as $$ select public.take_request('ai',15); $$;
create or replace function public.take_account_request() returns boolean language sql security definer set search_path=public as $$ select public.take_request('account',60); $$;
revoke all on function public.take_ai_request() from public,anon;
revoke all on function public.take_account_request() from public,anon;
grant execute on function public.take_ai_request() to authenticated;
grant execute on function public.take_account_request() to authenticated;
commit;

-- Additive upgrade for published SAVIO installations; original source tables stay untouched.
begin;
alter table public.finance_data add column if not exists revision bigint not null default 0 check(revision>=0);
create or replace function public.save_finance_snapshot(snapshot jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path=public as $$
declare saved_revision bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if expected_revision < 0 or snapshot is null then raise exception 'Invalid snapshot'; end if;
 if expected_revision > 0 and not exists(select 1 from public.finance_data where user_id=auth.uid()) then raise exception 'Revision conflict' using errcode='40001'; end if;
 insert into public.finance_data(user_id,data,revision,updated_at) values(auth.uid(),snapshot,1,now())
 on conflict(user_id) do update set data=excluded.data,revision=finance_data.revision+1,updated_at=now()
 where finance_data.revision=expected_revision returning revision into saved_revision;
 if saved_revision is null then raise exception 'Revision conflict' using errcode='40001'; end if;
 return saved_revision;
end; $$;
revoke all on function public.save_finance_snapshot(jsonb,bigint) from public,anon;
grant execute on function public.save_finance_snapshot(jsonb,bigint) to authenticated;
-- Atomic, narrowly scoped self-deletion; no service role in the web application.
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.take_request('account',60) then raise exception 'Rate limited' using errcode='P0001'; end if;
 delete from auth.users where id=auth.uid();
end; $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
commit;

-- Fix the uploaded schema's polymorphic owner trigger. Each record type must be
-- handled in its own PL/pgSQL branch before referencing type-specific fields.
create or replace function public.check_child_owner() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='shifts' then
  if not exists(select 1 from public.workplaces where id=new.workplace_id and user_id=new.user_id) then raise exception 'Workplace owner mismatch'; end if;
 elsif tg_table_name='contributions' then
  if not exists(select 1 from public.goals where id=new.goal_id and user_id=new.user_id) then raise exception 'Goal owner mismatch'; end if;
 else raise exception 'Unsupported owner trigger';
 end if;
 return new;
end $$;
