-- Invisible human check: each solved proof-of-work puzzle can be used once, then expires.
-- Already applied to the "sitout" Supabase project.
create table public.pow_used (
  sig text primary key check (length(sig) <= 128),
  expires_at timestamptz not null
);
create index pow_used_expires on public.pow_used (expires_at);
alter table public.pow_used enable row level security;
revoke all on public.pow_used from anon, authenticated;

create or replace function public.claim_pow(p_sig text, p_expires timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.pow_used where expires_at < now();
  if p_expires < now() or p_expires > now() + interval '30 minutes' then return false; end if;
  insert into public.pow_used (sig, expires_at) values (p_sig, p_expires) on conflict (sig) do nothing;
  return found;
end $$;
revoke all on function public.claim_pow(text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_pow(text, timestamptz) to service_role;
