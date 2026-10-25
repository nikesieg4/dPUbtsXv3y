/* Anmeldung im Terminal-Stil */
import React, { useEffect, useRef, useState } from 'react';
import { Emblem, Btn } from '../components/ui.jsx';
import { pingDb } from '../lib/db.js';
import { SUPABASE_URL, APP_VERSION } from '../config.js';

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iOS'; if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS'; if (/Windows/.test(ua)) return 'Windows'; if (/Linux/.test(ua)) return 'Linux';
  return 'Unbekannt';
}

export default function Login({ onLogin, notice }) {
  const [ident, setIdent] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fails, setFails] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [db, setDb] = useState(null);
  const userRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { pingDb().then(setDb); userRef.current && userRef.current.focus(); }, []);

  const locked = lockUntil > now;
  async function submit(e) {
    e.preventDefault();
    if (locked || busy) return;
    setBusy(true); setErr('');
    const r = await onLogin(ident, pw);
    setBusy(false);
    if (!r.ok) {
      const n = fails + 1; setFails(n); setPw('');
      setErr(r.reason || 'Anmeldung fehlgeschlagen.');
      if (n >= 3) setLockUntil(Date.now() + Math.min(300, 15 * 2 ** (n - 3)) * 1000);   // wachsende Wartezeit nach Fehlversuchen
    }
  }
  const time = new Date(now).toLocaleTimeString('de-DE');
  const host = new URL(SUPABASE_URL).host;

  return (
    <div className="login">
      <div className="login-wrap">
        <div className="login-main">
          <div className="login-tabs">
            <span className="tab" style={{ cursor: 'default' }}>Bürgerportal</span>
            <span className="tab active" style={{ cursor: 'default' }}>ABIS-Konsole</span>
          </div>
          <div className="login-term">
            <h1>Sicherheitskonsole<br />Bürgerportal</h1>
            <div className="org">ADMINISTRATION FÜR BUCHHALTUNG UND INFORMATIONSSICHERHEIT</div>
            <div className="emblem"><Emblem size={150} /></div>
            <div className="login-welcome">Willkommen an der ABIS-Sicherheitskonsole</div>
            <div className="login-hint">Zugang nur für befugtes Personal · jeder Zugriff wird protokolliert</div>

            <form className="login-form" onSubmit={submit} autoComplete="on">
              <div className="prompt">abis@konsole:<span>~</span>$ anmelden</div>
              <label className="field">Kennung (E-Mail-Adresse oder „Administrator“)
                <input ref={userRef} className="input big" value={ident} onChange={(e) => setIdent(e.target.value)} autoComplete="username" spellCheck="false" required />
              </label>
              <label className="field">Passwort
                <input className="input big" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
              </label>
              {(err || notice) && <div className="msg bad" role="alert">{err || notice}</div>}
              {locked && <div className="msg warn">Zu viele Fehlversuche. Nächster Versuch in {Math.ceil((lockUntil - now) / 1000)} s.</div>}
              <Btn variant="solid" size="lg" block type="submit" disabled={busy || locked || !ident || !pw}>{busy ? 'Prüfe Zugang …' : 'Zugang anfordern'}</Btn>
            </form>
          </div>
          <div className="banner" style={{ marginTop: 28 }}>ABIS-Konsole</div>
          <div className="banner-sub"><b>Republik Maiskolbistan</b> Administration für Buchhaltung und Informationssicherheit · v{APP_VERSION}</div>
        </div>

        <aside className="login-side">
          <div className="info-list">
            <div className="info-title">Allgemeine Informationen</div>
            <div><div className="k">Zeit:</div><div className="clock" style={{ fontSize: 40 }}>{time}</div></div>
            <div><div className="k">Endgerät:</div><div className="v">{deviceName()}</div></div>
            <div><div className="k">Datenbank:</div>
              <div className={'v ' + (db ? (db.ok ? '' : 'bad') : 'dim')}>{db ? (db.ok ? 'Erreichbar · ' + db.ms + ' ms' : 'ⓘ Nicht erreichbar') : 'Prüfe …'}</div></div>
            <div><div className="k">Endpunkt:</div><div className="v mono" style={{ fontSize: 12 }}>{host}</div></div>
            <div className="info-title" style={{ marginTop: 10 }}>Sicherheit</div>
            <div><div className="k">Verbindung:</div><div className={'v ' + (window.isSecureContext ? '' : 'bad')}>{window.isSecureContext ? 'HTTPS / verschlüsselt' : 'ⓘ Unverschlüsselt'}</div></div>
            <div><div className="k">Zugriffskontrolle:</div><div className="v">Supabase Auth + RLS</div></div>
            <div><div className="k">Fehlversuche (Sitzung):</div><div className={'v ' + (fails ? 'bad' : '')}>{fails}</div></div>
            <div><div className="k">Alarmstatus:</div><div className={'v ' + (locked ? 'bad' : '')}>{locked ? 'Gesperrt' : 'Normal'}</div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
