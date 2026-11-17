-- ============================================================
--  MAISKOLBISTAN SPIELE · Datenbank (Supabase der Republik)
--
--  Einmal im Supabase-SQL-Editor ausführen (Run). Mehrfaches
--  Ausführen ist unschädlich.
--
--  Legt an:
--    spiele             die Spiele des Portals (Titel, Adresse, Beschreibung …)
--    spielvorschlaege   Spielideen, die Besucher über „Spiel vorschlagen“ senden
--
--  Sicherheit (RLS):
--    * Spiele lesen: jeder, auch ohne Anmeldung – aber nur sichtbare Spiele.
--    * Spielideen senden: jeder, auch ohne Anmeldung – nur Idee + Nachricht,
--      mit Bremse gegen Massen-Einsendungen. Lesen kann sie niemand außer
--      dem Administrator.
--    * Anlegen, Ändern, Löschen: NUR der Administrator (profiles.is_admin).
-- ============================================================

-- ---------- Wer ist Administrator? ----------
create or replace function public.spiele_ist_admin() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public.spiele_ist_admin() from public, anon;
grant execute on function public.spiele_ist_admin() to authenticated;

-- ---------- 1) Spiele ----------
create table if not exists public.spiele (
  id            uuid primary key default gen_random_uuid(),
  titel         text not null check (char_length(btrim(titel)) between 1 and 80),
  beschreibung  text not null default '' check (char_length(beschreibung) <= 2000),
  url           text not null check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 600),
  bild_url      text check (bild_url is null or (bild_url ~* '^https://[^[:space:]]+$' and char_length(bild_url) <= 600)),
  kategorie     text not null default 'Sonstiges' check (char_length(btrim(kategorie)) between 1 and 40),
  format        text not null default '16:9' check (format in ('16:9', '4:3', '9:16')),
  aktiv         boolean not null default true,
  sortierung    integer not null default 0,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  erstellt_von  uuid default auth.uid()
);
-- Kachelgröße im Mosaik: normal (1×1), gross (2×2), breit (2×1)
alter table public.spiele add column if not exists groesse text not null default 'normal';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spiele_groesse_check') then
    alter table public.spiele add constraint spiele_groesse_check check (groesse in ('normal', 'gross', 'breit'));
  end if;
end $$;
create index if not exists spiele_reihenfolge on public.spiele (sortierung, erstellt_am desc);

create or replace function public.spiele_touch() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin new.geaendert_am := now(); return new; end $$;
drop trigger if exists spiele_touch on public.spiele;
create trigger spiele_touch before update on public.spiele
  for each row execute function public.spiele_touch();

alter table public.spiele enable row level security;
revoke all on public.spiele from public, anon, authenticated;
grant select on public.spiele to anon, authenticated;
grant insert, update, delete on public.spiele to authenticated;

-- ältere Regeln (falls eine frühere Fassung eingespielt wurde) entfernen
drop policy if exists "spiele verwaltung lesen" on public.spiele;
drop policy if exists "spiele anlegen" on public.spiele;
drop policy if exists "spiele aendern" on public.spiele;
drop policy if exists "spiele loeschen" on public.spiele;
drop function if exists public.spiele_can_manage();

drop policy if exists "spiele oeffentlich lesen" on public.spiele;
create policy "spiele oeffentlich lesen" on public.spiele for select to anon, authenticated using (aktiv);
drop policy if exists "spiele admin lesen" on public.spiele;
create policy "spiele admin lesen" on public.spiele for select to authenticated using (public.spiele_ist_admin());
drop policy if exists "spiele admin anlegen" on public.spiele;
create policy "spiele admin anlegen" on public.spiele for insert to authenticated with check (public.spiele_ist_admin());
drop policy if exists "spiele admin aendern" on public.spiele;
create policy "spiele admin aendern" on public.spiele for update to authenticated using (public.spiele_ist_admin()) with check (public.spiele_ist_admin());
drop policy if exists "spiele admin loeschen" on public.spiele;
create policy "spiele admin loeschen" on public.spiele for delete to authenticated using (public.spiele_ist_admin());

-- ---------- 2) Spielvorschläge ----------
create table if not exists public.spielvorschlaege (
  id           uuid primary key default gen_random_uuid(),
  idee         text not null check (char_length(btrim(idee)) between 2 and 120),
  nachricht    text not null default '' check (char_length(nachricht) <= 2000),
  status       text not null default 'neu' check (status in ('neu', 'gelesen', 'umgesetzt', 'abgelehnt')),
  notiz        text not null default '' check (char_length(notiz) <= 1000),
  erstellt_am  timestamptz not null default now()
);
create index if not exists spielvorschlaege_zeit on public.spielvorschlaege (erstellt_am desc);

-- Bremse: höchstens 30 Einsendungen in 10 Minuten und 500 unbearbeitete insgesamt.
-- Besucher können Status, Notiz und Zeitpunkt nicht selbst setzen.
create or replace function public.spielvorschlaege_bremse() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if (select count(*) from public.spielvorschlaege where erstellt_am > now() - interval '10 minutes') >= 30
     or (select count(*) from public.spielvorschlaege where status = 'neu') >= 500 then
    raise exception 'Gerade kommen zu viele Vorschläge an. Bitte später erneut versuchen.' using errcode = 'P0001';
  end if;
  new.idee := btrim(new.idee);
  new.status := 'neu'; new.notiz := ''; new.erstellt_am := now();
  return new;
end $$;
revoke all on function public.spielvorschlaege_bremse() from public, anon, authenticated;
drop trigger if exists spielvorschlaege_bremse on public.spielvorschlaege;
create trigger spielvorschlaege_bremse before insert on public.spielvorschlaege
  for each row execute function public.spielvorschlaege_bremse();

alter table public.spielvorschlaege enable row level security;
revoke all on public.spielvorschlaege from public, anon, authenticated;
grant insert (idee, nachricht) on public.spielvorschlaege to anon, authenticated;
grant select, delete on public.spielvorschlaege to authenticated;
grant update (status, notiz) on public.spielvorschlaege to authenticated;

drop policy if exists "vorschlag senden" on public.spielvorschlaege;
create policy "vorschlag senden" on public.spielvorschlaege for insert to anon, authenticated with check (true);
drop policy if exists "vorschlag admin lesen" on public.spielvorschlaege;
create policy "vorschlag admin lesen" on public.spielvorschlaege for select to authenticated using (public.spiele_ist_admin());
drop policy if exists "vorschlag admin aendern" on public.spielvorschlaege;
create policy "vorschlag admin aendern" on public.spielvorschlaege for update to authenticated using (public.spiele_ist_admin()) with check (public.spiele_ist_admin());
drop policy if exists "vorschlag admin loeschen" on public.spielvorschlaege;
create policy "vorschlag admin loeschen" on public.spielvorschlaege for delete to authenticated using (public.spiele_ist_admin());

-- Die Schnittstelle soll die neuen Tabellen sofort kennen
notify pgrst, 'reload schema';

select 'spiele' as tabelle, count(*) as eintraege from public.spiele
union all
select 'spielvorschlaege', count(*) from public.spielvorschlaege;
