/* ============================================================
   Sequenzen verschieben

   Fällt eine Woche aus, verschiebt sich nicht eine Stunde, sondern
   alles Folgende. Von Hand ist das ein Nachmittag; hier ist es eine
   Vorschau und ein Klick.

   Der Aufbau ist bewusst zweiteilig:

     1. `planeVerschiebung` RECHNET. Sie ändert nichts, sondern liefert
        einen Vorschlag: welche Stunde wohin, was übersprungen wird, wo
        es klemmt. Reine Funktion, prüfbar ohne Oberfläche.
     2. `wendeVerschiebungAn` FÜHRT AUS – und zwar nur einen Vorschlag,
        der vollständig aufgeht. Halb verschobene Sequenzen gibt es
        nicht.

   Die Regeln, die dabei gelten:

     - Eine Doppelstunde ist ein unteilbarer Block. Sie braucht so viele
       unmittelbar aufeinanderfolgende passende Plätze, wie sie belegt.
     - Die Reihenfolge der Sequenz bleibt erhalten.
     - Ferien und schulfreie Tage werden übersprungen.
     - Belegte Plätze werden NIE überschrieben. Sie werden übersprungen
       (dann rückt der Termin weiter) oder sie stoppen die Aktion.
     - Was in der Vergangenheit liegt oder schon nachbereitet ist, bleibt
       liegen. Es ist gehalten worden; man verschiebt es nicht.
     - Die Grenzen des Schuljahres gelten. Was dahinter läge, wird
       benannt statt stillschweigend abgeschnitten.
     - Der Raum gehört zum Stundenplanplatz, nicht zur Planung. Er
       bleibt am Platz; alles Inhaltliche zieht um.
   ============================================================ */

import { sequenceOccurrences } from './insights.js';
import { blockSpanOf, lessonKey, belegteSlots, MAX_BLOCK_SPAN, blockName } from './doppelstunde.js';
import { hatNachbereitung } from './nachbereitung.js';

/* ---- Umfang der Verschiebung ----------------------------------------- */
export const UMFANG = {
  EINZELN: 'einzeln',
  AB_FOLGENDE: 'abFolgende',
  GESAMT: 'gesamt',
};

/* ---- Status einer Zeile in der Vorschau -------------------------------

   Neutral benannt: nichts davon ist ein Vorwurf. "Nicht verschoben"
   heisst, dass die Stunde bewusst liegen bleibt. */
export const STATUS = {
  VERSCHOBEN:  'verschoben',
  UNVERAENDERT: 'unveraendert',
  BLEIBT:      'bleibt',
  KEIN_PLATZ:  'keinPlatz',
  KONFLIKT:    'konflikt',
  AUSSERHALB:  'ausserhalb',
};

export const STATUS_TEXT = {
  [STATUS.VERSCHOBEN]:   'wird verschoben',
  [STATUS.UNVERAENDERT]: 'bleibt am selben Platz',
  [STATUS.BLEIBT]:       'bleibt liegen (vergangen oder nachbereitet)',
  [STATUS.KEIN_PLATZ]:   'kein passender Platz gefunden',
  [STATUS.KONFLIKT]:     'Zieltermin ist belegt',
  [STATUS.AUSSERHALB]:   'läge nach dem Schuljahr',
};

/* ---- Datumsrechnung ---------------------------------------------------
   Bewusst lokal und ohne Zeitzone: ein Schultag ist ein Kalendertag. */
function fromISO(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toISO(d){
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function plusTage(iso, tage){
  const d = fromISO(iso);
  if (!d) return '';
  d.setDate(d.getDate() + (Number(tage) || 0));
  return toISO(d);
}

function montagVon(iso){
  const d = fromISO(iso);
  if (!d) return '';
  const wochentag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wochentag);
  return toISO(d);
}

/* Der Wochentagsindex im Raster: Montag = 0 … Freitag = 4. Samstag und
   Sonntag gibt es im Wochenraster nicht. */
function tagIndex(iso){
  const d = fromISO(iso);
  if (!d) return -1;
  return (d.getDay() + 6) % 7;
}

const text = (v)=> String(v || '').trim();
const gruppenSchluessel = (l)=> `${text(l?.classGroup).toLowerCase()}||${text(l?.subject).toLowerCase()}`;

/* Ferien und schulfreie Tage. Dieselbe Auslegung wie im Schulkalender:
   ein Zeitraum schliesst beide Ränder ein. */
export function istSchulfrei(iso, schoolCalendar){
  const cal = schoolCalendar || {};
  const vac = (Array.isArray(cal.vacations) ? cal.vacations : [])
    .find(v => v?.startISO && v?.endISO && iso >= v.startISO && iso <= v.endISO);
  if (vac) return { frei: true, grund: 'Ferien', name: text(vac.name) };
  const fd = (Array.isArray(cal.freeDays) ? cal.freeDays : []).find(f => f?.dateISO === iso);
  if (fd) return { frei: true, grund: 'schulfrei', name: text(fd.name) };
  return { frei: false, grund: '', name: '' };
}

/* ---- Stundenplan und Planungsinhalt ----------------------------------

   Das Datenmodell trennt beides nicht: eine Stunde trägt ihren Raum
   selbst. Für das Verschieben ist die Trennung aber nötig – der Raum
   gehört zum Platz im Stundenplan, das Thema zur Planung.

   Deshalb diese beiden Funktionen. Sie verlieren nichts: was nicht zum
   Platz gehört, bleibt vollständig in der Planung, und ein Zielplatz
   ohne bekannten Raum lässt der Stunde ihren eigenen. */
export function platzMerkmale(lesson){
  return { room: text(lesson?.room) };
}

export function setzeAufPlatz(lesson, platz){
  const raum = text(platz?.room);
  if (!raum) return { ...lesson };
  return { ...lesson, room: raum };
}

/* Welcher Raum gehört zu diesem Stundenplanplatz?

   Gefragt wird die Lerngruppe selbst: welcher Raum steht bei ihr an
   diesem Wochentag zu dieser Stunde am häufigsten. Das ist keine
   Erfindung, sondern eine Auswertung dessen, was schon geplant ist. */
export function raumFuerPlatz(db, gruppe, dayIndex, slotIndex, { ausser = new Set() } = {}){
  const zaehler = new Map();
  for (const [weekStart, week] of Object.entries(db?.weeks || {})) {
    for (const [key, l] of Object.entries(week?.lessons || {})) {
      if (!l) continue;
      const [di, si] = key.split('-').map(Number);
      if (di !== dayIndex || si !== slotIndex) continue;
      if (gruppenSchluessel(l) !== gruppe) continue;
      if (ausser.has(`${weekStart}|${key}`)) continue;
      const raum = text(l.room);
      if (!raum) continue;
      zaehler.set(raum, (zaehler.get(raum) || 0) + 1);
    }
  }
  let bester = '';
  let hoechste = 0;
  for (const [raum, n] of zaehler.entries()) {
    if (n > hoechste) { hoechste = n; bester = raum; }
  }
  return bester;
}

/* ---- Die Stundenplanplätze einer Lerngruppe --------------------------

   Es gibt kein eigenes Stundenplanmodell in Prép-ybara – der Stundenplan
   IST das, was in den Wochen steht. Die regelmässigen Plätze einer
   Lerngruppe ergeben sich deshalb aus ihren Stunden: welcher Wochentag,
   welche Stunde, wie oft.

   Eine Doppelstunde bringt ihre Folgeplätze mit: sie belegt sie, also
   gehören sie zum Stundenplan der Gruppe. */
export function stundenplanPlaetze(db, gruppe){
  const proTag = new Map();   // dayIndex -> Map(slotIndex -> anzahl)
  for (const week of Object.values(db?.weeks || {})) {
    for (const [key, l] of Object.entries(week?.lessons || {})) {
      if (!l) continue;
      if (gruppenSchluessel(l) !== gruppe) continue;
      const [di, si] = key.split('-').map(Number);
      if (!Number.isFinite(di) || !Number.isFinite(si)) continue;
      if (!proTag.has(di)) proTag.set(di, new Map());
      const slots = proTag.get(di);
      for (const s of belegteSlots(si, blockSpanOf(l))) {
        slots.set(s, (slots.get(s) || 0) + 1);
      }
    }
  }
  const out = new Map();
  for (const [di, slots] of proTag.entries()) {
    out.set(di, [...slots.keys()].sort((a, b)=> a - b));
  }
  return out;
}

/* ---- Was zählt als Inhalt? -------------------------------------------

   Ein Stundenplan besteht in Prép-ybara aus Stunden. Viele davon sind
   nur der Rahmen: Klasse, Fach, Raum – und sonst nichts. Genau das ist
   der Platz im Stundenplan, und dorthin darf eine Sequenz ziehen.

   Alles, worin geplant wurde, ist Inhalt und wird nie überschrieben.
   Im Zweifel gilt eine Stunde als nicht leer: lieber ein Termin mehr
   übersprungen als eine Planung verloren. */
export function istLeerePlanung(l){
  if (!l || typeof l !== 'object') return true;
  const t = (v)=> String(v ?? '').trim();
  if (t(l.topic) || t(l.objectives) || t(l.homework) || t(l.notes) || t(l.progressionNote)) return false;
  if (t(l.primaryCompetency)) return false;
  if (Array.isArray(l.competencies) && l.competencies.length) return false;
  if (Array.isArray(l.successCriteria) && l.successCriteria.length) return false;
  if (Array.isArray(l.speechActs) && l.speechActs.length) return false;
  if (Array.isArray(l.files) && l.files.length) return false;
  if (Array.isArray(l.links) && l.links.length) return false;
  if (Array.isArray(l.phases) && l.phases.some(p => t(p?.socialForm) || t(p?.content)
    || t(p?.materialsMedia) || t(p?.remarks)
    || (Array.isArray(p?.scaffolds) && p.scaffolds.length))) return false;
  const aufgabe = l.communicativeTask || {};
  if (t(aufgabe.text) || t(aufgabe.situation) || t(aufgabe.audience) || t(aufgabe.intention) || t(aufgabe.outcome)) return false;
  const mittel = l.languageResources || {};
  if (t(mittel.vocabulary) || t(mittel.grammar) || t(mittel.pronunciation) || t(mittel.other)) return false;
  if (hatNachbereitung(l.review)) return false;
  return true;
}

/* Ist dieser Platz für die ziehende Sequenz benutzbar?

   Nein, sobald dort etwas steht, das nicht ihr eigener leerer Rahmen
   ist: eine fremde Lerngruppe, eine andere Sequenz, eine eigenständige
   Planung. Ein leerer Rahmen derselben Lerngruppe dagegen IST der
   Stundenplanplatz, den die Sequenz sucht. */
export function platzBenutzbar(lesson, { gruppe, sequenceId } = {}){
  if (!lesson) return true;
  if (gruppenSchluessel(lesson) !== gruppe) return false;
  const seq = text(lesson.sequenceId);
  if (seq && seq !== String(sequenceId || '')) return false;
  return istLeerePlanung(lesson);
}

/* Der Rahmen, der am alten Platz zurückbleibt.

   Das Datenmodell trennt Stundenplan und Planung nicht. Würde eine
   verschobene Stunde ihren Platz einfach leer lassen, verschwände damit
   auch der Stundenplaneintrag – der Platz wäre für die nächste
   Verschiebung nicht mehr auffindbar, und im Wochenraster fehlte die
   Stunde ganz.

   Deshalb bleibt der Rahmen stehen: Klasse, Fach, Raum, Dauer. Alles
   Geplante zieht um; verloren geht dabei nichts, denn es steht
   vollständig am neuen Platz. */
export function rahmenStunde(lesson, { jetzt = new Date().toISOString() } = {}){
  const l = JSON.parse(JSON.stringify(lesson || {}));
  return {
    ...l,
    topic: '', objectives: '', homework: '', notes: '', progressionNote: '',
    phases: [], files: [], links: [],
    sequenceId: '', primaryCompetency: '', competencies: [],
    successCriteria: [], speechActs: [],
    communicativeTask: { text: '', situation: '', audience: '', intention: '', outcome: '' },
    languageResources: { vocabulary: '', grammar: '', pronunciation: '', other: '' },
    review: { status: 'not_reviewed', generalNotes: '', phaseReviews: {}, carryOverItems: [], reviewedAt: '' },
    updatedAt: jetzt,
  };
}

/* ---- Belegung ---------------------------------------------------------

   Wem gehört ein Platz? Entweder trägt er selbst eine Stunde, oder eine
   Doppelstunde weiter oben deckt ihn ab. Beides zählt – ob es den Platz
   auch versperrt, entscheidet platzBenutzbar(). */
function belegungKarte(db){
  const karte = new Map();   // "weekStart|day-slot" -> Stunde, die den Platz einnimmt
  for (const [weekStart, week] of Object.entries(db?.weeks || {})) {
    for (const [key, l] of Object.entries(week?.lessons || {})) {
      if (!l) continue;
      const [di, si] = key.split('-').map(Number);
      if (!Number.isFinite(di) || !Number.isFinite(si)) continue;
      for (const s of belegteSlots(si, blockSpanOf(l))) {
        karte.set(`${weekStart}|${lessonKey(di, s)}`, l);
      }
    }
  }
  return karte;
}

/* ---- Der Strom möglicher Plätze --------------------------------------

   Ab einem Datum vorwärts: jeder Schultag, jeder Stundenplanplatz der
   Lerngruppe, in zeitlicher Reihenfolge. Ferien und schulfreie Tage
   werden übersprungen und dabei gezählt – die Vorschau soll sagen
   können, WARUM ein Termin weiter hinten liegt. */
function* plaetzeAb(db, { gruppe, startISO, slotAb, schoolCalendar, endeISO, maxTage = 400 }){
  const plaetze = stundenplanPlaetze(db, gruppe);
  if (!plaetze.size) return;
  let ersterTag = true;
  for (let i = 0; i < maxTage; i++) {
    const iso = plusTage(startISO, i);
    if (!iso) return;
    if (endeISO && iso > endeISO) return;
    const di = tagIndex(iso);
    if (di > 4) { ersterTag = false; continue; }             // Wochenende
    const frei = istSchulfrei(iso, schoolCalendar);
    if (frei.frei) { yield { art: 'frei', iso, ...frei }; ersterTag = false; continue; }
    const slots = plaetze.get(di) || [];
    for (const slotIndex of slots) {
      if (ersterTag && Number.isFinite(slotAb) && slotIndex < slotAb) continue;
      yield {
        art: 'platz',
        iso,
        weekStart: montagVon(iso),
        dayIndex: di,
        slotIndex,
      };
    }
    ersterTag = false;
  }
}

/* ---- Die Stunden, die bewegt werden ----------------------------------

   `abGefunden` unterscheidet zwei Fälle, die sonst gleich aussähen: die
   Sequenz hat keine Stunden – oder die gewählte Stunde gehört nicht zu
   ihr. Nur so kann die Meldung sagen, was wirklich los ist. */
function auswahlDerStunden(db, { sequenceId, umfang, ab }){
  const alle = sequenceOccurrences(db, sequenceId);
  if (umfang === UMFANG.GESAMT || !ab) return { liste: alle, abGefunden: true };
  const index = alle.findIndex(o => o.weekStart === ab.weekStart
    && o.dayIndex === Number(ab.dayIndex)
    && o.slotIndex === Number(ab.slotIndex));
  if (index < 0) return { liste: [], abGefunden: false };
  if (umfang === UMFANG.EINZELN) return { liste: [alle[index]], abGefunden: true };
  return { liste: alle.slice(index), abGefunden: true };
}

/* ---- Der Plan ---------------------------------------------------------

   Alles, was die Vorschau zeigt, entsteht hier. Ausgeführt wird nichts. */
export function planeVerschiebung(db, {
  sequenceId,
  umfang = UMFANG.GESAMT,
  ab = null,
  ziel = null,
  heuteISO = '',
  auchVergangene = false,
  beiKonflikt = 'ueberspringen',   // oder 'stoppen'
} = {}){
  const fehler = [];
  const sequenz = db?.sequences?.[String(sequenceId || '')] || null;
  const { liste: auswahl, abGefunden } = auswahlDerStunden(db, { sequenceId, umfang, ab });

  if (!sequenz) fehler.push({ code: 'keineSequenz', text: 'Diese Sequenz gibt es nicht mehr.' });
  if (!abGefunden) {
    fehler.push({
      code: 'stundeNichtInSequenz',
      text: 'Die gewählte Stunde gehört (noch) nicht zu dieser Sequenz. Wähle „Die gesamte Sequenz" oder speichere die Zuordnung zuerst.',
    });
  } else if (!auswahl.length) {
    fehler.push({ code: 'keineStunden', text: 'Für die gewählte Auswahl gibt es keine Stunden.' });
  }
  if (fehler.length) return { ok: false, fehler, zeilen: [], bewegungen: [], sequenz, gruppe: null };

  /* Die Lerngruppe der Auswahl. Bei gemischten Angaben gewinnt die
     häufigste – verschoben wird innerhalb EINER Lerngruppe, alles
     andere wäre geraten. */
  const gruppenZaehler = new Map();
  for (const o of auswahl) {
    const g = gruppenSchluessel(o.lesson);
    gruppenZaehler.set(g, (gruppenZaehler.get(g) || 0) + 1);
  }
  const gruppe = [...gruppenZaehler.entries()].sort((a, b)=> b[1] - a[1])[0][0];
  const gruppeAnzeige = (()=>{
    const l = auswahl.find(o => gruppenSchluessel(o.lesson) === gruppe)?.lesson || {};
    return { classGroup: text(l.classGroup), subject: text(l.subject) };
  })();

  /* Was liegen bleibt: Vergangenes und Nachbereitetes. Es wird nicht
     verschwiegen, sondern in der Vorschau als "bleibt liegen" gezeigt. */
  const bleibt = new Set();
  if (!auchVergangene) {
    for (const o of auswahl) {
      const vergangen = heuteISO && o.dateISO < heuteISO;
      const nachbereitet = hatNachbereitung(o.lesson?.review);
      if (vergangen || nachbereitet) bleibt.add(o.key + '|' + o.weekStart);
    }
  }
  const beweglich = auswahl.filter(o => !bleibt.has(o.key + '|' + o.weekStart));

  /* Der Startpunkt. Drei Wege führen hierher: ein ausdrücklicher
     Zielplatz, ein Zieldatum, oder eine Verschiebung um n Wochen. */
  const ersteBewegliche = beweglich[0] || null;
  const zielStartISO = (()=>{
    if (!ziel) return '';
    if (ziel.dateISO) return String(ziel.dateISO);
    if (Number.isFinite(Number(ziel.wochen)) && ersteBewegliche) {
      return plusTage(ersteBewegliche.dateISO, Number(ziel.wochen) * 7);
    }
    return '';
  })();

  if (!beweglich.length) {
    return {
      ok: false,
      fehler: [{ code: 'nichtsZuVerschieben', text: 'Alle Stunden der Auswahl bleiben liegen (vergangen oder bereits nachbereitet).' }],
      zeilen: auswahl.map(o => zeile(o, null, STATUS.BLEIBT, [])),
      bewegungen: [], sequenz, gruppe: gruppeAnzeige,
      uebersprungeneFerien: 0, uebersprungeneBelegt: 0,
    };
  }
  if (!zielStartISO) {
    return {
      ok: false,
      fehler: [{ code: 'keinZiel', text: 'Bitte einen neuen Starttermin wählen.' }],
      zeilen: [], bewegungen: [], sequenz, gruppe: gruppeAnzeige,
      uebersprungeneFerien: 0, uebersprungeneBelegt: 0,
    };
  }

  /* Ohne bekannte Stundenplanplätze gibt es nichts zu berechnen. Das
     ist kein Fehler der Eingabe, sondern eine Auskunft: die Lerngruppe
     hat in dieser Datenbank noch keine regelmässigen Stunden. */
  if (!stundenplanPlaetze(db, gruppe).size) {
    return {
      ok: false,
      fehler: [{ code: 'keinePlaetze', text: 'Für diese Lerngruppe sind keine Stundenplanplätze bekannt.' }],
      zeilen: auswahl.map(o => zeile(o, null, STATUS.KEIN_PLATZ, [])),
      bewegungen: [], sequenz, gruppe: gruppeAnzeige,
      uebersprungeneFerien: 0, uebersprungeneBelegt: 0,
    };
  }

  const schoolYear = db?.schoolCalendar?.schoolYear || {};
  const jahrStart = text(schoolYear.startISO);
  const jahrEnde = text(schoolYear.endISO);

  if (jahrStart && zielStartISO < jahrStart) {
    return {
      ok: false,
      fehler: [{ code: 'vorSchuljahr', text: 'Der neue Starttermin läge vor dem Beginn des Schuljahres.' }],
      zeilen: [], bewegungen: [], sequenz, gruppe: gruppeAnzeige,
      uebersprungeneFerien: 0, uebersprungeneBelegt: 0,
    };
  }

  /* Die Plätze, die die bewegten Stunden selbst freigeben. Sie stehen
     dem Plan zur Verfügung – sonst könnte eine Sequenz nicht ein Stück
     nach vorn rücken. */
  const freiwerdend = new Set();
  for (const o of beweglich) {
    for (const s of belegteSlots(o.slotIndex, blockSpanOf(o.lesson))) {
      freiwerdend.add(`${o.weekStart}|${lessonKey(o.dayIndex, s)}`);
    }
  }

  const belegt = belegungKarte(db);
  const istFrei = (weekStart, dayIndex, slotIndex)=>{
    const schluessel = `${weekStart}|${lessonKey(dayIndex, slotIndex)}`;
    if (freiwerdend.has(schluessel)) return true;
    return platzBenutzbar(belegt.get(schluessel) || null, { gruppe, sequenceId });
  };
  const slotsAmTag = (weekStart)=> Number(db?.weeks?.[weekStart]?.slotsPerDay) || 6;

  const strom = plaetzeAb(db, {
    gruppe,
    startISO: zielStartISO,
    slotAb: Number.isFinite(Number(ziel?.slotIndex)) ? Number(ziel.slotIndex) : undefined,
    schoolCalendar: db?.schoolCalendar,
    endeISO: jahrEnde,
  });

  const plaetze = stundenplanPlaetze(db, gruppe);
  const zeilen = [];
  const bewegungen = [];
  const belegteZiele = new Set();      // im selben Lauf schon vergebene Plätze
  let uebersprungeneFerien = 0;
  let uebersprungeneBelegt = 0;
  let hinweiseFuerNaechste = [];
  let konfliktGestoppt = false;

  const passt = (kandidat, span)=>{
    const { weekStart, dayIndex, slotIndex } = kandidat;
    if (slotIndex + span > slotsAmTag(weekStart)) return false;
    const tagesSlots = plaetze.get(dayIndex) || [];
    for (const s of belegteSlots(slotIndex, span)) {
      /* Eine Doppelstunde braucht Plätze, die im Stundenplan der
         Lerngruppe auch wirklich vorkommen. */
      if (!tagesSlots.includes(s)) return false;
      if (belegteZiele.has(`${weekStart}|${lessonKey(dayIndex, s)}`)) return false;
      if (!istFrei(weekStart, dayIndex, s)) return false;
    }
    return true;
  };

  for (const o of auswahl) {
    if (bleibt.has(o.key + '|' + o.weekStart)) {
      zeilen.push(zeile(o, null, STATUS.BLEIBT, []));
      continue;
    }

    const span = blockSpanOf(o.lesson);
    let platz = null;
    const hinweise = [...hinweiseFuerNaechste];
    hinweiseFuerNaechste = [];

    if (!konfliktGestoppt) {
      for (;;) {
        const next = strom.next();
        if (next.done) break;
        const kandidat = next.value;
        if (kandidat.art === 'frei') {
          uebersprungeneFerien += 1;
          const bezeichnung = kandidat.name ? `${kandidat.grund}: ${kandidat.name}` : kandidat.grund;
          if (!hinweise.includes(bezeichnung)) hinweise.push(bezeichnung);
          continue;
        }
        if (passt(kandidat, span)) { platz = kandidat; break; }
        /* Der Platz ist besetzt oder zu knapp für den Block. Beides
           überschreibt nichts – es wird weitergesucht oder gestoppt. */
        const grundBelegt = !istFrei(kandidat.weekStart, kandidat.dayIndex, kandidat.slotIndex)
          || belegteZiele.has(`${kandidat.weekStart}|${lessonKey(kandidat.dayIndex, kandidat.slotIndex)}`);
        if (grundBelegt) {
          uebersprungeneBelegt += 1;
          if (beiKonflikt === 'stoppen') { konfliktGestoppt = true; break; }
          if (!hinweise.includes('belegter Termin übersprungen')) hinweise.push('belegter Termin übersprungen');
        } else if (span > 1 && !hinweise.includes(`${blockName(span)} braucht ${span} freie Plätze am Stück`)) {
          hinweise.push(`${blockName(span)} braucht ${span} freie Plätze am Stück`);
        }
      }
    }

    if (!platz) {
      const status = konfliktGestoppt ? STATUS.KONFLIKT
        : (jahrEnde ? STATUS.AUSSERHALB : STATUS.KEIN_PLATZ);
      zeilen.push(zeile(o, null, status, hinweise));
      continue;
    }

    for (const s of belegteSlots(platz.slotIndex, span)) {
      belegteZiele.add(`${platz.weekStart}|${lessonKey(platz.dayIndex, s)}`);
    }

    const unveraendert = platz.weekStart === o.weekStart
      && platz.dayIndex === o.dayIndex
      && platz.slotIndex === o.slotIndex;

    zeilen.push(zeile(o, platz, unveraendert ? STATUS.UNVERAENDERT : STATUS.VERSCHOBEN, hinweise));
    if (!unveraendert) {
      bewegungen.push({
        von: { weekStart: o.weekStart, dayIndex: o.dayIndex, slotIndex: o.slotIndex, dateISO: o.dateISO },
        nach: { weekStart: platz.weekStart, dayIndex: platz.dayIndex, slotIndex: platz.slotIndex, dateISO: platz.iso },
        span,
        stunde: o.lesson,
      });
    }
  }

  const gescheitert = zeilen.filter(z => z.status === STATUS.KEIN_PLATZ
    || z.status === STATUS.KONFLIKT
    || z.status === STATUS.AUSSERHALB);

  const fehlerListe = [];
  if (gescheitert.length) {
    if (gescheitert.some(z => z.status === STATUS.KONFLIKT)) {
      fehlerListe.push({ code: 'konflikt', text: 'Ein Zieltermin ist bereits belegt. Es wird nichts überschrieben.' });
    }
    if (gescheitert.some(z => z.status === STATUS.AUSSERHALB)) {
      fehlerListe.push({ code: 'schuljahr', text: 'Nicht alle Stunden finden im laufenden Schuljahr Platz.' });
    }
    if (gescheitert.some(z => z.status === STATUS.KEIN_PLATZ)) {
      fehlerListe.push({ code: 'keinPlatz', text: 'Für mindestens eine Stunde gibt es keinen passenden Stundenplanplatz.' });
    }
  }

  /* Der Zeitraum der Sequenz NACH der Verschiebung – für die optionale
     Anpassung verknüpfter Jahresbalken. Stunden, die liegen bleiben,
     gehören weiterhin zur Sequenz und zählen deshalb mit. */
  const neueDaten = zeilen
    .map(z => z.nach?.dateISO || z.von?.dateISO)
    .filter(Boolean)
    .sort();

  return {
    ok: fehlerListe.length === 0 && bewegungen.length > 0,
    fehler: fehlerListe,
    zeilen,
    bewegungen,
    sequenz,
    gruppe: gruppeAnzeige,
    uebersprungeneFerien,
    uebersprungeneBelegt,
    vonISO: neueDaten[0] || '',
    bisISO: neueDaten[neueDaten.length - 1] || '',
  };
}

function zeile(o, platz, status, hinweise){
  const l = o.lesson || {};
  const span = blockSpanOf(l);
  return {
    id: `${o.weekStart}|${o.key}`,
    von: { weekStart: o.weekStart, dayIndex: o.dayIndex, slotIndex: o.slotIndex, dateISO: o.dateISO },
    nach: platz ? { weekStart: platz.weekStart, dayIndex: platz.dayIndex, slotIndex: platz.slotIndex, dateISO: platz.iso } : null,
    classGroup: text(l.classGroup),
    subject: text(l.subject),
    thema: text(l.topic),
    span,
    dauer: blockName(span),
    status,
    hinweise: Array.isArray(hinweise) ? hinweise : [],
  };
}

/* ---- Die Orte, die ein Plan berührt ----------------------------------

   Quelle und Ziel jeder Bewegung. Daraus entsteht der Eintrag im
   Versionsverlauf: wer ihn wiederherstellt, bekommt beide Seiten
   zurück – die Sequenz steht danach wieder genau so da wie vorher. */
export function betroffeneOrte(plan){
  const orte = new Map();
  for (const b of (plan?.bewegungen || [])) {
    for (const s of belegteSlots(b.von.slotIndex, b.span)) {
      orte.set(`${b.von.weekStart}|${b.von.dayIndex}|${s}`, { weekStart: b.von.weekStart, dayIndex: b.von.dayIndex, slotIndex: s });
    }
    for (const s of belegteSlots(b.nach.slotIndex, b.span)) {
      orte.set(`${b.nach.weekStart}|${b.nach.dayIndex}|${s}`, { weekStart: b.nach.weekStart, dayIndex: b.nach.dayIndex, slotIndex: s });
    }
  }
  return [...orte.values()];
}

/* ---- Ausführen --------------------------------------------------------

   Entweder vollständig oder gar nicht. Erst werden ALLE bewegten
   Stunden von ihren Plätzen genommen, dann werden sie gesetzt – so kann
   eine Sequenz auch in sich selbst rutschen, ohne sich zu überschreiben.

   Ein Plan, der nicht aufgeht (`ok: false`), wird gar nicht erst
   ausgeführt: die Funktion gibt dann null zurück und die Daten bleiben,
   wie sie waren. */
export function wendeVerschiebungAn(db, plan, { jetzt = new Date().toISOString(), rahmenBehalten = true } = {}){
  if (!plan || !plan.ok || !Array.isArray(plan.bewegungen) || !plan.bewegungen.length) return null;
  const next = JSON.parse(JSON.stringify(db || {}));
  if (!next.weeks || typeof next.weeks !== 'object') next.weeks = {};

  const gruppe = `${text(plan.gruppe?.classGroup).toLowerCase()}||${text(plan.gruppe?.subject).toLowerCase()}`;
  const sequenceId = String(plan.sequenz?.id || '');
  const quellen = new Set();
  for (const b of plan.bewegungen) quellen.add(`${b.von.weekStart}|${lessonKey(b.von.dayIndex, b.von.slotIndex)}`);

  // 1. Abräumen. Erst wenn ALLE Stunden von ihren Plätzen genommen sind,
  //    wird gesetzt – sonst könnte eine Sequenz sich selbst im Weg stehen.
  const mitgenommen = [];
  for (const b of plan.bewegungen) {
    const woche = next.weeks[b.von.weekStart];
    const key = lessonKey(b.von.dayIndex, b.von.slotIndex);
    const stunde = woche?.lessons?.[key];
    if (!stunde) return null;            // Die Daten haben sich geändert: nichts tun.
    delete woche.lessons[key];
    mitgenommen.push({ bewegung: b, stunde });
  }

  // 2. Setzen.
  for (const { bewegung, stunde } of mitgenommen) {
    const ws = bewegung.nach.weekStart;
    if (!next.weeks[ws]) next.weeks[ws] = { slotsPerDay: 6, lessons: {}, duties: {} };
    const woche = next.weeks[ws];
    if (!woche.lessons || typeof woche.lessons !== 'object') woche.lessons = {};
    const key = lessonKey(bewegung.nach.dayIndex, bewegung.nach.slotIndex);
    const vorhanden = woche.lessons[key] || null;
    /* Sicherheitsnetz. Der Plan hat das längst geprüft; würde hier
       trotzdem etwas Geplantes stehen, wird gar nichts geschrieben. */
    if (vorhanden && !platzBenutzbar(vorhanden, { gruppe, sequenceId })) return null;
    /* Der Raum gehört zum Platz: erst der Rahmen, der dort steht, dann
       der Raum, in dem die Lerngruppe zu dieser Stunde sonst ist.
       Findet sich beides nicht, behält die Stunde ihren eigenen. */
    const zielRaum = text(vorhanden?.room)
      || raumFuerPlatz(db, gruppe, bewegung.nach.dayIndex, bewegung.nach.slotIndex, { ausser: quellen });
    /* Die Folgeplätze einer Doppelstunde tragen keinen eigenen Eintrag –
       ein leerer Rahmen dort würde sie verdecken. */
    for (const s of belegteSlots(bewegung.nach.slotIndex, bewegung.span).slice(1)) {
      delete woche.lessons[lessonKey(bewegung.nach.dayIndex, s)];
    }
    woche.lessons[key] = { ...setzeAufPlatz(stunde, { room: zielRaum }), updatedAt: jetzt };
  }

  /* 3. Am alten Platz bleibt der Stundenplan stehen.

     Ohne diesen Schritt verschwände mit der Planung auch der Eintrag im
     Wochenraster – der Stundenplanplatz wäre weg. Gesetzt wird nur, wo
     jetzt nichts steht: wo eine andere Stunde hingezogen ist, gehört
     der Platz ihr. */
  if (rahmenBehalten) {
    for (const { bewegung, stunde } of mitgenommen) {
      const woche = next.weeks[bewegung.von.weekStart];
      if (!woche?.lessons) continue;
      if (!text(stunde.classGroup) && !text(stunde.subject)) continue;
      const span = blockSpanOf(stunde);
      const frei = belegteSlots(bewegung.von.slotIndex, span)
        .every(s => !woche.lessons[lessonKey(bewegung.von.dayIndex, s)]);
      const key = lessonKey(bewegung.von.dayIndex, bewegung.von.slotIndex);
      if (woche.lessons[key]) continue;
      const rahmen = rahmenStunde(stunde, { jetzt });
      // Passt der Block nicht mehr, bleibt der Rahmen eine Einzelstunde.
      rahmen.blockSpan = frei ? span : 1;
      woche.lessons[key] = rahmen;
    }
  }

  return next;
}

/* ---- Verknüpfte Jahresbalken -----------------------------------------

   Optional und nie von selbst: Nach einer Verschiebung KANN ein
   verknüpfter Balken auf den neuen Zeitraum gelegt werden. Diese
   Funktion rechnet ihn nur aus – gefragt wird in der Oberfläche. */
export function balkenNachVerschiebung(yearBars, sequenceId, plan, { aufWoche = (iso)=>iso } = {}){
  const id = String(sequenceId || '').trim();
  if (!id || !plan?.vonISO || !plan?.bisISO) return [];
  return (Array.isArray(yearBars) ? yearBars : [])
    .filter(b => String(b?.sequenceId || '').trim() === id)
    .map(b => ({ id: b.id, startISO: aufWoche(plan.vonISO), endISO: aufWoche(plan.bisISO) }));
}

export { MAX_BLOCK_SPAN };
