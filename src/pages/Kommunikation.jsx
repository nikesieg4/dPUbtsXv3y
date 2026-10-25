/* Kommunikation: Chat-Überwachung, Support-Tickets, Feedback, Ankündigungen */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { KEYS, can, displayName } from '../lib/model.js';
import { ABIS_NAME } from '../config.js';
import { fmtDT } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Panel, Empty, Msg, Input, Textarea } from '../components/ui.jsx';

function isAgent(me) {
  if (me.deny.includes('support.agent')) return false;
  if (me.allow.includes('support.agent')) return true;
  return me.isAdmin || me.ministries.includes(ABIS_NAME);
}

export default function Kommunikation() {
  const { me } = useApp();
  const tabs = [
    can(me, 'chat.all') && { value: 'chat', label: 'Chat-Überwachung' },
    isAgent(me) && { value: 'support', label: 'Support-Tickets' },
    can(me, 'feedback.view') && { value: 'feedback', label: 'Feedback' },
    can(me, 'announce.post') && { value: 'announce', label: 'Ankündigungen' },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0] ? tabs[0].value : '');
  return (
    <div className="stack-lg">
      <PageHead title="Kommunikation" sub="Chats, Support und Bekanntmachungen des Bürgerportals" />
      {!tabs.length ? <Empty>Für keinen Kommunikationsbereich freigeschaltet.</Empty> : <>
        <Tabs value={tab} onChange={setTab} options={tabs} />
        {tab === 'chat' && <Chat />}{tab === 'support' && <Support />}{tab === 'feedback' && <Feedback />}{tab === 'announce' && <Announce />}
      </>}
    </div>
  );
}

function Chat() {
  const app = useApp();
  const chat = app.val(KEYS.CHAT, { channels: [] }) || { channels: [] };
  const channels = (chat.channels || []).slice().sort((a, b) => (b.messages || []).length - (a.messages || []).length);
  const [sel, setSel] = useState(channels[0] ? channels[0].id : null); const [q, setQ] = useState(''); const [msg, setMsg] = useState(null);
  const ch = channels.find((c) => c.id === sel);
  const mayDelete = can(app.me, 'chat.delete');
  const hits = q.trim() ? channels.flatMap((c) => (c.messages || []).filter((m) => String(m.text).toLowerCase().includes(q.toLowerCase())).map((m) => ({ ...m, ch: c }))) : null;
  async function del(cid, mid) {
    if (!window.confirm('Nachricht löschen?')) return;
    try { await app.mutate(KEYS.CHAT, (d) => ({ ...(d || {}), channels: ((d && d.channels) || []).map((c) => (c.id === cid ? { ...c, messages: (c.messages || []).filter((m) => m.id !== mid) } : c)) }), { channels: [] }, 'Chatnachricht gelöscht (' + cid + ')'); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const Line = ({ m, cid }) => (
    <li className="list-row" style={{ alignItems: 'flex-start' }}>
      <div className="grow"><div className="small"><strong>{displayName(app.nameOf(m.from))}</strong> <span className="muted mono">{fmtDT(m.at)}</span></div><div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div></div>
      {mayDelete && <Btn size="sm" variant="ghost" onClick={() => del(cid, m.id)} aria-label="Nachricht löschen">✕</Btn>}
    </li>
  );
  return (
    <div className="stack">
      <Msg m={msg} />
      <input className="input" style={{ maxWidth: 380 }} placeholder="Alle Chats durchsuchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chats durchsuchen" />
      {hits ? <Panel title={hits.length + ' Treffer'}>{!hits.length ? <Empty>Nichts gefunden.</Empty> : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{hits.slice(0, 200).map((m) => <div key={m.ch.id + m.id}><div className="eyebrow">{m.ch.name || m.ch.id}</div><Line m={m} cid={m.ch.id} /></div>)}</ul>}</Panel> : (
        <div className="cols">
          <div className="col-1" style={{ maxWidth: 340 }}>
            <section className="panel">{channels.map((c) => (
              <button key={c.id} type="button" className={'nav-item ' + (sel === c.id ? 'active' : '')} style={{ margin: 0, borderWidth: 0, borderBottom: '1px solid var(--line)' }} onClick={() => setSel(c.id)}>
                <span>{c.type === 'public' ? c.name || 'Öffentlich' : c.name || (c.members || []).map((m) => displayName(app.nameOf(m)).split(',')[0]).join(', ')}</span>
                <span className="mono small">{(c.messages || []).length}</span></button>))}</section>
          </div>
          <div className="col-2">
            {ch ? <Panel title={<div><h2>{ch.name || 'Privater Chat'}</h2><div className="muted small">{ch.type === 'public' ? 'Öffentlich' : 'Privat · ' + (ch.members || []).map((m) => displayName(app.nameOf(m))).join(' · ')}</div></div>}>
              {!(ch.messages || []).length ? <Empty>Keine Nachrichten.</Empty> : <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 600, overflowY: 'auto' }}>{(ch.messages || []).slice().reverse().map((m) => <Line key={m.id} m={m} cid={ch.id} />)}</ul>}
            </Panel> : <Empty>Kein Chat gewählt.</Empty>}
          </div>
        </div>)}
    </div>
  );
}

function Support() {
  const app = useApp();
  const tickets = ((app.val(KEYS.SUPPORT, { tickets: [] }) || {}).tickets || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const [sel, setSel] = useState(null); const [text, setText] = useState(''); const [msg, setMsg] = useState(null);
  const t = tickets.find((x) => x.id === sel);
  const save = async (fn, log) => { try { await app.mutate(KEYS.SUPPORT, (d) => ({ ...(d || {}), tickets: fn(((d && d.tickets) || [])) }), { tickets: [] }, log); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  const send = () => { const tt = text.trim(); if (!tt) return; save((l) => l.map((x) => (x.id === t.id ? { ...x, messages: [...(x.messages || []), { id: 'sm' + Date.now(), from: app.me.id, text: tt, at: Date.now() }] } : x)), 'Support-Antwort: ' + t.subject); setText(''); };
  return (
    <div className="cols">
      <div className="col-1" style={{ maxWidth: 380 }}>
        <section className="panel">{!tickets.length ? <Empty>Keine Tickets.</Empty> : tickets.map((x) => (
          <button key={x.id} type="button" className={'nav-item ' + (sel === x.id ? 'active' : '')} style={{ margin: 0, borderWidth: 0, borderBottom: '1px solid var(--line)', display: 'block', textTransform: 'none', letterSpacing: '0.02em' }} onClick={() => setSel(x.id)}>
            <div className="row-between"><strong>{x.subject}</strong><Badge tone={x.status === 'offen' ? 'warn' : ''}>{x.status}</Badge></div>
            <div className="muted small">{displayName(app.nameOf(x.ownerId))} · {fmtDT(x.createdAt)}</div></button>))}</section>
      </div>
      <div className="col-2">
        <Msg m={msg} />
        {!t ? <Empty>Ticket auswählen.</Empty> : (
          <Panel title={<div><h2>{t.subject}</h2><div className="muted small">{displayName(app.nameOf(t.ownerId))} · {fmtDT(t.createdAt)}</div></div>}
            actions={<><select className="select" style={{ width: 170 }} value={t.status} onChange={(e) => save((l) => l.map((x) => (x.id === t.id ? { ...x, status: e.target.value } : x)), 'Ticketstatus ' + e.target.value + ': ' + t.subject)} aria-label="Status">
              {[...new Set(['offen', 'in Bearbeitung', 'erledigt', 'geschlossen', t.status].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select>
              {can(app.me, 'support.delete') && <Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Ticket vollständig löschen?')) { save((l) => l.filter((x) => x.id !== t.id), 'Support-Ticket gelöscht: ' + t.subject); setSel(null); } }}>Löschen</Btn>}</>}>
            <ul className="log" style={{ letterSpacing: '0.04em' }}>{(t.messages || []).map((m) => <li key={m.id} className={m.from === t.ownerId ? '' : 'warn'}>{displayName(app.nameOf(m.from))}: {m.text}<span className="t">{fmtDT(m.at)}</span></li>)}</ul>
            <div className="stack" style={{ marginTop: 12, gap: 8 }}><Textarea label="Antwort" value={text} onChange={(e) => setText(e.target.value)} /><div><Btn variant="primary" disabled={!text.trim()} onClick={send}>Senden</Btn></div></div>
          </Panel>)}
      </div>
    </div>
  );
}

function Feedback() {
  const app = useApp();
  const list = (app.val(KEYS.FEATURES, []) || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  const save = (fn, log) => app.mutate(KEYS.FEATURES, (l) => fn(l || []), [], log);
  if (!list.length) return <Empty>Kein Feedback eingegangen.</Empty>;
  return (
    <div className="stack">{list.map((f) => (
      <Panel key={f.id} title={<div><h2>{f.title}</h2><div className="muted small">{f.byName || app.nameOf(f.by)} · {fmtDT(f.at)}</div></div>}
        actions={<><select className="select" style={{ width: 160 }} value={f.status || 'offen'} onChange={(e) => save((l) => l.map((x) => (x.id === f.id ? { ...x, status: e.target.value } : x)), 'Feedback ' + e.target.value + ': ' + f.title)} aria-label="Status">
          {[...new Set(['offen', 'geplant', 'umgesetzt', 'abgelehnt', f.status].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select>
          <Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Feedback löschen?')) save((l) => l.filter((x) => x.id !== f.id), 'Feedback gelöscht: ' + f.title); }}>Löschen</Btn></>}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{f.text}</div>
      </Panel>))}</div>
  );
}

function Announce() {
  const app = useApp();
  const list = app.val(KEYS.ANNOUNCE, []) || [];
  const [title, setTitle] = useState(''); const [text, setText] = useState(''); const [msg, setMsg] = useState(null);
  async function post() {
    const a = { id: 'an' + Date.now(), title: title.trim(), text: text.trim(), by: app.me.id, byName: app.me.isAdmin ? 'Administrator' : app.me.name, at: Date.now() };
    try { await app.mutate(KEYS.ANNOUNCE, (l) => [a, ...(l || [])], [], 'Ankündigung veröffentlicht: ' + a.title); setTitle(''); setText(''); setMsg({ ok: true, text: 'Veröffentlicht.' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  return (
    <div className="cols">
      <div className="col-1"><Panel title="Neue Ankündigung" className="y">
        <div className="stack"><Input label="Titel" value={title} onChange={(e) => setTitle(e.target.value)} /><Textarea label="Text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <Msg m={msg} /><div><Btn variant="solid" disabled={!title.trim() || !text.trim()} onClick={post}>Veröffentlichen</Btn></div></div></Panel></div>
      <div className="col-2 stack">{!list.length ? <Empty>Keine Ankündigungen.</Empty> : list.map((a) => (
        <Panel key={a.id} title={<div><h2>{a.title}</h2><div className="muted small">{a.byName} · {fmtDT(a.at)}</div></div>}
          actions={<Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Ankündigung entfernen?')) app.mutate(KEYS.ANNOUNCE, (l) => (l || []).filter((x) => x.id !== a.id), [], 'Ankündigung entfernt: ' + a.title); }}>Entfernen</Btn>}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{a.text}</div></Panel>))}</div>
    </div>
  );
}
