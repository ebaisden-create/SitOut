-- Founding offer changed from 500 to 250 free-for-life spots (Oct 4, 2026).
-- Already applied to the "sitout" Supabase project.
create or replace function public.waitlist_spots_left()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 250 - count(*))::int from public.waitlist where founding;
$$;

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
  values (v_email, v_taken < 250, case when v_taken < 250 then v_taken + 1 end,
          case when p_monthly_loss between 0 and 1000000 then p_monthly_loss end, left(p_source, 64))
  returning * into v_row;
  return json_build_object('status', 'joined', 'founding', v_row.founding, 'spot', v_row.spot,
                           'spots_left', public.waitlist_spots_left());
end $$;
revoke all on function public.waitlist_spots_left() from public, anon, authenticated;
revoke all on function public.join_waitlist(text, int, text) from public, anon, authenticated;
grant execute on function public.waitlist_spots_left() to service_role;
grant execute on function public.join_waitlist(text, int, text) to service_role;
