/* Wahl- und Umfrage-Auswertung: echte Stimmen, Nichtwähler, Ergebnis-Anpassung (nur mit Recht) */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, can, electionPhase, voteIdx, voteAt, displayName } from '../lib/model.js';
import { fmtDT } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Panel, Empty, Msg } from '../components/ui.jsx';

export default function Auswertungen() {
  const [tab, setTab] = useState('wahlen');
  return (
    <div className="stack-lg">
      <PageHead title="Wahl- & Umfrage-Auswertung" sub="Nur echte Stimmen – Anpassungen wirken ausschließlich auf die öffentlich angezeigten Ergebnisse" />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'wahlen', label: 'Wahlen' }, { value: 'umfragen', label: 'Umfragen' }]} />
      {tab === 'wahlen' ? <Elections /> : <Surveys />}
    </div>
  );
}

function Adjust({ items, current, onSave }) {
  const [open, setOpen] = useState(false); const [v, setV] = useState({});
  if (!open) return <Btn size="sm" onClick={() => { const o = {}; items.forEach((it) => { o[it.key] = String(Number(current[it.key]) || 0); }); setV(o); setOpen(true); }}>Ergebnis anpassen</Btn>;
  return (
    <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div className="msg warn">Zusatzstimmen (auch negativ) verändern das öffentlich angezeigte Ergebnis. Die Änderung wird protokolliert.</div>
      {items.map((it) => <div key={it.key} className="list-row"><span>{it.label} <span className="muted small">(echt: {it.real})</span></span>
        <input className="input" type="number" style={{ width: 100 }} value={v[it.key]} onChange={(e) => setV({ ...v, [it.key]: e.target.value })} aria-label={'Zusatzstimmen ' + it.label} /></div>)}
      <div className="row"><Btn size="sm" variant="primary" onClick={() => { onSave(v); setOpen(false); }}>Speichern</Btn><Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Btn></div>
    </div>
  );
}

function Elections() {
  const app = useApp();
  const { citizens, me } = app; const rig = can(me, 'result.rig');
  const list = (app.val(KEYS.ELECTIONS, []) || []).slice().sort((a, b) => String(b.startsAt || '').localeCompare(String(a.startsAt || '')));
  const [msg, setMsg] = useState(null);
  const phaseL = { wahl: ['Wahl läuft', 'ok'], ankuendigung: ['Angekündigt', 'warn'], beendet: ['Beendet', ''] };
  if (!list.length) return <Empty>Keine Wahlen vorhanden.</Empty>;
  return (
    <div className="stack">
      <Msg m={msg} />
      {list.map((e) => {
        const cands = e.candidates || []; const votes = e.votes || {}; const phase = electionPhase(e);
        const entries = Object.entries(votes).map(([uid, x]) => ({ uid, cand: x.cand, at: x.at })).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        const nonVoters = citizens.filter((c) => !votes[c.id]);
        const total = entries.length || 1;
        return (
          <Panel key={e.id} title={<div><h2>Wahl: {e.office}</h2><div className="muted small">{cands.length} Kandidaturen · {fmtDT(e.startsAt)} – {fmtDT(e.endsAt)}</div></div>}
            actions={<><Badge tone={phaseL[phase][1]}>{phaseL[phase][0]}</Badge><Badge>{entries.length} Stimmen</Badge></>}>
            <div className="stack">
              {cands.map((c) => { const real = entries.filter((x) => x.cand === c.id).length; const adj = Number((e.manual || {})[c.id]) || 0; return (
                <div key={c.id}><div className="row-between small"><span>{displayName(c.name)}</span><span className="mono">{real} echt{adj ? ' · ' + (adj > 0 ? '+' : '') + adj + ' angepasst' : ''}</span></div>
                  <div className="bar"><span style={{ width: Math.round((real / total) * 100) + '%' }} /></div></div>); })}
              {entries.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Bürger</th><th>Stimme für</th><th>Zeitpunkt</th></tr></thead>
                <tbody>{entries.map((x) => <tr key={x.uid}><td>{displayName(app.nameOf(x.uid))}</td><td>{displayName((cands.find((c) => c.id === x.cand) || {}).name || '—')}</td><td className="mono small">{fmtDT(x.at)}</td></tr>)}</tbody></table></div>}
              {nonVoters.length > 0 && <div className="small muted"><strong>Noch nicht gewählt ({nonVoters.length}):</strong> {nonVoters.map((c) => displayName(c.name)).join(', ')}</div>}
              {rig && cands.length > 0 && <Adjust items={cands.map((c) => ({ key: c.id, label: displayName(c.name), real: entries.filter((x) => x.cand === c.id).length }))} current={e.manual || {}}
                onSave={async (v) => { const o = {}; cands.forEach((c) => { o[c.id] = Math.trunc(Number(v[c.id]) || 0); });
                  try { await app.mutate(KEYS.ELECTIONS, (l) => (l || []).map((x) => (x.id === e.id ? { ...x, manual: o } : x)), [], 'Wahlergebnis angepasst: ' + e.office); setMsg({ ok: true, text: 'Anpassung gespeichert.' }); } catch (err) { setMsg({ ok: false, text: err.message }); } }} />}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function Surveys() {
  const app = useApp();
  const { me } = app; const rig = can(me, 'result.rig');
  const list = app.val(KEYS.SURVEYS, []) || [];
  const [msg, setMsg] = useState(null);
  if (!list.length) return <Empty>Keine Umfragen vorhanden.</Empty>;
  return (
    <div className="stack">
      <Msg m={msg} />
      {list.map((s) => {
        const entries = Object.entries(s.votes || {}).map(([uid, v]) => ({ uid, idx: voteIdx(v), at: voteAt(v) })).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        const closed = s.endsAt && new Date(s.endsAt).getTime() <= Date.now(); const total = entries.length || 1;
        return (
          <Panel key={s.id} title={<div><h2>{s.title}</h2><div className="muted small">{s.question}{s.endsAt ? ' · endet ' + fmtDT(s.endsAt) : ''}</div></div>}
            actions={<>{closed && <Badge>Beendet</Badge>}<Badge>{entries.length} Stimmen</Badge></>}>
            <div className="stack">
              {(s.options || []).map((o, i) => { const real = entries.filter((x) => x.idx === i).length; const adj = Number((s.manual || [])[i]) || 0; return (
                <div key={i}><div className="row-between small"><span>{o}</span><span className="mono">{real} echt{adj ? ' · ' + (adj > 0 ? '+' : '') + adj + ' angepasst' : ''}</span></div>
                  <div className="bar"><span style={{ width: Math.round((real / total) * 100) + '%' }} /></div></div>); })}
              {entries.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Bürger</th><th>Antwort</th><th>Zeitpunkt</th></tr></thead>
                <tbody>{entries.map((x) => <tr key={x.uid}><td>{displayName(app.nameOf(x.uid))}</td><td>{(s.options || [])[x.idx] || '—'}</td><td className="mono small">{x.at ? fmtDT(x.at) : '—'}</td></tr>)}</tbody></table></div>}
              {rig && <Adjust items={(s.options || []).map((o, i) => ({ key: String(i), label: o, real: entries.filter((x) => x.idx === i).length }))} current={Object.fromEntries((s.manual || []).map((m, i) => [String(i), m]))}
                onSave={async (v) => { const arr = (s.options || []).map((_, i) => Math.trunc(Number(v[String(i)]) || 0));
                  try { await app.mutate(KEYS.SURVEYS, (l) => (l || []).map((x) => (x.id === s.id ? { ...x, manual: arr } : x)), [], 'Umfrageergebnis angepasst: ' + s.title); setMsg({ ok: true, text: 'Anpassung gespeichert.' }); } catch (err) { setMsg({ ok: false, text: err.message }); } }} />}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
