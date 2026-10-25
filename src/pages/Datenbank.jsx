/* Datenbankkontrolle: Datensätze, Profile, Tabellen/RLS, Konsistenz */
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { Monitor, pingDb } from '../lib/db.js';
import { KEY_LABEL, keyReadLevel, keyWriteLevel, IS_LABEL } from '../lib/model.js';
import { fmtBytes, jsonSize, relTime, fmtDT, downloadText } from '../lib/format.js';
import { PageHead, Tabs, Stat, Btn, Badge, Empty, Dialog, ICON } from '../components/ui.jsx';
import { SetupHint } from './Protokoll.jsx';

export default function Datenbank() {
  const app = useApp();
  const [tab, setTab] = useState('kv');
  const [ping, setPing] = useState(null);
  useEffect(() => { pingDb().then(setPing); }, []);
  const entries = useMemo(() => Object.entries(app.kv || {}).map(([key, e]) => ({ key, size: jsonSize(e.value), updated_at: e.updated_at, value: e.value }))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))), [app.kv]);
  const total = entries.reduce((s, e) => s + e.size, 0);
  const issues = useConsistency();

  return (
    <div className="stack-lg">
      <PageHead title="Datenbankkontrolle" sub="Supabase · Tabelle kv (Portaldaten), profiles, Bank-Tabellen" actions={<Btn onClick={() => { app.reloadAll(); pingDb().then(setPing); }}>Neu laden</Btn>} />
      <div className="stats">
        <Stat icon={ICON.db} k="Datensätze (kv)" v={entries.length} m={fmtBytes(total) + ' gesamt'} />
        <Stat icon={ICON.users} k="Profile" v={app.profiles.length} m={app.profiles.filter((p) => p.is_admin || p.level >= 5).length + ' privilegiert (L5+)'} />
        <Stat icon={ICON.pulse} k="Antwortzeit" v={ping ? (ping.ok ? ping.ms + ' ms' : 'AUSFALL') : '…'} tone={ping && !ping.ok ? 'bad' : ''} m={'letzte Synchronisation ' + (app.lastSync ? relTime(app.lastSync) : '—')} />
        <Stat icon={ICON.warn} k="Konsistenz" v={issues.length ? issues.length : 'OK'} tone={issues.length ? 'warn' : 'ok'} m="Register ↔ Profile" />
      </div>
      <Tabs value={tab} onChange={setTab} options={[{ value: 'kv', label: 'Datensätze' }, { value: 'tables', label: 'Tabellen & RLS' }, { value: 'profiles', label: 'Profile' }, { value: 'check', label: 'Konsistenz' }]} />
      {tab === 'kv' && <KvTable entries={entries} />}
      {tab === 'tables' && <Tables />}
      {tab === 'profiles' && <Profiles />}
      {tab === 'check' && <Consistency issues={issues} />}
    </div>
  );
}

function KvTable({ entries }) {
  const { me } = useApp();
  const [open, setOpen] = useState(null);
  const lvl = me.isAdmin ? 99 : me.baseLevel;
  return (
    <section className="panel table-wrap">
      <table className="table" style={{ minWidth: 900 }}>
        <thead><tr>{['Bereich', 'Schlüssel', 'Größe', 'Einträge', 'Zuletzt geändert', 'Lesen ab', 'Schreiben ab', 'Ihr Zugriff', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {entries.map((e) => {
            const n = Array.isArray(e.value) ? e.value.length : e.value && typeof e.value === 'object' ? (Array.isArray(e.value.tickets) ? e.value.tickets.length : Array.isArray(e.value.channels) ? e.value.channels.length : Object.keys(e.value).length) : '—';
            const w = keyWriteLevel(e.key);
            const recent = e.updated_at && Date.now() - new Date(e.updated_at).getTime() < 3600000;
            return (
              <tr key={e.key}>
                <td>{KEY_LABEL[e.key] || <span className="muted">unbekannt</span>}</td>
                <td className="mono small">{e.key}</td>
                <td className="num mono">{fmtBytes(e.size)}</td>
                <td className="num mono">{n}</td>
                <td className="nowrap">{recent ? <span className="val-warn">{relTime(e.updated_at)}</span> : relTime(e.updated_at)}<div className="muted small">{fmtDT(e.updated_at)}</div></td>
                <td>L{keyReadLevel(e.key)}</td><td>L{w}</td>
                <td>{lvl >= w ? <Badge tone="ok">lesen + schreiben</Badge> : <Badge>nur lesen</Badge>}</td>
                <td><Btn size="sm" onClick={() => setOpen(e)}>Ansehen</Btn></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entries.length === 0 && <Empty>Keine lesbaren Datensätze.</Empty>}
      {open && (
        <Dialog title={'Datensatz · ' + open.key} wide onClose={() => setOpen(null)}>
          <div className="stack">
            <div className="row-between"><span className="muted small">{fmtBytes(open.size)} · geändert {fmtDT(open.updated_at)} · nur Ansicht</span>
              <Btn size="sm" onClick={() => downloadText(open.key.replace(/[^a-z0-9]+/gi, '-') + '.json', JSON.stringify(open.value, null, 2), 'application/json')}>Als JSON herunterladen</Btn></div>
            <pre className="json">{JSON.stringify(open.value, null, 2).slice(0, 200000)}</pre>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function Tables() {
  const [r, setR] = useState(null);
  const load = () => Monitor.rpc('abis_db_overview').then(setR);
  useEffect(() => { load(); }, []);
  if (!r) return <Empty>Lädt …</Empty>;
  if (r.missing) return <SetupHint table="abis_db_overview()" />;
  if (!r.ok) return <div className="msg bad">{/permission|denied|forbidden/i.test(r.message) ? 'Nur für Level 5+ / Administrator.' : r.message}</div>;
  const d = r.data || {};
  const tables = d.tables || [];
  const noRls = tables.filter((t) => !t.rls);
  return (
    <div className="stack">
      {noRls.length > 0 && <div className="alert-bar"><span className="badge solid-bad">Alarm</span><span className="grow">Tabellen ohne Row Level Security: {noRls.map((t) => t.name).join(', ')} – diese sind über den öffentlichen Schlüssel ungeschützt.</span></div>}
      <div className="stats">
        <Stat k="Datenbankgröße" v={fmtBytes(d.db_size)} m={d.pg_version || ''} />
        <Stat k="Verbindungen" v={d.connections != null ? d.connections : '—'} m="aktive Sitzungen (pg_stat_activity)" />
        <Stat k="Tabellen (public)" v={tables.length} m={noRls.length ? noRls.length + ' ohne RLS' : 'alle mit RLS'} tone={noRls.length ? 'bad' : 'ok'} />
      </div>
      <section className="panel table-wrap">
        <div className="panel-h"><h2>Tabellen</h2><Btn size="sm" onClick={load}>Aktualisieren</Btn></div>
        <table className="table" style={{ minWidth: 720 }}>
          <thead><tr>{['Tabelle', 'Zeilen (ca.)', 'Größe', 'RLS', 'Policies', 'Realtime'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{tables.map((t) => (
            <tr key={t.name} className={t.rls ? '' : 'row-bad'}>
              <td className="mono">{t.name}</td><td className="num mono">{t.rows}</td><td className="num mono">{fmtBytes(t.size)}</td>
              <td>{t.rls ? <Badge tone="ok">aktiv</Badge> : <Badge tone="bad">AUS</Badge>}</td><td className="num mono">{t.policies}</td>
              <td>{t.realtime ? <Badge tone="info">ja</Badge> : <span className="muted">—</span>}</td>
            </tr>))}</tbody>
        </table>
      </section>
    </div>
  );
}

function Profiles() {
  const { profiles, registry } = useApp();
  const [q, setQ] = useState('');
  const list = profiles.filter((p) => !q || (p.name + ' ' + p.citizen_id + ' ' + (p.ministries || []).join(' ')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.is_admin - a.is_admin) || (b.level - a.level) || String(a.name).localeCompare(b.name, 'de'));
  return (
    <section className="panel table-wrap">
      <div className="panel-h"><h2>Profile ({profiles.length})</h2><input className="input" style={{ maxWidth: 280 }} placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <table className="table" style={{ minWidth: 820 }}>
        <thead><tr>{['Name', 'Bürger-Nr.', 'Level', 'Rolle', 'Zuordnungen', 'Im Register', 'Geändert'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{list.map((p) => {
          const reg = registry.find((c) => c.id === p.citizen_id);
          return (
            <tr key={p.id} className={p.is_admin || p.level >= 6 ? 'row-warn' : ''}>
              <td>{p.name}</td><td className="mono small">{p.citizen_id}</td>
              <td><Badge tone={p.is_admin || p.level >= 5 ? 'amber' : ''}>L{p.is_admin ? 6 : p.level}</Badge> <span className="muted small">{IS_LABEL[p.is_admin ? 6 : p.level]}</span></td>
              <td>{p.is_admin ? <Badge tone="bad">Administrator</Badge> : '—'}</td>
              <td className="small">{(p.ministries || []).join(', ') || <span className="muted">Zivilist</span>}</td>
              <td>{reg ? (reg.locked ? <Badge tone="bad">gesperrt</Badge> : <Badge tone="ok">ja</Badge>) : p.is_admin ? <span className="muted">—</span> : <Badge tone="warn">fehlt</Badge>}</td>
              <td className="small nowrap">{relTime(p.updated_at)}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </section>
  );
}

function useConsistency() {
  const { profiles, registry } = useApp();
  return useMemo(() => {
    const out = [];
    const byCit = {}; profiles.forEach((p) => { byCit[p.citizen_id] = p; });
    registry.forEach((c) => {
      const p = byCit[c.id];
      if (!p) out.push({ tone: 'warn', text: c.name + ' (' + c.id + ') steht im Register, hat aber kein Anmeldeprofil.' });
      else if (c.is !== undefined && Number(c.is) !== Number(p.level) && !p.is_admin) out.push({ tone: 'info', text: c.name + ': Level im Register (' + c.is + ') weicht vom Profil (' + p.level + ') ab. Maßgeblich ist das Profil.' });
    });
    profiles.forEach((p) => { if (!p.is_admin && !registry.some((c) => c.id === p.citizen_id)) out.push({ tone: 'warn', text: 'Profil ' + p.name + ' (' + p.citizen_id + ') hat keinen Eintrag im Bürgerregister.' }); });
    const ids = {}; registry.forEach((c) => { ids[c.id] = (ids[c.id] || 0) + 1; });
    Object.entries(ids).filter(([, n]) => n > 1).forEach(([id, n]) => out.push({ tone: 'bad', text: 'Bürger-Nr. ' + id + ' kommt ' + n + '× im Register vor.' }));
    const mails = {}; registry.forEach((c) => { const m = String(c.loginEmail || '').toLowerCase(); if (m) mails[m] = (mails[m] || 0) + 1; });
    Object.entries(mails).filter(([, n]) => n > 1).forEach(([m, n]) => out.push({ tone: 'bad', text: 'Login-Adresse ' + m + ' ist ' + n + '× vergeben.' }));
    return out;
  }, [profiles, registry]);
}
function Consistency({ issues }) {
  if (!issues.length) return <div className="msg ok">Register und Profile sind konsistent.</div>;
  return (
    <section className="panel"><div className="panel-b">
      <ul className="log">{issues.map((i, k) => <li key={k} className={i.tone === 'bad' ? 'bad' : i.tone === 'warn' ? 'warn' : ''}>{i.text}</li>)}</ul>
    </div></section>
  );
}
