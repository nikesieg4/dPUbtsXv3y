/* =====================================================================
   DATENBANK-ZUGRIFF
   Alles läuft über den angemeldeten Supabase-Nutzer. Was erlaubt ist,
   entscheidet die Datenbank (RLS, security-definer-Funktionen) – die
   Konsole blendet nur aus, was ohnehin abgelehnt würde.
   ===================================================================== */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_ALIASES } from '../config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'abis-konsole-auth' },
});

function normEmail(input) {
  let mail = String(input || '').trim().toLowerCase();
  if (LOGIN_ALIASES[mail]) mail = LOGIN_ALIASES[mail];
  return mail;
}

/* ---------- Anmeldung ---------- */
export const Auth = {
  async session() {
    try { const { data } = await sb.auth.getSession(); return data ? data.session : null; } catch (e) { return null; }
  },
  async profile() {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      return data ? { ...data, email: user.email, uid: user.id, lastSignIn: user.last_sign_in_at } : null;
    } catch (e) { console.error('[Profil]', e); return null; }
  },
  async signIn(ident, password) {
    const mail = normEmail(ident);
    if (mail.indexOf('@') === -1) return { ok: false, reason: 'Bitte die vollständige E-Mail-Adresse eingeben (oder „Administrator“).' };
    const res = await sb.auth.signInWithPassword({ email: mail, password });
    if (!res.error) return { ok: true };
    const msg = String(res.error.message || '').toLowerCase();
    if (msg.includes('not confirmed')) return { ok: false, reason: 'Das Konto ist noch nicht bestätigt.' };
    if (msg.includes('banned')) return { ok: false, reason: 'Dieses Konto ist gesperrt.' };
    if (msg.includes('rate') || res.error.status === 429) return { ok: false, reason: 'Zu viele Versuche. Bitte später erneut versuchen.' };
    return { ok: false, reason: 'E-Mail-Adresse oder Passwort ist falsch.' };
  },
  async signOut() { try { await sb.auth.signOut(); } catch (e) { /* egal */ } },
  async changePassword(current, next) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return { ok: false, reason: 'Nicht angemeldet.' };
      const check = await sb.auth.signInWithPassword({ email: user.email, password: current });
      if (check.error) return { ok: false, reason: 'Aktuelles Passwort ist falsch.' };
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) return { ok: false, reason: error.message || 'Änderung fehlgeschlagen.' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'Änderung fehlgeschlagen.' }; }
  },
};

/* ---------- Server-Funktion admin-actions (Konto anlegen, Passwort, Level, Sperre) ---------- */
export async function adminAction(action, payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { ok: false, reason: 'Nicht angemeldet.' };
    const r = await fetch(SUPABASE_URL + '/functions/v1/admin-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ action, ...payload }),
    });
    if (r.status === 404) return { ok: false, reason: 'Die Server-Funktion „admin-actions“ ist nicht veröffentlicht.' };
    const j = await r.json().catch(() => null);
    if (!j) return { ok: false, reason: 'Ungültige Antwort vom Server (' + r.status + ').' };
    return j;
  } catch (e) { return { ok: false, reason: 'Server nicht erreichbar.' }; }
}

/* ---------- Geteilter Speicher des Portals (Tabelle kv) ---------- */
export const Store = {
  async all() {
    const { data, error } = await sb.from('kv').select('key, value, updated_at');
    if (error) throw error;
    return data || [];
  },
  async getRaw(key) {
    try {
      const { data, error } = await sb.from('kv').select('value').eq('key', key).maybeSingle();
      if (error) throw error;
      return { ok: true, value: data ? data.value : null };
    } catch (e) { console.error('[kv lesen]', key, e); return { ok: false, value: null }; }
  },
  async set(key, value) {
    const { error } = await sb.from('kv').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  },
  /* Lesen – ändern – schreiben auf dem AKTUELLEN Stand der Datenbank,
     damit Änderungen anderer (z. B. aus dem Portal) nicht überschrieben werden. */
  async mutate(key, fn, fallback) {
    const cur = await Store.getRaw(key);
    if (!cur.ok) throw new Error('Der aktuelle Stand konnte nicht gelesen werden. Es wurde nichts gespeichert.');
    const base = cur.value === null || cur.value === undefined ? fallback : cur.value;
    const next = fn(base);
    if (next === undefined) return base;
    await Store.set(key, next);
    return next;
  },
};

/* ---------- Bank-Funktionen (RPC) ---------- */
export const Bank = {
  async call(name, args) {
    try {
      const res = await sb.rpc(name, args || {});
      if (res.error) {
        console.warn('[Bank]', name, res.error.code, res.error.message);
        if (res.error.code === '42501') return { ok: false, code: 'forbidden', message: 'Dafür fehlt die Berechtigung (Bank-Administrator = Level 6).' };
        if (res.error.code === 'PGRST202' || res.error.code === '42883') return { ok: false, code: 'missing', message: 'Funktion „' + name + '“ ist in der Datenbank nicht vorhanden.' };
        return { ok: false, message: 'Die Aktion konnte nicht ausgeführt werden.' };
      }
      return res.data || { ok: false, message: 'Leere Antwort vom Server.' };
    } catch (e) { return { ok: false, message: 'Server nicht erreichbar.' }; }
  },
};

/* ---------- ABIS-Überwachungstabellen (optional, siehe sql/abis-ueberwachung.sql) ---------- */
function missingTable(error) {
  const c = error && error.code;
  return c === '42P01' || c === 'PGRST205' || c === 'PGRST202' || c === '42883' || /does not exist|not find/i.test(String(error && error.message));
}
export const Monitor = {
  async query(table, build) {
    try {
      let q = sb.from(table).select('*', { count: 'exact' });
      q = build ? build(q) : q;
      const { data, error, count } = await q;
      if (error) return { ok: false, missing: missingTable(error), message: error.message };
      return { ok: true, rows: data || [], total: count ?? (data || []).length };
    } catch (e) { return { ok: false, message: 'Server nicht erreichbar.' }; }
  },
  async rpc(name, args) {
    try {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) return { ok: false, missing: missingTable(error), message: error.message };
      return { ok: true, data };
    } catch (e) { return { ok: false, message: 'Server nicht erreichbar.' }; }
  },
  /* Verwaltungsaktion protokollieren. Fehlt die Tabelle, bleibt es beim Sitzungsprotokoll. */
  async logAction(action, target, detail) {
    try { await sb.rpc('abis_log_action', { p_action: action, p_target: target || null, p_detail: detail || {} }); } catch (e) { /* optional */ }
  },
};

/* Antwortzeit der Datenbank messen (leichter HEAD-Zugriff) */
export async function pingDb() {
  const t0 = performance.now();
  try {
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
    const ms = Math.round(performance.now() - t0);
    return error ? { ok: false, ms, message: error.message } : { ok: true, ms };
  } catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), message: 'nicht erreichbar' }; }
}

/* Ist die Edge Function erreichbar? (OPTIONS-Anfrage, ändert nichts) */
export async function pingFunction(name) {
  const t0 = performance.now();
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/' + name, { method: 'OPTIONS' });
    return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0) };
  } catch (e) { return { ok: false, status: 0, ms: Math.round(performance.now() - t0) }; }
}

export function newKey() {
  try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) { /* weiter */ }
  const a = new Uint8Array(16); window.crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
