/* ============================================================
   Jahresbalken und Sequenzen: die optionale Verbindung

   Die Jahresgrobplanung war bisher bewusst ohne Wirkung: ein Balken ist
   eine farbige Fläche über Wochen, sonst nichts. Das bleibt so. Neu ist
   allein, dass ein Balken auf eine vorhandene Sequenz ZEIGEN darf.

   Gespeichert wird dafür nur `sequenceId` – die stabile Kennung. Nie
   eine Kopie der Sequenzdaten. Daraus folgt alles Übrige von selbst:

     - Wird die Sequenz umbenannt, steht am Balken sofort der neue Name.
     - Wird die Sequenz gelöscht, bleibt der Balken; er zeigt nur ins
       Leere und gilt damit wieder als unverknüpft.
     - Wird der Balken gelöscht, passiert mit der Sequenz nichts.
     - Ein Balken OHNE `sequenceId` – also jeder aus einer früheren
       Fassung – verhält sich exakt wie bisher.

   Und eine Regel, die keine Datenfrage ist, sondern eine
   Sicherheitsfrage: Das Verschieben eines Balkens verschiebt NIE von
   selbst Unterrichtsstunden. Wer die Termine mitnehmen will, geht durch
   die Vorschau des Verschiebens (verschieben.js). Diese Datei liefert
   dafür nur die Angaben.

   Alles hier ist rein und ohne Oberfläche – deshalb prüfbar.
   ============================================================ */

import { sequenceOccurrences } from './insights.js';
import { blockSpanOf } from './doppelstunde.js';

/* Die Kennung, auf die ein Balken zeigt – oder der leere Text. */
export function balkenSequenzId(bar){
  return String(bar?.sequenceId || '').trim();
}

/* Die Sequenz zu einem Balken.

   Zeigt der Balken auf eine Sequenz, die es nicht (mehr) gibt, ist das
   kein Fehlerfall: die Verknüpfung gilt dann schlicht als nicht
   vorhanden. So überlebt ein Balken das Löschen seiner Sequenz. */
export function balkenSequenz(bar, sequences){
  const id = balkenSequenzId(bar);
  if (!id) return null;
  const seq = sequences?.[id];
  return (seq && typeof seq === 'object') ? seq : null;
}

export function istVerknuepft(bar, sequences){
  return Boolean(balkenSequenz(bar, sequences));
}

/* Eine verwaiste Verknüpfung: der Balken zeigt auf eine gelöschte
   Sequenz. Die Oberfläche darf das sagen, ohne etwas zu ändern. */
export function istVerwaist(bar, sequences){
  return Boolean(balkenSequenzId(bar)) && !balkenSequenz(bar, sequences);
}

const text = (v)=> String(v || '').trim();
const gleich = (a, b)=> text(a).toLowerCase() === text(b).toLowerCase();

/* Passt eine Sequenz zu diesem Balken?

   Gemessen wird an den Stunden der Sequenz: welche Lerngruppe und
   welches Fach kommen darin vor. Eine Sequenz ohne Stunden passt zu
   allem – über sie ist noch nichts bekannt.

   Leere Angaben am Balken gelten als "egal". Das ist keine Nachlässigkeit:
   ein Balken darf ausdrücklich ohne Klasse und Fach angelegt werden. */
export function sequenzGruppen(db, sequenceId){
  const gruppen = new Map();
  for (const o of sequenceOccurrences(db, sequenceId)) {
    const g = text(o.lesson?.classGroup);
    const f = text(o.lesson?.subject);
    const key = `${g}||${f}`;
    if (!gruppen.has(key)) gruppen.set(key, { classGroup: g, subject: f, anzahl: 0 });
    gruppen.get(key).anzahl += 1;
  }
  return [...gruppen.values()].sort((a, b)=> b.anzahl - a.anzahl);
}

export function passtZuBalken(db, sequenceId, { classGroup, subject } = {}){
  const gruppen = sequenzGruppen(db, sequenceId);
  if (!gruppen.length) return true;
  const g = text(classGroup);
  const f = text(subject);
  if (!g && !f) return true;
  return gruppen.some(x => (!g || gleich(x.classGroup, g)) && (!f || gleich(x.subject, f)));
}

/* Die Auswahlliste für den Balkendialog.

   Passende Sequenzen zuerst, danach die übrigen – aber vollständig:
   eine Sequenz zu verstecken, weil sie (noch) keine Stunden in dieser
   Lerngruppe hat, wäre eine stille Bevormundung. Sichtbar bleibt
   dagegen, was passt und was nicht: `passt` steht an jedem Eintrag, und
   die Oberfläche kann davor warnen. */
export function auswahlSequenzen(db, { classGroup, subject } = {}){
  const sequences = db?.sequences || {};
  const liste = Object.values(sequences)
    .filter(s => s && s.id)
    .map(s => {
      const info = sequenzInfo(db, s.id);
      return {
        id: s.id,
        name: text(s.name) || 'Sequenz',
        color: text(s.color),
        passt: passtZuBalken(db, s.id, { classGroup, subject }),
        gruppen: info.gruppen,
        termine: info.termine,
        stunden: info.stunden,
        vonISO: info.vonISO,
        bisISO: info.bisISO,
      };
    });
  liste.sort((a, b)=> (Number(b.passt) - Number(a.passt)) || a.name.localeCompare(b.name, 'de'));
  return liste;
}

/* Was ein verknüpfter Balken über seine Sequenz zeigen kann.

   Alles daraus wird bei jeder Anzeige neu gerechnet – nichts davon
   liegt am Balken. Genau deshalb stimmt es immer, auch nachdem Stunden
   dazugekommen, verschoben oder gelöscht wurden. */
export function sequenzInfo(db, sequenceId){
  const id = String(sequenceId || '');
  const seq = db?.sequences?.[id] || null;
  const termine = sequenceOccurrences(db, id);
  const stunden = termine.reduce((a, t)=> a + blockSpanOf(t.lesson), 0);
  const daten = termine.map(t => t.dateISO).filter(Boolean).sort();
  const gruppen = sequenzGruppen(db, id);
  return {
    id,
    vorhanden: Boolean(seq),
    name: text(seq?.name) || '',
    color: text(seq?.color) || '',
    termine: termine.length,
    stunden,
    vonISO: daten[0] || '',
    bisISO: daten[daten.length - 1] || '',
    gruppen,
  };
}

/* Der Zeitraum, den die Sequenz tatsächlich einnimmt – als Wochen, weil
   die Jahresplanung in Wochen rechnet. Ohne Termine gibt es nichts zu
   übernehmen; dann bleibt der Balken, wie er ist. */
export function zeitraumAusSequenz(db, sequenceId, { aufWoche = (iso)=>iso } = {}){
  const info = sequenzInfo(db, sequenceId);
  if (!info.vonISO || !info.bisISO) return null;
  return { startISO: aufWoche(info.vonISO), endISO: aufWoche(info.bisISO) };
}

/* Eine Verknüpfung setzen oder lösen. Beides ändert AUSSCHLIESSLICH den
   Balken – die Sequenz wird nicht angefasst, ihre Stunden erst recht
   nicht. */
export function setzeVerknuepfung(yearBars, barId, sequenceId){
  const id = String(barId || '');
  const seq = String(sequenceId || '').trim();
  return (Array.isArray(yearBars) ? yearBars : []).map(b => (b?.id === id
    ? { ...b, sequenceId: seq, updatedAt: new Date().toISOString() }
    : b));
}

export function loeseVerknuepfung(yearBars, barId){
  return setzeVerknuepfung(yearBars, barId, '');
}

/* Eine gelöschte Sequenz aus allen Balken nehmen.

   Der Balken bleibt vollständig erhalten – Titel, Zeitraum, Farbe. Er
   ist danach ein gewöhnlicher Orientierungsbalken, so wie vor der
   Verknüpfung. */
export function entferneSequenzAusBalken(yearBars, sequenceId){
  const id = String(sequenceId || '').trim();
  if (!id) return Array.isArray(yearBars) ? yearBars : [];
  return (Array.isArray(yearBars) ? yearBars : [])
    .map(b => (balkenSequenzId(b) === id ? { ...b, sequenceId: '' } : b));
}

/* Alle Balken, die auf eine bestimmte Sequenz zeigen.

   Mehrere Balken dürfen dieselbe Sequenz referenzieren. Daraus darf
   nie eine mehrfache Verschiebung entstehen: wer Termine mitzieht,
   verschiebt die Sequenz EINMAL – die Balken werden anschliessend nur
   an den neuen Zeitraum angepasst, jeder für sich. */
export function balkenZuSequenz(yearBars, sequenceId){
  const id = String(sequenceId || '').trim();
  if (!id) return [];
  return (Array.isArray(yearBars) ? yearBars : []).filter(b => balkenSequenzId(b) === id);
}

/* Die Beschriftung eines verknüpften Balkens: Name der Sequenz und ihr
   Umfang. Kurz, weil sie in eine schmale Fläche muss. */
export function balkenBeschriftung(db, bar){
  const info = sequenzInfo(db, balkenSequenzId(bar));
  if (!info.vorhanden) return null;
  const teile = [`${info.termine} ${info.termine === 1 ? 'Termin' : 'Termine'}`];
  if (info.stunden !== info.termine) teile.push(`${info.stunden} Stunden`);
  return { name: info.name, umfang: teile.join(' · '), vonISO: info.vonISO, bisISO: info.bisISO };
}
