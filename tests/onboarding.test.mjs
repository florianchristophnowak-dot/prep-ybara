/* ============================================================
   Onboarding

   Geprüft wird, was darüber entscheidet, ob jemand eine Einführung zu
   sehen bekommt – und ob er sie wieder loswird:

     - Eine leere Datenbank startet sie, eine benutzte nicht.
     - Importierte Daten überspringen den Schnellstart.
     - Schritte gelten erst als erledigt, wenn sie getan sind.
     - Ein Hinweis erscheint höchstens einmal je Sitzung und nie zu
       einer Funktion, die längst benutzt wird.
     - "Später" und "Nicht mehr anzeigen" sind zweierlei.
     - Zurücksetzen fasst keine Unterrichtsdaten an.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONBOARDING_VERSION, STATUS, PFADE, SCHRITTE, HINWEISE,
  leeresOnboarding, normalisiereOnboarding,
  istLeereDatenbank, datenSchritte, schritteAus, anzahlErledigt, schnellstartFertig,
  schnellstartSchritt, onboardingKontext, naechsterHinweis, merkeHinweis, istHinweisErledigt,
  starteOnboarding, pausiereOnboarding, ueberspringeOnboarding, schliesseOnboardingAb,
  markiereSchritt, setzeCheckliste, setzeBackupZeitpunkt,
  starteSchnellstartNeu, setzeHinweiseZurueck,
  ersterFreierPlatz, zeigeWillkommen, zeigeCheckliste,
} from '../renderer/src/onboarding.js';

function stunde(patch = {}){
  return {
    subject: '', classGroup: '', room: '', topic: '', objectives: '',
    phases: [
      { id: 'p1', title: 'Einstieg', duration: 5, socialForm: '', content: '', materialsMedia: '', remarks: '' },
      { id: 'p2', title: 'Erarbeitung', duration: 40, socialForm: '', content: '', materialsMedia: '', remarks: '' },
    ],
    homework: '', notes: '', files: [], links: [], sequenceId: '', competencies: [], blockSpan: 1,
    review: { status: 'not_reviewed', generalNotes: '', phaseReviews: {}, carryOverItems: [], reviewedAt: '' },
    ...patch,
  };
}

function leereDb(){
  return {
    weeks: {}, sequences: {}, sequenceTemplates: {}, yearBars: [], yearPlanLanes: [],
    todos: [], schoolYearArchives: [], classGroups: {}, subjects: {}, groupColors: {},
    schoolCalendar: { schoolYear: { startISO: '', endISO: '' }, vacations: [], freeDays: [], events: [], lessonTimes: [] },
    appSettings: {},
  };
}

function dbMitStunde(patch = {}){
  const db = leereDb();
  db.weeks['2026-08-31'] = { slotsPerDay: 6, lessons: { '0-2': stunde(patch) }, duties: {} };
  return db;
}

/* ---- Erster Start ------------------------------------------------------ */

test('Eine leere Datenbank startet die Einführung', ()=>{
  const db = leereDb();
  assert.equal(istLeereDatenbank(db), true);
  assert.equal(zeigeWillkommen(db, null), true);
});

test('Eine Datenbank mit Stunden startet sie nicht', ()=>{
  const db = dbMitStunde({ topic: 'Bruchrechnung' });
  assert.equal(istLeereDatenbank(db), false);
  assert.equal(zeigeWillkommen(db, null), false);
});

test('Auch Sequenzen, Vorlagen, Balken, To-dos und Archive zählen als benutzt', ()=>{
  for (const patch of [
    { sequences: { s1: { id: 's1', name: 'X' } } },
    { sequenceTemplates: { t1: { id: 't1', name: 'X' } } },
    { yearBars: [{ id: 'b1', title: 'X' }] },
    { todos: [{ id: 't', text: 'X' }] },
    { schoolYearArchives: [{ id: 'a1', label: 'X', data: {} }] },
    { classGroups: { '9b': { count: 1 } } },
    { subjects: { 'Französisch': { count: 1 } } },
    { groupColors: { '9b||Französisch': { color: '#fff' } } },
  ]) {
    const db = { ...leereDb(), ...patch };
    assert.equal(istLeereDatenbank(db), false, JSON.stringify(Object.keys(patch)));
  }
});

test('Ein eingerichteter Schulkalender zählt ebenfalls als benutzt', ()=>{
  const db = leereDb();
  db.schoolCalendar.vacations = [{ id: 'v1', name: 'Herbstferien', startISO: '2026-10-05', endISO: '2026-10-16' }];
  assert.equal(istLeereDatenbank(db), false);
});

test('Eine Aufsicht ohne Stunde zählt auch als benutzt', ()=>{
  const db = leereDb();
  db.weeks['2026-08-31'] = { slotsPerDay: 6, lessons: {}, duties: { '0-1': { id: 'd', title: 'Hofaufsicht' } } };
  assert.equal(istLeereDatenbank(db), false);
});

test('Importierte Daten überspringen den Schnellstart', ()=>{
  /* Nach einem Import ist die Datenbank nicht mehr leer – die
     Willkommensansicht erscheint nicht wieder, und die Schritte sind
     bereits erledigt. */
  const db = dbMitStunde({ classGroup: '9b', subject: 'Französisch', topic: 'Import', phases: [{ id: 'p', title: 'Einstieg', socialForm: 'Plenum' }] });
  const zustand = ueberspringeOnboarding(starteOnboarding(leeresOnboarding(), { pfad: PFADE.IMPORT }));
  assert.equal(zeigeWillkommen(db, zustand), false);
  assert.equal(zeigeCheckliste(db, zustand), false);
  assert.equal(schnellstartFertig(schritteAus(db, zustand)), true);
});

/* ---- Zustand und Verträglichkeit --------------------------------------- */

test('Eine Datenbank ohne Onboarding-Felder bekommt sinnvolle Standardwerte', ()=>{
  const z = normalisiereOnboarding(undefined);
  assert.equal(z.version, ONBOARDING_VERSION);
  assert.equal(z.status, STATUS.NEU);
  assert.deepEqual(z.schritte, {});
  assert.deepEqual(z.hinweise, {});
  assert.equal(z.checkliste.sichtbar, true);
  assert.equal(z.letztesBackup, '');
});

test('Unsinnige gespeicherte Werte fallen auf Gültiges zurück', ()=>{
  const z = normalisiereOnboarding({
    version: 'zwei', status: 'irgendwas', pfad: 'unbekannt',
    schritte: { lerngruppe: true, quatsch: '2026-01-01' },
    hinweise: { makro: { status: 'weissnicht' }, pocket: { status: 'nie', at: 'x' } },
    checkliste: 'kaputt',
  });
  assert.equal(z.version, ONBOARDING_VERSION);
  assert.equal(z.status, STATUS.NEU);
  assert.equal(z.pfad, '');
  assert.ok(z.schritte.lerngruppe, 'ein wahrer Wert wird zum Zeitstempel');
  assert.equal('quatsch' in z.schritte, false);
  assert.equal('makro' in z.hinweise, false);
  assert.equal(z.hinweise.pocket.status, 'nie');
  assert.equal(z.checkliste.sichtbar, true);
});

test('Ein gespeicherter Stand überlebt die Normalisierung unverändert', ()=>{
  const z = starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE, jetzt: '2026-08-31T08:00:00.000Z' });
  assert.deepEqual(normalisiereOnboarding(z), z);
});

/* ---- Schritte durch echte Handlungen ------------------------------------ */

test('Eine leere Stunde erledigt noch keinen Schritt ausser dem Anlegen', ()=>{
  const db = dbMitStunde();
  assert.deepEqual(datenSchritte(db), { lerngruppe: false, stunde: true, phase: false });
});

test('Klasse und Fach zusammen ergeben die Lerngruppe', ()=>{
  assert.equal(datenSchritte(dbMitStunde({ classGroup: '9b' })).lerngruppe, false);
  assert.equal(datenSchritte(dbMitStunde({ subject: 'Französisch' })).lerngruppe, false);
  assert.equal(datenSchritte(dbMitStunde({ classGroup: '9b', subject: 'Französisch' })).lerngruppe, true);
});

test('Eine Phase gilt erst als geplant, wenn etwas darin steht', ()=>{
  // Die vier vorgeschlagenen Phasennamen einer neuen Stunde zählen nicht.
  assert.equal(datenSchritte(dbMitStunde()).phase, false);
  assert.equal(datenSchritte(dbMitStunde({
    phases: [{ id: 'p', title: 'Einstieg', socialForm: 'Plenum' }],
  })).phase, true);
  assert.equal(datenSchritte(dbMitStunde({
    phases: [{ id: 'p', title: 'Einstieg', content: 'Bildimpuls' }],
  })).phase, true);
});

test('Vermerkte Schritte ergänzen die Daten, ersetzen sie aber nicht', ()=>{
  const db = dbMitStunde();
  const z = markiereSchritt(leeresOnboarding(), 'stunde');
  const schritte = schritteAus(db, z);
  assert.equal(schritte.stunde, true);
  assert.equal(schritte.phase, false);
  assert.equal(anzahlErledigt(schritte), 1);
  assert.equal(schnellstartFertig(schritte), false);
});

test('Alle drei Schritte zusammen schliessen den Schnellstart ab', ()=>{
  const db = dbMitStunde({
    classGroup: '9b', subject: 'Französisch',
    phases: [{ id: 'p', title: 'Einstieg', socialForm: 'Plenum' }],
  });
  const schritte = schritteAus(db, leeresOnboarding());
  assert.deepEqual(schritte, { lerngruppe: true, stunde: true, phase: true });
  assert.equal(schnellstartFertig(schritte), true);
  assert.equal(anzahlErledigt(schritte), SCHRITTE.length);
});

test('Ein Schritt wird nur einmal vermerkt', ()=>{
  const eins = markiereSchritt(leeresOnboarding(), 'stunde', { jetzt: '2026-01-01T00:00:00.000Z' });
  const zwei = markiereSchritt(eins, 'stunde', { jetzt: '2026-02-02T00:00:00.000Z' });
  assert.equal(zwei.schritte.stunde, '2026-01-01T00:00:00.000Z');
  // Unbekannte Schritte werden nicht angelegt.
  assert.equal('erfunden' in markiereSchritt(eins, 'erfunden').schritte, false);
});

/* ---- Die Führung selbst -------------------------------------------------- */

test('Ausserhalb der Stunde führt der Schnellstart zum Wochenraster', ()=>{
  assert.equal(schnellstartSchritt({ ansicht: 'week', schritte: {} }), 'stunde');
  assert.equal(schnellstartSchritt({ ansicht: 'week', schritte: { stunde: true } }), '');
});

test('In der Stunde erscheint jede Erklärung erst nach der vorherigen', ()=>{
  const folge = [
    [{}, 'lerngruppe'],
    [{ lerngruppe: true }, 'thema'],
    [{ lerngruppe: true, thema: true }, 'lernziel'],
    [{ lerngruppe: true, thema: true, lernziel: true }, 'phase'],
    [{ lerngruppe: true, thema: true, lernziel: true, phase: true }, 'abschluss'],
  ];
  for (const [entwurf, erwartet] of folge) {
    assert.equal(schnellstartSchritt({ ansicht: 'lesson', entwurf }), erwartet, JSON.stringify(entwurf));
  }
});

test('Der erste freie Stundenplatz überspringt belegte', ()=>{
  const db = leereDb();
  db.weeks['2026-08-31'] = { slotsPerDay: 6, lessons: { '0-0': stunde(), '1-0': stunde(), '2-0': stunde(), '3-0': stunde(), '4-0': stunde() }, duties: {} };
  assert.deepEqual(ersterFreierPlatz(db, '2026-08-31'), { dayIndex: 0, slotIndex: 1 });
  assert.deepEqual(ersterFreierPlatz(leereDb(), '2026-08-31'), { dayIndex: 0, slotIndex: 0 });
});

/* ---- Pausieren, Überspringen, Fortsetzen --------------------------------- */

test('Ein pausiertes Onboarding lässt sich fortsetzen', ()=>{
  const db = leereDb();
  const pausiert = pausiereOnboarding(starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE }));
  assert.equal(pausiert.status, STATUS.PAUSIERT);
  // Beim nächsten Start ist die Willkommensansicht wieder da …
  assert.equal(zeigeWillkommen(db, pausiert), true);
  // … und der Schnellstart läuft weiter, ohne den Fortschritt zu verlieren.
  const fortgesetzt = starteOnboarding(pausiert, { pfad: PFADE.STUNDE });
  assert.equal(fortgesetzt.status, STATUS.AKTIV);
  assert.equal(fortgesetzt.gestartetAm, pausiert.gestartetAm);
});

test('Ein übersprungenes Onboarding erscheint nicht erneut', ()=>{
  const db = leereDb();
  const uebersprungen = ueberspringeOnboarding(leeresOnboarding());
  assert.equal(uebersprungen.status, STATUS.UEBERSPRUNGEN);
  assert.equal(zeigeWillkommen(db, uebersprungen), false);
  assert.equal(zeigeCheckliste(db, uebersprungen), false);
});

test('Ein abgeschlossenes Onboarding bleibt abgeschlossen', ()=>{
  const fertig = schliesseOnboardingAb(starteOnboarding(leeresOnboarding()));
  assert.equal(fertig.status, STATUS.ABGESCHLOSSEN);
  assert.equal(pausiereOnboarding(fertig).status, STATUS.ABGESCHLOSSEN);
  assert.equal(zeigeWillkommen(leereDb(), fertig), false);
});

test('Während der Einführung erscheint keine zweite Willkommensansicht', ()=>{
  const aktiv = starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE });
  assert.equal(zeigeWillkommen(leereDb(), aktiv), false);
});

test('Die Checkliste verschwindet, sobald alles erledigt ist', ()=>{
  const aktiv = starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE });
  const leer = leereDb();
  assert.equal(zeigeCheckliste(leer, aktiv), true);
  const fertigeDb = dbMitStunde({
    classGroup: '9b', subject: 'Französisch',
    phases: [{ id: 'p', title: 'Einstieg', socialForm: 'Plenum' }],
  });
  assert.equal(zeigeCheckliste(fertigeDb, aktiv), false);
});

test('Die Checkliste lässt sich von Hand ausblenden und einklappen', ()=>{
  const aktiv = starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE });
  const eingeklappt = setzeCheckliste(aktiv, { eingeklappt: true });
  assert.equal(eingeklappt.checkliste.eingeklappt, true);
  assert.equal(zeigeCheckliste(leereDb(), eingeklappt), true, 'eingeklappt ist nicht ausgeblendet');
  const versteckt = setzeCheckliste(aktiv, { sichtbar: false });
  assert.equal(zeigeCheckliste(leereDb(), versteckt), false);
});

/* ---- Kontextbezogene Hinweise -------------------------------------------- */

function dbFuerHinweise(){
  const db = leereDb();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: {
      '0-2': stunde({ classGroup: '9b', subject: 'Französisch', topic: 'A' }),
      '0-3': stunde({ classGroup: '9b', subject: 'Französisch', topic: 'B' }),
    },
    duties: {},
  };
  return db;
}

test('Zwei aufeinanderfolgende Stunden derselben Lerngruppe ergeben den Doppelstunden-Hinweis', ()=>{
  const db = dbFuerHinweise();
  const kontext = onboardingKontext(db, { ansicht: 'week' });
  assert.equal(kontext.hatBenachbarte, true);
  const hinweis = naechsterHinweis({ zustand: leeresOnboarding(), kontext });
  assert.equal(hinweis.id, 'doppelstunde');
});

test('Wer Doppelstunden schon benutzt, bekommt sie nicht erklärt', ()=>{
  const db = dbFuerHinweise();
  db.weeks['2026-08-31'].lessons['2-0'] = stunde({ classGroup: '9b', subject: 'Französisch', blockSpan: 2 });
  const kontext = onboardingKontext(db, { ansicht: 'week' });
  assert.equal(kontext.hatDoppelstunde, true);
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext }), null);
});

test('Verschiedene Lerngruppen nebeneinander ergeben keinen Doppelstunden-Hinweis', ()=>{
  const db = leereDb();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: {
      '0-2': stunde({ classGroup: '9b', subject: 'Französisch' }),
      '0-3': stunde({ classGroup: '7a', subject: 'Mathematik' }),
    },
    duties: {},
  };
  assert.equal(onboardingKontext(db, { ansicht: 'week' }).hatBenachbarte, false);
});

test('Makro-Plan, Jahresplanung und Bibliothek erklären sich beim ersten Öffnen', ()=>{
  const db = leereDb();
  const paare = [['macro', 'makro'], ['year', 'jahresplanung'], ['library', 'bibliothek'], ['pocket', 'pocket']];
  for (const [ansicht, id] of paare) {
    const hinweis = naechsterHinweis({
      zustand: leeresOnboarding(),
      kontext: onboardingKontext(db, { ansicht }),
    });
    assert.equal(hinweis?.id, id, ansicht);
  }
});

test('Wer Sequenzen, Balken oder Vorlagen schon hat, bekommt sie nicht erklärt', ()=>{
  const mitSequenz = dbMitStunde({ sequenceId: 's1' });
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext: onboardingKontext(mitSequenz, { ansicht: 'macro' }) }), null);

  const mitBalken = { ...leereDb(), yearBars: [{ id: 'b1', title: 'X' }] };
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext: onboardingKontext(mitBalken, { ansicht: 'year' }) }), null);

  const mitVorlage = { ...leereDb(), sequenceTemplates: { t1: { id: 't1', name: 'X' } } };
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext: onboardingKontext(mitVorlage, { ansicht: 'library' }) }), null);
});

test('Die Durchführung erklärt sich, wenn sie zum ersten Mal benutzt wird', ()=>{
  const hinweis = naechsterHinweis({
    zustand: leeresOnboarding(),
    kontext: onboardingKontext(leereDb(), { ansicht: 'lesson', ereignis: 'durchfuehrung' }),
  });
  assert.equal(hinweis.id, 'durchfuehrung');
});

test('Eine vergangene Stunde erinnert an die Nachbereitung – aber nur einmal und nicht bei Geübten', ()=>{
  const db = dbMitStunde({ classGroup: '9b', subject: 'Französisch', topic: 'Gehalten' });
  const kontext = onboardingKontext(db, { ansicht: 'week', heuteISO: '2026-09-30' });
  assert.equal(kontext.hatVergangeneStunde, true);
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext }).id, 'nachbereitung');

  const nachbereitet = dbMitStunde({
    classGroup: '9b', subject: 'Französisch', topic: 'Gehalten',
    review: { status: 'reviewed', generalNotes: 'lief gut', phaseReviews: {}, carryOverItems: [], reviewedAt: '2026-09-01' },
  });
  const kontext2 = onboardingKontext(nachbereitet, { ansicht: 'week', heuteISO: '2026-09-30' });
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext: kontext2 }), null);
});

test('Mehrere Planungen ohne Backup führen zur Backup-Empfehlung', ()=>{
  const db = leereDb();
  db.weeks['2026-08-31'] = { slotsPerDay: 6, lessons: {}, duties: {} };
  for (let i = 0; i < 5; i++) db.weeks['2026-08-31'].lessons[`${i}-0`] = stunde({ classGroup: '9b', subject: 'Französisch', topic: `Stunde ${i}` });
  const kontext = onboardingKontext(db, { ansicht: 'week' });
  assert.equal(kontext.stundenAnzahl, 5);
  const hinweis = naechsterHinweis({ zustand: leeresOnboarding(), kontext });
  assert.equal(hinweis.id, 'backup');

  // Nach einem Backup nicht mehr.
  const nachBackup = setzeBackupZeitpunkt(leeresOnboarding(), '2026-08-31T10:00:00.000Z');
  const kontext2 = onboardingKontext(db, { ansicht: 'week', zustand: nachBackup });
  assert.equal(naechsterHinweis({ zustand: nachBackup, kontext: kontext2 }), null);
});

test('Pro Sitzung erscheint höchstens ein Hinweis', ()=>{
  const db = dbFuerHinweise();
  const kontext = onboardingKontext(db, { ansicht: 'week' });
  assert.ok(naechsterHinweis({ zustand: leeresOnboarding(), kontext, sitzung: { gezeigt: false } }));
  assert.equal(naechsterHinweis({ zustand: leeresOnboarding(), kontext, sitzung: { gezeigt: true } }), null);
});

test('„Später" gilt für diese Sitzung, „Verstanden" und „Nicht mehr anzeigen" dauerhaft', ()=>{
  const db = dbFuerHinweise();
  const kontext = onboardingKontext(db, { ansicht: 'week' });

  // Später: nichts wird gespeichert …
  const nachSpaeter = merkeHinweis(leeresOnboarding(), 'doppelstunde', 'spaeter');
  assert.deepEqual(nachSpaeter.hinweise, {});
  // … in derselben Sitzung ist er trotzdem still …
  assert.equal(naechsterHinweis({ zustand: nachSpaeter, kontext, sitzung: { vertagt: ['doppelstunde'] } }), null);
  // … und in der nächsten wieder da.
  assert.equal(naechsterHinweis({ zustand: nachSpaeter, kontext }).id, 'doppelstunde');

  for (const wahl of ['verstanden', 'nie']) {
    const gemerkt = merkeHinweis(leeresOnboarding(), 'doppelstunde', wahl);
    assert.equal(gemerkt.hinweise.doppelstunde.status, wahl);
    assert.equal(istHinweisErledigt(gemerkt, 'doppelstunde'), true);
    assert.equal(naechsterHinweis({ zustand: gemerkt, kontext }), null);
  }
});

test('Jeder Hinweis bringt Kennung, Titel, Text und Bedingung mit', ()=>{
  const ids = new Set();
  for (const h of HINWEISE) {
    assert.ok(h.id && !ids.has(h.id), `eindeutige Kennung: ${h.id}`);
    ids.add(h.id);
    assert.ok(h.titel.length > 0);
    assert.ok(h.text.length > 20);
    assert.equal(typeof h.bedingung, 'function');
  }
  // Die im Auftrag genannten acht Situationen sind abgedeckt.
  for (const id of ['doppelstunde', 'makro', 'jahresplanung', 'bibliothek', 'durchfuehrung', 'nachbereitung', 'pocket', 'backup']) {
    assert.ok(ids.has(id), id);
  }
});

/* ---- Zurücksetzen -------------------------------------------------------- */

test('Der Schnellstart lässt sich neu starten, ohne verstandene Hinweise zu vergessen', ()=>{
  const zustand = merkeHinweis(
    markiereSchritt(starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE }), 'stunde'),
    'makro', 'verstanden',
  );
  const neu = starteSchnellstartNeu(zustand);
  assert.equal(neu.status, STATUS.AKTIV);
  assert.deepEqual(neu.schritte, {});
  assert.equal(neu.checkliste.sichtbar, true);
  assert.equal(istHinweisErledigt(neu, 'makro'), true, 'verstandene Hinweise bleiben verstanden');
});

test('Hinweise lassen sich zurücksetzen, ohne den Schnellstart anzufassen', ()=>{
  const zustand = merkeHinweis(
    markiereSchritt(starteOnboarding(leeresOnboarding(), { pfad: PFADE.STUNDE }), 'stunde'),
    'makro', 'nie',
  );
  const zurueck = setzeHinweiseZurueck(zustand);
  assert.deepEqual(zurueck.hinweise, {});
  assert.ok(zurueck.schritte.stunde, 'der Fortschritt bleibt');
  assert.equal(zurueck.status, STATUS.AKTIV);
});

test('Zurücksetzen fasst keine Unterrichtsdaten an', ()=>{
  const db = dbMitStunde({ classGroup: '9b', subject: 'Französisch', topic: 'Bruchrechnung' });
  const vorher = JSON.stringify(db);
  const zustand = merkeHinweis(starteOnboarding(leeresOnboarding()), 'makro', 'verstanden');

  starteSchnellstartNeu(zustand);
  setzeHinweiseZurueck(zustand);
  ueberspringeOnboarding(zustand);
  schliesseOnboardingAb(zustand);

  assert.equal(JSON.stringify(db), vorher);
  // Und die Übergänge selbst verändern den übergebenen Zustand nicht.
  assert.equal(zustand.status, STATUS.AKTIV);
  assert.equal(istHinweisErledigt(zustand, 'makro'), true);
});

test('Alte Backups ohne Onboarding-Felder bleiben lesbar und bekommen keine Einführung untergeschoben', ()=>{
  /* Ein Backup aus einer früheren Fassung: appSettings ohne onboarding,
     dafür mit Daten. Es muss unverändert benutzbar sein. */
  const altesBackup = {
    schemaVersion: 9,
    weeks: { '2025-09-01': { slotsPerDay: 6, lessons: { '0-2': stunde({ classGroup: '9b', subject: 'Französisch', topic: 'Alt' }) }, duties: {} } },
    sequences: {}, sequenceTemplates: {}, todos: [], yearBars: [],
    appSettings: { theme: 'dark', fileCopyOptIn: true },
  };
  const zustand = normalisiereOnboarding(altesBackup.appSettings.onboarding);
  assert.equal(zustand.status, STATUS.NEU);
  assert.equal(zeigeWillkommen(altesBackup, zustand), false, 'vorhandene Daten schliessen die Einführung aus');
  assert.equal(altesBackup.appSettings.theme, 'dark', 'die übrigen Einstellungen bleiben');
  assert.deepEqual(schritteAus(altesBackup, zustand), { lerngruppe: true, stunde: true, phase: false });
});
