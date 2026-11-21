-- Preserve existing aliases, themes and categories. New users sign in by email.
alter table public.profiles
  add column display_name text check (char_length(display_name) between 1 and 64);

create function private.provision_planner_account(p_user uuid, p_metadata jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  display text := case when jsonb_typeof(p_metadata->'display_name') = 'string' then
    nullif(left(btrim(regexp_replace(p_metadata->>'display_name', '[[:space:]]+', ' ', 'g')), 64), '')
  end;
begin
  insert into public.profiles(id, username, display_name)
  values (p_user, 'ogrenci-' || p_user::text, coalesce(display, 'Öğrenci'))
  on conflict (id) do nothing;
  if not found then return; end if;

  insert into public.categories(user_id, name, accent_color, position)
  values
    (p_user, 'Matematik', '#eb0000', 0),
    (p_user, 'Türkçe', '#ffd52a', 1),
    (p_user, 'Fizik', '#36aafa', 2),
    (p_user, 'Kimya', '#d42df0', 3),
    (p_user, 'Biyoloji', '#7dfb2d', 4),
    (p_user, 'Geometri', '#4545ee', 5),
    (p_user, 'Genel', '#ffffff', 6);
end;
$$;
revoke all on function private.provision_planner_account(uuid, jsonb) from public, anon, authenticated;

create function private.provision_verified_planner_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.provision_planner_account(new.id, new.raw_user_meta_data);
  return new;
end;
$$;
revoke all on function private.provision_verified_planner_account() from public, anon, authenticated;
create trigger provision_verified_planner_account
after insert or update of email_confirmed_at on auth.users
for each row
when (new.email is not null and new.email_confirmed_at is not null and not new.is_anonymous)
execute function private.provision_verified_planner_account();

select private.provision_planner_account(u.id, u.raw_user_meta_data)
from auth.users u
where u.email is not null and u.email_confirmed_at is not null and not u.is_anonymous
  and not exists (select 1 from public.profiles p where p.id = u.id);
