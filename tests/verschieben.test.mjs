/* ============================================================
   Sequenzen verschieben

   Geprüft wird die Rechnung, nicht die Oberfläche: welcher Vorschlag
   aus welcher Lage entsteht, was übersprungen wird, wann gar nichts
   passiert.

   Die wichtigsten Zusagen, die hier abgesichert sind:

     - Es wird nie etwas überschrieben.
     - Eine Doppelstunde bleibt zusammen.
     - Ferien werden übersprungen.
     - Ein Plan, der nicht aufgeht, ändert gar nichts (atomar).
     - Vergangenes und Nachbereitetes bleibt liegen.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UMFANG, STATUS,
  planeVerschiebung, wendeVerschiebungAn, betroffeneOrte,
  stundenplanPlaetze, raumFuerPlatz, setzeAufPlatz, platzMerkmale,
  istSchulfrei, balkenNachVerschiebung, plusTage,
} from '../renderer/src/verschieben.js';
import { erstelleEintrag, stundenTeil, wendeAn } from '../renderer/src/versionsverlauf.js';

/* ---- Eine kleine, aber echte Datenlage -------------------------------

   9b Französisch hat montags in der 3. Stunde und mittwochs in der
   2./3. Stunde Unterricht. Die Sequenz "Passé composé" liegt auf drei
   dieser Termine. Alle Wochen sind Montagswochen. */

const WOCHEN = ['2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22', '2025-09-29'];

function stunde(patch = {}){
  return {
    subject: 'Französisch', classGroup: '9b', room: 'A101',
    topic: '', objectives: '', phases: [], homework: '', notes: '',
    files: [], links: [], sequenceId: '', competencies: [], blockSpan: 1,
    review: { status: 'not_reviewed', generalNotes: '', phaseReviews: {}, carryOverItems: [], reviewedAt: '' },
    ...patch,
  };
}

function datenbank({ lessons = {}, vacations = [], freeDays = [], schoolYear } = {}){
  const weeks = {};
  for (const ws of WOCHEN) weeks[ws] = { slotsPerDay: 6, lessons: {}, duties: {} };
  for (const [ort, l] of Object.entries(lessons)) {
    const [ws, key] = ort.split('|');
    weeks[ws].lessons[key] = l;
  }
  return {
    sequences: { s1: { id: 's1', name: 'Le passé composé', color: '#4f6ef7' } },
    weeks,
    yearBars: [],
    schoolCalendar: {
      schoolYear: schoolYear || { startISO: '2025-08-01', endISO: '2026-07-31' },
      vacations, freeDays, events: [],
    },
  };
}

/* Der Regelfall: Montag 3. Stunde in jeder Woche, drei davon in der Sequenz. */
function standardDb(extra = {}){
  return datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'Einstieg' }),
      '2025-09-08|0-2': stunde({ sequenceId: 's1', topic: 'Erarbeitung' }),
      '2025-09-15|0-2': stunde({ sequenceId: 's1', topic: 'Sicherung' }),
      '2025-09-22|0-2': stunde({ topic: 'Freie Planung' }),
      '2025-09-29|0-2': stunde({ topic: '' }),
    },
    ...extra,
  });
}

const heute = '2025-08-25';   // vor allen Terminen: nichts liegt in der Vergangenheit

/* ---- Stundenplanplätze ------------------------------------------------ */

test('Die Stundenplanplätze einer Lerngruppe ergeben sich aus ihren Stunden', ()=>{
  const db = standardDb();
  const plaetze = stundenplanPlaetze(db, '9b||französisch');
  assert.deepEqual([...plaetze.keys()], [0]);
  assert.deepEqual(plaetze.get(0), [2]);
});

test('Eine Doppelstunde bringt ihre Folgeplätze mit', ()=>{
  const db = datenbank({ lessons: { '2025-09-01|2-1': stunde({ blockSpan: 2 }) } });
  const plaetze = stundenplanPlaetze(db, '9b||französisch');
  assert.deepEqual(plaetze.get(2), [1, 2]);
});

/* ---- Einzelne Stunde --------------------------------------------------- */

test('Eine einzelne Stunde wandert auf den nächsten freien Platz', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-29' },
    heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.bewegungen.length, 1);
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-29');

  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-29'].lessons['0-2'].topic, 'Einstieg');
  /* Am alten Platz bleibt der Stundenplan stehen: Klasse, Fach, Raum –
     ohne Planung. Sonst verschwände der Stundenplaneintrag mit der
     Verschiebung. */
  const rahmen = next.weeks['2025-09-01'].lessons['0-2'];
  assert.equal(rahmen.topic, '');
  assert.equal(rahmen.classGroup, '9b');
  assert.equal(rahmen.subject, 'Französisch');
  assert.equal(rahmen.room, 'A101');
  assert.equal(rahmen.sequenceId, '');
  // Die Ausgangsdaten bleiben unangetastet.
  assert.equal(db.weeks['2025-09-01'].lessons['0-2'].topic, 'Einstieg');
});

/* ---- Ausgewählte und folgende Stunden --------------------------------- */

test('Ausgewählte und folgende Stunden rücken gemeinsam weiter', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.AB_FOLGENDE,
    ab: { weekStart: '2025-09-08', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-15' },
    heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  // Die erste Stunde der Sequenz bleibt, wo sie war: sie ist nicht Teil der Auswahl.
  assert.equal(plan.zeilen.length, 2);
  assert.equal(plan.bewegungen.length, 2);
  assert.equal(plan.bewegungen[0].von.dateISO, '2025-09-08');
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-15');
  assert.equal(plan.bewegungen[1].nach.dateISO, '2025-09-29', 'der 22.9. ist fremd belegt');

  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, 'Einstieg');
  assert.equal(next.weeks['2025-09-15'].lessons['0-2'].topic, 'Erarbeitung');
  assert.equal(next.weeks['2025-09-22'].lessons['0-2'].topic, 'Freie Planung', 'fremde Planung bleibt unberührt');
  assert.equal(next.weeks['2025-09-29'].lessons['0-2'].topic, 'Sicherung');
});

/* ---- Ganze Sequenz ----------------------------------------------------- */

test('Die gesamte Sequenz rückt eine Woche nach hinten', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'A' }),
      '2025-09-08|0-2': stunde({ sequenceId: 's1', topic: 'B' }),
      '2025-09-15|0-2': stunde({ sequenceId: 's1', topic: 'C' }),
      '2025-09-22|0-2': stunde({ topic: '' }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.bewegungen.map(b => b.nach.dateISO), ['2025-09-08', '2025-09-15', '2025-09-22']);
  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-08'].lessons['0-2'].topic, 'A');
  assert.equal(next.weeks['2025-09-22'].lessons['0-2'].topic, 'C');
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, '', 'am alten Platz bleibt der Rahmen');
});

test('Eine Sequenz lässt sich auch nach vorne ziehen', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ topic: '' }),
      '2025-09-08|0-2': stunde({ topic: '' }),
      '2025-09-15|0-2': stunde({ sequenceId: 's1', topic: 'A' }),
      '2025-09-22|0-2': stunde({ sequenceId: 's1', topic: 'B' }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: -2 }, heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, 'A');
  assert.equal(next.weeks['2025-09-08'].lessons['0-2'].topic, 'B');
});

test('Die Reihenfolge der Sequenz bleibt erhalten', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: '1' }),
      '2025-09-08|0-2': stunde({ sequenceId: 's1', topic: '2' }),
      '2025-09-15|0-2': stunde({ sequenceId: 's1', topic: '3' }),
      '2025-09-22|0-2': stunde({ topic: '' }),
      '2025-09-29|0-2': stunde({ topic: '' }),
    },
  });
  const plan = planeVerschiebung(db, { sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 2 }, heuteISO: heute });
  const next = wendeVerschiebungAn(db, plan);
  assert.deepEqual(
    ['2025-09-15', '2025-09-22', '2025-09-29'].map(w => next.weeks[w].lessons['0-2'].topic),
    ['1', '2', '3'],
  );
});

/* ---- Ferien und schulfreie Tage --------------------------------------- */

test('Ferien werden übersprungen und in der Vorschau benannt', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'A' }),
      '2025-09-08|0-2': stunde({ topic: '' }),
      '2025-09-15|0-2': stunde({ topic: '' }),
    },
    vacations: [{ id: 'v1', name: 'Herbstferien', startISO: '2025-09-08', endISO: '2025-09-12' }],
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-15');
  assert.ok(plan.uebersprungeneFerien >= 1);
  assert.ok(plan.zeilen[0].hinweise.some(h => /Ferien/.test(h)));
});

test('Ein einzelner schulfreier Tag wird ebenso übersprungen', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'A' }),
      '2025-09-08|0-2': stunde({ topic: '' }),
      '2025-09-15|0-2': stunde({ topic: '' }),
    },
    freeDays: [{ id: 'f1', name: 'Pädagogischer Tag', dateISO: '2025-09-08' }],
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-15');
  assert.equal(istSchulfrei('2025-09-08', db.schoolCalendar).frei, true);
  assert.equal(istSchulfrei('2025-09-15', db.schoolCalendar).frei, false);
});

/* ---- Doppelstunden ----------------------------------------------------- */

test('Eine Doppelstunde bleibt zusammen und braucht zwei Plätze am Stück', ()=>{
  const db = datenbank({
    lessons: {
      // Mittwoch 2./3. Stunde als Doppelstunde, danach zwei freie Mittwoche.
      '2025-09-01|2-1': stunde({ sequenceId: 's1', topic: 'Doppel', blockSpan: 2 }),
      '2025-09-08|2-1': stunde({ topic: '', blockSpan: 2 }),
      '2025-09-15|2-1': stunde({ topic: '', blockSpan: 2 }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  /* Der nächste Mittwoch mit zwei freien Plätzen am Stück ist der
     10.9. – der 3.9. ist die Stunde selbst. */
  assert.equal(plan.ok, true);
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-10');
  assert.equal(plan.bewegungen[0].nach.slotIndex, 1);
  assert.equal(plan.bewegungen[0].span, 2);
  const verschoben = wendeVerschiebungAn(db, plan);
  assert.equal(verschoben.weeks['2025-09-08'].lessons['2-1'].topic, 'Doppel');
  assert.equal(verschoben.weeks['2025-09-08'].lessons['2-1'].blockSpan, 2);
  assert.equal(verschoben.weeks['2025-09-08'].lessons['2-2'], undefined,
    'der Folgeplatz einer Doppelstunde trägt keinen eigenen Eintrag');
});

test('Ohne zwei freie Plätze am Stück wird eine Doppelstunde nicht gesetzt', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|2-1': stunde({ sequenceId: 's1', topic: 'Doppel', blockSpan: 2 }),
      // In der Zielwoche ist der zweite Platz von einer fremden Stunde belegt.
      '2025-09-08|2-1': stunde({ topic: 'Fremd A' }),
      '2025-09-08|2-2': stunde({ topic: 'Fremd B' }),
    },
    schoolYear: { startISO: '2025-08-01', endISO: '2025-09-12' },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  assert.equal(plan.ok, false);
  assert.equal(wendeVerschiebungAn(db, plan), null, 'ein Plan, der nicht aufgeht, ändert nichts');
});

test('Die Vorschau zeigt die Dauer und den Blockcharakter', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|2-1': stunde({ sequenceId: 's1', topic: 'Doppel', blockSpan: 2 }),
      '2025-09-08|2-1': stunde({ topic: '', blockSpan: 2 }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  assert.equal(plan.zeilen[0].dauer, 'Doppelstunde');
  assert.equal(plan.zeilen[0].span, 2);
});

/* ---- Konflikte --------------------------------------------------------- */

test('Belegte Termine werden übersprungen, nie überschrieben', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-22' },       // dort liegt eine fremde Planung
    heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.bewegungen[0].nach.dateISO, '2025-09-29');
  assert.equal(plan.uebersprungeneBelegt, 1);
  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-22'].lessons['0-2'].topic, 'Freie Planung');
});

test('Wer nicht überspringen will, bekommt einen gestoppten Plan', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-22' },
    heuteISO: heute,
    beiKonflikt: 'stoppen',
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.zeilen[0].status, STATUS.KONFLIKT);
  assert.ok(plan.fehler.some(f => f.code === 'konflikt'));
  assert.equal(wendeVerschiebungAn(db, plan), null);
});

test('Stunden anderer Sequenzen gelten als Konflikt', ()=>{
  const db = standardDb();
  db.sequences.s2 = { id: 's2', name: 'Andere Sequenz' };
  db.weeks['2025-09-22'].lessons['0-2'] = stunde({ sequenceId: 's2', topic: 'Fremde Sequenz' });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-22' },
    heuteISO: heute,
    beiKonflikt: 'stoppen',
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.zeilen[0].status, STATUS.KONFLIKT);
});

/* ---- Schuljahresgrenze -------------------------------------------------- */

test('Nach dem Ende des Schuljahres wird nichts angelegt', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'A' }),
      '2025-09-08|0-2': stunde({ sequenceId: 's1', topic: 'B' }),
    },
    schoolYear: { startISO: '2025-08-01', endISO: '2025-09-10' },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.zeilen.some(z => z.status === STATUS.AUSSERHALB));
  assert.ok(plan.fehler.some(f => f.code === 'schuljahr'));
  assert.equal(wendeVerschiebungAn(db, plan), null);
});

test('Vor dem Beginn des Schuljahres wird nichts angelegt', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-07-01' }, heuteISO: heute,
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.fehler.some(f => f.code === 'vorSchuljahr'));
});

/* ---- Vergangenes und Nachbereitetes ------------------------------------ */

test('Vergangene und nachbereitete Stunden bleiben liegen', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'Gehalten' }),
      '2025-09-08|0-2': stunde({
        sequenceId: 's1', topic: 'Nachbereitet',
        review: { status: 'reviewed', generalNotes: 'lief gut', phaseReviews: {}, carryOverItems: [], reviewedAt: '2025-09-08' },
      }),
      '2025-09-15|0-2': stunde({ sequenceId: 's1', topic: 'Kommt noch' }),
      '2025-09-22|0-2': stunde({ topic: '' }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-22' }, heuteISO: '2025-09-10',
  });
  const bleibende = plan.zeilen.filter(z => z.status === STATUS.BLEIBT);
  assert.equal(bleibende.length, 2);
  assert.equal(plan.bewegungen.length, 1);
  assert.equal(plan.bewegungen[0].von.dateISO, '2025-09-15');

  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, 'Gehalten');
  assert.equal(next.weeks['2025-09-08'].lessons['0-2'].topic, 'Nachbereitet');
  assert.equal(next.weeks['2025-09-22'].lessons['0-2'].topic, 'Kommt noch');
});

test('Auf Wunsch wandert auch Vergangenes mit', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-15' },
    heuteISO: '2025-09-30', auchVergangene: true,
  });
  assert.equal(plan.bewegungen.length >= 1, true);
});

test('Bleibt alles liegen, entsteht kein Vorschlag', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-29' }, heuteISO: '2025-12-01',
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.fehler.some(f => f.code === 'nichtsZuVerschieben'));
});

/* ---- Atomar ------------------------------------------------------------- */

test('Ein Plan wird ganz oder gar nicht ausgeführt', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  // Zwischenzeitlich ist die Quelle verschwunden: dann passiert nichts.
  const veraendert = JSON.parse(JSON.stringify(db));
  delete veraendert.weeks['2025-09-08'].lessons['0-2'];
  assert.equal(wendeVerschiebungAn(veraendert, plan), null);
  assert.ok(veraendert.weeks['2025-09-01'].lessons['0-2'], 'nichts wurde halb verschoben');
});

test('Die berührten Orte umfassen Quelle und Ziel', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-29' },
    heuteISO: heute,
  });
  const orte = betroffeneOrte(plan);
  assert.equal(orte.length, 2);
  assert.ok(orte.some(o => o.weekStart === '2025-09-01' && o.slotIndex === 2));
  assert.ok(orte.some(o => o.weekStart === '2025-09-29' && o.slotIndex === 2));
});

/* ---- Raum und Stundenplan ---------------------------------------------- */

test('Der Raum des Zielplatzes bleibt, der Planungsinhalt zieht um', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|0-2': stunde({ sequenceId: 's1', topic: 'A', room: 'A101' }),
      // Der Zielplatz ist mittwochs – dort unterrichtet die Gruppe in B202.
      '2025-09-01|2-1': stunde({ topic: 'Regulär', room: 'B202' }),
      '2025-09-08|2-1': stunde({ topic: '', room: 'B202' }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.GESAMT,
    ziel: { dateISO: '2025-09-10' },          // Mittwoch
    heuteISO: heute,
  });
  assert.equal(plan.ok, true);
  const next = wendeVerschiebungAn(db, plan);
  const verschoben = next.weeks['2025-09-08'].lessons['2-1'];
  assert.equal(verschoben.topic, 'A', 'der Inhalt zieht um');
  assert.equal(verschoben.room, 'B202', 'der Raum gehört zum Platz');
});

test('Ohne bekannten Raum am Ziel behält die Stunde ihren eigenen', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.EINZELN,
    ab: { weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 },
    ziel: { dateISO: '2025-09-29' },
    heuteISO: heute,
  });
  const next = wendeVerschiebungAn(db, plan);
  assert.equal(next.weeks['2025-09-29'].lessons['0-2'].room, 'A101');
});

test('Die Trennung von Platz und Planung verliert nichts', ()=>{
  const l = stunde({ topic: 'A', room: 'A101', notes: 'wichtig' });
  const platz = platzMerkmale(l);
  assert.deepEqual(platz, { room: 'A101' });
  const gesetzt = setzeAufPlatz(l, { room: 'C303' });
  assert.equal(gesetzt.room, 'C303');
  assert.equal(gesetzt.topic, 'A');
  assert.equal(gesetzt.notes, 'wichtig');
  assert.equal(setzeAufPlatz(l, { room: '' }).room, 'A101');
  assert.equal(raumFuerPlatz(standardDb(), '9b||französisch', 0, 2), 'A101');
});

/* ---- Undo und Versionsverlauf ------------------------------------------

   Eine Sammelverschiebung muss als EIN Vorgang zurückzunehmen sein.
   Geprüft wird deshalb das Zusammenspiel: aus den berührten Orten
   entsteht ein Eintrag, und dieser Eintrag stellt genau den Zustand von
   vorher wieder her – Quelle wie Ziel. */

test('Eine Sammelverschiebung lässt sich als ein Vorgang wiederherstellen', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  assert.equal(plan.ok, true);

  // So legt die App den Eintrag an: alle berührten Orte mit ihrem Stand VORHER.
  const teile = betroffeneOrte(plan).map(o => stundenTeil({
    weekStart: o.weekStart, dayIndex: o.dayIndex, slotIndex: o.slotIndex,
    stunde: db.weeks[o.weekStart]?.lessons?.[`${o.dayIndex}-${o.slotIndex}`] || null,
  }));
  const eintrag = erstelleEintrag({
    ausloeser: 'vorVerschieben', bereich: 'bulk', transaktion: 'tx-1', teile,
  }, { neueId: ()=> 'e-1' });

  const verschoben = wendeVerschiebungAn(db, plan);
  assert.equal(verschoben.weeks['2025-09-08'].lessons['0-2'].topic, 'Einstieg');

  const zurueck = wendeAn(verschoben, eintrag);
  for (const ws of ['2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22', '2025-09-29']) {
    assert.deepEqual(
      zurueck.weeks[ws].lessons['0-2'],
      db.weeks[ws].lessons['0-2'],
      `${ws} steht wieder wie vorher`,
    );
  }
});

test('Der Eintrag deckt Quelle und Ziel ab, auch bei Doppelstunden', ()=>{
  const db = datenbank({
    lessons: {
      '2025-09-01|2-1': stunde({ sequenceId: 's1', topic: 'Doppel', blockSpan: 2 }),
      '2025-09-08|2-1': stunde({ topic: '', blockSpan: 2 }),
    },
  });
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { dateISO: '2025-09-08' }, heuteISO: heute,
  });
  const orte = betroffeneOrte(plan);
  // Zwei Plätze an der Quelle, zwei am Ziel.
  assert.equal(orte.length, 4);
  assert.ok(orte.some(o => o.weekStart === '2025-09-01' && o.slotIndex === 2));
  assert.ok(orte.some(o => o.weekStart === '2025-09-08' && o.slotIndex === 2));
});

/* ---- Verknüpfte Jahresbalken -------------------------------------------- */

test('Verknüpfte Balken lassen sich optional an den neuen Zeitraum legen', ()=>{
  const db = standardDb();
  db.yearBars = [
    { id: 'b1', title: 'Passé composé', startISO: '2025-09-01', endISO: '2025-09-15', sequenceId: 's1' },
    { id: 'b2', title: 'Anderes', startISO: '2025-09-01', endISO: '2025-09-15' },
  ];
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  const anpassungen = balkenNachVerschiebung(db.yearBars, 's1', plan);
  assert.equal(anpassungen.length, 1, 'nur der verknüpfte Balken');
  assert.equal(anpassungen[0].id, 'b1');
  assert.equal(anpassungen[0].startISO, plan.vonISO);
  // Die Balken selbst werden dabei nicht verändert.
  assert.equal(db.yearBars[0].startISO, '2025-09-01');
});

test('Mehrere Balken auf derselben Sequenz ergeben je eine Anpassung, keine Mehrfachverschiebung', ()=>{
  const db = standardDb();
  db.yearBars = [
    { id: 'b1', title: 'A', startISO: '2025-09-01', endISO: '2025-09-15', sequenceId: 's1' },
    { id: 'b2', title: 'B', startISO: '2025-09-08', endISO: '2025-09-22', sequenceId: 's1' },
  ];
  const plan = planeVerschiebung(db, {
    sequenceId: 's1', umfang: UMFANG.GESAMT, ziel: { wochen: 1 }, heuteISO: heute,
  });
  assert.equal(plan.bewegungen.length, 3, 'die Sequenz wird genau einmal bewegt');
  assert.equal(balkenNachVerschiebung(db.yearBars, 's1', plan).length, 2);
});

/* ---- Kleinkram ---------------------------------------------------------- */

test('Datumsrechnung bleibt lokal und ohne Zeitzonensprung', ()=>{
  assert.equal(plusTage('2025-09-01', 7), '2025-09-08');
  assert.equal(plusTage('2025-12-31', 1), '2026-01-01');
  assert.equal(plusTage('2025-03-30', 1), '2025-03-31');
  assert.equal(plusTage('', 3), '');
});

test('Eine Stunde ausserhalb der Sequenz wird als solche benannt', ()=>{
  const db = standardDb();
  const plan = planeVerschiebung(db, {
    sequenceId: 's1',
    umfang: UMFANG.AB_FOLGENDE,
    ab: { weekStart: '2025-09-22', dayIndex: 0, slotIndex: 2 },   // freie Planung, nicht in s1
    ziel: { wochen: 1 },
    heuteISO: heute,
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.fehler.some(f => f.code === 'stundeNichtInSequenz'));
});

test('Ohne Ziel und ohne Sequenz entsteht ein sprechender Fehler', ()=>{
  const db = standardDb();
  assert.equal(planeVerschiebung(db, { sequenceId: 'gibtsnicht', umfang: UMFANG.GESAMT }).ok, false);
  const ohneZiel = planeVerschiebung(db, { sequenceId: 's1', umfang: UMFANG.GESAMT, heuteISO: heute });
  assert.equal(ohneZiel.ok, false);
  assert.ok(ohneZiel.fehler.some(f => f.code === 'keinZiel'));
});
