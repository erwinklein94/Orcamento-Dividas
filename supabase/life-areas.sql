-- Applied to smdoxlutxhcwjxrqeaeo via the Supabase migration API.
-- Áreas da vida (saúde, hábitos, lazer, pets, carreira): um registro por conta e área,
-- separado de finance_workspaces para que editar uma área nunca gere conflito com o orçamento.
create table public.life_areas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area text not null check (area in ('saude','habitos','lazer','pets','carreira')),
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint life_areas_owner_area unique (owner_id, area),
  constraint life_payload_shape check (coalesce(
    jsonb_typeof(payload) = 'object' and payload->>'version' = '1'
    and jsonb_typeof(payload->'collections') = 'object'
    and jsonb_typeof(payload->'deleted') = 'array'
    and octet_length(payload::text) <= 1000000, false))
);
alter table public.life_areas enable row level security;
revoke all on public.life_areas from anon, authenticated;
-- owner_id vem sempre do default auth.uid(); o navegador só escolhe a área e o conteúdo.
grant select, insert(area, payload), update(payload) on public.life_areas to authenticated;
create policy life_owner_read on public.life_areas for select to authenticated
  using (owner_id = (select auth.uid()));
-- Só quem já tem o painel financeiro liberado (e-mail verificado) pode criar áreas.
create policy life_owner_insert on public.life_areas for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.finance_workspaces w where w.owner_id = (select auth.uid())));
create policy life_owner_update on public.life_areas for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function app_private.life_touch()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.revision = old.revision + 1; else new.revision = 1; end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function app_private.life_touch() from public, anon, authenticated;
create trigger life_touch before insert or update on public.life_areas
  for each row execute function app_private.life_touch();

comment on table public.life_areas is 'Private life-area records (health, habits, leisure, pets, career); revision-checked writes.';
