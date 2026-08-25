/* ============================================================
   Service Worker und Installation

   Der Service Worker macht Pocket offlinefähig – die einzige
   Voraussetzung dafür, dass die App im Schulhaus überhaupt startet.
   Registriert wird erst nach dem Laden, damit der erste Bildschirm
   nicht darauf wartet.

   Die Installationsaufforderung wird nicht selbst ausgelöst. Der
   Browser meldet, wenn er sie zulässt; Pocket zeigt sie dann an einer
   ruhigen Stelle in den Einstellungen an. Ein Einblendfenster beim
   ersten Öffnen wäre genau die Art von Unterbrechung, die diese App
   vermeiden soll.
   ============================================================ */

let installEreignis = null;
const zuhoerer = new Set();

export function registriereServiceWorker(){
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Im Entwicklungsmodus gibt es keinen erzeugten Service Worker.
  if (import.meta.env?.DEV) return;
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(()=>{
      /* Ohne Service Worker läuft Pocket weiter – nur eben nicht offline.
         Ein Fehler hier darf die App nicht anhalten. */
    });
  });
}

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
