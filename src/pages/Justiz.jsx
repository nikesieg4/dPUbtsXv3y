/* Justiz & Polizei: Führungszeugnisse (mit Sichtbarkeitsstufen) und Haftbefehle */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, REDACT_TIERS, tierRank, viewerRank, clampTier, redact, isJusticeOfficer, canSeeRecords, canDeleteRecord, displayName } from '../lib/model.js';
import { fmtD, fmtDT } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Empty, Msg, Panel, Field, Corners } from '../components/ui.jsx';

export default function Justiz() {
  const [tab, setTab] = useState('records');
  const { val } = useApp();
  const pending = (val(KEYS.WARRANTS, []) || []).filter((w) => w.status === 'beantragt').length;
  return (
    <div className="stack-lg">
      <PageHead title="Justiz & Polizei" sub="Führungszeugnisse mit Schwärzung nach Stufe · Haftbefehle mit Genehmigungspflicht" />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'records', label: 'Führungszeugnisse' }, { value: 'warrants', label: 'Haftbefehle' + (pending ? ' (' + pending + ')' : '') }]} />
      {tab === 'records' ? <Records /> : <Warrants />}
    </div>
  );
}

function Records() {
  const app = useApp();
  const { me, citizens, units } = app;
  const rank = viewerRank(me); const officer = isJusticeOfficer(me); const mayDelete = canDeleteRecord(me, units);
  const tiers = REDACT_TIERS.filter((t) => t.rank <= rank);
  const records = (app.val(KEYS.RECORDS, []) || []).filter((r) => officer || r.released);
  const [q, setQ] = useState(''); const [newFor, setNewFor] = useState(''); const [msg, setMsg] = useState(null); const [openId, setOpenId] = useState(null);
  const save = async (fn, text) => { try { await app.mutate(KEYS.RECORDS, (l) => fn(l || []), [], text); setMsg({ ok: true, text }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const list = records.filter((r) => (r.citizenName + r.citizenId).toLowerCase().includes(q.toLowerCase())).sort((a, b) => displayName(a.citizenName).localeCompare(displayName(b.citizenName), 'de'));
  function create() {
    if (records.some((r) => r.citizenId === newFor)) { setMsg({ ok: false, text: 'Für diese Person besteht bereits ein Führungszeugnis.' }); return; }
    const c = citizens.find((x) => x.id === newFor);
    save((l) => [{ id: 'fz' + Date.now(), citizenId: newFor, citizenName: c ? c.name : newFor, createdAt: Date.now(), createdBy: me.id, released: false, entries: [] }, ...l], 'Führungszeugnis angelegt: ' + newFor);
    setNewFor('');
  }
  return (
    <div className="stack">
      <Msg m={msg} />
      <div className="filters">
        <Field label="Suche"><input className="input" style={{ width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        {officer && <><Field label="Neues Führungszeugnis für"><select className="select" value={newFor} onChange={(e) => setNewFor(e.target.value)} style={{ minWidth: 260 }}><option value="">— Person wählen —</option>
          {citizens.filter((c) => !records.some((r) => r.citizenId === c.id)).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de')).map((c) => <option key={c.id} value={c.id}>{displayName(c.name)} · {c.id}</option>)}</select></Field>
          <Btn variant="primary" disabled={!newFor} onClick={create}>Anlegen</Btn></>}
        <span className="muted small">Ihre Sichtstufe: {(REDACT_TIERS.find((t) => t.rank === rank) || { label: '—' }).label}</span>
      </div>
      {!list.length && <Empty>Keine Führungszeugnisse.</Empty>}
      {list.map((r) => {
        const open = openId === r.id;
        const entries = (r.entries || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        return (
          <Panel key={r.id} title={<div><h2>{displayName(r.citizenName)}</h2><div className="muted small mono">{r.citizenId} · {entries.length} Eintragung(en) · angelegt {fmtD(r.createdAt)}</div></div>}
            actions={<>
              <Badge tone={r.released ? 'ok' : ''}>{r.released ? 'Für Polizei freigegeben' : 'Intern'}</Badge>
              {officer && <Btn size="sm" onClick={() => save((l) => l.map((x) => (x.id === r.id ? { ...x, released: !r.released, releasedAt: !r.released ? Date.now() : null, releasedBy: !r.released ? me.id : null } : x)), (r.released ? 'Freigabe zurückgezogen: ' : 'Führungszeugnis freigegeben: ') + r.citizenId)}>{r.released ? 'Freigabe zurückziehen' : 'Freigeben'}</Btn>}
              <Btn size="sm" onClick={() => setOpenId(open ? null : r.id)}>{open ? 'Schließen' : 'Öffnen'}</Btn>
              {mayDelete && <Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Führungszeugnis mit allen Eintragungen endgültig löschen?')) save((l) => l.filter((x) => x.id !== r.id), 'Führungszeugnis gelöscht: ' + r.citizenId); }}>Löschen</Btn>}
            </>}>
            {!open ? <div className="muted small">Zum Ansehen öffnen.</div> : (
              <div className="stack">
                {!entries.length && <Empty>Keine Eintragungen.</Empty>}
                {entries.map((e) => <Entry key={e.id} e={e} rank={rank} tiers={tiers} canEdit={officer && rank >= tierRank(e.tier || 'alle')}
                  onUpdate={(p) => save((l) => l.map((x) => (x.id !== r.id ? x : { ...x, entries: (x.entries || []).map((y) => (y.id === e.id ? { ...y, ...p } : y)) })), 'Eintrag geändert: ' + r.citizenId)}
                  onRemove={() => { if (window.confirm('Eintrag löschen?')) save((l) => l.map((x) => (x.id !== r.id ? x : { ...x, entries: (x.entries || []).filter((y) => y.id !== e.id) })), 'Eintrag gelöscht: ' + r.citizenId); }} />)}
                {officer && <AddEntry tiers={tiers} onAdd={(d) => save((l) => l.map((x) => (x.id !== r.id ? x : { ...x, entries: [...(x.entries || []), { id: 'e' + Date.now(), date: d.date, title: d.title, detail: d.detail, tier: clampTier(me, d.tier), by: me.id, at: Date.now() }] })), 'Eintrag hinzugefügt: ' + r.citizenId)} />}
              </div>)}
          </Panel>
        );
      })}
    </div>
  );
}

function Entry({ e, rank, tiers, canEdit, onUpdate, onRemove }) {
  const hidden = rank < tierRank(e.tier || 'alle');
  const partial = Object.keys(e.markTitle || {}).length || Object.keys(e.markDetail || {}).length;
  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <div className="grow">
        <div className="muted small mono">{e.date || '—'} · Stufe: {(REDACT_TIERS.find((t) => t.key === (e.tier || 'alle')) || {}).label}</div>
        <div style={{ fontWeight: 600 }}>{redact(e.title, e.markTitle, rank, e.tier)}</div>
        {e.detail && <div className="small" style={{ color: 'var(--text-2)' }}>{redact(e.detail, e.markDetail, rank, e.tier)}</div>}
        {(hidden || partial) ? <Badge>{hidden ? 'Vollständig geschwärzt' : 'Teilweise geschwärzt'}</Badge> : null}
      </div>
      {canEdit && <div className="row">
        <select className="select" style={{ width: 230 }} value={e.tier || 'alle'} onChange={(ev) => onUpdate({ tier: ev.target.value })} aria-label="Sichtbarkeit">{tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        <Btn size="sm" variant="danger" onClick={onRemove}>Löschen</Btn></div>}
    </div>
  );
}
function AddEntry({ tiers, onAdd }) {
  const [d, setD] = useState({ date: '', title: '', detail: '', tier: 'alle' });
  return (
    <Corners innerStyle={{ padding: 14 }}>
      <div className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Datum"><input className="input" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
          <div className="grow"><Field label="Betreff"><input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="z. B. Verwarnung" /></Field></div>
          <Field label="Sichtbar für"><select className="select" value={d.tier} onChange={(e) => setD({ ...d, tier: e.target.value })}>{tiers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
        </div>
        <textarea className="textarea" rows={2} value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })} placeholder="Sachverhalt (optional)" aria-label="Sachverhalt" />
        <div><Btn variant="primary" size="sm" disabled={!d.title.trim()} onClick={() => { onAdd({ ...d, title: d.title.trim(), detail: d.detail.trim() }); setD({ date: '', title: '', detail: '', tier: 'alle' }); }}>Eintrag hinzufügen</Btn></div>
      </div>
    </Corners>
  );
}

const W_ST = { beantragt: ['Beantragt', 'warn'], offen: ['Offen', 'bad'], vollstreckt: ['Vollstreckt', 'ok'], abgelehnt: ['Abgelehnt', ''] };
function Warrants() {
  const app = useApp();
  const { me, citizens } = app;
  const officer = isJusticeOfficer(me); const see = canSeeRecords(me);
  const warrants = app.val(KEYS.WARRANTS, []) || [];
  const [showDone, setShowDone] = useState(false); const [f, setF] = useState({ citizenId: '', reason: '' }); const [msg, setMsg] = useState(null);
  const save = async (fn, text) => { try { await app.mutate(KEYS.WARRANTS, (l) => fn(l || []), [], text); setMsg({ ok: true, text }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const by = me.isAdmin ? 'Administrator' : me.name;
  function request() {
    const c = citizens.find((x) => x.id === f.citizenId);
    save((l) => [{ id: 'hb' + Date.now(), citizenId: f.citizenId, citizenName: c ? c.name : f.citizenId, reason: f.reason.trim(), requestedBy: me.id, requestedByName: by, at: Date.now(),
      status: officer ? 'offen' : 'beantragt', approvedBy: officer ? me.id : null, approvedByName: officer ? by : null, approvedAt: officer ? Date.now() : null }, ...l], (officer ? 'Haftbefehl erlassen: ' : 'Haftbefehl beantragt: ') + f.citizenId);
    setF({ citizenId: '', reason: '' });
  }
  async function execute(w) {
    if (!window.confirm('Haftbefehl gegen ' + displayName(w.citizenName) + ' als vollstreckt markieren? Die Inhaftierung wird ins Führungszeugnis eingetragen.')) return;
    const now = Date.now();
    try {
      await app.mutate(KEYS.WARRANTS, (l) => (l || []).map((x) => (x.id === w.id ? { ...x, status: 'vollstreckt', executedBy: me.id, executedByName: by, executedAt: now } : x)), [], 'Haftbefehl vollstreckt: ' + w.citizenId);
      const entry = { id: 'e' + now, date: new Date(now).toISOString().slice(0, 10), title: 'Inhaftierung', tier: 'alle', by: me.id, at: now, fromWarrant: w.id,
        detail: 'Die Person wurde inhaftiert. Der Haftbefehl wegen „' + w.reason + '“ wurde von ' + displayName(by) + ' vollstreckt.' + (w.approvedByName ? ' Genehmigt durch ' + displayName(w.approvedByName) + '.' : '') };
      await app.mutate(KEYS.RECORDS, (l) => {
        const list = l || []; const ex = list.find((r) => r.citizenId === w.citizenId);
        return ex ? list.map((r) => (r.id === ex.id ? { ...r, entries: [...(r.entries || []), entry] } : r))
          : [{ id: 'fz' + now, citizenId: w.citizenId, citizenName: w.citizenName, createdAt: now, createdBy: me.id, released: true, entries: [entry] }, ...list];
      }, []);
      setMsg({ ok: true, text: 'Vollstreckt und im Führungszeugnis vermerkt.' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const list = warrants.filter((w) => showDone || w.status === 'beantragt' || w.status === 'offen');
  return (
    <div className="stack">
      <Msg m={msg} />
      {see && <div className="filters">
        <Field label="Person"><select className="select" style={{ minWidth: 260 }} value={f.citizenId} onChange={(e) => setF({ ...f, citizenId: e.target.value })}><option value="">— wählen —</option>
          {citizens.slice().sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de')).map((c) => <option key={c.id} value={c.id}>{displayName(c.name)} · {c.id}</option>)}</select></Field>
        <div className="grow"><Field label="Grund"><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field></div>
        <Btn variant="primary" disabled={!f.citizenId || !f.reason.trim()} onClick={request}>{officer ? 'Haftbefehl erlassen' : 'Beantragen'}</Btn>
      </div>}
      <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /><span>Erledigte (vollstreckt / abgelehnt) anzeigen</span></label>
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 900 }}>
          <thead><tr>{['Person', 'Grund', 'Beantragt', 'Genehmigt', 'Status', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{list.map((w) => (
            <tr key={w.id} className={w.status === 'offen' ? 'row-bad' : w.status === 'beantragt' ? 'row-warn' : ''}>
              <td><strong>{displayName(w.citizenName)}</strong><div className="mono small muted">{w.citizenId}</div></td><td>{w.reason}</td>
              <td className="small">{w.requestedByName ? displayName(w.requestedByName) : '—'}<div className="muted">{fmtDT(w.at)}</div></td>
              <td className="small">{w.approvedByName ? displayName(w.approvedByName) : '—'}{w.approvedAt && <div className="muted">{fmtDT(w.approvedAt)}</div>}</td>
              <td><Badge tone={(W_ST[w.status] || [])[1]}>{(W_ST[w.status] || [w.status])[0]}</Badge></td>
              <td><div className="row" style={{ gap: 6 }}>
                {w.status === 'beantragt' && officer && <><Btn size="sm" variant="primary" onClick={() => save((l) => l.map((x) => (x.id === w.id ? { ...x, status: 'offen', approvedBy: me.id, approvedByName: by, approvedAt: Date.now() } : x)), 'Haftbefehl genehmigt: ' + w.citizenId)}>Genehmigen</Btn>
                  <Btn size="sm" variant="danger" onClick={() => save((l) => l.map((x) => (x.id === w.id ? { ...x, status: 'abgelehnt', approvedBy: me.id, approvedByName: by, approvedAt: Date.now() } : x)), 'Haftbefehl abgelehnt: ' + w.citizenId)}>Ablehnen</Btn></>}
                {w.status === 'offen' && see && <Btn size="sm" onClick={() => execute(w)}>Vollstreckt</Btn>}
                {officer && <Btn size="sm" variant="ghost" onClick={() => { if (window.confirm('Haftbefehl löschen?')) save((l) => l.filter((x) => x.id !== w.id), 'Haftbefehl gelöscht: ' + w.citizenId); }}>Löschen</Btn>}
              </div></td>
            </tr>))}</tbody>
        </table>
        {!list.length && <Empty>Keine offenen Haftbefehle.</Empty>}
      </section>
    </div>
  );
}
