-- ============================================================
--  SPIELEPORTAL MAISKOLBISTAN · Tabelle „spiele“
--
--  Einmal im Supabase-SQL-Editor ausführen (Run). Mehrfaches
--  Ausführen ist unschädlich.
--
--  Legt an:
--    spiele                 Titel, Beschreibung, Adresse (URL), Bild, Kategorie
--    spiele_can_manage()    wer darf Spiele verwalten?
--
--  Sicherheit (RLS):
--    * Lesen: JEDER – auch ohne Anmeldung – aber nur freigeschaltete
--      Spiele (aktiv = true). Das Spieleportal braucht kein Konto.
--    * Anlegen, Ändern, Löschen: nur Administrator und Level 4+.
--    * Adressen müssen mit https:// beginnen (die Seite selbst läuft
--      über https; http-Inhalte würde der Browser ohnehin blockieren).
-- ============================================================

create or replace function public.spiele_can_manage() returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select p.is_admin or p.level >= 4 from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public.spiele_can_manage() from public, anon;
grant execute on function public.spiele_can_manage() to authenticated;

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

drop policy if exists "spiele oeffentlich lesen" on public.spiele;
create policy "spiele oeffentlich lesen" on public.spiele for select to anon, authenticated using (aktiv);
drop policy if exists "spiele verwaltung lesen" on public.spiele;
create policy "spiele verwaltung lesen" on public.spiele for select to authenticated using (public.spiele_can_manage());
drop policy if exists "spiele anlegen" on public.spiele;
create policy "spiele anlegen" on public.spiele for insert to authenticated with check (public.spiele_can_manage());
drop policy if exists "spiele aendern" on public.spiele;
create policy "spiele aendern" on public.spiele for update to authenticated using (public.spiele_can_manage()) with check (public.spiele_can_manage());
drop policy if exists "spiele loeschen" on public.spiele;
create policy "spiele loeschen" on public.spiele for delete to authenticated using (public.spiele_can_manage());

-- Die Schnittstelle soll die neue Tabelle sofort kennen
notify pgrst, 'reload schema';

select 'spiele' as tabelle, count(*) as eintraege from public.spiele;
