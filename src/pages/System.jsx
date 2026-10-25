/* System & Wartung: Wartungsmodus, Neuladen aller Instanzen, Sicherung, Patch Notes */
import React, { useRef, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { Store, Monitor } from '../lib/db.js';
import { KEYS, can, displayName, sha256Hex } from '../lib/model.js';
import { downloadText, fmtDT } from '../lib/format.js';
import { PageHead, Btn, Badge, Panel, Msg, Field, Corners, Empty, Textarea } from '../components/ui.jsx';

export default function System() {
  const { me } = useApp();
  const any = can(me, 'maintenance') || can(me, 'reload.all') || can(me, 'backup.export') || can(me, 'backup.import') || can(me, 'patchnotes.edit');
  return (
    <div className="stack-lg">
      <PageHead title="System & Wartung" sub="Steuerung des Bürgerportals · alle Schaltvorgänge werden protokolliert" />
      {!any && <Empty>Für keine Systemfunktion freigeschaltet (Administrator-Rechte).</Empty>}
      <div className="cols">
        {can(me, 'maintenance') && <div className="col-1"><Maintenance /></div>}
        <div className="col-1 stack">
          {can(me, 'reload.all') && <Reload />}
          {(can(me, 'backup.export') || can(me, 'backup.import')) && <Backup />}
        </div>
      </div>
      {can(me, 'patchnotes.edit') && <PatchNotes />}
    </div>
  );
}

function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const a = window.crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(a).map((b) => abc[b % abc.length]).join(''); return raw.slice(0, 4) + '-' + raw.slice(4);
}
function Maintenance() {
  const app = useApp();
  const m = app.val(KEYS.MAINT, {}) || {};
  const [until, setUntil] = useState(m.until || ''); const [target, setTarget] = useState(m.target || '');
  const [code, setCode] = useState(''); const [input, setInput] = useState(''); const [msg, setMsg] = useState(null);
  const set = async (next, text) => { try { await app.mutate(KEYS.MAINT, () => next, {}, text); setMsg({ ok: true, text }); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  async function start() {
    if (!window.confirm('Wartungsmodus starten? ' + (target ? displayName(app.nameOf(target)) + ' wird gesperrt.' : 'Alle Nutzer unter Level 6 sehen nur noch die Wartungsseite.'))) return;
    const c = makeCode(); await set({ on: true, until: until.trim(), target, codeHash: await sha256Hex(c) }, 'Wartungsmodus gestartet' + (target ? ' (gezielt: ' + target + ')' : '')); setCode(c);
  }
  async function stop() {
    if (m.codeHash && (await sha256Hex(input.trim().toUpperCase())) !== m.codeHash) { setMsg({ ok: false, text: 'Der Code ist nicht richtig. Die Wartung bleibt aktiv.' }); return; }
    await set({ on: false, until: '', target: '', codeHash: '' }, 'Wartungsmodus beendet'); setCode(''); setInput('');
  }
  return (
    <Corners yellow innerStyle={{ padding: 22 }}>
      <div className="stack">
        <div className="row-between"><h2>Wartungsmodus</h2><Badge tone={m.on ? 'solid-bad' : 'ok'}>{m.on ? (m.target ? 'Gezielt aktiv' : 'Aktiv') : 'Aus'}</Badge></div>
        <p className="muted small" style={{ margin: 0 }}>Aktiv sehen alle Nutzer außer Level 6 eine Wartungsmeldung. Beim Start entsteht ein Einmalcode, der nur als Prüfsumme gespeichert wird und zum Beenden nötig ist.</p>
        <Field label="Voraussichtlich verfügbar ab"><input className="input" value={until} onChange={(e) => setUntil(e.target.value)} placeholder="z. B. ca. 18:00 Uhr" /></Field>
        <Field label="Gezielt nur für eine Person (optional)"><select className="select" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">— Alle (außer Level 6) —</option>
          {app.citizens.slice().sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'de')).map((c) => <option key={c.id} value={c.id}>{displayName(c.name)} · {c.id}</option>)}</select></Field>
        {!m.on ? <div><Btn variant="danger" onClick={start}>Wartung starten</Btn></div>
          : <div><Btn onClick={() => set({ ...m, until: until.trim(), target }, 'Wartungsangaben aktualisiert')}>Angaben aktualisieren</Btn></div>}
        {code && <div className="secret"><div className="eyebrow" style={{ color: 'var(--y)' }}>Einmalcode zum Beenden – jetzt notieren</div><div className="secret-v">{code}</div></div>}
        {m.on && <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {m.codeHash && <Field label="Einmalcode"><input className="input big mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="XXXX-XXXX" onKeyDown={(e) => { if (e.key === 'Enter') stop(); }} /></Field>}
          <div><Btn variant="primary" disabled={!!m.codeHash && !input.trim()} onClick={stop}>Wartung beenden</Btn></div>
          <div className="muted small">Code verloren? Notausgang: Eintrag <code>{KEYS.MAINT}</code> in der Tabelle kv im Supabase-Dashboard löschen.</div></div>}
        <Msg m={msg} />
      </div>
    </Corners>
  );
}

function Reload() {
  const app = useApp();
  const [msg, setMsg] = useState(null);
  async function go() {
    if (!window.confirm('Alle geöffneten Portale (alle Geräte und Tabs) jetzt neu laden?')) return;
    try { await app.mutate(KEYS.RELOAD, () => Date.now(), 0, 'Neuladen aller Instanzen ausgelöst'); setMsg({ ok: true, text: 'Signal gesendet – geöffnete Portale laden sich neu.' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const last = app.val(KEYS.RELOAD, 0);
  return (
    <Panel title="Offene Instanzen neu laden">
      <p className="muted small">Fordert alle geöffneten Bürgerportale auf, sich sofort neu zu laden – z. B. nach einem neuen Stand. {last ? 'Zuletzt: ' + fmtDT(Number(last)) : ''}</p>
      <Btn variant="primary" onClick={go}>Alle Instanzen neu laden</Btn>
      <div style={{ marginTop: 10 }}><Msg m={msg} /></div>
    </Panel>
  );
}

const BACKUP_KEYS = [KEYS.REG, KEYS.TYPES, KEYS.TYPEUNITS, KEYS.APPTS, KEYS.APPS, KEYS.SURVEYS, KEYS.ELECTIONS, KEYS.RECORDS, KEYS.WARRANTS, KEYS.UNITS, KEYS.PERMS, KEYS.CHAT, KEYS.ANNOUNCE, KEYS.SUPPORT, KEYS.FEATURES, KEYS.PATCHNOTES, KEYS.MAINT];
function Backup() {
  const app = useApp();
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false); const ref = useRef(null);
  async function doExport() {
    const data = {}; for (const k of BACKUP_KEYS) { const r = await Store.getRaw(k); if (r.ok && r.value !== null) data[k] = r.value; }
    downloadText('maiskolbistan-sicherung-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ _app: 'maiskolbistan-buergerportal', _version: 1, _exportedAt: new Date().toISOString(), _source: 'abis-konsole', data }, null, 2), 'application/json');
    app.note('Sicherung heruntergeladen', 'warn'); Monitor.logAction('Sicherung heruntergeladen', null, { keys: Object.keys(data).length });
    setMsg({ ok: true, text: 'Sicherung heruntergeladen. Die Datei enthält personenbezogene Daten – sicher aufbewahren.' });
  }
  async function doImport(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try {
      const obj = JSON.parse(await file.text()); const d = obj && obj.data;
      if (!d || !Array.isArray(d[KEYS.REG]) || !d[KEYS.REG].length) { setMsg({ ok: false, text: 'Die Datei enthält kein gültiges Bürgerregister.' }); return; }
      if (!window.confirm('Sicherung einspielen? Alle aktuellen Portaldaten werden überschrieben (' + d[KEYS.REG].length + ' Bürger).')) return;
      setBusy(true);
      const keys = BACKUP_KEYS.filter((k) => d[k] !== undefined);
      for (const k of keys) await Store.set(k, d[k]);
      await app.reloadAll(); app.note('Sicherung eingespielt (' + keys.length + ' Bereiche)', 'bad'); Monitor.logAction('Sicherung eingespielt', file.name, { keys });
      setMsg({ ok: true, text: 'Sicherung eingespielt – ' + d[KEYS.REG].length + ' Bürger wiederhergestellt.' });
    } catch (err) { setMsg({ ok: false, text: 'Einspielen fehlgeschlagen: ' + (err.message || 'ungültige Datei') }); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <Panel title="Sicherung">
      <p className="muted small">Vollständige Sicherung aller Portaldaten (Register, Termine, Chats …) als JSON – kompatibel mit der Sicherung im Bürgerportal. Passwörter sind nicht enthalten.</p>
      <div className="row">
        {can(app.me, 'backup.export') && <Btn variant="primary" onClick={doExport}>Herunterladen</Btn>}
        {can(app.me, 'backup.import') && <><Btn variant="danger" disabled={busy} onClick={() => ref.current && ref.current.click()}>{busy ? 'Spielt ein …' : 'Einspielen'}</Btn>
          <input ref={ref} type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} /></>}
      </div>
      <div style={{ marginTop: 10 }}><Msg m={msg} /></div>
    </Panel>
  );
}

function PatchNotes() {
  const app = useApp();
  const notes = app.val(KEYS.PATCHNOTES, null);
  const [draft, setDraft] = useState(null); const [msg, setMsg] = useState(null);
  const list = Array.isArray(notes) ? notes : [];
  function start() { setDraft(list.map((n) => ({ version: n.version || '', date: n.date || '', title: n.title || '', items: (n.items || []).join('\n') }))); }
  async function save() {
    const next = draft.map((d) => ({ version: d.version.trim(), date: d.date.trim(), title: d.title.trim(), items: d.items.split('\n').map((s) => s.trim()).filter(Boolean) })).filter((n) => n.version || n.items.length);
    try { await app.mutate(KEYS.PATCHNOTES, () => next, [], 'Patch Notes gespeichert'); setDraft(null); setMsg({ ok: true, text: 'Gespeichert.' }); } catch (e) { setMsg({ ok: false, text: e.message }); }
  }
  const upd = (i, k, v) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <Panel title="Öffentliche Patch Notes" actions={!draft ? <Btn size="sm" onClick={start}>Bearbeiten</Btn> : <><Btn size="sm" onClick={() => setDraft([{ version: '', date: '', title: '', items: '' }, ...draft])}>+ Version</Btn><Btn size="sm" variant="primary" onClick={save}>Speichern</Btn><Btn size="sm" variant="ghost" onClick={() => setDraft(null)}>Abbrechen</Btn></>}>
      <Msg m={msg} />
      {!draft ? (!list.length ? <Empty>Keine eigenen Patch Notes gespeichert – das Portal zeigt seine eingebaute Liste.</Empty> : list.map((n, i) => (
        <div key={i} style={{ marginBottom: 14 }}><div className="row"><Badge tone="amber">Version {n.version}</Badge><span className="muted small">{n.date}</span><strong>{n.title}</strong></div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--text-2)' }}>{(n.items || []).map((it, j) => <li key={j}>{it}</li>)}</ul></div>)))
        : draft.map((d, i) => (
          <div key={i} className="stack" style={{ gap: 8, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input" style={{ width: 120 }} value={d.version} onChange={(e) => upd(i, 'version', e.target.value)} placeholder="Version" aria-label="Version" />
              <input className="input" style={{ width: 150 }} value={d.date} onChange={(e) => upd(i, 'date', e.target.value)} placeholder="Datum" aria-label="Datum" />
              <input className="input" value={d.title} onChange={(e) => upd(i, 'title', e.target.value)} placeholder="Titel" aria-label="Titel" />
              <Btn size="sm" variant="danger" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>✕</Btn>
            </div>
            <Textarea label="Änderungen (eine pro Zeile)" rows={4} value={d.items} onChange={(e) => upd(i, 'items', e.target.value)} />
          </div>))}
    </Panel>
  );
}
