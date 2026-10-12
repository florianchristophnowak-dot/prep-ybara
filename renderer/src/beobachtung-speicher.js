/* ============================================================
   Ablage der Beobachtungen

   Zwischen der reinen Logik (beobachtung.js) und der Plattform
   (platform/*) liegt genau diese Schicht – nach dem Muster des
   Versionsverlaufs (verlauf-speicher.js). Sie tut vier Dinge:

     - Sie lädt die Beobachtungen ERST, wenn sie gebraucht werden. Wer
       den Bereich nie öffnet, zahlt beim Start der App nichts dafür.
     - Sie legt beim allerersten Zugriff die Startdaten an (mit den
       Standardfragen), schreibt sie aber erst mit der ersten echten
       Änderung auf die Platte. Wer nur hineinschaut, hinterlässt
       keine Datei.
     - Sie schreibt der Reihe nach. Zwei Antworten kurz hintereinander
       dürfen sich nicht gegenseitig überschreiben, und jede Änderung
       baut auf dem Stand der vorigen auf, nicht auf einem veralteten.
     - Sie normalisiert vor jedem Schreiben. In die Ablage gelangt nur
       die gültige Form, gleich was eine Oberfläche übergibt.

   Eine Regel geht über den Versionsverlauf hinaus: Liessen sich die
   gespeicherten Beobachtungen nicht lesen, wird auch nichts
   geschrieben. Der Verlauf darf im Zweifel neu anfangen – hier stünden
   die Einschätzungen eines Halbjahres auf dem Spiel, die vielleicht nur
   gerade nicht lesbar waren. Der nächste Zugriff versucht das Laden
   erneut. Einzig `leeren()` schreibt trotzdem: Es ist der ausdrückliche
   Weg, neu anzufangen.

   Fehler werden über `beiFehler` gemeldet, nicht geworfen. Die
   Aufrufe liefern immer einen gültigen Stand, damit eine Ansicht nicht
   an einer Ausnahme hängen bleibt.

   Den Zwischenstand im Speicher hat diese Schicht für sich. Hat jemand
   die Ablage an ihr vorbei geleert – "Alle Daten löschen" –, muss er
   ausdrücklich verworfen werden (`verwerfen()`). Sonst zeigte die
   Ansicht die gelöschten Namen weiter an, und die nächste Änderung
   schriebe sie samt allen Einschätzungen zurück auf die Platte.
   ============================================================ */

import {
  leereBeobachtungsdaten, startdaten, normalisiereBeobachtungsdaten,
} from './beobachtung.js';

export const NICHT_GELESEN = 'Die gespeicherten Beobachtungen liessen sich nicht lesen. Damit sie nicht überschrieben werden, wurde nichts gespeichert.';
export const NICHT_GESPEICHERT = 'Die Beobachtungen konnten nicht gespeichert werden.';

const istObjekt = (v)=> Boolean(v && typeof v === 'object' && !Array.isArray(v));

export function erstelleBeobachtungSpeicher(platform, {
  beiFehler = null,
  neueId,
  jetzt,
} = {}){
  /* Verfügbar ist die Ablage, wenn beide Wege da sind und die
     Plattform sie nicht ausdrücklich verneint (ältere Preload-Brücke). */
  const kannSpeichern = typeof platform?.loadBeobachtung === 'function'
    && typeof platform?.saveBeobachtung === 'function'
    && platform?.capabilities?.beobachtung !== false;

  let cache = null;              // null = noch nicht (erfolgreich) geladen
  let ladeLauf = null;
  let schreibKette = Promise.resolve();
  let generation = 0;            // zählt verwerfen(); Älteres gilt danach nicht mehr

  const melde = (err)=>{
    try { beiFehler?.(err); } catch {}
  };

  const start = ()=> startdaten({ neueId, jetzt });

  /* Liefert den geladenen Stand oder null, wenn das Lesen scheiterte.
     Gleichzeitige Aufrufe teilen sich einen Ladevorgang. */
  const ladeIntern = () => {
    if (cache) return Promise.resolve(cache);
    if (!kannSpeichern) {
      cache = start();
      return Promise.resolve(cache);
    }
    if (!ladeLauf) {
      const lauf = generation;
      ladeLauf = (async ()=>{
        try {
          const roh = await platform.loadBeobachtung();
          /* Hat inzwischen jemand geleert, gilt das – nicht der Stand,
             der vor dem Leeren gelesen wurde. Ebenso nach verwerfen():
             Was davor gelesen wurde, ist womöglich schon gelöscht. */
          if (!cache && lauf === generation) {
            cache = (roh === null || roh === undefined)
              ? start()                      // nie geschrieben: Startdaten, aber nur im Speicher
              : normalisiereBeobachtungsdaten(roh, { neueId });
          }
        } catch (err) {
          if (lauf === generation) melde(err);
        } finally {
          if (lauf === generation) ladeLauf = null;
        }
        // Wer auf einen verworfenen Ladevorgang wartet, bekommt den neu gelesenen Stand.
        return lauf === generation ? cache : ladeIntern();
      })();
    }
    return ladeLauf;
  };

  /* Geschrieben wird immer der ganze Stand, der Reihe nach. Ein
     gescheiterter Schreibvorgang reisst die Kette nicht ab: Der nächste
     schreibt wieder den vollständigen Stand und holt damit nach, was
     fehlte. */
  const schreiben = (naechster) => {
    cache = naechster;
    if (!kannSpeichern) return Promise.resolve();
    const lauf = generation;
    schreibKette = schreibKette
      .then(async ()=>{
        // Verworfen, bevor dieser Schreibvorgang an der Reihe war: nicht mehr schreiben.
        if (lauf !== generation) return;
        const res = await platform.saveBeobachtung(naechster);
        if (istObjekt(res) && res.ok === false) {
          throw new Error(res.error ? `${NICHT_GESPEICHERT} ${res.error}` : NICHT_GESPEICHERT);
        }
      })
      .catch((err)=> melde(err));
    return schreibKette;
  };

  return {
    verfuegbar: kannSpeichern,

    /* Der aktuelle Stand. Konnte er nicht gelesen werden, kommt die
       leere Form zurück – ohne Standardfragen, damit nicht der Eindruck
       entsteht, es sei alles in Ordnung und nur neu. */
    async laden(){
      return (await ladeIntern()) || leereBeobachtungsdaten();
    },

    /* Eine Änderung über eine reine Funktion aus beobachtung.js, etwa
       `d => erfasseBeobachtung(d, {...})`. Sie bekommt den neuesten
       Stand – auch wenn mehrere Änderungen gleichzeitig angestossen
       wurden – und muss synchron das Ergebnis liefern. Gibt sie
       denselben Stand zurück (ungültige Eingabe), wird nichts
       geschrieben. Rückgabe ist der neue Stand. */
    async aendern(fn){
      const geladen = await ladeIntern();
      // Ohne Stand – nicht lesbar oder eben verworfen – wird nichts geschrieben.
      if (!geladen || !cache) {
        melde(new Error(NICHT_GELESEN));
        return leereBeobachtungsdaten();
      }
      /* Ab hier synchron bis zum Schreiben: `cache` ist der neueste
         Stand, und keine andere Änderung kann sich dazwischenschieben. */
      const vorher = cache;
      let naechster;
      try { naechster = typeof fn === 'function' ? fn(vorher) : vorher; }
      catch (err) { melde(err); return vorher; }
      if (naechster === vorher || naechster === null || naechster === undefined) return vorher;
      if (!istObjekt(naechster) || typeof naechster.then === 'function') {
        /* Ein Promise oder eine Liste ist kein Stand. Normalisiert
           ergäbe das die leere Form – und damit den Verlust aller Daten. */
        melde(new TypeError('Eine Änderung der Beobachtungen muss synchron einen vollständigen Stand liefern.'));
        return vorher;
      }
      const normalisiert = normalisiereBeobachtungsdaten(naechster, { neueId });
      await schreiben(normalisiert);
      return normalisiert;
    },

    /* Den ganzen Stand ersetzen, etwa nach dem Zusammenführen mit einer
       Sicherung. Auch das erst, wenn der bisherige Stand gelesen werden
       konnte: Ersetzen auf Grundlage eines unlesbaren Stands hiesse,
       ihn zu verlieren. */
    async ersetzen(daten){
      const geladen = await ladeIntern();
      // Ohne Stand – nicht lesbar oder eben verworfen – wird nichts geschrieben.
      if (!geladen || !cache) {
        melde(new Error(NICHT_GELESEN));
        return leereBeobachtungsdaten();
      }
      if (!istObjekt(daten)) {
        melde(new TypeError('Zum Ersetzen braucht es einen vollständigen Stand der Beobachtungen.'));
        return cache;
      }
      const normalisiert = normalisiereBeobachtungsdaten(daten, { neueId });
      await schreiben(normalisiert);
      return normalisiert;
    },

    /* Alles verwerfen und bei den Startdaten neu beginnen. Schreibt
       sofort, auch wenn der bisherige Stand unlesbar war – das ist hier
       der Sinn. */
    async leeren(){
      const frisch = start();
      await schreiben(frisch);
      return frisch;
    },

    /* Nur für die Oberfläche: was gerade im Speicher liegt, ohne zu
       laden. Vor dem ersten Zugriff ist das null – die Ansicht lädt
       dann selbst. */
    zwischenstand(){
      return cache;
    },

    /* Den Zwischenstand vergessen, ohne etwas zu schreiben. Der nächste
       Zugriff liest wieder von der Platte. Für den Fall, dass die Ablage
       an diesem Speicher vorbei geleert wurde: Ein laufender Ladevorgang
       zählt dann nicht mehr, und Schreibvorgänge, die noch in der Kette
       warten, entfallen – sie trügen den alten Stand zurück. */
    verwerfen(){
      generation += 1;
      cache = null;
      ladeLauf = null;
    },
  };
}
