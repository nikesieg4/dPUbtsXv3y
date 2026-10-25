/* Sicherheitsprotokoll: Bank-Audit, Anmeldungen, Datenänderungen, Verwaltungsaktionen, Live */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { Monitor } from '../lib/db.js';
import { KEY_LABEL } from '../lib/model.js';
import { fmtISO, fmtBytes, buildCsv, downloadText } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Pager, Empty, Uuid, Field, Dialog } from '../components/ui.jsx';

const RESULT = { success: ['Erfolg', 'ok'], rejected: ['Abgelehnt', 'warn'], failed: ['Fehler', 'bad'] };
const AUTH_EV = { sign_in: ['Anmeldung', 'ok'], user_created: ['Konto angelegt', 'info'], password_changed: ['Passwort geändert', 'warn'],
  email_changed: ['E-Mail geändert', 'warn'], banned: ['Gesperrt', 'bad'], unbanned: ['Entsperrt', 'ok'], user_deleted: ['Konto gelöscht', 'bad'] };

const SOURCES = {
  audit: { table: 'bank_audit_logs', ts: 'ts', label: 'Bank-Audit' },
  auth: { table: 'abis_auth_events', ts: 'ts', label: 'Anmeldungen' },
  kv: { table: 'abis_kv_changes', ts: 'ts', label: 'Datenänderungen' },
  admin: { table: 'abis_admin_actions', ts: 'ts', label: 'Verwaltungsaktionen' },
};

export default function Protokoll() {
  const [src, setSrc] = useState('audit');
  return (
    <div className="stack-lg">
      <PageHead title="Sicherheitsprotokoll" sub="Unveränderliche Protokolle aus der Datenbank und Live-Ereignisse dieser Sitzung" />
      <Tabs value={src} onChange={setSrc} options={[...Object.entries(SOURCES).map(([k, s]) => ({ value: k, label: s.label })), { value: 'live', label: 'Live / Sitzung' }]} />
      {src === 'live' ? <LiveLog /> : <DbLog key={src} src={src} />}
    </div>
  );
}

function DbLog({ src }) {
  const app = useApp();
  const S = SOURCES[src]; const PAGE = 25;
  const empty = { result: '', text: '', from: '', to: '' };
  const [f, setF] = useState(empty); const [page, setPage] = useState(0);
  const [data, setData] = useState(null); const [busy, setBusy] = useState(false); const [detail, setDetail] = useState(null);
  const seq = useRef(0);
  const byUid = useMemo(() => { const m = {}; app.profiles.forEach((p) => { m[p.id] = p; }); return m; }, [app.profiles]);

  function build(q, f2) {
    if (f2.result) q = src === 'auth' ? q.eq('event', f2.result) : q.eq('result', f2.result);
    if (f2.text) {
      const t = f2.text.replace(/[%,()]/g, ' ').trim();
      if (t) q = src === 'audit' ? q.ilike('action', '%' + t + '%') : src === 'auth' ? q.or('email.ilike.%' + t + '%,name.ilike.%' + t + '%,citizen_id.ilike.%' + t + '%')
        : src === 'kv' ? q.or('key.ilike.%' + t + '%,actor_name.ilike.%' + t + '%,actor_citizen.ilike.%' + t + '%') : q.or('action.ilike.%' + t + '%,actor_name.ilike.%' + t + '%,target.ilike.%' + t + '%');
    }
    if (f2.from) q = q.gte(S.ts, new Date(f2.from + 'T00:00:00').toISOString());
    if (f2.to) q = q.lt(S.ts, new Date(new Date(f2.to + 'T00:00:00').getTime() + 86400000).toISOString());
    return q.order(S.ts, { ascending: false });
  }
  async function load(f2 = f, p = page) {
    const mine = ++seq.current; setBusy(true);
    const r = await Monitor.query(S.table, (q) => build(q, f2).range(p * PAGE, p * PAGE + PAGE - 1));
    if (mine !== seq.current) return;
    setBusy(false); setData(r);
  }
  useEffect(() => { load(); }, [page]);   // eslint-disable-line react-hooks/exhaustive-deps
  const apply = () => { if (page) setPage(0); else load(); };

  async function exportCsv() {
    const r = await Monitor.query(S.table, (q) => build(q, f).limit(5000));
    if (!r.ok) return;
    const rows = r.rows;
    const keys = rows.length ? Object.keys(rows[0]) : [];
    downloadText('abis-' + src + '-' + new Date().toISOString().slice(0, 10) + '.csv',
      buildCsv(keys, rows.map((x) => keys.map((k) => (typeof x[k] === 'object' && x[k] !== null ? JSON.stringify(x[k]) : x[k])))));
    app.note('Protokoll exportiert: ' + S.label + ' (' + rows.length + ')', 'ok'); Monitor.logAction('Protokoll exportiert', S.table, { rows: rows.length });
  }

  if (data && data.missing) return <SetupHint table={S.table} />;
  const rows = data && data.ok ? data.rows : [];
  const actor = (uid, name, cit) => name ? <>{name}<div className="muted small mono">{cit || ''}</div></> : uid ? (byUid[uid] ? <>{byUid[uid].name}<div className="muted small mono">{byUid[uid].citizen_id}</div></> : <Uuid id={uid} />) : <span className="muted">System</span>;

  return (
    <div className="stack">
      <div className="filters">
        <Field label={src === 'auth' ? 'Ereignis' : 'Ergebnis'}>
          <select className="select" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} style={{ minWidth: 170 }}>
            <option value="">Alle</option>
            {Object.entries(src === 'auth' ? AUTH_EV : src === 'audit' ? RESULT : {}).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
          </select>
        </Field>
        <Field label="Suche"><input className="input mono" style={{ width: 230 }} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} placeholder={src === 'audit' ? 'Aktion, z. B. TRANSFER' : 'Name, Schlüssel …'} /></Field>
        <Field label="Von"><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Bis"><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Btn variant="primary" onClick={apply}>Filtern</Btn>
        <Btn onClick={() => { setF(empty); if (page) setPage(0); else load(empty, 0); }}>Zurücksetzen</Btn>
        <Btn onClick={exportCsv} disabled={!rows.length}>CSV exportieren</Btn>
      </div>
      {data && !data.ok && <div className="msg bad">{/permission|42501/i.test(data.message || '') ? 'Keine Leseberechtigung für dieses Protokoll (Level 6 / Administrator).' : 'Fehler: ' + data.message}</div>}

      <section className="panel table-wrap">
        <table className="table mono" style={{ minWidth: 900 }}>
          <thead><tr>{src === 'audit' && ['Zeitstempel', 'Aktion', 'Akteur', 'Zielkonto', 'Transaktion', 'Ergebnis', 'Grund'].map((h) => <th key={h}>{h}</th>)}
            {src === 'auth' && ['Zeitstempel', 'Ereignis', 'Person', 'E-Mail', 'Details'].map((h) => <th key={h}>{h}</th>)}
            {src === 'kv' && ['Zeitstempel', 'Datensatz', 'Vorgang', 'Durch', 'Größe vorher → nachher', 'Prüfsumme'].map((h) => <th key={h}>{h}</th>)}
            {src === 'admin' && ['Zeitstempel', 'Aktion', 'Durch', 'Ziel', 'Details'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              if (src === 'audit') {
                const rs = RESULT[r.result] || [r.result, ''];
                return (
                  <tr key={r.id} className={'click ' + (r.result === 'failed' ? 'row-bad' : r.result === 'rejected' ? 'row-warn' : '')} onClick={() => setDetail(r)}>
                    <td className="nowrap">{fmtISO(r.ts)}</td><td>{r.action}</td>
                    <td>{r.actor_type ? <span className="muted">{r.actor_type} · </span> : null}{actor(r.actor_user_id)}</td>
                    <td><Uuid id={r.target_account_id} /></td><td><Uuid id={r.transaction_id} /></td>
                    <td><Badge tone={rs[1]}>{rs[0]}</Badge></td><td>{r.reason || '—'}</td>
                  </tr>
                );
              }
              if (src === 'auth') {
                const ev = AUTH_EV[r.event] || [r.event, ''];
                return (
                  <tr key={r.id} className={r.event === 'banned' || r.event === 'user_deleted' ? 'row-bad' : ''}>
                    <td className="nowrap">{fmtISO(r.ts)}</td><td><Badge tone={ev[1]}>{ev[0]}</Badge></td>
                    <td>{r.name || '—'}<div className="muted small">{r.citizen_id || ''}</div></td><td>{r.email || '—'}</td>
                    <td className="small">{r.detail && Object.keys(r.detail).length ? JSON.stringify(r.detail) : '—'}</td>
                  </tr>
                );
              }
              if (src === 'kv') {
                const shrink = r.old_size != null && r.new_size != null && r.new_size < r.old_size * 0.5 && r.old_size > 2000;
                return (
                  <tr key={r.id} className={r.op === 'DELETE' || shrink ? 'row-bad' : ''}>
                    <td className="nowrap">{fmtISO(r.ts)}</td><td>{KEY_LABEL[r.key] || r.key}<div className="muted small">{r.key}</div></td>
                    <td><Badge tone={r.op === 'DELETE' ? 'bad' : r.op === 'INSERT' ? 'info' : ''}>{r.op}</Badge>{shrink && <div><Badge tone="bad">Stark verkleinert</Badge></div>}</td>
                    <td>{actor(r.actor_id, r.actor_name, r.actor_citizen)}</td>
                    <td className="nowrap">{r.old_size != null ? fmtBytes(r.old_size) : '—'} → {r.new_size != null ? fmtBytes(r.new_size) : '—'}</td>
                    <td className="small">{(r.new_hash || r.old_hash || '').slice(0, 12)}</td>
                  </tr>
                );
              }
              return (
                <tr key={r.id}>
                  <td className="nowrap">{fmtISO(r.ts)}</td><td>{r.action}</td><td>{actor(r.actor_id, r.actor_name, r.actor_citizen)}</td>
                  <td>{r.target || '—'}</td><td className="small">{r.detail && Object.keys(r.detail).length ? JSON.stringify(r.detail) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!busy && data && data.ok && rows.length === 0 && <Empty>Keine Einträge.</Empty>}
        {busy && <Empty>Lädt …</Empty>}
      </section>
      {data && data.ok && <Pager page={page} total={data.total} size={PAGE} onPage={setPage} />}
      {detail && (
        <Dialog title="Audit-Eintrag" wide onClose={() => setDetail(null)}>
          <pre className="json">{JSON.stringify(detail, null, 2)}</pre>
        </Dialog>
      )}
    </div>
  );
}

function LiveLog() {
  const { events, live } = useApp();
  return (
    <section className="panel">
      <div className="panel-h"><h2>Live-Ereignisse dieser Sitzung</h2><span className="row small muted"><span className={'dot ' + (live ? 'live' : 'bad')} />{live ? 'Realtime verbunden' : 'Realtime getrennt'}</span></div>
      <div className="panel-b">
        {events.length === 0 ? <Empty>Noch keine Ereignisse. Änderungen an den Portaldaten erscheinen hier sofort.</Empty> : (
          <ul className="log">
            {events.map((e) => <li key={e.id} className={e.tone === 'bad' ? 'bad' : e.tone === 'ok' ? 'ok' : e.tone === 'warn' ? 'warn' : ''}>[{e.src}] {e.text}<span className="t">{fmtISO(e.ts)}</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export function SetupHint({ table }) {
  return (
    <section className="panel alert-warn">
      <div className="panel-h"><h2>Protokoll nicht eingerichtet</h2></div>
      <div className="panel-b stack" style={{ gap: 8 }}>
        <p style={{ margin: 0 }}>Die Tabelle <code>{table}</code> existiert noch nicht. Damit Anmeldungen, Datenänderungen und Verwaltungsaktionen dauerhaft protokolliert werden,
          führen Sie einmalig <code>sql/abis-ueberwachung.sql</code> im Supabase-SQL-Editor aus (Anleitung in der README).</p>
        <p className="muted small" style={{ margin: 0 }}>Das Bürgerportal funktioniert unverändert weiter – die Protokollierung läuft rein in der Datenbank.</p>
      </div>
    </section>
  );
}
