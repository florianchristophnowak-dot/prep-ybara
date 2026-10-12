/* ============================================================
   Übernahme aus Capy-scope

   Geprüft wird mit einem Export, wie Capy-scope ihn schreibt: zwei
   Klassen, die acht mitgelieferten Fragen (builtIn), eigene Fragen,
   Beobachtungen aus mehreren Runden – und ein Wert, den es auf der
   Skala nicht gibt.

   Die Versprechen, auf die es ankommt:

     - Ein zweiter Import derselben Datei ändert nichts mehr.
     - Gleichnamige Lernende werden zusammengelegt, nicht verdoppelt;
       zwei verschiedene „Mia" einer Klasse bleiben aber zwei.
     - Die mitgelieferten Capy-Fragen landen auf den Standardfragen.
     - Eine Klasse ohne Ziel wird übersprungen und gezählt.
     - Der Vorschlag für die Zuordnung rät nicht: mehrdeutig heisst
       kein Vorschlag.
     - Keine Funktion verändert ihre Eingabe.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  istCapyExport, normalisiereCapy, leseCapyText,
  schlageLerngruppeVor, vorschlagsZuordnung, capyLerngruppe,
  capyVorschau, capyUebernehmen, capyBerichtText,
} from '../renderer/src/capy-import.js';
import {
  startdaten, normalisiereBeobachtungsdaten, leereBeobachtungsdaten, lerngruppenAusPlanung,
  lernendeDerGruppe, lernendeAendern, frageLoeschen, fragenFuer, verlaufVon,
} from '../renderer/src/beobachtung.js';

/* ---- Hilfen ----------------------------------------------------------- */

const zaehlendeId = ()=>{ let n = 0; return (praefix = 'id')=> `${praefix}${++n}`; };

const FR = '6a||Französisch';
const MA = '7b||Mathematik';
const KLASSE_A = 'class_k2l9x0aa_mfx1';
const KLASSE_B = 'class_p0q7r3bb_mfx2';

/* Die acht Fragen, mit denen Capy-scope startet – wörtlich aus dessen
   DEFAULT_QUESTIONS, nicht aus STANDARD_FRAGEN abgeleitet. Sonst prüfte
   der Test nur, dass eine Liste mit sich selbst übereinstimmt. */
const CAPY_STANDARD = [
  { text: 'Der Lernende beteiligt sich aktiv am Unterricht.', category: 'Mitarbeit', subjectArea: 'allgemein' },
  { text: 'Der Lernende hört aufmerksam zu und bleibt bei der Sache.', category: 'Verhalten', subjectArea: 'allgemein' },
  { text: 'Der Lernende arbeitet kooperativ mit anderen zusammen.', category: 'Verhalten', subjectArea: 'Sozialverhalten' },
  { text: 'Der Lernende bringt eigene Ideen oder Beiträge ein.', category: 'Mitarbeit', subjectArea: 'mündliche Beteiligung' },
  { text: 'Der Lernende setzt fachliche Inhalte sicher und passend um.', category: 'Kompetenz', subjectArea: 'fachspezifisch' },
  { text: 'Der Lernende kann Aufgaben zunehmend selbstständig bearbeiten.', category: 'Kompetenz', subjectArea: 'Selbstständigkeit' },
  { text: 'Der Lernende nutzt die Unterrichtszeit konzentriert.', category: 'Verhalten', subjectArea: 'Arbeitsverhalten' },
  { text: 'Der Lernende zeigt Fortschritte in der angestrebten Kompetenz.', category: 'Kompetenz', subjectArea: 'Lernentwicklung' },
];

const capyBeob = (id, sessionId, classId, studentId, questionId, score, date, note = '')=>({
  id, sessionId, classId, studentId, questionId, score, note, date,
  timestamp: `${date}T09:45:00.000Z`,
});

function capyExport(){
  return {
    version: 1,
    settings: {
      dailyLimitDefault: 6,
      scale: [
        { value: 1, title: 'eher negativ', description: 'trifft kaum zu' },
        { value: 2, title: 'leicht negativ', description: 'trifft eher nicht zu' },
        { value: 3, title: 'leicht positiv', description: 'trifft eher zu' },
        { value: 4, title: 'eher positiv', description: 'trifft deutlich zu' },
      ],
    },
    classes: [
      {
        id: KLASSE_A, name: '6a', subject: 'Französisch', createdAt: '2026-09-01T07:00:00.000Z',
        students: [
          { id: 'student_mia_1', name: 'Mia' },
          { id: 'student_noah_2', name: 'Noah' },
          { id: 'student_lea_3', name: ' Lea ' },
        ],
      },
      {
        id: KLASSE_B, name: '7b Mathe', subject: '', createdAt: '2026-09-01T07:05:00.000Z',
        students: [
          { id: 'student_ben_4', name: 'Ben' },
          { id: 'student_emma_5', name: 'Emma' },
        ],
      },
    ],
    questions: [
      ...CAPY_STANDARD.map((q, i)=> ({
        ...q, id: `q_std${i + 1}_mfx0`, active: true, createdAt: '2026-09-01T06:59:00.000Z', builtIn: true,
      })),
      {
        id: 'q_eigen1_mfx3', text: 'Benutzt die Zielsprache spontan.', category: 'Kompetenz',
        subjectArea: 'Sprechen', active: true, createdAt: '2026-09-03T12:00:00.000Z', builtIn: false,
      },
      {
        id: 'q_eigen2_mfx4', text: 'Bringt das Material mit.', category: 'Verhalten',
        subjectArea: '', active: false, createdAt: '2026-09-04T12:00:00.000Z', builtIn: false,
      },
    ],
    observations: [
      capyBeob('obs_1', 'session_a', KLASSE_A, 'student_mia_1', 'q_std1_mfx0', 3, '2026-10-01', 'meldet sich oft'),
      capyBeob('obs_2', 'session_a', KLASSE_A, 'student_noah_2', 'q_std2_mfx0', 2, '2026-10-01'),
      capyBeob('obs_3', 'session_a', KLASSE_A, 'student_lea_3', 'q_eigen1_mfx3', 4, '2026-10-01'),
      capyBeob('obs_4', 'session_b', KLASSE_A, 'student_mia_1', 'q_eigen1_mfx3', 5, '2026-10-06'),
      capyBeob('obs_5', 'session_c', KLASSE_B, 'student_ben_4', 'q_std5_mfx0', 1, '2026-10-02'),
      capyBeob('obs_6', 'session_c', KLASSE_B, 'student_emma_5', 'q_std6_mfx0', 4, '2026-10-02'),
      capyBeob('obs_7', 'session_d', KLASSE_A, 'student_noah_2', 'q_eigen2_mfx4', 1, '2026-10-08'),
    ],
  };
}

// Startdaten mit den Standardfragen q1 … q8, wie eine frisch angelegte Ablage.
const frisch = ()=> startdaten({ neueId: zaehlendeId(), jetzt: '2026-09-15T08:00:00.000Z' });

const ZUORDNUNG = { [KLASSE_A]: FR, [KLASSE_B]: MA };

function planung(){
  return lerngruppenAusPlanung({
    weeks: {
      '2026-09-07': { lessons: {
        '0-0': { classGroup: '6a', subject: 'Französisch' },
        '0-1': { classGroup: '6a', subject: 'Deutsch' },
        '1-0': { classGroup: '7b', subject: 'Mathematik' },
        '1-1': { classGroup: '8c', subject: '' },
        '2-0': { classGroup: '9d', subject: 'Englisch' },
        '2-1': { classGroup: '6a', subject: 'Französisch' },
        '3-0': { classGroup: 'Q1 GK', subject: 'Geschichte' },
        '3-1': { classGroup: '5b', subject: 'Malen' },
        '4-0': { classGroup: '5b', subject: 'Mathematik' },
      } },
    },
  });
}

function tiefEinfrieren(o){
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) tiefEinfrieren(v);
  }
  return o;
}

const ids = (liste)=> liste.map(x => x.id);

/* ---- Erkennen und Lesen ------------------------------------------------ */

test('Ein Capy-Export wird an seinen drei Listen erkannt', ()=>{
  assert.ok(istCapyExport(capyExport()));
  assert.ok(istCapyExport({ classes: [], questions: [], observations: [] }));
  assert.ok(!istCapyExport({ classes: [], questions: [] }));
  assert.ok(!istCapyExport({ classes: {}, questions: [], observations: [] }));
  assert.ok(!istCapyExport([]));
  assert.ok(!istCapyExport(null));
  assert.ok(!istCapyExport('{"classes":[]}'));
  // Eine Beobachtungs-Sicherung und ein Planungs-Backup sind keine Capy-Exporte.
  assert.ok(!istCapyExport({ format: 'prepybara-beobachtung', schemaVersion: 1, verschluesselt: true }));
  assert.ok(!istCapyExport({ weeks: {}, sequences: {} }));
});

test('leseCapyText liest einen echten Export, auch mit Byte-Order-Mark', ()=>{
  const json = JSON.stringify(capyExport(), null, 2);
  for (const text of [json, `﻿${json}`, `\n  ${json}\n`]) {
    const r = leseCapyText(text);
    assert.equal(r.ok, true);
    assert.deepEqual(ids(r.capy.classes), [KLASSE_A, KLASSE_B]);
    assert.equal(r.capy.questions.length, 10);
    assert.equal(r.capy.observations.length, 7);
    assert.equal(r.capy.classes[0].students[2].name, 'Lea');
  }
});

test('leseCapyText weist Fremdes mit einem deutschen Hinweis ab', ()=>{
  const fehler = (eingabe)=>{
    const r = leseCapyText(eingabe);
    assert.equal(r.ok, false);
    assert.equal(typeof r.fehler, 'string');
    assert.ok(r.fehler.length > 10);
    assert.equal(r.capy, undefined);
    return r.fehler;
  };
  assert.match(fehler(''), /leer/);
  assert.match(fehler('   '), /leer/);
  assert.match(fehler(undefined), /leer/);
  assert.match(fehler('{ classes: ['), /JSON/);
  assert.match(fehler('[]'), /kein Export aus Capy-scope/);
  assert.match(fehler('{"weeks":{}}'), /kein Export aus Capy-scope/);
  assert.match(fehler('null'), /kein Export aus Capy-scope/);
  // Die eigene Sicherung wird nicht als „kaputt" gemeldet, sondern an die richtige Stelle verwiesen.
  assert.match(fehler(JSON.stringify({ format: 'prepybara-beobachtung', inhalt: 'xyz' })), /Sicherung einlesen/);
});

test('Normalisierung: Kennungen aus der Datei selbst, Namen getrimmt, Doppelte nur einmal', ()=>{
  const capy = normalisiereCapy({
    classes: [
      { name: '6a', students: [{ name: 'Mia' }, { id: 's2', name: '  ' }, { id: 's3', name: ' Noah  K. ' }, 'kaputt'] },
      { id: 'k2', name: '7b', subject: 42, students: 'keine Liste' },
      { id: 'k2', name: 'Doppelte Kennung', students: [] },
      null,
    ],
    questions: [
      { text: 'Ohne Kennung.' },
      { id: 'q2', text: '   ' },
      { id: 'q3', text: 'Ruht.', active: false, builtIn: 'ja' },
    ],
    observations: [
      { classId: 'k2', studentId: 's9', questionId: 'q3', score: 3, date: '2026-10-01' },
      { id: 'o2', score: { wert: 3 } },
      { id: 'o2', score: 4 },
    ],
  });
  assert.deepEqual(capy.classes.map(k => [k.id, k.name, k.subject]), [
    ['capy-klasse-1', '6a', ''],
    ['k2', '7b', '42'],
  ]);
  assert.deepEqual(capy.classes[0].students, [
    { id: 'capy-klasse-1-lernende-1', name: 'Mia' },
    { id: 's3', name: 'Noah K.' },
  ]);
  assert.deepEqual(capy.classes[1].students, []);
  assert.deepEqual(capy.questions.map(q => [q.id, q.text, q.active, q.builtIn]), [
    ['capy-frage-1', 'Ohne Kennung.', true, false],
    ['q3', 'Ruht.', false, false],
  ]);
  assert.deepEqual(ids(capy.observations), ['capy-k2-s9-q3-2026-10-01', 'o2']);
  assert.equal(capy.observations[1].score, null);

  // Ein zweites Mal normalisiert, ändert sich nichts – auch nicht an den erzeugten Kennungen.
  assert.deepEqual(normalisiereCapy(capy), capy);
  assert.deepEqual(normalisiereCapy(null), { version: 1, classes: [], questions: [], observations: [] });
});

/* ---- Vorschlag für die Zuordnung --------------------------------------- */

test('Vorschlag: Klasse und Fach im eigenen Feld oder im Namen', ()=>{
  const lg = planung();
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Französisch' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a Französisch', subject: '' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a Französisch', subject: 'Französisch' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: ' 6A  französisch ' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a - Französisch' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a (Französisch)' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a · Französisch' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '6a/Französisch' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: 'Französisch 6a' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: 'q1 gk', subject: 'Geschichte' }, lg), 'Q1 GK||Geschichte');
});

test('Vorschlag: abgekürztes Fach, Klasse allein, Planung ohne Fach', ()=>{
  const lg = planung();
  // Der Rest nach der Klasse ist der Anfang des Fachs – ab drei Zeichen.
  assert.equal(schlageLerngruppeVor({ name: '7b Mathe' }, lg), MA);
  assert.equal(schlageLerngruppeVor({ name: '7b', subject: 'Mathe' }, lg), MA);
  assert.equal(schlageLerngruppeVor({ name: '6a Franz' }, lg), FR);
  assert.equal(schlageLerngruppeVor({ name: '7b M' }, lg), '');
  // Nur die Klasse, und die Planung kennt sie in genau einem Fach.
  assert.equal(schlageLerngruppeVor({ name: '7b' }, lg), MA);
  assert.equal(schlageLerngruppeVor({ name: '9d', subject: '' }, lg), '9d||Englisch');
  // Die Planung kennt die Klasse nur ohne Fach.
  assert.equal(schlageLerngruppeVor({ name: '8c' }, lg), '8c||');
  assert.equal(schlageLerngruppeVor({ name: '8c', subject: 'Deutsch' }, lg), '8c||');
});

test('Vorschlag: mehrdeutig oder unbekannt ergibt keinen Vorschlag', ()=>{
  const lg = planung();
  // 6a gibt es in Französisch und Deutsch.
  assert.equal(schlageLerngruppeVor({ name: '6a' }, lg), '');
  // „Ma" passt auf Malen und Mathematik – und ist ohnehin zu kurz; „Mal" nur auf Malen.
  assert.equal(schlageLerngruppeVor({ name: '5b Ma' }, lg), '');
  assert.equal(schlageLerngruppeVor({ name: '5b Mal' }, lg), '5b||Malen');
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Englisch' }, lg), '');
  // Die Planung kennt 6a ohne Fach, aber AUCH mit Fächern: Dann ist die fachlose 6a kein sicheres Ziel.
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Englisch' }, ['6a||', '6a||Deutsch']), '');
  assert.equal(schlageLerngruppeVor({ name: '6a Englisch' }, ['6a||', '6a||Deutsch', '6a||Mathematik']), '');
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Englisch' }, ['6a||', '7b||Deutsch']), '6a||');
  assert.equal(schlageLerngruppeVor({ name: '9a', subject: 'Französisch' }, lg), '');
  // Wortweise, nicht als Teilzeichenkette: „6" ist nicht „6a".
  assert.equal(schlageLerngruppeVor({ name: '6', subject: 'Französisch' }, lg), '');
  // Ein zusätzliches Wort im Namen ist weder Klasse noch Fach.
  assert.equal(schlageLerngruppeVor({ name: 'Klasse 6a Französisch' }, lg), '');
  assert.equal(schlageLerngruppeVor({ name: '', subject: 'Französisch' }, lg), '');
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Französisch' }, []), '');
  assert.equal(schlageLerngruppeVor(null, lg), '');
  assert.equal(schlageLerngruppeVor({ name: '6a', subject: 'Französisch' }, 'kaputt'), '');
});

test('Vorschlag: auch Lerngruppen als blosse Schlüssel, z. B. aus den Beobachtungsdaten', ()=>{
  assert.equal(schlageLerngruppeVor({ name: '6a Französisch' }, [' 6a || Französisch ', '', null]), FR);
  assert.equal(schlageLerngruppeVor({ name: '7b' }, [{ schluessel: MA }]), MA);
});

test('Startbelegung der Zuordnung und die Lerngruppe, die Capy-scope selbst nahelegt', ()=>{
  assert.deepEqual(vorschlagsZuordnung(capyExport(), planung()), ZUORDNUNG);
  assert.deepEqual(vorschlagsZuordnung(capyExport(), []), { [KLASSE_A]: '', [KLASSE_B]: '' });
  assert.deepEqual(vorschlagsZuordnung(null, planung()), {});

  assert.equal(capyLerngruppe({ name: '6a', subject: 'Französisch' }), FR);
  assert.equal(capyLerngruppe({ name: ' 7b   Mathe ', subject: '' }), '7b Mathe||');
  assert.equal(capyLerngruppe({ name: '', subject: 'Mathe' }), '');
});

/* ---- Vorschau ---------------------------------------------------------- */

test('Vorschau: Zahlen je Klasse, Fragen und Beobachtungen', ()=>{
  const v = capyVorschau(capyExport(), frisch(), { zuordnung: { [KLASSE_A]: FR, [KLASSE_B]: '' } });
  assert.deepEqual(v.klassen, [
    {
      id: KLASSE_A, name: '6a', fach: 'Französisch', lernende: 3, beobachtungen: 5, ziel: FR,
      lernendeNeu: 3, lernendeVorhanden: 0, beobachtungenNeu: 4,
    },
    {
      id: KLASSE_B, name: '7b Mathe', fach: '', lernende: 2, beobachtungen: 2, ziel: '',
      lernendeNeu: 0, lernendeVorhanden: 0, beobachtungenNeu: 0,
    },
  ]);
  // Die acht mitgelieferten Fragen sind schon da, die beiden eigenen kommen neu dazu.
  assert.deepEqual(v.fragen, { neu: 2, vorhanden: 8 });
  assert.deepEqual(v.beobachtungen, { neu: 4, schonVorhanden: 0, ohneZiel: 2, ungueltig: 1, unvollstaendig: 0 });
});

test('Vorschau und Übernahme rechnen dasselbe', ()=>{
  const daten = frisch();
  const v = capyVorschau(capyExport(), daten, { zuordnung: ZUORDNUNG });
  const { bericht } = capyUebernehmen(daten, capyExport(), ZUORDNUNG);
  assert.equal(v.beobachtungen.neu, bericht.beobachtungen);
  assert.equal(v.beobachtungen.ungueltig, bericht.ungueltig);
  assert.equal(v.beobachtungen.unvollstaendig, bericht.unvollstaendig);
  assert.equal(v.fragen.neu, bericht.fragen);
  assert.equal(v.klassen.reduce((s, k)=> s + k.lernendeNeu, 0), bericht.lernende);
});

test('Vorschau ohne Zuordnung: alles ohne Ziel', ()=>{
  const v = capyVorschau(capyExport(), frisch());
  assert.ok(v.klassen.every(k => k.ziel === ''));
  assert.deepEqual(v.beobachtungen, { neu: 0, schonVorhanden: 0, ohneZiel: 7, ungueltig: 0, unvollstaendig: 0 });
});

/* ---- Übernahme --------------------------------------------------------- */

test('Übernahme: Lernende mit Capy-Kennung, Beobachtungen Feld für Feld', ()=>{
  const { daten, bericht } = capyUebernehmen(frisch(), capyExport(), ZUORDNUNG);

  assert.deepEqual(lernendeDerGruppe(daten, FR), [
    { id: 'student_mia_1', name: 'Mia', aktiv: true },
    { id: 'student_noah_2', name: 'Noah', aktiv: true },
    { id: 'student_lea_3', name: 'Lea', aktiv: true },
  ]);
  assert.deepEqual(ids(lernendeDerGruppe(daten, MA)), ['student_ben_4', 'student_emma_5']);

  const obs1 = daten.beobachtungen.find(b => b.id === 'obs_1');
  assert.deepEqual(obs1, {
    id: 'obs_1',
    lerngruppe: FR,
    lernendeId: 'student_mia_1',
    frageId: 'q1',                       // die Standardfrage der App, nicht q_std1_mfx0
    wert: 3,
    notiz: 'meldet sich oft',
    datum: '2026-10-01',
    zeitpunkt: '2026-10-01T09:45:00.000Z',
    stundenRef: '',
    rundeId: 'session_a',
  });
  assert.equal(daten.beobachtungen.find(b => b.id === 'obs_5').frageId, 'q5');
  assert.equal(daten.beobachtungen.find(b => b.id === 'obs_5').lerngruppe, MA);

  // Der Wert 5 steht auf keiner Skala: übersprungen und gezählt.
  assert.equal(daten.beobachtungen.some(b => b.id === 'obs_4'), false);
  assert.deepEqual(bericht, {
    klassen: 2,
    lernende: 5,
    lernendeVorhanden: 0,
    fragen: 2,
    fragenVorhanden: 8,
    beobachtungen: 6,
    schonVorhanden: 0,
    ohneZiel: 0,
    ungueltig: 1,
    unvollstaendig: 0,
  });

  // Das Ergebnis ist bereits in gültiger Form.
  assert.deepEqual(normalisiereBeobachtungsdaten(daten), daten);
});

test('Übernahme: Standardfragen werden abgebildet, eigene kommen allgemein dazu', ()=>{
  const { daten } = capyUebernehmen(frisch(), capyExport(), ZUORDNUNG);
  assert.equal(daten.fragen.length, 10);
  assert.equal(daten.fragen.filter(f => f.standard).length, 8);
  assert.deepEqual(ids(daten.fragen.slice(0, 8)), ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);

  const [eigen1, eigen2] = daten.fragen.slice(8);
  assert.deepEqual(eigen1, {
    id: 'q_eigen1_mfx3',
    text: 'Benutzt die Zielsprache spontan.',
    kategorie: 'Kompetenz',
    stichwort: 'Sprechen',
    geltung: 'allgemein',
    lerngruppe: '',
    kompetenz: '',
    aktiv: true,
    standard: false,
    erstelltAm: '2026-09-03T12:00:00.000Z',
  });
  // In Capy-scope ruhend – hier auch. Ihre Beobachtung bleibt trotzdem.
  assert.equal(eigen2.aktiv, false);
  assert.ok(daten.beobachtungen.some(b => b.id === 'obs_7' && b.frageId === 'q_eigen2_mfx4'));
  assert.ok(fragenFuer(daten, MA).some(f => f.id === 'q_eigen1_mfx3'));
});

test('Doppelter Import: beim zweiten Mal kommt nichts dazu', ()=>{
  const erst = capyUebernehmen(frisch(), capyExport(), ZUORDNUNG);
  const zweit = capyUebernehmen(erst.daten, capyExport(), ZUORDNUNG);
  assert.deepEqual(zweit.daten, erst.daten);
  assert.deepEqual(zweit.bericht, {
    klassen: 2,
    lernende: 0,
    lernendeVorhanden: 5,
    fragen: 0,
    fragenVorhanden: 10,
    beobachtungen: 0,
    schonVorhanden: 6,
    ohneZiel: 0,
    ungueltig: 1,
    unvollstaendig: 0,
  });
  const v = capyVorschau(capyExport(), erst.daten, { zuordnung: ZUORDNUNG });
  assert.deepEqual(v.beobachtungen, { neu: 0, schonVorhanden: 6, ohneZiel: 0, ungueltig: 1, unvollstaendig: 0 });
  assert.deepEqual(v.fragen, { neu: 0, vorhanden: 10 });
});

test('Doppelter Import über den JSON-Text, wie aus einer Datei', ()=>{
  const text = JSON.stringify(capyExport());
  const erst = capyUebernehmen(frisch(), leseCapyText(text).capy, ZUORDNUNG);
  const zweit = capyUebernehmen(JSON.parse(JSON.stringify(erst.daten)), leseCapyText(text).capy, ZUORDNUNG);
  assert.deepEqual(zweit.daten, erst.daten);
  assert.equal(zweit.bericht.beobachtungen, 0);
});

test('Gleichnamige Lernende werden zusammengelegt, ihre Beobachtungen umgeschrieben', ()=>{
  const daten = normalisiereBeobachtungsdaten({
    ...frisch(),
    lernende: { [FR]: [
      { id: 'l-mia', name: 'mia ', aktiv: true },
      { id: 'l-lea', name: 'Lea', aktiv: false },
      { id: 'l-tom', name: 'Tom', aktiv: true },
    ] },
    beobachtungen: [{ id: 'eigen-1', lerngruppe: FR, lernendeId: 'l-mia', frageId: 'q1', wert: 2, datum: '2026-09-20' }],
  });
  const { daten: neu, bericht } = capyUebernehmen(daten, capyExport(), { [KLASSE_A]: FR });

  // Mia und die ausgeblendete Lea sind schon da; nur Noah kommt dazu, und zwar ans Ende.
  assert.deepEqual(lernendeDerGruppe(neu, FR, { auchInaktive: true }), [
    { id: 'l-mia', name: 'mia', aktiv: true },
    { id: 'l-lea', name: 'Lea', aktiv: false },
    { id: 'l-tom', name: 'Tom', aktiv: true },
    { id: 'student_noah_2', name: 'Noah', aktiv: true },
  ]);
  assert.equal(bericht.lernende, 1);
  assert.equal(bericht.lernendeVorhanden, 2);

  assert.equal(neu.beobachtungen.find(b => b.id === 'obs_1').lernendeId, 'l-mia');
  assert.equal(neu.beobachtungen.find(b => b.id === 'obs_3').lernendeId, 'l-lea');
  assert.deepEqual(verlaufVon(neu, FR, 'l-mia').map(e => e.beobachtung.id), ['obs_1', 'eigen-1']);

  const v = capyVorschau(capyExport(), daten, { zuordnung: { [KLASSE_A]: FR } });
  assert.equal(v.klassen[0].lernendeNeu, 1);
  assert.equal(v.klassen[0].lernendeVorhanden, 2);
});

test('Zwei verschiedene „Mia" einer Capy-Klasse bleiben zwei', ()=>{
  const capy = capyExport();
  capy.classes[0].students.push({ id: 'student_mia_9', name: 'Mia' });
  capy.observations.push(capyBeob('obs_8', 'session_e', KLASSE_A, 'student_mia_9', 'q_std3_mfx0', 3, '2026-10-09'));
  const daten = normalisiereBeobachtungsdaten({ ...frisch(), lernende: { [FR]: [{ id: 'l-mia', name: 'Mia' }] } });

  const { daten: neu } = capyUebernehmen(daten, capy, { [KLASSE_A]: FR });
  const mias = lernendeDerGruppe(neu, FR).filter(l => l.name === 'Mia');
  assert.deepEqual(ids(mias), ['l-mia', 'student_mia_9']);
  assert.equal(neu.beobachtungen.find(b => b.id === 'obs_1').lernendeId, 'l-mia');
  assert.equal(neu.beobachtungen.find(b => b.id === 'obs_8').lernendeId, 'student_mia_9');
});

test('Zwei Capy-Klassen in dieselbe Lerngruppe: gleiche Namen werden eine Person', ()=>{
  const capy = capyExport();
  capy.classes[1].students.push({ id: 'student_mia_b', name: 'Mia' });
  capy.observations.push(capyBeob('obs_9', 'session_f', KLASSE_B, 'student_mia_b', 'q_std4_mfx0', 4, '2026-10-10'));

  const { daten, bericht } = capyUebernehmen(frisch(), capy, { [KLASSE_A]: FR, [KLASSE_B]: FR });
  assert.deepEqual(lernendeDerGruppe(daten, FR).map(l => l.name), ['Mia', 'Noah', 'Lea', 'Ben', 'Emma']);
  assert.equal(daten.beobachtungen.find(b => b.id === 'obs_9').lernendeId, 'student_mia_1');
  assert.equal(bericht.lernende, 5);
  assert.equal(bericht.lernendeVorhanden, 1);
  assert.ok(daten.beobachtungen.filter(b => b.id.startsWith('obs_')).every(b => b.lerngruppe === FR));
});

test('Umbenannt nach dem ersten Import: der zweite erkennt die Lernende trotzdem', ()=>{
  const daten = normalisiereBeobachtungsdaten({ ...frisch(), lernende: { [FR]: [{ id: 'l-mia', name: 'Mia' }] } });
  const erst = capyUebernehmen(daten, capyExport(), ZUORDNUNG).daten;
  const umbenannt = lernendeAendern(lernendeAendern(erst, FR, 'l-mia', { name: 'Mia S.' }), FR, 'student_noah_2', { name: 'Noah K.' });

  const zweit = capyUebernehmen(umbenannt, capyExport(), ZUORDNUNG);
  assert.deepEqual(zweit.daten, umbenannt);
  assert.equal(zweit.bericht.lernende, 0);
  assert.deepEqual(lernendeDerGruppe(zweit.daten, FR).map(l => l.name), ['Mia S.', 'Noah K.', 'Lea']);
});

test('Klassen ohne Ziel werden übersprungen und gezählt', ()=>{
  const daten = frisch();
  const { daten: neu, bericht } = capyUebernehmen(daten, capyExport(), { [KLASSE_A]: '', [KLASSE_B]: '   ', unbekannt: FR });
  assert.deepEqual(neu.lernende, {});
  assert.equal(neu.beobachtungen.length, 0);
  assert.equal(bericht.klassen, 0);
  assert.equal(bericht.ohneZiel, 7);
  assert.equal(bericht.ungueltig, 0);
  // Der Fragenpool gehört keiner Klasse; eigene Fragen kommen trotzdem mit.
  assert.equal(bericht.fragen, 2);

  // Nur eine Klasse übernommen: Die Beobachtungen der anderen zählen als ohne Ziel.
  const teil = capyUebernehmen(daten, capyExport(), { [KLASSE_B]: MA });
  assert.deepEqual(Object.keys(teil.daten.lernende), [MA]);
  assert.equal(teil.bericht.beobachtungen, 2);
  assert.equal(teil.bericht.ohneZiel, 5);

  // Beobachtungen einer Klasse, die im Export fehlt, haben ebenfalls kein Ziel.
  const capy = capyExport();
  capy.observations.push(capyBeob('obs_x', 'session_x', 'class_geloescht', 'student_x', 'q_std1_mfx0', 3, '2026-10-01'));
  assert.equal(capyUebernehmen(daten, capy, { ...ZUORDNUNG, class_geloescht: FR }).bericht.ohneZiel, 1);
});

test('Die Zuordnung wird bereinigt: Leerzeichen im Schlüssel, Unsinn als Wert', ()=>{
  const { daten, bericht } = capyUebernehmen(frisch(), capyExport(), { [KLASSE_A]: ' 6a || Französisch ', [KLASSE_B]: 42 });
  assert.deepEqual(Object.keys(daten.lernende), [FR]);
  assert.equal(bericht.klassen, 1);
  assert.deepEqual(capyUebernehmen(frisch(), capyExport(), null).bericht.klassen, 0);
});

test('Fragen: umformuliert ist eigen, gelöscht kommt zurück, gleicher Text wird erkannt', ()=>{
  const capy = capyExport();
  // In Capy-scope umformuliert, aber weiterhin als mitgeliefert markiert.
  capy.questions[1].text = 'Der Lernende hört zu.';
  // Eine eigene Capy-Frage mit demselben Text wie eine eigene, allgemeine Frage der App.
  capy.questions.push({ id: 'q_eigen3', text: '  arbeitet  SAUBER. ', category: 'Sonstiges', active: true, builtIn: false });
  // Und eine mit demselben Text wie eine Frage, die nur in einer Lerngruppe gilt.
  capy.questions.push({ id: 'q_eigen4', text: 'Spricht Französisch.', category: 'Kompetenz', active: true, builtIn: false });

  let daten = frageLoeschen(frisch(), 'q3');
  daten = normalisiereBeobachtungsdaten({
    ...daten,
    fragen: [
      ...daten.fragen,
      { id: 'q-sauber', text: 'Arbeitet sauber.', kategorie: 'Verhalten', geltung: 'allgemein' },
      { id: 'q-fr', text: 'Spricht Französisch.', kategorie: 'Kompetenz', geltung: 'lerngruppe', lerngruppe: FR },
    ],
  });

  const { daten: neu, bericht } = capyUebernehmen(daten, capy, ZUORDNUNG);
  const frage = (id)=> neu.fragen.find(f => f.id === id);

  assert.equal(frage('q_std2_mfx0').standard, false);
  assert.equal(frage('q_std2_mfx0').text, 'Der Lernende hört zu.');
  assert.equal(neu.beobachtungen.find(b => b.id === 'obs_2').frageId, 'q_std2_mfx0');

  // Die hier gelöschte Standardfrage kommt aus Capy-scope zurück – wortgleich, also wieder als Standard.
  assert.equal(frage('q_std3_mfx0').standard, true);
  assert.equal(frage('q_std3_mfx0').text, 'Der Lernende arbeitet kooperativ mit anderen zusammen.');

  assert.equal(frage('q_eigen3'), undefined);
  assert.equal(frage('q_eigen4').geltung, 'allgemein');
  assert.equal(bericht.fragen, 5);           // q_std2 (umformuliert), q_std3, q_eigen1, q_eigen2, q_eigen4
  assert.equal(bericht.fragenVorhanden, 7);  // sechs Standardfragen und q_eigen3

  // Ein zweiter Import ändert auch an den Fragen nichts.
  assert.deepEqual(capyUebernehmen(neu, capy, ZUORDNUNG).daten, neu);
});

test('Eine nach dem Import umformulierte Standardfrage bleibt beim zweiten Import die Zielfrage', ()=>{
  const erst = capyUebernehmen(frisch(), capyExport(), ZUORDNUNG).daten;
  const umformuliert = {
    ...erst,
    fragen: erst.fragen.map(f => (f.id === 'q1' ? { ...f, text: 'Beteiligt sich.' } : f)),
  };
  const zweit = capyUebernehmen(umformuliert, capyExport(), ZUORDNUNG);
  assert.equal(zweit.bericht.fragen, 0);
  assert.deepEqual(zweit.daten, normalisiereBeobachtungsdaten(umformuliert));
});

test('Verwaiste und unvollständige Capy-Beobachtungen', ()=>{
  const capy = capyExport();
  capy.observations.push(
    // Lernende fehlt im Export: bleibt erhalten, mit der Capy-Kennung.
    capyBeob('obs_a', 'session_g', KLASSE_A, 'student_weg', 'q_std1_mfx0', 2, '2026-10-03'),
    // Datum fehlt, Zeitpunkt nicht: der Tag kommt aus dem Zeitpunkt.
    { id: 'obs_b', sessionId: 's', classId: KLASSE_A, studentId: 'student_mia_1', questionId: 'q_std1_mfx0', score: '4', timestamp: '2026-10-04T08:00:00.000Z' },
    // Weder Datum noch Zeitpunkt, keine Lernende: unvollständig. Wert 0, halbe Stufe, kein Wert: ungültig.
    { id: 'obs_c', classId: KLASSE_A, studentId: 'student_mia_1', questionId: 'q_std1_mfx0', score: 3 },
    capyBeob('obs_d', 's', KLASSE_A, '', 'q_std1_mfx0', 3, '2026-10-03'),
    capyBeob('obs_e', 's', KLASSE_A, 'student_mia_1', 'q_std1_mfx0', 0, '2026-10-03'),
    capyBeob('obs_f', 's', KLASSE_A, 'student_mia_1', 'q_std1_mfx0', 2.5, '2026-10-03'),
    capyBeob('obs_g', 's', KLASSE_A, 'student_mia_1', 'q_std1_mfx0', null, '2026-10-03'),
  );
  const { daten, bericht } = capyUebernehmen(frisch(), capy, ZUORDNUNG);
  const b = (id)=> daten.beobachtungen.find(x => x.id === id);

  assert.equal(b('obs_a').lernendeId, 'student_weg');
  assert.equal(b('obs_a').frageId, 'q1');
  assert.equal(b('obs_b').datum, '2026-10-04');
  assert.equal(b('obs_b').wert, 4);
  for (const id of ['obs_c', 'obs_d', 'obs_e', 'obs_f', 'obs_g']) assert.equal(b(id), undefined, id);
  // Der Wert 5 aus dem Grundbestand und die drei hier: ungültig. Die beiden ohne Angaben zählen eigens.
  assert.equal(bericht.ungueltig, 4);
  assert.equal(bericht.unvollstaendig, 2);
  assert.match(capyBerichtText(bericht), /4 Beobachtungen mit ungültigem Wert übersprungen\. 2 Beobachtungen ohne Lernende, Frage oder Datum übersprungen\./);
  assert.equal(bericht.beobachtungen, 8);
});

test('Übernahme in leere oder kaputte Daten und aus leerem Export', ()=>{
  const leer = capyUebernehmen(undefined, capyExport(), ZUORDNUNG);
  assert.equal(leer.daten.fragen.length, 10);
  // Ohne Standardfragen im Ziel sind die mitgelieferten Capy-Fragen selbst die Standardfragen.
  assert.equal(leer.daten.fragen.filter(f => f.standard).length, 8);
  assert.equal(leer.daten.beobachtungen.find(b => b.id === 'obs_1').frageId, 'q_std1_mfx0');

  const nichts = capyUebernehmen(frisch(), null, ZUORDNUNG);
  assert.deepEqual(nichts.daten, frisch());
  assert.deepEqual(nichts.bericht, {
    klassen: 0, lernende: 0, lernendeVorhanden: 0, fragen: 0, fragenVorhanden: 0,
    beobachtungen: 0, schonVorhanden: 0, ohneZiel: 0, ungueltig: 0, unvollstaendig: 0,
  });
  assert.deepEqual(capyUebernehmen(leereBeobachtungsdaten(), { classes: [], questions: [], observations: [] }, {}).daten, leereBeobachtungsdaten());
});

test('Bestehende Daten bleiben unangetastet: Einstellungen, fremde Lerngruppen, eigene Beobachtungen', ()=>{
  const daten = normalisiereBeobachtungsdaten({
    ...frisch(),
    einstellungen: { rundenGroesse: 4 },
    lernende: { '9d||Englisch': [{ id: 'e1', name: 'Zoe' }], [FR]: [{ id: 'l-mia', name: 'Mia', aktiv: false }] },
    beobachtungen: [{ id: 'obs_1', lerngruppe: '9d||Englisch', lernendeId: 'e1', frageId: 'q2', wert: 1, datum: '2026-09-01' }],
  });
  const { daten: neu, bericht } = capyUebernehmen(daten, capyExport(), ZUORDNUNG);
  assert.equal(neu.einstellungen.rundenGroesse, 4);
  assert.deepEqual(neu.lernende['9d||Englisch'], daten.lernende['9d||Englisch']);
  assert.equal(neu.lernende[FR][0].aktiv, false);
  // Eine schon vorhandene Kennung wird nie überschrieben – auch nicht aus einer anderen Lerngruppe.
  assert.deepEqual(neu.beobachtungen.find(b => b.id === 'obs_1'), daten.beobachtungen[0]);
  assert.equal(bericht.schonVorhanden, 1);
  assert.deepEqual(neu.beobachtungen.slice(0, 1), daten.beobachtungen);
});

test('Keine Funktion verändert ihre Eingabe', ()=>{
  const capy = tiefEinfrieren(capyExport());
  const daten = tiefEinfrieren(normalisiereBeobachtungsdaten({
    ...frisch(),
    lernende: { [FR]: [{ id: 'l-mia', name: 'Mia' }] },
  }));
  const zuordnung = tiefEinfrieren({ ...ZUORDNUNG });
  const lg = tiefEinfrieren(planung());
  const vorher = JSON.stringify([capy, daten, zuordnung, lg]);

  normalisiereCapy(capy);
  vorschlagsZuordnung(capy, lg);
  schlageLerngruppeVor(capy.classes[0], lg);
  capyVorschau(capy, daten, { zuordnung });
  const { daten: neu } = capyUebernehmen(daten, capy, zuordnung);
  capyUebernehmen(neu, capy, zuordnung);

  assert.equal(JSON.stringify([capy, daten, zuordnung, lg]), vorher);
  assert.notEqual(neu, daten);
  assert.notEqual(neu.lernende[FR], daten.lernende[FR]);
});

/* ---- Bericht als Satz -------------------------------------------------- */

test('Der Bericht als Satz nennt Neues und Übersprungenes, in Einzahl und Mehrzahl', ()=>{
  const { bericht } = capyUebernehmen(frisch(), capyExport(), { [KLASSE_A]: FR });
  assert.equal(
    capyBerichtText(bericht),
    'Übernommen: 4 Beobachtungen, 3 Lernende und 2 Fragen. 2 Beobachtungen ohne Lerngruppe übersprungen. 1 Beobachtung mit ungültigem Wert übersprungen.',
  );
  assert.equal(
    capyBerichtText({ beobachtungen: 1, lernende: 1, lernendeVorhanden: 1, schonVorhanden: 1 }),
    'Übernommen: 1 Beobachtung und 1 Lernende. 1 Lernende stand schon in der Liste. 1 Beobachtung war schon vorhanden.',
  );
  assert.equal(
    capyBerichtText({ fragen: 1, lernendeVorhanden: 5, schonVorhanden: 6 }),
    'Übernommen: 1 Frage. 5 Lernende standen schon in der Liste. 6 Beobachtungen waren schon vorhanden.',
  );
  assert.equal(
    capyBerichtText({ ungueltig: 1, unvollstaendig: 1 }),
    'Nichts Neues übernommen. 1 Beobachtung mit ungültigem Wert übersprungen. 1 Beobachtung ohne Lernende, Frage oder Datum übersprungen.',
  );
  assert.equal(capyBerichtText({}), 'Nichts Neues übernommen.');
  assert.equal(capyBerichtText(null), 'Nichts Neues übernommen.');
  assert.equal(capyBerichtText({ beobachtungen: -3, fragen: 'zwei' }), 'Nichts Neues übernommen.');
});
