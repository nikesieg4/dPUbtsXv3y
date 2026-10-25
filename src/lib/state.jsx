/* =====================================================================
   ZENTRALER ZUSTAND
   Lädt nach der Anmeldung alle lesbaren Datensätze aus kv sowie die
   Profile, hält sie per Realtime aktuell und führt ein Sitzungsprotokoll.
   ===================================================================== */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { sb, Store, Monitor } from './db.js';
import { KEYS, KEY_LABEL, buildMe, normUnit } from './model.js';

const Ctx = createContext(null);
export function useApp() { return useContext(Ctx); }

export function DataProvider({ profile, children }) {
  const [kv, setKv] = useState(null);            // { key: { value, updated_at } }
  const [profiles, setProfiles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState(false);
  const [events, setEvents] = useState([]);      // Sitzungs-/Live-Protokoll
  const [lastSync, setLastSync] = useState(null);
  const kvRef = useRef({});

  const note = useCallback((text, tone, src) => {
    setEvents((ev) => [{ id: Date.now() + Math.random(), ts: Date.now(), text, tone: tone || '', src: src || 'konsole' }, ...ev].slice(0, 300));
  }, []);

  const reloadAll = useCallback(async () => {
    try {
      const rows = await Store.all();
      const m = {}; rows.forEach((r) => { m[r.key] = { value: r.value, updated_at: r.updated_at }; });
      kvRef.current = m; setKv(m); setLoadError(''); setLastSync(Date.now());
    } catch (e) { setLoadError('Die Daten konnten nicht geladen werden: ' + (e.message || 'unbekannter Fehler')); }
    const { data, error } = await sb.from('profiles').select('*');
    if (!error) setProfiles(data || []);
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  useEffect(() => {
    const ch = sb.channel('abis-kv')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kv' }, (p) => {
        const row = p.new && p.new.key ? p.new : p.old;
        if (!row || !row.key) return;
        const next = { ...kvRef.current };
        if (p.eventType === 'DELETE') delete next[row.key];
        else next[row.key] = { value: p.new.value, updated_at: p.new.updated_at };
        kvRef.current = next; setKv(next); setLastSync(Date.now());
        note((KEY_LABEL[row.key] || row.key) + ' · ' + (p.eventType === 'INSERT' ? 'angelegt' : p.eventType === 'DELETE' ? 'gelöscht' : 'geändert'),
          p.eventType === 'DELETE' ? 'bad' : 'info', 'kv');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        sb.from('profiles').select('*').then(({ data, error }) => { if (!error) setProfiles(data || []); });
        note('Profile · geändert', 'warn', 'db');
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') note('Live-Verbindung gestört (' + status + ')', 'bad', 'system');
      });
    return () => { try { sb.removeChannel(ch); } catch (e) { /* egal */ } };
  }, [note]);

  const val = (key, fallback) => { const e = kv && kv[key]; return e && e.value !== null && e.value !== undefined ? e.value : fallback; };
  const registry = useMemo(() => (kv ? (val(KEYS.REG, []) || []).map((c) => ({ ...c, ministries: Array.isArray(c.ministries) ? c.ministries : [] })) : []), [kv]);
  const units = useMemo(() => (kv ? (val(KEYS.UNITS, []) || []).map(normUnit) : []), [kv]);
  const perms = useMemo(() => (kv ? val(KEYS.PERMS, {}) || {} : {}), [kv]);
  const levels = useMemo(() => { const m = {}; profiles.forEach((p) => { m[p.citizen_id] = p.is_admin ? 6 : Number(p.level) || 0; }); return m; }, [profiles]);
  /* Register mit dem Level aus der Datenbank (nicht dem alten Wert im Register) */
  const citizens = useMemo(() => registry.map((c) => (levels[c.id] !== undefined ? { ...c, is: levels[c.id] } : c)), [registry, levels]);
  const myProfile = useMemo(() => profiles.find((p) => p.id === profile.uid) || profile, [profiles, profile]);
  const me = useMemo(() => buildMe({ ...profile, ...myProfile, email: profile.email, uid: profile.uid }, registry, units, perms), [profile, myProfile, registry, units, perms]);

  /* Speichern mit frischem Stand + Protokoll */
  const mutate = useCallback(async (key, fn, fallback, logText) => {
    const next = await Store.mutate(key, fn, fallback);
    const m = { ...kvRef.current, [key]: { value: next, updated_at: new Date().toISOString() } };
    kvRef.current = m; setKv(m);
    if (logText) { note(logText, 'ok'); Monitor.logAction(logText, key); }
    return next;
  }, [note]);

  const nameOf = useCallback((id) => {
    if (!id) return '—';
    const c = registry.find((x) => x.id === id); if (c) return c.name;
    const p = profiles.find((x) => x.citizen_id === id || x.id === id); return p ? p.name : id;
  }, [registry, profiles]);

  const value = { kv, val, profiles, registry, citizens, units, perms, me, loadError, live, events, note, reloadAll, mutate, nameOf, lastSync };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
