/* Spiele: Einträge des öffentlichen Spieleportals (Tabelle „spiele“, siehe sql/spiele.sql) */
import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { sb, Monitor } from '../lib/db.js';
import { KATEGORIEN, FORMATE, checkUrl, hostOf } from '../lib/spiele.js';
import { PageHead, Btn, Badge, Input, Textarea, Select, Panel, Empty, Msg, Corners } from '../components/ui.jsx';

const PORTAL_HREF = './spiele/';
const EMPTY = { id: null, titel: '', beschreibung: '', url: '', bild_url: '', kategorie: 'Sonstiges', format: '16:9', sortierung: 0, aktiv: true };

function isMissing(error) {
  const c = error && error.code;
  return c === '42P01' || c === 'PGRST205' || /does not exist|not find/i.test(String(error && error.message));
}
function explain(error) {
  if (!error) return 'Unbekannter Fehler.';
  if (error.code === '42501') return 'Dafür fehlt die Berechtigung (Spiele verwalten = Level 4).';
  if (error.code === '23514') return 'Die Datenbank hat die Angaben abgelehnt (Adresse muss mit https:// beginnen, Texte dürfen nicht zu lang sein).';
  return error.message || 'Die Aktion konnte nicht ausgeführt werden.';
}

export default function Spiele() {
  const app = useApp();
  const [rows, setRows] = useState(null);       // null = lädt
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('spiele').select('*').order('sortierung', { ascending: true }).order('erstellt_am', { ascending: false });
    if (error) {
      if (isMissing(error)) { setMissing(true); setRows([]); return; }
      setMsg({ ok: false, text: 'Die Spiele konnten nicht geladen werden: ' + explain(error) }); setRows([]); return;
    }
    setMissing(false); setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const url = checkUrl(f.url);
  const bild = checkUrl(f.bild_url, { optional: true });
  const titel = f.titel.trim();
  const valid = titel.length >= 1 && titel.length <= 80 && url.ok && bild.ok && f.beschreibung.length <= 2000 && f.kategorie.trim().length >= 1;
  const doppelt = url.ok && (rows || []).some((r) => r.url === url.url && r.id !== f.id);

  function done(text) { setMsg({ ok: true, text }); app.note(text, 'ok'); Monitor.logAction(text, 'spiele'); }

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const rec = { titel, beschreibung: f.beschreibung.trim(), url: url.url, bild_url: bild.url, kategorie: f.kategorie.trim().slice(0, 40),
      format: f.format, sortierung: Math.round(Number(f.sortierung) || 0), aktiv: !!f.aktiv };
    const res = f.id ? await sb.from('spiele').update(rec).eq('id', f.id).select('id') : await sb.from('spiele').insert(rec).select('id');
    setBusy(false);
    if (res.error) { setMsg({ ok: false, text: explain(res.error) }); return; }
    if (!res.data || !res.data.length) { setMsg({ ok: false, text: 'Es wurde nichts gespeichert – dafür fehlt die Berechtigung (Level 4).' }); return; }
    done((f.id ? 'Spiel geändert: ' : 'Spiel hinzugefügt: ') + titel);
    setF(EMPTY); load();
  }
  async function toggle(r) {
    const { data, error } = await sb.from('spiele').update({ aktiv: !r.aktiv }).eq('id', r.id).select('id');
    if (error || !data || !data.length) { setMsg({ ok: false, text: explain(error || { code: '42501' }) }); return; }
    done((r.aktiv ? 'Spiel ausgeblendet: ' : 'Spiel freigeschaltet: ') + r.titel); load();
  }
  async function remove(r) {
    if (!window.confirm('Spiel „' + r.titel + '“ endgültig löschen?')) return;
    const { data, error } = await sb.from('spiele').delete().eq('id', r.id).select('id');
    if (error || !data || !data.length) { setMsg({ ok: false, text: explain(error || { code: '42501' }) }); return; }
    if (f.id === r.id) setF(EMPTY);
    done('Spiel gelöscht: ' + r.titel); load();
  }
  function edit(r) {
    setF({ id: r.id, titel: r.titel, beschreibung: r.beschreibung || '', url: r.url, bild_url: r.bild_url || '', kategorie: r.kategorie, format: r.format, sortierung: r.sortierung, aktiv: r.aktiv });
    setMsg(null); window.scrollTo(0, 0);
  }

  const list = rows || [];
  const aktiv = list.filter((r) => r.aktiv).length;
  return (
    <div className="stack-lg">
      <PageHead title="Spiele" sub={'Öffentliches Spieleportal ohne Anmeldung · ' + aktiv + ' sichtbar, ' + (list.length - aktiv) + ' ausgeblendet'}
        actions={<a className="btn btn-sm" href={PORTAL_HREF} target="_blank" rel="noopener">Spieleportal öffnen ↗</a>} />
      <Msg m={msg} />
      {missing && (
        <div className="msg warn">
          Die Tabelle „spiele“ ist noch nicht eingerichtet. Bitte <code>sql/spiele.sql</code> einmal im Supabase-SQL-Editor ausführen und danach <Btn size="sm" onClick={load}>erneut laden</Btn>.
        </div>
      )}
      <div className="cols">
        <div className="col-2 stack">
          {rows === null && <Empty>Lade Spiele …</Empty>}
          {rows !== null && !list.length && !missing && <Empty>Noch keine Spiele. Rechts das erste Spiel hinzufügen.</Empty>}
          {list.map((r) => (
            <Panel key={r.id} className={f.id === r.id ? 'y' : ''}
              title={<div className="row"><h2>{r.titel}</h2><Badge tone="amber">{r.kategorie}</Badge><Badge tone={r.aktiv ? 'ok' : 'warn'}>{r.aktiv ? 'sichtbar' : 'ausgeblendet'}</Badge></div>}
              actions={<>
                {r.aktiv && <a className="btn btn-sm" href={PORTAL_HREF + '#/spiel/' + r.id} target="_blank" rel="noopener">Testen ↗</a>}
                <Btn size="sm" onClick={() => edit(r)}>Bearbeiten</Btn>
                <Btn size="sm" onClick={() => toggle(r)}>{r.aktiv ? 'Ausblenden' : 'Freischalten'}</Btn>
                <Btn size="sm" variant="danger" onClick={() => remove(r)}>Löschen</Btn>
              </>}>
              <div className="stack" style={{ gap: 8 }}>
                {r.beschreibung ? <p style={{ margin: 0, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{r.beschreibung}</p> : <p className="muted" style={{ margin: 0 }}>Keine Beschreibung.</p>}
                <div className="mono small" style={{ overflowWrap: 'anywhere' }}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a></div>
                <div className="muted small">Format {r.format} · Reihenfolge {r.sortierung} · {r.bild_url ? 'Bild von ' + hostOf(r.bild_url) : 'ohne Vorschaubild'}</div>
              </div>
            </Panel>
          ))}
        </div>
        <div className="col-1">
          <Corners yellow innerStyle={{ padding: 20 }}>
            <div className="stack">
              <h2>{f.id ? 'Spiel bearbeiten' : 'Neues Spiel'}</h2>
              <Input label="Titel" value={f.titel} maxLength={80} onChange={(e) => setF({ ...f, titel: e.target.value })} placeholder="z. B. Maisernte 3000" />
              <Input label="Adresse des Spiels (URL)" mono type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…"
                error={f.url.trim() && !url.ok ? url.reason : doppelt ? 'Diese Adresse ist bereits eingetragen.' : ''}
                hint="Diese Seite wird im Portal in einem Rahmen geladen. Manche Anbieter verbieten das Einbetten – nach dem Speichern mit „Testen“ prüfen." />
              <Textarea label="Beschreibung" rows={5} maxLength={2000} value={f.beschreibung} onChange={(e) => setF({ ...f, beschreibung: e.target.value })}
                placeholder="Worum geht es? Wie wird gesteuert?" hint={f.beschreibung.length + ' / 2000 Zeichen'} />
              <Input label="Vorschaubild (URL, optional)" mono type="url" value={f.bild_url} onChange={(e) => setF({ ...f, bild_url: e.target.value })} placeholder="https://…/bild.png"
                error={f.bild_url.trim() && !bild.ok ? bild.reason : ''} hint="Am besten quadratisch. Ohne Bild erscheint eine farbige Kachel mit dem Anfangsbuchstaben." />
              <label className="field">Kategorie
                <input className="input" list="spiele-kategorien" value={f.kategorie} maxLength={40} onChange={(e) => setF({ ...f, kategorie: e.target.value })} />
                <datalist id="spiele-kategorien">{[...new Set([...KATEGORIEN, ...list.map((r) => r.kategorie)])].map((k) => <option key={k} value={k} />)}</datalist>
              </label>
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <Select label="Format" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>{FORMATE.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
                <Input label="Reihenfolge" type="number" value={f.sortierung} onChange={(e) => setF({ ...f, sortierung: e.target.value })} hint="kleiner = weiter vorn" />
              </div>
              <label className="check"><input type="checkbox" checked={f.aktiv} onChange={(e) => setF({ ...f, aktiv: e.target.checked })} /><span>Im Spieleportal sichtbar</span></label>
              <div className="row">
                <Btn variant="solid" disabled={!valid || doppelt || busy || missing} onClick={save}>{f.id ? 'Änderungen speichern' : 'Spiel hinzufügen'}</Btn>
                {f.id && <Btn variant="ghost" onClick={() => setF(EMPTY)}>Abbrechen</Btn>}
              </div>
            </div>
          </Corners>
        </div>
      </div>
    </div>
  );
}
