# ABIS-Sicherheitskonsole · Bürgerportal Maiskolbistan

Eigenständige Verwaltungs- und Überwachungsseite der **Administration für Buchhaltung und Informationssicherheit (ABIS)**.
Sie läuft auf **GitHub Pages** und verbindet sich mit **derselben Supabase-Datenbank** wie das Bürgerportal auf Netlify.
Anmeldung mit den normalen Portal-Zugangsdaten.

## Zugang

| Wer | Zugang |
|---|---|
| Administrator (`administrator` / `admin`) | alles |
| Level 6 | alles außer reinen Administrator-Rechten (Wartung, Sicherung einspielen …) |
| Level 5 | Konsole, Register, Anträge, Justiz, Protokolle der Konsole – **keine** Bankdaten (Datenbank gibt sie nicht heraus) |
| ABIS-Mitglieder (beliebiges Level) | Konsole öffnen; sichtbar ist nur, was Level und Rechte erlauben |
| alle anderen | Zugang verweigert, sofort wieder abgemeldet |

Jede Seite prüft dieselben Rechte wie das Portal (Level, Zuordnungen, Einzelrechte). Unabhängig davon setzt die Datenbank
alles per **RLS** und security-definer-Funktionen durch – die Konsole kann nichts, was die Datenbank nicht erlaubt.

## Bereiche

**Überwachung**
- **Lagezentrum** – Ledger-Integrität, Transaktionen/Sicherheitsereignisse der letzten 24 h, DB-Antwortzeit (alle 10 s),
  Edge-Function- und Scheduler-Status, automatische Alarme (z. B. ≥ 3 abgelehnte Bankvorgänge eines Akteurs in 15 min), Alarmstufe 1–5, Ereignisprotokoll.
- **Sicherheitsprotokoll** – Bank-Audit-Log, Anmeldungen, Datenänderungen, Verwaltungsaktionen, Live-Ereignisse; Filter + CSV-Export.
- **Datenbank** – alle `kv`-Datensätze mit Größe, Änderungszeit, Lese-/Schreib-Level (JSON-Ansicht/Download), Profile,
  Tabellen mit RLS-Status (Alarm bei Tabellen ohne RLS), Konsistenzprüfung Register ↔ Profile.
- **Transaktionen** – Journal aller Buchungen mit Filtern, Ledger, Audit, Storno.

**Buchhaltung** – Bankmanagement: Konten (sperren, eigenständige Konten anlegen/ändern/stilllegen, Zugangsdaten zurücksetzen),
Gutschrift/Abbuchung, Dauerzahlungen, Steuern (Übersicht, Steuerkonto, Bericht + CSV), Integritätsprüfung.

**Verwaltung** – Bürgerregister, Anmeldedaten (Passwörter zurücksetzen), Anträge (+ Staatsbürgerschaftsanträge),
Antragsarten, Termine, Justiz & Polizei (Führungszeugnisse mit Schwärzung, Haftbefehle), Kommunikation (Chat-Überwachung, Support, Feedback, Ankündigungen).

**Steuerung** – Zuordnungen, Berechtigungen, Wahl-/Umfrage-Auswertung, System & Wartung (Wartungsmodus mit Einmalcode, Neuladen aller Instanzen, Sicherung, Patch Notes).

## Spieleportal (öffentlich, ohne Anmeldung)

Unter `https://<name>.github.io/<repo>/spiele/` liegt das **Spieleportal**: eine Übersicht mit Kacheln, Suche und Kategorien.
Ein Klick öffnet die Spielseite, die die hinterlegte Adresse **in einem Rahmen (iframe) direkt auf der Seite lädt** –
mit Vollbild, „Neu starten“, Beschreibung und weiteren Spielen. Besucher brauchen kein Konto; „Zuletzt gespielt“ merkt sich nur der eigene Browser.

**Spiele verwalten:** in der Konsole unter **Verwaltung → Spiele** (Administrator und Level 4+): Titel, Adresse (URL), Beschreibung,
optionales Vorschaubild, Kategorie, Format (16:9, 4:3, Hochformat), Reihenfolge, sichtbar/ausgeblendet. „Testen“ öffnet das Spiel im Portal.

**Einmalig einrichten:** `sql/spiele.sql` im Supabase-SQL-Editor ausführen. Die Tabelle `spiele` ist per RLS so geschützt, dass
jeder freigeschaltete Spiele lesen, aber nur Administrator und Level 4+ etwas ändern kann.

Hinweise:
- Adressen müssen mit `https://` beginnen.
- Manche Anbieter verbieten das Einbetten ihrer Seite (`X-Frame-Options` / `frame-ancestors`). Dann bleibt der Rahmen leer –
  solche Spiele lassen sich nur über „In neuem Tab“ öffnen. Nach dem Anlegen kurz mit „Testen“ prüfen.
- Der Rahmen ist abgeschottet (`sandbox`): Ein Spiel kann die Portalseite nicht auf eine andere Adresse umleiten.

## Einrichtung

### 1. GitHub Pages
1. Repository → **Settings → Pages → Source: „GitHub Actions“**.
2. Auf `main` pushen (oder den Workflow „GitHub Pages“ manuell starten). Die Seite erscheint unter `https://<name>.github.io/<repo>/`.

### 2. Datenbank (optional, empfohlen)
`sql/abis-ueberwachung.sql` einmal im Supabase-SQL-Editor ausführen. Danach werden dauerhaft protokolliert:
- jede Änderung an `kv` (wer, wann, welcher Datensatz, Größe vorher/nachher, Prüfsumme),
- Anmeldungen, Sperren, Passwort- und E-Mail-Änderungen (Trigger auf `auth.users`),
- Aktionen in der Konsole,
- dazu die Tabellen-/RLS-Übersicht.

Lesen dürfen nur Administrator und Level 5/6; ändern oder löschen kann niemand (außer `abis_prune_logs` für den Administrator).
Ein Fehler beim Protokollieren bricht nie die eigentliche Änderung ab. Ohne das Skript läuft die Konsole trotzdem
(dann zeigen diese Protokolle einen Einrichtungshinweis).

### 3. Datenbank-Adresse
Steht in `src/config.js` (dieselbe URL und derselbe öffentliche anon-Key wie im Portal).

## Sicherheit
- Content-Security-Policy im Build: Skripte nur von der eigenen Seite, Verbindungen nur zu Supabase.
  Nur das Spieleportal darf zusätzlich fremde https-Seiten in Rahmen laden und fremde Vorschaubilder zeigen – die Konsole nicht.
- Automatische Abmeldung nach 20 Minuten ohne Eingabe; wachsende Wartezeit nach Fehlversuchen bei der Anmeldung.
- Eigene Sitzung (getrennt vom Portal), `noindex`, kein Referrer.
- Änderungen an Portaldaten werden immer auf dem **aktuellen** Datenbankstand ausgeführt (lesen → ändern → schreiben), damit gleichzeitige Änderungen aus dem Portal nicht überschrieben werden.

## Entwicklung
```bash
npm install
npm run dev      # lokal
npm run build    # nach dist/
```
