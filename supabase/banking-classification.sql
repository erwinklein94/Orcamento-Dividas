-- Initial suggestions only: manual classifications are preserved on every update.
create or replace function public.ingest_bank_transactions(p_account uuid,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_owner uuid; v_count integer;
begin
  select owner_id into strict v_owner from public.bank_accounts where id=p_account;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then
    raise exception 'Expected up to 500 transactions';
  end if;
  insert into public.bank_transactions(owner_id,account_id,external_id,booked_on,description,amount,source,category,flow)
  select v_owner,p_account,x.external_id,x.booked_on,x.description,x.amount,'pluggy',
    coalesce(nullif(x.category,''),'Sem categoria'),coalesce(nullif(x.flow,''),'normal')
  from jsonb_to_recordset(p_rows) as x(external_id text,booked_on date,description text,amount numeric,category text,flow text)
  on conflict(account_id,external_id) do update
    set booked_on=excluded.booked_on,description=excluded.description,amount=excluded.amount;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.ingest_bank_transactions(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_bank_transactions(uuid,jsonb) to service_role;
