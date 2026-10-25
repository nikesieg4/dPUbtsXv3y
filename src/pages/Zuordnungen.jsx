/* Zuordnungen: Ministerien, Organe, Ämter – Leitung, Mindest-Level, Rechte, Bereiche */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, IS_LABEL, PORTAL_NAV, normUnit, displayName } from '../lib/model.js';
import { PageHead, Btn, Badge, Panel, Msg, Field, Corners } from '../components/ui.jsx';
import CapPicker from '../components/CapPicker.jsx';

const KIND = { ministerium: 'Ministerium', organ: 'Organ', bundes: 'Bundesverwaltung' };
export default function Zuordnungen() {
  const app = useApp();
  const { units, citizens } = app;
  const [name, setName] = useState(''); const [kind, setKind] = useState('ministerium'); const [msg, setMsg] = useState(null); const [openId, setOpenId] = useState(null);
  const save = async (fn, text) => { try { await app.mutate(KEYS.UNITS, (l) => fn((l || []).map(normUnit)).map(normUnit), [], text); setMsg({ ok: true, text }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const patch = (u, p, text) => save((l) => l.map((x) => (x.id === u.id ? { ...x, ...p } : x)), text || 'Zuordnung geändert: ' + u.name);
  const members = (u) => citizens.filter((c) => c.ministries.includes(u.name));
  function add() {
    const n = name.trim();
    if (n.length < 2) return setMsg({ ok: false, text: 'Bitte einen Namen angeben.' });
    if (units.some((u) => u.name.toLowerCase() === n.toLowerCase())) return setMsg({ ok: false, text: 'Diese Zuordnung gibt es bereits.' });
    save((l) => [...l, { id: 'u' + Date.now(), name: n, kind, nav: [], autoLevel: 0 }], 'Zuordnung angelegt: ' + n); setName('');
  }
  return (
    <div className="stack-lg">
      <PageHead title="Zuordnungen" sub="Ministerien, Organe und Ämter · Rechte gelten für alle Mitglieder" />
      <Msg m={msg} />
      <Corners yellow innerStyle={{ padding: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow"><Field label="Neue Zuordnung"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Bildungsministerium" /></Field></div>
          <Field label="Art"><select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Btn variant="primary" onClick={add}>Anlegen</Btn>
        </div>
      </Corners>
      {units.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map((u) => {
        const open = openId === u.id; const ms = members(u);
        return (
          <Panel key={u.id} title={<div><h2>{u.name}</h2><div className="muted small">{KIND[u.kind]} · {ms.length} Mitglied(er) · {u.nav.length} Bereich(e){u.autoLevel ? ' · automatisch Level ' + u.autoLevel : ''}{u.boss ? ' · Leitung: ' + displayName(app.nameOf(u.boss)) : ''}</div></div>}
            actions={<><Btn size="sm" onClick={() => setOpenId(open ? null : u.id)}>{open ? 'Schließen' : 'Bearbeiten'}</Btn>
              <Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Zuordnung „' + u.name + '“ löschen? Mitglieder verlieren die hier vergebenen Rechte.')) save((l) => l.filter((x) => x.id !== u.id), 'Zuordnung gelöscht: ' + u.name); }}>Löschen</Btn></>}>
            {!open ? <div className="small muted">{ms.length ? ms.map((c) => displayName(c.name)).join(', ') : 'Keine Mitglieder.'}</div> : (
              <div className="stack">
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="grow"><Field label="Name"><input className="input" defaultValue={u.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== u.name) patch(u, { name: e.target.value.trim() }); }} /></Field></div>
                  <Field label="Art"><select className="select" value={u.kind} onChange={(e) => patch(u, { kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                  <Field label="Leitung"><select className="select" value={u.boss || ''} onChange={(e) => patch(u, { boss: e.target.value }, 'Leitung gesetzt: ' + u.name)} style={{ minWidth: 220 }}><option value="">— keine —</option>{ms.map((c) => <option key={c.id} value={c.id}>{displayName(c.name)}</option>)}</select></Field>
                  <Field label="Mindest-Level"><select className="select" value={u.autoLevel} onChange={(e) => patch(u, { autoLevel: Number(e.target.value) }, 'Mindest-Level ' + u.name + ' → ' + e.target.value)}>{[0, 1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>{l ? l + ' · ' + IS_LABEL[l] : 'keins'}</option>)}</select></Field>
                </div>
                {u.autoLevel >= 5 && <div className="msg warn">Achtung: Alle Mitglieder erhalten in der Oberfläche mindestens Level {u.autoLevel}. (Die Datenbank-Rechte richten sich weiter nach dem Profil-Level.)</div>}
                <div><div className="eyebrow" style={{ marginBottom: 6 }}>Freigegebene Bereiche im Portal</div>
                  <div className="chips">{PORTAL_NAV.map((n) => <button key={n.id} type="button" className={'chip ' + (u.nav.includes(n.id) ? 'on' : '')}
                    onClick={() => patch(u, { nav: u.nav.includes(n.id) ? u.nav.filter((x) => x !== n.id) : [...u.nav, n.id] })}>{u.nav.includes(n.id) ? '✓ ' : ''}{n.label}{n.need ? ' · L' + n.need : ''}</button>)}</div></div>
                <div><div className="eyebrow" style={{ marginBottom: 6 }}>Einzelrechte für Mitglieder</div>
                  <CapPicker value={{ allow: u.allow, deny: u.deny }} showNav={false} onChange={(v) => patch(u, { allow: v.allow, deny: v.deny }, 'Rechte geändert: ' + u.name)} /></div>
                <div className="small"><span className="muted">Mitglieder: </span>{ms.length ? ms.map((c) => displayName(c.name)).join(', ') : '—'} {ms.length > 0 && <Badge>{ms.length}</Badge>}</div>
              </div>)}
          </Panel>
        );
      })}
    </div>
  );
}
