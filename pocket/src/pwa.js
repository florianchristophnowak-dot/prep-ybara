/* ============================================================
   Service Worker, Aktualisierung und Installation

   Der Service Worker macht Pocket offlinefähig – die einzige
   Voraussetzung dafür, dass die App im Schulhaus überhaupt startet.
   Registriert wird erst nach dem Laden, damit der erste Bildschirm
   nicht darauf wartet.

   ZUR AKTUALISIERUNG, weil hier zwei Dinge leicht verwechselt werden:

   Der erzeugte Service Worker läuft mit "autoUpdate" – er übernimmt
   also sofort, sobald eine neue Fassung fertig geladen ist. Was er
   NICHT tut, ist die laufende Seite neu zu laden. Genau das ist die
   richtige Arbeitsteilung: Ein Neuladen mitten im Satz wäre ein
   Übergriff, auch wenn nichts verlorenginge.

   Deshalb meldet dieses Modul nur, DASS eine neue Fassung bereitliegt.
   Wann sie sichtbar wird, entscheidet die Lehrkraft mit einem Tipp auf
   "Jetzt aktualisieren" – oder beim nächsten Start von selbst.

   Nachgesehen wird zusätzlich stündlich und beim Zurückkehren in die
   App. Ohne das erführe ein Telefon, das tagelang im Hintergrund liegt,
   nie von einer neuen Fassung.

   Die Installationsaufforderung wird nicht selbst ausgelöst. Der
   Browser meldet, wenn er sie zulässt; Pocket bietet sie an ruhigen
   Stellen an. Ein Einblendfenster beim ersten Öffnen wäre genau die Art
   von Unterbrechung, die diese App vermeiden soll.
   ============================================================ */

const NACHSEHEN_MS = 60 * 60 * 1000;      // stündlich

/* ---- Wo die App liegt ------------------------------------------------
   Unter GitHub Pages ist das "/REPOSITORY/", lokal die Wurzel. Vite legt
   den Wert beim Bauen hier ab; daraus ergeben sich Pfad und Geltungs-
   bereich des Service Workers, ohne dass irgendwo ein Pfad fest steht. */
const BASIS = (import.meta.env?.BASE_URL || './');

/* ---- Aktualisierung -------------------------------------------------- */

let registrierung = null;
let updateBereit = false;
const updateZuhoerer = new Set();

function meldeUpdate(){
  if (updateBereit) return;
  updateBereit = true;
  for (const fn of updateZuhoerer) fn(true);
}

export function istUpdateBereit(){ return updateBereit; }

export function aufUpdate(fn){
  updateZuhoerer.add(fn);
  return ()=> updateZuhoerer.delete(fn);
}

/* Die neue Fassung ist bereits aktiv – es fehlt nur das Neuladen der
   Seite. Ein wartender Service Worker (falls doch einer ansteht) wird
   vorher angestossen. */
export function ladeNeueVersion(){
  try {
    const wartend = registrierung?.waiting;
    if (wartend) wartend.postMessage({ type: 'SKIP_WAITING' });
  } catch { /* nicht schlimm: das Neuladen genügt */ }
  try { window.location.reload(); } catch {}
}

export async function sucheNachUpdate(){
  try { await registrierung?.update(); } catch { /* offline: nichts zu tun */ }
}

function beobachteAktualisierung(reg, hatteController){
  /* Ein bereits wartender Worker: kommt vor, wenn die Seite zwischen
     zwei Sitzungen geladen wurde. */
  if (reg.waiting && hatteController) meldeUpdate();

  reg.addEventListener('updatefound', ()=>{
    const neuer = reg.installing;
    if (!neuer) return;
    neuer.addEventListener('statechange', ()=>{
      /* "installed" mit vorhandenem Controller heisst: es gab schon eine
         Fassung, diese hier ist neu. Mit skipWaiting folgt gleich
         "activated" – beides führt zur selben Meldung, gemeldet wird
         nur einmal. */
      if ((neuer.state === 'installed' || neuer.state === 'activated') && hatteController) {
        meldeUpdate();
      }
    });
  });

  /* Übernimmt ein neuer Worker die Kontrolle, ist die neue Fassung da.
     Beim allerersten Besuch passiert das ebenfalls (clientsClaim) –
     dann gab es aber keinen Vorgänger, und es ist kein Update. */
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if (hatteController) meldeUpdate();
  });
}

export function registriereServiceWorker(){
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Im Entwicklungsmodus gibt es keinen erzeugten Service Worker.
  if (import.meta.env?.DEV) return;

  const hatteController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', async ()=>{
    try {
      const reg = await navigator.serviceWorker.register(`${BASIS}sw.js`, { scope: BASIS });
      registrierung = reg;
      beobachteAktualisierung(reg, hatteController);

      setInterval(()=> sucheNachUpdate(), NACHSEHEN_MS);
      document.addEventListener('visibilitychange', ()=>{
        if (document.visibilityState === 'visible') sucheNachUpdate();
      });
    } catch {
      /* Ohne Service Worker läuft Pocket weiter – nur eben nicht offline.
         Ein Fehler hier darf die App nicht anhalten. */
    }
  });
}

/* ---- Installation ---------------------------------------------------- */

let installEreignis = null;
const zuhoerer = new Set();

export function beobachteInstallierbarkeit(){
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    installEreignis = e;
    for (const fn of zuhoerer) fn(true);
  });
  window.addEventListener('appinstalled', ()=>{
    installEreignis = null;
    for (const fn of zuhoerer) fn(false);
  });
}

export function istInstallierbar(){ return Boolean(installEreignis); }

export function aufInstallierbarkeit(fn){
  zuhoerer.add(fn);
  return ()=> zuhoerer.delete(fn);
}

export async function frageInstallation(){
  if (!installEreignis) return false;
  const ereignis = installEreignis;
  installEreignis = null;
  for (const fn of zuhoerer) fn(false);
  try {
    ereignis.prompt();
    const { outcome } = await ereignis.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/* Läuft Pocket bereits als installierte App? Entscheidet, ob der
   Hinweis "zum Startbildschirm hinzufügen" überhaupt sinnvoll ist. */
export function laeuftInstalliert(){
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/* iPhone und iPad kennen kein beforeinstallprompt – dort führt der Weg
   ausschliesslich über das Teilen-Menü von Safari. Deshalb braucht
   Pocket dort eine Anleitung statt eines Knopfes.

   iPadOS meldet sich seit Version 13 als "Macintosh"; erkennbar bleibt
   es an der Berührungseingabe. */
export function istApplePlattform(){
  try {
    const kennung = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(kennung)) return true;
    return /Macintosh/.test(kennung) && (navigator.maxTouchPoints || 0) > 1;
  } catch {
    return false;
  }
}

export const INSTALL_ANLEITUNG_APPLE = 'In Safari: Teilen → Zum Home-Bildschirm → Als Web-App öffnen';
