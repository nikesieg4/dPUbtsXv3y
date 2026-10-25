/* Gemeinsame Oberflächen-Bausteine */
import React, { useState } from 'react';
import { shortId } from '../lib/format.js';

export const ICON = {
  shield: 'M12 2l8 3.5v6c0 5-3.6 8.8-8 10.5-4.4-1.7-8-5.5-8-10.5v-6z',
  log: 'M4 6h16M4 12h16M4 18h10',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  tx: 'M4 8h13l-3-3M20 16H7l3 3',
  warn: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  check: 'M5 12l5 5 9-10',
  power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
};
export function Icon({ d, size = 20, sw = 1.6, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={d} /></svg>
  );
}

/* ABIS-Emblem: Schild mit Schlüsselloch in einem Ring */
export function Emblem({ size = 150 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" role="img" aria-label="Emblem der ABIS">
      <circle cx="80" cy="80" r="68" />
      <path d="M80 30l36 14v28c0 24-16 40-36 48-20-8-36-24-36-48V44z" strokeWidth="6" />
      <circle cx="80" cy="74" r="10" fill="currentColor" stroke="none" />
      <path d="M74 80h12l4 26H70z" fill="currentColor" stroke="none" />
      <path d="M80 4v14M80 142v14M4 80h14M142 80h14" strokeWidth="5" />
    </svg>
  );
}

export function Btn({ variant, size, block, className = '', ...rest }) {
  const cls = ['btn', variant ? 'btn-' + variant : '', size ? 'btn-' + size : '', block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}
export function Badge({ tone, children, title }) { return <span className={'badge ' + (tone || '')} title={title}>{children}</span>; }
export function Msg({ m }) { if (!m) return null; return <div className={'msg ' + (m.ok ? 'ok' : m.tone || 'bad')} role={m.ok ? 'status' : 'alert'}>{m.text}</div>; }

export function Field({ label, hint, error, children }) {
  return <label className="field">{label}{children}{error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}</label>;
}
export function Input({ label, hint, error, mono, className = '', ...rest }) {
  return <Field label={label} hint={hint} error={error}><input className={'input ' + (mono ? 'mono ' : '') + className} {...rest} /></Field>;
}
export function Select({ label, hint, children, ...rest }) {
  return <Field label={label} hint={hint}><select className="select" {...rest}>{children}</select></Field>;
}
export function Textarea({ label, hint, ...rest }) {
  return <Field label={label} hint={hint}><textarea className="textarea" rows={3} {...rest} /></Field>;
}

export function Panel({ title, actions, children, className = '', pad = true }) {
  return (
    <section className={'panel ' + className}>
      {(title || actions) && <div className="panel-h">{typeof title === 'string' ? <h2>{title}</h2> : title}{actions && <div className="row">{actions}</div>}</div>}
      {pad ? <div className="panel-b">{children}</div> : children}
    </section>
  );
}
export function Corners({ yellow, children, className = '', innerStyle }) {
  return <div className={'corners ' + (yellow ? 'y ' : '') + className}><div className="inner" style={innerStyle}>{children}</div></div>;
}
export function Banner({ children, sub, small }) {
  return (
    <div>
      <div className="banner">{children}</div>
      {sub && <div className="banner-sub">{sub}</div>}
      {small && <div className="banner-sub">{small}</div>}
    </div>
  );
}

/* Kennzahl mit Eckwinkeln, Symbol und kleinem Verlaufsdiagramm */
export function Stat({ k, v, m, tone, icon, spark, onClick }) {
  const body = (
    <Corners>
      <div className="stat">
        <div className="stat-text">
          {icon && <span className="stat-icon"><Icon d={icon} size={22} /></span>}
          <span className="stat-k">{k}</span>
          <span className={'stat-v ' + (tone || '')}>{v}</span>
          {m && <span className="stat-m">{m}</span>}
        </div>
        {spark && spark.length > 1 && <Spark values={spark} />}
      </div>
    </Corners>
  );
  return onClick ? <button type="button" className="stat-btn" onClick={onClick}>{body}</button> : body;
}

/* Kleines Flächen-Diagramm (gelbe Linie, gelbe Fläche) */
export function Spark({ values, w = 64, h = 74 }) {
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 6) - 2]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={line + ` L${w} ${h} L0 ${h} Z`} fill="var(--y-fill)" />
      <path d={line} fill="none" stroke="var(--y)" strokeWidth="1.6" />
    </svg>
  );
}

/* Flächendiagramm mit Achse und Gitter */
export function AreaChart({ title, unit, series, labels, height = 220 }) {
  const W = 520, H = height, L = 40, B = 24, T = 10, R = 8;
  const max = Math.max(1, ...series);
  const nice = Math.ceil(max / 4) * 4 || 4;
  const x = (i) => L + (i / Math.max(1, series.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / nice) * (H - T - B);
  const line = series.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const ticks = [0, 1, 2, 3, 4].map((t) => (nice / 4) * t);
  return (
    <figure style={{ margin: 0 }}>
      {title && <figcaption className="chart-title">{title}{unit ? <span className="muted" style={{ textTransform: 'none', letterSpacing: '0.04em', fontSize: 13 }}> ({unit})</span> : null}</figcaption>}
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#4a4a4a" strokeWidth="1" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        <path d={line + ` L${x(series.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="var(--y-fill)" />
        <path d={line} fill="none" stroke="var(--y)" strokeWidth="2" />
        {labels && labels.map((lb, i) => (lb ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{lb}</text> : null))}
      </svg>
    </figure>
  );
}

export function Dialog({ title, onClose, wide, children }) {
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="dialog-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'dialog ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-h"><h2>{title}</h2><button type="button" className="x-btn" onClick={onClose} aria-label="Schließen">✕</button></div>
        <div className="dialog-b">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={'tab ' + (value === o.value ? 'active' : '')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Pager({ page, total, size, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / size));
  return (
    <div className="pager">
      <span>{total} Einträge · Seite {page + 1} von {pages}</span>
      <div className="row">
        <Btn size="sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>← Zurück</Btn>
        <Btn size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Weiter →</Btn>
      </div>
    </div>
  );
}

export function CopyBtn({ text, label = 'Kopieren' }) {
  const [done, setDone] = useState(false);
  return <Btn size="sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch (e) { /* egal */ } }}>{done ? 'Kopiert' : label}</Btn>;
}
export function Uuid({ id }) {
  if (!id) return <span className="muted">—</span>;
  return <span className="mono" title={id} style={{ fontSize: 12 }}>{shortId(id)}</span>;
}
export function Secret({ label, value }) {
  return (
    <div className="secret">
      <div className="eyebrow" style={{ color: 'var(--y)' }}>{label} — wird nur einmal angezeigt</div>
      <div className="secret-v">{value}</div>
      <CopyBtn text={value} />
    </div>
  );
}
export function Empty({ children }) { return <div className="empty">{children}</div>; }
export function Denied({ need }) {
  return (
    <Corners yellow>
      <div className="panel-b stack" style={{ padding: 28 }}>
        <h2>Kein Zugriff</h2>
        <p className="muted" style={{ margin: 0 }}>Für diesen Bereich fehlt Ihnen die Berechtigung{need ? ' (' + need + ')' : ''}. Die Datenbank würde den Zugriff ebenfalls ablehnen.</p>
      </div>
    </Corners>
  );
}
export function Kv({ rows }) {
  return <div className="kv">{rows.filter(Boolean).map(([k, v], i) => <React.Fragment key={i}><div>{k}</div><div>{v}</div></React.Fragment>)}</div>;
}
export function PageHead({ title, sub, actions }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="banner">{title}</div>
      {(sub || actions) && <div className="row-between"><div className="banner-sub" style={{ marginTop: 0 }}>{sub}</div>{actions && <div className="row">{actions}</div>}</div>}
    </div>
  );
}
