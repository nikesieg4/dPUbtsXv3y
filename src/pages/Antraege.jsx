/* Anträge: Bewerbungen aus dem Portal + Staatsbürgerschaftsanträge von außen */
import React, { useEffect, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { sb, Monitor } from '../lib/db.js';
import { KEYS, can, APP_STEPS, canHandleApplication, inferUnitFromLabel, displayName } from '../lib/model.js';
import { fmtDT } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Empty, Msg, Panel, Kv, Dialog } from '../components/ui.jsx';

const isOpen = (a) => !a.archived && a.step < 3 && !['abgelehnt', 'zurückgezogen', 'geschlossen'].includes(a.status);

export default function Antraege() {
  const [tab, setTab] = useState('apps');
  return (
    <div className="stack-lg">
      <PageHead title="Anträge" sub="Bewerbungen aus dem Bürgerportal und Staatsbürgerschaftsanträge über das öffentliche Formular" />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'apps', label: 'Bewerbungen' }, { value: 'cit', label: 'Staatsbürgerschaft' }]} />
      {tab === 'apps' ? <Apps /> : <Citizenship />}
    </div>
  );
}

function Apps() {
  const app = useApp();
  const { me, units } = app;
  const types = app.val(KEYS.TYPES, []) || [];
  const typeUnits = app.val(KEYS.TYPEUNITS, {}) || {};
  const all = (app.val(KEYS.APPS, []) || []).map((a) => {
    if (a.unit) return a;
    const t = types.find((x) => x.label === a.title);
    return { ...a, unit: (t && (t.unit || typeUnits[t.id])) || inferUnitFromLabel(a.title, units) };
  }).filter((a) => canHandleApplication(me, a, units));
  const [filter, setFilter] = useState('offen'); const [kind, setKind] = useState(''); const [msg, setMsg] = useState(null);
  const kinds = [...new Set(all.map((a) => a.title).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const pool = all.filter((a) => (!kind || a.title === kind) && (filter === 'offen' ? isOpen(a) : filter === 'bewilligt' ? !a.archived && a.step >= 3 && !a.status
    : filter === 'beendet' ? !a.archived && ['abgelehnt', 'zurückgezogen', 'geschlossen'].includes(a.status) : filter === 'archiv' ? a.archived : true));

  async function update(a, patch, text, grantUnit) {
    try {
      await app.mutate(KEYS.APPS, (list) => (list || []).map((x) => (x.id === a.id ? { ...x, ...patch } : x)), [], text);
      if (grantUnit) await app.mutate(KEYS.REG, (reg) => (reg || []).map((c) => (c.id === a.ownerId && !(c.ministries || []).includes(grantUnit) ? { ...c, ministries: [...(c.ministries || []), grantUnit] } : c)), []);
      setMsg({ ok: true, text });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  function advance(a) {
    const t = types.find((x) => x.label === a.title); const next = Math.min((a.step || 0) + 1, 3);
    const grant = next >= 3 && t && t.grantOnAccept && a.unit ? a.unit : null;
    update(a, { step: next, ...(grant ? { grantedUnit: grant } : {}) }, 'Antrag ' + a.ref + ' → ' + APP_STEPS[next], grant);
  }
  async function del(a) {
    if (!window.confirm('Bewerbung ' + a.ref + ' endgültig löschen?')) return;
    try { await app.mutate(KEYS.APPS, (list) => (list || []).filter((x) => x.id !== a.id), [], 'Bewerbung gelöscht: ' + a.ref); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const chip = (k, l, n) => <button key={k} type="button" className={'chip ' + (filter === k ? 'on' : '')} onClick={() => setFilter(k)}>{l} ({n})</button>;
  return (
    <div className="stack">
      <div className="filters" style={{ alignItems: 'center' }}>
        <div className="chips">
          {chip('offen', 'Offen', all.filter(isOpen).length)}{chip('bewilligt', 'Bewilligt', all.filter((a) => !a.archived && a.step >= 3 && !a.status).length)}
          {chip('beendet', 'Abgelehnt / Geschlossen', all.filter((a) => !a.archived && ['abgelehnt', 'zurückgezogen', 'geschlossen'].includes(a.status)).length)}
          {chip('archiv', 'Archiv', all.filter((a) => a.archived).length)}{chip('alle', 'Alle', all.length)}
        </div>
        <select className="select" style={{ maxWidth: 260 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Antragsart"><option value="">Alle Antragsarten</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
      </div>
      <Msg m={msg} />
      {!pool.length && <Empty>Keine Anträge in dieser Ansicht.</Empty>}
      {pool.map((a) => (
        <Panel key={a.id} title={<div><h2>{a.title} — {displayName(app.nameOf(a.ownerId))}</h2><div className="muted small">{a.kind} · {a.unit || a.office || 'ohne Zuordnung'} · {a.ref} · eingereicht {a.date}</div></div>}
          actions={<>
            {a.archived && <Badge>Archiviert</Badge>}
            <Badge tone={a.status === 'abgelehnt' ? 'bad' : a.status ? '' : a.step >= 3 ? 'ok' : 'warn'}>{a.status || APP_STEPS[Math.min(a.step || 0, 3)]}</Badge>
            {isOpen(a) && (a.ownerId === me.id ? <span className="muted small">Eigene Bewerbung</span> : <>
              <Btn size="sm" variant="primary" onClick={() => advance(a)}>{(a.step || 0) >= 2 ? 'Bewilligen' : 'Nächster Schritt'}</Btn>
              <Btn size="sm" variant="danger" onClick={() => update(a, { status: 'abgelehnt', rejectedAt: Date.now() }, 'Antrag abgelehnt: ' + a.ref)}>Ablehnen</Btn>
              <Btn size="sm" onClick={() => update(a, { status: 'geschlossen', closedAt: Date.now() }, 'Antrag geschlossen: ' + a.ref)}>Schließen</Btn></>)}
            {can(me, 'apps.delete') && <Btn size="sm" variant="ghost" onClick={() => del(a)} aria-label="Löschen">🗑</Btn>}
          </>}>
          {(Array.isArray(a.answers) ? a.answers : []).filter((x) => x && x.a).map((x, i) => <div key={i} className="list-row" style={{ display: 'block' }}><div className="muted small">{x.q}</div><strong>{x.a}</strong></div>)}
          {a.grund && <div className="small" style={{ marginTop: 8 }}><span className="muted">Beweggrund: </span>{a.grund}</div>}
          {!a.status && <div className="row" style={{ marginTop: 10, gap: 4 }}>{APP_STEPS.map((s, i) => <Badge key={s} tone={i <= (a.step || 0) ? 'amber' : ''}>{i + 1} {s}</Badge>)}</div>}
        </Panel>
      ))}
    </div>
  );
}

function Citizenship() {
  const app = useApp();
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [st, setSt] = useState('offen'); const [open, setOpen] = useState(null);
  async function load() {
    let q = sb.from('citizenship_requests').select('*').order('eingegangen', { ascending: false }).limit(500);
    if (st) q = q.eq('status', st);
    const { data, error } = await q;
    if (error) setErr(error.code === '42P01' ? 'Tabelle citizenship_requests ist nicht eingerichtet (sql/5-antragstabelle.sql).' : /permission/i.test(error.message) ? 'Nur ab Level 4.' : error.message);
    else { setErr(''); setRows(data || []); }
  }
  useEffect(() => { load(); }, [st]);   // eslint-disable-line react-hooks/exhaustive-deps
  async function setStatus(r, status) {
    const by = app.me.isAdmin ? 'Administrator' : app.me.name;
    const { error } = await sb.from('citizenship_requests').update({ status, bearbeitet_von: by, bearbeitet_am: new Date().toISOString() }).eq('id', r.id);
    if (error) { setErr(error.message); return; }
    app.note('Staatsbürgerschaftsantrag ' + r.aktenzeichen + ': ' + status, 'ok'); Monitor.logAction('Staatsbürgerschaftsantrag ' + status, r.aktenzeichen);
    setOpen(null); load();
  }
  async function del(r) {
    if (!window.confirm('Antrag ' + r.aktenzeichen + ' endgültig löschen?')) return;
    const { error } = await sb.from('citizenship_requests').delete().eq('id', r.id);
    if (error) setErr(error.message); else { Monitor.logAction('Staatsbürgerschaftsantrag gelöscht', r.aktenzeichen); setOpen(null); load(); }
  }
  return (
    <div className="stack">
      <div className="chips">{[['offen', 'Offen'], ['angenommen', 'Angenommen'], ['abgelehnt', 'Abgelehnt'], ['', 'Alle']].map(([k, l]) => <button key={k} type="button" className={'chip ' + (st === k ? 'on' : '')} onClick={() => setSt(k)}>{l}</button>)}</div>
      {err && <Msg m={{ ok: false, text: err }} />}
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 820 }}>
          <thead><tr>{['Eingang', 'Aktenzeichen', 'Name', 'E-Mail', 'Art', 'Status', 'Bearbeitet'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{(rows || []).map((r) => (
            <tr key={r.id} className="click" onClick={() => setOpen(r)}>
              <td className="nowrap small">{fmtDT(r.eingegangen)}</td><td className="mono small">{r.aktenzeichen}</td><td>{r.vorname} {r.nachname}</td>
              <td className="small">{r.email}</td><td className="small">{r.art || '—'}</td>
              <td><Badge tone={r.status === 'offen' ? 'warn' : r.status === 'angenommen' ? 'ok' : 'bad'}>{r.status}</Badge></td>
              <td className="small muted">{r.bearbeitet_von ? r.bearbeitet_von + ' · ' + fmtDT(r.bearbeitet_am) : '—'}</td>
            </tr>))}</tbody>
        </table>
        {rows && !rows.length && <Empty>Keine Anträge.</Empty>}
      </section>
      {open && (
        <Dialog title={'Antrag ' + open.aktenzeichen} wide onClose={() => setOpen(null)}>
          <div className="stack">
            <Kv rows={[['Name', open.vorname + ' ' + open.nachname], ['Geburt', (open.geburtsdatum || '—') + (open.geburtsort ? ', ' + open.geburtsort : '')], ['Staatsangehörigkeit', open.staatsangehoerigkeit || '—'],
              ['Beruf', open.beruf || '—'], ['Anschrift', open.anschrift || '—'], ['E-Mail', open.email], ['Telefon', open.telefon || '—'], ['Seit', open.seit || '—'], ['Art', open.art || '—'],
              ['Grund', open.grund || '—'], ['Beitrag', open.beitrag || '—'], ['Vorgeschichte', open.vorgeschichte || '—'], ['Kontakt erlaubt', open.kontakt_ok ? 'ja' : 'nein'], ['Status', open.status]]} />
            <div className="row">
              {open.status !== 'angenommen' && <Btn variant="primary" onClick={() => setStatus(open, 'angenommen')}>Annehmen</Btn>}
              {open.status !== 'abgelehnt' && <Btn variant="danger" onClick={() => setStatus(open, 'abgelehnt')}>Ablehnen</Btn>}
              {open.status !== 'offen' && <Btn onClick={() => setStatus(open, 'offen')}>Wieder öffnen</Btn>}
              <Btn variant="ghost" onClick={() => del(open)}>Löschen</Btn>
            </div>
            <div className="muted small">Ein angenommener Antrag legt noch keinen Bürger an – das geschieht im Bürgerregister.</div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
