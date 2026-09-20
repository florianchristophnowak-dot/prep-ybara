/* ============================================================
   Reihenübersicht – die zweite Darstellung einer Sequenz

   Eine Unterrichtsreihe lässt sich auf zwei Weisen beschreiben, und
   beide sind fachlich richtig:

     1. Über das sprachliche Handeln – so arbeitet die bisherige
        Progressionsansicht: Sprachhandlung, Kompetenz, Sprechabsichten,
        sprachliche Mittel, Hilfen. Das ist die Sicht des
        Fremdsprachenunterrichts.

     2. Über den Aufbau der Reihe selbst – so sind Lernfeldplanungen und
        die Reihenpläne im Vorbereitungsdienst geschrieben:

            Datum (Anzahl der Minuten)
            Stundenthema
            Zentraler Kompetenzzuwachs
            Funktion innerhalb der Progression

   Diese Datei beschreibt die zweite Darstellung. Sie ist eine
   ALTERNATIVE, kein Ersatz: welche gilt, entscheidet die Sequenz, und
   jede Sequenz entscheidet für sich. Eine Sequenz ohne Entscheidung
   verhält sich exakt wie bisher.

   ZWEI ENTSCHEIDUNGEN, die den Rest tragen:

   1. Drei der vier Spalten stehen schon in der Stunde. Datum und
      Minuten ergeben sich aus dem Stundenplanplatz und der Spanne
      (Einzel-/Doppelstunde), das Stundenthema ist `topic`, und die
      Funktion innerhalb der Progression IST die Progressionsnotiz –
      dasselbe Feld, das die sprachliche Darstellung „Notiz" nennt.
      Beide Darstellungen lesen und schreiben denselben Satz; wer die
      Darstellung wechselt, verliert nichts.

   2. Nur der zentrale Kompetenzzuwachs ist neu (`competencyGain`) –
      ein optionales Feld neben den bestehenden. Bleibt es leer, wird
      nichts erfunden: die Ansicht zeigt hilfsweise das Lernziel oder
      die Schwerpunktkompetenz und sagt dazu, woher die Angabe kommt.

   Bewertet wird auch hier nichts. Die App legt die eigenen Angaben
   nebeneinander; ob die Reihe trägt, entscheidet die Lehrkraft.
   ============================================================ */

import { SLOT_MIN, blockSpanOf, lessonTotalMin } from './doppelstunde.js';
import { formatDatum } from '../../shared/datum.js';

function text(x){ return String(x ?? '').trim(); }

/* ---- Die beiden Darstellungen ---------------------------------------- */

export const DARSTELLUNG_SPRACHLICH = 'sprachhandlung';
export const DARSTELLUNG_REIHE = 'reihe';

export const DARSTELLUNGEN = [
  {
    id: DARSTELLUNG_SPRACHLICH,
    name: 'Sprachliche Progression',
    spalten: 'Sprachhandlung · Kompetenz · Sprechabsichten · Sprachliche Mittel · Hilfen',
  },
  {
    id: DARSTELLUNG_REIHE,
    name: 'Reihenübersicht',
    spalten: 'Datum (Minuten) · Stundenthema · Zentraler Kompetenzzuwachs · Funktion innerhalb der Progression',
  },
];

const DARSTELLUNG_IDS = new Set(DARSTELLUNGEN.map(d => d.id));

export function darstellungName(id){
  return DARSTELLUNGEN.find(d => d.id === id)?.name || '';
}

/* Eine unbekannte Angabe ist keine Angabe – nie ein Fehler. */
export function normalisiereDarstellung(raw){
  const id = text(raw);
  return DARSTELLUNG_IDS.has(id) ? id : '';
}

/* Welche Darstellung gilt für diese Sequenz?

   Hat die Lehrkraft gewählt, gilt ihre Wahl – für immer und nur für
   diese Sequenz. Hat sie nicht gewählt (jede Sequenz aus einer früheren
   Fassung), entscheidet der Fremdsprachenmodus: mit ihm bleibt es bei
   der sprachlichen Progression, also genau beim bisherigen Verhalten;
   ohne ihn ist die Reihenübersicht die nähere Darstellung. */
export function darstellungDerSequenz(sequenz, { languageMode = true } = {}){
  const gewaehlt = normalisiereDarstellung(sequenz?.progressionLayout);
  if (gewaehlt) return gewaehlt;
  return languageMode ? DARSTELLUNG_SPRACHLICH : DARSTELLUNG_REIHE;
}

/* ---- Datum und Minuten ------------------------------------------------
   Die Minuten sind der Zeitrahmen der Stunde: 45 je belegtem
   Stundenplatz. Eine Doppelstunde ist eine Stunde über 90 Minuten – nie
   zwei halbe. */

export function minutenDerStunde(lesson){
  return lessonTotalMin(lesson);
}

export function minutenLabel(minuten){
  const m = Math.max(0, Math.round(Number(minuten) || 0));
  return `${m} Min.`;
}

/* „Fr, 12.09.2026 (90 Min.)" – die erste Spalte in einer Zeile. Ohne
   Datum bleiben die Minuten allein stehen. */
export function datumLabel(dateISO, minuten){
  const datum = formatDatum(dateISO);
  const zeit = minutenLabel(minuten);
  return datum ? `${datum} (${zeit})` : zeit;
}

/* ---- Zentraler Kompetenzzuwachs ---------------------------------------
   Das einzige neue Feld. Es bleibt leer, bis jemand hineinschreibt –
   und solange es leer ist, tritt hilfsweise etwas an seine Stelle, das
   ohnehin in der Stunde steht. Die Herkunft wird immer mitgeliefert,
   damit die Ansicht sie kenntlich machen kann: eine geliehene Angabe
   darf nicht wie eine getroffene Aussage aussehen. */

export const ZUWACHS_QUELLEN = [
  { id: 'eigen',     name: '' },
  { id: 'lernziel',  name: 'aus dem Lernziel' },
  { id: 'kompetenz', name: 'aus der Schwerpunktkompetenz' },
];

export function zuwachsQuelleName(id){
  return ZUWACHS_QUELLEN.find(q => q.id === id)?.name || '';
}

/* Aus einem mehrzeiligen Lernziel wird die erste ausgefüllte Zeile.
   Mehr gehört nicht in eine Tabellenzelle, und mehr wäre auch nicht
   ehrlich: es ist eine Anleihe, keine Aussage über die Reihe. */
function ersteZeile(raw){
  return String(raw ?? '')
    .split(/\r?\n/)
    .map(z => z.trim())
    .find(Boolean) || '';
}

export function kompetenzzuwachs(lesson){
  const eigen = text(lesson?.competencyGain);
  if (eigen) return { text: eigen, quelle: 'eigen' };

  const lernziel = ersteZeile(lesson?.objectives);
  if (lernziel) return { text: lernziel, quelle: 'lernziel' };

  const liste = Array.isArray(lesson?.competencies)
    ? lesson.competencies.map(text).filter(Boolean)
    : [];
  const kompetenz = text(lesson?.primaryCompetency) || liste[0] || '';
  if (kompetenz) return { text: kompetenz, quelle: 'kompetenz' };

  return { text: '', quelle: '' };
}

/* ---- Die Zeilen der Reihenübersicht -----------------------------------
   `stunden` sind die Vorkommen der Sequenz in zeitlicher Reihenfolge,
   wie sie sequenceOccurrences() liefert – dieselbe Eingabe wie bei der
   sprachlichen Progression. */
export function reihenZeilen(stunden){
  return (Array.isArray(stunden) ? stunden : []).map((o, i)=>{
    const l = o?.lesson || {};
    const minuten = minutenDerStunde(l);
    const dateISO = text(o?.dateISO);
    return {
      key: `${o?.weekStart}#${o?.dayIndex}-${o?.slotIndex}`,
      nummer: i + 1,
      weekStart: o?.weekStart,
      dayIndex: o?.dayIndex,
      slotIndex: o?.slotIndex,
      dateISO,
      datum: formatDatum(dateISO),
      minuten,
      spanne: blockSpanOf(l),
      thema: text(l.topic),
      /* Der angezeigte Zuwachs – eigener Text oder geliehene Angabe … */
      zuwachs: kompetenzzuwachs(l),
      /* … und daneben das, was wirklich im Feld steht. Nur dieser Wert
         gehört in ein Eingabefeld: eine Anleihe dort anzuzeigen hiesse,
         sie beim nächsten Speichern zur eigenen Aussage zu machen. */
      eigenerZuwachs: text(l.competencyGain),
      funktion: text(l.progressionNote),
      klasse: text(l.classGroup),
      fach: text(l.subject),
    };
  });
}

/* ---- Umfang der Reihe -------------------------------------------------
   Für eine Lernfeldplanung ist der Umfang die entscheidende Zahl: wie
   viele Termine, wie viele Unterrichtsstunden, wie viele Minuten. Alles
   drei wird gezählt, nichts davon mit einem Soll verglichen. */
export function reihenSumme(zeilen){
  const list = Array.isArray(zeilen) ? zeilen : [];
  let minuten = 0;
  let unterrichtsstunden = 0;
  for (const z of list){
    minuten += Math.max(0, Math.round(Number(z?.minuten) || 0));
    unterrichtsstunden += Math.max(1, Math.round(Number(z?.spanne) || 1));
  }
  return { termine: list.length, unterrichtsstunden, minuten };
}

export function reihenSummeLabel(summe){
  const s = (summe && typeof summe === 'object') ? summe : { termine: 0, unterrichtsstunden: 0, minuten: 0 };
  const termine = Math.max(0, Math.round(Number(s.termine) || 0));
  const stunden = Math.max(0, Math.round(Number(s.unterrichtsstunden) || 0));
  const minuten = Math.max(0, Math.round(Number(s.minuten) || 0));
  const teile = [`${termine} ${termine === 1 ? 'Termin' : 'Termine'}`];
  /* Ohne Doppelstunden sind Termine und Unterrichtsstunden dieselbe
     Zahl – zweimal dasselbe zu schreiben hilft niemandem. */
  if (stunden !== termine) {
    teile.push(`${stunden} ${stunden === 1 ? 'Unterrichtsstunde' : 'Unterrichtsstunden'}`);
  }
  teile.push(`${minuten} Minuten`);
  return teile.join(' · ');
}

/* Wie viele Unterrichtsstunden stecken in einer Minutenzahl? Nur für
   Anzeigen, die aus Minuten zurückrechnen müssen. */
export function alsUnterrichtsstunden(minuten){
  const m = Math.max(0, Math.round(Number(minuten) || 0));
  return Math.round(m / SLOT_MIN);
}
