/* Anmeldedaten (Level 6): Passwörter zurücksetzen – Klartext ist nirgends gespeichert */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { adminAction } from '../lib/db.js';
import { KEYS, can, displayName } from '../lib/model.js';
import { genPassword } from '../lib/model.js';
import { PageHead, Btn, Badge, Empty, Msg, Secret } from '../components/ui.jsx';

export default function Anmeldedaten() {
  const app = useApp();
  const { citizens, me, profiles } = app;
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(null); const [res, setRes] = useState(null);
  const allowed = can(me, 'credentials.reset');
  const list = citizens.filter((c) => (displayName(c.name) + c.id + (c.loginEmail || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de'));
  async function reset(c) {
    if (!window.confirm('Passwort von ' + displayName(c.name) + ' zurücksetzen? Das alte Passwort wird sofort ungültig.')) return;
    setBusy(c.id); setRes(null);
    const pw = genPassword(12);
    const r = await adminAction('reset-password', { citizen_id: c.id, password: pw });
    setBusy(null);
    if (!r.ok) { setRes({ id: c.id, err: r.reason === 'Konto nicht gefunden.' ? 'Diese Person hat noch kein Anmeldekonto.' : r.reason || 'Fehlgeschlagen.' }); return; }
    try { await app.mutate(KEYS.REG, (reg) => (reg || []).map((x) => (x.id === c.id ? { ...x, pwIsDefault: true } : x)), [], 'Passwort zurückgesetzt: ' + c.id); } catch (e) { /* Register-Markierung ist nebensächlich */ }
    setRes({ id: c.id, name: c.name, pw });
  }
  const defaults = citizens.filter((c) => c.pwIsDefault).length;
  return (
    <div className="stack-lg">
      <PageHead title="Anmeldedaten & Konten" sub="Passwörter verwaltet Supabase (bcrypt) – sie sind nirgends einsehbar und lassen sich nur neu setzen" />
      {defaults > 0 && <div className="alert-bar warn"><Badge tone="warn">Hinweis</Badge><span className="grow">{defaults} Konto/Konten nutzen noch ein Start- oder zurückgesetztes Passwort.</span></div>}
      {!allowed && <Msg m={{ ok: false, text: 'Passwörter zurücksetzen ist Ihnen nicht freigegeben.' }} />}
      {res && (res.err ? <Msg m={{ ok: false, text: res.err }} /> : <div className="stack"><Msg m={{ ok: true, text: 'Neues Passwort für ' + displayName(res.name) + ' gesetzt.' }} /><Secret label="Neues Passwort" value={res.pw} /></div>)}
      <input className="input" style={{ maxWidth: 340 }} placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 820 }}>
          <thead><tr>{['Konto', 'E-Mail (Login)', 'Anmeldekonto', 'Passwort', 'Status', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{list.map((c) => {
            const p = profiles.find((x) => x.citizen_id === c.id);
            return (
              <tr key={c.id} className={c.locked ? 'row-bad' : ''}>
                <td><strong>{displayName(c.name)}</strong><div className="mono small muted">{c.id} · L{c.is}</div></td>
                <td className="mono small">{c.loginEmail || '—'}</td>
                <td>{p ? <Badge tone="ok">vorhanden</Badge> : <Badge tone="warn">fehlt</Badge>}</td>
                <td>{c.pwIsDefault ? <Badge tone="warn">Standard</Badge> : <Badge>Eigenes</Badge>}</td>
                <td>{c.locked ? <Badge tone="bad">Gesperrt</Badge> : <Badge tone="ok">Aktiv</Badge>}</td>
                <td><Btn size="sm" disabled={!allowed || busy === c.id || (p && p.is_admin && !me.isAdmin)} onClick={() => reset(c)}>{busy === c.id ? '…' : 'Zurücksetzen'}</Btn></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!list.length && <Empty>Keine Treffer.</Empty>}
      </section>
    </div>
  );
}
