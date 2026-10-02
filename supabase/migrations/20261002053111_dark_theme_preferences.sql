-- Preserve existing light preferences while allowing the dark theme.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_theme_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check
  CHECK (theme IN ('paper', 'monochrome', 'dark'));

-- Save theme and category colors together; identities/names stay read-only.
create or replace function public.save_planner_preferences(p_theme text, p_colors jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); c jsonb;
begin
  if u is null then raise exception 'Oturum gerekli'; end if;
  if p_theme is null or p_theme not in ('paper','monochrome','dark')
     or p_colors is null or jsonb_typeof(p_colors)<>'array'
     or jsonb_array_length(p_colors)>100 then raise exception 'Geçersiz ayarlar'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  for c in select value from jsonb_array_elements(p_colors) loop
    if c->>'accent_color' is null or c->>'accent_color' !~ '^#[0-9A-Fa-f]{6}$'
       or not exists(select 1 from public.categories where id=(c->>'id')::uuid and user_id=u)
       then raise exception 'Geçersiz ders rengi'; end if;
    update public.categories set accent_color=c->>'accent_color' where id=(c->>'id')::uuid and user_id=u;
  end loop;
  update public.profiles set theme=p_theme where id=u;
  if not found then raise exception 'Profil bulunamadı'; end if;
  return jsonb_build_object('theme',p_theme,'categories',
    (select jsonb_agg(to_jsonb(cat) order by cat.position) from public.categories cat where user_id=u));
end $$;
revoke all on function public.save_planner_preferences(text,jsonb) from public,anon;
grant execute on function public.save_planner_preferences(text,jsonb) to authenticated;
