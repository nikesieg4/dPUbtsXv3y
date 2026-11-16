/* Öffentlicher Lesezugriff auf die Tabelle „spiele“ – ohne Anmeldung.
   Die Datenbank gibt an nicht angemeldete Besucher nur freigeschaltete Spiele heraus (RLS). */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { checkUrl } from '../lib/spiele.js';

const FIELDS = 'id,titel,beschreibung,url,bild_url,kategorie,format,erstellt_am';

export async function loadGames() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/spiele?select=${FIELDS}&aktiv=eq.true&order=sortierung.asc,erstellt_am.desc`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
  });
  if (r.status === 404) return [];          // Tabelle noch nicht eingerichtet → leeres Portal
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const rows = await r.json();
  /* Nur Einträge mit gültiger https-Adresse anzeigen (zweite Prüfung neben der Datenbank) */
  return (Array.isArray(rows) ? rows : []).filter((g) => g && g.id && checkUrl(g.url).ok).map((g) => ({
    ...g,
    titel: String(g.titel || '').trim() || 'Spiel',
    beschreibung: String(g.beschreibung || ''),
    kategorie: String(g.kategorie || 'Sonstiges').trim() || 'Sonstiges',
    bild_url: checkUrl(g.bild_url).ok ? g.bild_url : null,
  }));
}
