/* Anmeldung, Zugangsprüfung, automatische Abmeldung */
import React, { useEffect, useRef, useState } from 'react';
import { sb, Auth, Monitor } from './lib/db.js';
import { consoleAllowed } from './lib/model.js';
import { IDLE_LOGOUT_MIN } from './config.js';
import { DataProvider } from './lib/state.jsx';
import Login from './pages/Login.jsx';
import Shell from './components/Shell.jsx';

export default function App() {
  const [profile, setProfile] = useState(undefined);   // undefined = prüft, null = abgemeldet
  const [notice, setNotice] = useState('');

  async function adopt(reasonIfDenied) {
    const p = await Auth.profile();
    if (!p) { await Auth.signOut(); setProfile(null); if (reasonIfDenied) setNotice('Für dieses Konto ist kein Profil hinterlegt.'); return false; }
    if (!consoleAllowed(p)) {
      await Auth.signOut(); setProfile(null);
      setNotice('Zugang verweigert: Die Konsole ist dem Administrator, Level 5 und 6 sowie der ABIS vorbehalten.');
      return false;
    }
    setProfile(p); return true;
  }

  useEffect(() => {
    (async () => { const s = await Auth.session(); if (s) await adopt(false); else setProfile(null); })();
    const { data } = sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') setProfile(null); });
    return () => { try { data.subscription.unsubscribe(); } catch (e) { /* egal */ } };
  }, []);

  async function login(ident, pw) {
    setNotice('');
    const r = await Auth.signIn(ident, pw);
    if (!r.ok) return r;
    const ok = await adopt(true);
    if (ok) Monitor.logAction('Anmeldung an der Konsole', null, { ua: navigator.userAgent.slice(0, 160) });
    return { ok };
  }
  async function logout(reason) {
    await Auth.signOut(); setProfile(null);
    if (reason) setNotice(reason);
  }

  if (profile === undefined) return <div className="splash"><span className="dot live" />Sitzung wird geprüft</div>;
  if (!profile) return <Login onLogin={login} notice={notice} />;
  return (
    <DataProvider profile={profile}>
      <IdleGuard onIdle={() => logout('Sie wurden nach ' + IDLE_LOGOUT_MIN + ' Minuten ohne Eingabe automatisch abgemeldet.')} />
      <Shell onLogout={() => logout('Sie wurden abgemeldet.')} />
    </DataProvider>
  );
}

/* Automatische Abmeldung bei Inaktivität */
function IdleGuard({ onIdle }) {
  const last = useRef(Date.now());
  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    const evs = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last.current > IDLE_LOGOUT_MIN * 60000) onIdle(); }, 15000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [onIdle]);
  return null;
}
