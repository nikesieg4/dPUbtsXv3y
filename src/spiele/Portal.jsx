/* =====================================================================
   SPIELEPORTAL MAISKOLBISTAN
   Öffentliche Seite ohne Anmeldung: Übersicht aller Spiele, Suche,
   Kategorien und eine Spielseite, die die hinterlegte Adresse in einem
   Rahmen (iframe) lädt.  Seitenwechsel über #/ und #/spiel/<id>.
   ===================================================================== */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadGames } from './api.js';
import { formatRatio, hostOf } from '../lib/spiele.js';

const RECENT_KEY = 'mks-spiele-zuletzt';
function readRecent() {
  try { const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch (e) { return []; }
}
function pushRecent(id) {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12);
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) { /* privater Modus: egal */ }
  return next;
}

function readRoute() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const m = h.match(/^spiel\/([^/?]+)/);
  return m ? { view: 'game', id: decodeURIComponent(m[1]) } : { view: 'home' };
}
function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const f = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}
const gameHref = (g) => '#/spiel/' + encodeURIComponent(g.id);

function hue(text) { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360; return h; }

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1F7A3A" />
      <path d="M32 8c8 0 13 9 13 22s-5 24-13 24-13-11-13-24S24 8 32 8z" fill="#F6C928" />
      <g fill="#D9A400"><circle cx="27" cy="20" r="2.4" /><circle cx="37" cy="20" r="2.4" /><circle cx="32" cy="27" r="2.4" /><circle cx="25" cy="33" r="2.4" /><circle cx="39" cy="33" r="2.4" /><circle cx="32" cy="40" r="2.4" /><circle cx="32" cy="14" r="2.4" /></g>
      <path d="M12 30c2 14 9 24 20 26-6-6-9-14-9-24-4 3-8 2-11-2zM52 30c-2 14-9 24-20 26 6-6 9-14 9-24 4 3 8 2 11-2z" fill="#3FB563" />
    </svg>
  );
}

/* Kachel: Vorschaubild oder – ohne Bild – eine farbige Fläche mit Anfangsbuchstaben */
function Tile({ g, small }) {
  const [broken, setBroken] = useState(false);
  const h = hue(g.titel);
  const showImg = g.bild_url && !broken;
  return (
    <a className={'tile' + (small ? ' tile-sm' : '')} href={gameHref(g)} aria-label={g.titel + ' spielen'}>
      {showImg
        ? <img src={g.bild_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="tile-fill" style={{ background: `linear-gradient(135deg, hsl(${h} 72% 52%), hsl(${(h + 45) % 360} 70% 40%))` }} aria-hidden="true">{g.titel.slice(0, 1).toUpperCase()}</span>}
      <span className="tile-name">{g.titel}</span>
    </a>
  );
}

function Home({ games, recent, state, onRetry }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(games.map((g) => g.kategorie))].sort((a, b) => a.localeCompare(b, 'de')), [games]);
  const needle = q.trim().toLowerCase();
  const shown = games.filter((g) => (!cat || g.kategorie === cat)
    && (!needle || (g.titel + ' ' + g.kategorie + ' ' + g.beschreibung).toLowerCase().includes(needle)));
  const recentGames = recent.map((id) => games.find((g) => g.id === id)).filter(Boolean);
  useEffect(() => { document.title = 'Maiskolbistan Spiele'; }, []);

  return (
    <>
      <header className="top">
        <a className="logo" href="#/"><Logo /><span>Maiskolbistan <b>Spiele</b></span></a>
        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Spiel suchen …" aria-label="Spiel suchen" />
        </label>
      </header>

      <main className="page">
        {state === 'loading' && <div className="grid" aria-busy="true" aria-label="Spiele werden geladen">{Array.from({ length: 12 }).map((_, i) => <span key={i} className="tile skeleton" />)}</div>}
        {state === 'error' && (
          <div className="notice">
            <h2>Die Spiele konnten nicht geladen werden</h2>
            <p>Bitte prüfe deine Internetverbindung und versuche es noch einmal.</p>
            <button type="button" className="pbtn" onClick={onRetry}>Erneut versuchen</button>
          </div>
        )}
        {state === 'ready' && !games.length && (
          <div className="notice"><h2>Noch keine Spiele</h2><p>Die Verwaltung hat noch keine Spiele freigeschaltet. Schau bald wieder vorbei!</p></div>
        )}
        {state === 'ready' && games.length > 0 && (
          <>
            {cats.length > 1 && (
              <nav className="chips" aria-label="Kategorien">
                <button type="button" className={'chip' + (!cat ? ' on' : '')} aria-pressed={!cat} onClick={() => setCat('')}>Alle</button>
                {cats.map((c) => <button key={c} type="button" className={'chip' + (cat === c ? ' on' : '')} aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
              </nav>
            )}
            {!needle && !cat && recentGames.length > 0 && (
              <section>
                <h2 className="sec">Zuletzt gespielt</h2>
                <div className="strip">{recentGames.map((g) => <Tile key={g.id} g={g} small />)}</div>
              </section>
            )}
            <section>
              <h2 className="sec">{cat || (needle ? 'Suchergebnisse' : 'Alle Spiele')} <span className="count">{shown.length}</span></h2>
              {shown.length ? <div className="grid">{shown.map((g) => <Tile key={g.id} g={g} />)}</div>
                : <div className="notice"><p>Kein Spiel gefunden. Versuche einen anderen Suchbegriff.</p><button type="button" className="pbtn" onClick={() => { setQ(''); setCat(''); }}>Alle Spiele zeigen</button></div>}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Player({ g, games }) {
  const stage = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);        // „Neu laden“ baut den Rahmen neu auf
  const [maxi, setMaxi] = useState(false);      // Ersatz-Vollbild, wenn der Browser kein echtes kennt
  const [isFs, setIsFs] = useState(false);
  const ratio = formatRatio(g.format);

  useEffect(() => { document.title = g.titel + ' · Maiskolbistan Spiele'; }, [g.titel]);
  useEffect(() => { setLoaded(false); }, [g.id, nonce]);
  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  useEffect(() => {
    if (!maxi) return undefined;
    const f = (e) => { if (e.key === 'Escape') setMaxi(false); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [maxi]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) { /* egal */ } return; }
    if (maxi) { setMaxi(false); return; }
    const el = stage.current;
    if (el && el.requestFullscreen) { try { await el.requestFullscreen(); return; } catch (e) { /* weiter mit Ersatz */ } }
    setMaxi(true);
  }

  /* Der Rahmen ist abgeschottet: Das Spiel darf Skripte ausführen, aber die Portalseite
     nicht wegnavigieren. Läge es auf unserer eigenen Adresse, bekäme es keinen Zugriff auf sie. */
  const sameOrigin = (() => { try { return new URL(g.url).origin === window.location.origin; } catch (e) { return true; } })();
  const sandbox = 'allow-scripts allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-orientation-lock'
    + (sameOrigin ? '' : ' allow-same-origin');
  const big = isFs || maxi;
  const more = games.filter((x) => x.id !== g.id);
  const related = [...more.filter((x) => x.kategorie === g.kategorie), ...more.filter((x) => x.kategorie !== g.kategorie)].slice(0, 12);

  return (
    <>
      <header className="top">
        <a className="logo" href="#/"><Logo /><span>Maiskolbistan <b>Spiele</b></span></a>
        <a className="pbtn ghost" href="#/">← Alle Spiele</a>
      </header>
      <main className="page">
        <div className="player">
          <div ref={stage} className={'stage' + (maxi ? ' maxi' : '')} style={{ '--ar': ratio }}>
            {!loaded && <div className="stage-load" role="status"><span className="spin" />{g.titel} wird geladen …</div>}
            <iframe key={g.id + ':' + nonce} title={g.titel} src={g.url} sandbox={sandbox}
              allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope; screen-wake-lock"
              allowFullScreen onLoad={() => setLoaded(true)} />
            {big && <button type="button" className="stage-exit" onClick={toggleFullscreen}>Vollbild beenden</button>}
          </div>
          <div className="bar">
            <div className="bar-title">
              <h1>{g.titel}</h1>
              <span className="cat">{g.kategorie}</span>
            </div>
            <div className="bar-actions">
              <button type="button" className="pbtn" onClick={toggleFullscreen}>Vollbild</button>
              <button type="button" className="pbtn ghost" onClick={() => setNonce((n) => n + 1)}>Neu starten</button>
              <a className="pbtn ghost" href={g.url} target="_blank" rel="noopener noreferrer">In neuem Tab</a>
            </div>
          </div>
        </div>

        <section className="about">
          <h2 className="sec">Über das Spiel</h2>
          {g.beschreibung.trim() ? g.beschreibung.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p className="dim">Zu diesem Spiel gibt es noch keine Beschreibung.</p>}
          <p className="dim small">Das Spiel wird von <b>{hostOf(g.url)}</b> geladen. Bleibt das Feld leer? Dann erlaubt der Anbieter das Einbetten nicht – öffne es mit „In neuem Tab“.</p>
        </section>

        {related.length > 0 && (
          <section>
            <h2 className="sec">Weitere Spiele</h2>
            <div className="grid">{related.map((x) => <Tile key={x.id} g={x} />)}</div>
          </section>
        )}
      </main>
    </>
  );
}

export default function Portal() {
  const route = useRoute();
  const [games, setGames] = useState([]);
  const [state, setState] = useState('loading');   // loading | ready | error
  const [recent, setRecent] = useState(readRecent);

  async function load() {
    setState('loading');
    try { setGames(await loadGames()); setState('ready'); } catch (e) { console.error('[Spiele]', e); setState('error'); }
  }
  useEffect(() => { load(); }, []);

  const game = route.view === 'game' ? games.find((g) => g.id === route.id) : null;
  useEffect(() => { if (game) setRecent(pushRecent(game.id)); }, [game && game.id]);

  let body;
  if (route.view === 'game' && state === 'ready' && game) body = <Player g={game} games={games} />;
  else if (route.view === 'game' && state === 'ready') {
    body = (
      <>
        <header className="top"><a className="logo" href="#/"><Logo /><span>Maiskolbistan <b>Spiele</b></span></a></header>
        <main className="page"><div className="notice"><h2>Dieses Spiel gibt es nicht mehr</h2><p>Vielleicht wurde es entfernt oder die Adresse ist falsch.</p><a className="pbtn" href="#/">Zu allen Spielen</a></div></main>
      </>
    );
  } else body = <Home games={games} recent={recent} state={state} onRetry={load} />;

  return (
    <div className="portal">
      {body}
      <footer className="foot">
        <span>Kostenlos und ohne Anmeldung · Die Spiele stammen von externen Anbietern und werden hier nur eingebettet.</span>
        <a href="../#/spiele">Verwaltung</a>
      </footer>
    </div>
  );
}
