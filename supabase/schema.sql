-- Applied to smdoxlutxhcwjxrqeaeo via the Supabase migration API.
-- Financial data is seeded separately and is never embedded in published assets.
create schema if not exists app_private;
create table public.finance_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique check (owner_email = lower(owner_email)),
  owner_id uuid unique references auth.users(id) on delete set null,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint finance_payload_shape check (coalesce(
    jsonb_typeof(payload) = 'object' and payload->>'version' = '2'
    and jsonb_typeof(payload->'reference') = 'object'
    and jsonb_typeof(payload->'defaults') = 'object'
    and jsonb_typeof(payload->'scenarios') = 'array'
    and jsonb_array_length(payload->'scenarios') >= 3
    and jsonb_typeof(payload->'activeId') = 'string'
    and octet_length(payload::text) <= 2000000, false))
);
alter table public.finance_workspaces enable row level security;
revoke all on public.finance_workspaces from anon, authenticated;
grant select on public.finance_workspaces to authenticated;
grant update(payload) on public.finance_workspaces to authenticated;
create policy finance_owner_read on public.finance_workspaces for select to authenticated
  using (owner_id = (select auth.uid()));
create policy finance_owner_update on public.finance_workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function app_private.finance_validate_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from jsonb_array_elements(new.payload->'scenarios') c
                 where c->>'id' = new.payload->>'activeId')
     or (select count(distinct c->>'id') from jsonb_array_elements(new.payload->'scenarios') c)
        <> jsonb_array_length(new.payload->'scenarios')
     or exists (select 1 from jsonb_array_elements(new.payload->'scenarios') c
                where not coalesce(char_length(c->>'name') between 1 and 60
                  and jsonb_typeof(c->'budget'->'renda') = 'array'
                  and jsonb_typeof(c->'budget'->'custos') = 'array'
                  and jsonb_typeof(c->'budget'->'dividas') = 'array'
                  and jsonb_typeof(c->'budget'->'plano') = 'object', false)) then
    raise exception 'Invalid financial scenarios' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then new.revision = old.revision + 1; end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function app_private.finance_validate_write() from public, anon, authenticated;
create trigger finance_validate_write before insert or update on public.finance_workspaces
  for each row execute function app_private.finance_validate_write();

-- Claim the pre-seeded workspace only after Supabase verifies ownership of the email.
-- The email is an administrator-controlled column, not user_metadata/JWT metadata.
create or replace function app_private.finance_claim_verified_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and new.email is not null then
    update public.finance_workspaces set owner_id = new.id
      where owner_id is null and owner_email = lower(new.email);
  end if;
  return new;
end;
$$;
revoke all on function app_private.finance_claim_verified_account() from public, anon, authenticated;
create trigger finance_claim_verified_account after insert or update of email, email_confirmed_at on auth.users
  for each row execute function app_private.finance_claim_verified_account();

comment on table public.finance_workspaces is 'Private budget, complete debt contracts and independent scenarios; revision-checked atomic writes.';
