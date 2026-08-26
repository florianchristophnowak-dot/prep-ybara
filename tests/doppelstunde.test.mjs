/* ============================================================
   Doppelstunden

   Geprüft wird das Modell, nicht die Oberfläche: welche Stundenplätze
   eine Stunde belegt, wem ein Platz gehört, wann sich zwei Stunden
   verbinden lassen und wie ein durchgehender Verlaufsplan wieder auf
   einzelne Stunden fällt.

   Der Leitgedanke steht in jedem zweiten Test: eine Stunde OHNE Angabe
   ist eine Einzelstunde. Alles, was vor dieser Fassung gespeichert
   wurde, muss sich unverändert verhalten.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SLOT_MIN, MAX_BLOCK_SPAN,
  normalisiereBlockSpan, blockSpanOf, lessonTotalMin, lessonKey, belegteSlots,
  blockOwnerAt, istAbgedeckt, stundenBereichLabel, blockName, passenZusammen,
  verteilePhasenAufPlaetze,
} from '../renderer/src/doppelstunde.js';

/* ---- Die Spanne ------------------------------------------------------ */

test('Eine Stunde ohne Angabe ist eine Einzelstunde', ()=>{
  assert.equal(blockSpanOf({}), 1);
  assert.equal(blockSpanOf(null), 1);
  assert.equal(blockSpanOf({ topic: 'Alt gespeichert' }), 1);
  assert.equal(lessonTotalMin({}), SLOT_MIN);
});

test('Unsinnige Angaben fallen auf eine gültige Spanne zurück', ()=>{
  assert.equal(normalisiereBlockSpan(0), 1);
  assert.equal(normalisiereBlockSpan(-3), 1);
  assert.equal(normalisiereBlockSpan('zwei'), 1);
  assert.equal(normalisiereBlockSpan(undefined), 1);
  assert.equal(normalisiereBlockSpan(99), MAX_BLOCK_SPAN);
  assert.equal(normalisiereBlockSpan('2'), 2);
  assert.equal(normalisiereBlockSpan(2.4), 2);
});

test('Eine Doppelstunde hat 90 Minuten am Stück', ()=>{
  assert.equal(lessonTotalMin({ blockSpan: 2 }), 90);
  assert.equal(lessonTotalMin({ blockSpan: 3 }), 135);
});

test('Belegt werden die Plätze ab dem eigenen', ()=>{
  assert.deepEqual(belegteSlots(2, 1), [2]);
  assert.deepEqual(belegteSlots(2, 2), [2, 3]);
  assert.deepEqual(belegteSlots(0, 3), [0, 1, 2]);
});

/* ---- Wem gehört ein Platz? ------------------------------------------- */

const woche = (eintraege)=>({ slotsPerDay: 6, lessons: eintraege, duties: {} });

test('Ein leerer Platz gehört niemandem', ()=>{
  assert.equal(blockOwnerAt(woche({}), 0, 3), null);
  assert.equal(istAbgedeckt(woche({}), 0, 3), false);
});

test('Ein Platz mit eigener Stunde gehört sich selbst', ()=>{
  const w = woche({ [lessonKey(0, 2)]: { topic: 'A' } });
  const o = blockOwnerAt(w, 0, 2);
  assert.equal(o.slotIndex, 2);
  assert.equal(o.covered, false);
  assert.equal(istAbgedeckt(w, 0, 2), false);
});

test('Eine Doppelstunde deckt den folgenden Platz ab', ()=>{
  const w = woche({ [lessonKey(0, 2)]: { topic: 'A', blockSpan: 2 } });
  const o = blockOwnerAt(w, 0, 3);
  assert.equal(o.slotIndex, 2);
  assert.equal(o.covered, true);
  assert.equal(o.lesson.topic, 'A');
  assert.equal(istAbgedeckt(w, 0, 3), true);
  // Aber nicht weiter als ihre Spanne.
  assert.equal(istAbgedeckt(w, 0, 4), false);
  // Und nicht an einem anderen Tag.
  assert.equal(istAbgedeckt(w, 1, 3), false);
});

test('Eine Einzelstunde davor deckt nichts ab', ()=>{
  const w = woche({ [lessonKey(0, 2)]: { topic: 'A' } });
  assert.equal(istAbgedeckt(w, 0, 3), false);
});

/* ---- Verbinden erlaubt? ---------------------------------------------- */

test('Verbinden nur bei derselben Lerngruppe', ()=>{
  const a = { classGroup: '8a', subject: 'Französisch' };
  assert.equal(passenZusammen(a, { classGroup: '8a', subject: 'Französisch' }), true);
  // Gross-/Kleinschreibung und Leerzeichen sind kein Unterschied.
  assert.equal(passenZusammen(a, { classGroup: ' 8A ', subject: 'französisch' }), true);
  assert.equal(passenZusammen(a, { classGroup: '8b', subject: 'Französisch' }), false);
  assert.equal(passenZusammen(a, { classGroup: '8a', subject: 'Deutsch' }), false);
  assert.equal(passenZusammen(a, null), false);
});

/* ---- Beschriftung ---------------------------------------------------- */

test('Die Beschriftung nennt beide Stundenplätze', ()=>{
  assert.equal(stundenBereichLabel(2, 1), '3. Stunde');
  assert.equal(stundenBereichLabel(2, 2), '3.–4. Stunde');
  assert.equal(stundenBereichLabel(0, 3), '1.–3. Stunde');
  assert.equal(blockName(1), 'Einzelstunde');
  assert.equal(blockName(2), 'Doppelstunde');
});

/* ---- Trennen: der Verlaufsplan fällt auseinander --------------------- */

test('Phasen bis zur Stundengrenze bleiben im ersten Teil', ()=>{
  const phasen = [
    { id: 'a', title: 'Einstieg', duration: 15 },
    { id: 'b', title: 'Arbeit', duration: 30 },
    { id: 'c', title: 'Sicherung', duration: 45 },
  ];
  const [erste, zweite] = verteilePhasenAufPlaetze(phasen, 2);
  assert.deepEqual(erste.map(p => p.title), ['Einstieg', 'Arbeit']);
  assert.deepEqual(zweite.map(p => p.title), ['Sicherung']);
  assert.equal(erste.reduce((a,p)=>a+p.duration, 0), 45);
  assert.equal(zweite.reduce((a,p)=>a+p.duration, 0), 45);
});

test('Eine Phase über die Grenze wird an der Grenze geteilt', ()=>{
  const phasen = [
    { id: 'a', title: 'Einstieg', duration: 20, content: 'Bild' },
    { id: 'b', title: 'Gruppenarbeit', duration: 50, content: 'Plakat' },
    { id: 'c', title: 'Präsentation', duration: 20 },
  ];
  const [erste, zweite] = verteilePhasenAufPlaetze(phasen, 2);
  assert.deepEqual(erste.map(p => [p.title, p.duration]), [['Einstieg', 20], ['Gruppenarbeit', 25]]);
  assert.deepEqual(zweite.map(p => [p.title, p.duration]), [['Gruppenarbeit', 25], ['Präsentation', 20]]);
  // Die Angaben der geteilten Phase stehen in beiden Teilen.
  assert.equal(erste[1].content, 'Plakat');
  assert.equal(zweite[0].content, 'Plakat');
});

test('Beim Trennen geht keine Minute verloren', ()=>{
  const phasen = [
    { id: 'a', duration: 7 },
    { id: 'b', duration: 61 },
    { id: 'c', duration: 22 },
  ];
  const teile = verteilePhasenAufPlaetze(phasen, 2);
  const summe = teile.flat().reduce((a,p)=>a+p.duration, 0);
  assert.equal(summe, 90);
  assert.equal(teile.length, 2);
});

test('Eine Einzelstunde bleibt beim Verteilen unverändert', ()=>{
  const phasen = [{ id: 'a', duration: 20 }, { id: 'b', duration: 25 }];
  const teile = verteilePhasenAufPlaetze(phasen, 1);
  assert.equal(teile.length, 1);
  assert.deepEqual(teile[0].map(p => p.duration), [20, 25]);
});

test('Neue Kennungen werden vergeben, wenn eine gefragt ist', ()=>{
  let n = 0;
  const teile = verteilePhasenAufPlaetze([{ id: 'alt', duration: 90 }], 2, ()=>`neu-${++n}`);
  const ids = teile.flat().map(p => p.id);
  assert.deepEqual(ids, ['neu-1', 'neu-2']);
});
