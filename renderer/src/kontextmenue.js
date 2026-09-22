/* ============================================================
   Wohin ein aufgeklapptes Kontextmenü gehört

   Die Frage sieht klein aus, hat aber einen handfesten Anlass: In der
   Jahresgrobplanung sitzt der ⋯-Knopf eines Balkens in einem waagerecht
   rollenden Band (`overflow-x: auto`, `overflow-y: hidden`) und in einer
   48 px hohen Zeile. Ein Menü, das dort im Kasten liegt, wird
   abgeschnitten – bis hin zum letzten Eintrag "Löschen", der dadurch
   unerreichbar war. Mit CSS ist dagegen nichts auszurichten: Ein
   rollender Kasten MUSS seinen Inhalt beschneiden, sonst rollt er nicht
   mehr.

   Also wird die Lage gerechnet statt vererbt. Diese Datei enthält nur
   die Rechnung – kein React, kein DOM, keine Oberfläche. Dadurch ist
   sie prüfbar, und die Regel steht an genau einer Stelle:

     - Das Menü hängt unter dem Knopf.
     - Passt es dort nicht mehr ins Fenster, klappt es darüber.
     - Passt es auch dort nicht, bekommt es die grössere der beiden
       Seiten und eine eigene Höhe: dann rollt es in sich selbst.
     - Waagerecht richtet es sich an der gewünschten Kante des Knopfes
       aus und wird danach ins Fenster geschoben.

   Über den Fensterrand tritt es nie. Das ist die eigentliche Zusage:
   Ein Eintrag, den man nicht sieht, ist kein Eintrag.
   ============================================================ */

/* Mindestabstand zum Fensterrand. */
export const RAND = 8;

/* Luft zwischen Knopf und Menü. */
export const ABSTAND = 6;

/* Was angenommen wird, solange das Menü noch nicht gemessen wurde –
   siehe `min-width` von .kebabMenu. Die erste Messung ersetzt den Wert
   sofort; er verhindert nur, dass das Menü vorher am falschen Rand
   klebt. */
export const BREITE_SCHAETZUNG = 236;

const zahl = (v)=> (Number.isFinite(v) ? v : 0);

/* knopf:   { top, bottom, left, right } – wie von getBoundingClientRect
   menue:   { breite, hoehe } oder null, solange nicht gemessen
   ausrichtung: 'rechts' (Standard) oder 'links' – gemeint ist die Kante
                des Knopfes, an der das Menü ausgerichtet wird
   fenster: { breite, hoehe }

   Rückgabe: { links, oben, maxHoehe } in Fensterkoordinaten, also
   unmittelbar für `position: fixed` zu gebrauchen. */
export function menuePosition(knopf, menue, ausrichtung = 'rechts', fenster = {}){
  const k = {
    top: zahl(knopf?.top), bottom: zahl(knopf?.bottom),
    left: zahl(knopf?.left), right: zahl(knopf?.right),
  };
  const fensterBreite = zahl(fenster?.breite);
  const fensterHoehe = zahl(fenster?.hoehe);
  const breite = zahl(menue?.breite) || BREITE_SCHAETZUNG;
  const hoehe = zahl(menue?.hoehe);

  /* Waagerecht: an der gewünschten Kante ausrichten, dann ins Fenster
     schieben. Ist das Fenster schmaler als das Menü, gewinnt der linke
     Rand – dort beginnt der Text. */
  let links = (ausrichtung === 'links') ? k.left : (k.right - breite);
  links = Math.min(links, fensterBreite - breite - RAND);
  links = Math.max(RAND, links);

  const unten = k.bottom + ABSTAND;
  const platzUnten = Math.max(fensterHoehe - unten - RAND, 0);
  const platzOben = Math.max(k.top - ABSTAND - RAND, 0);

  // Der Normalfall: es passt nach unten (oder ist noch nicht gemessen).
  if (!hoehe || hoehe <= platzUnten) {
    return { links, oben: unten, maxHoehe: platzUnten, richtung: 'unten' };
  }
  // Nach oben geklappt.
  if (hoehe <= platzOben) {
    return { links, oben: k.top - ABSTAND - hoehe, maxHoehe: platzOben, richtung: 'oben' };
  }
  /* Weder noch: die grössere Seite bekommt es. Das Menü rollt dann in
     sich selbst – sichtbar bleibt es in jedem Fall. */
  return platzUnten >= platzOben
    ? { links, oben: unten, maxHoehe: platzUnten, richtung: 'unten' }
    : { links, oben: RAND, maxHoehe: platzOben, richtung: 'oben' };
}
