# Prép-ybara selbst bauen – Kurzanleitung für Lehramtsanwärterinnen und Lehramtsanwärter

Diese Anleitung erklärt Schritt für Schritt, wie Sie Prép-ybara auf Ihrem eigenen
Rechner starten oder als installierbares Programm bauen. Programmierkenntnisse
brauchen Sie dafür nicht.

## Links

| Was | Wo |
| --- | --- |
| Repository (Quelltext) | <https://github.com/florianchristophnowak-dot/prep-ybara> |
| Fertige Versionen (Releases) | <https://github.com/florianchristophnowak-dot/prep-ybara/releases> |
| Quelltext als ZIP herunterladen | <https://github.com/florianchristophnowak-dot/prep-ybara/archive/refs/heads/main.zip> |
| Adresse zum Klonen mit Git | `https://github.com/florianchristophnowak-dot/prep-ybara.git` |
| Pocket (Handy-App im Browser) | <https://florianchristophnowak-dot.github.io/prep-ybara/> |

> **Tipp:** Wenn Sie das Programm nur benutzen möchten, schauen Sie zuerst unter
> **Releases** nach. Dort liegt eventuell schon ein fertiger Installer, und Sie
> müssen gar nichts selbst bauen.

## 1. Einmalig vorbereiten

1. **Node.js installieren:** <https://nodejs.org> öffnen, die Version mit der
   Aufschrift **LTS** herunterladen und mit den vorgeschlagenen Einstellungen
   installieren.
2. **Quelltext holen** – eine der beiden Möglichkeiten:
   * **Ohne Git (einfach):** Die ZIP-Datei aus der Tabelle oben herunterladen und
     entpacken, z. B. nach `Dokumente\prep-ybara`.
   * **Mit Git:**
     ```
     git clone https://github.com/florianchristophnowak-dot/prep-ybara.git
     ```
3. **Eingabefenster im Projektordner öffnen:**
   * *Windows:* Den entpackten Ordner im Explorer öffnen (dort liegt die Datei
     `package.json`), mit gedrückter **Umschalttaste** rechts in eine freie Stelle
     klicken und **„PowerShell-Fenster hier öffnen“** bzw. **„Im Terminal öffnen“**
     wählen.
   * *Mac:* Im Finder mit Rechtsklick auf den Ordner **Dienste → Neues
     Terminal beim Ordner** wählen.
4. **Zubehör installieren** (dauert beim ersten Mal einige Minuten):
   ```
   npm install
   ```
   Meldet Windows, dass Skripte blockiert sind, zuerst diese Zeile eingeben und
   dann `npm install` wiederholen:
   ```
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

## 2. Programm starten (zum Ausprobieren)

```
npm run dev
```

Nach kurzer Zeit öffnet sich Prép-ybara in einem eigenen Fenster. Zum Beenden das
Fenster schließen und im Eingabefenster **Strg + C** drücken.

## 3. Installer bauen (zum dauerhaften Benutzen)

Am besten auf dem Betriebssystem bauen, auf dem das Programm später laufen soll.

| Ziel | Befehl |
| --- | --- |
| Windows-Installer **und** portable EXE | `npm run dist:win` |
| Nur portable EXE (ohne Installation, z. B. für den USB-Stick) | `npm run dist:portable` |
| Mac (DMG) | `npm run dist:mac` |

Das Ergebnis liegt danach im Unterordner **`release`** des Projektordners, z. B.
`Prepybara-1.1.0-win-x64.exe`. Diese Datei per Doppelklick installieren bzw.
starten.

*Hinweis:* Windows zeigt beim ersten Start eventuell „Der Computer wurde durch
Windows geschützt“. Das liegt daran, dass das Programm nicht kostenpflichtig
signiert ist. Über **Weitere Informationen → Trotzdem ausführen** lässt es sich
starten. Auf dem Mac genauso: Rechtsklick auf das Programm → **Öffnen**.

## 4. Neue Version holen

* Mit ZIP: Neue ZIP herunterladen, entpacken und ab Schritt 1.3 wiederholen.
* Mit Git: im Projektordner `git pull` eingeben, danach `npm install` und erneut
  bauen.

Ihre Planungsdaten bleiben beim Aktualisieren erhalten, denn sie liegen nicht im
Projektordner, sondern in Ihrem Benutzerprofil. Vorsichtshalber trotzdem vorher in
der App **Backup exportieren**.

## Wenn etwas nicht klappt

| Meldung | Lösung |
| --- | --- |
| `npm` wird nicht erkannt | Node.js ist nicht installiert oder das Eingabefenster war schon vorher offen. Node.js installieren, Fenster schließen und neu öffnen. |
| `package.json` nicht gefunden | Das Eingabefenster ist im falschen Ordner. Es muss der Ordner sein, in dem `package.json` liegt. |
| „Ausführung von Skripts ist deaktiviert“ | Die `Set-ExecutionPolicy`-Zeile aus Schritt 1.4 eingeben. |
| Sonstige Fehler | Den Ordner `node_modules` löschen und `npm install` erneut ausführen. |

Weitere technische Einzelheiten zur App stehen in der [README](README.md).
