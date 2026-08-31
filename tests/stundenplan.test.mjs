/* ============================================================
   Stundenplanvorlagen und Stundenplanmodelle

   Zwei Versprechen tragen diese Funktion, und fast jede Prüfung hier
   dreht sich um eines davon:

     1. Eine Vorlage enthält NIE Planungsinhalt. Aus einer geplanten
        Woche kommt die Struktur – Thema, Ziele, Phasen, Materialien,
        Notizen, Sequenz und Nachbereitung bleiben, wo sie sind.
     2. Angewendet wird nur auf freie Plätze. Nichts wird überschrieben,
        nichts doppelt angelegt.

   Dazu der Rhythmus: A- und B-Woche hängen an einer Referenzwoche, die
   die Lehrkraft bestimmt – nicht an geraden oder ungeraden
   Kalenderwochen.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODELL_TYP, RHYTHMUS, ZEILEN_STATUS,
  normalisiereStundenplanVorlage, normalisiereStundenplanModell, normalisiereStundenplandaten,
  vorlagenEintraegeAusWoche, vorlageAusWoche, wochenVorschau,
  positionFuer, labelFuerWoche, rhythmusVorschau, vorlageFuerWoche,
  istUnterrichtsfreieWoche, wochenAbstand, montagVon, kalenderwoche, zyklusLabel, zyklusLaenge,
  anwendungsVorschau, wendeVorlageAn, betroffeneOrte,
  ueberschneidetSich, ueberschneidendeModelle, aktiviereModell, archiviereModell, aktivesModellFuer,
  tauscheZyklus, dupliziereVorlage, setzeAusnahme, speichereVorlage, loescheVorlage,
  hatStundenplanVorlagen, hatAktivesModell, modellVollstaendig, angewendeteWochen,
} from '../renderer/src/stundenplan.js';

/* ---- Bausteine ---------------------------------------------------------- */

function stunde(patch = {}){
  return {
    subject: 'Französisch', classGroup: '9b', room: 'A101',
    topic: '', objectives: '', homework: '', notes: '',
    phases: [], files: [], links: [], sequenceId: '', primaryCompetency: '', competencies: [],
    successCriteria: [], communicativeTask: { text: '', situation: '', audience: '', intention: '', outcome: '' },
    speechActs: [], languageResources: { vocabulary: '', grammar: '', pronunciation: '', other: '' },
    progressionNote: '', blockSpan: 1,
    review: { status: 'not_reviewed', generalNotes: '', phaseReviews: {}, carryOverItems: [], reviewedAt: '' },
    ...patch,
  };
}

/* Eine Woche, wie sie nach echtem Planen aussieht: Struktur plus
   Inhalt. Genau daraus darf nur die Struktur in die Vorlage. */
function geplanteWoche(){
  return {
    slotsPerDay: 6,
    lessons: {
      '0-2': stunde({
        topic: 'Le passé composé',
        objectives: 'Die Lernenden berichten über das Wochenende.',
        phases: [{ id: 'p1', title: 'Einstieg', duration: 45, socialForm: 'Plenum', content: 'Bildimpuls', materialsMedia: 'Beamer', remarks: 'laut' }],
        homework: 'Übungen Seite 42',
        notes: 'Beamer mitbringen',
        sequenceId: 's1',
        competencies: ['Sprechen'],
        primaryCompetency: 'Sprechen',
        files: [{ id: 'f1', name: 'Arbeitsblatt.pdf', path: '/tmp/ab.pdf' }],
        links: [{ id: 'l1', title: 'Video', url: 'https://example.org' }],
        successCriteria: [{ id: 'k1', text: 'Ich kann berichten.' }],
        progressionNote: 'Übergang zum freien Sprechen',
        review: { status: 'reviewed', generalNotes: 'lief gut', phaseReviews: {}, carryOverItems: [{ id: 'c1', status: 'open' }], reviewedAt: '2026-09-01' },
      }),
      '2-1': stunde({ classGroup: '7a', subject: 'Mathematik', room: 'B202', blockSpan: 2, topic: 'Brüche' }),
      '4-0': stunde({ classGroup: '9b', subject: 'Französisch', room: 'A101', topic: 'Klassenarbeit' }),
    },
    duties: { '0-1': { id: 'd1', title: 'Hofaufsicht' } },
  };
}

function leereDb(patch = {}){
  return {
    weeks: {},
    timetableTemplates: {},
    timetableModels: [],
    schoolCalendar: {
      schoolYear: { startISO: '2026-08-01', endISO: '2027-07-31' },
      vacations: [], freeDays: [], events: [], lessonTimes: [],
    },
    ...patch,
  };
}

const VORLAGE_EINTRAEGE = [
  { dayIndex: 0, slotIndex: 2, classGroup: '9b', subject: 'Französisch', room: 'A101', blockSpan: 1 },
  { dayIndex: 2, slotIndex: 1, classGroup: '7a', subject: 'Mathematik', room: 'B202', blockSpan: 2 },
];

function vorlage(patch = {}){
  return normalisiereStundenplanVorlage({
    name: 'Standardwoche', eintraege: VORLAGE_EINTRAEGE, ...patch,
  });
}

/* ---- 1. Vorlagen anlegen ------------------------------------------------ */

test('Eine leere Vorlage kann angelegt werden', ()=>{
  const v = normalisiereStundenplanVorlage({ name: 'Meine Unterrichtszeiten' });
  assert.ok(v.id);
  assert.equal(v.name, 'Meine Unterrichtszeiten');
  assert.deepEqual(v.eintraege, []);
  assert.equal(v.version, 1);
  assert.equal(v.modelId, '');
});

test('Ein gleichbleibender Ein-Wochen-Stundenplan kann angelegt werden', ()=>{
  const v = vorlage();
  const m = normalisiereStundenplanModell({ name: 'Standard 2026/27', typ: MODELL_TYP.EINZEL, zyklus: [v.id], aktiv: true });
  assert.equal(m.typ, MODELL_TYP.EINZEL);
  assert.equal(zyklusLaenge(m), 1);
  assert.equal(zyklusLabel(0, 1), '', 'eine einzelne Woche braucht kein A');
  assert.equal(modellVollstaendig(m, { [v.id]: v }), true);
  // Ohne Referenzwoche ist das für eine gleichbleibende Woche in Ordnung.
  assert.equal(m.referenzWocheISO, '');
});

test('Ein Stundenplanmodell kann eine A- und eine B-Vorlage enthalten', ()=>{
  const a = vorlage({ name: 'A-Woche' });
  const b = vorlage({ name: 'B-Woche', eintraege: [{ dayIndex: 1, slotIndex: 0, classGroup: '9b', subject: 'Französisch', room: 'A101' }] });
  const m = normalisiereStundenplanModell({
    name: 'Standard 2026/27', typ: MODELL_TYP.WECHSEL, zyklus: [a.id, b.id],
    referenzWocheISO: '2026-08-31', referenzPosition: 0, wechselregel: RHYTHMUS.KALENDERWOCHEN, aktiv: true,
  });
  assert.equal(m.typ, MODELL_TYP.WECHSEL);
  assert.equal(zyklusLaenge(m), 2);
  assert.equal(zyklusLabel(0, 2), 'A');
  assert.equal(zyklusLabel(1, 2), 'B');
  assert.equal(modellVollstaendig(m, { [a.id]: a, [b.id]: b }), true);
});

test('A- und B-Woche können unterschiedliche Stunden besitzen', ()=>{
  const a = vorlage({ name: 'A-Woche' });
  const b = vorlage({
    name: 'B-Woche',
    eintraege: [
      { dayIndex: 0, slotIndex: 2, classGroup: '9b', subject: 'Französisch', room: 'A101' },
      { dayIndex: 3, slotIndex: 3, classGroup: '5c', subject: 'Musik', room: 'M1', blockSpan: 2 },
    ],
  });
  assert.notDeepEqual(
    a.eintraege.map(e => `${e.dayIndex}-${e.slotIndex}-${e.subject}`),
    b.eintraege.map(e => `${e.dayIndex}-${e.slotIndex}-${e.subject}`),
  );
  assert.equal(b.eintraege.find(e => e.subject === 'Musik').blockSpan, 2);
});

test('Beide Vorlagen gehören gemeinsam zum aktiven Standard', ()=>{
  const db = leereDb();
  const a = vorlage({ name: 'A-Woche' });
  const b = vorlage({ name: 'B-Woche' });
  db.timetableTemplates = { [a.id]: a, [b.id]: b };
  db.timetableModels = [normalisiereStundenplanModell({
    name: 'Standard', typ: MODELL_TYP.WECHSEL, zyklus: [a.id, b.id],
    referenzWocheISO: '2026-08-31', wechselregel: RHYTHMUS.KALENDERWOCHEN, aktiv: true,
  })];
  normalisiereStundenplandaten(db);
  assert.equal(hatAktivesModell(db), true);
  const modell = aktivesModellFuer(db.timetableModels, '2026-09-07');
  assert.equal(modell.zyklus.length, 2, 'zwei Vorlagen sind gemeinsam Standard');
});

/* ---- 2. Woche als Vorlage ------------------------------------------------ */

test('Eine vorhandene Woche kann als Vorlage gespeichert werden', ()=>{
  const v = vorlageAusWoche(geplanteWoche(), { name: 'Aus Woche' });
  assert.equal(v.name, 'Aus Woche');
  assert.equal(v.eintraege.length, 3);
  const erste = v.eintraege[0];
  assert.equal(erste.dayIndex, 0);
  assert.equal(erste.slotIndex, 2);
  assert.equal(erste.classGroup, '9b');
  assert.equal(erste.subject, 'Französisch');
  assert.equal(erste.room, 'A101');
});

test('Planungsinhalte werden nicht in die Vorlage übernommen', ()=>{
  const v = vorlageAusWoche(geplanteWoche(), { name: 'Aus Woche' });
  const alsText = JSON.stringify(v);
  for (const verboten of [
    'Le passé composé', 'Wochenende', 'Bildimpuls', 'Beamer', 'Seite 42',
    'Sprechen', 's1', 'Arbeitsblatt.pdf', 'example.org', 'Ich kann berichten',
    'Übergang zum freien Sprechen', 'lief gut', 'Klassenarbeit', 'Brüche',
  ]) {
    assert.equal(alsText.includes(verboten), false, `„${verboten}" darf nicht in der Vorlage stehen`);
  }
  // Und positiv: Es gibt ausschliesslich die organisatorischen Felder.
  for (const e of v.eintraege) {
    assert.deepEqual(
      Object.keys(e).sort(),
      ['blockSpan', 'classGroup', 'dayIndex', 'id', 'room', 'slotIndex', 'subject'],
    );
  }
});

test('Einzelne einmalige Stunden können vor dem Speichern abgewählt werden', ()=>{
  const woche = geplanteWoche();
  const alle = wochenVorschau(woche);
  assert.equal(alle.length, 3);
  assert.equal(alle.filter(z => z.hatPlanung).length, 3, 'die Vorschau sagt, wo Planung steckt');

  // Die Klassenarbeit am Freitag wird abgewählt.
  const auswahl = alle.filter(z => z.thema !== 'Klassenarbeit').map(z => z.key);
  const v = vorlageAusWoche(woche, { name: 'Ohne Klassenarbeit', auswahl });
  assert.equal(v.eintraege.length, 2);
  assert.equal(v.eintraege.some(e => e.dayIndex === 4), false);
});

test('Doppelstunden bleiben in der Vorlage erhalten', ()=>{
  const v = vorlageAusWoche(geplanteWoche(), { name: 'Mit Doppelstunde' });
  const doppel = v.eintraege.find(e => e.subject === 'Mathematik');
  assert.equal(doppel.blockSpan, 2);
  assert.equal(doppel.dayIndex, 2);
  assert.equal(doppel.slotIndex, 1);
});

test('Stunden ohne Klasse und Fach kommen nicht in die Vorlage', ()=>{
  const woche = { slotsPerDay: 6, lessons: { '1-1': stunde({ classGroup: '', subject: '', topic: 'Notiz' }) }, duties: {} };
  assert.deepEqual(vorlagenEintraegeAusWoche(woche), []);
});

/* ---- 3. Rhythmus --------------------------------------------------------- */

function abModell(patch = {}){
  return normalisiereStundenplanModell({
    name: 'A/B', typ: MODELL_TYP.WECHSEL, zyklus: ['va', 'vb'],
    vonISO: '2026-08-31', bisISO: '2027-07-31',
    referenzWocheISO: '2026-08-31', referenzPosition: 0,
    wechselregel: RHYTHMUS.KALENDERWOCHEN, aktiv: true,
    ...patch,
  });
}

test('Die Referenzwoche bestimmt die anschliessende A-/B-Folge', ()=>{
  const m = abModell();
  const cal = leereDb().schoolCalendar;
  assert.equal(labelFuerWoche(m, '2026-08-31', { schoolCalendar: cal }), 'A');
  assert.equal(labelFuerWoche(m, '2026-09-07', { schoolCalendar: cal }), 'B');
  assert.equal(labelFuerWoche(m, '2026-09-14', { schoolCalendar: cal }), 'A');
  assert.equal(labelFuerWoche(m, '2026-09-21', { schoolCalendar: cal }), 'B');
  // Auch mitten in der Woche gefragt: es zählt die Woche, nicht der Tag.
  assert.equal(labelFuerWoche(m, '2026-09-09', { schoolCalendar: cal }), 'B');
});

test('Die Referenzwoche darf auch eine B-Woche sein', ()=>{
  const m = abModell({ referenzPosition: 1 });
  assert.equal(labelFuerWoche(m, '2026-08-31'), 'B');
  assert.equal(labelFuerWoche(m, '2026-09-07'), 'A');
});

test('Vor der Referenzwoche läuft der Rhythmus rückwärts weiter', ()=>{
  const m = abModell({ vonISO: '2026-08-01' });
  assert.equal(labelFuerWoche(m, '2026-08-24'), 'B');
  assert.equal(labelFuerWoche(m, '2026-08-17'), 'A');
});

test('Es gibt keine Annahme über gerade oder ungerade Kalenderwochen', ()=>{
  /* Zwei Modelle mit derselben Kalenderwoche als Referenz, aber
     verschiedener Zuordnung – beide müssen ihrer eigenen Vorgabe
     folgen. */
  const geradeAlsA = abModell({ referenzWocheISO: '2026-09-07', referenzPosition: 0 });
  const geradeAlsB = abModell({ referenzWocheISO: '2026-09-07', referenzPosition: 1 });
  assert.equal(labelFuerWoche(geradeAlsA, '2026-09-07'), 'A');
  assert.equal(labelFuerWoche(geradeAlsB, '2026-09-07'), 'B');
  assert.equal(kalenderwoche('2026-09-07'), kalenderwoche('2026-09-09'));
});

test('Ausserhalb des Gültigkeitszeitraums gilt das Modell nicht', ()=>{
  const m = abModell({ vonISO: '2026-09-07', bisISO: '2026-09-21' });
  assert.equal(positionFuer(m, '2026-08-31'), null);
  assert.equal(positionFuer(m, '2026-09-28'), null);
  assert.equal(labelFuerWoche(m, '2026-09-14'), 'A');
});

test('Kalenderwochen- und Unterrichtswochenrhythmus behandeln Ferien unterschiedlich', ()=>{
  const cal = {
    schoolYear: { startISO: '2026-08-01', endISO: '2027-07-31' },
    vacations: [{ id: 'v1', name: 'Herbstferien', startISO: '2026-09-07', endISO: '2026-09-11' }],
    freeDays: [], events: [],
  };
  assert.equal(istUnterrichtsfreieWoche('2026-09-07', cal), true);
  assert.equal(istUnterrichtsfreieWoche('2026-09-14', cal), false);

  const kalender = abModell({ wechselregel: RHYTHMUS.KALENDERWOCHEN });
  const unterricht = abModell({ wechselregel: RHYTHMUS.UNTERRICHTSWOCHEN });

  // 31.08. = A (Referenz), 07.09. = Ferienwoche, 14.09. = erste Woche danach.
  assert.equal(labelFuerWoche(kalender, '2026-09-14', { schoolCalendar: cal }), 'A',
    'nach Kalenderwochen läuft der Rhythmus durch die Ferien weiter');
  assert.equal(labelFuerWoche(unterricht, '2026-09-14', { schoolCalendar: cal }), 'B',
    'nach Unterrichtswochen wird die Ferienwoche übersprungen');
  assert.equal(labelFuerWoche(unterricht, '2026-09-21', { schoolCalendar: cal }), 'A');
});

test('Eine manuelle Abweichung schlägt den berechneten Rhythmus', ()=>{
  const m = abModell();
  assert.equal(labelFuerWoche(m, '2026-09-07'), 'B');
  const mitAusnahme = setzeAusnahme(m, '2026-09-07', 0);
  assert.equal(labelFuerWoche(mitAusnahme, '2026-09-07'), 'A');
  // Die Wochen danach folgen weiter dem Rhythmus.
  assert.equal(labelFuerWoche(mitAusnahme, '2026-09-14'), 'A');
  // Und die Ausnahme lässt sich zurücknehmen.
  assert.equal(labelFuerWoche(setzeAusnahme(mitAusnahme, '2026-09-07', null), '2026-09-07'), 'B');
});

test('A- und B-Wochen werden in der Vorschau korrekt gekennzeichnet', ()=>{
  const cal = {
    schoolYear: { startISO: '2026-08-01', endISO: '2027-07-31' },
    vacations: [{ id: 'v1', name: 'Ferien', startISO: '2026-09-07', endISO: '2026-09-11' }],
    freeDays: [], events: [],
  };
  const zeilen = rhythmusVorschau(abModell(), { vonISO: '2026-08-31', bisISO: '2026-09-21', schoolCalendar: cal });
  assert.deepEqual(zeilen.map(z => z.label), ['A', 'B', 'A', 'B']);
  assert.deepEqual(zeilen.map(z => z.unterrichtsfrei), [false, true, false, false]);
  assert.deepEqual(zeilen.map(z => z.weekStartISO), ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
  assert.ok(zeilen.every(z => z.kw > 0));
});

test('Eine gleichbleibende Woche hat immer dieselbe Position und keine Beschriftung', ()=>{
  const m = normalisiereStundenplanModell({ typ: MODELL_TYP.EINZEL, zyklus: ['v1'], aktiv: true });
  assert.equal(positionFuer(m, '2026-08-31'), 0);
  assert.equal(positionFuer(m, '2027-03-01'), 0);
  assert.equal(labelFuerWoche(m, '2026-08-31'), '');
});

/* ---- 4. Anwenden --------------------------------------------------------- */

function dbMitVorlage(){
  const db = leereDb();
  const v = vorlage();
  db.timetableTemplates = { [v.id]: v };
  return { db, v };
}

test('Eine Vorlage kann auf eine leere Woche angewendet werden', ()=>{
  const { db, v } = dbMitVorlage();
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  assert.equal(plan.ok, true);
  assert.equal(plan.summe.neu, 2);
  assert.equal(plan.summe.konflikt, 0);

  const next = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o, topic: '', phases: [] }) });
  const woche = next.weeks['2026-08-31'];
  assert.equal(woche.lessons['0-2'].subject, 'Französisch');
  assert.equal(woche.lessons['0-2'].classGroup, '9b');
  assert.equal(woche.lessons['0-2'].room, 'A101');
  assert.equal(woche.lessons['2-1'].blockSpan, 2, 'die Doppelstunde bleibt eine');
  assert.equal(woche.lessons['2-2'], undefined, 'der Folgeplatz trägt keinen eigenen Eintrag');
  // Die Ausgangsdaten bleiben unberührt.
  assert.equal(db.weeks['2026-08-31'], undefined);
});

test('Erzeugte Stunden merken sich ihre Herkunft, ohne dadurch eingeschränkt zu sein', ()=>{
  const { db, v } = dbMitVorlage();
  const m = normalisiereStundenplanModell({ typ: MODELL_TYP.EINZEL, zyklus: [v.id], aktiv: true });
  db.timetableModels = [m];
  const plan = anwendungsVorschau(db, { modell: m, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const next = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });
  const ref = next.weeks['2026-08-31'].lessons['0-2'].timetableRef;
  assert.equal(ref.templateId, v.id);
  assert.equal(ref.modelId, m.id);
  assert.equal(ref.version, v.version);
  assert.ok(ref.entryId);
  assert.deepEqual(angewendeteWochen(next, m.id), ['2026-08-31']);
});

test('Identische Stunden werden nicht doppelt angelegt', ()=>{
  const { db, v } = dbMitVorlage();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: { '0-2': stunde({ classGroup: '9b', subject: 'Französisch', room: 'A101' }) },
    duties: {},
  };
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  assert.equal(plan.summe.identisch, 1);
  assert.equal(plan.summe.neu, 1);
  const zeile = plan.wochen[0].eintraege.find(e => e.dayIndex === 0);
  assert.equal(zeile.status, ZEILEN_STATUS.IDENTISCH);

  const next = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });
  assert.equal(Object.keys(next.weeks['2026-08-31'].lessons).length, 2, 'kein doppelter Eintrag');
});

test('Bestehende geplante Stunden werden nicht überschrieben', ()=>{
  const { db, v } = dbMitVorlage();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: { '0-2': stunde({ classGroup: '5a', subject: 'Deutsch', topic: 'Balladen', room: 'C1' }) },
    duties: {},
  };
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  assert.equal(plan.summe.konflikt, 1);
  const next = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });
  assert.equal(next.weeks['2026-08-31'].lessons['0-2'].topic, 'Balladen');
  assert.equal(next.weeks['2026-08-31'].lessons['0-2'].subject, 'Deutsch');
});

test('Konflikte werden vor der Übernahme angezeigt und benannt', ()=>{
  const { db, v } = dbMitVorlage();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: { '0-2': stunde({ classGroup: '5a', subject: 'Deutsch', topic: 'Balladen' }) },
    duties: {},
  };
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const konflikt = plan.wochen[0].eintraege.find(e => e.status === ZEILEN_STATUS.KONFLIKT);
  assert.ok(konflikt);
  assert.match(konflikt.hinweis, /geplant/);
  assert.match(konflikt.hinweis, /5a/);
});

test('Ein leerer Rahmen wird nur auf ausdrücklichen Wunsch ersetzt – Geplantes nie', ()=>{
  const { db, v } = dbMitVorlage();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: {
      '0-2': stunde({ classGroup: '5a', subject: 'Deutsch' }),                    // leerer Rahmen
      '2-1': stunde({ classGroup: '5a', subject: 'Deutsch', topic: 'Balladen' }), // mit Planung
    },
    duties: {},
  };
  const ohne = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  assert.equal(ohne.summe.konflikt, 2);
  assert.equal(ohne.summe.ersetzbar, 0);

  const mit = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31', ersetzeOhneInhalt: true });
  assert.equal(mit.summe.ersetzbar, 1);
  assert.equal(mit.summe.konflikt, 1, 'die geplante Stunde bleibt ein Konflikt');

  const next = wendeVorlageAn(db, mit, { neueStunde: (o)=> ({ ...o }) });
  assert.equal(next.weeks['2026-08-31'].lessons['0-2'].subject, 'Französisch', 'der leere Rahmen wurde ersetzt');
  assert.equal(next.weeks['2026-08-31'].lessons['2-1'].topic, 'Balladen', 'die Planung blieb');
});

test('Eine Doppelstunde braucht ihre Folgestunde frei', ()=>{
  const { db, v } = dbMitVorlage();
  db.weeks['2026-08-31'] = {
    slotsPerDay: 6,
    lessons: { '2-2': stunde({ classGroup: '8a', subject: 'Sport' }) },
    duties: {},
  };
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const doppel = plan.wochen[0].eintraege.find(e => e.subject === 'Mathematik');
  assert.equal(doppel.status, ZEILEN_STATUS.KONFLIKT);
  assert.match(doppel.hinweis, /Folgestunde/);
});

test('Ferien und schulfreie Tage werden berücksichtigt', ()=>{
  const { db, v } = dbMitVorlage();
  db.schoolCalendar.freeDays = [{ id: 'f1', name: 'Pädagogischer Tag', dateISO: '2026-08-31' }];
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const montag = plan.wochen[0].eintraege.find(e => e.dayIndex === 0);
  assert.equal(montag.status, ZEILEN_STATUS.FERIEN);
  assert.match(montag.hinweis, /Pädagogischer Tag/);
  assert.equal(plan.summe.neu, 1, 'nur der Mittwoch wird angelegt');
});

test('Eine vollständig unterrichtsfreie Woche wird ganz übersprungen', ()=>{
  const { db, v } = dbMitVorlage();
  db.schoolCalendar.vacations = [{ id: 'v1', name: 'Herbstferien', startISO: '2026-08-31', endISO: '2026-09-04' }];
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-09-07' });
  assert.equal(plan.wochen[0].unterrichtsfrei, true);
  assert.equal(plan.wochen[0].eintraege.length, 0);
  assert.match(plan.wochen[0].hinweis, /übersprungen/);
  assert.equal(plan.summe.freieWochen, 1);
  assert.equal(plan.summe.neu, 2, 'nur die zweite Woche wird gefüllt');
});

test('Beim Anwenden wird je Woche die richtige Vorlage benutzt', ()=>{
  const db = leereDb();
  const a = vorlage({ name: 'A-Woche', eintraege: [{ dayIndex: 0, slotIndex: 2, classGroup: '9b', subject: 'Französisch', room: 'A101' }] });
  const b = vorlage({ name: 'B-Woche', eintraege: [{ dayIndex: 3, slotIndex: 4, classGroup: '5c', subject: 'Musik', room: 'M1' }] });
  db.timetableTemplates = { [a.id]: a, [b.id]: b };
  const m = normalisiereStundenplanModell({
    name: 'A/B', typ: MODELL_TYP.WECHSEL, zyklus: [a.id, b.id],
    vonISO: '2026-08-31', bisISO: '2027-07-31',
    referenzWocheISO: '2026-08-31', referenzPosition: 0,
    wechselregel: RHYTHMUS.KALENDERWOCHEN, aktiv: true,
  });
  db.timetableModels = [m];

  assert.equal(vorlageFuerWoche(m, db.timetableTemplates, '2026-08-31').name, 'A-Woche');
  assert.equal(vorlageFuerWoche(m, db.timetableTemplates, '2026-09-07').name, 'B-Woche');

  const plan = anwendungsVorschau(db, { modell: m, vonISO: '2026-08-31', bisISO: '2026-09-14' });
  assert.deepEqual(plan.wochen.map(w => w.label), ['A', 'B', 'A']);
  assert.deepEqual(plan.wochen.map(w => w.vorlageName), ['A-Woche', 'B-Woche', 'A-Woche']);

  const next = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });
  assert.equal(next.weeks['2026-08-31'].lessons['0-2'].subject, 'Französisch');
  assert.equal(next.weeks['2026-09-07'].lessons['3-4'].subject, 'Musik');
  assert.equal(next.weeks['2026-09-07'].lessons['0-2'], undefined, 'die A-Stunde steht nicht in der B-Woche');
  assert.equal(next.weeks['2026-09-14'].lessons['0-2'].subject, 'Französisch');
});

test('Die berührten Orte umfassen auch die Folgeplätze von Doppelstunden', ()=>{
  const { db, v } = dbMitVorlage();
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const orte = betroffeneOrte(plan);
  assert.equal(orte.length, 3, 'eine Einzelstunde und zwei Plätze der Doppelstunde');
  assert.ok(orte.some(o => o.dayIndex === 2 && o.slotIndex === 2));
});

/* ---- 5. Vorlagen ändern und löschen -------------------------------------- */

test('Änderungen an einer Vorlage verändern bestehende Wochen nicht automatisch', ()=>{
  const { db, v } = dbMitVorlage();
  const plan = anwendungsVorschau(db, { vorlage: v, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const mitStunden = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });
  const vorher = JSON.stringify(mitStunden.weeks);

  // Die Vorlage wird umgebaut: anderer Raum, anderer Tag, eine Stunde weniger.
  const geaendert = speichereVorlage(mitStunden.timetableTemplates, {
    ...v,
    eintraege: [{ dayIndex: 1, slotIndex: 5, classGroup: '9b', subject: 'Französisch', room: 'Z999' }],
  });
  mitStunden.timetableTemplates = geaendert;

  assert.equal(JSON.stringify(mitStunden.weeks), vorher, 'die Wochen bleiben, wie sie waren');
  assert.equal(geaendert[v.id].version, v.version + 1, 'die Fassung zählt hoch');
  assert.equal(mitStunden.weeks['2026-08-31'].lessons['0-2'].room, 'A101');
});

test('Das Löschen einer Vorlage löscht keine Unterrichtsstunden', ()=>{
  const { db, v } = dbMitVorlage();
  const m = normalisiereStundenplanModell({ typ: MODELL_TYP.EINZEL, zyklus: [v.id], aktiv: true });
  db.timetableModels = [m];
  const plan = anwendungsVorschau(db, { modell: m, vonISO: '2026-08-31', bisISO: '2026-08-31' });
  const mitStunden = wendeVorlageAn(db, plan, { neueStunde: (o)=> ({ ...o }) });

  const nachher = { ...mitStunden, ...loescheVorlage(mitStunden, v.id) };
  assert.equal(nachher.timetableTemplates[v.id], undefined);
  assert.deepEqual(nachher.timetableModels[0].zyklus, [], 'das Modell verliert nur den Verweis');
  assert.equal(nachher.weeks['2026-08-31'].lessons['0-2'].subject, 'Französisch', 'die Stunde bleibt');
  assert.equal(Object.keys(nachher.weeks['2026-08-31'].lessons).length, 2);
});

test('Eine Vorlage lässt sich duplizieren', ()=>{
  const v = vorlage({ name: 'A-Woche' });
  const kopie = dupliziereVorlage(v);
  assert.notEqual(kopie.id, v.id);
  assert.equal(kopie.name, 'A-Woche (Kopie)');
  assert.equal(kopie.version, 1);
  assert.equal(kopie.eintraege.length, v.eintraege.length);
  assert.notEqual(kopie.eintraege[0].id, v.eintraege[0].id, 'auch die Einträge bekommen neue Kennungen');
  assert.deepEqual(
    kopie.eintraege.map(e => `${e.dayIndex}-${e.slotIndex}-${e.subject}-${e.blockSpan}`),
    v.eintraege.map(e => `${e.dayIndex}-${e.slotIndex}-${e.subject}-${e.blockSpan}`),
  );
});

test('Das Tauschen von A- und B-Woche funktioniert', ()=>{
  const a = vorlage({ name: 'A-Woche' });
  const b = vorlage({ name: 'B-Woche' });
  const m = normalisiereStundenplanModell({
    typ: MODELL_TYP.WECHSEL, zyklus: [a.id, b.id],
    referenzWocheISO: '2026-08-31', wechselregel: RHYTHMUS.KALENDERWOCHEN, aktiv: true,
  });
  const vorlagen = { [a.id]: a, [b.id]: b };
  assert.equal(vorlageFuerWoche(m, vorlagen, '2026-08-31').name, 'A-Woche');

  const getauscht = tauscheZyklus(m, vorlagen);
  assert.deepEqual(getauscht.modell.zyklus, [b.id, a.id]);
  assert.equal(vorlageFuerWoche(getauscht.modell, getauscht.vorlagen, '2026-08-31').name, 'B-Woche');
  assert.equal(vorlageFuerWoche(getauscht.modell, getauscht.vorlagen, '2026-09-07').name, 'A-Woche');
  // Die Vorlagen selbst haben sich nicht inhaltlich verändert.
  assert.deepEqual(getauscht.vorlagen[a.id].eintraege, a.eintraege);
  assert.equal(getauscht.vorlagen[a.id].zyklusPosition, 1);
});

/* ---- 6. Mehrere Modelle -------------------------------------------------- */

test('Mehrere Modelle und Vorlagen können gespeichert werden', ()=>{
  const db = leereDb();
  const namen = ['Standard 2026/27', 'Zweites Halbjahr', 'Vorübergehend', 'Früher'];
  for (const name of namen) {
    const v = vorlage({ name: `${name} – Woche` });
    db.timetableTemplates[v.id] = v;
    db.timetableModels.push(normalisiereStundenplanModell({ name, zyklus: [v.id], aktiv: false }));
  }
  normalisiereStundenplandaten(db);
  assert.equal(Object.keys(db.timetableTemplates).length, 4);
  assert.equal(db.timetableModels.length, 4);
  assert.equal(hatStundenplanVorlagen(db), true);
  assert.equal(hatAktivesModell(db), false, 'gespeichert ist nicht dasselbe wie aktiv');
});

test('Für einen sich überschneidenden Zeitraum ist nur ein Modell aktiv', ()=>{
  const erstes = normalisiereStundenplanModell({ id: 'm1', name: 'Ganzjahr', zyklus: ['v1'], vonISO: '2026-08-01', bisISO: '2027-07-31', aktiv: true });
  const zweites = normalisiereStundenplanModell({ id: 'm2', name: 'Zweites Halbjahr', zyklus: ['v2'], vonISO: '2027-02-01', bisISO: '2027-07-31' });
  const drittes = normalisiereStundenplanModell({ id: 'm3', name: 'Nächstes Jahr', zyklus: ['v3'], vonISO: '2027-08-01', bisISO: '2028-07-31' });

  assert.equal(ueberschneidetSich(erstes, zweites), true);
  assert.equal(ueberschneidetSich(erstes, drittes), false);

  const { modelle, deaktiviert } = aktiviereModell([erstes, zweites, drittes], 'm2');
  assert.deepEqual(deaktiviert, ['m1'], 'das überschneidende Modell wird stillgelegt');
  assert.equal(modelle.find(m => m.id === 'm1').aktiv, false);
  assert.equal(modelle.find(m => m.id === 'm2').aktiv, true);

  // Ein Modell ohne Überschneidung darf gleichzeitig aktiv sein.
  const spaeter = aktiviereModell(modelle, 'm3');
  assert.deepEqual(spaeter.deaktiviert, []);
  assert.equal(spaeter.modelle.filter(m => m.aktiv).length, 2);
  assert.equal(aktivesModellFuer(spaeter.modelle, '2027-03-01').id, 'm2');
  assert.equal(aktivesModellFuer(spaeter.modelle, '2027-09-01').id, 'm3');
});

test('Ein archiviertes Modell gilt nirgends mehr', ()=>{
  const m = normalisiereStundenplanModell({ id: 'm1', zyklus: ['v1'], aktiv: true });
  const archiviert = archiviereModell([m], 'm1');
  assert.equal(archiviert[0].aktiv, false);
  assert.equal(archiviert[0].archiviert, true);
  assert.equal(aktivesModellFuer(archiviert, '2026-09-01'), null);
  assert.deepEqual(ueberschneidendeModelle(archiviert, normalisiereStundenplanModell({ id: 'm2' })), []);
});

/* ---- 7. Verträglichkeit --------------------------------------------------- */

test('Alte Datenbanken ohne Stundenplanvorlagen bleiben kompatibel', ()=>{
  const alt = { weeks: { '2025-09-01': { slotsPerDay: 6, lessons: { '0-2': stunde({ topic: 'Alt' }) }, duties: {} } }, appSettings: { theme: 'dark' } };
  const vorher = JSON.stringify(alt.weeks);
  normalisiereStundenplandaten(alt);
  assert.deepEqual(alt.timetableTemplates, {});
  assert.deepEqual(alt.timetableModels, []);
  assert.equal(JSON.stringify(alt.weeks), vorher, 'die Stunden bleiben unangetastet');
  assert.equal(alt.appSettings.theme, 'dark');
  assert.equal(hatStundenplanVorlagen(alt), false);
});

test('Alte Daten mit nur einer Standardvorlage werden als Ein-Wochen-Modell übernommen', ()=>{
  /* Der frühere Stand: EINE Vorlage, mit "Standard" gekennzeichnet, ohne
     Modell darum. Sie soll weiter gelten – jetzt als gleichbleibendes
     Ein-Wochen-Modell. */
  const alt = {
    weeks: {},
    timetableTemplates: {
      alt1: {
        id: 'alt1', name: 'Mein Stundenplan', istStandard: true,
        vonISO: '2026-08-01', bisISO: '2027-07-31',
        eintraege: VORLAGE_EINTRAEGE,
      },
    },
  };
  normalisiereStundenplandaten(alt);
  assert.equal(alt.timetableModels.length, 1);
  const m = alt.timetableModels[0];
  assert.equal(m.typ, MODELL_TYP.EINZEL);
  assert.equal(m.aktiv, true);
  assert.deepEqual(m.zyklus, ['alt1']);
  assert.equal(m.name, 'Mein Stundenplan');
  assert.equal(m.vonISO, '2026-08-01');
  assert.equal(alt.timetableTemplates.alt1.modelId, m.id);
  assert.equal(alt.timetableTemplates.alt1.eintraege.length, 2, 'die Einträge bleiben vollständig');
  assert.equal(positionFuer(m, '2026-09-14'), 0);

  // Ein zweiter Durchlauf ändert nichts mehr.
  const nachEinmal = JSON.stringify(alt);
  normalisiereStundenplandaten(alt);
  assert.equal(JSON.stringify(alt), nachEinmal, 'die Migration ist wiederholbar');
});

test('Neue Backups enthalten die Stundenplanvorlagen', ()=>{
  /* Ein Backup ist die vollständige Datenbank – die Vorlagen liegen
     darin und kommen deshalb von selbst mit. */
  const { db, v } = dbMitVorlage();
  db.timetableModels = [normalisiereStundenplanModell({ name: 'Standard', zyklus: [v.id], aktiv: true })];
  const backup = JSON.parse(JSON.stringify(db));
  assert.ok(backup.timetableTemplates[v.id]);
  assert.equal(backup.timetableModels[0].zyklus[0], v.id);

  const zurueck = normalisiereStundenplandaten(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(zurueck.timetableTemplates[v.id].eintraege, v.eintraege);
  assert.equal(zurueck.timetableModels.length, 1);
});

test('Unsinnige gespeicherte Werte fallen auf Gültiges zurück', ()=>{
  const v = normalisiereStundenplanVorlage({
    name: '', version: -3, slotsPerDay: 0,
    eintraege: [
      { dayIndex: 99, slotIndex: -2, classGroup: '9b', subject: 'Französisch', blockSpan: 99 },
      { classGroup: '', subject: '' },
      'kaputt',
    ],
  });
  assert.equal(v.name, 'Wochenvorlage');
  assert.equal(v.version, 1);
  assert.equal(v.slotsPerDay, 6);
  assert.equal(v.eintraege.length, 1);
  assert.equal(v.eintraege[0].dayIndex, 4);
  assert.equal(v.eintraege[0].slotIndex, 0);
  assert.equal(v.eintraege[0].blockSpan, 4);

  const m = normalisiereStundenplanModell({ typ: 'irgendwas', wechselregel: 'quatsch', referenzPosition: -1, ausnahmen: { 'kaputt': 1, '2026-09-07': 'x' } });
  assert.equal(m.typ, MODELL_TYP.EINZEL);
  assert.equal(m.wechselregel, RHYTHMUS.KALENDERWOCHEN);
  assert.equal(m.referenzPosition, 0);
  assert.deepEqual(m.ausnahmen, {});
});

test('Wochenrechnung bleibt lokal und ohne Kalenderwochen-Annahme', ()=>{
  assert.equal(montagVon('2026-09-09'), '2026-09-07');
  assert.equal(montagVon('2026-09-07'), '2026-09-07');
  assert.equal(wochenAbstand('2026-08-31', '2026-09-14'), 2);
  assert.equal(wochenAbstand('2026-09-14', '2026-08-31'), -2);
  assert.equal(wochenAbstand('2026-12-28', '2027-01-04'), 1, 'auch über den Jahreswechsel');
});
