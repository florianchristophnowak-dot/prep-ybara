/* ============================================================
   Jahresbalken und Sequenzen

   Die Jahresgrobplanung bleibt unabhängig nutzbar – das ist die
   wichtigste Eigenschaft dieser Erweiterung, und die meisten Prüfungen
   hier drehen sich darum:

     - Ein Balken ohne Verknüpfung verhält sich exakt wie zuvor.
     - Löschen einer Sequenz erhält den Balken.
     - Löschen eines Balkens rührt die Sequenz nicht an.
     - Umbenennen einer Sequenz ist am Balken sofort sichtbar, weil dort
       nur die Kennung steht.
     - Mehrere Balken dürfen auf dieselbe Sequenz zeigen, ohne dass
       daraus eine Mehrfachverschiebung würde.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  balkenSequenz, balkenSequenzId, istVerknuepft, istVerwaist,
  sequenzGruppen, passtZuBalken, auswahlSequenzen, sequenzInfo,
  zeitraumAusSequenz, setzeVerknuepfung, loeseVerknuepfung,
  entferneSequenzAusBalken, balkenZuSequenz, balkenBeschriftung,
} from '../renderer/src/jahresbalken.js';

const stunde = (patch = {})=>({
  subject: 'Französisch', classGroup: '9b', topic: '', phases: [], blockSpan: 1, ...patch,
});

function daten(){
  return {
    sequences: {
      s1: { id: 's1', name: 'Le passé composé', color: '#4f6ef7' },
      s2: { id: 's2', name: 'Mathe: Brüche', color: '#f59e0b' },
      s3: { id: 's3', name: 'Ohne Stunden', color: '#10b981' },
    },
    weeks: {
      '2025-09-01': {
        slotsPerDay: 6,
        lessons: {
          '0-2': stunde({ sequenceId: 's1', topic: 'Einstieg' }),
          '2-1': stunde({ sequenceId: 's1', topic: 'Übung', blockSpan: 2 }),
          '3-0': stunde({ sequenceId: 's2', classGroup: '7a', subject: 'Mathematik' }),
        },
        duties: {},
      },
      '2025-09-08': {
        slotsPerDay: 6,
        lessons: { '0-2': stunde({ sequenceId: 's1', topic: 'Vertiefung' }) },
        duties: {},
      },
    },
    yearBars: [
      { id: 'b1', title: 'Passé composé', classGroup: '9b', subject: 'Französisch', startISO: '2025-09-01', endISO: '2025-09-29', sequenceId: 's1' },
      { id: 'b2', title: 'Klassenfahrt', classGroup: '', subject: '', startISO: '2025-10-06', endISO: '2025-10-10' },
      { id: 'b3', title: 'Auch Passé composé', classGroup: '9b', subject: 'Französisch', startISO: '2025-09-08', endISO: '2025-09-22', sequenceId: 's1' },
    ],
  };
}

/* ---- Balken ohne Verknüpfung ----------------------------------------- */

test('Ein Balken ohne sequenceId ist unverknüpft – wie jeder alte Balken', ()=>{
  const db = daten();
  const alt = { id: 'x', title: 'Alt gespeichert', startISO: '2025-09-01', endISO: '2025-09-08' };
  assert.equal(balkenSequenzId(alt), '');
  assert.equal(balkenSequenz(alt, db.sequences), null);
  assert.equal(istVerknuepft(alt, db.sequences), false);
  assert.equal(istVerwaist(alt, db.sequences), false);
  assert.equal(balkenBeschriftung(db, alt), null);
});

test('Ein verknüpfter Balken findet seine Sequenz', ()=>{
  const db = daten();
  const b = db.yearBars[0];
  assert.equal(balkenSequenz(b, db.sequences)?.name, 'Le passé composé');
  assert.equal(istVerknuepft(b, db.sequences), true);
});

/* ---- Verknüpfen und Lösen --------------------------------------------- */

test('Verknüpfen ändert nur den Balken', ()=>{
  const db = daten();
  const vorher = JSON.stringify(db.sequences);
  const bars = setzeVerknuepfung(db.yearBars, 'b2', 's2');
  assert.equal(balkenSequenzId(bars.find(b => b.id === 'b2')), 's2');
  // Titel, Zeitraum und die anderen Balken bleiben, wie sie waren.
  const b2 = bars.find(b => b.id === 'b2');
  assert.equal(b2.title, 'Klassenfahrt');
  assert.equal(b2.startISO, '2025-10-06');
  assert.equal(balkenSequenzId(bars.find(b => b.id === 'b1')), 's1');
  assert.equal(JSON.stringify(db.sequences), vorher);
});

test('Lösen entfernt nur die Verbindung', ()=>{
  const db = daten();
  const bars = loeseVerknuepfung(db.yearBars, 'b1');
  const b1 = bars.find(b => b.id === 'b1');
  assert.equal(balkenSequenzId(b1), '');
  assert.equal(b1.title, 'Passé composé');
  assert.equal(b1.startISO, '2025-09-01');
  assert.ok(db.sequences.s1, 'die Sequenz bleibt');
});

test('Die Ausgangsliste wird beim Verknüpfen nicht verändert', ()=>{
  const db = daten();
  const vorher = JSON.stringify(db.yearBars);
  setzeVerknuepfung(db.yearBars, 'b2', 's1');
  assert.equal(JSON.stringify(db.yearBars), vorher);
});

/* ---- Umbenennen ------------------------------------------------------- */

test('Wird die Sequenz umbenannt, steht am Balken sofort der neue Name', ()=>{
  const db = daten();
  assert.equal(balkenBeschriftung(db, db.yearBars[0]).name, 'Le passé composé');
  db.sequences.s1.name = 'Le passé composé (neu)';
  assert.equal(balkenBeschriftung(db, db.yearBars[0]).name, 'Le passé composé (neu)');
});

/* ---- Löschen ---------------------------------------------------------- */

test('Das Löschen einer Sequenz erhält den Balken und entfernt nur die Verknüpfung', ()=>{
  const db = daten();
  delete db.sequences.s1;
  const bars = entferneSequenzAusBalken(db.yearBars, 's1');
  assert.equal(bars.length, 3, 'kein Balken verschwindet');
  assert.equal(bars.find(b => b.id === 'b1').title, 'Passé composé');
  assert.equal(balkenSequenzId(bars.find(b => b.id === 'b1')), '');
  assert.equal(balkenSequenzId(bars.find(b => b.id === 'b3')), '');
  assert.equal(bars.find(b => b.id === 'b2').title, 'Klassenfahrt');
});

test('Zeigt ein Balken auf eine gelöschte Sequenz, gilt er als verwaist – nicht als kaputt', ()=>{
  const db = daten();
  delete db.sequences.s1;
  const b = db.yearBars[0];
  assert.equal(istVerknuepft(b, db.sequences), false);
  assert.equal(istVerwaist(b, db.sequences), true);
  assert.equal(balkenBeschriftung(db, b), null);
});

test('Das Löschen eines Balkens lässt die Sequenz unberührt', ()=>{
  const db = daten();
  const bars = db.yearBars.filter(b => b.id !== 'b1');
  assert.equal(bars.length, 2);
  assert.ok(db.sequences.s1);
  // Und ihre Stunden ebenfalls.
  assert.equal(db.weeks['2025-09-01'].lessons['0-2'].sequenceId, 's1');
});

/* ---- Mehrere Balken auf derselben Sequenz ----------------------------- */

test('Mehrere Balken dürfen dieselbe Sequenz referenzieren', ()=>{
  const db = daten();
  const bars = balkenZuSequenz(db.yearBars, 's1');
  assert.deepEqual(bars.map(b => b.id), ['b1', 'b3']);
  // Die Sequenz selbst weiss davon nichts – daraus kann keine
  // mehrfache Verschiebung entstehen.
  assert.equal('yearBarId' in db.sequences.s1, false);
});

/* ---- Angaben am Balken ------------------------------------------------ */

test('Der Umfang der Sequenz wird gerechnet, nicht gespeichert', ()=>{
  const db = daten();
  const info = sequenzInfo(db, 's1');
  assert.equal(info.termine, 3);
  assert.equal(info.stunden, 4, 'eine Doppelstunde zählt zwei Stundenplätze');
  assert.equal(info.vonISO, '2025-09-01');
  assert.equal(info.bisISO, '2025-09-08');
  const b = balkenBeschriftung(db, db.yearBars[0]);
  assert.match(b.umfang, /3 Termine/);
  assert.match(b.umfang, /4 Stunden/);
});

test('Ohne Termine gibt es keinen Zeitraum zu übernehmen', ()=>{
  const db = daten();
  assert.equal(zeitraumAusSequenz(db, 's3'), null);
  const zeitraum = zeitraumAusSequenz(db, 's1');
  assert.deepEqual(zeitraum, { startISO: '2025-09-01', endISO: '2025-09-08' });
});

/* ---- Passende Sequenzen ----------------------------------------------- */

test('Die Lerngruppe einer Sequenz ergibt sich aus ihren Stunden', ()=>{
  const db = daten();
  assert.deepEqual(sequenzGruppen(db, 's1'), [{ classGroup: '9b', subject: 'Französisch', anzahl: 3 }]);
  assert.deepEqual(sequenzGruppen(db, 's3'), []);
});

test('Passend ist, was zur Lerngruppe des Balkens gehört', ()=>{
  const db = daten();
  assert.equal(passtZuBalken(db, 's1', { classGroup: '9b', subject: 'Französisch' }), true);
  assert.equal(passtZuBalken(db, 's2', { classGroup: '9b', subject: 'Französisch' }), false);
  // Eine Sequenz ohne Stunden passt überall – über sie ist nichts bekannt.
  assert.equal(passtZuBalken(db, 's3', { classGroup: '9b', subject: 'Französisch' }), true);
  // Ein Balken ohne Angaben schliesst nichts aus.
  assert.equal(passtZuBalken(db, 's2', { classGroup: '', subject: '' }), true);
});

test('Die Auswahl zeigt passende Sequenzen zuerst, versteckt aber keine', ()=>{
  const db = daten();
  const liste = auswahlSequenzen(db, { classGroup: '9b', subject: 'Französisch' });
  assert.equal(liste.length, 3, 'keine Sequenz verschwindet aus der Auswahl');
  assert.equal(liste[liste.length - 1].id, 's2', 'die unpassende steht hinten');
  assert.equal(liste.find(x => x.id === 's2').passt, false);
  assert.equal(liste.find(x => x.id === 's1').passt, true);
});
