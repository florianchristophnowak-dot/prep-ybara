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
- Die Beobachtungen zu Lernenden sind **nicht** Teil dieses Backups; sie haben eine eigene,
  verschlüsselte Sicherung (siehe *Beobachtung (Lernende)*).

## Alle Daten löschen (Zurücksetzen auf null)
- **Einstellungen → Alle Daten löschen** setzt die App auf den Stand einer frischen
  Einrichtung zurück. Der Weg ist absichtlich mehrstufig – er ist unumkehrbar.
- Vier Sicherungen, damit es nicht versehentlich geschieht: Der Dialog **zählt** auf, was
  verloren geht (Stunden, Wochen, Lerngruppen, Lernende und Beobachtungen, eigene
  Beobachtungsfragen, Sequenzen, Vorlagen, Balken, To-dos, Kalendereinträge, archivierte
  Schuljahre); er nennt das **Datum des letzten Backups** und
  bietet an, sofort eines zu exportieren; ein **Kontrollkästchen** muss gesetzt und das Wort
  **ALLES LÖSCHEN** abgetippt werden. Der Fokus liegt auf *Abbrechen*.
- Das angebotene Backup enthält nur die Planung. Gibt es Lernende oder Beobachtungen, sagt der
  Dialog das ausdrücklich: Sie müssen vorher über **Beobachtung → Daten → Beobachtungen
  sichern** gesichert werden, sonst sind sie danach verloren.
- Geleert werden alle Ablagen der App – Desktop: `prepybara`, die frühere Ablage `lehrerplan`,
  `prepybara-verlauf` und `prepybara-beobachtung`; Browser: die IndexedDB-Datenbanken
  `prepybara`, `prepybara-verlauf`, `prepybara-beobachtung` und `prepybara-dateien` sowie der
  alte `localStorage`-Eintrag. Danach startet die App neu.
- **Nicht** angetastet werden Dateien ausserhalb der App: exportierte Backups und Vorlagen,
  Sicherungen der Beobachtungen, PDF-/Word-Ausgaben sowie sämtliche angehängten Materialien –
  von ihnen verschwinden nur die
  Verweise. Desktop-App und Browser-Version bleiben getrennt; gelöscht wird nur die Fassung,
  in der man sich befindet.
- Die Regeln dafür stehen rein und geprüft in `renderer/src/zuruecksetzen.js`
  (`tests/zuruecksetzen.test.mjs`); das Löschen selbst je Plattform in
  `renderer/src/platform/*` bzw. im IPC-Kanal `data:reset`.

## Meine Unterrichtszeiten (Stundenplanvorlagen)
- Eine **Wochenvorlage** (`timetableTemplates`) beschreibt die wiederkehrende Struktur:
  Wochentag, Stundenplatz, Klasse/Kurs, Fach, Raum, Einzel- oder Doppelstunde. Planungsinhalte
  (Thema, Lernziele, Kompetenzen, Phasen, Materialien, Hausaufgaben, Notizen, Sequenz,
  Nachbereitung) sind **nie** Teil einer Vorlage.
- Ein **Stundenplanmodell** (`timetableModels`) fasst zusammen, was für einen Zeitraum gilt:
  `singleWeek` (eine Vorlage) oder `alternatingWeeks` (A-/B-Zyklus). Der Zyklus ist eine Liste
  von Vorlagen-IDs – längere Rhythmen liessen sich später ohne Umbau ergänzen.
- Der A-/B-Rhythmus hängt an einer **Referenzwoche** und einer Wechselregel
  (`kalenderwochen` oder `unterrichtswochen`), nie an geraden/ungeraden Kalenderwochen.
  Einzelne Wochen lassen sich als Ausnahme abweichend zuordnen.
- Für denselben überschneidenden Gültigkeitszeitraum ist nur **ein** Modell aktiv; innerhalb
  eines Modells gehören A- und B-Woche gemeinsam zum Standard.
- Beim Anwenden werden nur freie Plätze gefüllt: nichts wird überschrieben, identische Stunden
  werden nicht doppelt angelegt, Ferien und schulfreie Tage werden übersprungen. Erzeugte
  Stunden tragen `timetableRef` (Modell, Vorlage, Eintrag, Fassung) – nur zur Wiedererkennung.
- Alles liegt in der Datenbank und damit in jedem Backup. Alte Backups ohne diese Felder
  funktionieren unverändert; eine frühere einzelne Standardvorlage wird zu einem Ein-Wochen-Modell.

## Einführung (Onboarding)
- Bei einer **leeren** Datenbank bietet die App einen Schnellstart an: drei Schritte bis zur
  ersten geplanten Stunde. Sind bereits Stunden, Sequenzen, Vorlagen, Balken, To-dos oder ein
  eingerichteter Schulkalender vorhanden, erscheint sie nicht.
- Weitere Funktionen erklären sich erst bei ihrer ersten Nutzung – höchstens ein Hinweis je
  Sitzung, und keiner zu einer Funktion, die schon benutzt wird.
- Der Zustand liegt lokal unter `appSettings.onboarding` (Fassung, Status, Pfad, erledigte
  Schritte, verstandene Hinweise, Checkliste). Ältere Datenbanken und Backups ohne dieses Feld
  bekommen beim Laden sinnvolle Standardwerte.
- Zwei Einstiege, zwei Checklisten: **Meine erste Stunde planen** (Lerngruppe, Stunde, Phase)
  und **Meine Unterrichtszeiten einrichten** (Vorlage, Standard, angewendet, erste Stunde –
  bei A/B stattdessen A-Woche, B-Woche, Rhythmus, Vorschau). Vorhandene Vorlagen werden erkannt;
  niemand wird zu einer Einrichtung gedrängt, die es schon gibt.
- Erneut starten: **Hilfe → Einführung erneut starten** oder **Einstellungen → Einführung**.
  Zurücksetzen ändert ausschliesslich diese Einstellung, nie Unterrichtsdaten.

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

## Beobachtung (Lernende)
- Ein eigener Bereich **Beobachtung** (Seitenleiste, Befehlspalette „Beobachtung öffnen“) für
  kurze, regelmässige Einschätzungen zu Lernenden – übernommen aus dem Ablauf von Capy-scope:
  eine **Runde** nach der Stunde schlägt Paare aus Lernenden und Fragen vor (selten
  Beobachtetes zuerst; Paare, die heute schon dran waren, erst, wenn alle anderen durch sind),
  jede Antwort wird sofort gespeichert.
- Der Start aus einer Stunde: **Heute → Beobachten** neben der Stunde oder **Beobachtungsrunde**
  in der Nachbereitung. Die Beobachtungen tragen dann Datum und Referenz der Stunde
  (`stundenRef`). Eine Notiz lässt sich als offener Punkt dieser Stunde vormerken – nur der
  Text, ohne Namen; das ist die einzige Stelle, an der etwas aus der Beobachtung in die
  Planung gelangt.
- Feste vierstufige Skala **ohne Mitte** (eher negativ · leicht negativ · leicht positiv ·
  eher positiv). Ein gemeinsamer Fragenpool mit acht mitgelieferten Fragen; dazu auf Wunsch
  Fragen, die nur für eine Lerngruppe gelten. Lerngruppe = Klasse und Fach wie in der Planung.
- Die Auswertung beschreibt und bewertet nicht: Anzahl, Abdeckung, Mittelwerte je Lernende und
  je Kategorie, Einzelverlauf (auch als PDF). Keine Ampelfarben, keine Sollwerte.
- **Ablage:** eigene Ablage, getrennt von der Planung – Desktop: Store-Datei
  `prepybara-beobachtung`; Browser: IndexedDB-Datenbank `prepybara-beobachtung`. Gelesen wird
  erst, wenn der Bereich oder die Einstellungen (für die Zahlen beim Zurücksetzen) geöffnet
  werden; geschrieben erst mit der ersten echten Änderung.
- **Was NICHT dorthin wandert, wohin die Planung wandert:** nicht ins Backup, nicht ins
  Pocket-Profil, nicht in Vorlagen, nicht in den Versionsverlauf, nicht in die Suche, nicht
  ins Schuljahresarchiv. Pocket bleibt frei von Schülerdaten.
- **Sicherung:** ausschliesslich verschlüsselt, als Datei `.prepybara-beobachtung`
  (AES-GCM, Schlüssel per PBKDF2-SHA-256 aus einem Passwort mit mindestens 8 Zeichen,
  WebCrypto, keine zusätzliche Abhängigkeit). Ohne Passwort ist die Datei nicht lesbar – es
  gibt keine Wiederherstellung. Beide Plattformadapter verweigern das Schreiben einer
  unverschlüsselten Datei. Einlesen führt zusammen, statt zu ersetzen; doppeltes Einlesen legt
  nichts doppelt an. Die Ablage auf dem Gerät selbst ist (noch) nicht verschlüsselt.
- **Capy-scope-Import:** der JSON-Export von Capy-scope (`classes`, `questions`,
  `observations`) wird mit Vorschau übernommen. Je Capy-Klasse wird eine Lerngruppe gewählt
  (mit Vorschlag); gleichnamige Lernende und gleichlautende Fragen werden zusammengeführt,
  vorhandene Beobachtungen nie überschrieben, ein zweiter Import ändert nichts. Die
  Capy-Einstellungen (Tageslimit, Skala) werden nicht übernommen.
- Version 1.1.0 der Desktop-App führt den Bereich ein.

## Reihen- und Lernfeldplanung (zweite Darstellung)
- Eine geöffnete Sequenz kennt **zwei Darstellungen** derselben Stunden. Die Wahl steht in der
  Sequenz (`sequences[id].progressionLayout`), gilt nur für sie und ändert **keine einzige
  Angabe** – sie entscheidet allein über Spalten und Export.
  - `sprachhandlung` – die bisherige Progression: Sprachhandlung/Aufgabe, Kompetenz,
    Sprechabsichten, sprachliche Mittel, Hilfen, Notiz.
  - `reihe` – die **Reihenübersicht**, wie Reihenpläne und Lernfeldplanungen geschrieben sind:
    **Datum (Anzahl der Minuten) · Stundenthema · Zentraler Kompetenzzuwachs · Funktion
    innerhalb der Progression**.
- Ohne Angabe (jede Sequenz aus einer früheren Fassung) entscheidet der Fremdsprachenmodus:
  mit ihm bleibt es beim bisherigen Verhalten, ohne ihn beginnt eine Sequenz mit der
  Reihenübersicht.
- Die Reihenübersicht ist zugleich eine **andere Art der Erfassung**: Stundenthema, zentraler
  Kompetenzzuwachs und Funktion sind Eingabefelder, eine ganze Reihe lässt sich in einem Zug
  durchschreiben. Geschrieben wird in dieselben Felder wie überall sonst – kein zweiter
  Datenbestand.
- Drei der vier Spalten stehen bereits in der Stunde: Datum und Minuten ergeben sich aus dem
  Stundenplanplatz und der Spanne (45 Minuten je Platz, 90 bei einer Doppelstunde), das
  Stundenthema ist `topic`, und die **Funktion innerhalb der Progression IST** die
  Progressionsnotiz (`progressionNote`) – dasselbe Feld, das die sprachliche Darstellung
  „Notiz" nennt.
- Neu ist allein der zentrale Kompetenzzuwachs (`competencyGain`), ein optionales Feld neben
  den bestehenden. Bleibt es leer, wird nichts erfunden: die Ansicht zeigt hilfsweise das
  Lernziel oder die Schwerpunktkompetenz und nennt die Herkunft. In das Eingabefeld wandert
  eine solche Anleihe nie.
- Alte Datenbanken und Backups ohne diese Felder funktionieren unverändert; eine Stunde ohne
  `competencyGain` und eine Sequenz ohne `progressionLayout` sind gültig wie bisher.
- Der Export (Word/PDF) folgt der gewählten Darstellung; die Verlaufspläne der einzelnen
  Stunden stehen wie bisher darunter.

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
  src/reihenuebersicht.js   zweite Darstellung einer Sequenz: Datum (Minuten), Thema,
                            Kompetenzzuwachs, Funktion in der Progression
  src/jahresbalken.js       optionale Verbindung von Jahresbalken und Sequenzen
  src/verschieben.js        Verschiebevorschläge: Ferien, Doppelstunden, Konflikte, Atomarität
  src/verschieben-dialog.jsx  Vorschau und Ausführung des Verschiebens
  src/suche.js              Suchindex, Normalisierung, Treffer, sichere Hervorhebung
  src/suche-ansicht.jsx     Suchansicht mit Filtern und Treffergruppen
  src/onboarding.js         Einführung: Zustand, leere Datenbank, Schritte, Hinweis-Registry
  src/onboarding-ansicht.jsx  Willkommensansicht, Coachmark, Checkliste
  src/stundenplan.js        Wochenvorlagen, Stundenplanmodelle, A-/B-Rhythmus, Anwenden
  src/stundenplan-ansicht.jsx  Verwaltung, Vorlageneditor, Assistent, Vorschau-Dialoge
  src/kontextmenue.js       wohin ein aufgeklapptes ⋯-Menü gehört (bleibt immer im Fenster)
  src/zuruecksetzen.js      alle Daten löschen: Umfang, Bestätigungswort, Freigabe
  src/beobachtung.js        Beobachtung: Datenmodell, Lernende, Fragen, Runde, Auswertung,
                            Zusammenführen
  src/beobachtung-speicher.js  deren Ablage (lädt erst bei Bedarf, schreibt der Reihe nach)
  src/beobachtung-sicherung.js verschlüsselte Sicherungsdatei (WebCrypto)
  src/capy-import.js        Übernahme aus Capy-scope: Prüfung, Vorschlag, Vorschau, Übernahme
  src/beobachtung-ansicht.jsx  Runde, Lernende, Fragen, Auswertung, Daten
electron/          Hauptprozess, Preload, Menü
pocket/            Prép-ybara Pocket (PWA)
  src/views/       mobile Ansichten
  vite.config.mjs  eigener Bau, eigener Service Worker
shared/            von beiden benutzt
  exchange/        Austauschformat, stabile Kennungen, Prüfung
  types/           Typbeschreibung des Formats (.d.ts)
  datum.js         Datumsrechnung
tests/             node:test – Format, Import, Pocket-Modell, Doppelstunden,
                   Versionsverlauf, Jahresbalken, Verschieben, Suche, Onboarding,
                   Stundenplanvorlagen, Reihenübersicht, Kontextmenü, Zurücksetzen,
                   Beobachtung, deren Ablage und Sicherung, Capy-scope-Import
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
