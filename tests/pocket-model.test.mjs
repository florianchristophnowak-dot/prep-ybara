/* ============================================================
   Das Datenmodell von Pocket

   Geprüft wird das, was beim Planen unterwegs tatsächlich passiert:
   Phasen anlegen, ändern, verschieben, duplizieren, löschen – und der
   Übergang vom Entwurf zur Austauschdatei.

   Der Zustandshalter (store.js) und die Ablage (db.js) brauchen React
   und IndexedDB; sie werden im Browserlauf geprüft (tests/pocket-e2e).
   Hier steht die Logik, die auch ohne beides gilt.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  neuerEntwurf, neueIdee, ideeZuEntwurf, dupliziereEntwurf,
  leerePhase, phaseHinzu, phaseAendern, phaseWeg, phaseKopieren, phaseVerschieben,
  dauerSumme, entwurfTitel, gruppenBeschriftung, istLeererEntwurf,
  entwurfZuAustausch, entwurfDauer, ART_SCHNELL, ART_STUNDE,
} from '../pocket/src/model.js';
import { leseStundenDatei, classIdFor } from '../shared/exchange/index.js';

/* ---- Entwürfe -------------------------------------------------------- */

test('Ein neuer Entwurf hat eine eigene Kennung und eine externe Kennung', ()=>{
  const a = neuerEntwurf();
  const b = neuerEntwurf();
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.externalId, b.externalId);
  assert.equal(a.kind, ART_STUNDE);
  assert.ok(a.createdAt);
});

test('Die Schnellplanung ist derselbe Entwurf, nur anders angezeigt', ()=>{
  const schnell = neuerEntwurf({ kind: ART_SCHNELL });
  assert.equal(schnell.kind, ART_SCHNELL);
  // Alle Felder der Detailplanung sind vorhanden – nichts muss umgewandelt werden.
  assert.ok('communicativeTask' in schnell);
  assert.ok('languageResources' in schnell);
  assert.ok('competencies' in schnell);
});

test('Eine Kopie bekommt eigene Kennungen – auch für Phasen und Hilfen', ()=>{
  const original = neuerEntwurf({ topic: 'Les loisirs' });
  original.phases = [
    { ...leerePhase({ title: 'Einstieg' }), scaffolds: [{ id: 'sc1', label: 'Redemittel', note: '' }] },
  ];
  const kopie = dupliziereEntwurf(original);
  assert.notEqual(kopie.id, original.id);
  assert.notEqual(kopie.externalId, original.externalId);
  assert.notEqual(kopie.phases[0].id, original.phases[0].id);
  assert.notEqual(kopie.phases[0].scaffolds[0].id, 'sc1');
  assert.equal(kopie.topic, 'Les loisirs (Kopie)');
  assert.equal(kopie.exportedAt, '');
});

test('Aus einer Idee wird ein Entwurf mit Lerngruppe und Notiz', ()=>{
  const idee = neueIdee({
    className: '9b', subjectName: 'Französisch',
    note: 'Fotos verschiedener Freizeitangebote verteilen; Partner müssen sich einigen.',
  });
  const entwurf = ideeZuEntwurf(idee);
  assert.equal(entwurf.className, '9b');
  assert.equal(entwurf.notes, idee.note);
  // Das Thema bleibt frei: der Einfall ist noch kein Stundenthema.
  assert.equal(entwurf.topic, '');
  assert.equal(entwurf.kind, ART_STUNDE);
});

test('Der Titel eines Entwurfs weicht sinnvoll aus', ()=>{
  assert.equal(entwurfTitel({ topic: 'Thema' }), 'Thema');
  assert.equal(entwurfTitel({ learningGoals: ['', 'Ziel'] }), 'Ziel');
  assert.equal(entwurfTitel({ communicativeTask: { text: 'Aufgabe' } }), 'Aufgabe');
  assert.equal(entwurfTitel({ notes: 'Notiz\nzweite Zeile' }), 'Notiz');
  assert.equal(entwurfTitel({}), 'Ohne Titel');
});

test('Ein leerer Entwurf wird als leer erkannt', ()=>{
  assert.equal(istLeererEntwurf(neuerEntwurf()), true);
  assert.equal(istLeererEntwurf(neuerEntwurf({ topic: 'X' })), false);
  assert.equal(gruppenBeschriftung({ className: '9b', subjectName: 'Französisch' }), '9b Französisch');
});

/* ---- Phasen ---------------------------------------------------------- */

test('Phasen: hinzufügen, ändern, löschen', ()=>{
  let phasen = [];
  phasen = phaseHinzu(phasen, { title: 'Einstieg', duration: 5 });
  phasen = phaseHinzu(phasen, { title: 'Erarbeitung', duration: 20 });
  assert.equal(phasen.length, 2);
  assert.equal(dauerSumme(phasen), 25);

  phasen = phaseAendern(phasen, phasen[1].id, { duration: 25, socialForm: 'Partnerarbeit' });
  assert.equal(phasen[1].duration, 25);
  assert.equal(phasen[1].socialForm, 'Partnerarbeit');
  assert.equal(phasen[0].duration, 5);       // die andere bleibt unberührt

  phasen = phaseWeg(phasen, phasen[0].id);
  assert.equal(phasen.length, 1);
  assert.equal(phasen[0].title, 'Erarbeitung');
});

test('Phasen: verschieben nach oben und unten, an den Rändern folgenlos', ()=>{
  let phasen = ['A', 'B', 'C'].reduce((liste, t)=> phaseHinzu(liste, { title: t }), []);
  const [a, b, c] = phasen.map(p => p.id);

  phasen = phaseVerschieben(phasen, c, -1);
  assert.deepEqual(phasen.map(p => p.title), ['A', 'C', 'B']);

  phasen = phaseVerschieben(phasen, a, 1);
  assert.deepEqual(phasen.map(p => p.title), ['C', 'A', 'B']);

  // Über den Rand hinaus passiert nichts
  phasen = phaseVerschieben(phasen, c, -1);
  assert.deepEqual(phasen.map(p => p.title), ['C', 'A', 'B']);
  phasen = phaseVerschieben(phasen, b, 1);
  assert.deepEqual(phasen.map(p => p.title), ['C', 'A', 'B']);

  // Unbekannte Kennung ändert nichts
  phasen = phaseVerschieben(phasen, 'gibtesnicht', 1);
  assert.deepEqual(phasen.map(p => p.title), ['C', 'A', 'B']);
});

test('Phasen: duplizieren legt die Kopie direkt darunter, mit eigener Kennung', ()=>{
  let phasen = phaseHinzu(phaseHinzu([], { title: 'A' }), { title: 'B' });
  phasen = phaseKopieren(phasen, phasen[0].id);
  assert.deepEqual(phasen.map(p => p.title), ['A', 'A', 'B']);
  assert.notEqual(phasen[0].id, phasen[1].id);
});

/* ---- Export ---------------------------------------------------------- */

function beispielProfil(){
  return {
    competencies: [
      { label: 'mündliche Interaktion', source: 'system' },
      { label: 'Gesprächsführung', source: 'custom' },
    ],
    speechActs: [{ label: 'Vorschläge machen', source: 'system' }],
  };
}

test('Der Export ist eine gültige Austauschdatei', ()=>{
  const entwurf = neuerEntwurf({ className: '9b', subjectName: 'Französisch', topic: 'Les loisirs à Montréal' });
  entwurf.classId = classIdFor('9b');
  entwurf.date = '2026-08-27';
  entwurf.lessonNumber = 3;
  entwurf.learningGoals = ['Die Lernenden können Vorschläge machen.', ''];
  entwurf.phases = [leerePhase({ title: 'Einstieg', duration: 5, content: 'Bildimpuls' })];

  const stunde = entwurfZuAustausch(entwurf, beispielProfil());
  const [gelesen] = leseStundenDatei(JSON.stringify(stunde));

  assert.equal(gelesen.topic, 'Les loisirs à Montréal');
  assert.equal(gelesen.date, '2026-08-27');
  assert.equal(gelesen.lessonNumber, 3);
  assert.equal(gelesen.classId, classIdFor('9b'));
  assert.deepEqual(gelesen.learningGoals, [{ text: 'Die Lernenden können Vorschläge machen.' }]);
  assert.equal(gelesen.phases.length, 1);
  assert.equal(gelesen.app.name, 'Prép-ybara Pocket');
  assert.equal(entwurfDauer(entwurf), 5);
});

test('Die Herkunft der Etiketten reist mit – für die Rückfrage im Desktop', ()=>{
  const entwurf = neuerEntwurf();
  entwurf.competencies = ['mündliche Interaktion', 'Gesprächsführung', 'Ganz neu in Pocket'];
  entwurf.speechActs = ['Vorschläge machen', 'Selbst erfunden'];
  const stunde = entwurfZuAustausch(entwurf, beispielProfil());

  const quelle = (label)=> stunde.competencies.find(k => k.label === label)?.source;
  assert.equal(quelle('mündliche Interaktion'), 'system');
  assert.equal(quelle('Gesprächsführung'), 'profile');
  assert.equal(quelle('Ganz neu in Pocket'), 'custom');
  assert.equal(stunde.speechActs.find(s => s.label === 'Selbst erfunden').source, 'custom');
});

test('Ohne Profil ist alles eigen – und trotzdem gültig', ()=>{
  const entwurf = neuerEntwurf({ className: '7c', subjectName: 'Spanisch' });
  entwurf.competencies = ['Leseverstehen'];
  const stunde = entwurfZuAustausch(entwurf, null);
  assert.equal(stunde.competencies[0].source, 'custom');
  // Die Kennung wird trotzdem gerechnet – dieselbe Rechnung wie im Desktop.
  assert.equal(stunde.className, '7c');
});

test('Ein Export leert den Entwurf nicht und ändert ihn nicht', ()=>{
  const entwurf = neuerEntwurf({ topic: 'Bleibt' });
  const vorher = JSON.stringify(entwurf);
  entwurfZuAustausch(entwurf, null);
  assert.equal(JSON.stringify(entwurf), vorher);
});

test('Ein zweiter Export desselben Entwurfs trägt dieselbe externalId', ()=>{
  const entwurf = neuerEntwurf({ topic: 'Zweimal' });
  const a = entwurfZuAustausch(entwurf, null);
  const b = entwurfZuAustausch(entwurf, null);
  assert.equal(a.externalId, b.externalId);
});
