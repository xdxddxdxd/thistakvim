create function private.finalize_own() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  perform private.finalize_days(auth.uid());
end $$;
revoke all on function private.finalize_own() from public,anon;
grant execute on function private.finalize_own() to authenticated;
create or replace function public.finalize_my_days() returns void language sql security invoker set search_path='' as $$ select private.finalize_own(); $$;
-- Default Supabase event-trigger function never belongs in the public API.
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
