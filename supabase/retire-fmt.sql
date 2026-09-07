-- User requested removal of the previous FMT application from this exact project.
-- Explicit objects only: no DROP SCHEMA CASCADE and no changes to managed schemas.
drop function public.registrar_acesso(text, timestamptz);
drop table public.inspecoes_fmt;
drop table public.auditoria_acessos;
drop table public.perfis;
drop function app_private.usuario_eh_editor();

-- Revoke the three retired accounts' sessions before removing their authentication records.
delete from auth.refresh_tokens where user_id in (
  'df3a1a68-e457-437b-8587-5de1d2a9b8dd',
  'e3078824-42e4-4d86-9067-f3aeb74cc3cf',
  'c5d1db2c-4929-446b-a6a2-cf1a7b12fa44'
);
delete from auth.sessions where user_id in (
  'df3a1a68-e457-437b-8587-5de1d2a9b8dd'::uuid,
  'e3078824-42e4-4d86-9067-f3aeb74cc3cf'::uuid,
  'c5d1db2c-4929-446b-a6a2-cf1a7b12fa44'::uuid
);
delete from auth.users where id in (
  'df3a1a68-e457-437b-8587-5de1d2a9b8dd'::uuid,
  'e3078824-42e4-4d86-9067-f3aeb74cc3cf'::uuid,
  'c5d1db2c-4929-446b-a6a2-cf1a7b12fa44'::uuid
);
