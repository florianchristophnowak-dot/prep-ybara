# Prép-ybara Desktop (Windows)

Lokale PC-App (Electron + React) für **Wochenstundenplan**, **Unterrichtssequenzen** und **Einzelstundenplanung** mit **45‑Minuten‑Zeitstrahl** (Phasen per Drag), **Sozialformen‑Autocomplete**, **Kompetenzen**, **Schulkalender (ICS‑Import)**, **PDF‑Export**, **Woche duplizieren**, **Backup/Restore**.

## Voraussetzungen
- Windows 10/11
- Node.js (LTS) installiert (damit `npm`/`npx` funktionieren)

## 1) App starten (sofort, ohne Installer)
1. ZIP entpacken
2. PowerShell im Projektordner öffnen
3. (Falls PowerShell Skripte blockiert)
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
4. Abhängigkeiten installieren:
   ```powershell
   npm install
   ```
5. App starten:
   ```powershell
   npm run dev
   ```

## 2) Windows-Installer / EXE bauen (lokal auf deinem PC)
> Wichtig: Das Erstellen einer Windows-EXE funktioniert am zuverlässigsten direkt unter Windows.

```powershell
npm run dist
```

Danach findest du die Installer/EXE unter:
- `dist/` (im Projektordner)

### Portable EXE (ohne Installation)
```powershell
npm run dist:portable
```

## Daten speichern / Backup
- Die App speichert lokal in deinem Benutzerprofil (Electron Store, Datei `prepybara`).
- In der Wochenansicht:
  - **Backup exportieren** → JSON-Datei speichern
  - **Backup importieren** → JSON-Datei wiederherstellen

## Versionsverlauf
- Neben dem Rückgängigmachen führt die App einen lokalen **Versionsverlauf**: frühere Fassungen
  einzelner Stunden, Sequenzen und Sammelaktionen (z. B. eine verschobene Sequenz).
- Er liegt **getrennt** von der Planung – Desktop: eigene Store-Datei `prepybara-verlauf`;
  Browser: eigene IndexedDB-Datenbank `prepybara-verlauf`. Er ist deshalb **nicht** Teil eines
  Backups, wandert nicht nach Pocket und nicht in exportierte Vorlagen.
- Aufbewahrt werden höchstens 30 Tage, 20 Fassungen je Stunde bzw. Sequenz und 400 Einträge
  insgesamt. Binärkopien angehängter Dateien werden nie gespeichert, nur Verweise.
- Zu finden über **Versionsverlauf** in der Stunde und im ⋯-Menü einer Sequenz;
  leeren lässt er sich in den **Einstellungen**.

## PDF
- In der Einzelstundenansicht: **PDF speichern** (wird als A4-PDF erzeugt)

---

# Prép-ybara Pocket (mobile Begleit-App)

> **Pocket erfasst – Prép-ybara organisiert.**

Pocket ist eine sehr schlanke, installierbare Web-App (PWA) fürs Smartphone.
Sie plant *einzelne Stunden unterwegs* – und ist ausdrücklich **keine
verkleinerte Fassung** der Desktop-App: keine Jahresplanung, keine Sequenzen,
keine Materialbibliothek, keine Nachbereitung.

Alles bleibt lokal: kein Konto, keine Cloud, keine KI, keine externen Dienste,
keine Statistik. Der Austausch mit der Desktop-App läuft **ausschliesslich über
Dateien**.

## Aufbau des Projekts

```
renderer/          Desktop-App (Electron + Browser-Fassung)   – unverändert
  src/doppelstunde.js       Doppelstunden: welche Stundenplätze eine Stunde belegt
  src/versionsverlauf.js    Versionsverlauf: Einträge, Bündelung, Aufbewahrung, Wiederherstellung
  src/verlauf-speicher.js   dessen Ablage (lädt erst bei Bedarf, schreibt der Reihe nach)
  src/verlauf-ansicht.jsx   Dialog: Fassungen ansehen und zurückholen
  src/jahresbalken.js       optionale Verbindung von Jahresbalken und Sequenzen
  src/verschieben.js        Verschiebevorschläge: Ferien, Doppelstunden, Konflikte, Atomarität
  src/verschieben-dialog.jsx  Vorschau und Ausführung des Verschiebens
  src/suche.js              Suchindex, Normalisierung, Treffer, sichere Hervorhebung
  src/suche-ansicht.jsx     Suchansicht mit Filtern und Treffergruppen
electron/          Hauptprozess, Preload, Menü
pocket/            Prép-ybara Pocket (PWA)
  src/views/       mobile Ansichten
  vite.config.mjs  eigener Bau, eigener Service Worker
shared/            von beiden benutzt
  exchange/        Austauschformat, stabile Kennungen, Prüfung
  types/           Typbeschreibung des Formats (.d.ts)
  datum.js         Datumsrechnung
tests/             node:test – Format, Import, Pocket-Modell, Doppelstunden,
                   Versionsverlauf, Jahresbalken, Verschieben, Suche
```

Geteilt werden **Format, Kennungen und Prüfung** – keine Oberflächenbausteine.
Desktop und Pocket haben **getrennte Versionsnummern**; verträglich sind sie
über die `schemaVersion` der Austauschdateien.

## Befehle

```bash
npm install          # einmal, für beide Anwendungen

npm run dev          # Desktop (Vite + Electron)
npm run build        # Desktop-Renderer bauen
npm run dist:win     # Windows-Installer

npm run dev:pocket   # Pocket im Browser, Port 5174
npm run build:pocket # Pocket bauen  → dist/pocket
npm run preview:pocket
npm run build:all    # beides

npm test             # Austauschformat, Import, Pocket-Modell
```

Zum Ausprobieren auf dem Telefon: `npm run dev:pocket` starten und im
Handy-Browser die angezeigte Netzwerkadresse öffnen (gleiches WLAN). Im
Entwicklungsmodus gibt es keinen Service Worker – Installation und
Offlinebetrieb lassen sich nur mit `npm run build:pocket` prüfen.

## Pocket veröffentlichen (GitHub Pages)

Der Arbeitsablauf `.github/workflows/pocket-pages.yml` baut Pocket bei jedem Push
auf `main` und veröffentlicht **ausschliesslich** `dist/pocket`. Die Desktop-App
und deren Windows-/macOS-Bau (`build.yml`) bleiben davon unberührt.

Einmalig einzustellen: **Repository → Settings → Pages → Source: GitHub Actions**.

Danach ist Pocket per HTTPS erreichbar unter
`https://<benutzername>.github.io/<repository>/` und lässt sich von dort auf
Android und iPhone installieren.

Den Unterpfad von GitHub Pages kennt der Bau über die Umgebungsvariable
`POCKET_BASE`, die der Arbeitsablauf aus der Pages-Konfiguration übernimmt –
ohne sie bleibt alles relativ, `dev:pocket` und `preview:pocket` ändern sich
nicht. Einzelheiten in [`pocket/README.md`](pocket/README.md).

## Austauschdateien

| Datei | Richtung | Inhalt |
|---|---|---|
| `.prepybara-profile` | Desktop → Pocket | Lerngruppen, Fächer, Stundenplan (4 Wochen), Kompetenzen, Sprechabsichten, Sozialformen, Phasentypen |
| `.prepybara-lesson` | Pocket → Desktop | eine geplante Stunde |
| `.prepybara-lessons` | Pocket → Desktop | mehrere Stunden in einer Datei |

Technisch JSON, jede Datei nennt `format` und `schemaVersion`.
**Nicht enthalten:** Schülerlisten, Noten, Leistungsdaten, Nachbereitung, To-dos.

## Wege

**Profil aufs Telefon:** Desktop → *Einstellungen → Prép-ybara Pocket →
Pocket-Profil exportieren* (oder Menü *Import / Export*) → Datei aufs Telefon →
Pocket → *Einstellungen → Profil importieren*. Ein neues Profil löscht keine
Entwürfe.

**Stunde an den PC:** Pocket → *Für Prép-ybara exportieren* (Teilen oder
Herunterladen) → Desktop → *Einstellungen → Pocket-Import öffnen* → Datei
wählen oder hineinziehen → **Vorschau** → *Importieren*.

Steht am Zieltermin bereits eine Planung, wird **nie automatisch
überschrieben**: beibehalten, als neue Stunde importieren, Phasen anhängen oder
ersetzen. Jeder Import ist mit **Strg+Z** zurückzunehmen.

## Hinweis
Wenn beim Start etwas nicht klappt, poste bitte die komplette Fehlermeldung aus PowerShell.
