/* ============================================================
   Ablage des Versionsverlaufs

   Zwischen der reinen Logik (versionsverlauf.js) und der Plattform
   (platform/*) liegt genau diese Schicht. Sie tut drei Dinge:

     - Sie lädt den Verlauf ERST, wenn er gebraucht wird. Beim Start
       der App wird er nicht angefasst; wer nie eine Version anlegt und
       nie den Verlauf öffnet, zahlt dafür auch nichts.
     - Sie schreibt der Reihe nach. Zwei Sicherungspunkte kurz
       hintereinander dürfen sich nicht gegenseitig überschreiben.
     - Sie wendet vor jedem Schreiben die Aufbewahrungsregeln an. Der
       Verlauf wächst dadurch nicht über seine Grenzen hinaus, ohne dass
       irgendwo ein Aufräumlauf gestartet werden müsste.

   Die Unterrichtsdatenbank kommt hier nicht vor. Der Verlauf liegt in
   einer eigenen Ablage – ein Backup der Planung bleibt deshalb ein
   Backup der Planung.
   ============================================================ */

import { bereinige, fuegeEin } from './versionsverlauf.js';

export const VERLAUF_SCHEMA = 1;

function leer(){
  return { schema: VERLAUF_SCHEMA, eintraege: [] };
}

function normalisiere(roh){
  const d = (roh && typeof roh === 'object') ? roh : {};
  const eintraege = Array.isArray(d.eintraege) ? d.eintraege.filter(e => e && typeof e === 'object' && e.id) : [];
  return { schema: Number(d.schema) || VERLAUF_SCHEMA, eintraege };
}

export function erstelleVerlaufSpeicher(platform, {
  aufbewahrung = {},
  buendelMs,
  beiFehler = null,
} = {}){
  const kannSpeichern = typeof platform?.loadHistory === 'function' && typeof platform?.saveHistory === 'function';

  let cache = null;              // null = noch nicht geladen
  let ladeLauf = null;
  let schreibKette = Promise.resolve();

  const melde = (err)=>{
    try { beiFehler?.(err); } catch {}
  };

  const laden = async () => {
    if (!kannSpeichern) return leer();
    if (cache) return cache;
    if (!ladeLauf) {
      ladeLauf = (async ()=>{
        try {
          cache = normalisiere(await platform.loadHistory());
        } catch (err) {
          melde(err);
          cache = leer();
        }
        ladeLauf = null;
        return cache;
      })();
    }
    return ladeLauf;
  };

  /* Geschrieben wird immer der ganze Stand. Der Verlauf ist bewusst
     klein gehalten (siehe die Grenzen in versionsverlauf.js); ein
     Teilschreibverfahren wie bei den Wochen wäre hier Aufwand ohne
     Gegenwert. */
  const schreiben = (naechster) => {
    cache = naechster;
    schreibKette = schreibKette
      .then(()=> platform.saveHistory(naechster))
      .catch((err)=> melde(err));
    return schreibKette;
  };

  return {
    verfuegbar: kannSpeichern,

    async liste(){
      const d = await laden();
      return d.eintraege;
    },

    /* Einen Sicherungspunkt anlegen. Rückgabe ist der Eintrag, wie er
       in der Liste steht – oder null, wenn er mit einem vorhandenen
       gebündelt wurde und deshalb keinen eigenen Platz bekam. */
    async anhaengen(eintrag){
      if (!kannSpeichern || !eintrag) return null;
      const d = await laden();
      const vorher = d.eintraege.length;
      const mitNeuem = fuegeEin(d.eintraege, eintrag, buendelMs ? { buendelMs } : {});
      const gebuendelt = mitNeuem.length === vorher;
      const bereinigt = bereinige(mitNeuem, aufbewahrung);
      await schreiben({ schema: VERLAUF_SCHEMA, eintraege: bereinigt });
      return gebuendelt ? null : eintrag;
    },

    /* Mehrere Teile EINES Vorgangs. Sie tragen dieselbe
       Transaktionskennung und werden nie gebündelt – eine
       Sammelverschiebung bleibt ein Vorgang. */
    async anhaengenMehrere(eintraege){
      if (!kannSpeichern) return [];
      const arr = (Array.isArray(eintraege) ? eintraege : []).filter(Boolean);
      if (!arr.length) return [];
      const d = await laden();
      let liste = d.eintraege;
      for (const e of arr) liste = fuegeEin(liste, e, buendelMs ? { buendelMs } : {});
      await schreiben({ schema: VERLAUF_SCHEMA, eintraege: bereinige(liste, aufbewahrung) });
      return arr;
    },

    async leeren(){
      if (!kannSpeichern) return;
      await schreiben(leer());
    },

    /* Nur für die Oberfläche: was gerade im Speicher liegt, ohne zu
       laden. Vor dem ersten Zugriff ist das eine leere Liste – die
       Ansicht lädt dann selbst nach. */
    zwischenstand(){
      return cache ? cache.eintraege : null;
    },
  };
}
