/* =====================================================================
   SPIELE · gemeinsame Regeln für Spieleportal und Verwaltung
   (dieselben Grenzen prüft die Datenbank, siehe sql/spiele.sql)
   ===================================================================== */
export const KATEGORIEN = ['Action', 'Abenteuer', 'Geschicklichkeit', 'Rätsel', 'Rennen', 'Sport', 'Strategie', 'Mehrspieler', 'Sonstiges'];

export const FORMATE = [
  { id: '16:9', label: 'Querformat 16:9', ratio: 16 / 9 },
  { id: '4:3', label: 'Querformat 4:3', ratio: 4 / 3 },
  { id: '9:16', label: 'Hochformat 9:16', ratio: 9 / 16 },
];
export function formatRatio(id) { const f = FORMATE.find((x) => x.id === id); return f ? f.ratio : 16 / 9; }

export const SPIELE_MIN_LEVEL = 4;

/* Nur https-Adressen: Das Portal läuft über https, http-Inhalte blockiert der Browser. */
export function checkUrl(input, { optional } = {}) {
  const raw = String(input || '').trim();
  if (!raw) return optional ? { ok: true, url: null } : { ok: false, reason: 'Bitte eine Adresse eingeben.' };
  if (/\s/.test(raw)) return { ok: false, reason: 'Die Adresse darf keine Leerzeichen enthalten.' };
  let u;
  try { u = new URL(raw); } catch (e) { return { ok: false, reason: 'Das ist keine vollständige Adresse (https://…).' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'Die Adresse muss mit https:// beginnen.' };
  if (u.href.length > 600) return { ok: false, reason: 'Die Adresse ist zu lang (höchstens 600 Zeichen).' };
  return { ok: true, url: u.href };
}

export function hostOf(url) { try { return new URL(url).host; } catch (e) { return ''; } }
