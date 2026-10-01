-- Current-day edits remain open until 23:59, including legacy early-finished days.
create or replace function private.editable(p_user uuid,p_date date) returns boolean
language sql stable security invoker set search_path='' as $$
  select p_date >= (now() at time zone 'Europe/Istanbul')::date
    and now() < (p_date + time '23:59') at time zone 'Europe/Istanbul'
    and (p_date=(now() at time zone 'Europe/Istanbul')::date
      or not exists(select 1 from public.day_status where user_id=p_user and date=p_date and is_finished))
$$;

create or replace function private.save_study_time(p_date date,p_minutes integer,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); existing public.day_study_time; result public.day_study_time;
begin
  if u is null then raise exception 'Oturum gerekli'; end if;
  if p_date is null or p_minutes is null or p_minutes not between 0 and 1440 or p_revision is null or p_revision<0 then raise exception 'Geçersiz süre'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select * into existing from public.day_study_time where user_id=u and date=p_date for update;
  if p_date<>(clock_timestamp() at time zone 'Europe/Istanbul')::date
    or clock_timestamp()>=(p_date+time '23:59') at time zone 'Europe/Istanbul' then
    return jsonb_build_object('locked',true,'current',jsonb_build_object('minutes',existing.minutes,'revision',coalesce(existing.revision,0)));
  end if;
  if coalesce(existing.revision,0)<>p_revision then
    return jsonb_build_object('conflict',true,'current',jsonb_build_object('minutes',existing.minutes,'revision',coalesce(existing.revision,0)));
  end if;
  if existing.user_id is null then
    insert into public.day_study_time(user_id,date,minutes) values(u,p_date,p_minutes) returning * into result;
  else
    update public.day_study_time set minutes=p_minutes,revision=revision+1 where user_id=u and date=p_date returning * into result;
  end if;
  return jsonb_build_object('date',result.date,'minutes',result.minutes,'revision',result.revision);
end $$;
revoke all on function private.save_study_time(date,integer,integer) from public,anon;
grant execute on function private.save_study_time(date,integer,integer) to authenticated;
