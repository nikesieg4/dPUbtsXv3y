/* Bürgerregister: Stammdaten, Zuordnungen, Level, Sperre, Anlegen, Löschen */
import React, { useMemo, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { adminAction } from '../lib/db.js';
import { KEYS, can, IS_LABEL, ALL_UNITS, MINISTRIES, ORGANE, BUNDES, APP_STEPS, displayName, unitShort, loginEmailFor, genPassword, maxAssignableLevel } from '../lib/model.js';
import { PageHead, Btn, Badge, Input, Panel, Empty, Kv, Msg, Secret, Corners } from '../components/ui.jsx';

export default function Register() {
  const app = useApp();
  const { citizens, units, me, profiles } = app;
  const [q, setQ] = useState(''); const [filter, setFilter] = useState('alle');
  const [openId, setOpenId] = useState(null); const [adding, setAdding] = useState(false); const [created, setCreated] = useState(null);
  const unitNames = (units.length ? units.map((u) => u.name) : ALL_UNITS).slice().sort((a, b) => unitShort(a).localeCompare(unitShort(b), 'de'));
  const list = citizens.filter((c) => {
    if (filter === 'zivil' && c.ministries.length) return false;
    if (filter === 'gesperrt' && !c.locked) return false;
    if (filter === 'priv' && !(c.is >= 5)) return false;
    if (!['alle', 'zivil', 'gesperrt', 'priv'].includes(filter) && !c.ministries.includes(filter)) return false;
    return (displayName(c.name) + ' ' + c.name + c.id + (c.role || '') + c.ministries.join(' ')).toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de'));
  const open = citizens.find((c) => c.id === openId);
  const nextId = useMemo(() => {
    const ids = [...citizens.map((c) => c.id), ...profiles.map((p) => p.citizen_id)];
    const nums = ids.filter((id) => String(id).startsWith('MK-2025')).map((id) => Number(String(id).split('-')[2]) || 0);
    return 'MK-2025-' + String(Math.max(0, ...nums) + 1).padStart(4, '0');
  }, [citizens, profiles]);

  if (adding) return <AddCitizen nextId={nextId} onCancel={() => setAdding(false)} onDone={(c) => { setAdding(false); setCreated(c); }} />;
  if (open) return <Detail c={open} onBack={() => setOpenId(null)} />;

  const chip = (k, l) => <button key={k} type="button" className={'chip ' + (filter === k ? 'on' : '')} onClick={() => setFilter(k)}>{l}</button>;
  return (
    <div className="stack-lg">
      <PageHead title="Bürgerregister" sub={citizens.length + ' Bürger · Level stammen aus der Datenbank (profiles)'}
        actions={can(me, 'register.create') && <Btn variant="primary" onClick={() => setAdding(true)}>+ Bürger anlegen</Btn>} />
      {created && <div className="stack"><Msg m={{ ok: true, text: displayName(created.name) + ' angelegt (' + created.id + '). Startpasswort bitte notieren und übermitteln.' }} /><Secret label="Startpasswort" value={created.password} /><div><Btn size="sm" onClick={() => setCreated(null)}>Verstanden</Btn></div></div>}
      <div className="filters" style={{ alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Name, Bürger-Nr., Rolle …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
        <div className="chips">
          {chip('alle', 'Alle (' + citizens.length + ')')}{chip('priv', 'Level 5+ (' + citizens.filter((c) => c.is >= 5).length + ')')}
          {chip('gesperrt', 'Gesperrt (' + citizens.filter((c) => c.locked).length + ')')}{chip('zivil', 'Zivilisten (' + citizens.filter((c) => !c.ministries.length).length + ')')}
          {unitNames.map((u) => chip(u, unitShort(u) + ' (' + citizens.filter((c) => c.ministries.includes(u)).length + ')'))}
        </div>
      </div>
      <section className="panel table-wrap">
        <table className="table" style={{ minWidth: 820 }}>
          <thead><tr>{['Name', 'Bürger-Nr.', 'Rolle', 'Zuordnungen', 'Level', 'Status', 'Letzte Anmeldung'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{list.map((c) => (
            <tr key={c.id} className={'click ' + (c.locked ? 'row-bad' : '')} onClick={() => setOpenId(c.id)}>
              <td><strong>{displayName(c.name)}</strong></td><td className="mono small">{c.id}</td><td className="small">{c.role || '—'}</td>
              <td className="small">{c.ministries.length ? c.ministries.map(unitShort).join(', ') : <span className="muted">Zivilist</span>}</td>
              <td><Badge tone={c.is >= 5 ? 'amber' : ''}>L{c.is}</Badge></td>
              <td>{c.locked ? <Badge tone="bad">Gesperrt</Badge> : <Badge tone="ok">Aktiv</Badge>}</td>
              <td className="small muted">{c.lastLogin || '—'}</td>
            </tr>))}</tbody>
        </table>
        {!list.length && <Empty>Keine Treffer.</Empty>}
      </section>
    </div>
  );
}

function AddCitizen({ nextId, onCancel, onDone }) {
  const app = useApp();
  const [f, setF] = useState({ name: '', born: '', email: '', other: 'Deutsch', role: 'Bürger', status: 'Staatsbürger' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function add() {
    setBusy(true); setErr('');
    const pw = genPassword(12);
    const c = { ...f, name: f.name.trim(), id: nextId, is: 0, since: new Date().toLocaleDateString('de-DE'), admin: false, ministries: [], loginEmail: loginEmailFor(f), pwIsDefault: true, locked: false, lastLogin: null };
    const r = await adminAction('create-user', { email: c.loginEmail, password: pw, citizen_id: c.id, name: c.name, level: 0, ministries: [] });
    if (!r || !r.ok) { setBusy(false); setErr((r && r.reason) || 'Konto konnte nicht angelegt werden.'); return; }
    try { await app.mutate(KEYS.REG, (reg) => [...(reg || []), c], [], 'Bürger angelegt: ' + c.name + ' (' + c.id + ')'); }
    catch (e) { setBusy(false); setErr('Konto angelegt, aber Eintrag ins Register fehlgeschlagen: ' + e.message); return; }
    await app.reloadAll(); setBusy(false); onDone({ ...c, password: pw });
  }
  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <PageHead title="Bürger anlegen" sub={'Neue Bürger-Nr. ' + nextId + ' · Konto + Profil legt die Server-Funktion an'} actions={<Btn onClick={onCancel}>← Zurück</Btn>} />
      <Corners yellow innerStyle={{ padding: 22 }}>
        <div className="stack">
          <Input label="Voller Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Vor- und Nachname" />
          <div className="cols" style={{ gap: 12 }}>
            <div className="col-1"><Input label="Geburtsdatum" value={f.born} onChange={(e) => setF({ ...f, born: e.target.value })} placeholder="TT.MM.JJJJ" /></div>
            <div className="col-1"><Input label="E-Mail (Login)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} hint="Leer = automatisch @buerger.maiskolbistan.mk" /></div>
          </div>
          <div className="cols" style={{ gap: 12 }}>
            <div className="col-1"><Input label="Andere Staatsbürgerschaft" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })} /></div>
            <div className="col-1"><Input label="Amt / Rolle" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
          </div>
          <div className="muted small">Neue Bürger erhalten Level 0. Das Startpasswort wird einmalig angezeigt.</div>
          {err && <Msg m={{ ok: false, text: err }} />}
          <div className="row"><Btn variant="solid" disabled={busy || f.name.trim().length < 3} onClick={add}>{busy ? 'Wird angelegt …' : 'Bürger eintragen'}</Btn><Btn variant="ghost" onClick={onCancel}>Abbrechen</Btn></div>
        </div>
      </Corners>
    </div>
  );
}

function Detail({ c, onBack }) {
  const app = useApp();
  const { me, units } = app;
  const [msg, setMsg] = useState(null); const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [confirmDel, setConfirmDel] = useState(false);
  const [ed, setEd] = useState({});
  const canEdit = can(me, 'register.edit');
  const cap = maxAssignableLevel(me);
  const canLevel = can(me, 'register.level') && me.id !== c.id && c.is <= cap;
  const canLock = can(me, 'register.lock') && me.id !== c.id;
  const canDelete = can(me, 'register.delete') && me.id !== c.id;
  const apps = (app.val(KEYS.APPS, []) || []).filter((a) => a.ownerId === c.id);
  const appts = (app.val(KEYS.APPTS, []) || []).filter((a) => a.ownerId === c.id);
  const patchReg = (patch, text) => app.mutate(KEYS.REG, (reg) => (reg || []).map((x) => (x.id === c.id ? { ...x, ...patch } : x)), [], text);
  const run = async (fn) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ ok: false, text: e.message || 'Fehlgeschlagen.' }); } setBusy(false); };

  function startEdit() { setEd({ name: c.name || '', born: c.born || '', address: c.address || '', email: c.loginEmail || c.email || '', role: c.role || '' }); setEditing(true); }
  const saveEdit = () => run(async () => {
    const email = ed.email.trim();
    await patchReg({ name: ed.name.trim() || c.name, born: ed.born.trim(), address: ed.address.trim(), role: ed.role.trim() || c.role, email: email || c.email, loginEmail: email || c.loginEmail }, 'Stammdaten geändert: ' + c.id);
    setEditing(false); setMsg({ ok: true, text: 'Stammdaten gespeichert.' + (email && email !== c.loginEmail ? ' Hinweis: Die Anmeldeadresse bei Supabase ändert sich dadurch nicht.' : '') });
  });
  const toggleUnit = (u) => run(async () => {
    const next = c.ministries.includes(u) ? c.ministries.filter((x) => x !== u) : [...c.ministries, u];
    await patchReg({ ministries: next }, 'Zuordnung geändert: ' + c.id + ' → ' + (next.join(', ') || 'Zivilist'));
    const r = await adminAction('set-ministries', { citizen_id: c.id, ministries: next });
    if (!r.ok) setMsg({ ok: false, tone: 'warn', text: 'Register geändert, Profil nicht: ' + (r.reason || 'Fehler') });
    await app.reloadAll();
  });
  const setLevel = (lvl) => run(async () => {
    const r = await adminAction('set-level', { citizen_id: c.id, level: lvl });
    if (!r.ok) { setMsg({ ok: false, text: r.reason || 'Level konnte nicht gesetzt werden.' }); return; }
    await patchReg({ is: lvl }, 'Level gesetzt: ' + c.id + ' → L' + lvl);
    await app.reloadAll(); setMsg({ ok: true, text: 'Level ' + lvl + ' gesetzt.' });
  });
  const toggleLock = () => run(async () => {
    const next = !c.locked;
    const r = await adminAction('set-locked', { citizen_id: c.id, locked: next });
    if (!r.ok) { setMsg({ ok: false, text: r.reason === 'Konto nicht gefunden.' ? 'Diese Person hat noch kein Anmeldekonto.' : r.reason || 'Fehlgeschlagen.' }); return; }
    await patchReg({ locked: next }, (next ? 'Konto gesperrt: ' : 'Konto entsperrt: ') + c.id);
    setMsg({ ok: true, text: next ? 'Konto gesperrt – Anmeldung ist nicht mehr möglich.' : 'Konto entsperrt.' });
  });
  const del = () => run(async () => {
    await app.mutate(KEYS.REG, (reg) => (reg || []).filter((x) => x.id !== c.id), [], 'Bürger gelöscht: ' + c.name + ' (' + c.id + ')');
    await app.mutate(KEYS.APPS, (a) => (a || []).filter((x) => x.ownerId !== c.id), []);
    await app.mutate(KEYS.APPTS, (a) => (a || []).filter((x) => x.ownerId !== c.id), []);
    onBack();
  });

  const list = units.length ? units.map((u) => ({ name: u.name, kind: u.kind })) : [...MINISTRIES.map((n) => ({ name: n, kind: 'ministerium' })), ...ORGANE.map((n) => ({ name: n, kind: 'organ' })), ...BUNDES.map((n) => ({ name: n, kind: 'bundes' }))];
  const groups = [['Ministerien', 'ministerium'], ['Sicherheitsorgane', 'organ'], ['Bundesverwaltung', 'bundes']];
  return (
    <div className="stack-lg" style={{ maxWidth: 980 }}>
      <PageHead title={displayName(c.name)} sub={c.id + ' · Level ' + c.is + ' (' + IS_LABEL[c.is] + ')' + (c.locked ? ' · GESPERRT' : '')} actions={<Btn onClick={onBack}>← Zurück zum Register</Btn>} />
      <Msg m={msg} />
      <div className="cols">
        <div className="col-2 stack">
          <Panel title="Stammdaten" actions={canEdit && !editing && <Btn size="sm" onClick={startEdit}>Bearbeiten</Btn>}>
            {!editing ? <Kv rows={[['Name', displayName(c.name)], ['Amt / Rolle', c.role || '—'], ['Geburtsdatum', c.born || '—'], ['Adresse', c.address || '—'], ['Bürger seit', c.since || '—'],
              ['E-Mail (Login)', <span className="mono small">{c.loginEmail || loginEmailFor(c)}</span>], ['Andere Staatsb.', c.other || '—'], ['Letzte Anmeldung', c.lastLogin || '—'], ['Standardpasswort', c.pwIsDefault ? <Badge tone="warn">ja</Badge> : 'nein']]} />
              : <div className="stack">
                <Input label="Voller Name" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} />
                <div className="cols" style={{ gap: 12 }}><div className="col-1"><Input label="Geburtsdatum" value={ed.born} onChange={(e) => setEd({ ...ed, born: e.target.value })} /></div><div className="col-1"><Input label="Amt / Rolle" value={ed.role} onChange={(e) => setEd({ ...ed, role: e.target.value })} /></div></div>
                <Input label="Adresse" value={ed.address} onChange={(e) => setEd({ ...ed, address: e.target.value })} />
                <Input label="E-Mail (Login)" value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} />
                <div className="row"><Btn variant="primary" disabled={busy} onClick={saveEdit}>Speichern</Btn><Btn variant="ghost" onClick={() => setEditing(false)}>Abbrechen</Btn></div>
              </div>}
          </Panel>
          <Panel title="Zuordnungen">
            {groups.map(([t, k]) => { const arr = list.filter((u) => u.kind === k).sort((a, b) => a.name.localeCompare(b.name, 'de')); return arr.length ? (
              <div key={k} style={{ marginBottom: 12 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{t}</div>
                <div className="chips">{arr.map((u) => <button key={u.name} type="button" className={'chip ' + (c.ministries.includes(u.name) ? 'on' : '')} disabled={!canEdit || busy} onClick={() => toggleUnit(u.name)}>{c.ministries.includes(u.name) ? '✓ ' : ''}{u.name}</button>)}</div></div>) : null; })}
            <div className="muted small">{canEdit ? 'Änderungen gehen ins Register und ins Profil (Server-Funktion).' : 'Ändern erst ab Level 4.'}</div>
          </Panel>
          <Panel title={'Bewerbungen (' + apps.length + ') · Termine (' + appts.length + ')'}>
            {apps.map((a) => <div key={a.id} className="list-row"><span>{a.title} <span className="muted small">· {a.ref}</span></span><Badge tone={a.status === 'abgelehnt' ? 'bad' : a.step >= 3 ? 'ok' : 'warn'}>{a.status || APP_STEPS[Math.min(a.step || 0, 3)]}</Badge></div>)}
            {appts.map((a) => <div key={a.id} className="list-row"><span>{a.title} <span className="muted small">· {a.date} {a.time}</span></span><Badge>{a.status}</Badge></div>)}
            {!apps.length && !appts.length && <Empty>Keine Vorgänge.</Empty>}
          </Panel>
        </div>
        <div className="col-1 stack">
          <Corners yellow innerStyle={{ padding: 20 }}>
            <div className="stack">
              <h2>Sicherheit</h2>
              <label className="field">Level (Freigabestufe)
                <select className="select" value={c.is} disabled={!canLevel || busy} onChange={(e) => { if (window.confirm('Level von ' + displayName(c.name) + ' auf ' + e.target.value + ' setzen?')) setLevel(Number(e.target.value)); }}>
                  {Array.from({ length: Math.max(cap, c.is) + 1 }, (_, n) => <option key={n} value={n} disabled={n > cap}>Level {n} · {IS_LABEL[n]}</option>)}
                </select>
                <span className="hint">{canLevel ? 'Sie können maximal Level ' + cap + ' vergeben.' : 'Nicht änderbar (Recht oder Stufe fehlt).'}</span>
              </label>
              <div className="field">Kontostatus
                {canLock ? <Btn variant={c.locked ? 'primary' : 'danger'} disabled={busy} onClick={() => { if (window.confirm(c.locked ? 'Konto entsperren?' : 'Konto sperren? Die Person kann sich danach nicht mehr anmelden.')) toggleLock(); }}>{c.locked ? 'Konto entsperren' : 'Konto sperren'}</Btn>
                  : <Badge tone={c.locked ? 'bad' : 'ok'}>{c.locked ? 'Gesperrt' : 'Aktiv'}</Badge>}
                <span className="hint">Die Sperre gilt direkt bei der Anmeldung (Supabase-Bann).</span>
              </div>
            </div>
          </Corners>
          {canDelete && (
            <Panel title="Bürger löschen" className="alert-bad">
              <p className="muted small">Entfernt den Registereintrag samt Bewerbungen und Terminen. Das Anmeldekonto bei Supabase bleibt bestehen – vorher sperren.</p>
              {!confirmDel ? <Btn variant="danger" onClick={() => setConfirmDel(true)}>Löschen …</Btn>
                : <div className="row"><Btn variant="danger" disabled={busy} onClick={del}>Ja, endgültig löschen</Btn><Btn variant="ghost" onClick={() => setConfirmDel(false)}>Abbrechen</Btn></div>}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

