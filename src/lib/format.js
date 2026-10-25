/* Formatierung, Beträge (immer ganze Maiscent: 1 M$ = 100), CSV */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidOk(s) { return UUID_RE.test(String(s || '').trim()); }
export function shortId(id) { const s = String(id || ''); return s.length > 13 ? s.slice(0, 4) + '…' + s.slice(-4) : s || '—'; }

export function fmtMinor(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  return (v < 0 ? '−' : '') + Math.floor(a / 100).toLocaleString('de-DE') + ',' + String(a % 100).padStart(2, '0');
}
export function fmtM(n) { return fmtMinor(n) + ' M$'; }
/* „12“, „12,5“, „12.50“, „1.234,50“ → Maiscent; ungültig → null (ohne Fließkomma) */
export function parseMinor(input) {
  let s = String(input == null ? '' : input).replace(/M\$|\s/g, '');
  if (!s || s.length > 20) return null;
  if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/\.\d{3}$/.test(s)) s = s.replace('.', '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const parts = s.split('.');
  const minor = Number(parts[0]) * 100 + Number(((parts[1] || '') + '00').slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor < 1 || minor > 100000000000) return null;
  return minor;
}
export function fmtRate(r) { const n = Number(r); return Number.isFinite(n) ? String(n).replace('.', ',') + ' %' : '—'; }

export const fmtD = (ts) => { try { return ts ? new Date(ts).toLocaleDateString('de-DE') : '—'; } catch (e) { return '—'; } };
export const fmtT = (ts) => { try { return ts ? new Date(ts).toLocaleTimeString('de-DE') : ''; } catch (e) { return ''; } };
export const fmtDT = (ts) => (ts ? fmtD(ts) + ' ' + fmtT(ts) : '—');
export function fmtISO(ts) {
  try { const d = new Date(ts); const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); } catch (e) { return '—'; }
}
export const fmtDay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : '—'; };
export function relTime(ts) {
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!t) return '—';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'vor ' + Math.max(s, 0) + ' s';
  if (s < 3600) return 'vor ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'vor ' + Math.floor(s / 3600) + ' h';
  return 'vor ' + Math.floor(s / 86400) + ' d';
}
export function fmtBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1048576) return (v / 1024).toFixed(1).replace('.', ',') + ' KB';
  return (v / 1048576).toFixed(2).replace('.', ',') + ' MB';
}
export function jsonSize(v) { try { return new Blob([JSON.stringify(v)]).size; } catch (e) { return 0; } }
export function berlinToday() { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }

export const TX_TYPE = { tax: 'Steuerzahlung', transfer: 'Überweisung', admin_credit: 'Gutschrift (Verwaltung)', admin_debit: 'Abbuchung (Verwaltung)',
  recurring: 'Dauerzahlung', reversal: 'Stornierung', initial_deposit: 'Eröffnungsbuchung', standing_order: 'Dauerauftrag' };
export const TX_STATUS = { pending: ['Ausstehend', 'warn'], authorized: ['Autorisiert', 'info'], posted: ['Verbucht', 'ok'],
  rejected: ['Abgelehnt', 'warn'], failed: ['Fehlgeschlagen', 'bad'], reversed: ['Storniert', 'neutral'] };
export const TX_AUTH = { pending: 'Ausstehend', authorized: 'Autorisiert', denied: 'Verweigert' };
export const PAY_TYPE_LABEL = { NORMAL: 'Normale Zahlung', INCOME: 'Lohn / Einkommen', ADMIN_CREDIT: 'Admin-Gutschrift', ADMIN_DEBIT: 'Admin-Abbuchung',
  RECURRING: 'Monatliche Zahlung', REFUND: 'Rückerstattung', TAX: 'Steuerzahlung' };
export const JOURNAL_CATEGORY = [['ALL', 'Alle'], ['NORMAL', 'Normale Zahlungen'], ['INCOME', 'Lohn / Einkommen'], ['TAX', 'Steuerzahlungen'],
  ['ADMIN_CREDIT', 'Admin-Gutschriften'], ['RECURRING', 'Monatliche Zahlungen'], ['REFUND', 'Rückerstattungen'], ['FAILED', 'Fehlgeschlagene Zahlungen']];
export const FAIL_TXT = { insufficient_funds: 'Guthaben reicht nicht', recipient_not_found: 'Empfänger unbekannt', recipient_blocked: 'Empfänger gesperrt',
  sender_blocked: 'Absender gesperrt', same_account: 'Gleiches Konto', invalid_amount: 'Ungültiger Betrag', balance_limit: 'Kontostand-Obergrenze',
  tax_amount_too_small: 'Steuer wäre unter 0,01 M$', tax_account_protected: 'Steuerkonto geschützt', unknown: 'Unbekannt' };
export const SO_INTERVAL = { weekly: 'Wöchentlich', biweekly: 'Alle 2 Wochen', monthly: 'Monatlich', quarterly: 'Vierteljährlich', yearly: 'Jährlich' };
export const SO_STATUS = { active: ['Aktiv', 'ok'], paused: ['Pausiert', 'warn'], ended: ['Beendet', 'neutral'] };
export const SO_RUN = { success: ['Ausgeführt', 'ok'], failed: ['Fehlgeschlagen', 'bad'], retrying: ['Wiederholung geplant', 'warn'], skipped: ['Übersprungen', 'neutral'], pending: ['Ausstehend', 'neutral'] };

/* CSV (Semikolon, UTF-8 mit BOM). Zellen mit = + - @ am Anfang werden entschärft (CSV-Injection). */
function csvCell(v) {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = "'" + t;
  return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
export function buildCsv(header, rows) { return '﻿' + [header].concat(rows).map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'; }
export function downloadText(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
