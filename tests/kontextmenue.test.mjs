/* ============================================================
   Wohin ein aufgeklapptes ⋯-Menü gehört

   Anlass ist ein handfester Fehler gewesen: In der Jahresgrobplanung
   sass der Knopf in einem rollenden Band und in einer 48 px hohen
   Zeile – das Menü wurde abgeschnitten, und mit ihm der Eintrag
   "Löschen". Ein Balken liess sich deshalb nicht mehr entfernen.

   Die Zusage, die hier geprüft wird, ist einfach: Das Menü bleibt
   IMMER im Fenster. Lieber klappt es nach oben, lieber rollt es in
   sich selbst – aber es tritt nie über den Rand.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { menuePosition, RAND, ABSTAND, BREITE_SCHAETZUNG } from '../renderer/src/kontextmenue.js';

const fenster = { breite: 1280, hoehe: 800 };
const knopf = (top, left, { breite = 32, hoehe = 32 } = {})=>({
  top, left, bottom: top + hoehe, right: left + breite,
});

test('der Normalfall: unter dem Knopf, rechtsbündig', ()=>{
  const k = knopf(200, 600);
  const p = menuePosition(k, { breite: 236, hoehe: 180 }, 'rechts', fenster);
  assert.equal(p.oben, k.bottom + ABSTAND);
  assert.equal(p.links, k.right - 236);
  assert.equal(p.richtung, 'unten');
});

test('linksbündig richtet sich an der linken Kante des Knopfes aus', ()=>{
  const k = knopf(200, 600);
  const p = menuePosition(k, { breite: 236, hoehe: 180 }, 'links', fenster);
  assert.equal(p.links, k.left);
});

test('unten kein Platz mehr: das Menü klappt nach oben', ()=>{
  const k = knopf(700, 600);                       // dicht über der Fensterkante
  const p = menuePosition(k, { breite: 236, hoehe: 300 }, 'rechts', fenster);
  assert.equal(p.richtung, 'oben');
  assert.equal(p.oben, k.top - ABSTAND - 300);
  assert.ok(p.oben >= RAND);
});

test('weder oben noch unten genug Platz: eigene Höhe statt Überlauf', ()=>{
  const eng = { breite: 1280, hoehe: 320 };
  const k = knopf(150, 600);
  const p = menuePosition(k, { breite: 236, hoehe: 600 }, 'rechts', eng);
  // Es bleibt im Fenster – und bekommt eine Höhe, in der es rollen kann.
  assert.ok(p.oben >= RAND);
  assert.ok(p.oben + p.maxHoehe <= eng.hoehe);
  assert.ok(p.maxHoehe > 0);
});

test('am rechten Fensterrand wird das Menü hineingeschoben', ()=>{
  const k = knopf(200, fenster.breite - 20);       // Knopf klebt am Rand
  const p = menuePosition(k, { breite: 236, hoehe: 180 }, 'rechts', fenster);
  assert.ok(p.links + 236 <= fenster.breite - RAND);
});

test('am linken Fensterrand ebenso', ()=>{
  const k = knopf(200, 2);
  const p = menuePosition(k, { breite: 236, hoehe: 180 }, 'links', fenster);
  assert.ok(p.links >= RAND);
});

test('schmales Fenster: der linke Rand gewinnt – dort beginnt der Text', ()=>{
  const schmal = { breite: 200, hoehe: 800 };
  const k = knopf(200, 150);
  const p = menuePosition(k, { breite: 236, hoehe: 180 }, 'rechts', schmal);
  assert.equal(p.links, RAND);
});

test('vor der ersten Messung wird mit der Mindestbreite gerechnet', ()=>{
  const k = knopf(200, 600);
  const p = menuePosition(k, null, 'rechts', fenster);
  assert.equal(p.links, k.right - BREITE_SCHAETZUNG);
  assert.equal(p.oben, k.bottom + ABSTAND);
});

/* Der Fall, um den es eigentlich geht: ein Balken der Jahresgrobplanung.
   Die Zeile ist 48 px hoch, das Band rollt waagerecht – und trotzdem
   muss das ganze Menü sichtbar sein. */
test('Jahresbalken weit unten im Fenster: das Menü bleibt vollständig sichtbar', ()=>{
  const k = knopf(742, 300, { breite: 32, hoehe: 32 });   // Balken am unteren Bildrand
  const p = menuePosition(k, { breite: 236, hoehe: 260 }, 'rechts', fenster);
  assert.ok(p.oben >= RAND, 'nicht über den oberen Rand');
  assert.ok(p.oben + Math.min(260, p.maxHoehe) <= fenster.hoehe - RAND + 1, 'nicht über den unteren Rand');
});

test('fehlende Angaben ergeben trotzdem eine brauchbare Lage', ()=>{
  const p = menuePosition(null, null, undefined, undefined);
  assert.ok(Number.isFinite(p.links));
  assert.ok(Number.isFinite(p.oben));
  assert.ok(p.links >= RAND);
});
