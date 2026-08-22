/* ============================================================
   Plattform-Adapter

   Kapselt alles, was von der Laufzeitumgebung abhängt. Der Renderer
   greift nicht mehr selbst auf window.api zu, sondern spricht diese
   Schnittstelle an und liest an `capabilities` ab, was verfügbar ist.

   Dadurch verschwinden die verstreuten window.api-Abfragen und die
   Meldungen nach dem Klick ("… ist nur in der Desktop-App verfügbar"):
   Die Oberfläche kann vorher entscheiden, ob sie etwas anbietet.

   Hinweis zur Dateiendung: Das Projekt ist durchgehend JavaScript ohne
   TypeScript-Aufbau. Die Module heissen deshalb .js statt .ts.
   ============================================================ */

import { createElectronPlatform } from './electron.js';
import { createWebPlatform } from './web.js';

/* Die Version braucht der Browser-Export für die Fusszeile, die der
   Desktop über footerTemplate setzt. */
import { APP_VERSION } from '../version.js';

function hasElectronBridge(){
  return typeof window !== 'undefined' && !!window.api;
}

/* Wie die Durchführungsansicht in ein Picture-in-Picture-Fenster kommt.
   Wird vom Renderer nachgereicht, damit dieses Modul nichts über React
   wissen muss. */
let mountExecution = null;
export function setExecutionMounter(fn){ mountExecution = fn; }

/* Zur Laufzeit anhand der Preload-Brücke auswählen. */
export const platform = hasElectronBridge()
  ? createElectronPlatform(window.api)
  : createWebPlatform({
      appVersion: APP_VERSION,
      mountExecution: (wurzel, fenster)=> mountExecution?.(wurzel, fenster),
    });

/* Was diese Umgebung kann. Die Oberfläche liest hier ab, statt zu raten. */
export const capabilities = platform.capabilities;

/* Kurzer Name für Hinweistexte, damit die Oberfläche nicht selbst prüfen muss. */
export const platformName = platform.name;

export default platform;
