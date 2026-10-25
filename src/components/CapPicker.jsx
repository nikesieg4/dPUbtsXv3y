/* Dreizustand je Recht: Standard / Erteilt / Entzogen */
import React from 'react';
import { CAPS, PORTAL_NAV } from '../lib/model.js';

export default function CapPicker({ value, onChange, showNav = true, disabled }) {
  const allow = value.allow || [], deny = value.deny || [];
  function set(cap, st) {
    const a = allow.filter((c) => c !== cap), d = deny.filter((c) => c !== cap);
    if (st === 'allow') a.push(cap); if (st === 'deny') d.push(cap);
    onChange({ allow: a, deny: d });
  }
  const stateOf = (cap) => (allow.includes(cap) ? 'allow' : deny.includes(cap) ? 'deny' : 'default');
  const Tri = ({ cap, label, hint }) => {
    const st = stateOf(cap);
    return (
      <div className="list-row">
        <span>{label}{hint && <span className="muted small"> · {hint}</span>}</span>
        <span className="tri" role="group" aria-label={label}>
          {[['default', 'Standard'], ['allow', 'Erteilt'], ['deny', 'Entzogen']].map(([k, l]) => (
            <button key={k} type="button" disabled={disabled} aria-pressed={st === k} className={st === k ? 'on-' + k : ''} onClick={() => set(cap, k)}>{l}</button>))}
        </span>
      </div>
    );
  };
  const groups = [...new Set(CAPS.map((c) => c.group))];
  return (
    <div className="stack" style={{ gap: 16 }}>
      {showNav && <div><div className="eyebrow" style={{ marginBottom: 4 }}>Bereiche im Portal</div>
        {PORTAL_NAV.map((n) => <Tri key={n.id} cap={'nav:' + n.id} label={n.label} hint={n.need ? 'sonst ab Level ' + n.need : null} />)}</div>}
      {groups.map((g) => <div key={g}><div className="eyebrow" style={{ marginBottom: 4 }}>{g}</div>
        {CAPS.filter((c) => c.group === g).map((c) => <Tri key={c.id} cap={c.id} label={c.label} hint={c.level <= 6 ? 'sonst ab Level ' + c.level : 'sonst nur Administrator'} />)}</div>)}
    </div>
  );
}
