/* Bankmanagement (Level 6): Konten, Buchen, Dauerzahlungen, Steuern, Integrität */
import React, { useEffect, useRef, useState } from 'react';
import { Bank as B, Monitor, newKey } from '../lib/db.js';
import { useApp } from '../lib/state.jsx';
import { fmtM, fmtMinor, fmtD, fmtT, fmtDT, fmtDay, fmtRate, parseMinor, uuidOk, berlinToday, buildCsv, downloadText, PAY_TYPE_LABEL, SO_INTERVAL, SO_STATUS, SO_RUN } from '../lib/format.js';
import { PageHead, Tabs, Btn, Badge, Field, Input, Select, Pager, Empty, Uuid, Dialog, Kv, Msg, Secret, Panel, Stat, Corners } from '../components/ui.jsx';
import { Journal, TxDetail, StatusBadge } from '../components/bank.jsx';

export default function Bank() {
  const [tab, setTab] = useState('accounts');
  const [jAcc, setJAcc] = useState(''); const [mAcc, setMAcc] = useState('');
  const [detail, setDetail] = useState(null); const [tick, setTick] = useState(0);
  return (
    <div className="stack-lg">
      <PageHead title="Bankmanagement" sub="Maisdollar · alle Vorgänge laufen über geprüfte Server-Funktionen und werden im Audit-Log festgehalten" />
      <Tabs value={tab} onChange={setTab} options={[{ value: 'accounts', label: 'Konten' }, { value: 'money', label: 'Geld buchen' }, { value: 'recurring', label: 'Dauerzahlungen' },
        { value: 'journal', label: 'Journal' }, { value: 'tax', label: 'Steuern' }, { value: 'system', label: 'Integrität' }]} />
      {tab === 'accounts' && <Accounts onJournal={(id) => { setJAcc(id); setTab('journal'); }} onMoney={(id) => { setMAcc(id); setTab('money'); }} />}
      {tab === 'money' && <Money key={mAcc} prefill={mAcc} />}
      {tab === 'recurring' && <Recurring />}
      {tab === 'journal' && <Journal key={jAcc} initialAccount={jAcc} onOpen={setDetail} refreshKey={tick} />}
      {tab === 'tax' && <Tax onOpen={setDetail} />}
      {tab === 'system' && <Integrity />}
      {detail && <TxDetail id={detail} onClose={() => setDetail(null)} onChanged={() => setTick((x) => x + 1)} />}
    </div>
  );
}

/* ---------- Konten ---------- */
const ST = { active: ['Aktiv', 'ok'], blocked: ['Gesperrt', 'bad'], closed: ['Stillgelegt', ''] };
function Accounts({ onJournal, onMoney }) {
  const PAGE = 20; const [q, setQ] = useState(''); const [st, setSt] = useState(''); const [ty, setTy] = useState(''); const [page, setPage] = useState(0);
  const [data, setData] = useState({ rows: [], total: 0 }); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const [detail, setDetail] = useState(null); const [creating, setCreating] = useState(false); const seq = useRef(0);
  async function load() {
    const mine = ++seq.current; setBusy(true);
    const r = await B.call('bank_admin_accounts', { p_search: q || null, p_status: st || null, p_limit: PAGE, p_offset: page * PAGE, p_type: ty || null });
    if (mine !== seq.current) return;
    setBusy(false); if (r.ok) setData({ rows: r.rows || [], total: Number(r.total) || 0 }); else setMsg({ ok: false, text: r.message });
  }
  useEffect(() => { load(); }, [page, st, ty]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack">
      <div className="filters">
        <Field label="Suche (UUID, Name, ID, Kennung)"><input className="input" style={{ width: 300 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (page) setPage(0); else load(); } }} /></Field>
        <Field label="Kontotyp"><select className="select" value={ty} onChange={(e) => { setTy(e.target.value); setPage(0); }}><option value="">Alle</option><option value="citizen">Bürgerkonten</option><option value="standalone">Eigenständige</option></select></Field>
        <Field label="Status"><select className="select" value={st} onChange={(e) => { setSt(e.target.value); setPage(0); }}><option value="">Alle</option><option value="active">Aktiv</option><option value="blocked">Gesperrt</option><option value="closed">Stillgelegt</option></select></Field>
        <Btn variant="primary" onClick={() => { if (page) setPage(0); else load(); }}>Suchen</Btn>
        <Btn onClick={() => setCreating(true)}>+ Neues Bankkonto</Btn>
      </div>
      <Msg m={msg} />
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 1000 }}>
          <thead><tr>{['Kontoinhaber', 'Typ', 'Bürger-/interne ID', 'Konto-UUID', 'Kontostand', 'Status', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{data.rows.map((a) => (
            <tr key={a.id} className={a.status === 'blocked' ? 'row-bad' : ''}>
              <td><strong>{a.name || '—'}</strong>{a.login_identifier && <div className="mono small muted">{a.login_identifier}</div>}</td>
              <td>{a.account_type === 'system' ? <Badge tone="amber">System</Badge> : a.account_type === 'standalone' ? <Badge tone="info">Eigenständig</Badge> : <Badge>Bürger</Badge>}</td>
              <td className="mono small">{a.citizen_id || '—'}</td><td><Uuid id={a.id} /></td>
              <td className="num mono" style={{ fontWeight: 600 }}>{fmtM(a.balance_minor)}</td>
              <td><Badge tone={(ST[a.status] || [])[1]}>{(ST[a.status] || [a.status])[0]}</Badge></td>
              <td><div className="row" style={{ gap: 6 }}>
                <Btn size="sm" onClick={() => setDetail(a.id)}>Details</Btn><Btn size="sm" onClick={() => onJournal(a.id)}>Verlauf</Btn>
                {a.kind === 'user' && a.status === 'active' && <Btn size="sm" onClick={() => onMoney(a.id)}>Buchen</Btn>}
              </div></td>
            </tr>))}</tbody>
        </table>
        {!busy && !data.rows.length && <Empty>Keine Konten gefunden.</Empty>}
        {busy && <Empty>Lädt …</Empty>}
      </section>
      <Pager page={page} total={data.total} size={PAGE} onPage={setPage} />
      {detail && <AccountDetail id={detail} onClose={() => setDetail(null)} onChanged={load} onJournal={(id) => { setDetail(null); onJournal(id); }} />}
      {creating && <CreateStandalone onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

function AccountDetail({ id, onClose, onChanged, onJournal }) {
  const app = useApp();
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [secret, setSecret] = useState(null);
  const [edit, setEdit] = useState({ name: '', ext: '', cat: '', desc: '' }); const [newPw, setNewPw] = useState(''); const [orders, setOrders] = useState([]);
  const lock = useRef(false);
  async function load() {
    const r = await B.call('bank_admin_account_detail', { p_account: id });
    if (r.ok) { setD(r); setEdit({ name: r.account.owner_name || '', ext: r.account.external_id || '', cat: r.account.category || '', desc: r.account.description || '' }); }
    else setErr(r.message || 'Nicht geladen.');
  }
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const a = d && d.account, cr = d && d.credentials, standalone = a && a.account_type === 'standalone';
  const ok5 = reason.trim().length >= 5;
  async function run(fn, args, okText) {
    if (lock.current) return null; lock.current = true;
    setBusy(true); const r = await B.call(fn, args); setBusy(false); lock.current = false;
    if (r.ok) { setMsg({ ok: true, text: okText }); setMode(null); setReason(''); setNewPw(''); app.note(okText + ' (' + (a.owner_name || id) + ')', 'warn', 'bank'); Monitor.logAction(okText, id, { reason: args.p_reason }); await load(); onChanged && onChanged(); }
    else setMsg({ ok: false, text: r.message || 'Fehlgeschlagen.' });
    return r;
  }
  const pwBad = newPw && (newPw.length < 10 || newPw.length > 72);
  return (
    <Dialog title="Kontodetails" wide onClose={onClose}>
      {err && <Msg m={{ ok: false, text: err }} />}{!d && !err && <Empty>Lädt …</Empty>}
      {a && (
        <div className="stack">
          <Kv rows={[
            ['Kontotyp', standalone ? <Badge tone="info">Eigenständig</Badge> : a.account_type === 'system' ? <Badge tone="amber">System</Badge> : <Badge>Bürgerkonto</Badge>],
            ['Kontoinhaber', <strong>{a.owner_name || '—'}</strong>], ['Bürger-/interne ID', a.external_id || '—'], ['Kategorie', a.category || '—'], ['Beschreibung', a.description || '—'],
            ['Konto-UUID', <span className="mono">{a.id}</span>], ['Kontostand', <strong>{fmtM(a.balance_minor)}</strong>],
            ['Status', <Badge tone={(ST[a.status] || [])[1]}>{(ST[a.status] || [a.status])[0]}</Badge>], ['Erstellt', fmtDT(a.created_at) + (a.created_by_name ? ' von ' + a.created_by_name : '')],
            cr && ['Kontokennung', <span className="mono">{cr.login_identifier}</span>], cr && ['Letzte Anmeldung', cr.last_login_at ? fmtDT(cr.last_login_at) : 'noch nie'],
            cr && ['Passwortwechsel nötig', cr.must_change_password ? 'Ja' : 'Nein'], cr && ['Aktive Sitzungen', d.active_sessions], ['Aktive Daueraufträge', d.active_standing_orders],
          ]} />
          <Msg m={msg} />
          {secret && <Secret label="Neues temporäres Passwort" value={secret} />}
          <div className="row">
            <Btn size="sm" onClick={() => onJournal(a.id)}>Transaktionsverlauf</Btn>
            <Btn size="sm" onClick={async () => { const r = await B.call('bank_admin_so_list', { p_account: id }); if (r.ok) { setOrders(r.rows || []); setMode('orders'); } else setMsg({ ok: false, text: r.message }); }}>Daueraufträge</Btn>
            {a.account_type !== 'system' && a.status !== 'closed' && <Btn size="sm" variant={a.status === 'active' ? 'danger' : 'primary'} onClick={() => { setMode('status'); setReason(''); }}>{a.status === 'active' ? 'Sperren' : 'Freigeben'}</Btn>}
            {standalone && a.status !== 'closed' && <>
              <Btn size="sm" onClick={() => { setMode('edit'); setReason(''); }}>Inhaber ändern</Btn>
              <Btn size="sm" onClick={() => { setMode('reset'); setReason(''); setSecret(null); }}>Zugangsdaten zurücksetzen</Btn>
              <Btn size="sm" variant="danger" onClick={() => { setMode('close'); setReason(''); }}>Stilllegen</Btn></>}
          </div>
          {mode && mode !== 'orders' && (
            <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 10 }}>
              {mode === 'edit' && <>
                <Input label="Kontoinhaber" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <Input label="Bürger-/interne ID" value={edit.ext} onChange={(e) => setEdit({ ...edit, ext: e.target.value })} />
                <Input label="Kategorie" value={edit.cat} onChange={(e) => setEdit({ ...edit, cat: e.target.value })} />
                <Input label="Beschreibung" value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} /></>}
              {mode === 'reset' && <><div className="small">Das alte Passwort wird ersetzt, alle Sitzungen enden, beim nächsten Login ist ein neues Passwort Pflicht.</div>
                <Input label="Neues Passwort (optional, sonst vom System erzeugt)" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} error={pwBad ? '10 bis 72 Zeichen' : undefined} /></>}
              {mode === 'close' && <div className="msg bad">Stilllegen ist endgültig. Alle Daueraufträge des Kontos enden. Nur bei Kontostand 0 möglich.</div>}
              <Input label="Begründung (mind. 5 Zeichen)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="row">
                {mode === 'edit' && <Btn variant="primary" disabled={busy || !ok5 || edit.name.trim().length < 2} onClick={() => run('bank_admin_update_standalone', { p_account: id, p_owner_name: edit.name, p_external_id: edit.ext, p_category: edit.cat, p_description: edit.desc, p_reason: reason.trim() }, 'Kontoinhaber geändert')}>Speichern</Btn>}
                {mode === 'reset' && <Btn variant="primary" disabled={busy || !ok5 || pwBad} onClick={async () => { if (!window.confirm('Zugangsdaten wirklich zurücksetzen?')) return; const r = await run('bank_admin_reset_credentials', { p_account: id, p_reason: reason.trim(), p_new_password: newPw || null }, 'Zugangsdaten zurückgesetzt'); if (r && r.ok && r.temp_password) setSecret(r.temp_password); }}>Zurücksetzen</Btn>}
                {mode === 'status' && <Btn variant="primary" disabled={busy || !ok5} onClick={() => run('bank_admin_set_status', { p_account: id, p_status: a.status === 'active' ? 'blocked' : 'active', p_reason: reason.trim() }, a.status === 'active' ? 'Bankkonto gesperrt' : 'Bankkonto freigegeben')}>{a.status === 'active' ? 'Jetzt sperren' : 'Jetzt freigeben'}</Btn>}
                {mode === 'close' && <Btn variant="danger" disabled={busy || !ok5} onClick={() => { if (window.confirm('Konto endgültig stilllegen?')) run('bank_admin_close_account', { p_account: id, p_reason: reason.trim() }, 'Bankkonto stillgelegt'); }}>Endgültig stilllegen</Btn>}
                <Btn variant="ghost" onClick={() => setMode(null)}>Abbrechen</Btn>
              </div>
            </div>
          )}
          {mode === 'orders' && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Daueraufträge (nur Ansicht)</div>
              {!orders.length ? <div className="muted small">Keine Daueraufträge.</div> : orders.map((o) => (
                <div key={o.id} className="list-row small"><span>{fmtM(o.amount_minor)} · {SO_INTERVAL[o.repeat_interval] || o.repeat_interval} · {o.source_account_id === id ? 'an ' : 'von '}<Uuid id={o.source_account_id === id ? o.target_account_id : o.source_account_id} /></span>
                  <span className="row"><Badge tone={(SO_STATUS[o.status] || [])[1]}>{(SO_STATUS[o.status] || [o.status])[0]}</Badge>{o.last_run && <Badge tone={(SO_RUN[o.last_run.status] || [])[1]}>{(SO_RUN[o.last_run.status] || [o.last_run.status])[0]}</Badge>}</span></div>))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function CreateStandalone({ onClose, onCreated }) {
  const app = useApp();
  const [f, setF] = useState({ name: '', ext: '', amount: '', status: 'active', category: '', desc: '', pw: '', reason: '' });
  const [review, setReview] = useState(false); const [key] = useState(newKey); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null);
  const lock = useRef(false); const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const amount = f.amount.trim() ? parseMinor(f.amount) : 0;
  const pwOk = !f.pw || (f.pw.length >= 10 && f.pw.length <= 72);
  const valid = f.name.trim().length >= 2 && amount !== null && f.reason.trim().length >= 5 && pwOk;
  async function create() {
    if (lock.current) return; lock.current = true; setBusy(true);
    const r = await B.call('bank_admin_create_standalone', { p_owner_name: f.name.trim(), p_external_id: f.ext.trim() || null, p_initial_minor: amount || 0, p_status: f.status,
      p_description: f.desc.trim() || null, p_category: f.category.trim() || null, p_initial_password: f.pw || null, p_reason: f.reason.trim(), p_idempotency_key: key });
    setBusy(false); lock.current = false;
    setRes((prev) => (prev && prev.ok && prev.temp_password && r.ok && r.replayed ? prev : r));
    setF((x) => ({ ...x, pw: '' }));
    if (r.ok) { app.note('Bankkonto erstellt: ' + f.name.trim(), 'ok', 'bank'); Monitor.logAction('Bankkonto erstellt', r.account_id, { name: f.name.trim() }); onCreated && onCreated(); }
  }
  if (res && res.ok) return (
    <Dialog title="Konto erstellt" onClose={onClose}>
      <div className="stack">
        <Kv rows={[['Kontoinhaber', f.name], ['Konto-UUID', <span className="mono">{res.account_id}</span>], ['Kontokennung', <span className="mono">{res.login_identifier}</span>]]} />
        {res.temp_password ? <Secret label="Temporäres Passwort" value={res.temp_password} /> : <div className="msg info">{res.replayed ? 'Bereits erstellt – das Passwort wird nicht erneut angezeigt.' : 'Das festgelegte Passwort gilt.'}</div>}
        <div><Btn variant="primary" onClick={onClose}>Fertig</Btn></div>
      </div>
    </Dialog>
  );
  return (
    <Dialog title={review ? 'Neues Bankkonto · Prüfen' : 'Neues Bankkonto'} wide onClose={() => !busy && onClose()}>
      {!review ? (
        <div className="stack">
          <div className="muted small">Ein eigenständiges Konto braucht keinen Bürgerportal-Account; Anmeldung mit Kontokennung und eigenem Passwort.</div>
          <div className="cols" style={{ gap: 12 }}>
            <div style={{ flex: '2 1 240px' }}><Input label="Kontoinhaber" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div style={{ flex: '1 1 180px' }}><Input label="Bürger-/interne ID (optional)" value={f.ext} onChange={(e) => set('ext', e.target.value)} /></div>
          </div>
          <div className="cols" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 160px' }}><Input label="Startguthaben (M$)" value={f.amount} onChange={(e) => set('amount', e.target.value)} error={f.amount.trim() && amount === null ? 'Ungültiger Betrag' : undefined} /></div>
            <div style={{ flex: '1 1 160px' }}><Select label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Aktiv</option><option value="blocked">Gesperrt</option></Select></div>
            <div style={{ flex: '1 1 160px' }}><Input label="Kategorie (optional)" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="z. B. Unternehmen" /></div>
          </div>
          <Input label="Beschreibung (optional)" value={f.desc} onChange={(e) => set('desc', e.target.value)} />
          <Input label="Passwort (optional – leer = vom System erzeugt)" type="password" autoComplete="new-password" value={f.pw} onChange={(e) => set('pw', e.target.value)} error={f.pw && !pwOk ? '10 bis 72 Zeichen' : undefined} />
          <Input label="Begründung (mind. 5 Zeichen)" value={f.reason} onChange={(e) => set('reason', e.target.value.slice(0, 300))} />
          <div className="row"><Btn variant="primary" disabled={!valid} onClick={() => setReview(true)}>Zusammenfassung prüfen</Btn><Btn variant="ghost" onClick={onClose}>Abbrechen</Btn></div>
        </div>
      ) : (
        <div className="stack">
          <Kv rows={[['Kontoinhaber', f.name.trim()], ['Interne ID', f.ext.trim() || '—'], ['Startguthaben', amount ? fmtM(amount) : 'keines'], ['Status · Kategorie', (f.status === 'active' ? 'Aktiv' : 'Gesperrt') + ' · ' + (f.category.trim() || '—')], ['Passwort', f.pw ? 'festgelegt' : 'wird erzeugt (einmalige Anzeige)'], ['Begründung', f.reason.trim()]]} />
          {res && !res.ok && <Msg m={{ ok: false, text: res.message || 'Erstellung fehlgeschlagen.' }} />}
          <div className="row"><Btn variant="solid" disabled={busy} onClick={create}>{busy ? 'Wird erstellt …' : 'Konto erstellen'}</Btn><Btn variant="ghost" disabled={busy} onClick={() => setReview(false)}>Zurück</Btn></div>
        </div>
      )}
    </Dialog>
  );
}

/* ---------- Geld buchen ---------- */
function Money({ prefill }) {
  const app = useApp();
  const [mode, setMode] = useState('credit'); const [acct, setAcct] = useState(prefill || ''); const [accts, setAccts] = useState([]);
  const [amount, setAmount] = useState(''); const [reason, setReason] = useState(''); const [note, setNote] = useState('');
  const [review, setReview] = useState(false); const [key, setKey] = useState(''); const [sending, setSending] = useState(false); const [res, setRes] = useState(null); const [ack, setAck] = useState(false);
  useEffect(() => { B.call('bank_admin_accounts', { p_limit: 100 }).then((r) => { if (r.ok) setAccts((r.rows || []).filter((a) => a.kind === 'user')); }); }, []);
  const target = acct.trim().toLowerCase(); const minor = parseMinor(amount); const known = accts.find((a) => a.id === target);
  const ok = uuidOk(target) && minor && reason.trim().length >= 5;
  async function run() {
    setSending(true);
    const r = mode === 'credit'
      ? await B.call('bank_admin_credit', { p_recipient: target, p_amount_minor: minor, p_reason: reason.trim(), p_note: note.trim() || null, p_idempotency_key: key })
      : await B.call('bank_admin_debit', { p_account: target, p_amount_minor: minor, p_reason: reason.trim(), p_note: note.trim() || null, p_idempotency_key: key });
    setSending(false); setRes(r);
    if (r.ok) { const t = (mode === 'credit' ? 'Gutschrift ' : 'Abbuchung ') + fmtM(minor) + ' → ' + (known ? known.name : target); app.note(t, 'warn', 'bank'); Monitor.logAction(t, target, { reason: reason.trim() }); setAmount(''); setReason(''); setNote(''); setAck(false); }
  }
  return (
    <Corners yellow innerStyle={{ padding: 22, maxWidth: 640 }}>
      <div className="stack">
        <Tabs value={mode} onChange={(v) => { setMode(v); setAck(false); }} options={[{ value: 'credit', label: 'Gutschrift' }, { value: 'debit', label: 'Abbuchung' }]} />
        <Field label="Konto-UUID" hint={known ? known.name + ' · ' + (known.citizen_id || '') + ' · Kontostand ' + fmtM(known.balance_minor) : undefined} error={acct && !uuidOk(target) ? 'Keine gültige UUID.' : undefined}>
          <input className="input mono" list="abis-acc-list" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="UUID eingeben oder wählen" />
        </Field>
        <datalist id="abis-acc-list">{accts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.citizen_id}</option>)}</datalist>
        <Input label="Betrag (M$)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="z. B. 100,00" error={amount && !minor ? 'Ungültiger Betrag.' : undefined} />
        <Input label="Verwendungszweck / Begründung (mind. 5 Zeichen)" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 140))} />
        <Input label="Interne Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} />
        {mode === 'debit' && <label className="check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>Ich bestätige, dass dem Konto dieser Betrag <strong>entzogen</strong> werden soll.</span></label>}
        <div><Btn variant="primary" disabled={!ok || (mode === 'debit' && !ack)} onClick={() => { setKey(newKey()); setRes(null); setReview(true); }}>Zusammenfassung prüfen</Btn></div>
      </div>
      {review && (
        <Dialog title={mode === 'credit' ? 'Gutschrift bestätigen' : 'Abbuchung bestätigen'} onClose={() => { if (!sending) { setReview(false); setRes(null); } }}>
          {res && res.ok ? (
            <div className="stack"><Msg m={{ ok: true, text: 'Verbucht.' }} /><div className="mono small break">Transaktions-ID: {res.transaction_id}</div><div><Btn variant="primary" onClick={() => { setReview(false); setRes(null); }}>Fertig</Btn></div></div>
          ) : (
            <div className="stack">
              <Kv rows={[['Aktion', mode === 'credit' ? 'Gutschrift (Staatskasse → Konto)' : 'Abbuchung (Konto → Staatskasse)'], ['Konto', <>{known ? known.name + ' · ' : ''}<span className="mono small">{target}</span></>],
                ['Betrag', <strong style={{ fontSize: 22 }}>{fmtM(minor)}</strong>], ['Begründung', reason.trim()], note.trim() && ['Notiz', note.trim()]]} />
              {res && !res.ok && <Msg m={{ ok: false, text: res.message || 'Fehlgeschlagen.' }} />}
              <div className="row"><Btn variant="solid" disabled={sending} onClick={run}>{sending ? 'Wird gebucht …' : 'Verbindlich buchen'}</Btn><Btn variant="ghost" disabled={sending} onClick={() => { setReview(false); setRes(null); }}>Abbrechen</Btn></div>
            </div>
          )}
        </Dialog>
      )}
    </Corners>
  );
}

/* ---------- Dauerzahlungen ---------- */
const REC_EMPTY = { id: '', name: '', description: '', amount: '', direction: 'payout', recipient_scope: 'account', recipient_account_id: '', schedule_day: '1', start_date: '', end_date: '', budget: '', payment_type: 'NORMAL' };
const REC_ST = { active: ['Aktiv', 'ok'], paused: ['Pausiert', 'warn'], ended: ['Beendet', ''] };
const RUN_ST = { success: ['Erfolgreich', 'ok'], partial: ['Teilweise', 'warn'], failed: ['Fehlgeschlagen', 'bad'], skipped: ['Übersprungen', ''], running: ['Läuft', 'info'] };
function Recurring() {
  const app = useApp();
  const [rows, setRows] = useState([]); const [sch, setSch] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); const [saving, setSaving] = useState(false); const [runs, setRuns] = useState(null);
  async function load() {
    const [a, b] = await Promise.all([B.call('bank_admin_recurring_list'), B.call('bank_scheduler_status')]);
    if (a.ok) setRows(a.rows || []); else setMsg({ ok: false, text: a.message }); if (b.ok) setSch(b);
  }
  useEffect(() => { load(); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const amountMinor = form ? parseMinor(form.amount) : null; const budgetMinor = form && form.budget ? parseMinor(form.budget) : null; const day = form ? Number(form.schedule_day) : 0;
  const formOk = form && form.name.trim().length >= 2 && amountMinor && day >= 1 && day <= 31 && (!form.budget || budgetMinor) && (form.recipient_scope === 'all_users' || uuidOk(form.recipient_account_id.trim()));
  async function save() {
    setSaving(true);
    const r = await B.call('bank_admin_recurring_save', { p: { id: form.id || null, name: form.name.trim(), description: form.description.trim() || null, amount_minor: amountMinor, direction: form.direction,
      recipient_scope: form.recipient_scope, recipient_account_id: form.recipient_scope === 'account' ? form.recipient_account_id.trim().toLowerCase() : null, schedule_day: day,
      start_date: form.start_date || null, end_date: form.end_date || null, budget_total_minor: budgetMinor, payment_type: form.direction === 'payout' ? form.payment_type : 'NORMAL' } });
    setSaving(false);
    if (r.ok) { app.note('Dauerzahlung gespeichert: ' + form.name.trim(), 'ok', 'bank'); Monitor.logAction('Dauerzahlung gespeichert', form.name.trim()); setForm(null); setMsg({ ok: true, text: 'Dauerzahlung gespeichert.' }); load(); }
    else setMsg({ ok: false, text: r.message || 'Speichern fehlgeschlagen.' });
  }
  async function setStatus(p, status) { const r = await B.call('bank_admin_recurring_set_status', { p_id: p.id, p_status: status }); setMsg(r.ok ? { ok: true, text: 'Status geändert.' } : { ok: false, text: r.message }); if (r.ok) Monitor.logAction('Dauerzahlung ' + status, p.name); load(); }
  async function runDue() { setBusy(true); const r = await B.call('bank_admin_run_due'); setBusy(false); setMsg(r.ok ? { ok: true, text: r.periods_processed + ' Zeitraum/-räume verarbeitet, ' + r.periods_failed + ' fehlgeschlagen.' } : { ok: false, text: r.message }); if (r.ok) Monitor.logAction('Fällige Dauerzahlungen manuell ausgeführt'); load(); }
  function edit(p) { setForm({ id: p.id, name: p.name, description: p.description || '', amount: fmtMinor(p.amount_minor), direction: p.direction, recipient_scope: p.recipient_scope, recipient_account_id: p.recipient_account_id || '',
    schedule_day: String(p.schedule_day), start_date: p.start_date || '', end_date: p.end_date || '', budget: p.budget_total_minor ? fmtMinor(p.budget_total_minor) : '', payment_type: p.payment_type === 'INCOME' ? 'INCOME' : 'NORMAL' }); }
  return (
    <div className="stack">
      {sch && (sch.job_scheduled ? <div className="msg ok">Scheduler aktiv – fällige Zahlungen laufen automatisch.{sch.last_run_at ? ' Letzter Lauf: ' + fmtDT(sch.last_run_at) + '.' : ''}</div>
        : <div className="msg bad">Kein Scheduler eingerichtet – Dauerzahlungen laufen nicht automatisch ({sch.pg_cron_installed ? 'pg_cron aktiv, Job fehlt' : 'pg_cron nicht aktiviert'}). Datei <code>sql/banking/6d-scheduler-pgcron.sql</code> ausführen.</div>)}
      {sch && sch.due_now > 0 && <div className="msg warn">{sch.due_now} Dauerzahlung(en) fällig und nicht ausgeführt.</div>}
      <div className="row">
        <Btn variant="primary" onClick={() => setForm({ ...REC_EMPTY })}>+ Neue Dauerzahlung</Btn>
        <Btn disabled={busy} onClick={() => { if (window.confirm('Alle fälligen Dauerzahlungen jetzt ausführen?')) runDue(); }}>{busy ? 'Läuft …' : 'Fällige jetzt ausführen'}</Btn>
        <Btn variant="ghost" onClick={load}>Aktualisieren</Btn>
      </div>
      <Msg m={msg} />
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 1100 }}>
          <thead><tr>{['Name', 'Betrag', 'Art', 'Richtung', 'Empfänger', 'Tag', 'Zeitraum', 'Nächste', 'Letzter Lauf', 'Status', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong>{p.description && <div className="muted small">{p.description}</div>}</td>
              <td className="nowrap mono">{fmtM(p.amount_minor)}{p.budget_total_minor ? <div className="muted small">Budget {fmtMinor(p.spent_minor)} / {fmtMinor(p.budget_total_minor)}</div> : null}</td>
              <td className="small">{p.payment_type === 'INCOME' ? 'Lohn (40 % Steuer)' : 'Normal'}</td><td className="small">{p.direction === 'payout' ? 'Auszahlung' : 'Gebühr'}</td>
              <td className="small">{p.recipient_scope === 'all_users' ? 'Alle aktiven Konten' : p.recipient_name || <Uuid id={p.recipient_account_id} />}</td>
              <td>{p.schedule_day}.</td><td className="nowrap small">{p.start_date ? fmtD(p.start_date) : 'sofort'} – {p.end_date ? fmtD(p.end_date) : 'offen'}</td>
              <td className="nowrap small">{p.status === 'active' ? fmtDT(p.next_run_at) : '—'}</td>
              <td>{p.last_run ? <><Badge tone={(RUN_ST[p.last_run.status] || [])[1]}>{(RUN_ST[p.last_run.status] || [p.last_run.status])[0]}</Badge><div className="muted small">{fmtD(p.last_run.scheduled_for)}</div></> : '—'}</td>
              <td><Badge tone={(REC_ST[p.status] || [])[1]}>{(REC_ST[p.status] || [p.status])[0]}</Badge></td>
              <td><div className="row" style={{ gap: 6 }}>
                {p.status !== 'ended' && <Btn size="sm" onClick={() => edit(p)}>Bearbeiten</Btn>}
                {p.status === 'active' && <Btn size="sm" onClick={() => setStatus(p, 'paused')}>Pausieren</Btn>}
                {p.status === 'paused' && <Btn size="sm" onClick={() => setStatus(p, 'active')}>Fortsetzen</Btn>}
                {p.status !== 'ended' && <Btn size="sm" variant="danger" onClick={() => { if (window.confirm('Endgültig beenden?')) setStatus(p, 'ended'); }}>Beenden</Btn>}
                <Btn size="sm" variant="ghost" onClick={async () => { const r = await B.call('bank_admin_recurring_runs', { p_id: p.id }); if (r.ok) setRuns({ p, rows: r.rows || [] }); }}>Läufe</Btn>
              </div></td>
            </tr>))}</tbody>
        </table>
        {!rows.length && <Empty>Noch keine Dauerzahlungen.</Empty>}
      </section>
      {form && (
        <Dialog title={form.id ? 'Dauerzahlung bearbeiten' : 'Neue Dauerzahlung'} wide onClose={() => !saving && setForm(null)}>
          <div className="stack">
            <Input label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Monatliches Einkommen" />
            <Input label="Beschreibung (optional)" value={form.description} onChange={(e) => set('description', e.target.value)} />
            <div className="cols" style={{ gap: 12 }}>
              <div style={{ flex: '1 1 150px' }}><Input label="Betrag (M$)" value={form.amount} onChange={(e) => set('amount', e.target.value)} error={form.amount && !amountMinor ? 'Ungültig' : undefined} /></div>
              <div style={{ flex: '1 1 220px' }}><Select label="Richtung" value={form.direction} onChange={(e) => set('direction', e.target.value)}><option value="payout">Auszahlung (Staatskasse → Konto)</option><option value="charge">Gebühr (Konto → Staatskasse)</option></Select></div>
              <div style={{ flex: '1 1 120px' }}><Input label="Tag (1–31)" type="number" value={form.schedule_day} onChange={(e) => set('schedule_day', e.target.value)} error={form.schedule_day && !(day >= 1 && day <= 31) ? '1–31' : undefined} /></div>
            </div>
            <Select label="Zahlungsart" value={form.direction === 'payout' ? form.payment_type : 'NORMAL'} disabled={form.direction !== 'payout'} onChange={(e) => set('payment_type', e.target.value)}>
              <option value="NORMAL">Normale Zahlung (steuerfrei)</option><option value="INCOME">Lohn / Einkommen (40 % Steuer)</option></Select>
            <Select label="Empfänger" value={form.recipient_scope} onChange={(e) => set('recipient_scope', e.target.value)}><option value="account">Ein bestimmtes Konto</option><option value="all_users">Alle aktiven Bürgerkonten</option></Select>
            {form.recipient_scope === 'account' && <Input label="Konto-UUID" mono value={form.recipient_account_id} onChange={(e) => set('recipient_account_id', e.target.value)} error={form.recipient_account_id && !uuidOk(form.recipient_account_id.trim()) ? 'Keine gültige UUID' : undefined} />}
            <div className="cols" style={{ gap: 12 }}>
              <div style={{ flex: '1 1 150px' }}><Input label="Start (optional)" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></div>
              <div style={{ flex: '1 1 150px' }}><Input label="Ende (optional)" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></div>
              <div style={{ flex: '1 1 170px' }}><Input label="Gesamtbudget (optional)" value={form.budget} onChange={(e) => set('budget', e.target.value)} error={form.budget && !budgetMinor ? 'Ungültig' : undefined} /></div>
            </div>
            <div className="muted small">Fällig jeweils 06:00 Uhr (Berlin), höchstens einmal pro Monat. Gebühren werden nie über das Guthaben hinaus eingezogen.</div>
            <div className="row"><Btn variant="solid" disabled={!formOk || saving} onClick={save}>{saving ? 'Speichert …' : 'Speichern'}</Btn><Btn variant="ghost" disabled={saving} onClick={() => setForm(null)}>Abbrechen</Btn></div>
          </div>
        </Dialog>
      )}
      {runs && (
        <Dialog title={'Läufe · ' + runs.p.name} wide onClose={() => setRuns(null)}>
          {!runs.rows.length ? <Empty>Noch keine Ausführung.</Empty> : (
            <div className="table-wrap"><table className="table"><thead><tr>{['Zeitraum', 'Status', 'OK', 'Fehler', 'Summe', 'Meldung'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{runs.rows.map((r) => <tr key={r.id}><td>{fmtD(r.scheduled_for)}</td><td><Badge tone={(RUN_ST[r.status] || [])[1]}>{(RUN_ST[r.status] || [r.status])[0]}</Badge></td><td>{r.count_ok}</td><td>{r.count_failed}</td><td className="mono">{fmtM(r.total_minor)}</td><td>{r.error_message || '—'}</td></tr>)}</tbody></table></div>)}
        </Dialog>
      )}
    </div>
  );
}

/* ---------- Steuern ---------- */
function Tax({ onOpen }) {
  const [view, setView] = useState('overview');
  const [ov, setOv] = useState(null); const [acc, setAcc] = useState(null); const [page, setPage] = useState(0); const [err, setErr] = useState('');
  const today = berlinToday(); const [from, setFrom] = useState(today.slice(0, 8) + '01'); const [to, setTo] = useState(today); const [rep, setRep] = useState(null); const [busy, setBusy] = useState(false);
  const PAGE = 15;
  useEffect(() => { if (view === 'overview') B.call('bank_admin_tax_overview').then((r) => (r.ok ? setOv(r) : setErr(r.message))); }, [view]);
  useEffect(() => { if (view === 'account') B.call('bank_admin_tax_account', { p_limit: PAGE, p_offset: page * PAGE }).then((r) => (r.ok ? setAcc(r) : setErr(r.message))); }, [view, page]);
  async function loadRep() {
    setErr(''); if (!from || !to || to < from) { setErr('Bitte einen gültigen Zeitraum wählen.'); return; }
    setBusy(true); const r = await B.call('bank_admin_tax_report', { p_from: from, p_to: to }); setBusy(false);
    if (r.ok) setRep(r); else setErr(r.message || 'Bericht fehlgeschlagen.');
  }
  function exportCsv() {
    const header = ['Datum', 'Uhrzeit', 'Transaktions-ID', 'Steuer-ID', 'Absender', 'Empfänger', 'Brutto', 'Steuer', 'Satz', 'Netto', 'Zweck'];
    const rows = rep.rows.map((r) => [fmtD(r.posted_at), fmtT(r.posted_at), r.id, r.tax_transaction_id, r.sender_name, r.recipient_name, fmtMinor(r.gross_amount_minor), fmtMinor(r.tax_amount_minor), String(r.tax_rate).replace('.', ','), fmtMinor(r.net_amount_minor), r.reference]);
    rows.push([], ['Summe', '', '', '', '', '', fmtMinor(rep.gross_total_minor), fmtMinor(rep.tax_total_minor), '', fmtMinor(rep.net_total_minor), rep.income_payments + ' Zahlungen']);
    downloadText('steuerbericht-' + rep.from + '_' + rep.to + '.csv', buildCsv(header, rows));
  }
  const check = (b, t) => <div className={b ? 'val-ok' : 'val-bad'} style={{ fontWeight: 600 }}>{b ? '✓' : '✗'} {t}</div>;
  return (
    <div className="stack">
      <Tabs value={view} onChange={setView} options={[{ value: 'overview', label: 'Übersicht' }, { value: 'account', label: 'Steuerkonto' }, { value: 'report', label: 'Steuerbericht' }]} />
      {err && <Msg m={{ ok: false, text: err }} />}
      {view === 'overview' && ov && (
        <div className="stack">
          <div className="stats">
            <Stat k={'Steuereinnahmen gesamt (' + String(ov.rate_percent).replace('.', ',') + ' %)'} v={fmtMinor(ov.tax_total_minor)} m="M$" />
            <Stat k="Heute" v={fmtMinor(ov.tax_today_minor)} m={ov.income_today + ' Zahlung(en)'} />
            <Stat k="Dieser Monat" v={fmtMinor(ov.tax_month_minor)} m={ov.income_month + ' Zahlung(en)'} />
            <Stat k="Dieses Jahr" v={fmtMinor(ov.tax_year_minor)} m={ov.income_year + ' Zahlung(en)'} />
          </div>
          <Panel title="Lohn- und Einkommenszahlungen">
            <Kv rows={[['Anzahl', ov.income_payments], ['Brutto', fmtM(ov.gross_total_minor)], ['Steuer', fmtM(ov.tax_total_minor)], ['Netto', fmtM(ov.net_total_minor)]]} />
            <div style={{ marginTop: 10 }}>{check(ov.consistent, ov.consistent ? 'Brutto = Netto + Steuer, Steuerkonto = Summe der Steuern' : 'Abweichung – Integritätsprüfung ausführen')}</div>
          </Panel>
        </div>)}
      {view === 'account' && acc && (
        <div className="stack">
          <Panel title={'Systemkonto „' + acc.account.name + '“ (nur Ansicht)'}>
            <div className="stat-v">{fmtM(acc.account.balance_minor)}</div>
            <div className="muted small">Zuflüsse gesamt {fmtM(acc.total_inflow_minor)} · <span className="mono">{acc.account.id}</span></div>
          </Panel>
          <section className="panel table-wrap">
            <table className="table" style={{ minWidth: 1000 }}>
              <thead><tr>{['Zeit', 'Ursprung', 'Steuer-Tx', 'Art', 'Gegenpartei', 'Brutto', 'Steuer', 'Satz', 'Netto', 'Buchung', 'Saldo'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{acc.rows.map((r) => (
                <tr key={r.entry_no} className="click" onClick={() => onOpen(r.origin_transaction_id)}>
                  <td className="nowrap small">{fmtDT(r.created_at)}</td><td><Uuid id={r.origin_transaction_id} /></td><td><Uuid id={r.tax_transaction_id} /></td>
                  <td className="small">{PAY_TYPE_LABEL[r.payment_type] || r.payment_type}</td><td className="small">{r.counterparty_name || '—'}</td>
                  <td className="num mono">{fmtMinor(r.gross_amount_minor)}</td><td className={'num mono ' + (r.amount_minor < 0 ? 'val-bad' : 'val-ok')}>{r.amount_minor < 0 ? '−' : '+'}{fmtMinor(Math.abs(r.amount_minor))}</td>
                  <td className="small">{fmtRate(r.tax_rate)}</td><td className="num mono">{fmtMinor(r.net_amount_minor)}</td><td><StatusBadge s={r.origin_status} /></td><td className="num mono">{fmtMinor(r.balance_after_minor)}</td>
                </tr>))}</tbody>
            </table>
            {!acc.rows.length && <Empty>Noch keine Steuerbuchungen.</Empty>}
          </section>
          <Pager page={page} total={Number(acc.total) || 0} size={PAGE} onPage={setPage} />
        </div>)}
      {view === 'report' && (
        <div className="stack">
          <div className="filters">
            <Field label="Von"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Bis"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Btn variant="primary" disabled={busy} onClick={loadRep}>{busy ? 'Erstellt …' : 'Bericht erstellen'}</Btn>
            {rep && <Btn onClick={exportCsv}>CSV exportieren</Btn>}
          </div>
          {rep && (
            <Panel title={'Steuerbericht ' + fmtDay(rep.from) + ' – ' + fmtDay(rep.to)}>
              <div className="cols">
                <div className="col-1"><Kv rows={[['Zahlungen', rep.income_payments], ['Brutto', fmtM(rep.gross_total_minor)], ['Steuer', fmtM(rep.tax_total_minor)], ['Netto', fmtM(rep.net_total_minor)]]} /></div>
                <div className="col-1 stack" style={{ gap: 6 }}>{check(rep.check_gross_equals_net_plus_tax, 'Brutto = Netto + Steuer')}{check(rep.check_tax_matches_ledger, 'Steuer = Zufluss laut Ledger')}
                  {rep.truncated && <div className="msg warn">Nur die ersten 5000 Zahlungen gelistet; Summen vollständig.</div>}</div>
              </div>
            </Panel>)}
        </div>)}
    </div>
  );
}

/* ---------- Integrität ---------- */
function Integrity() {
  const app = useApp();
  const [r, setR] = useState(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  async function check() { setBusy(true); const x = await B.call('bank_admin_integrity'); setBusy(false); if (x.message) setMsg({ ok: false, text: x.message }); else { setR(x); app.note('Integritätsprüfung: ' + (x.ok ? 'in Ordnung' : 'ABWEICHUNG'), x.ok ? 'ok' : 'bad', 'bank'); } }
  async function backfill() { const x = await B.call('bank_admin_backfill'); setMsg(x.ok ? { ok: true, text: x.created + ' fehlende Konto/Konten angelegt.' } : { ok: false, text: x.message }); }
  const line = (ok, text) => <div className={ok ? 'val-ok' : 'val-bad'} style={{ fontWeight: 600, padding: '4px 0' }}>{ok ? '✓' : '✗'} {text}</div>;
  return (
    <div className="cols">
      <div className="col-2">
        <Corners yellow innerStyle={{ padding: 22 }}>
          <h2>Integritätsprüfung</h2>
          <p className="muted" style={{ margin: '8px 0 14px' }}>Prüft Kontostände gegen die Buchungssummen, Soll = Haben, Steuerzeilen und die kryptografisch verkettete Buchungsfolge (HMAC).</p>
          <Btn variant="primary" disabled={busy} onClick={check}>{busy ? 'Prüfe …' : 'Jetzt prüfen'}</Btn>
          {r && <div style={{ marginTop: 14 }}>
            {line(r.ok, r.ok ? 'Alles in Ordnung' : 'Abweichungen gefunden!')}
            {line(r.accounts_with_wrong_balance === 0, 'Kontostände = Summe der Buchungen (' + r.accounts_with_wrong_balance + ' Abweichungen)')}
            {line(r.unbalanced_transactions === 0 && r.ledger_total_minor === 0, 'Soll = Haben: Summe ' + fmtMinor(r.ledger_total_minor) + ' (' + r.unbalanced_transactions + ' unausgeglichen)')}
            {r.tax_payments_inconsistent !== undefined && line(r.tax_payments_inconsistent === 0 && r.tax_rows_with_ledger_entries === 0 && r.tax_account_matches_payments, 'Steuern konsistent (' + r.tax_payments_inconsistent + ' Abweichungen)')}
            {line(r.broken_chain_entries === 0 && r.chain_head_matches, 'Buchungskette: ' + r.entries_checked + ' geprüft, ' + r.broken_chain_entries + ' verändert' + (r.first_broken_entry ? ' (erster: Nr. ' + r.first_broken_entry + ')' : ''))}
          </div>}
        </Corners>
      </div>
      <div className="col-1">
        <Panel title="Konten für bestehende Benutzer">
          <p className="muted small">Legt Bankkonten für Benutzer an, die noch keins haben. Vorhandene Daten bleiben unverändert.</p>
          <Btn onClick={backfill}>Fehlende Konten anlegen</Btn>
          <div style={{ marginTop: 10 }}><Msg m={msg} /></div>
        </Panel>
      </div>
    </div>
  );
}
