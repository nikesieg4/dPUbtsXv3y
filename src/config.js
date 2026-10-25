/* =====================================================================
   VERBINDUNG ZUR DATENBANK
   Dieselbe Supabase-Datenbank wie das Bürgerportal (Netlify).
   Der anon-Key ist öffentlich – geschützt wird über Anmeldung + RLS.
   ===================================================================== */
export const SUPABASE_URL = 'https://tyfdwdzglguiiqbsttav.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZmR3ZHpnbGd1aWlxYnN0dGF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjc0NTIsImV4cCI6MjA5NzgwMzQ1Mn0.d7LwJH1gsXgz_h0TrQLPX38uI6slf0IpeFwFXxe99Uc';

/* Kurznamen für die Anmeldung (wie im Bürgerportal) */
export const LOGIN_ALIASES = {
  administrator: 'administrator@maiskolbistan.app',
  admin: 'administrator@maiskolbistan.app',
};

/* Wer darf die Konsole öffnen?
   Administrator, Level 5 und 6 sowie Mitglieder der ABIS.
   Was jemand sehen und ändern darf, entscheidet danach jede Seite
   einzeln – und unabhängig davon die Datenbank (RLS). */
export const CONSOLE_MIN_LEVEL = 5;
export const ABIS_NAME = 'Administration für Buchhaltung und Informationssicherheit';

/* Automatische Abmeldung nach so vielen Minuten ohne Eingabe */
export const IDLE_LOGOUT_MIN = 20;

export const APP_VERSION = '1.0.0';
