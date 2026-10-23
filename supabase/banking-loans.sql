-- Read-only snapshots of loans already made available by an existing bank consent.
create table public.bank_loan_snapshots (
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  bank text not null,
  person text not null check (person in ('Erwin','Raquel')),
  loans jsonb not null default '[]'::jsonb check (jsonb_typeof(loans)='array' and octet_length(loans::text)<=2000000),
  coverage text not null check (coverage in ('available','empty','unavailable')),
  checked_at timestamptz not null default now(),
  primary key(owner_id,item_id)
);
alter table public.bank_loan_snapshots enable row level security;
revoke all on public.bank_loan_snapshots from public,anon,authenticated;
grant select on public.bank_loan_snapshots to authenticated;
grant all on public.bank_loan_snapshots to service_role;
create policy bank_loan_snapshots_read on public.bank_loan_snapshots for select to authenticated
using(owner_id=(select auth.uid()));
comment on table public.bank_loan_snapshots is 'Server-written loan snapshots; empty/unavailable never means the household has no loans.';
