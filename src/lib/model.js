/* =====================================================================
   DATENMODELL DES BÜRGERPORTALS
   Schlüssel, Stufen und Rechte – 1:1 wie im Bürgerportal (index.html),
   damit Konsole und Portal dieselben Regeln anwenden.
   ===================================================================== */
import { ABIS_NAME, CONSOLE_MIN_LEVEL } from '../config.js';

export const KEYS = {
  REG: 'mks:registry:v4',
  TYPES: 'mks:apptypes:v1',
  TYPEUNITS: 'mks:apptypeunits:v1',
  APPTS: 'mks:appointments:v1',
  APPS: 'mks:applications:v1',
  SURVEYS: 'mks:surveys:v1',
  ELECTIONS: 'mks:elections:v1',
  RECORDS: 'mks:records:v1',
  WARRANTS: 'mks:warrants:v1',
  UNITS: 'mks:units:v1',
  PERMS: 'mks:perms:v1',
  CHAT: 'mks:chat:v1',
  ANNOUNCE: 'mks:announcements:v1',
  SUPPORT: 'mks:support:v1',
  FEATURES: 'mks:featurereq:v1',
  PATCHNOTES: 'mks:patchnotes:v1',
  RELOAD: 'mks:reload:signal',
  MAINT: 'mks:maintenance:v1',
};
export const KEY_LABEL = {
  [KEYS.REG]: 'Bürgerregister', [KEYS.TYPES]: 'Antragsarten', [KEYS.TYPEUNITS]: 'Zuordnung der Antragsarten',
  [KEYS.APPTS]: 'Termine', [KEYS.APPS]: 'Bewerbungen', [KEYS.SURVEYS]: 'Umfragen', [KEYS.ELECTIONS]: 'Wahlen',
  [KEYS.RECORDS]: 'Führungszeugnisse', [KEYS.WARRANTS]: 'Haftbefehle', [KEYS.UNITS]: 'Zuordnungen', [KEYS.PERMS]: 'Berechtigungen',
  [KEYS.CHAT]: 'Chat', [KEYS.ANNOUNCE]: 'Ankündigungen', [KEYS.SUPPORT]: 'Support-Tickets', [KEYS.FEATURES]: 'Feedback',
  [KEYS.PATCHNOTES]: 'Patch Notes', [KEYS.RELOAD]: 'Neuladen-Signal', [KEYS.MAINT]: 'Wartungsmodus',
};
/* Spiegel von key_read_level / key_write_level (sql/1-tabellen-und-funktionen.sql) */
export function keyReadLevel(k) {
  if (k.startsWith('mks:records:') || k.startsWith('mks:warrants:')) return 3;
  if (k.startsWith('mks:perms:')) return 5;
  return 0;
}
export function keyWriteLevel(k) {
  if (k.startsWith('mks:registry:') || k.startsWith('mks:apptypes') || k.startsWith('mks:announce')) return 4;
  if (k.startsWith('mks:units:') || k.startsWith('mks:perms:') || k.startsWith('mks:patchnotes:') || k.startsWith('mks:maintenance:') || k.startsWith('mks:reload:')) return 6;
  if (k.startsWith('mks:records:') || k.startsWith('mks:warrants:')) return 3;
  return 0;
}

export const CLEARANCE = { regierung: 0, register: 3, admintermine: 2, antraege: 3, apptypes: 4, assign: 4, clearance: 5, lock: 5, credentials: 6 };
export const IS_LABEL = ['Unklassifiziert', 'Eingeschränkt', 'Vertraulich', 'Geheim', 'Streng geheim', 'Administrativ', 'Souverän'];
export const APP_STEPS = ['Eingereicht', 'In Prüfung', 'Entscheidung', 'Bewilligt'];

export const MINISTRIES = ['Gesundheitsministerium', 'Zukunftsministerium', 'Innenministerium', 'Verteidigungsministerium', 'Finanzministerium',
  'Landschaftsministerium', 'Außenministerium', 'Justizministerium', 'Wirtschaftsministerium', 'Verkehrsministerium', ABIS_NAME];
export const ORGANE = ['Militär', 'Polizei'];
export const BUNDES = ['Bundesverwaltung'];
export const ALL_UNITS = [...MINISTRIES, ...ORGANE, ...BUNDES];
export function unitShort(name) { return name === ABIS_NAME ? 'ABIS' : String(name).replace(/ministerium$/i, '.-Min.'); }

/* Navigationsbereiche des Portals – für „nav:<id>“-Rechte und Zuordnungs-Freigaben */
export const PORTAL_NAV = [
  { id: 'uebersicht', label: 'Übersicht', need: 0 }, { id: 'ankuendigungen', label: 'Ankündigungen', need: 0 },
  { id: 'termine', label: 'Termine', need: 0 }, { id: 'bewerbungen', label: 'Bewerbungen', need: 0 },
  { id: 'umfragen', label: 'Umfragen', need: 0 }, { id: 'wahlen', label: 'Wahlen', need: 0 }, { id: 'chat', label: 'Chat', need: 0 },
  { id: 'support', label: 'Support', need: 0 }, { id: 'features', label: 'Feedback', need: 0 }, { id: 'banking', label: 'Banking', need: 0 },
  { id: 'ausweis', label: 'Ausweis', need: 0 }, { id: 'patchnotes', label: 'Patch Notes', need: 0 },
  { id: 'register', label: 'Bürgerregister', need: 3 }, { id: 'antraege', label: 'Anträge', need: 3 }, { id: 'antragsarten', label: 'Antragsarten', need: 4 },
  { id: 'admintermine', label: 'Alle Termine', need: 2 }, { id: 'regierung', label: 'Regierung', need: 0 }, { id: 'credentials', label: 'Anmeldedaten', need: 6 },
  { id: 'adminpatchnotes', label: 'Admin Patch Notes', need: 6 }, { id: 'fuehrungszeugnisse', label: 'Führungszeugnisse', need: 0 },
  { id: 'haftbefehle', label: 'Haftbefehle', need: 0 }, { id: 'berechtigungen', label: 'Berechtigungen', need: 6 },
  { id: 'bankmanagement', label: 'Bankmanagement', need: 6 }, { id: 'zuordnungen', label: 'Zuordnungen', need: 6 },
  { id: 'umfrageaudit', label: 'Umfrage-Auswertung', need: 6 }, { id: 'wahlaudit', label: 'Wahl-Auswertung', need: 6 },
];

/* Einzelrechte – identisch mit CAPS im Portal */
export const CAPS = [
  { id: 'register.edit', group: 'Bürgerregister', label: 'Stammdaten & Zuordnung ändern', level: CLEARANCE.assign },
  { id: 'register.create', group: 'Bürgerregister', label: 'Neue Bürger anlegen', level: CLEARANCE.assign },
  { id: 'register.level', group: 'Bürgerregister', label: 'Level vergeben', level: CLEARANCE.clearance },
  { id: 'register.lock', group: 'Bürgerregister', label: 'Konten sperren / entsperren', level: CLEARANCE.credentials },
  { id: 'register.delete', group: 'Bürgerregister', label: 'Bürger löschen', level: CLEARANCE.lock },
  { id: 'chat.all', group: 'Chat', label: 'Alle Chats sehen (auch private)', level: CLEARANCE.credentials },
  { id: 'chat.delete', group: 'Chat', label: 'Nachrichten löschen', level: CLEARANCE.assign },
  { id: 'chat.kick', group: 'Chat', label: 'Mitglieder entfernen', level: CLEARANCE.clearance },
  { id: 'support.agent', group: 'Support', label: 'Alle Tickets sehen & beantworten', level: 99 },
  { id: 'records.view', group: 'Justiz & Polizei', label: 'Führungszeugnisse einsehen', level: 99 },
  { id: 'records.edit', group: 'Justiz & Polizei', label: 'Führungszeugnisse bearbeiten', level: CLEARANCE.clearance },
  { id: 'records.delete', group: 'Justiz & Polizei', label: 'Führungszeugnisse löschen', level: CLEARANCE.clearance },
  { id: 'warrants.approve', group: 'Justiz & Polizei', label: 'Haftbefehle genehmigen', level: CLEARANCE.clearance },
  { id: 'surveys.manage', group: 'Umfragen & Wahlen', label: 'Umfragen & Wahlen erstellen', level: CLEARANCE.clearance },
  { id: 'audit.view', group: 'Umfragen & Wahlen', label: 'Auswertungen einsehen', level: CLEARANCE.credentials },
  { id: 'announce.post', group: 'Sonstiges', label: 'Ankündigungen veröffentlichen', level: CLEARANCE.assign },
  { id: 'patchnotes.edit', group: 'Sonstiges', label: 'Patch Notes bearbeiten', level: 99 },
  { id: 'credentials.reset', group: 'Sonstiges', label: 'Passwörter zurücksetzen', level: CLEARANCE.credentials },
  { id: 'apps.delete', group: 'Sonstiges', label: 'Bewerbungen löschen', level: CLEARANCE.clearance },
  { id: 'backup.export', group: 'Administration', label: 'Sicherung herunterladen', level: CLEARANCE.credentials },
  { id: 'backup.import', group: 'Administration', label: 'Sicherung einspielen (überschreibt alles)', level: 99 },
  { id: 'maintenance', group: 'Administration', label: 'Wartungsmodus schalten', level: 99 },
  { id: 'reload.all', group: 'Administration', label: 'Offene Instanzen neu laden', level: 99 },
  { id: 'support.delete', group: 'Administration', label: 'Support-Tickets löschen', level: 99 },
  { id: 'feedback.view', group: 'Administration', label: 'Eingereichtes Feedback sehen', level: 99 },
  { id: 'units.manage', group: 'Administration', label: 'Zuordnungen verwalten', level: CLEARANCE.credentials },
  { id: 'perms.manage', group: 'Administration', label: 'Berechtigungen verwalten', level: CLEARANCE.credentials },
  { id: 'result.rig', group: 'Administration', label: 'Ergebnisse anpassen (Umfragen & Wahlen)', level: 99 },
];
function capDefaultLevel(cap) { const c = CAPS.find((x) => x.id === cap); return c ? c.level : 99; }

/* Zentrale Rechteprüfung: Administrator > Entzug > Erteilung > Level */
export function can(me, cap) {
  if (!me) return false;
  if (me.isAdmin) return true;
  if (me.deny.includes(cap)) return false;
  if (me.allow.includes(cap)) return true;
  return me.is >= capDefaultLevel(cap);
}
export function normPerm(p) { return { allow: Array.isArray(p && p.allow) ? p.allow : [], deny: Array.isArray(p && p.deny) ? p.deny : [] }; }
export function normUnit(u) {
  return { id: u.id, name: String(u.name || '').trim(), kind: u.kind || 'ministerium', nav: Array.isArray(u.nav) ? u.nav : [],
    autoLevel: Math.max(0, Math.min(6, Number(u.autoLevel) || 0)), allow: Array.isArray(u.allow) ? u.allow : [],
    deny: Array.isArray(u.deny) ? u.deny : [], boss: u.boss || '' };
}
export function grantsFor(units, ministries) {
  const m = Array.isArray(ministries) ? ministries : [];
  const allow = new Set(), deny = new Set(); let lvl = 0;
  (units || []).filter((u) => m.includes(u.name)).forEach((u) => {
    (u.nav || []).forEach((id) => allow.add('nav:' + id));
    (u.allow || []).forEach((c) => allow.add(c));
    (u.deny || []).forEach((c) => deny.add(c));
    lvl = Math.max(lvl, Number(u.autoLevel) || 0);
  });
  return { allow: [...allow], deny: [...deny], autoLevel: lvl };
}

/* Wer bin ich? Level und Admin-Recht aus dem Profil (Datenbank), Stammdaten aus dem Register */
export function buildMe(profile, registry, units, perms) {
  if (!profile) return null;
  const base = (registry || []).find((c) => c.id === profile.citizen_id)
    || { id: profile.citizen_id, name: profile.name || 'Konto', role: profile.is_admin ? 'Administrator' : 'Verwaltung', ministries: [] };
  const ministries = Array.isArray(profile.ministries) && profile.ministries.length ? profile.ministries : (base.ministries || []);
  const baseLevel = profile.is_admin ? 6 : (Number(profile.level) || 0);
  const g = grantsFor(units, ministries);
  const own = normPerm((perms || {})[base.id]);
  const allow = [...new Set([...g.allow, ...own.allow])].filter((c) => !own.deny.includes(c));
  const deny = [...new Set([...g.deny, ...own.deny])].filter((c) => !own.allow.includes(c));
  return { ...base, ministries, isAdmin: !!profile.is_admin, baseLevel, is: Math.max(baseLevel, g.autoLevel), allow, deny,
    email: profile.email, uid: profile.uid, isJusticeLead: (units || []).some((u) => u.boss === base.id && /justiz/i.test(u.name)) };
}
/* Darf diese Person die Konsole öffnen? (Zugang prüft die Datenbank zusätzlich bei jedem Zugriff) */
export function consoleAllowed(profile) {
  if (!profile) return false;
  if (profile.is_admin) return true;
  if ((Number(profile.level) || 0) >= CONSOLE_MIN_LEVEL) return true;
  return Array.isArray(profile.ministries) && profile.ministries.includes(ABIS_NAME);
}
/* Bank-Administrator = is_admin oder Level 6 (public.bank_is_admin) */
export function bankAdmin(me) { return !!me && (me.isAdmin || me.baseLevel >= 6); }
export function maxAssignableLevel(me) { return me && me.is >= 6 ? 6 : 4; }

/* Justiz – wie im Portal */
export const REDACT_TIERS = [
  { key: 'alle', rank: 0, label: 'Alle Berechtigten (inkl. Polizei)' },
  { key: 'ministerium', rank: 1, label: 'Justizministerium (Mitarbeiter & Leitung)' },
  { key: 'justizleitung', rank: 2, label: 'Nur Leitung des Justizministeriums' },
  { key: 'leitung', rank: 3, label: 'Nur Level 5 und 6' },
  { key: 'souveraen', rank: 4, label: 'Nur Level 6' },
];
export function tierRank(key) { const t = REDACT_TIERS.find((x) => x.key === key); return t ? t.rank : 0; }
function inUnit(me, unit) { return !!me && me.ministries.includes(unit); }
function roleMatches(me, re) { return !!me && re.test(String(me.role || '') + ' ' + String(me.status || '')); }
export function isJusticeOfficer(me) { return !!me && (me.isAdmin || me.is >= CLEARANCE.clearance || inUnit(me, 'Justizministerium') || roleMatches(me, /justiz|richter|staatsanwalt/i)); }
export function isPoliceOfficer(me) { return !!me && (inUnit(me, 'Polizei') || roleMatches(me, /polizei|polizist/i)); }
export function canSeeRecords(me) {
  if (!me) return false;
  if (me.deny.includes('records.view')) return false;
  if (me.allow.includes('records.view')) return true;
  return isJusticeOfficer(me) || isPoliceOfficer(me) || me.allow.includes('nav:fuehrungszeugnisse') || me.allow.includes('nav:haftbefehle');
}
export function canDeleteRecord(me, units) {
  if (!me) return false;
  if (me.deny.includes('records.delete')) return false;
  if (me.allow.includes('records.delete')) return true;
  return me.isAdmin || me.is >= CLEARANCE.clearance || (units || []).some((u) => u.boss === me.id && /justiz/i.test(u.name));
}
export function viewerRank(me) {
  if (!me) return -1;
  if (me.isAdmin || me.is >= CLEARANCE.credentials) return 4;
  if (me.is >= CLEARANCE.clearance) return 3;
  if (me.isJusticeLead) return 2;
  if (isJusticeOfficer(me)) return 1;
  if (isPoliceOfficer(me)) return 0;
  return -1;
}
export function clampTier(me, tier) {
  const r = viewerRank(me);
  return tierRank(tier) <= r ? (tier || 'alle') : (REDACT_TIERS.find((t) => t.rank === r) || REDACT_TIERS[0]).key;
}
/* Wörter einer geschwärzten Zeile – Schwärzungen ab einer Stufe über der eigenen bleiben verborgen */
export function redact(text, marks, rank, wholeTier) {
  if (wholeTier && rank < tierRank(wholeTier)) return String(text || '').replace(/\S/g, '█');
  let wi = -1;
  return String(text || '').split(/(\s+)/).map((p) => {
    if (!p || /^\s+$/.test(p)) return p;
    wi++;
    const m = marks && marks[wi];
    return m && rank < tierRank(m) ? '█'.repeat(Array.from(p).length) : p;
  }).join('');
}

/* Anträge */
export function canHandleApplication(me, app, units) {
  if (!me) return false;
  if (me.isAdmin || me.is >= CLEARANCE.clearance) return true;
  const unit = app && app.unit;
  if (!unit) return false;
  const u = (units || []).find((x) => x.name === unit);
  if (u && u.boss === me.id) return true;
  return me.is >= CLEARANCE.assign && me.ministries.includes(unit);
}
export function manageableUnits(me, units) {
  if (!me) return [];
  if (me.isAdmin || me.is >= CLEARANCE.clearance) return units || [];
  return (units || []).filter((u) => (u.boss && u.boss === me.id) || (me.is >= CLEARANCE.assign && me.ministries.includes(u.name)));
}
export function normType(x) {
  const questions = Array.isArray(x.questions) ? x.questions.filter((q) => q && q.trim()) : (x.question && x.question.trim() ? [x.question] : []);
  return { ...x, id: x.id, label: x.label, questions, unit: x.unit || '', grantOnAccept: !!x.grantOnAccept, cooldownH: Number(x.cooldownH) || 0, cooldownM: Number(x.cooldownM) || 0 };
}
export function inferUnitFromLabel(label, units) {
  const l = String(label || '').toLowerCase();
  if (!l) return '';
  const byName = (units || []).find((u) => l.includes(String(u.name || '').toLowerCase()));
  if (byName) return byName.name;
  if (l.includes('abis')) { const a = (units || []).find((u) => u.name === ABIS_NAME); if (a) return a.name; }
  const byWord = (units || []).find((u) => { const w = String(u.name || '').replace(/ministerium$/i, '').toLowerCase(); return w.length > 3 && l.includes(w); });
  return byWord ? byWord.name : '';
}
export function canHandleAppt(me, a) {
  if (!me || me.is < CLEARANCE.admintermine) return false;
  if (me.is >= 6) return true;
  if (ALL_UNITS.includes(a.office)) return me.ministries.includes(a.office);
  return true;
}

/* Wahlen & Umfragen */
export function electionPhase(e) {
  const now = Date.now();
  if (now < new Date(e.startsAt).getTime()) return 'ankuendigung';
  if (now < new Date(e.endsAt).getTime()) return 'wahl';
  return 'beendet';
}
export function voteIdx(v) { return v && typeof v === 'object' ? v.idx : v; }
export function voteAt(v) { return v && typeof v === 'object' ? v.at : null; }

/* Namen */
export function nameParts(full) {
  const t = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return { first: '', last: '' };
  if (t.length === 1) return { first: t[0], last: '' };
  return { first: t[0], last: t[t.length - 1] };
}
export function displayName(full) { const { first, last } = nameParts(full); return last ? last + ', ' + first : first; }
export function initials(full) { const { first, last } = nameParts(full); return ((first[0] || '') + (last[0] || '')).toUpperCase() || '★'; }

/* Login-Adresse wie im Portal */
export const CITIZEN_DOMAIN = 'buerger.maiskolbistan.mk';
function slugName(name) {
  return (name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'buerger';
}
export function loginEmailFor(c) {
  if (c.loginEmail) return c.loginEmail.toLowerCase();
  if (c.email && c.email.includes('@')) return c.email.toLowerCase();
  return slugName(c.name) + '@' + CITIZEN_DOMAIN;
}
export function genPassword(len) {
  const set = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const n = len || 12; const rnd = window.crypto.getRandomValues(new Uint32Array(n));
  let s = ''; for (let i = 0; i < n; i++) s += set[rnd[i] % set.length];
  return s;
}
export async function sha256Hex(text) {
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
