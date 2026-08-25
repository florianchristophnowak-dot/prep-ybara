/* ============================================================
   Der ganze Weg: Desktop → Profil → Pocket → Stunde → Desktop

   Hier wird nicht das Format geprüft (das tut austausch.test.mjs),
   sondern was die Desktop-App damit macht: Zuordnung über stabile
   Kennungen, Übernahme der Phasen, neue Kennungen, Konflikte,
   Doppelimport.

   defaultLesson und normalizeLesson liegen in app.jsx und sind wegen
   JSX und Bild-Importen ohne Bündler nicht ladbar. Sie werden hier
   nachgebildet – bewusst mit denselben Feldnamen und derselben
   Grundform, damit die Prüfung aussagekräftig bleibt. Die Abbildung
   selbst (pocket-import.js) ist die echte.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalisiereStunde, packeStunden, classIdFor, subjectIdFor, groupIdFor } from '../shared/exchange/index.js';
import { buildPocketProfile } from '../renderer/src/pocket-profile.js';
import {
  MODI, analysierePocketStunde, fuehrePocketImportAus, pocketZuStundenfeldern,
  naechsterFreierSlot, pruefeZiel, zielFuer, vorschauZeilen,
} from '../renderer/src/pocket-import.js';

/* ---- Nachbildungen der Desktop-Werkzeuge ----------------------------- */

let zaehler = 0;
const uid = ()=> `id-${++zaehler}`;

function defaultLesson(){
  return {
    subject: '', classGroup: '', room: '', topic: '', objectives: '',
    phases: [], homework: '', notes: '', files: [], links: [],
    sequenceId: '', primaryCompetency: '', competencies: [],
    successCriteria: [],
    communicativeTask: { text: '', situation: '', audience: '', intention: '', outcome: '' },
    speechActs: [],
    languageResources: { vocabulary: '', grammar: '', pronunciation: '', other: '' },
    progressionNote: '', planningProfile: 'standard', customPlanningFields: [],
    preferredExportLayout: '', review: {}, updatedAt: new Date().toISOString(),
  };
}

function normalizeLesson(lesson){
  const basis = defaultLesson();
  const l = (lesson && typeof lesson === 'object') ? lesson : {};
  return {
    ...basis,
    ...l,
    phases: (Array.isArray(l.phases) ? l.phases : []).map(p => ({ ...p, id: p.id || uid() })),
    competencies: Array.isArray(l.competencies) ? l.competencies : [],
    speechActs: Array.isArray(l.speechActs) ? l.speechActs : [],
  };
}

const werkzeuge = { uid, defaultLesson, normalizeLesson };

/* ---- Eine kleine Desktop-Datenbank ----------------------------------- */

function beispielDb(){
  return {
    schemaVersion: 9,
    classGroups: { '9b': { count: 12, lastUsed: '2026-08-20T10:00:00.000Z' }, '6a': { count: 4, lastUsed: '' } },
    subjects: { 'Französisch': { count: 16, lastUsed: '2026-08-20T10:00:00.000Z' } },
    competencies: { 'mündliche Interaktion': { count: 3, lastUsed: '' } },
    speechActs: { 'nachfragen': { count: 1, lastUsed: '' }, 'Einwände abwägen': { count: 2, lastUsed: '' } },
    socialForms: { 'Partnerarbeit': { count: 9, lastUsed: '' }, 'Plenum': { count: 5, lastUsed: '' } },
    phaseNames: { 'Erarbeitung': { count: 7, lastUsed: '' } },
    scaffoldLabels: {},
    hiddenSuggestions: {},
    groupColors: { '9b|Französisch': { color: '#dbeafe' } },
    appSettings: { languageMode: true },
    competencyModel: { customAreas: [], areaOf: {}, hidden: {} },
    schoolCalendar: { lessonTimesEnabled: true, lessonTimes: [{ start: '08:00' }, { start: '08:50' }, { start: '09:55' }] },
    weeks: {
      '2026-08-24': {
        slotsPerDay: 6,
        lessons: {
          // Donnerstag (dayIndex 3), 3. Stunde (slotIndex 2)
          '3-2': {
            classGroup: '9b', subject: 'Französisch', topic: 'Bereits geplant',
            phases: [{ id: 'alt-1', title: 'Alte Phase', duration: 45, content: 'Steht schon da' }],
            competencies: [], sequenceId: 'seq-1',
          },
          '0-0': { classGroup: '6a', subject: 'Französisch', topic: '', phases: [] },
        },
        duties: {},
      },
    },
  };
}

/* Eine Pocket-Stunde, wie sie die mobile App erzeugt. */
function pocketStunde(patch = {}){
  return normalisiereStunde({
    externalId: 'pocket_test_1',
    className: '9b',
    subjectName: 'Französisch',
    classId: classIdFor('9b'),
    subjectId: subjectIdFor('Französisch'),
    groupId: groupIdFor('9b', 'Französisch'),
    date: '2026-08-27',            // Donnerstag
    lessonNumber: 4,               // slotIndex 3 – frei
    topic: 'Les loisirs à Montréal',
    learningGoals: [{ text: 'Die Lernenden können Vorschläge machen und darauf reagieren.' }],
    competencies: [
      { label: 'mündliche Interaktion', source: 'system' },
      { label: 'Gesprächsstrategien', source: 'custom' },
    ],
    primaryCompetency: 'mündliche Interaktion',
    speechActs: [{ label: 'Vorschläge machen', source: 'system' }, { label: 'Kompromisse aushandeln', source: 'custom' }],
    communicativeTask: { text: 'Gemeinsam ein Wochenendprogramm planen', situation: 'Austausch in Montréal' },
    languageResources: { vocabulary: 'les loisirs, la sortie' },
    phases: [
      { title: 'Einstieg', duration: 5, content: 'Bildimpuls', socialForm: 'Plenum' },
      { title: 'Partnerarbeit', duration: 20, content: 'Programm planen', socialForm: 'Partnerarbeit', material: 'Buch S. 53', materialLink: 'https://example.org' },
      { title: 'Sicherung', duration: 15, content: 'Vorstellen', socialForm: 'Plenum' },
    ],
    notes: 'Akzente prüfen: à, é, ç',
    ...patch,
  });
}

/* ---- Profil aus der Desktop-Datenbank -------------------------------- */

test('Profil enthält Lerngruppen, Fächer, Stundenplan und Kompetenzen', ()=>{
  const profil = buildPocketProfile(beispielDb(), { todayISO: '2026-08-25', appVersion: '1.0.9' });
  assert.equal(profil.format, 'prepybara-profile');
  assert.equal(profil.languageMode, true);
  assert.ok(profil.groups.some(g => g.className === '9b' && g.subjectName === 'Französisch'));
  assert.ok(profil.subjects.some(f => f.name === 'Französisch'));
  assert.ok(profil.competencies.some(k => k.label === 'Hörverstehen' && k.source === 'system'));
  assert.ok(profil.competencies.some(k => k.label === 'mündliche Interaktion'));
  // "nachfragen" gehört zum Startbestand; die Ablage sagt nur, dass es
  // benutzt wurde. Eigen ist, was dort NICHT steht.
  assert.ok(profil.speechActs.some(s => s.label === 'nachfragen' && s.source === 'system'));
  assert.ok(profil.speechActs.some(s => s.label === 'Einwände abwägen' && s.source === 'custom'));
  assert.ok(profil.socialForms.includes('Partnerarbeit'));
  assert.ok(profil.phaseTypes.includes('Erarbeitung'));
  assert.equal(profil.timetable.length, 2);
  assert.equal(profil.timetable[0].date, '2026-08-24');
});

test('Profil enthält keinerlei Schüler-, Noten- oder Nachbereitungsdaten', ()=>{
  const db = beispielDb();
  db.weeks['2026-08-24'].lessons['3-2'].review = { notes: 'Vertraulich', carryOverItems: [{ id: 'x', text: 'geheim' }] };
  db.todos = [{ id: 't', text: 'Klassenarbeit korrigieren' }];
  const profil = buildPocketProfile(db, { todayISO: '2026-08-25' });
  const alsText = JSON.stringify(profil);
  assert.doesNotMatch(alsText, /Vertraulich|geheim|Klassenarbeit/);
  assert.equal(profil.todos, undefined);
  assert.equal(profil.students, undefined);
  // Der Stundenplan nennt Lerngruppe und Stunde, aber kein Thema.
  assert.doesNotMatch(alsText, /Bereits geplant/);
  assert.equal(profil.timetable.find(e => e.lessonNumber === 3)?.planned, true);
});

test('Profil-Kennungen passen zu denen, die Pocket berechnet', ()=>{
  const profil = buildPocketProfile(beispielDb(), { todayISO: '2026-08-25' });
  const gruppe = profil.groups.find(g => g.className === '9b');
  assert.equal(gruppe.id, groupIdFor('9b', 'Französisch'));
  assert.equal(gruppe.classId, classIdFor('9b'));
});

test('Der Stundenplan-Ausschnitt endet nach den gewählten Wochen', ()=>{
  const db = beispielDb();
  db.weeks['2026-10-05'] = { slotsPerDay: 6, lessons: { '0-0': { classGroup: '9b', subject: 'Französisch' } }, duties: {} };
  const profil = buildPocketProfile(db, { todayISO: '2026-08-25', wochen: 4 });
  assert.ok(!profil.timetable.some(e => e.date.startsWith('2026-10')));
});

/* ---- Analyse --------------------------------------------------------- */

test('Lerngruppe und Fach werden über die stabile Kennung erkannt', ()=>{
  const analyse = analysierePocketStunde(pocketStunde(), beispielDb(), { todayISO: '2026-08-25' });
  assert.equal(analyse.klasse.label, '9b');
  assert.equal(analyse.klasse.treffer, 'id');
  assert.equal(analyse.fach.label, 'Französisch');
  assert.equal(analyse.gruppenName, '9b Französisch');
});

test('Wurde die Lerngruppe umbenannt, rettet der Name die Zuordnung', ()=>{
  const stunde = pocketStunde({ classId: 'class_gibtesnicht' });
  const analyse = analysierePocketStunde(stunde, beispielDb(), { todayISO: '2026-08-25' });
  assert.equal(analyse.klasse.label, '9b');
  assert.equal(analyse.klasse.treffer, 'name');
});

test('Eine im Desktop unbekannte Lerngruppe wird angelegt, nicht verworfen', ()=>{
  const stunde = pocketStunde({ className: '7c', classId: classIdFor('7c') });
  const analyse = analysierePocketStunde(stunde, beispielDb(), { todayISO: '2026-08-25' });
  assert.equal(analyse.klasse.label, '7c');
  assert.equal(analyse.klasse.treffer, 'neu');
});

test('Datum und Stunde ergeben den Termin im Wochenraster', ()=>{
  const analyse = analysierePocketStunde(pocketStunde(), beispielDb(), { todayISO: '2026-08-25' });
  assert.equal(analyse.ziel.weekStart, '2026-08-24');
  assert.equal(analyse.ziel.dayIndex, 3);          // Donnerstag
  assert.equal(analyse.ziel.slotIndex, 3);         // 4. Stunde
  assert.equal(analyse.konflikt, false);
});

test('Ohne Datum gibt es keinen Termin – und keinen Absturz', ()=>{
  const analyse = analysierePocketStunde(pocketStunde({ date: '', lessonNumber: null }), beispielDb(), { todayISO: '2026-08-25' });
  assert.equal(analyse.zielGefunden, false);
  assert.equal(analyse.ziel, null);
});

test('Die Vorschau nennt Phasen, Minuten, Ziele und Kompetenzen', ()=>{
  const analyse = analysierePocketStunde(pocketStunde(), beispielDb(), { todayISO: '2026-08-25' });
  assert.deepEqual(analyse.statistik, {
    phasen: 3, minuten: 40, lernziele: 1, kompetenzen: 2, sprechabsichten: 2, erfolgskriterien: 0,
  });
  const zeilen = vorschauZeilen(analyse);
  assert.ok(zeilen.some(z => z.includes('3 Phasen · 40 Minuten')));
  assert.ok(zeilen.some(z => z === '1 Lernziel'));
});

test('Unbekannte Kompetenzen und Sprechabsichten werden gemeldet', ()=>{
  const analyse = analysierePocketStunde(pocketStunde(), beispielDb(), { todayISO: '2026-08-25' });
  assert.deepEqual(analyse.neueKompetenzen, ['Gesprächsstrategien']);
  assert.deepEqual(analyse.neueSprechabsichten, ['Kompromisse aushandeln']);
});

/* ---- Abbildung ------------------------------------------------------- */

test('Phasen werden vollständig übernommen, Material und Link zusammengeführt', ()=>{
  const felder = pocketZuStundenfeldern(pocketStunde(), { uid });
  assert.equal(felder.phases.length, 3);
  assert.equal(felder.phases[1].title, 'Partnerarbeit');
  assert.equal(felder.phases[1].duration, 20);
  assert.equal(felder.phases[1].socialForm, 'Partnerarbeit');
  assert.equal(felder.phases[1].materialsMedia, 'Buch S. 53\nhttps://example.org');
  assert.equal(felder.phases[1].remarks, '');
});

test('Mehrere Lernziele werden zu Zeilen im Zielfeld', ()=>{
  const stunde = pocketStunde({ learningGoals: [{ text: 'Ziel A' }, { text: 'Ziel B' }] });
  const felder = pocketZuStundenfeldern(stunde, { uid });
  assert.equal(felder.objectives, 'Ziel A\nZiel B');
});

test('Die primäre Kompetenz steht immer auch unter den gewählten', ()=>{
  const stunde = pocketStunde({ competencies: [{ label: 'Schreiben' }], primaryCompetency: 'Leseverstehen' });
  const felder = pocketZuStundenfeldern(stunde, { uid });
  assert.ok(felder.competencies.includes('Leseverstehen'));
  assert.equal(felder.primaryCompetency, 'Leseverstehen');
});

/* ---- Import ---------------------------------------------------------- */

test('Import an einen freien Termin legt die Stunde an', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  const ergebnis = fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
    klasse: analyse.klasse.label, fach: analyse.fach.label,
  }, werkzeuge);

  const gespeichert = db.weeks['2026-08-24'].lessons['3-3'];
  assert.ok(gespeichert);
  assert.equal(gespeichert.topic, 'Les loisirs à Montréal');
  assert.equal(gespeichert.classGroup, '9b');
  assert.equal(gespeichert.subject, 'Französisch');
  assert.equal(gespeichert.phases.length, 3);
  assert.equal(gespeichert.notes, 'Akzente prüfen: à, é, ç');
  assert.equal(gespeichert.communicativeTask.text, 'Gemeinsam ein Wochenendprogramm planen');
  assert.equal(gespeichert.languageResources.vocabulary, 'les loisirs, la sortie');
  assert.equal(ergebnis.ziel.slotIndex, 3);
});

test('Phasen bekommen neue Desktop-Kennungen; die aus Pocket kommen nicht mit', ()=>{
  const db = beispielDb();
  const stunde = pocketStunde({
    phases: [{ id: 'phase_aus_pocket', title: 'Einstieg', duration: 5 }],
  });
  const analyse = analysierePocketStunde(stunde, db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
    klasse: analyse.klasse.label, fach: analyse.fach.label,
  }, werkzeuge);

  const neu = db.weeks['2026-08-24'].lessons['3-3'];
  assert.notEqual(neu.phases[0].id, 'phase_aus_pocket');
  assert.ok(neu.phases[0].id);
  // Keine Kollision mit der bereits vorhandenen Stunde
  const alteIds = db.weeks['2026-08-24'].lessons['3-2'].phases.map(p => p.id);
  assert.ok(!alteIds.includes(neu.phases[0].id));
});

test('Die Pocket-Kennung wird getrennt vermerkt, nicht als Desktop-Kennung benutzt', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
  }, werkzeuge);
  const neu = db.weeks['2026-08-24'].lessons['3-3'];
  assert.equal(neu.pocket.externalId, 'pocket_test_1');
  assert.ok(neu.pocket.importedAt);
  assert.equal(db.pocketImports['pocket_test_1'].count, 1);
});

test('Lerngruppe und Fach landen in den Vorschlägen', ()=>{
  const db = beispielDb();
  const stunde = pocketStunde({ className: '7c', classId: classIdFor('7c') });
  const analyse = analysierePocketStunde(stunde, db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
    klasse: analyse.klasse.label, fach: analyse.fach.label,
  }, werkzeuge);
  assert.ok(db.classGroups['7c']);
});

test('Neue Kompetenzen kommen NUR in die Bibliothek, wenn sie bestätigt wurden', ()=>{
  const ohne = beispielDb();
  const a1 = analysierePocketStunde(pocketStunde(), ohne, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(ohne, { stunde: a1.stunde, modus: MODI.NEU, ziel: a1.ziel }, werkzeuge);
  assert.equal(ohne.competencies['Gesprächsstrategien'], undefined);
  assert.equal(ohne.speechActs['Kompromisse aushandeln'], undefined);
  // In der Stunde selbst steht sie trotzdem.
  assert.ok(ohne.weeks['2026-08-24'].lessons['3-3'].competencies.includes('Gesprächsstrategien'));

  const mit = beispielDb();
  const a2 = analysierePocketStunde(pocketStunde(), mit, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(mit, {
    stunde: a2.stunde, modus: MODI.NEU, ziel: a2.ziel,
    kompetenzenUebernehmen: ['Gesprächsstrategien'],
    sprechabsichtenUebernehmen: ['Kompromisse aushandeln'],
  }, werkzeuge);
  assert.ok(mit.competencies['Gesprächsstrategien']);
  assert.ok(mit.speechActs['Kompromisse aushandeln']);
});

/* ---- Konflikte ------------------------------------------------------- */

test('Ein belegter Termin wird als Konflikt gemeldet, nicht überschrieben', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde({ lessonNumber: 3 }), db, { todayISO: '2026-08-25' });
  assert.equal(analyse.ziel.slotIndex, 2);
  assert.equal(analyse.konflikt, true);
  assert.equal(analyse.bestehendeStunde.topic, 'Bereits geplant');
  // Ohne Aufruf des Imports bleibt alles, wie es war.
  assert.equal(db.weeks['2026-08-24'].lessons['3-2'].topic, 'Bereits geplant');
});

test('Als neue Stunde importieren lässt die bestehende Planung unberührt', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde({ lessonNumber: 3 }), db, { todayISO: '2026-08-25' });
  const frei = naechsterFreierSlot(db, analyse.ziel.weekStart, analyse.ziel.dayIndex);
  assert.equal(frei, 0);
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: { ...analyse.ziel, slotIndex: frei },
  }, werkzeuge);
  assert.equal(db.weeks['2026-08-24'].lessons['3-2'].topic, 'Bereits geplant');
  assert.equal(db.weeks['2026-08-24'].lessons['3-0'].topic, 'Les loisirs à Montréal');
});

test('Anhängen ergänzt die Phasen und lässt Thema und Ziele stehen', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde({ lessonNumber: 3 }), db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.ANHAENGEN, ziel: analyse.ziel,
  }, werkzeuge);
  const stunde = db.weeks['2026-08-24'].lessons['3-2'];
  assert.equal(stunde.topic, 'Bereits geplant');
  assert.equal(stunde.phases.length, 4);
  assert.equal(stunde.phases[0].title, 'Alte Phase');
  assert.equal(stunde.phases[1].title, 'Einstieg');
  assert.ok(stunde.notes.includes('Akzente prüfen'));
});

test('Ersetzen überschreibt die Planung, behält aber die Sequenzzuordnung', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde({ lessonNumber: 3 }), db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.ERSETZEN, ziel: analyse.ziel,
  }, werkzeuge);
  const stunde = db.weeks['2026-08-24'].lessons['3-2'];
  assert.equal(stunde.topic, 'Les loisirs à Montréal');
  assert.equal(stunde.phases.length, 3);
  assert.equal(stunde.sequenceId, 'seq-1');
});

test('Anhängen ohne bestehende Stunde ist ein Fehler, kein stiller Neuanfang', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  assert.throws(()=> fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.ANHAENGEN, ziel: analyse.ziel,
  }, werkzeuge), /keine Stunde/);
});

test('Ohne Termin wird nicht importiert', ()=>{
  const db = beispielDb();
  const analyse = analysierePocketStunde(pocketStunde({ date: '', lessonNumber: null }), db, { todayISO: '2026-08-25' });
  assert.throws(()=> fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
  }, werkzeuge), /Termin/);
});

/* ---- Doppelimport ---------------------------------------------------- */

test('Derselbe Pocket-Entwurf wird beim zweiten Mal erkannt', ()=>{
  const db = beispielDb();
  const a1 = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  assert.equal(a1.bereitsImportiert, null);
  fuehrePocketImportAus(db, { stunde: a1.stunde, modus: MODI.NEU, ziel: a1.ziel }, werkzeuge);

  const a2 = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  assert.ok(a2.bereitsImportiert);
  assert.equal(a2.bereitsImportiert.externalId, 'pocket_test_1');
});

test('Der Vermerk überlebt das Löschen der Stunde', ()=>{
  const db = beispielDb();
  const a1 = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  fuehrePocketImportAus(db, { stunde: a1.stunde, modus: MODI.NEU, ziel: a1.ziel }, werkzeuge);
  delete db.weeks['2026-08-24'].lessons['3-3'];
  const a2 = analysierePocketStunde(pocketStunde(), db, { todayISO: '2026-08-25' });
  assert.ok(a2.bereitsImportiert);
});

/* ---- Termin von Hand ------------------------------------------------- */

test('Ein von Hand gewählter Termin wird richtig gerechnet und geprüft', ()=>{
  const db = beispielDb();
  const ziel = zielFuer('2026-08-27', 3);
  assert.deepEqual(ziel, { dateISO: '2026-08-27', weekStart: '2026-08-24', dayIndex: 3, slotIndex: 2, lessonNumber: 3 });
  const geprueft = pruefeZiel(db, ziel);
  assert.equal(geprueft.belegt, true);
  assert.equal(geprueft.konflikt, true);

  const frei = pruefeZiel(db, zielFuer('2026-08-27', 5));
  assert.equal(frei.belegt, false);
  assert.equal(frei.konflikt, false);
});

test('Ein unvollständiger Termin ergibt null statt eines falschen Platzes', ()=>{
  assert.equal(zielFuer('', 3), null);
  assert.equal(zielFuer('2026-08-27', 0), null);
  assert.equal(zielFuer('kein Datum', 3), null);
});

/* ---- Paket mit mehreren Stunden -------------------------------------- */

test('Ein Paket wird Stunde für Stunde analysiert und importiert', ()=>{
  const db = beispielDb();
  const paket = packeStunden([
    pocketStunde({ externalId: 'p1', lessonNumber: 4, topic: 'Erste' }),
    pocketStunde({ externalId: 'p2', lessonNumber: 5, topic: 'Zweite' }),
  ]);
  for (const stunde of paket.lessons) {
    const analyse = analysierePocketStunde(stunde, db, { todayISO: '2026-08-25' });
    fuehrePocketImportAus(db, { stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel }, werkzeuge);
  }
  assert.equal(db.weeks['2026-08-24'].lessons['3-3'].topic, 'Erste');
  assert.equal(db.weeks['2026-08-24'].lessons['3-4'].topic, 'Zweite');
  assert.equal(Object.keys(db.pocketImports).length, 2);
});

/* ---- Rundlauf -------------------------------------------------------- */

test('Rundlauf: Desktop → Profil → Pocket-Kennungen → Import trifft die Lerngruppe', ()=>{
  const db = beispielDb();
  const profil = buildPocketProfile(db, { todayISO: '2026-08-25' });
  const gruppe = profil.groups[0];

  // Pocket erzeugt die Stunde mit genau diesen Kennungen.
  const ausPocket = normalisiereStunde({
    externalId: 'pocket_rundlauf',
    className: gruppe.className, subjectName: gruppe.subjectName,
    classId: gruppe.classId, subjectId: gruppe.subjectId, groupId: gruppe.id,
    date: '2026-08-26', lessonNumber: 2,
    topic: 'Ça marche',
    phases: [{ title: 'Einstieg', duration: 10, content: 'Où ?' }],
  });

  const analyse = analysierePocketStunde(JSON.parse(JSON.stringify(ausPocket)), db, { todayISO: '2026-08-25' });
  assert.equal(analyse.klasse.treffer, 'id');
  assert.equal(analyse.fach.treffer, 'id');

  fuehrePocketImportAus(db, {
    stunde: analyse.stunde, modus: MODI.NEU, ziel: analyse.ziel,
    klasse: analyse.klasse.label, fach: analyse.fach.label,
  }, werkzeuge);

  const stunde = db.weeks['2026-08-24'].lessons['2-1'];
  assert.equal(stunde.topic, 'Ça marche');
  assert.equal(stunde.classGroup, '9b');
  assert.equal(stunde.phases[0].content, 'Où ?');
});
