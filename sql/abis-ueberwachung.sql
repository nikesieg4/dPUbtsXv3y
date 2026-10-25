-- ============================================================
--  ABIS-SICHERHEITSKONSOLE · Überwachung (optional, empfohlen)
--
--  Einmal im Supabase-SQL-Editor ausführen (Run). Mehrfaches
--  Ausführen ist unschädlich.
--
--  Legt an:
--    abis_kv_changes      wer hat wann welchen Portal-Datensatz (kv) geändert
--    abis_auth_events     Anmeldungen, Sperren, Passwort-/E-Mail-Änderungen
--    abis_admin_actions   Aktionen in der Konsole (über abis_log_action)
--    abis_db_overview()   Tabellen, Größe, RLS-Status, Verbindungen
--    abis_prune_logs()    alte Einträge löschen (nur Administrator)
--
--  Sicherheit:
--    * Lesen nur Administrator und Level 5/6 (RLS).
--    * Schreiben nur durch Trigger bzw. security-definer-Funktionen,
--      niemand kann Einträge ändern oder löschen (außer abis_prune_logs).
--    * Ein Fehler beim Protokollieren bricht NIE die eigentliche
--      Änderung ab – das Bürgerportal läuft unverändert weiter.
-- ============================================================

-- ---------- Wer darf die Protokolle lesen? ----------
create or replace function public.abis_can_read() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select p.is_admin or p.level >= 5 from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public.abis_can_read() from public, anon;
grant execute on function public.abis_can_read() to authenticated;

-- ---------- 1) Änderungen an kv ----------
create table if not exists public.abis_kv_changes (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  key           text not null,
  op            text not null check (op in ('INSERT','UPDATE','DELETE')),
  actor_id      uuid,
  actor_citizen text,
  actor_name    text,
  old_size      int,
  new_size      int,
  old_hash      text,
  new_hash      text
);
create index if not exists abis_kv_changes_ts  on public.abis_kv_changes (ts desc);
create index if not exists abis_kv_changes_key on public.abis_kv_changes (key, ts desc);

create or replace function public.abis_log_kv_change() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_uid uuid; v_cit text; v_name text;
begin
  begin
    if tg_op = 'UPDATE' and old.value is not distinct from new.value then return null; end if;
    v_uid := auth.uid();
    select p.citizen_id, p.name into v_cit, v_name from public.profiles p where p.id = v_uid;
    insert into public.abis_kv_changes (key, op, actor_id, actor_citizen, actor_name, old_size, new_size, old_hash, new_hash)
    values (case when tg_op = 'DELETE' then old.key else new.key end, tg_op, v_uid, v_cit, v_name,
            case when tg_op <> 'INSERT' then octet_length(coalesce(old.value::text, '')) end,
            case when tg_op <> 'DELETE' then octet_length(coalesce(new.value::text, '')) end,
            case when tg_op <> 'INSERT' then md5(coalesce(old.value::text, '')) end,
            case when tg_op <> 'DELETE' then md5(coalesce(new.value::text, '')) end);
  exception when others then
    raise log 'abis_log_kv_change: % (%)', sqlerrm, sqlstate;   -- Protokoll darf die Änderung nie verhindern
  end;
  return null;
end $$;
revoke all on function public.abis_log_kv_change() from public, anon, authenticated;

drop trigger if exists abis_kv_audit on public.kv;
create trigger abis_kv_audit after insert or update or delete on public.kv
  for each row execute function public.abis_log_kv_change();

-- ---------- 2) Ereignisse der Anmeldung (auth.users) ----------
create table if not exists public.abis_auth_events (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  user_id    uuid,
  email      text,
  citizen_id text,
  name       text,
  event      text not null,
  detail     jsonb not null default '{}'::jsonb
);
create index if not exists abis_auth_events_ts on public.abis_auth_events (ts desc);
create index if not exists abis_auth_events_user on public.abis_auth_events (user_id, ts desc);

create or replace function public.abis_log_auth_event() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_cit text; v_name text; v_id uuid;
begin
  begin
    v_id := case when tg_op = 'DELETE' then old.id else new.id end;
    select p.citizen_id, p.name into v_cit, v_name from public.profiles p where p.id = v_id;
    if tg_op = 'INSERT' then
      insert into public.abis_auth_events (user_id, email, citizen_id, name, event) values (new.id, new.email, v_cit, v_name, 'user_created');
    elsif tg_op = 'DELETE' then
      insert into public.abis_auth_events (user_id, email, citizen_id, name, event) values (old.id, old.email, v_cit, v_name, 'user_deleted');
    else
      if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
        insert into public.abis_auth_events (user_id, email, citizen_id, name, event) values (new.id, new.email, v_cit, v_name, 'sign_in');
      end if;
      if new.banned_until is distinct from old.banned_until then
        insert into public.abis_auth_events (user_id, email, citizen_id, name, event, detail)
        values (new.id, new.email, v_cit, v_name, case when new.banned_until is not null and new.banned_until > now() then 'banned' else 'unbanned' end,
                jsonb_build_object('banned_until', new.banned_until));
      end if;
      if new.encrypted_password is distinct from old.encrypted_password then
        insert into public.abis_auth_events (user_id, email, citizen_id, name, event) values (new.id, new.email, v_cit, v_name, 'password_changed');
      end if;
      if new.email is distinct from old.email then
        insert into public.abis_auth_events (user_id, email, citizen_id, name, event, detail)
        values (new.id, new.email, v_cit, v_name, 'email_changed', jsonb_build_object('old', old.email));
      end if;
    end if;
  exception when others then
    raise log 'abis_log_auth_event: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
revoke all on function public.abis_log_auth_event() from public, anon, authenticated;

drop trigger if exists abis_auth_audit on auth.users;
create trigger abis_auth_audit after insert or update or delete on auth.users
  for each row execute function public.abis_log_auth_event();

-- ---------- 3) Aktionen in der Konsole ----------
create table if not exists public.abis_admin_actions (
  id            bigint generated always as identity primary key,
  ts            timestamptz not null default now(),
  actor_id      uuid not null,
  actor_citizen text,
  actor_name    text,
  action        text not null check (char_length(action) between 2 and 200),
  target        text check (target is null or char_length(target) <= 200),
  detail        jsonb not null default '{}'::jsonb
);
create index if not exists abis_admin_actions_ts on public.abis_admin_actions (ts desc);

create or replace function public.abis_log_action(p_action text, p_target text default null, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_cit text; v_name text; v_ok boolean;
begin
  select p.citizen_id, p.name, (p.is_admin or p.level >= 5 or 'Administration für Buchhaltung und Informationssicherheit' = any(p.ministries))
    into v_cit, v_name, v_ok from public.profiles p where p.id = auth.uid();
  if not coalesce(v_ok, false) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.abis_admin_actions (actor_id, actor_citizen, actor_name, action, target, detail)
  values (auth.uid(), v_cit, v_name, left(btrim(coalesce(p_action, '')), 200), left(p_target, 200),
          case when octet_length(coalesce(p_detail, '{}'::jsonb)::text) > 4000 then '{"gekuerzt":true}'::jsonb else coalesce(p_detail, '{}'::jsonb) end);
end $$;
revoke all on function public.abis_log_action(text, text, jsonb) from public, anon;
grant execute on function public.abis_log_action(text, text, jsonb) to authenticated;

-- ---------- Rechte und RLS für die drei Protokolle ----------
alter table public.abis_kv_changes    enable row level security;
alter table public.abis_auth_events   enable row level security;
alter table public.abis_admin_actions enable row level security;
revoke all on public.abis_kv_changes, public.abis_auth_events, public.abis_admin_actions from public, anon, authenticated;
grant select on public.abis_kv_changes, public.abis_auth_events, public.abis_admin_actions to authenticated;

drop policy if exists "abis kv lesen" on public.abis_kv_changes;
create policy "abis kv lesen" on public.abis_kv_changes for select to authenticated using (public.abis_can_read());
drop policy if exists "abis auth lesen" on public.abis_auth_events;
create policy "abis auth lesen" on public.abis_auth_events for select to authenticated using (public.abis_can_read());
drop policy if exists "abis aktionen lesen" on public.abis_admin_actions;
create policy "abis aktionen lesen" on public.abis_admin_actions for select to authenticated using (public.abis_can_read());

-- ---------- 4) Datenbankübersicht ----------
create or replace function public.abis_db_overview() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_tables jsonb; v_conn int; v_size bigint;
begin
  if not public.abis_can_read() then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', c.relname,
           'rows', greatest(c.reltuples, 0)::bigint,
           'size', pg_total_relation_size(c.oid),
           'rls', c.relrowsecurity,
           'policies', (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
           'realtime', exists (select 1 from pg_publication_tables t where t.pubname = 'supabase_realtime' and t.schemaname = 'public' and t.tablename = c.relname)
         ) order by c.relname), '[]'::jsonb)
    into v_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p');
  begin select count(*) into v_conn from pg_stat_activity where datname = current_database(); exception when others then v_conn := null; end;
  begin v_size := pg_database_size(current_database()); exception when others then v_size := null; end;
  return jsonb_build_object('tables', v_tables, 'connections', v_conn, 'db_size', v_size, 'pg_version', split_part(version(), ' on ', 1), 'checked_at', now());
end $$;
revoke all on function public.abis_db_overview() from public, anon;
grant execute on function public.abis_db_overview() to authenticated;

-- ---------- 5) Aufräumen (nur Administrator) ----------
create or replace function public.abis_prune_logs(p_days int default 180) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_cut timestamptz; a int; b int; c int;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then raise exception 'not allowed' using errcode = '42501'; end if;
  v_cut := now() - make_interval(days => greatest(coalesce(p_days, 180), 30));
  delete from public.abis_kv_changes where ts < v_cut;    get diagnostics a = row_count;
  delete from public.abis_auth_events where ts < v_cut;   get diagnostics b = row_count;
  delete from public.abis_admin_actions where ts < v_cut; get diagnostics c = row_count;
  insert into public.abis_admin_actions (actor_id, action, detail) values (auth.uid(), 'Protokolle bereinigt', jsonb_build_object('tage', p_days, 'kv', a, 'auth', b, 'aktionen', c));
  return jsonb_build_object('ok', true, 'kv', a, 'auth', b, 'aktionen', c);
end $$;
revoke all on function public.abis_prune_logs(int) from public, anon;
grant execute on function public.abis_prune_logs(int) to authenticated;

-- ---------- 6) Live-Anzeige (Realtime) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['abis_kv_changes', 'abis_auth_events', 'abis_admin_actions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Kontrolle
select 'abis_kv_changes' as tabelle, count(*) from public.abis_kv_changes
union all select 'abis_auth_events', count(*) from public.abis_auth_events
union all select 'abis_admin_actions', count(*) from public.abis_admin_actions;
