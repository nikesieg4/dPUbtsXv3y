/* Lagezentrum: Gesamtlage auf einen Blick */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/state.jsx';
import { sb, Bank, Monitor, pingDb, pingFunction } from '../lib/db.js';
import { KEYS, bankAdmin, CLEARANCE } from '../lib/model.js';
import { fmtT, fmtM } from '../lib/format.js';
import { Banner, Stat, Corners, AreaChart, Btn, ICON, Icon } from '../components/ui.jsx';

const H24 = 24 * 3600 * 1000;
function hourBuckets(rows, field) {
  const now = Date.now(); const b = new Array(24).fill(0);
  rows.forEach((r) => { const age = now - new Date(r[field]).getTime(); const i = 23 - Math.floor(age / 3600000); if (i >= 0 && i < 24) b[i]++; });
  return b;
}

export default function Lagezentrum({ go }) {
  const app = useApp();
  const { me, val, citizens, profiles, events } = app;
  const isBank = bankAdmin(me);
  const [txs, setTxs] = useState(null);
  const [audit, setAudit] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [sched, setSched] = useState(null);
  const [pings, setPings] = useState([]);
  const [fn, setFn] = useState(null);
  const [auth, setAuth] = useState(null);
  const [cits, setCits] = useState(null);
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - H24).toISOString();
    const [t, a, au, cr] = await Promise.all([
      isBank ? sb.from('bank_transactions').select('id,created_at,status,type,amount_minor,failure_reason').gte('created_at', since).order('created_at', { ascending: false }).limit(2000) : Promise.resolve(null),
      sb.from('bank_audit_logs').select('ts,action,result,reason,actor_user_id,target_account_id').gte('ts', since).order('ts', { ascending: false }).limit(2000),
      Monitor.query('abis_auth_events', (q) => q.gte('ts', since).order('ts', { ascending: false }).limit(500)),
      me.is >= 4 || me.isAdmin ? sb.from('citizenship_requests').select('id', { count: 'exact', head: true }).eq('status', 'offen') : Promise.resolve(null),
    ]);
    if (!alive.current) return;
    setTxs(t && !t.error ? t.data : t ? { error: true } : null);
    setAudit(a && !a.error ? a.data : { error: true });
    setAuth(au);
    setCits(cr && !cr.error ? cr.count : null);
    if (isBank) Bank.call('bank_scheduler_status').then((s) => alive.current && setSched(s));
  }, [isBank, me]);

  const checkIntegrity = useCallback(async () => {
    if (!isBank) return;
    setChecking(true);
    const r = await Bank.call('bank_admin_integrity');
    if (!alive.current) return;
    setChecking(false); setIntegrity(r);
    app.note(r && r.ok ? 'Integritätsprüfung: in Ordnung' : 'Integritätsprüfung: ABWEICHUNG', r && r.ok ? 'ok' : 'bad', 'bank');
  }, [isBank, app]);

  useEffect(() => {
    alive.current = true;
    load(); checkIntegrity();
    pingFunction('admin-actions').then((r) => alive.current && setFn(r));
    const ping = async () => { const p = await pingDb(); if (alive.current) setPings((x) => [...x, p].slice(-24)); };
    ping();
    const t1 = setInterval(ping, 10000), t2 = setInterval(load, 30000);
    return () => { alive.current = false; clearInterval(t1); clearInterval(t2); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Auswertung ---------- */
  const auditRows = Array.isArray(audit) ? audit : [];
  const auditBad = auditRows.filter((r) => r.result !== 'success');
  const burst = useMemo(() => {
    const cut = Date.now() - 15 * 60000; const m = {};
    auditBad.filter((r) => new Date(r.ts).getTime() > cut).forEach((r) => { const k = r.actor_user_id || 'system'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).filter(([, n]) => n >= 3);
  }, [audit]);   // eslint-disable-line react-hooks/exhaustive-deps
  const txRows = Array.isArray(txs) ? txs : [];
  const txFailed = txRows.filter((t) => t.status === 'failed' || t.status === 'rejected');
  const txVolume = txRows.filter((t) => t.status === 'posted').reduce((s, t) => s + Number(t.amount_minor || 0), 0);
  const maint = val(KEYS.MAINT, {}) || {};
  const apps = val(KEYS.APPS, []) || [];
  const openApps = apps.filter((a) => !a.archived && a.step < 3 && !['abgelehnt', 'zurückgezogen', 'geschlossen'].includes(a.status)).length;
  const appts = val(KEYS.APPTS, []) || [];
  const reqAppts = appts.filter((a) => a.status === 'Angefragt').length;
  const warrants = (val(KEYS.WARRANTS, []) || []).filter((w) => w.status === 'beantragt').length;
  const tickets = ((val(KEYS.SUPPORT, {}) || {}).tickets || []).filter((t) => t.status !== 'geschlossen' && t.status !== 'erledigt').length;
  const privileged = profiles.filter((p) => p.is_admin || Number(p.level) >= 5).length;
  const locked = citizens.filter((c) => c.locked).length;
  const lastPing = pings[pings.length - 1];
  const signIns = auth && auth.ok ? auth.rows.filter((r) => r.event === 'sign_in').length : null;

  const alerts = [];
  if (integrity && integrity.ok === false) alerts.push({ tone: 'bad', text: 'Integritätsprüfung meldet Abweichungen im Ledger.', to: 'bank' });
  burst.forEach(([, n]) => alerts.push({ tone: 'bad', text: n + ' abgelehnte/fehlgeschlagene Bankvorgänge desselben Akteurs in 15 Minuten.', to: 'protokoll' }));
  if (lastPing && !lastPing.ok) alerts.push({ tone: 'bad', text: 'Datenbank antwortet nicht.', to: 'datenbank' });
  if (sched && sched.ok !== false && sched.job_scheduled === false) alerts.push({ tone: 'warn', text: 'Kein Scheduler eingerichtet – Dauerzahlungen laufen nicht automatisch.', to: 'bank' });
  if (sched && sched.due_now > 0) alerts.push({ tone: 'warn', text: sched.due_now + ' Dauerzahlung(en) fällig und nicht ausgeführt.', to: 'bank' });
  if (txFailed.length >= 5) alerts.push({ tone: 'warn', text: txFailed.length + ' fehlgeschlagene Transaktionen in 24 h.', to: 'transaktionen' });
  if (maint.on) alerts.push({ tone: 'info', text: 'Wartungsmodus ist aktiv' + (maint.target ? ' (gezielt für ' + app.nameOf(maint.target) + ')' : '') + '.', to: 'system' });
  if (auth && auth.missing) alerts.push({ tone: 'info', text: 'Überwachungstabellen sind noch nicht eingerichtet (sql/abis-ueberwachung.sql).', to: 'datenbank' });
  const alarmLevel = Math.min(5, 1 + alerts.filter((a) => a.tone === 'bad').length * 2 + alerts.filter((a) => a.tone === 'warn').length);

  /* Ereignisprotokoll: Live-Ereignisse + letzte Bank-Audits */
  const log = useMemo(() => {
    const a = auditRows.slice(0, 12).map((r) => ({ ts: new Date(r.ts).getTime(), text: r.action + (r.reason ? ' · ' + r.reason : ''), tone: r.result === 'success' ? '' : 'bad' }));
    const e = events.slice(0, 12).map((x) => ({ ts: x.ts, text: x.text, tone: x.tone === 'bad' ? 'bad' : '' }));
    return [...e, ...a].sort((x, y) => y.ts - x.ts).slice(0, 10);
  }, [audit, events]);   // eslint-disable-line react-hooks/exhaustive-deps

  const labels24 = Array.from({ length: 24 }, (_, i) => (i % 6 === 5 ? '−' + (23 - i) + 'h' : ''));

  return (
    <div className="stack-lg">
      <Banner sub={<><b>Lagezentrum</b> Administration für Buchhaltung und Informationssicherheit · Echtzeitüberwachung</>}>Hauptkontrolle Bürgerportal</Banner>

      {alerts.filter((a) => a.tone !== 'info').length === 0 && alerts.length === 0 ? null : (
        <div className="stack" style={{ gap: 8 }}>
          {alerts.map((a, i) => (
            <div key={i} className={'alert-bar ' + (a.tone === 'bad' ? '' : a.tone)}>
              <span className={'badge ' + (a.tone === 'bad' ? 'solid-bad' : a.tone === 'warn' ? 'warn' : 'info')}>{a.tone === 'bad' ? 'Alarm' : a.tone === 'warn' ? 'Warnung' : 'Hinweis'}</span>
              <span className="grow">{a.text}</span>
              <Btn size="sm" onClick={() => go(a.to)}>Ansehen →</Btn>
            </div>
          ))}
        </div>
      )}

      <div className="stats">
        <Stat icon={ICON.shield} k="Ledger-Integrität" tone={integrity ? (integrity.ok ? 'ok' : 'bad') : ''}
          v={!isBank ? '—' : integrity ? (integrity.ok ? 'INTAKT' : 'FEHLER') : checking ? '…' : '—'}
          m={!isBank ? 'nur Bank-Administrator' : integrity && integrity.entries_checked != null ? integrity.entries_checked + ' Buchungen geprüft' : 'HMAC-Kette'}
          onClick={isBank ? checkIntegrity : undefined} />
        <Stat icon={ICON.tx} k="Transaktionen 24 h" v={isBank ? txRows.length : '—'} tone={txFailed.length ? 'warn' : ''}
          m={isBank ? txFailed.length + ' fehlgeschlagen · ' + fmtM(txVolume) : 'nur Bank-Administrator'}
          spark={isBank ? hourBuckets(txRows, 'created_at').slice(-12) : null} onClick={() => go('transaktionen')} />
        <Stat icon={ICON.warn} k="Sicherheitsereignisse" v={Array.isArray(audit) ? auditBad.length : '—'} tone={auditBad.length ? 'bad' : 'ok'}
          m={Array.isArray(audit) ? 'abgelehnt / fehlgeschlagen · 24 h' : 'Audit-Log nur für Level 6'}
          spark={Array.isArray(audit) ? hourBuckets(auditBad, 'ts').slice(-12) : null} onClick={() => go('protokoll')} />
        <Stat icon={ICON.db} k="Datenbank" v={lastPing ? (lastPing.ok ? lastPing.ms + ' ms' : 'AUSFALL') : '…'} tone={lastPing ? (lastPing.ok ? (lastPing.ms > 800 ? 'warn' : '') : 'bad') : ''}
          m="Antwortzeit · alle 10 s" spark={pings.map((p) => p.ms)} onClick={() => go('datenbank')} />
      </div>

      <div className="dash">
        <div className="stack">
          {[['protokoll', 'Sicherheitsprotokoll'], ['datenbank', 'Datenbank'], ['transaktionen', 'Transaktionen'], ['register', 'Bürgerregister'], ['system', 'System & Wartung']].map(([id, l]) => (
            <Btn key={id} variant="primary" size="lg" block onClick={() => go(id)}>{l}</Btn>
          ))}
          <Corners>
            <div className="stat" style={{ alignItems: 'center' }}>
              <div className="stat-text">
                <span className="stat-icon"><Icon d={ICON.pulse} size={22} /></span>
                <span className="stat-k">Alarmstufe</span>
                <span className={'stat-v ' + (alarmLevel >= 4 ? 'bad' : alarmLevel >= 2 ? 'warn' : 'ok')}>{alarmLevel}</span>
                <span className="stat-m">1 = Normalbetrieb · 5 = kritisch</span>
              </div>
              <LevelGauge level={alarmLevel} />
            </div>
          </Corners>
        </div>

        <div className="dash-mid panel" style={{ padding: '18px 18px 10px', background: 'transparent', borderTop: 0, borderRight: 0, borderBottom: 0 }}>
          <div className="chart-title" style={{ fontSize: 18 }}>Echtzeit-Messdaten</div>
          <div className="chart-grid">
            <div>
              <AreaChart title="Transaktionen" unit="pro Stunde" series={isBank ? hourBuckets(txRows, 'created_at') : new Array(24).fill(0)} labels={labels24} />
            </div>
            <div>
              <AreaChart title="DB-Antwortzeit" unit="ms" series={pings.length > 1 ? pings.map((p) => p.ms) : [0, 0]} />
            </div>
            <div>
              <AreaChart title="Audit-Ereignisse" unit="pro Stunde" series={hourBuckets(auditRows, 'ts')} labels={labels24} />
            </div>
            <div>
              <AreaChart title="Abgelehnt / Fehler" unit="pro Stunde" series={hourBuckets(auditBad, 'ts')} labels={labels24} />
            </div>
          </div>
        </div>

        <div className="stack">
          <Corners innerStyle={{ padding: '20px 22px' }}>
            <Icon d={ICON.warn} size={24} />
            <div className="stat-k" style={{ margin: '14px 0 10px' }}>Ereignisprotokoll</div>
            {log.length === 0 ? <div className="muted small mono">– keine Ereignisse</div> : (
              <ul className="log">
                {log.map((l, i) => <li key={i} className={l.tone}>{l.text}<span className="t">{fmtT(l.ts)}</span></li>)}
              </ul>
            )}
            <div style={{ marginTop: 10 }}><Btn size="sm" onClick={() => go('protokoll')}>Vollständiges Protokoll →</Btn></div>
          </Corners>

          <div className="info-list" style={{ padding: '6px 4px' }}>
            <div className="info-title">Allgemeine Informationen</div>
            <div><div className="k">Edge Function admin-actions:</div><div className={'v ' + (fn ? (fn.ok ? '' : 'bad') : 'dim')}>{fn ? (fn.ok ? 'Erreichbar · ' + fn.ms + ' ms' : 'ⓘ Nicht erreichbar') : 'Prüfe …'}</div></div>
            <div><div className="k">Scheduler (pg_cron):</div><div className={'v ' + (!sched ? 'dim' : sched.job_scheduled ? '' : 'warn')}>{!isBank ? 'nur Level 6' : !sched ? 'Prüfe …' : sched.job_scheduled ? 'Aktiv' : 'Nicht eingerichtet'}</div></div>
            <div><div className="k">Wartungsmodus:</div><div className={'v ' + (maint.on ? 'warn' : '')}>{maint.on ? 'AKTIV' + (maint.until ? ' · bis ' + maint.until : '') : 'Aus'}</div></div>
            <div><div className="k">Privilegierte Konten (L5+):</div><div className="v warn">{privileged}</div></div>
            <div><div className="k">Gesperrte Konten:</div><div className={'v ' + (locked ? 'bad' : '')}>{locked}</div></div>
            <div><div className="k">Anmeldungen 24 h:</div><div className={'v ' + (signIns == null ? 'dim' : '')}>{signIns == null ? 'nicht erfasst' : signIns}</div></div>
            <div className="info-title" style={{ marginTop: 6 }}>Offene Vorgänge</div>
            <div><div className="k">Bewerbungen in Prüfung:</div><div className="v">{openApps}</div></div>
            <div><div className="k">Terminanfragen:</div><div className="v">{reqAppts}</div></div>
            <div><div className="k">Staatsbürgerschaftsanträge:</div><div className={'v ' + (cits == null ? 'dim' : '')}>{cits == null ? '—' : cits}</div></div>
            <div><div className="k">Haftbefehle beantragt:</div><div className="v">{me.is >= 3 || me.isAdmin ? warrants : '—'}</div></div>
            <div><div className="k">Offene Support-Tickets:</div><div className="v">{tickets}</div></div>
            <div><div className="k">Alarmstatus:</div><div className={'v ' + (alarmLevel >= 4 ? 'bad' : alarmLevel >= 2 ? 'warn' : '')}>{alarmLevel >= 4 ? 'Kritisch' : alarmLevel >= 2 ? 'Erhöht' : 'Normal'}</div></div>
          </div>
        </div>
      </div>
      {me.is < CLEARANCE.credentials && !me.isAdmin && <div className="msg info">Einige Messwerte (Bank, Audit) sind nur für Level 6 bzw. den Administrator sichtbar – die Datenbank gibt sie anderen Konten nicht heraus.</div>}
    </div>
  );
}

/* Sechseckige Stufenanzeige */
function LevelGauge({ level }) {
  const pts = (r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i - Math.PI / 2; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; });
  const poly = (r) => pts(r).map((p) => p.join(',')).join(' ');
  const vals = [level, Math.max(1, level - 1), level, Math.min(5, level + 1), level, Math.max(1, level - 2)];
  const shape = vals.map((v, i) => { const a = Math.PI / 3 * i - Math.PI / 2; const r = 8 + v * 8; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)].join(','); }).join(' ');
  return (
    <svg width="96" height="96" viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
      {[48, 32, 16].map((r) => <polygon key={r} points={poly(r)} fill="none" stroke="#9a9a9a" strokeWidth="1.2" />)}
      {pts(48).map((p, i) => <line key={i} x1="50" y1="50" x2={p[0]} y2={p[1]} stroke="#5a5a5a" strokeWidth="1" />)}
      <polygon points={shape} fill="var(--y-fill)" stroke="var(--y)" strokeWidth="1.6" />
    </svg>
  );
}
