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
- Die App speichert lokal in deinem Benutzerprofil (Electron Store).
- In der Wochenansicht:
  - **Backup exportieren** → JSON-Datei speichern
  - **Backup importieren** → JSON-Datei wiederherstellen

## PDF
- In der Einzelstundenansicht: **PDF speichern** (wird als A4-PDF erzeugt)

## Hinweis
Wenn beim Start etwas nicht klappt, poste bitte die komplette Fehlermeldung aus PowerShell.
