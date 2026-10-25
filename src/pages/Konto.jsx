/* Mein Konto: Identität, Rechte, eigenes Passwort ändern */
import React, { useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { Auth, Monitor } from '../lib/db.js';
import { IS_LABEL, CAPS, can, displayName } from '../lib/model.js';
import { IDLE_LOGOUT_MIN } from '../config.js';
import { PageHead, Btn, Badge, Panel, Kv, Msg, Input, Corners } from '../components/ui.jsx';

export default function Konto() {
  const { me } = useApp();
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [conf, setConf] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const strong = nw.length >= 12 && /[A-Z]/.test(nw) && /[a-z]/.test(nw) && /\d/.test(nw);
  async function submit() {
    if (nw !== conf) return setMsg({ ok: false, text: 'Die neuen Passwörter stimmen nicht überein.' });
    if (nw.length < 10) return setMsg({ ok: false, text: 'Mindestens 10 Zeichen.' });
    setBusy(true); const r = await Auth.changePassword(cur, nw); setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'Passwort geändert.' }); setCur(''); setNw(''); setConf(''); Monitor.logAction('Eigenes Passwort geändert'); } else setMsg({ ok: false, text: r.reason });
  }
  return (
    <div className="stack-lg">
      <PageHead title="Mein Konto" sub={'Automatische Abmeldung nach ' + IDLE_LOGOUT_MIN + ' Minuten ohne Eingabe'} />
      <div className="cols">
        <div className="col-2">
          <Panel title="Identität">
            <Kv rows={[['Name', me.isAdmin ? 'Administrator' : displayName(me.name)], ['Bürger-Nr.', <span className="mono">{me.id}</span>], ['E-Mail', <span className="mono">{me.email}</span>],
              ['Level', <><Badge tone="amber">L{me.is}</Badge> {IS_LABEL[me.is]}{me.is !== me.baseLevel ? ' (Profil: L' + me.baseLevel + ', angehoben durch Zuordnung)' : ''}</>],
              ['Administrator', me.isAdmin ? <Badge tone="bad">ja</Badge> : 'nein'], ['Zuordnungen', me.ministries.join(', ') || '—']]} />
            <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Wirksame Einzelrechte</div>
            <div className="chips">{CAPS.map((c) => <span key={c.id} className={'chip ' + (can(me, c.id) ? 'on' : '')} style={{ cursor: 'default' }}>{can(me, c.id) ? '✓ ' : '✕ '}{c.label}</span>)}</div>
          </Panel>
        </div>
        <div className="col-1">
          <Corners yellow innerStyle={{ padding: 20 }}>
            <div className="stack">
              <h2>Passwort ändern</h2>
              <Input label="Aktuelles Passwort" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
              <Input label="Neues Passwort" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} hint={nw ? (strong ? 'Stark' : 'Empfehlung: ab 12 Zeichen, Groß-/Kleinbuchstaben und Ziffern') : undefined} />
              <Input label="Wiederholen" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
              <Msg m={msg} />
              <Btn variant="solid" disabled={busy || !cur || !nw} onClick={submit}>{busy ? 'Ändert …' : 'Passwort ändern'}</Btn>
            </div>
          </Corners>
        </div>
      </div>
    </div>
  );
}
