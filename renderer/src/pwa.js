/* ============================================================
   Service Worker

   Nur im Browser. Die Desktop-App lädt denselben Renderer, dort liegt er
   aber unter file:// – da gibt es weder einen sicheren Kontext noch einen
   Sinn für einen Offline-Cache, die Dateien liegen ohnehin lokal.

   Aktualisierung bewusst als Nachfrage statt automatisch: Ein Neuladen
   mitten in der Stundenplanung wäre übergriffig. Die neue Fassung wird im
   Hintergrund geladen, angewandt wird sie erst auf Zuruf.
   ============================================================ */

import { platformName } from './platform/index.js';

export async function setupServiceWorker({ onUpdateAvailable, onOfflineReady } = {}){
  if (typeof window === 'undefined') return null;
  if (platformName !== 'browser') return null;       // Desktop
  if (!('serviceWorker' in navigator)) return null;  // z. B. privater Modus
  if (!window.isSecureContext) return null;          // file:// oder unverschlüsselt

  try {
    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh(){ onUpdateAvailable?.(()=> updateSW(true)); },
      onOfflineReady(){ onOfflineReady?.(); },
    });
    return updateSW;
  } catch {
    // Ohne Service Worker läuft die App weiter, nur eben nicht offline.
    return null;
  }
}
