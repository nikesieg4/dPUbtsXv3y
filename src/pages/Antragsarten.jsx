/* Antragsarten: Vorlagen für Bewerbungen im Portal */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, CLEARANCE, manageableUnits, normType, inferUnitFromLabel } from '../lib/model.js';
import { PageHead, Btn, Badge, Input, Panel, Empty, Msg, Corners, Field } from '../components/ui.jsx';

const DEFAULT_APPTYPES = [
  { id: 'reisepass', label: 'Reisepass', questions: [] }, { id: 'personalausweis', label: 'Personalausweis', questions: [] },
  { id: 'militaer', label: 'Militärdienst', questions: ['Warum möchten Sie dem Militär beitreten?'] }, { id: 'urkunde', label: 'Urkunde', questions: [] },
];

export default function Antragsarten() {
  const app = useApp();
  const { me, units } = app;
  const full = me.isAdmin || me.is >= CLEARANCE.clearance;
  const mine = manageableUnits(me, units); const mineNames = mine.map((u) => u.name);
  const typeUnits = app.val(KEYS.TYPEUNITS, {}) || {};
  const types = (app.val(KEYS.TYPES, []) || []).map((t) => ({ ...normType(t), unit: t.unit || typeUnits[t.id] || inferUnitFromLabel(t.label, units) }))
    .filter((t) => full || mineNames.includes(t.unit)).sort((a, b) => a.label.localeCompare(b.label, 'de'));
  const [msg, setMsg] = useState(null);
  const [nf, setNf] = useState({ label: '', questions: [''], unit: '', grantOnAccept: false, cdH: 0, cdM: 0 });

  async function save(fn, text, tu) {
    try {
      await app.mutate(KEYS.TYPES, (list) => fn(Array.isArray(list) ? list : []), [], text);
      if (tu) await app.mutate(KEYS.TYPEUNITS, (m) => ({ ...(m || {}), ...tu }), {});
      setMsg({ ok: true, text });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const update = (t, patch, text) => save((list) => list.map((x) => (x.id === t.id ? normType({ ...x, ...patch }) : x)), text || 'Antragsart geändert: ' + t.label, patch.unit !== undefined ? { [t.id]: patch.unit } : null);
  async function remove(t) {
    if (!window.confirm('Antragsart „' + t.label + '“ löschen? Eingereichte Bewerbungen wandern ins Archiv.')) return;
    await save((list) => list.filter((x) => x.id !== t.id), 'Antragsart gelöscht: ' + t.label);
    try { await app.mutate(KEYS.APPS, (a) => (a || []).map((x) => (x.title === t.label && !x.archived ? { ...x, archived: true, archivedAt: Date.now(), archivedReason: 'Antragsart gelöscht' } : x)), []); } catch (e) { /* bereits gemeldet */ }
  }
  function add() {
    const id = 'at' + Date.now();
    const t = normType({ id, label: nf.label.trim(), questions: nf.questions.map((q) => q.trim()).filter(Boolean), unit: nf.unit, grantOnAccept: nf.grantOnAccept, cooldownH: Math.max(0, Number(nf.cdH) || 0), cooldownM: Math.max(0, Math.min(59, Number(nf.cdM) || 0)) });
    save((list) => [...list, t], 'Antragsart angelegt: ' + t.label, { [id]: nf.unit });
    setNf({ label: '', questions: [''], unit: '', grantOnAccept: false, cdH: 0, cdM: 0 });
  }
  return (
    <div className="stack-lg">
      <PageHead title="Antragsarten" sub="Diese Arten stehen den Bürgern bei „Neue Bewerbung“ zur Auswahl"
        actions={(me.isAdmin || me.is >= 6) && <Btn variant="danger" size="sm" onClick={() => { if (window.confirm('ALLE Antragsarten durch die Standardliste ersetzen?')) save(() => DEFAULT_APPTYPES, 'Antragsarten auf Standard zurückgesetzt'); }}>Auf Standard zurücksetzen</Btn>} />
      <Msg m={msg} />
      <div className="cols">
        <div className="col-2 stack">
          {!types.length && <Empty>Keine Antragsarten in Ihren Zuordnungen.</Empty>}
          {types.map((t) => <TypeCard key={t.id} t={t} units={full ? units : mine} onUpdate={update} onRemove={remove} />)}
        </div>
        <div className="col-1">
          <Corners yellow innerStyle={{ padding: 20 }}>
            <div className="stack">
              <h2>Neue Antragsart</h2>
              <Input label="Bezeichnung" value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} placeholder="z. B. Wohnsitzwechsel" />
              <Field label="Fragen (optional)">
                {nf.questions.map((q, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap' }}><input className="input" value={q} placeholder={'Frage ' + (i + 1)} onChange={(e) => setNf({ ...nf, questions: nf.questions.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <Btn size="sm" variant="ghost" onClick={() => setNf({ ...nf, questions: nf.questions.length > 1 ? nf.questions.filter((_, j) => j !== i) : [''] })} aria-label="Frage entfernen">✕</Btn></div>)}
                <Btn size="sm" variant="ghost" onClick={() => setNf({ ...nf, questions: [...nf.questions, ''] })}>+ Weitere Frage</Btn>
              </Field>
              <Field label="Zuständige Zuordnung"><select className="select" value={nf.unit} onChange={(e) => setNf({ ...nf, unit: e.target.value })}><option value="">— wählen —</option>{(full ? units : mine).slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Field>
              <label className="check"><input type="checkbox" checked={nf.grantOnAccept} onChange={(e) => setNf({ ...nf, grantOnAccept: e.target.checked })} /><span>Bei Bewilligung automatisch der Zuordnung hinzufügen</span></label>
              <div className="row" style={{ flexWrap: 'nowrap' }}><Input label="Sperrzeit Std." type="number" min="0" value={nf.cdH} onChange={(e) => setNf({ ...nf, cdH: e.target.value })} /><Input label="Min." type="number" min="0" max="59" value={nf.cdM} onChange={(e) => setNf({ ...nf, cdM: e.target.value })} /></div>
              <Btn variant="solid" disabled={nf.label.trim().length < 2 || !nf.unit} onClick={add}>Antragsart hinzufügen</Btn>
            </div>
          </Corners>
        </div>
      </div>
    </div>
  );
}

function TypeCard({ t, units, onUpdate, onRemove }) {
  const [nq, setNq] = useState('');
  const qs = t.questions || [];
  return (
    <Panel title={<div className="row"><h2>{t.label}</h2><Badge tone={qs.length ? 'amber' : ''}>{qs.length} Fragen</Badge>{!t.unit && <Badge tone="warn">ohne Zuordnung</Badge>}</div>}
      actions={<Btn size="sm" variant="danger" onClick={() => onRemove(t)}>Löschen</Btn>}>
      <div className="stack" style={{ gap: 10 }}>
        {qs.map((q, i) => <div key={i} className="list-row"><span><strong>{i + 1}.</strong> {q}</span><Btn size="sm" variant="ghost" onClick={() => onUpdate(t, { questions: qs.filter((_, j) => j !== i) })} aria-label="Frage entfernen">✕</Btn></div>)}
        <div className="row" style={{ flexWrap: 'nowrap' }}><input className="input" value={nq} onChange={(e) => setNq(e.target.value)} placeholder="Frage hinzufügen …" onKeyDown={(e) => { if (e.key === 'Enter' && nq.trim()) { onUpdate(t, { questions: [...qs, nq.trim()] }); setNq(''); } }} />
          <Btn size="sm" disabled={!nq.trim()} onClick={() => { onUpdate(t, { questions: [...qs, nq.trim()] }); setNq(''); }}>+ Frage</Btn></div>
        <div className="row">
          <label className="field" style={{ flex: '1 1 240px' }}>Zuordnung<select className="select" value={t.unit || ''} onChange={(e) => onUpdate(t, { unit: e.target.value })}><option value="">— keine —</option>{units.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></label>
          <label className="field" style={{ width: 110 }}>Sperre Std.<input className="input" type="number" min="0" value={t.cooldownH || 0} onChange={(e) => onUpdate(t, { cooldownH: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <label className="field" style={{ width: 110 }}>Min.<input className="input" type="number" min="0" max="59" value={t.cooldownM || 0} onChange={(e) => onUpdate(t, { cooldownM: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={!!t.grantOnAccept} onChange={(e) => onUpdate(t, { grantOnAccept: e.target.checked })} /><span>Bei Bewilligung automatisch der Zuordnung hinzufügen</span></label>
      </div>
    </Panel>
  );
}
