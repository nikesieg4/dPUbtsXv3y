/* Rahmen: Navigation, Kopfzeile, Seitenwechsel (über #hash) */
import React, { useEffect, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { can, bankAdmin, canSeeRecords, CLEARANCE, IS_LABEL, displayName } from '../lib/model.js';
import { APP_VERSION } from '../config.js';
import { Btn, Denied } from './ui.jsx';
import Lagezentrum from '../pages/Lagezentrum.jsx';
import Protokoll from '../pages/Protokoll.jsx';
import Datenbank from '../pages/Datenbank.jsx';
import Transaktionen from '../pages/Transaktionen.jsx';
import Bank from '../pages/Bank.jsx';
import Register from '../pages/Register.jsx';
import Anmeldedaten from '../pages/Anmeldedaten.jsx';
import Antraege from '../pages/Antraege.jsx';
import Antragsarten from '../pages/Antragsarten.jsx';
import Termine from '../pages/Termine.jsx';
import Justiz from '../pages/Justiz.jsx';
import Zuordnungen from '../pages/Zuordnungen.jsx';
import Berechtigungen from '../pages/Berechtigungen.jsx';
import Auswertungen from '../pages/Auswertungen.jsx';
import Kommunikation from '../pages/Kommunikation.jsx';
import System from '../pages/System.jsx';
import Konto from '../pages/Konto.jsx';

const L6 = (me) => me.isAdmin || me.is >= CLEARANCE.credentials;
export const PAGES = [
  { group: 'Überwachung', id: 'lage', label: 'Lagezentrum', C: Lagezentrum, ok: () => true },
  { group: 'Überwachung', id: 'protokoll', label: 'Sicherheitsprotokoll', C: Protokoll, ok: () => true },
  { group: 'Überwachung', id: 'datenbank', label: 'Datenbank', C: Datenbank, ok: () => true },
  { group: 'Überwachung', id: 'transaktionen', label: 'Transaktionen', C: Transaktionen, ok: bankAdmin, need: 'Bank-Administrator · Level 6' },
  { group: 'Buchhaltung', id: 'bank', label: 'Bankmanagement', C: Bank, ok: bankAdmin, need: 'Bank-Administrator · Level 6' },
  { group: 'Verwaltung', id: 'register', label: 'Bürgerregister', C: Register, ok: (me) => me.is >= CLEARANCE.register || me.allow.includes('nav:register'), need: 'Level 3' },
  { group: 'Verwaltung', id: 'anmeldedaten', label: 'Anmeldedaten', C: Anmeldedaten, ok: L6, need: 'Level 6' },
  { group: 'Verwaltung', id: 'antraege', label: 'Anträge', C: Antraege, ok: (me) => me.is >= CLEARANCE.antraege || me.allow.includes('nav:antraege'), need: 'Level 3' },
  { group: 'Verwaltung', id: 'antragsarten', label: 'Antragsarten', C: Antragsarten, ok: (me) => me.is >= CLEARANCE.apptypes || me.allow.includes('nav:antragsarten'), need: 'Level 4' },
  { group: 'Verwaltung', id: 'termine', label: 'Termine', C: Termine, ok: (me) => me.is >= CLEARANCE.admintermine, need: 'Level 2' },
  { group: 'Verwaltung', id: 'justiz', label: 'Justiz & Polizei', C: Justiz, ok: canSeeRecords, need: 'Justiz, Polizei oder Level 5' },
  { group: 'Verwaltung', id: 'kommunikation', label: 'Kommunikation', C: Kommunikation, ok: () => true },
  { group: 'Steuerung', id: 'zuordnungen', label: 'Zuordnungen', C: Zuordnungen, ok: (me) => can(me, 'units.manage'), need: 'Level 6' },
  { group: 'Steuerung', id: 'berechtigungen', label: 'Berechtigungen', C: Berechtigungen, ok: (me) => can(me, 'perms.manage'), need: 'Level 6' },
  { group: 'Steuerung', id: 'auswertungen', label: 'Wahl & Umfrage', C: Auswertungen, ok: (me) => L6(me) || can(me, 'audit.view'), need: 'Level 6' },
  { group: 'Steuerung', id: 'system', label: 'System & Wartung', C: System, ok: () => true },
  { group: 'Konto', id: 'konto', label: 'Mein Konto', C: Konto, ok: () => true },
];

function useHashPage() {
  const read = () => (window.location.hash || '').replace(/^#\/?/, '') || 'lage';
  const [page, setPage] = useState(read);
  useEffect(() => { const f = () => setPage(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = (id) => { window.location.hash = '/' + id; window.scrollTo(0, 0); };
  return [page, go];
}

export default function Shell({ onLogout }) {
  const app = useApp();
  const { me, live, loadError, kv } = app;
  const [page, go] = useHashPage();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const cur = PAGES.find((p) => p.id === page) || PAGES[0];
  const groups = [...new Set(PAGES.map((p) => p.group))];
  const alarms = (app.events || []).filter((e) => e.tone === 'bad' && Date.now() - e.ts < 15 * 60000).length;
  const Page = cur.C;

  return (
    <div className="shell">
      <nav className={'nav ' + (open ? 'open' : '')} aria-label="Hauptnavigation">
        <div className="brand">
          <span className="brand-tag">ABIS</span>
          <div className="brand-name">Sicherheitskonsole</div>
          <div className="brand-sub">Bürgerportal Maiskolbistan</div>
        </div>
        {groups.map((g) => (
          <div className="nav-group" key={g}>
            <div className="nav-label">{g}</div>
            {PAGES.filter((p) => p.group === g).map((p) => {
              const allowed = me && p.ok(me);
              return (
                <button key={p.id} type="button" className={'nav-item ' + (cur.id === p.id ? 'active ' : '') + (allowed ? '' : 'locked')}
                  onClick={() => { go(p.id); setOpen(false); }} aria-current={cur.id === p.id ? 'page' : undefined}>
                  <span>{p.label}</span>
                  {p.id === 'protokoll' && alarms > 0 && <span className="nav-count">{alarms}</span>}
                  {!allowed && <span className="small" aria-label="gesperrt">⛌</span>}
                </button>
              );
            })}
          </div>
        ))}
        <div className="nav-foot">ABIS-KONSOLE v{APP_VERSION}<br />Verbindung: {live ? 'LIVE' : 'GETRENNT'}</div>
      </nav>
      <div className={'backdrop ' + (open ? 'open' : '')} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button type="button" className="btn menu-btn" onClick={() => setOpen(true)} aria-label="Menü öffnen">☰</button>
            <span className="topbar-title">ABIS / {cur.group} / {cur.label}</span>
          </div>
          <div className="topbar-meta">
            <span className="row" style={{ gap: 8 }}><span className={'dot ' + (live ? 'live' : 'bad')} />{live ? 'Live' : 'Offline'}</span>
            <span className="clock">{new Date(now).toLocaleTimeString('de-DE')}</span>
            {me && <span className="user-chip">{me.isAdmin ? 'Administrator' : displayName(me.name)}<span className="lvl" title={IS_LABEL[me.is]}>L{me.is}</span></span>}
            <Btn size="sm" onClick={onLogout}>Abmelden</Btn>
          </div>
        </header>
        <main className="content">
          {loadError && <div className="msg bad" style={{ marginBottom: 16 }}>{loadError} <Btn size="sm" onClick={app.reloadAll}>Erneut laden</Btn></div>}
          {!kv || !me ? <div className="splash" style={{ minHeight: '50vh' }}><span className="dot live" />Lade Staatsdaten</div>
            : cur.ok(me) ? <Page go={go} /> : <Denied need={cur.need} />}
        </main>
      </div>
    </div>
  );
}
