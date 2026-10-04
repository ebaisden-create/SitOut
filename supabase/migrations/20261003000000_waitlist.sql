-- SitOut waitlist: final schema (already applied to the "sitout" Supabase project).
-- Visitors never touch these tables directly. Only the `waitlist` edge function
-- (service_role) can call the functions below.

create extension if not exists citext with schema extensions;

create table public.waitlist (
  id bigint generated always as identity primary key,
  email extensions.citext not null unique
    check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  founding boolean not null default false,   -- true for the first 500
  spot int unique,                           -- 1..500 for founding members
  monthly_loss int check (monthly_loss between 0 and 1000000),
  source text check (length(source) <= 64),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (length(ip_hash) <= 128),  -- salted SHA-256, never the raw IP
  created_at timestamptz not null default now()
);
create index signup_attempts_ip_time on public.signup_attempts (ip_hash, created_at);
create index signup_attempts_time on public.signup_attempts (created_at);
alter table public.signup_attempts enable row level security;
revoke all on public.signup_attempts from anon, authenticated;

create or replace function public.waitlist_spots_left()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 500 - count(*))::int from public.waitlist where founding;
$$;

-- Rate limits: 5 attempts per visitor per 10 min, 20 per day, 60 per minute site-wide.
-- Old attempts are pruned on every call, so this table stays small.
create or replace function public.check_signup_rate(p_ip_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ip_10m int; v_ip_day int; v_global_min int;
begin
  delete from public.signup_attempts where created_at < now() - interval '1 day';
  select count(*) into v_global_min from public.signup_attempts where created_at > now() - interval '1 minute';
  if v_global_min >= 60 then return 'global_limited'; end if;
  select count(*) filter (where created_at > now() - interval '10 minutes'), count(*)
    into v_ip_10m, v_ip_day from public.signup_attempts where ip_hash = p_ip_hash;
  if v_ip_10m >= 5 or v_ip_day >= 20 then return 'ip_limited'; end if;
  insert into public.signup_attempts (ip_hash) values (p_ip_hash);
  return 'ok';
end $$;

-- Join: assigns founding spots 1..500 in order (serialized, so never more than 500),
-- never reveals whether an email is already on the list, and stops at 50,000 rows.
create or replace function public.join_waitlist(p_email text, p_monthly_loss int default null, p_source text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_taken int;
  v_row public.waitlist;
begin
  if v_email is null or length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(7234511);
  if exists (select 1 from public.waitlist where email = v_email::citext) then
    return json_build_object('status', 'exists', 'spots_left', public.waitlist_spots_left());
  end if;
  if (select count(*) from public.waitlist) >= 50000 then
    return json_build_object('status', 'full', 'spots_left', 0);
  end if;
  select count(*) into v_taken from public.waitlist where founding;
  insert into public.waitlist (email, founding, spot, monthly_loss, source)
  values (v_email, v_taken < 500, case when v_taken < 500 then v_taken + 1 end,
          case when p_monthly_loss between 0 and 1000000 then p_monthly_loss end, left(p_source, 64))
  returning * into v_row;
  return json_build_object('status', 'joined', 'founding', v_row.founding, 'spot', v_row.spot,
                           'spots_left', public.waitlist_spots_left());
end $$;

revoke all on function public.waitlist_spots_left() from public, anon, authenticated;
revoke all on function public.check_signup_rate(text) from public, anon, authenticated;
revoke all on function public.join_waitlist(text, int, text) from public, anon, authenticated;
grant execute on function public.waitlist_spots_left() to service_role;
grant execute on function public.check_signup_rate(text) to service_role;
grant execute on function public.join_waitlist(text, int, text) to service_role;
