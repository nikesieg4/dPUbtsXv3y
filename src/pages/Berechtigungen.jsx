/* Berechtigungen: Einzelrechte je Person erteilen oder entziehen */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, normPerm, displayName } from '../lib/model.js';
import { PageHead, Btn, Badge, Panel, Msg, Empty } from '../components/ui.jsx';
import CapPicker from '../components/CapPicker.jsx';

export default function Berechtigungen() {
  const app = useApp();
  const { citizens, perms } = app;
  const [q, setQ] = useState(''); const [openId, setOpenId] = useState(null); const [msg, setMsg] = useState(null); const [onlySet, setOnlySet] = useState(false);
  async function save(c, p) {
    try { await app.mutate(KEYS.PERMS, (m) => ({ ...(m || {}), [c.id]: normPerm(p) }), {}, 'Berechtigungen geändert: ' + c.name + ' (' + c.id + ')'); setMsg({ ok: true, text: 'Gespeichert: ' + displayName(c.name) }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const list = citizens.filter((c) => (!q || (displayName(c.name) + c.id).toLowerCase().includes(q.toLowerCase())) && (!onlySet || normPerm(perms[c.id]).allow.length + normPerm(perms[c.id]).deny.length > 0))
    .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de'));
  return (
    <div className="stack-lg">
      <PageHead title="Berechtigungen" sub="„Entzogen“ gilt immer – auch gegen Level und Zuordnung. Der Administrator behält stets alle Rechte." />
      <Msg m={msg} />
      <div className="filters" style={{ alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 340 }} placeholder="Name oder Bürger-Nr. …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
        <label className="check"><input type="checkbox" checked={onlySet} onChange={(e) => setOnlySet(e.target.checked)} /><span>Nur Personen mit Sonderrechten</span></label>
      </div>
      {!list.length && <Empty>Keine Treffer.</Empty>}
      {list.map((c) => {
        const p = normPerm(perms[c.id]); const open = openId === c.id;
        return (
          <Panel key={c.id} title={<div><h2>{displayName(c.name)}</h2><div className="mono small muted">{c.id} · L{c.is}</div></div>}
            actions={<>{p.allow.length > 0 && <Badge tone="ok">{p.allow.length} erteilt</Badge>}{p.deny.length > 0 && <Badge tone="bad">{p.deny.length} entzogen</Badge>}
              {!p.allow.length && !p.deny.length && <span className="muted small">Standard</span>}<Btn size="sm" onClick={() => setOpenId(open ? null : c.id)}>{open ? 'Schließen' : 'Bearbeiten'}</Btn></>}>
            {open ? <div className="stack"><CapPicker value={p} onChange={(v) => save(c, v)} />
              {(p.allow.length + p.deny.length) > 0 && <div><Btn size="sm" variant="danger" onClick={() => save(c, { allow: [], deny: [] })}>Alles auf Standard</Btn></div>}</div>
              : <div className="small muted">{[...p.allow.map((x) => '+' + x), ...p.deny.map((x) => '−' + x)].join('  ') || 'Keine Sonderrechte.'}</div>}
          </Panel>
        );
      })}
    </div>
  );
}
