/* ============================================================
   Das Austauschformat

   Geprüft wird, was zwischen zwei Anwendungen schiefgehen kann:
   Verträglichkeit der Schemafassung, Umgang mit fremden und kaputten
   Dateien, Stabilität der Kennungen – und dass französische Akzente
   den Weg unbeschadet überstehen.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXCHANGE_SCHEMA_VERSION, FORMAT_LESSON, FORMAT_LESSON_BUNDLE,
  normalisiereStunde, leseStunden, leseStundenDatei, packeStunden,
  dateiname, gesamtdauer, anzeigeName,
  leseProfil, leseProfilDatei, normalisiereProfil, profilUmfang,
  classIdFor, subjectIdFor, groupIdFor, neueExternalId,
  ExchangeError, FEHLER,
} from '../shared/exchange/index.js';

/* ---- Stabile Kennungen ---------------------------------------------- */

test('Kennungen sind stabil und unabhängig von Schreibweise und Leerraum', ()=>{
  assert.equal(classIdFor('9b'), classIdFor(' 9B '));
  assert.equal(subjectIdFor('Französisch'), subjectIdFor('französisch'));
  assert.notEqual(classIdFor('9b'), classIdFor('9c'));
  assert.match(classIdFor('9b'), /^class_[0-9a-z]+$/);
});

test('Kennungen sind unabhängig von der Unicode-Normalform', ()=>{
  // "Französisch" mit vorgefertigtem ö (U+00F6) gegen o + Trema (U+0308)
  const nfc = 'Franz\u00F6sisch';
  const nfd = 'Franzo\u0308sisch';
  assert.notEqual(nfc, nfd);                 // wirklich zwei verschiedene Zeichenketten
  assert.equal(subjectIdFor(nfc), subjectIdFor(nfd));
});

test('Die Lerngruppe ist das Paar aus Klasse und Fach', ()=>{
  assert.notEqual(groupIdFor('9b', 'Französisch'), groupIdFor('9b', 'Englisch'));
  assert.equal(groupIdFor('9b', 'Französisch'), groupIdFor('9B', ' französisch '));
});

test('Jede externalId ist eine andere', ()=>{
  const menge = new Set(Array.from({ length: 200 }, ()=> neueExternalId()));
  assert.equal(menge.size, 200);
});

/* ---- Normalisierung -------------------------------------------------- */

test('Eine fast leere Stunde ist gültig und bekommt eine Kennung', ()=>{
  const s = normalisiereStunde({ topic: 'Les loisirs' });
  assert.equal(s.format, FORMAT_LESSON);
  assert.equal(s.schemaVersion, EXCHANGE_SCHEMA_VERSION);
  assert.ok(s.externalId);
  assert.equal(s.topic, 'Les loisirs');
  assert.equal(s.phases, undefined);       // leere Felder reisen nicht mit
});

test('Lernziele werden als Zeichenkette wie als Objekt angenommen', ()=>{
  const s = normalisiereStunde({ learningGoals: ['Ziel A', { text: 'Ziel B' }, '', null] });
  assert.deepEqual(s.learningGoals, [{ text: 'Ziel A' }, { text: 'Ziel B' }]);
});

test('Kompetenzen behalten Mengensemantik und Herkunft', ()=>{
  const s = normalisiereStunde({
    competencies: [
      { label: 'Hörverstehen', source: 'system' },
      'Hörverstehen',
      { label: 'Gesprächsstrategien' },
    ],
  });
  assert.equal(s.competencies.length, 2);
  assert.equal(s.competencies[0].source, 'system');
  assert.equal(s.competencies[1].source, 'custom');
});

test('Phasen behalten Reihenfolge, Dauer und Materialangaben', ()=>{
  const s = normalisiereStunde({
    phases: [
      { title: 'Einstieg', duration: 5, content: 'Bildimpuls' },
      { title: 'Partnerarbeit', duration: 20, material: 'Buch S. 53', materialLink: 'https://example.org' },
    ],
  });
  assert.equal(s.phases.length, 2);
  assert.equal(s.phases[1].material, 'Buch S. 53');
  assert.equal(s.phases[1].materialLink, 'https://example.org');
  assert.equal(gesamtdauer(s), 25);
});

test('Unsinnige Dauern fallen auf einen brauchbaren Wert zurück', ()=>{
  const s = normalisiereStunde({ phases: [{ title: 'X', duration: 'viel' }, { title: 'Y', duration: -3 }] });
  assert.equal(s.phases[0].duration, 5);
  assert.equal(s.phases[1].duration, 5);
});

test('Ungültige Datumsangaben werden verworfen statt übernommen', ()=>{
  assert.equal(normalisiereStunde({ date: '27.08.2026' }).date, undefined);
  assert.equal(normalisiereStunde({ date: '2026-13-45' }).date, undefined);
  assert.equal(normalisiereStunde({ date: '2026-08-27' }).date, '2026-08-27');
});

test('Akzente und Sonderzeichen überstehen den Weg durch JSON', ()=>{
  const original = {
    topic: 'Les loisirs à Montréal – ça va ?',
    notes: 'Œuvre, Ça, ñ, ß, „Anführung“',
    phases: [{ title: 'Élève', content: 'Où est-ce qu\'on va ?' }],
  };
  const datei = JSON.stringify(normalisiereStunde(original));
  const [zurueck] = leseStundenDatei(datei);
  assert.equal(zurueck.topic, original.topic);
  assert.equal(zurueck.notes, original.notes);
  assert.equal(zurueck.phases[0].title, 'Élève');
  assert.equal(zurueck.phases[0].content, "Où est-ce qu'on va ?");
});

test('Der Dateiname bleibt betriebssystemtauglich, der Inhalt akzentuiert', ()=>{
  const s = normalisiereStunde({ topic: 'Les loisirs à Montréal', className: '9b', subjectName: 'Französisch' });
  const name = dateiname(s);
  assert.match(name, /\.prepybara-lesson$/);
  assert.doesNotMatch(name, /[àéêç\/\\:*?"<>|]/);
  assert.match(name, /Les-loisirs-a-Montreal/);
  assert.equal(anzeigeName(s), 'Les loisirs à Montréal');
});

/* ---- Prüfung und Schemafassung --------------------------------------- */

test('Kein JSON: verständliche Meldung statt Absturz', ()=>{
  assert.throws(()=> leseStundenDatei('das ist keine json-datei'), (err)=>{
    assert.ok(err instanceof ExchangeError);
    assert.equal(err.code, FEHLER.KEIN_JSON);
    assert.match(err.message, /lesen/i);
    return true;
  });
});

test('Fremde JSON-Datei wird als solche erkannt', ()=>{
  assert.throws(()=> leseStundenDatei('{"foo":1}'), (err)=>{
    assert.equal(err.code, FEHLER.FALSCHES_FORMAT);
    assert.match(err.message, /kein gültiger/i);
    return true;
  });
});

test('Fehlende Schemafassung wird gemeldet', ()=>{
  assert.throws(
    ()=> leseStunden({ format: FORMAT_LESSON, externalId: 'x' }),
    (err)=>{ assert.equal(err.code, FEHLER.FEHLENDE_VERSION); return true; }
  );
});

test('Neuere Schemafassung: klare Meldung, kein Rateversuch', ()=>{
  assert.throws(
    ()=> leseStunden({ format: FORMAT_LESSON, schemaVersion: EXCHANGE_SCHEMA_VERSION + 1 }),
    (err)=>{
      assert.equal(err.code, FEHLER.ZU_NEU);
      assert.match(err.message, /neueren Fassung/i);
      assert.equal(err.details.gefunden, EXCHANGE_SCHEMA_VERSION + 1);
      return true;
    }
  );
});

test('Nichts von alledem wirft etwas anderes als ExchangeError', ()=>{
  const muell = ['', '[]', 'null', '{}', '{"format":"prepybara-lesson"}', '"text"', '12'];
  for (const m of muell) {
    assert.throws(()=> leseStundenDatei(m), (err)=> err instanceof ExchangeError, `Eingabe: ${m}`);
  }
});

/* ---- Paket ----------------------------------------------------------- */

test('Mehrere Stunden reisen als eine Datei', ()=>{
  const paket = packeStunden([
    normalisiereStunde({ topic: '9b Montag', className: '9b' }),
    normalisiereStunde({ topic: '6a Montag', className: '6a' }),
    normalisiereStunde({ topic: '11 Dienstag', className: '11' }),
  ]);
  assert.equal(paket.format, FORMAT_LESSON_BUNDLE);
  const gelesen = leseStundenDatei(JSON.stringify(paket));
  assert.equal(gelesen.length, 3);
  assert.equal(gelesen[2].topic, '11 Dienstag');
});

test('Einzeldatei und Paket kommen über denselben Weg zurück', ()=>{
  const eine = leseStundenDatei(JSON.stringify(normalisiereStunde({ topic: 'A' })));
  assert.equal(eine.length, 1);
});

test('Ein leeres Paket ist ein Fehler, kein stiller Erfolg', ()=>{
  assert.throws(()=> leseStunden(packeStunden([])), (err)=> err instanceof ExchangeError);
});

/* ---- Profil ---------------------------------------------------------- */

test('Profil: Prüfung und Umfang', ()=>{
  const profil = normalisiereProfil({
    languageMode: true,
    groups: [{ className: '9b', subjectName: 'Französisch' }],
    subjects: [{ name: 'Französisch' }],
    competencies: ['Hörverstehen', { label: 'Schreiben', area: 'production' }],
    speechActs: [{ label: 'begründen', source: 'system' }],
  });
  const gelesen = leseProfilDatei(JSON.stringify(profil));
  const umfang = profilUmfang(gelesen);
  assert.equal(umfang.groups, 1);
  assert.equal(umfang.competencies, 2);
  assert.equal(umfang.speechActs, 1);
  assert.equal(gelesen.languageMode, true);
  assert.equal(gelesen.groups[0].classId, classIdFor('9b'));
});

test('Profil: eine Stundendatei wird nicht als Profil angenommen', ()=>{
  const stunde = JSON.stringify(normalisiereStunde({ topic: 'A' }));
  assert.throws(()=> leseProfilDatei(stunde), (err)=>{
    assert.equal(err.code, FEHLER.FALSCHES_FORMAT);
    assert.match(err.message, /Profil/);
    return true;
  });
});

test('Profil: unbrauchbare Stundenplaneinträge fallen weg, gute bleiben', ()=>{
  const profil = normalisiereProfil({
    timetable: [
      { date: '2026-08-27', lessonNumber: 3, className: '9b', subjectName: 'Französisch' },
      { date: 'irgendwann', lessonNumber: 3 },
      { date: '2026-08-27' },
    ],
  });
  assert.equal(profil.timetable.length, 1);
  assert.equal(profil.timetable[0].groupId, groupIdFor('9b', 'Französisch'));
});

test('Profil: neuere Schemafassung wird abgelehnt', ()=>{
  assert.throws(
    ()=> leseProfil({ format: 'prepybara-profile', schemaVersion: 99 }),
    (err)=>{ assert.equal(err.code, FEHLER.ZU_NEU); return true; }
  );
});
