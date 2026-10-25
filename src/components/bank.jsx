/* Bank-Bausteine: Journal (Transaktionsliste) und Transaktionsdetails mit Storno */
import React, { useEffect, useRef, useState } from 'react';
import { Bank, Monitor, newKey } from '../lib/db.js';
import { useApp } from '../lib/state.jsx';
import { TX_TYPE, TX_STATUS, TX_AUTH, PAY_TYPE_LABEL, JOURNAL_CATEGORY, FAIL_TXT, fmtD, fmtT, fmtDT, fmtM, fmtMinor, fmtRate, parseMinor, uuidOk, buildCsv, downloadText } from '../lib/format.js';
import { Btn, Badge, Field, Pager, Empty, Uuid, Dialog, Kv, Msg, Input } from './ui.jsx';

export function StatusBadge({ s }) { const t = TX_STATUS[s] || [s, '']; return <Badge tone={t[1]}>{t[0]}</Badge>; }

export function Journal({ initialAccount, onOpen, refreshKey }) {
  const PAGE = 20;
  const empty = { type: '', cat: 'ALL', status: '', auth: '', account: initialAccount || '', user: '', from: '', to: '', min: '', max: '', search: '', sort: 'date_desc' };
  const [f, setF] = useState(empty); const [page, setPage] = useState(0);
  const [data, setData] = useState({ rows: [], total: 0 }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const seq = useRef(0);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(0); };
  function args(fx, p) {
    const min = fx.min ? parseMinor(fx.min) : null, max = fx.max ? parseMinor(fx.max) : null;
    return { p_limit: PAGE, p_offset: p * PAGE, p_from: fx.from ? new Date(fx.from + 'T00:00:00').toISOString() : null,
      p_to: fx.to ? new Date(new Date(fx.to + 'T00:00:00').getTime() + 86400000).toISOString() : null,
      p_min: min, p_max: max, p_status: fx.status || null, p_type: fx.type || null, p_search: fx.search || null, p_sort: fx.sort,
      p_category: fx.cat || 'ALL', p_account: fx.account ? fx.account.trim().toLowerCase() : null, p_user: fx.user || null, p_auth: fx.auth || null };
  }
  async function load() {
    const mine = ++seq.current; setErr('');
    if (f.account && !uuidOk(f.account)) { setErr('Die Konto-UUID ist ungültig.'); return; }
    setBusy(true);
    const r = await Bank.call('bank_admin_journal', args(f, page));
    if (mine !== seq.current) return;
    setBusy(false);
    if (!r.ok) { setErr(r.message || 'Das Journal konnte nicht geladen werden.'); return; }
    setData({ rows: r.rows || [], total: Number(r.total) || 0 });
  }
  useEffect(() => { load(); }, [page, f.type, f.cat, f.status, f.auth, f.sort, refreshKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const apply = () => { if (page) setPage(0); else load(); };
  async function exportCsv() {
    const r = await Bank.call('bank_admin_journal', { ...args(f, 0), p_limit: 100 });
    if (!r.ok) return;
    const header = ['Datum', 'Uhrzeit', 'Transaktions-ID', 'Typ', 'Zahlungsart', 'Absender', 'Empfänger', 'Betrag (M$)', 'Steuer (M$)', 'Zweck', 'Status', 'Autorisierung', 'Ausgelöst von', 'Fehlergrund'];
    const rows = (r.rows || []).map((t) => [fmtD(t.created_at), fmtT(t.created_at), t.id, TX_TYPE[t.type] || t.type, PAY_TYPE_LABEL[t.payment_type] || t.payment_type || '',
      t.sender_account_id || '', t.recipient_account_id || '', fmtMinor(t.amount_minor), t.tax_amount_minor ? fmtMinor(t.tax_amount_minor) : '', t.reference || '',
      (TX_STATUS[t.status] || [t.status])[0], TX_AUTH[t.authorization_status] || t.authorization_status, t.initiated_by_name || (t.initiated_by ? t.initiated_by : 'System'), t.failure_reason || '']);
    downloadText('journal-' + new Date().toISOString().slice(0, 10) + '.csv', buildCsv(header, rows));
    Monitor.logAction('Journal exportiert', null, { rows: rows.length });
  }
  const sel = (k, opts) => <select className="select" value={f[k]} onChange={(e) => set(k, e.target.value)}>{opts}</select>;
  return (
    <div className="stack">
      <div className="filters">
        <Field label="Konto-UUID"><input className="input mono" style={{ width: 280 }} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} placeholder="UUID" /></Field>
        <Field label="Benutzer"><input className="input" style={{ width: 160 }} value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} placeholder="Name / Bürger-Nr." /></Field>
        <Field label="Kategorie">{sel('cat', JOURNAL_CATEGORY.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>))}</Field>
        <Field label="Typ">{sel('type', [<option key="" value="">Alle</option>, ...Object.keys(TX_TYPE).map((k) => <option key={k} value={k}>{TX_TYPE[k]}</option>)])}</Field>
        <Field label="Status">{sel('status', [<option key="" value="">Alle</option>, ...Object.keys(TX_STATUS).map((k) => <option key={k} value={k}>{TX_STATUS[k][0]}</option>)])}</Field>
        <Field label="Autorisierung">{sel('auth', [<option key="" value="">Alle</option>, ...Object.keys(TX_AUTH).map((k) => <option key={k} value={k}>{TX_AUTH[k]}</option>)])}</Field>
        <Field label="Von"><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Bis"><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Betrag ab"><input className="input" style={{ width: 100 }} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="0,00" /></Field>
        <Field label="Betrag bis"><input className="input" style={{ width: 100 }} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} placeholder="0,00" /></Field>
        <Field label="Suche"><input className="input mono" style={{ width: 180 }} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} placeholder="ID / Zweck" /></Field>
        <Field label="Sortierung">{sel('sort', [['date_desc', 'Neueste zuerst'], ['date_asc', 'Älteste zuerst'], ['amount_desc', 'Betrag absteigend'], ['amount_asc', 'Betrag aufsteigend']].map(([v, l]) => <option key={v} value={v}>{l}</option>))}</Field>
        <Btn variant="primary" onClick={apply}>Filtern</Btn>
        <Btn onClick={() => { setF(empty); setPage(0); }}>Zurücksetzen</Btn>
        <Btn onClick={exportCsv}>CSV</Btn>
      </div>
      {err && <div className="msg bad">{err}</div>}
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 1500 }}>
          <thead><tr>{['Zeit', 'Transaktion', 'Typ', 'Zahlungsart', 'Absender', 'Empfänger', 'Betrag', 'Steuer', 'Zweck', 'Status', 'Autor.', 'Ausgelöst von', 'Fehler'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{data.rows.map((t) => (
            <tr key={t.id} className={'click ' + (t.status === 'failed' ? 'row-bad' : t.status === 'rejected' ? 'row-warn' : '')} onClick={() => onOpen && onOpen(t.id)}>
              <td className="nowrap mono small">{fmtD(t.created_at)}<div className="muted">{fmtT(t.created_at)}</div></td>
              <td><Uuid id={t.id} /></td><td>{TX_TYPE[t.type] || t.type}</td><td>{PAY_TYPE_LABEL[t.payment_type] || t.payment_type || '—'}</td>
              <td><Uuid id={t.sender_account_id} /></td><td><Uuid id={t.recipient_account_id} /></td>
              <td className="num mono" style={{ fontWeight: 600 }}>{fmtMinor(t.amount_minor)}</td>
              <td className="num mono">{Number(t.tax_amount_minor) > 0 ? fmtMinor(t.tax_amount_minor) : '—'}</td>
              <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{t.reference || '—'}</td>
              <td><StatusBadge s={t.status} /></td><td className="small">{TX_AUTH[t.authorization_status] || t.authorization_status}</td>
              <td className="small">{t.initiated_by_name ? t.initiated_by_name + ' · ' + t.initiated_by_citizen : t.initiated_by ? <Uuid id={t.initiated_by} /> : 'System'}</td>
              <td className="small">{t.failure_reason ? FAIL_TXT[t.failure_reason] || t.failure_reason : '—'}</td>
            </tr>))}</tbody>
        </table>
        {!busy && !data.rows.length && !err && <Empty>Keine Transaktionen gefunden.</Empty>}
        {busy && <Empty>Lädt …</Empty>}
      </section>
      <Pager page={page} total={data.total} size={PAGE} onPage={setPage} />
    </div>
  );
}

function ledgerRole(l, root) {
  if (l.account_kind === 'tax') return l.amount_minor > 0 ? 'Steuerkonto (+Steuer)' : 'Steuerkonto (−Steuer)';
  if (l.account_id === root.sender_account_id) return l.amount_minor < 0 ? 'Absender (−Brutto)' : 'Absender (+Brutto)';
  if (l.account_id === root.recipient_account_id) return l.amount_minor > 0 ? (Number(root.tax_amount_minor) > 0 ? 'Empfänger (+Netto)' : 'Empfänger') : 'Empfänger (−Netto)';
  return '—';
}

export function TxDetail({ id, onClose, onChanged }) {
  const app = useApp();
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [key] = useState(newKey);
  async function load() { const r = await Bank.call('bank_admin_tx_detail', { p_transaction: id }); if (r.ok) setD(r); else setErr(r.message || 'Nicht geladen.'); }
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const t = d && d.transaction;
  async function reverse() {
    setBusy(true);
    const r = await Bank.call('bank_admin_reverse', { p_transaction: id, p_reason: reason.trim(), p_idempotency_key: key });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'Die Buchung wurde storniert (Gegenbuchung erstellt).' }); app.note('Buchung storniert: ' + id, 'warn', 'bank'); Monitor.logAction('Buchung storniert', id, { reason: reason.trim() }); await load(); onChanged && onChanged(); }
    else setMsg({ ok: false, text: r.message || 'Stornierung fehlgeschlagen.' });
  }
  return (
    <Dialog title="Transaktionsdetails" wide onClose={onClose}>
      {err && <Msg m={{ ok: false, text: err }} />}
      {!d && !err && <Empty>Lädt …</Empty>}
      {t && (
        <div className="stack">
          <Kv rows={[
            ['Transaktions-ID', <span className="mono">{t.id}</span>], ['Typ', TX_TYPE[t.type] || t.type], ['Zahlungsart', PAY_TYPE_LABEL[t.payment_type] || t.payment_type || '—'],
            ['Betrag', <strong>{fmtM(t.amount_minor)}</strong>],
            Number(t.tax_amount_minor) > 0 && ['Brutto / Steuer / Netto', fmtM(t.gross_amount_minor) + ' / ' + fmtM(t.tax_amount_minor) + ' (' + fmtRate(t.tax_rate) + ') / ' + fmtM(t.net_amount_minor)],
            t.parent_transaction_id && ['Ursprungstransaktion', <span className="mono">{t.parent_transaction_id}</span>],
            ['Absender', <span className="mono">{t.sender_account_id || '—'}</span>], ['Empfänger', <span className="mono">{t.recipient_account_id || (t.metadata && t.metadata.recipient) || '—'}</span>],
            ['Verwendungszweck', t.reference || '—'], ['Erstellt', fmtDT(t.created_at)],
            ['Autorisierung', (TX_AUTH[t.authorization_status] || '') + (t.authorized_at ? ' · ' + fmtDT(t.authorized_at) : '')],
            ['Buchung', <><StatusBadge s={t.status} /> {t.posted_at ? fmtDT(t.posted_at) : ''}</>],
            ['Ausgelöst von', d.initiator ? d.initiator.name + ' · ' + d.initiator.citizen_id : t.initiated_by || 'System'],
            t.failure_reason && ['Fehlergrund', FAIL_TXT[t.failure_reason] || t.failure_reason],
            t.metadata && t.metadata.reason && ['Begründung', t.metadata.reason], t.metadata && t.metadata.note && ['Interne Notiz', t.metadata.note],
            t.reverses_transaction_id && ['Storniert Buchung', <span className="mono">{t.reverses_transaction_id}</span>],
          ]} />
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Ledger (Soll / Haben)</div>
            {!d.ledger || !d.ledger.length ? <div className="muted small">Keine – es wurde nichts verbucht.</div> : (
              <div className="table-wrap"><table className="table mono" style={{ minWidth: 560 }}>
                <thead><tr>{['Nr.', 'Rolle', 'Konto', 'Betrag', 'Saldo danach', 'Zeit'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{d.ledger.map((l) => (
                  <tr key={l.entry_no}><td>{l.entry_no}</td><td>{ledgerRole(l, d.root || t)}</td><td><Uuid id={l.account_id} /></td>
                    <td className={l.amount_minor < 0 ? 'val-bad' : 'val-ok'}>{l.amount_minor < 0 ? '−' : '+'}{fmtMinor(Math.abs(l.amount_minor))}</td>
                    <td>{fmtMinor(l.balance_after_minor)}</td><td>{fmtDT(l.created_at)}</td></tr>))}</tbody>
              </table></div>)}
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Audit-Protokoll</div>
            {!d.audit || !d.audit.length ? <div className="muted small">Keine Einträge.</div> :
              <ul className="log">{d.audit.map((a, i) => <li key={i} className={a.result === 'success' ? '' : 'bad'}>{a.action} · {a.result}{a.reason ? ' · ' + a.reason : ''}<span className="t">{fmtDT(a.ts)}</span></li>)}</ul>}
          </div>
          {t.status === 'posted' && t.type !== 'reversal' && t.type !== 'tax' && (
            <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 10 }}>
              <div className="eyebrow">Buchung stornieren</div>
              <div className="muted small">Erzeugt eine Gegenbuchung; das Original bleibt erhalten. Der Empfänger muss noch über das Guthaben verfügen.</div>
              <Input label="Begründung (mind. 5 Zeichen)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div><Btn variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => { if (window.confirm('Diese Buchung wirklich stornieren?')) reverse(); }}>{busy ? 'Wird storniert …' : 'Stornieren'}</Btn></div>
            </div>
          )}
          <Msg m={msg} />
        </div>
      )}
    </Dialog>
  );
}
