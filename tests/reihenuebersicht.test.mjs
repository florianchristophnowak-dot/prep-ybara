/* ============================================================
   Reihenübersicht

   Geprüft wird das Modell, nicht die Oberfläche: welche Darstellung
   eine Sequenz bekommt, was in einer Zeile steht, woher der zentrale
   Kompetenzzuwachs stammt und wie sich der Umfang einer Reihe summiert.

   Der Leitgedanke steht in jedem zweiten Test: eine Sequenz OHNE
   Entscheidung und eine Stunde OHNE das neue Feld müssen sich
   unverändert verhalten. Alles, was vor dieser Fassung gespeichert
   wurde, bleibt gültig.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DARSTELLUNGEN, DARSTELLUNG_REIHE, DARSTELLUNG_SPRACHLICH,
  normalisiereDarstellung, darstellungDerSequenz, darstellungName,
  minutenDerStunde, minutenLabel, datumLabel,
  kompetenzzuwachs, zuwachsQuelleName,
  reihenZeilen, reihenSumme, reihenSummeLabel, alsUnterrichtsstunden,
} from '../renderer/src/reihenuebersicht.js';

const stunde = (patch = {})=>({
  subject: 'Politik', classGroup: 'FS23', topic: '', objectives: '',
  primaryCompetency: '', competencies: [], progressionNote: '', blockSpan: 1,
  ...patch,
});

/* Ein Vorkommen, wie sequenceOccurrences() es liefert. */
const vorkommen = (dateISO, lesson, patch = {})=>({
  weekStart: '2026-09-07', dayIndex: 0, slotIndex: 2, dateISO, lesson, ...patch,
});

/* ---- Die beiden Darstellungen ---------------------------------------- */

test('Es gibt genau zwei Darstellungen, beide mit Namen', ()=>{
  assert.equal(DARSTELLUNGEN.length, 2);
  assert.equal(darstellungName(DARSTELLUNG_SPRACHLICH), 'Sprachliche Progression');
  assert.equal(darstellungName(DARSTELLUNG_REIHE), 'Reihenübersicht');
  assert.equal(darstellungName('gibt-es-nicht'), '');
});

test('Eine unbekannte Angabe ist keine Angabe', ()=>{
  assert.equal(normalisiereDarstellung('reihe'), DARSTELLUNG_REIHE);
  assert.equal(normalisiereDarstellung('  reihe  '), DARSTELLUNG_REIHE);
  assert.equal(normalisiereDarstellung('sprachhandlung'), DARSTELLUNG_SPRACHLICH);
  assert.equal(normalisiereDarstellung('irgendwas'), '');
  assert.equal(normalisiereDarstellung(null), '');
  assert.equal(normalisiereDarstellung(undefined), '');
});

test('Eine Sequenz aus einer früheren Fassung bleibt bei der sprachlichen Progression', ()=>{
  const alt = { id: 's1', name: 'Le passé composé' };
  assert.equal(darstellungDerSequenz(alt, { languageMode: true }), DARSTELLUNG_SPRACHLICH);
});

test('Ohne Fremdsprachenmodus ist die Reihenübersicht die Voreinstellung', ()=>{
  const alt = { id: 's1', name: 'Lernfeld 3' };
  assert.equal(darstellungDerSequenz(alt, { languageMode: false }), DARSTELLUNG_REIHE);
});

test('Die Wahl der Lehrkraft geht der Voreinstellung immer vor', ()=>{
  const reihe = { id: 's1', progressionLayout: DARSTELLUNG_REIHE };
  const sprache = { id: 's2', progressionLayout: DARSTELLUNG_SPRACHLICH };
  assert.equal(darstellungDerSequenz(reihe, { languageMode: true }), DARSTELLUNG_REIHE);
  assert.equal(darstellungDerSequenz(sprache, { languageMode: false }), DARSTELLUNG_SPRACHLICH);
});

test('Eine kaputte Angabe fällt auf die Voreinstellung zurück, nicht auf einen Fehler', ()=>{
  const kaputt = { id: 's1', progressionLayout: 'tabelle' };
  assert.equal(darstellungDerSequenz(kaputt, { languageMode: true }), DARSTELLUNG_SPRACHLICH);
  assert.equal(darstellungDerSequenz(kaputt, { languageMode: false }), DARSTELLUNG_REIHE);
  assert.equal(darstellungDerSequenz(null, { languageMode: false }), DARSTELLUNG_REIHE);
});

/* ---- Datum und Minuten ------------------------------------------------ */

test('Die Minuten sind der Zeitrahmen der Stunde, nicht die Summe der Phasen', ()=>{
  assert.equal(minutenDerStunde(stunde()), 45);
  assert.equal(minutenDerStunde(stunde({ blockSpan: 2 })), 90);
  assert.equal(minutenDerStunde(stunde({ blockSpan: 3 })), 135);
  // Eine Stunde ohne Angabe ist eine Einzelstunde.
  assert.equal(minutenDerStunde({}), 45);
});

test('Datum und Minuten stehen in einer Angabe', ()=>{
  assert.equal(minutenLabel(90), '90 Min.');
  assert.equal(datumLabel('2026-09-11', 90), 'Fr, 11.09.2026 (90 Min.)');
  // Ohne Datum bleiben die Minuten allein stehen.
  assert.equal(datumLabel('', 45), '45 Min.');
});

/* ---- Zentraler Kompetenzzuwachs --------------------------------------- */

test('Der eingetragene Kompetenzzuwachs gilt als eigene Aussage', ()=>{
  const z = kompetenzzuwachs(stunde({
    competencyGain: 'Die Lernenden begründen eine Kaufentscheidung.',
    objectives: 'Etwas anderes',
    primaryCompetency: 'Sprechen',
  }));
  assert.deepEqual(z, { text: 'Die Lernenden begründen eine Kaufentscheidung.', quelle: 'eigen' });
  assert.equal(zuwachsQuelleName('eigen'), '');
});

test('Ohne eigenen Eintrag tritt das Lernziel an seine Stelle – kenntlich gemacht', ()=>{
  const z = kompetenzzuwachs(stunde({
    objectives: 'Die Lernenden vergleichen Angebote.\nZweite Zeile',
    primaryCompetency: 'Lesen',
  }));
  assert.deepEqual(z, { text: 'Die Lernenden vergleichen Angebote.', quelle: 'lernziel' });
  assert.equal(zuwachsQuelleName('lernziel'), 'aus dem Lernziel');
});

test('Ohne Lernziel tritt die Schwerpunktkompetenz an seine Stelle', ()=>{
  assert.deepEqual(
    kompetenzzuwachs(stunde({ primaryCompetency: 'Lesen', competencies: ['Lesen', 'Schreiben'] })),
    { text: 'Lesen', quelle: 'kompetenz' });
  // Ohne Schwerpunkt reicht die erste Kompetenz.
  assert.deepEqual(
    kompetenzzuwachs(stunde({ competencies: ['Schreiben'] })),
    { text: 'Schreiben', quelle: 'kompetenz' });
});

test('Eine Stunde ohne jede Angabe erfindet nichts', ()=>{
  assert.deepEqual(kompetenzzuwachs(stunde()), { text: '', quelle: '' });
  assert.deepEqual(kompetenzzuwachs({}), { text: '', quelle: '' });
  assert.deepEqual(kompetenzzuwachs(null), { text: '', quelle: '' });
});

/* ---- Die Zeilen -------------------------------------------------------- */

test('Eine Zeile führt die vier Spalten und behält den Weg zur Stunde', ()=>{
  const [z] = reihenZeilen([
    vorkommen('2026-09-11', stunde({
      topic: 'Kaufvertrag: Rechte bei Mängeln',
      competencyGain: 'Die Lernenden prüfen Mängelansprüche.',
      progressionNote: 'Erarbeitung – legt die Grundlage für die Fallbearbeitung.',
      blockSpan: 2,
    }), { dayIndex: 4, slotIndex: 1 }),
  ]);

  assert.equal(z.nummer, 1);
  assert.equal(z.datum, 'Fr, 11.09.2026');
  assert.equal(z.minuten, 90);
  assert.equal(z.spanne, 2);
  assert.equal(z.thema, 'Kaufvertrag: Rechte bei Mängeln');
  assert.equal(z.zuwachs.text, 'Die Lernenden prüfen Mängelansprüche.');
  assert.equal(z.zuwachs.quelle, 'eigen');
  assert.equal(z.funktion, 'Erarbeitung – legt die Grundlage für die Fallbearbeitung.');
  // Der Weg zurück in die Stunde bleibt vollständig.
  assert.equal(z.weekStart, '2026-09-07');
  assert.equal(z.dayIndex, 4);
  assert.equal(z.slotIndex, 1);
  assert.equal(z.key, '2026-09-07#4-1');
});

test('Die Funktion in der Progression IST die Progressionsnotiz', ()=>{
  /* Beide Darstellungen schreiben in dasselbe Feld – wer wechselt,
     verliert nichts. */
  const [z] = reihenZeilen([vorkommen('2026-09-11', stunde({ progressionNote: 'Hinführung' }))]);
  assert.equal(z.funktion, 'Hinführung');
});

test('Im Eingabefeld steht nur, was wirklich im Feld steht', ()=>{
  /* Eine geliehene Angabe dort anzuzeigen hiesse, sie beim nächsten
     Speichern zur eigenen Aussage zu machen. */
  const [z] = reihenZeilen([vorkommen('2026-09-11', stunde({ objectives: 'Geliehen' }))]);
  assert.equal(z.zuwachs.text, 'Geliehen');
  assert.equal(z.zuwachs.quelle, 'lernziel');
  assert.equal(z.eigenerZuwachs, '');
});

test('Die Reihenfolge der Vorkommen wird übernommen und durchnummeriert', ()=>{
  const zeilen = reihenZeilen([
    vorkommen('2026-09-07', stunde({ topic: 'Erste' })),
    vorkommen('2026-09-09', stunde({ topic: 'Zweite' }), { dayIndex: 2 }),
    vorkommen('2026-09-11', stunde({ topic: 'Dritte' }), { dayIndex: 4 }),
  ]);
  assert.deepEqual(zeilen.map(z => z.nummer), [1, 2, 3]);
  assert.deepEqual(zeilen.map(z => z.thema), ['Erste', 'Zweite', 'Dritte']);
});

test('Ohne Stunden entsteht keine Zeile – und kein Fehler', ()=>{
  assert.deepEqual(reihenZeilen([]), []);
  assert.deepEqual(reihenZeilen(null), []);
  assert.deepEqual(reihenZeilen(undefined), []);
});

test('Eine Stunde aus einer früheren Fassung trägt eine gültige Zeile', ()=>{
  /* Kein competencyGain, kein blockSpan – nichts davon darf werfen. */
  const [z] = reihenZeilen([vorkommen('2026-09-11', { topic: 'Alt gespeichert' })]);
  assert.equal(z.thema, 'Alt gespeichert');
  assert.equal(z.minuten, 45);
  assert.equal(z.spanne, 1);
  assert.equal(z.eigenerZuwachs, '');
  assert.deepEqual(z.zuwachs, { text: '', quelle: '' });
});

/* ---- Umfang der Reihe -------------------------------------------------- */

test('Der Umfang zählt Termine, Unterrichtsstunden und Minuten', ()=>{
  const zeilen = reihenZeilen([
    vorkommen('2026-09-07', stunde({ blockSpan: 2 })),
    vorkommen('2026-09-09', stunde(), { dayIndex: 2 }),
    vorkommen('2026-09-11', stunde({ blockSpan: 2 }), { dayIndex: 4 }),
  ]);
  assert.deepEqual(reihenSumme(zeilen), { termine: 3, unterrichtsstunden: 5, minuten: 225 });
  assert.equal(alsUnterrichtsstunden(225), 5);
});

test('Ohne Doppelstunden steht die Zahl nur einmal da', ()=>{
  const label = reihenSummeLabel({ termine: 4, unterrichtsstunden: 4, minuten: 180 });
  assert.equal(label, '4 Termine · 180 Minuten');
});

test('Mit Doppelstunden stehen beide Zahlen da', ()=>{
  const label = reihenSummeLabel({ termine: 3, unterrichtsstunden: 5, minuten: 225 });
  assert.equal(label, '3 Termine · 5 Unterrichtsstunden · 225 Minuten');
});

test('Eine einzelne Stunde wird nicht in den Plural gesetzt', ()=>{
  assert.equal(reihenSummeLabel({ termine: 1, unterrichtsstunden: 2, minuten: 90 }),
    '1 Termin · 2 Unterrichtsstunden · 90 Minuten');
});

test('Eine leere Reihe summiert auf null, nicht auf NaN', ()=>{
  assert.deepEqual(reihenSumme([]), { termine: 0, unterrichtsstunden: 0, minuten: 0 });
  assert.deepEqual(reihenSumme(null), { termine: 0, unterrichtsstunden: 0, minuten: 0 });
  assert.equal(reihenSummeLabel(null), '0 Termine · 0 Minuten');
});
