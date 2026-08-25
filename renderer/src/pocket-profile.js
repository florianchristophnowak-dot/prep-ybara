/* ============================================================
   Pocket-Profil aus der Desktop-Datenbank

   Reine Ableitung: Diese Datei liest die vorhandene Datenbank und baut
   daraus das Profil, das Pocket einliest. Sie ändert nichts, speichert
   nichts und legt keine neuen Felder im Desktop an.

   Zwei Fragen bestimmen, was mitkommt:

   1. "Brauche ich das unterwegs, um nicht am PC noch einmal von vorne
      zu planen?" – Lerngruppen, Fächer, Stundenplan, Kompetenzen,
      Sprechabsichten, Sozialformen, Phasentypen, Hilfenvorlagen.

   2. "Wäre es schlimm, wenn das Handy verloren geht?" – Alles, worauf
      diese Frage mit Ja zu beantworten ist, bleibt hier. Es gibt keine
      Schülerdaten, keine Noten, keine Nachbereitung, keine To-dos und
      keine Kalendereinträge im Profil.

   Der Stundenplan reist als datierter Ausschnitt weniger Wochen. Das
   ist keine Sparmassnahme, sondern die Form, die der Desktop hergibt:
   er kennt konkrete Wochen, kein wiederkehrendes Raster. Ein Ausschnitt
   beantwortet genau die Frage, die Pocket stellt – "was habe ich heute
   und in den nächsten Tagen?".
   ============================================================ */

import {
  FORMAT_PROFILE, EXCHANGE_SCHEMA_VERSION, EXT_PROFILE,
  classIdFor, subjectIdFor, groupIdFor, groupLabel, normalisiereEtikett, vergleichsSchluessel,
} from '../../shared/exchange/index.js';
import { toISODate, fromISODate, addDays, startOfWeekMonday } from '../../shared/datum.js';
import { katalogNachBereichen, normalisiereModell } from './competencies.js';
import { SPRECHABSICHTEN, SCAFFOLD_VORSCHLAEGE, istSystemSprechabsicht } from './didaktik.js';

/* Wie weit der Stundenplan in die Zukunft reicht. Vier Wochen decken
   die Planung "für nächste Woche" ab und halten die Datei klein genug,
   um sie per Mail oder Kabel zu übertragen. */
export const STUNDENPLAN_WOCHEN = 4;

/* Phasentypen, die in jeder Planung vorkommen. Sie stehen auch dann zur
   Verfügung, wenn die Lehrkraft im Desktop noch nichts eigenes benutzt
   hat – sonst stünde Pocket beim ersten Profil ohne Vorschläge da. */
const PHASENTYPEN_GRUNDBESTAND = ['Einstieg', 'Erarbeitung', 'Sicherung', 'Übung', 'Abschluss'];

function nutzungsReihenfolge(ablage, versteckt){
  const hidden = (versteckt && typeof versteckt === 'object') ? versteckt : {};
  const eintraege = Object.entries((ablage && typeof ablage === 'object') ? ablage : {})
    .filter(([label]) => !hidden[label]);
  eintraege.sort((a, b)=>{
    const ac = a[1]?.count || 0, bc = b[1]?.count || 0;
    if (bc !== ac) return bc - ac;
    return String(b[1]?.lastUsed || '').localeCompare(String(a[1]?.lastUsed || ''));
  });
  return eintraege.map(([label]) => normalisiereEtikett(label)).filter(Boolean);
}

function eindeutigeEtiketten(...listen){
  const gesehen = new Set();
  const out = [];
  for (const liste of listen) {
    for (const roh of (liste || [])) {
      const label = normalisiereEtikett(roh);
      if (!label) continue;
      const key = vergleichsSchluessel(label);
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      out.push(label);
    }
  }
  return out;
}

/* Alle Stunden der Datenbank, flach und mit ihrem Termin. Eine einzige
   Schleife für Lerngruppen, Fächer und Stundenplan – die Wochen werden
   nicht dreimal durchlaufen. */
function alleStunden(db){
  const out = [];
  for (const [weekStart, woche] of Object.entries(db?.weeks || {})) {
    for (const [key, lesson] of Object.entries(woche?.lessons || {})) {
      const m = /^(\d+)-(\d+)$/.exec(key);
      if (!m || !lesson || typeof lesson !== 'object') continue;
      out.push({
        weekStart,
        dayIndex: Number(m[1]),
        slotIndex: Number(m[2]),
        lesson,
      });
    }
  }
  return out;
}

function hatInhalt(lesson){
  if (!lesson || typeof lesson !== 'object') return false;
  if (String(lesson.topic || '').trim()) return true;
  const phasen = Array.isArray(lesson.phases) ? lesson.phases : [];
  return phasen.some(p => String(p?.content || '').trim() || String(p?.title || '').trim());
}

/* ---- Das Profil ------------------------------------------------------ */

export function buildPocketProfile(db, {
  todayISO = toISODate(new Date()),
  wochen = STUNDENPLAN_WOCHEN,
  appVersion = '',
} = {}){
  const daten = (db && typeof db === 'object') ? db : {};
  const stunden = alleStunden(daten);

  /* --- Lerngruppen, Klassen, Fächer ---------------------------------
     Quelle ist beides: was tatsächlich im Stundenplan steht UND was in
     den Vorschlagsablagen liegt. So fehlt weder eine Lerngruppe, die
     gerade erst angelegt wurde, noch eine, die nur in einer weiter
     entfernten Woche unterrichtet wird. */
  const klassenAusStunden = stunden.map(s => s.lesson.classGroup);
  const faecherAusStunden = stunden.map(s => s.lesson.subject);

  const klassen = eindeutigeEtiketten(
    nutzungsReihenfolge(daten.classGroups, daten.hiddenSuggestions?.classGroups),
    klassenAusStunden,
  );
  const faecher = eindeutigeEtiketten(
    nutzungsReihenfolge(daten.subjects, daten.hiddenSuggestions?.subjects),
    faecherAusStunden,
  );

  /* Eine Lerngruppe ist das Paar Klasse + Fach. Vorkommen zählen,
     damit die häufigste zuerst steht – auf einem Telefonbildschirm
     entscheidet die Reihenfolge über die Zahl der Berührungen. */
  const gruppenZaehler = new Map();
  for (const { lesson } of stunden) {
    const className = normalisiereEtikett(lesson.classGroup);
    const subjectName = normalisiereEtikett(lesson.subject);
    if (!className && !subjectName) continue;
    const id = groupIdFor(className, subjectName);
    const bisher = gruppenZaehler.get(id);
    if (bisher) { bisher.count += 1; continue; }
    gruppenZaehler.set(id, { className, subjectName, count: 1 });
  }

  const farben = daten.groupColors || {};
  const groups = [...gruppenZaehler.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([id, g]) => {
      const farbe = farben[`${g.className}|${g.subjectName}`]?.color;
      return {
        id,
        className: g.className,
        subjectName: g.subjectName,
        classId: classIdFor(g.className),
        subjectId: subjectIdFor(g.subjectName),
        label: groupLabel(g.className, g.subjectName),
        ...(farbe ? { color: String(farbe) } : {}),
      };
    });

  /* --- Stundenplan ---------------------------------------------------
     Der Ausschnitt beginnt am Montag der laufenden Woche. Damit ist
     "heute" immer enthalten, auch wenn das Profil mitten in der Woche
     erzeugt wird. */
  const heute = fromISODate(todayISO);
  const start = startOfWeekMonday(Number.isNaN(heute.getTime()) ? new Date() : heute);
  const wochenAnfaenge = new Set();
  for (let i = 0; i < Math.max(1, wochen); i++) {
    wochenAnfaenge.add(toISODate(addDays(start, i * 7)));
  }

  const timetable = stunden
    .filter(s => wochenAnfaenge.has(s.weekStart))
    .map((s)=>{
      const className = normalisiereEtikett(s.lesson.classGroup);
      const subjectName = normalisiereEtikett(s.lesson.subject);
      if (!className && !subjectName) return null;
      const date = toISODate(addDays(fromISODate(s.weekStart), s.dayIndex));
      if (!date) return null;
      const zeiten = daten.schoolCalendar?.lessonTimesEnabled
        ? (daten.schoolCalendar?.lessonTimes || [])[s.slotIndex]
        : null;
      const startTime = String(zeiten?.start || zeiten?.startTime || '').trim();
      return {
        date,
        lessonNumber: s.slotIndex + 1,
        className,
        subjectName,
        classId: classIdFor(className),
        subjectId: subjectIdFor(subjectName),
        groupId: groupIdFor(className, subjectName),
        ...(startTime ? { startTime } : {}),
        ...(String(s.lesson.room || '').trim() ? { room: String(s.lesson.room).trim() } : {}),
        /* Ob im Desktop bereits etwas geplant ist. Pocket weist darauf
           hin, statt eine fertige Planung ein zweites Mal anzubieten. */
        ...(hatInhalt(s.lesson) ? { planned: true } : {}),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date === b.date ? a.lessonNumber - b.lessonNumber : a.date.localeCompare(b.date)));

  /* --- Kompetenzen ---------------------------------------------------
     Genau der Katalog, den der Desktop in der Auswahl zeigt: System-
     kompetenzen nach Bereichen plus alle je benutzten eigenen. Was dort
     ausgeblendet wurde, kommt auch hier nicht mit. */
  const modell = normalisiereModell(daten.competencyModel);
  const benutzte = nutzungsReihenfolge(daten.competencies, daten.hiddenSuggestions?.competencies)
    .filter(l => !modell.hidden?.[l]);
  const competencies = katalogNachBereichen({ modell, benutzte })
    .flatMap(bereich => bereich.kompetenzen.map(k => ({
      label: k.label,
      area: bereich.id,
      areaName: bereich.name,
      source: k.source,
    })));

  /* --- Sprechabsichten ----------------------------------------------- */
  const eigeneSprechabsichten = nutzungsReihenfolge(daten.speechActs, daten.hiddenSuggestions?.speechActs);
  const speechActs = eindeutigeEtiketten(SPRECHABSICHTEN, eigeneSprechabsichten)
    .filter(label => !(daten.hiddenSuggestions?.speechActs || {})[label])
    .map(label => ({ label, source: istSystemSprechabsicht(label) ? 'system' : 'custom' }));

  /* --- Sozialformen, Phasentypen, Hilfen ----------------------------- */
  const socialForms = nutzungsReihenfolge(daten.socialForms, daten.hiddenSuggestions?.socialForms);
  const phaseTypes = eindeutigeEtiketten(
    nutzungsReihenfolge(daten.phaseNames, daten.hiddenSuggestions?.phaseNames),
    PHASENTYPEN_GRUNDBESTAND,
  );
  const scaffoldTemplates = eindeutigeEtiketten(
    nutzungsReihenfolge(daten.scaffoldLabels, daten.hiddenSuggestions?.scaffoldLabels),
    SCAFFOLD_VORSCHLAEGE,
  ).map(label => ({ label, type: 'linguistic' }));

  const lessonTimes = daten.schoolCalendar?.lessonTimesEnabled
    ? (daten.schoolCalendar?.lessonTimes || [])
      .map((t)=>({ start: String(t?.start || t?.startTime || '').trim(), end: String(t?.end || t?.endTime || '').trim() }))
      .filter(t => t.start || t.end)
    : [];

  return {
    format: FORMAT_PROFILE,
    schemaVersion: EXCHANGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'Prép-ybara', ...(appVersion ? { version: String(appVersion) } : {}) },
    languageMode: Boolean(daten.appSettings?.languageMode),
    classes: klassen.map(name => ({ id: classIdFor(name), name })),
    subjects: faecher.map(name => ({ id: subjectIdFor(name), name })),
    groups,
    timetable,
    competencies,
    speechActs,
    socialForms,
    phaseTypes,
    scaffoldTemplates,
    lessonTimes,
  };
}

export function pocketProfilDateiname(datum = new Date()){
  return `Prepybara-Pocket-Profil-${toISODate(datum)}${EXT_PROFILE}`;
}
