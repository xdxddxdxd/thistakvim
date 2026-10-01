-- Re-check real time after waiting on a user lock; transaction start time is insufficient.
create or replace function private.editable(p_user uuid,p_date date) returns boolean
language sql volatile security invoker set search_path='' as $$
  select p_date >= (clock_timestamp() at time zone 'Europe/Istanbul')::date
    and clock_timestamp() < (p_date + time '23:59') at time zone 'Europe/Istanbul'
    and (p_date=(clock_timestamp() at time zone 'Europe/Istanbul')::date
      or not exists(select 1 from public.day_status where user_id=p_user and date=p_date and is_finished))
$$;
