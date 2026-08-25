# Prép-ybara Pocket

> **Pocket erfasst – Prép-ybara organisiert.**

Mobile Begleit-App zu Prép-ybara: eine installierbare Web-App (PWA), mit der
einzelne Unterrichtsstunden unterwegs geplant und anschliessend als Datei in die
Desktop-App übernommen werden.

Alle Daten bleiben auf dem Gerät. Kein Konto, keine Cloud, keine Synchronisation,
keine KI, keine Statistik, keine externen Dienste. Der Austausch mit der
Desktop-App läuft ausschliesslich über Dateien (siehe Haupt-README).

---

## Lokal testen

```bash
npm install        # einmal im Projektordner, gilt für Desktop und Pocket
npm run dev:pocket # http://localhost:5174
```

Zum Ausprobieren auf dem eigenen Telefon: `npm run dev:pocket` starten und im
Handy-Browser die von Vite angezeigte Netzwerkadresse öffnen (gleiches WLAN).
Im Entwicklungsmodus gibt es **keinen** Service Worker – Offlinebetrieb und
Installation lassen sich dort nicht prüfen.

## Produktionsbuild testen

```bash
npm run build:pocket    # erzeugt dist/pocket
npm run preview:pocket  # http://localhost:5174
```

Erst hier entstehen Service Worker und Manifest; Installation und Offlinebetrieb
sind also nur mit diesem Build zu prüfen.

## Veröffentlichung über GitHub Pages

Der Arbeitsablauf `.github/workflows/pocket-pages.yml` baut Pocket bei jedem Push
auf `main` (und auf Knopfdruck über *Actions → Pocket auf GitHub Pages → Run
workflow*) und veröffentlicht **ausschliesslich** `dist/pocket`. Die Desktop-App
wird davon nicht berührt.

**Einmalig auf GitHub einzustellen:**

> Repository → **Settings → Pages → Source: GitHub Actions**

Danach ist Pocket erreichbar unter:

```
https://<benutzername>.github.io/<repository>/
```

### Unterpfad

GitHub Pages liefert Projektseiten unter `/<repository>/` aus. Der Arbeitsablauf
gibt diesen Pfad als `POCKET_BASE` an den Bau weiter; `pocket/vite.config.mjs`
setzt daraus `base`, `start_url`, `scope` und den Navigationsrückfall des Service
Workers. Ohne die Variable bleibt alles relativ – dadurch funktionieren
`dev:pocket` und `preview:pocket` unverändert.

Von Hand nachstellen lässt sich der Pages-Fall so:

```bash
POCKET_BASE=/prep-ybara/ npm run build:pocket
```

Der Repository-Name steht an keiner Stelle im Quelltext; ein umbenanntes oder
geforktes Repository funktioniert ohne Änderung.

## Installation auf Android

Chrome → Seite öffnen → **„Installieren“** bzw. **„Zum Startbildschirm
hinzufügen“**. Pocket bietet zusätzlich eine kleine Leiste mit dem Knopf
*Pocket installieren* an, sobald der Browser die Installation zulässt.

## Installation auf iPhone / iPad

Safari → **Teilen → Zum Home-Bildschirm → Als Web-App öffnen**.

Safari kennt keine automatische Installationsaufforderung; Pocket zeigt dort
stattdessen genau diesen Hinweis an. Wichtig: Der Weg funktioniert nur in Safari,
nicht in Chrome oder Firefox unter iOS.

## Offline-Test

1. Pocket online öffnen
2. einmal vollständig laden lassen
3. App schliessen
4. Flugmodus aktivieren
5. Pocket erneut über das App-Symbol starten

Die App muss starten und alle vorhandenen Entwürfe zeigen.

## Aktualisierung

Der Service Worker läuft mit `registerType: 'autoUpdate'`: Eine neue Fassung wird
im Hintergrund geladen und übernimmt sofort – sichtbar wird sie aber erst beim
Neuladen. Pocket sieht beim Start, stündlich und beim Zurückkehren in die App
nach und zeigt dann eine schmale Leiste:

> Eine neue Version von Prép-ybara Pocket ist verfügbar. **[Jetzt aktualisieren]
> [Später]**

Ein Neuladen mitten in der Planung wäre ein Übergriff – deshalb entscheidet die
Lehrkraft, wann es passiert. Spätestens beim nächsten Start ist die neue Fassung
ohnehin da. Entwürfe bleiben davon unberührt; sie liegen in der IndexedDB des
Browsers und werden von einer Aktualisierung nicht angefasst.

## Was das Deployment NICHT tut

- Es überträgt keine Unterrichtsdaten. Veröffentlicht wird nur der Programmcode.
- Es richtet keine Datenbank, kein Konto und keine Synchronisation ein.
- Es lädt zur Laufzeit nichts nach: Schrift, Symbole und Programmcode liegen im
  Bündel, es gibt keine CDN-Abhängigkeit.

Entwürfe, Ideen und das importierte Profil liegen ausschliesslich lokal im
Browser des jeweiligen Geräts. Wer die Browserdaten löscht oder ein anderes
Gerät benutzt, sieht sie dort nicht – der Weg dafür ist der Export in die
Desktop-App.
