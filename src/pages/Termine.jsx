/* Termine: Anfragen annehmen/ablehnen, Notizen, Termine für Bürger anlegen */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, CLEARANCE, ALL_UNITS, canHandleAppt, displayName, unitShort } from '../lib/model.js';
import { PageHead, Btn, Badge, Empty, Msg, Corners, Field, Tabs } from '../components/ui.jsx';

const isPast = (a) => { const t = a.dateISO ? new Date(a.dateISO + 'T' + (a.time || '00:00') + ':00').getTime() : null; return t == null ? !a.upcoming : t < Date.now(); };

export default function Termine() {
  const app = useApp();
  const { me, citizens, units } = app;
  const all = app.val(KEYS.APPTS, []) || [];
  const [view, setView] = useState('pending'); const [msg, setMsg] = useState(null); const [creating, setCreating] = useState(false);
  const groups = {
    pending: all.filter((a) => a.status === 'Angefragt' && !isPast(a)),
    confirmed: all.filter((a) => a.status === 'Bestätigt' && !isPast(a)),
    past: all.filter((a) => a.status === 'Abgelehnt' || a.status === 'Storniert' || isPast(a)),
  };
  const list = groups[view].slice().sort((a, b) => String(a.dateISO || '').localeCompare(String(b.dateISO || '')) * (view === 'past' ? -1 : 1));
  async function patch(a, p, text) {
    try { await app.mutate(KEYS.APPTS, (l) => (l || []).map((x) => (x.id === a.id ? { ...x, ...p } : x)), [], text); setMsg({ ok: true, text }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  return (
    <div className="stack-lg">
      <PageHead title="Termine" sub="Alle Termine des Portals · bearbeiten darf nur die zuständige Stelle (Level 6 alle)"
        actions={(me.isAdmin || me.is >= CLEARANCE.clearance) && <Btn variant="primary" onClick={() => setCreating(!creating)}>{creating ? 'Formular schließen' : '+ Termin für Bürger'}</Btn>} />
      <Msg m={msg} />
      {creating && <CreateAppt citizens={citizens} units={units} onDone={(t) => { setCreating(false); setMsg({ ok: true, text: t }); }} />}
      <Tabs value={view} onChange={setView} options={[{ value: 'pending', label: 'Angefragt (' + groups.pending.length + ')' }, { value: 'confirmed', label: 'Bestätigt (' + groups.confirmed.length + ')' }, { value: 'past', label: 'Vergangen / Abgelehnt (' + groups.past.length + ')' }]} />
      {!list.length && <Empty>Keine Termine.</Empty>}
      <div className="stack">{list.map((a) => <ApptRow key={a.id} a={a} me={me} name={displayName(app.nameOf(a.ownerId))} onPatch={patch} />)}</div>
    </div>
  );
}

function ApptRow({ a, me, name, onPatch }) {
  const may = canHandleAppt(me, a);
  const [note, setNote] = useState(a.note || '');
  return (
    <section className="panel">
      <div className="panel-h">
        <div><h2>{a.title} — {name}</h2><div className="muted small">{a.date} · {a.time}{a.endTime ? '–' + a.endTime : ''} Uhr · {a.office} · {a.ref}</div></div>
        <div className="row">
          {a.status === 'Angefragt' && !isPast(a) ? (may ? <>
            <Btn size="sm" variant="primary" onClick={() => onPatch(a, { status: 'Bestätigt', accepted: true }, 'Termin bestätigt: ' + a.ref)}>Annehmen</Btn>
            <Btn size="sm" variant="danger" onClick={() => onPatch(a, { status: 'Abgelehnt', upcoming: false, accepted: false }, 'Termin abgelehnt: ' + a.ref)}>Ablehnen</Btn>
          </> : <span className="muted small">Nur {unitShort(a.office)} kann bearbeiten</span>)
            : <Badge tone={a.status === 'Bestätigt' ? 'ok' : a.status === 'Abgelehnt' ? 'bad' : ''}>{isPast(a) && a.status === 'Bestätigt' ? 'Erledigt' : a.status}</Badge>}
        </div>
      </div>
      <div className="panel-b stack" style={{ gap: 8 }}>
        {a.grund && <div className="small"><span className="muted">Grund des Bürgers: </span>{a.grund}</div>}
        {may ? <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz für den Bürger …" />
          <Btn size="sm" disabled={note === (a.note || '')} onClick={() => onPatch(a, { note: note.trim() }, 'Terminnotiz gespeichert: ' + a.ref)}>Notiz speichern</Btn></div>
          : a.note ? <div className="small"><span className="muted">Notiz: </span>{a.note}</div> : null}
      </div>
    </section>
  );
}

function CreateAppt({ citizens, units, onDone }) {
  const app = useApp();
  const [f, setF] = useState({ ownerId: '', office: '', other: '', date: '', from: '', to: '', note: '' });
  const [err, setErr] = useState('');
  const office = f.office === '__other__' ? f.other.trim() : f.office;
  const valid = f.ownerId && office && f.date && f.from && f.to && f.to > f.from;
  async function submit() {
    const label = new Date(f.date + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    const mk = (uid, i) => ({ id: 't' + Date.now() + '_' + i, ownerId: uid, title: office, office, date: label, dateISO: f.date, time: f.from, endTime: f.to, status: 'Bestätigt', upcoming: true, accepted: true,
      note: f.note.trim(), ref: 'MK-T-' + (1000 + (window.crypto.getRandomValues(new Uint16Array(1))[0] % 9000)), createdBy: app.me.id });
    const news = f.ownerId === '__all__' ? citizens.map((c, i) => mk(c.id, i)) : [mk(f.ownerId, 0)];
    try { const t = 'Termin angelegt: ' + office + ' am ' + label + (f.ownerId === '__all__' ? ' (alle Bürger)' : ''); await app.mutate(KEYS.APPTS, (l) => [...news, ...(l || [])], [], t); onDone(t); }
    catch (e) { setErr(e.message); }
  }
  return (
    <Corners yellow innerStyle={{ padding: 20 }}>
      <div className="stack">
        <h2>Termin anlegen (bestätigt)</h2>
        <div className="cols" style={{ gap: 12 }}>
          <div className="col-1"><Field label="Bürger"><select className="select" value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}><option value="">— wählen —</option><option value="__all__">★ Alle Bürger</option>
            {citizens.slice().sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de')).map((c) => <option key={c.id} value={c.id}>{displayName(c.name)} · {c.id}</option>)}</select></Field></div>
          <div className="col-1"><Field label="Stelle"><select className="select" value={f.office} onChange={(e) => setF({ ...f, office: e.target.value })}><option value="">— wählen —</option>
            {(units.length ? units.map((u) => u.name) : ALL_UNITS).slice().sort((a, b) => a.localeCompare(b, 'de')).map((u) => <option key={u}>{u}</option>)}<option value="__other__">Sonstiges</option></select></Field></div>
        </div>
        {f.office === '__other__' && <input className="input" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })} placeholder="Ort / Stelle" aria-label="Stelle" />}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Datum"><input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Von"><input className="input" type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="Bis"><input className="input" type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        </div>
        <textarea className="textarea" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Notiz (optional)" aria-label="Notiz" />
        {err && <Msg m={{ ok: false, text: err }} />}
        <div><Btn variant="solid" disabled={!valid} onClick={submit}>Termin anlegen</Btn></div>
      </div>
    </Corners>
  );
}
