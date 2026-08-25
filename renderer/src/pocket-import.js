/* ============================================================
   Pocket-Import: von der Austauschdatei zur Desktop-Stunde

   Diese Datei enthält den gesamten Verstand des Imports und keine
   Oberfläche. Sie beantwortet drei Fragen, bevor irgendetwas
   geschrieben wird:

     1. Wohin gehört diese Stunde?     (Lerngruppe, Fach, Termin)
     2. Was steht dort schon?          (Konflikt, Doppelimport)
     3. Was ist daran neu?             (unbekannte Kompetenzen usw.)

   Erst danach entscheidet die Lehrkraft, und erst dann schreibt
   fuehrePocketImportAus().

   DREI REGELN, die sich aus dem Auftrag ergeben und hier durchgehalten
   werden:

   - Es wird NIE ungefragt überschrieben. Der Konflikt wird gemeldet,
     nicht gelöst.
   - Phasen und Stunden bekommen beim Import NEUE Desktop-Kennungen.
     Die Kennung aus Pocket wandert getrennt in lesson.pocket, damit ein
     zweiter Import derselben Datei erkennbar bleibt und trotzdem keine
     Kollision entsteht.
   - Unbekannte Kompetenzen und Sprechabsichten landen NICHT von selbst
     in der Bibliothek. Sie stehen in der Stunde – aufgenommen wird nur,
     was ausdrücklich bestätigt wurde.

   Die Werkzeuge (uid, defaultLesson, normalizeLesson) werden
   hereingereicht statt importiert: sie liegen in app.jsx, und app.jsx
   ist wegen JSX und Bild-Importen nicht ohne Bündler ladbar. So bleibt
   dieses Modul prüfbar, ohne dass die Desktop-App umgebaut werden muss.
   ============================================================ */

import {
  normalisiereStunde, gesamtdauer, anzeigeName, normalisiereEtikett, vergleichsSchluessel,
  classIdFor, subjectIdFor,
} from '../../shared/exchange/index.js';
import { wochenPosition, toISODate } from '../../shared/datum.js';
import { istSystemKompetenz } from './competencies.js';
import { istSystemSprechabsicht } from './didaktik.js';

export const MODI = {
  NEU: 'neu',              // an einen freien Platz, bestehende Planung bleibt
  ANHAENGEN: 'anhaengen',  // Pocket-Phasen an die bestehende Stunde hängen
  ERSETZEN: 'ersetzen',    // bestehende Planung durch die Pocket-Planung ersetzen
};

const STANDARD_SLOTS = 6;

/* ---- Bestand der Desktop-Datenbank ----------------------------------- */

function etikettenAusStunden(db, feld){
  const out = [];
  for (const woche of Object.values(db?.weeks || {})) {
    for (const lesson of Object.values(woche?.lessons || {})) {
      const l = normalisiereEtikett(lesson?.[feld]);
      if (l) out.push(l);
    }
  }
  return out;
}

function bekannteEtiketten(db, ablage, feld){
  const gesehen = new Set();
  const out = [];
  for (const label of [...Object.keys(db?.[ablage] || {}), ...etikettenAusStunden(db, feld)]) {
    const l = normalisiereEtikett(label);
    if (!l) continue;
    const key = vergleichsSchluessel(l);
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(l);
  }
  return out;
}

/* Zuordnung über die stabile Kennung, ersatzweise über den Namen.

   Die Kennung ist aus dem Namen abgeleitet (siehe shared/exchange/ids.js).
   Wurde die Lerngruppe im Desktop seit dem Profil-Export umbenannt,
   trifft sie nicht mehr – dann rettet der mitgereiste Name die
   Zuordnung. Trifft auch der nicht, wird NICHT geraten: die Oberfläche
   fragt nach. */
function findeEtikett(kandidaten, { id, name, kennung }){
  const gesuchteId = String(id || '').trim();
  if (gesuchteId) {
    const treffer = kandidaten.find(l => kennung(l) === gesuchteId);
    if (treffer) return { label: treffer, treffer: 'id' };
  }
  const gesuchterName = vergleichsSchluessel(name);
  if (gesuchterName) {
    const treffer = kandidaten.find(l => vergleichsSchluessel(l) === gesuchterName);
    if (treffer) return { label: treffer, treffer: 'name' };
    // Der Name ist im Desktop unbekannt – er wird trotzdem übernommen.
    // Eine neue Lerngruppe anzulegen ist harmlos; sie entsteht im
    // Desktop ohnehin durch blosses Eintippen.
    return { label: normalisiereEtikett(name), treffer: 'neu' };
  }
  return { label: '', treffer: 'keine' };
}

function stundeAn(db, weekStart, dayIndex, slotIndex){
  return db?.weeks?.[weekStart]?.lessons?.[`${dayIndex}-${slotIndex}`] || null;
}

export function hatPlanungsinhalt(lesson){
  if (!lesson || typeof lesson !== 'object') return false;
  if (String(lesson.topic || '').trim()) return true;
  if (String(lesson.objectives || '').trim()) return true;
  if (String(lesson.notes || '').trim()) return true;
  if ((lesson.competencies || []).length) return true;
  const phasen = Array.isArray(lesson.phases) ? lesson.phases : [];
  return phasen.some(p => String(p?.content || '').trim() || String(p?.materialsMedia || '').trim());
}

/* Der nächste freie Platz am selben Tag. Wird gebraucht, wenn die
   Lehrkraft "als neue Stunde importieren" wählt: die vorhandene
   Planung bleibt unangetastet, die Pocket-Planung bekommt einen
   eigenen Platz. Ist der Tag voll, wird die Stundenzahl des Tages
   NICHT eigenmächtig erhöht – dann meldet die Funktion null und die
   Oberfläche bietet die manuelle Zuordnung an. */
export function naechsterFreierSlot(db, weekStart, dayIndex, { ab = 0 } = {}){
  const woche = db?.weeks?.[weekStart];
  const slots = Math.max(1, Number(woche?.slotsPerDay) || STANDARD_SLOTS);
  for (let i = Math.max(0, ab); i < slots; i++) {
    if (!stundeAn(db, weekStart, dayIndex, i)) return i;
  }
  return null;
}

/* Ein Termin aus Datum und Stundennummer. Dieselbe Rechnung wie in der
   Analyse – hier für die Fälle, in denen die Lehrkraft den Termin von
   Hand ändert. */
export function zielFuer(dateISO, lessonNumber){
  const pos = wochenPosition(dateISO);
  const nummer = Number(lessonNumber);
  if (!pos || !Number.isFinite(nummer) || nummer < 1) return null;
  return {
    dateISO,
    weekStart: pos.weekStart,
    dayIndex: pos.dayIndex,
    slotIndex: Math.round(nummer) - 1,
    lessonNumber: Math.round(nummer),
  };
}

/* Was am gewählten Termin bereits steht. Getrennt von der Analyse, weil
   sich der Termin ändern kann, ohne dass sich an der Datei etwas ändert. */
export function pruefeZiel(db, ziel){
  if (!ziel) return { bestehende: null, konflikt: false, belegt: false };
  const bestehende = stundeAn(db, ziel.weekStart, ziel.dayIndex, ziel.slotIndex);
  return {
    bestehende,
    belegt: Boolean(bestehende),
    konflikt: Boolean(bestehende && hatPlanungsinhalt(bestehende)),
  };
}

/* ---- Analyse --------------------------------------------------------- */

export function analysierePocketStunde(roh, db, { todayISO = toISODate(new Date()) } = {}){
  const stunde = normalisiereStunde(roh);

  const klassen = bekannteEtiketten(db, 'classGroups', 'classGroup');
  const faecher = bekannteEtiketten(db, 'subjects', 'subject');

  const klasse = findeEtikett(klassen, {
    id: stunde.classId, name: stunde.className, kennung: classIdFor,
  });
  const fach = findeEtikett(faecher, {
    id: stunde.subjectId, name: stunde.subjectName, kennung: subjectIdFor,
  });

  /* Termin. Ohne Datum oder ohne Stundennummer gibt es keinen
     automatischen Platz – das ist kein Fehler, sondern der Normalfall
     bei einer Unterrichtsidee. */
  let ziel = null;
  const pos = stunde.date ? wochenPosition(stunde.date) : null;
  if (pos && stunde.lessonNumber) {
    ziel = {
      dateISO: stunde.date,
      weekStart: pos.weekStart,
      dayIndex: pos.dayIndex,
      slotIndex: stunde.lessonNumber - 1,
      lessonNumber: stunde.lessonNumber,
    };
  } else if (pos) {
    const frei = naechsterFreierSlot(db, pos.weekStart, pos.dayIndex);
    if (frei !== null) {
      ziel = {
        dateISO: stunde.date,
        weekStart: pos.weekStart,
        dayIndex: pos.dayIndex,
        slotIndex: frei,
        lessonNumber: frei + 1,
        geraten: true,
      };
    }
  }

  const bestehende = ziel ? stundeAn(db, ziel.weekStart, ziel.dayIndex, ziel.slotIndex) : null;

  /* Unbekannte Etiketten. "Unbekannt" heisst: weder Systemeintrag noch
     je im Desktop benutzt. Genau danach wird gefragt. */
  const bekannteKompetenzen = new Set(Object.keys(db?.competencies || {}).map(vergleichsSchluessel));
  const bekannteSprechabsichten = new Set(Object.keys(db?.speechActs || {}).map(vergleichsSchluessel));

  const neueKompetenzen = (stunde.competencies || [])
    .map(k => k.label)
    .filter(label => !istSystemKompetenz(label) && !bekannteKompetenzen.has(vergleichsSchluessel(label)));
  const neueSprechabsichten = (stunde.speechActs || [])
    .map(s => s.label)
    .filter(label => !istSystemSprechabsicht(label) && !bekannteSprechabsichten.has(vergleichsSchluessel(label)));

  const bereitsImportiert = db?.pocketImports?.[stunde.externalId] || null;

  return {
    stunde,
    titel: anzeigeName(stunde),
    klasse,
    fach,
    gruppenName: [klasse.label, fach.label].filter(Boolean).join(' '),
    ziel,
    zielGefunden: Boolean(ziel),
    bestehendeStunde: bestehende,
    konflikt: Boolean(bestehende && hatPlanungsinhalt(bestehende)),
    bereitsImportiert,
    neueKompetenzen,
    neueSprechabsichten,
    statistik: {
      phasen: (stunde.phases || []).length,
      minuten: gesamtdauer(stunde),
      lernziele: (stunde.learningGoals || []).length,
      kompetenzen: (stunde.competencies || []).length,
      sprechabsichten: (stunde.speechActs || []).length,
      erfolgskriterien: (stunde.successCriteria || []).length,
    },
    heuteISO: todayISO,
  };
}

/* ---- Abbildung auf die Desktop-Stunde -------------------------------- */

/* Materialnotiz und Verweis stehen im Desktop in EINEM Feld
   ("Materialien & Medien"). Sie werden mit Zeilenumbruch verbunden –
   das Feld führt ein kleines HTML und stellt reinen Text mit
   Zeilenumbrüchen korrekt dar. */
function materialText(phase){
  return [phase.material, phase.materialLink].filter(Boolean).join('\n');
}

/* Aus den Phasen der Austauschdatei werden Desktop-Phasen. Die
   Kennungen kommen frisch von uid() – die Kennung aus Pocket wird
   bewusst NICHT übernommen (Regel 2 oben). */
export function pocketPhasen(stunde, uid){
  return (stunde.phases || []).map((p)=>({
    id: uid(),
    title: p.title || '',
    duration: Math.max(1, Number(p.duration) || 5),
    socialForm: p.socialForm || '',
    content: p.content || '',
    materialsMedia: materialText(p),
    remarks: p.remarks || '',
    scaffolds: (p.scaffolds || []).map(sc => ({
      id: uid(),
      type: sc.type || 'linguistic',
      label: sc.label || '',
      note: sc.note || '',
      supportLevel: '',
      fadeOut: false,
    })),
  }));
}

/* Die Felder, die eine Pocket-Stunde im Desktop besetzt. Bewusst als
   Teilmenge: alles andere (Sequenz, Nachbereitung, Dateien, Layout)
   bleibt dem Desktop überlassen und wird hier nicht angefasst.

   Lernziele sind in Pocket eine Liste, im Desktop ein Textfeld. Aus
   mehreren Zielen werden Zeilen – nichts geht verloren, und wer nur
   ein Ziel notiert hat, sieht im Desktop genau diesen einen Satz. */
export function pocketZuStundenfeldern(rohStunde, { uid, klasse = null, fach = null } = {}){
  const stunde = normalisiereStunde(rohStunde);
  const neueId = typeof uid === 'function' ? uid : (()=> `p-${Math.random().toString(16).slice(2)}`);

  const felder = {
    classGroup: klasse ?? stunde.className ?? '',
    subject: fach ?? stunde.subjectName ?? '',
    topic: stunde.topic || '',
    objectives: (stunde.learningGoals || []).map(z => z.text).join('\n'),
    successCriteria: [...(stunde.successCriteria || [])],
    competencies: (stunde.competencies || []).map(k => k.label),
    primaryCompetency: stunde.primaryCompetency || '',
    speechActs: (stunde.speechActs || []).map(s => s.label),
    notes: stunde.notes || '',
    phases: pocketPhasen(stunde, neueId),
  };

  if (stunde.communicativeTask) felder.communicativeTask = { ...stunde.communicativeTask };
  if (stunde.languageResources) felder.languageResources = { ...stunde.languageResources };

  /* Die primäre Kompetenz muss unter den gewählten stehen – sonst
     zeigte der Desktop eine Hervorhebung ohne zugehörigen Eintrag. */
  if (felder.primaryCompetency && !felder.competencies.some(
    l => vergleichsSchluessel(l) === vergleichsSchluessel(felder.primaryCompetency))) {
    felder.competencies = [...felder.competencies, felder.primaryCompetency];
  }

  return felder;
}

/* ---- Schreiben ------------------------------------------------------- */

function merkeEtikett(nextDb, ablage, label){
  const l = normalisiereEtikett(label);
  if (!l) return;
  if (!nextDb[ablage] || typeof nextDb[ablage] !== 'object') nextDb[ablage] = {};
  if (!nextDb.hiddenSuggestions || typeof nextDb.hiddenSuggestions !== 'object') nextDb.hiddenSuggestions = {};
  if (!nextDb.hiddenSuggestions[ablage] || typeof nextDb.hiddenSuggestions[ablage] !== 'object') {
    nextDb.hiddenSuggestions[ablage] = {};
  }
  if (nextDb.hiddenSuggestions[ablage][l]) delete nextDb.hiddenSuggestions[ablage][l];
  const bisher = nextDb[ablage][l] || { count: 0, lastUsed: '' };
  nextDb[ablage][l] = { ...bisher, count: (bisher.count || 0) + 1, lastUsed: new Date().toISOString() };
}

/* Der Vermerk, dass dieser Pocket-Entwurf schon einmal hier war. Er
   liegt getrennt von der Stunde in db.pocketImports – so überlebt er
   auch das Löschen der Stunde, und der zweite Import derselben Datei
   wird trotzdem erkannt. */
export function merkePocketImport(nextDb, externalId, ziel){
  const id = String(externalId || '').trim();
  if (!id) return;
  if (!nextDb.pocketImports || typeof nextDb.pocketImports !== 'object') nextDb.pocketImports = {};
  const bisher = nextDb.pocketImports[id] || {};
  nextDb.pocketImports[id] = {
    ...bisher,
    externalId: id,
    importedAt: new Date().toISOString(),
    count: (bisher.count || 0) + 1,
    ...(ziel ? { weekStart: ziel.weekStart, dayIndex: ziel.dayIndex, slotIndex: ziel.slotIndex } : {}),
  };
}

/* Führt den Import aus. `nextDb` ist eine bereits angefertigte Kopie –
   die Funktion schreibt hinein und liefert zurück, was geschehen ist.
   Sie speichert nicht; das bleibt Sache der App. */
export function fuehrePocketImportAus(nextDb, plan, werkzeuge){
  const {
    stunde: rohStunde,
    modus = MODI.NEU,
    ziel,
    klasse = null,
    fach = null,
    kompetenzenUebernehmen = [],
    sprechabsichtenUebernehmen = [],
  } = plan || {};

  const { uid, defaultLesson, normalizeLesson } = werkzeuge || {};
  if (typeof uid !== 'function' || typeof defaultLesson !== 'function' || typeof normalizeLesson !== 'function') {
    throw new Error('fuehrePocketImportAus benötigt uid, defaultLesson und normalizeLesson.');
  }
  if (!ziel || !ziel.weekStart) throw new Error('Ohne Termin kann nicht importiert werden.');

  const stunde = normalisiereStunde(rohStunde);
  const felder = pocketZuStundenfeldern(stunde, { uid, klasse, fach });

  const woche = nextDb.weeks?.[ziel.weekStart] || { slotsPerDay: STANDARD_SLOTS, lessons: {}, duties: {} };
  const key = `${ziel.dayIndex}-${ziel.slotIndex}`;
  const bestehend = woche.lessons?.[key] || null;

  let ergebnis;
  if (modus === MODI.ANHAENGEN) {
    if (!bestehend) throw new Error('An dieser Stelle gibt es keine Stunde, an die angehängt werden könnte.');
    const alt = normalizeLesson(bestehend);
    ergebnis = {
      ...alt,
      phases: [...(alt.phases || []), ...felder.phases],
      /* Angehängt wird, was sich sinnvoll ergänzen lässt: Phasen und
         Notizen. Thema, Ziele und Kompetenzen der bestehenden Stunde
         bleiben, wie sie sind – ein Feld-für-Feld-Verschmelzen findet
         ausdrücklich nicht statt. */
      notes: [alt.notes, felder.notes].filter(Boolean).join('\n\n'),
    };
  } else {
    const basis = defaultLesson();
    ergebnis = normalizeLesson({
      ...basis,
      ...felder,
      /* Eine ersetzte Stunde behält ihre Sequenzzuordnung: der Termin
         gehört weiterhin zur selben Unterrichtsreihe. */
      sequenceId: (modus === MODI.ERSETZEN && bestehend?.sequenceId) ? bestehend.sequenceId : '',
    });
  }

  ergebnis = normalizeLesson(ergebnis);
  ergebnis.pocket = {
    externalId: stunde.externalId,
    importedAt: new Date().toISOString(),
    kind: stunde.kind,
    ...(stunde.app?.version ? { appVersion: stunde.app.version } : {}),
  };
  ergebnis.updatedAt = new Date().toISOString();

  if (!nextDb.weeks || typeof nextDb.weeks !== 'object') nextDb.weeks = {};
  nextDb.weeks[ziel.weekStart] = {
    ...woche,
    slotsPerDay: woche.slotsPerDay || STANDARD_SLOTS,
    lessons: { ...(woche.lessons || {}), [key]: ergebnis },
    duties: woche.duties || {},
  };

  /* Lerngruppe und Fach in die Vorschläge aufnehmen – dieselbe Ablage,
     die auch beim Tippen im Desktop wächst. */
  if (felder.classGroup) merkeEtikett(nextDb, 'classGroups', felder.classGroup);
  if (felder.subject) merkeEtikett(nextDb, 'subjects', felder.subject);

  /* Nur das ausdrücklich Bestätigte wandert in die Bibliothek. */
  for (const label of kompetenzenUebernehmen) merkeEtikett(nextDb, 'competencies', label);
  for (const label of sprechabsichtenUebernehmen) {
    if (istSystemSprechabsicht(label)) continue;
    merkeEtikett(nextDb, 'speechActs', label);
  }

  merkePocketImport(nextDb, stunde.externalId, ziel);

  return { lesson: ergebnis, ziel, modus };
}

/* ---- Vorschau-Text --------------------------------------------------- */

/* Die Zeilen, die in der Vorschau unter dem Thema stehen:
   "4 Phasen · 45 Minuten", "1 Lernziel", "3 Kompetenzen". */
export function vorschauZeilen(analyse){
  const s = analyse?.statistik || {};
  const zeilen = [];
  if (s.phasen) zeilen.push(`${s.phasen} ${s.phasen === 1 ? 'Phase' : 'Phasen'} · ${s.minuten} Minuten`);
  if (s.lernziele) zeilen.push(`${s.lernziele} ${s.lernziele === 1 ? 'Lernziel' : 'Lernziele'}`);
  if (s.erfolgskriterien) zeilen.push(`${s.erfolgskriterien} ${s.erfolgskriterien === 1 ? 'Erfolgskriterium' : 'Erfolgskriterien'}`);
  if (s.kompetenzen) zeilen.push(`${s.kompetenzen} ${s.kompetenzen === 1 ? 'Kompetenz' : 'Kompetenzen'}`);
  if (s.sprechabsichten) zeilen.push(`${s.sprechabsichten} ${s.sprechabsichten === 1 ? 'Sprechabsicht' : 'Sprechabsichten'}`);
  return zeilen;
}
