-- Additive banking module; existing budgets and life areas are unchanged.
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank text not null check (length(bank) between 1 and 80),
  name text not null check (length(name) between 1 and 100),
  person text not null check (person in ('Erwin','Raquel','Casal')),
  kind text not null default 'checking' check (kind in ('checking','credit')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  balance numeric(16,2),
  balance_at timestamptz,
  provider_id text,
  item_id text,
  unique(owner_id,provider_id),
  unique(id,owner_id)
);
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  external_id text not null check (length(external_id) between 1 and 300),
  booked_on date not null,
  description text not null check (length(description) between 1 and 500),
  amount numeric(16,2) not null check (amount <> 0),
  category text not null default 'Sem categoria' check (length(category) between 1 and 80),
  flow text not null default 'normal' check (flow in ('normal','transfer','ignore')),
  source text not null check (source in ('manual','csv','ofx','pluggy')),
  created_at timestamptz not null default now(),
  foreign key(account_id,owner_id) references public.bank_accounts(id,owner_id) on delete cascade,
  unique(account_id,external_id)
);
create index bank_transactions_owner_date on public.bank_transactions(owner_id,booked_on desc);
create index bank_transactions_account_owner on public.bank_transactions(account_id,owner_id);
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
revoke all on public.bank_accounts, public.bank_transactions from anon,authenticated;
grant select,delete on public.bank_accounts,public.bank_transactions to authenticated;
grant insert(bank,name,person,kind) on public.bank_accounts to authenticated;
grant update(name,person) on public.bank_accounts to authenticated;
grant insert(account_id,external_id,booked_on,description,amount,category,flow,source) on public.bank_transactions to authenticated;
grant update(category,flow) on public.bank_transactions to authenticated;
create policy bank_accounts_read on public.bank_accounts for select to authenticated using(owner_id=(select auth.uid()));
create policy bank_accounts_create on public.bank_accounts for insert to authenticated with check(owner_id=(select auth.uid()) and lower((select auth.jwt())->>'email')='erwinklein1994@gmail.com');
create policy bank_accounts_edit on public.bank_accounts for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy bank_accounts_remove on public.bank_accounts for delete to authenticated using(owner_id=(select auth.uid()));
create policy bank_transactions_read on public.bank_transactions for select to authenticated using(owner_id=(select auth.uid()));
create policy bank_transactions_create on public.bank_transactions for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.bank_accounts a where a.id=account_id and a.owner_id=(select auth.uid())));
create policy bank_transactions_edit on public.bank_transactions for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy bank_transactions_remove on public.bank_transactions for delete to authenticated using(owner_id=(select auth.uid()));
comment on table public.bank_accounts is 'Real accounts for the shared family login. Provider credentials are Edge Function secrets only.';
comment on column public.bank_transactions.amount is 'BRL signed amount: income positive, expense negative. Transfers excluded using flow.';

-- Server-only ingestion: refresh bank fields while preserving the user's classification.
create function public.ingest_bank_transactions(p_account uuid,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_count integer;
begin
  select owner_id into strict v_owner from public.bank_accounts where id=p_account;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then
    raise exception 'Expected up to 500 transactions';
  end if;
  insert into public.bank_transactions(owner_id,account_id,external_id,booked_on,description,amount,source)
  select v_owner,p_account,x.external_id,x.booked_on,x.description,x.amount,'pluggy'
  from jsonb_to_recordset(p_rows) as x(external_id text,booked_on date,description text,amount numeric)
  on conflict(account_id,external_id) do update
    set booked_on=excluded.booked_on,description=excluded.description,amount=excluded.amount;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.ingest_bank_transactions(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_bank_transactions(uuid,jsonb) to service_role;
