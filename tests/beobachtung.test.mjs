/* ============================================================
   Beobachtung – das reine Modell

   Geprüft wird, was ohne Oberfläche und ohne Ablage entschieden wird:
   wie Daten gelesen werden, wie Lernende und Fragen sich ändern, welche
   Paare eine Runde vorschlägt, was die Auswertung zählt und wie eine
   Sicherung in vorhandene Daten einfliesst.

   Drei Versprechen ziehen sich durch alle Prüfungen:

     - Verwaiste Beobachtungen bleiben erhalten. Gelöscht wird nur,
       was jemand ausdrücklich löscht.
     - Die Runde ist mit festem Zufall vollständig wiederholbar und
       verteilt sich zuerst über die Lernenden.
     - Keine Funktion verändert ihre Eingabe.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BEOBACHTUNG_SCHEMA, SKALA, KATEGORIEN, STANDARD_FRAGEN, RUNDE_MIN, RUNDE_MAX,
  RUNDEN_GROESSE_STANDARD,
  istSkalenwert, skalaTitel, kategorieName, vergleichsText, istDatum,
  lerngruppenSchluessel, zerlegeLerngruppenSchluessel, normalisiereLerngruppenSchluessel,
  lerngruppenName, lerngruppenAusPlanung,
  leereBeobachtungsdaten, startdaten, normalisiereBeobachtungsdaten,
  lernendeDerGruppe, lernendeHinzufuegen, lernendeAendern, lernendeVerschieben,
  lernendeLoeschen, lernendeKopieren, beobachtungenVonLernenden,
  frageHinzufuegen, frageAendern, frageLoeschen, fragenFuer, beobachtungenZurFrage,
  erzeugeRunde, erfasseBeobachtung,
  abdeckung, lernendenUebersicht, fragenUebersicht, verlaufVon, beobachtungsUmfang,
  zusammenfuehren,
} from '../renderer/src/beobachtung.js';

/* ---- Hilfen ----------------------------------------------------------- */

// Jede Prüfung bekommt ihren eigenen Zähler – keine Abhängigkeit von der Reihenfolge.
const zaehlendeId = ()=>{ let n = 0; return (praefix = 'id')=> `${praefix}${++n}`; };

const FR = '6a||Französisch';
const MA = '7b||Mathematik';

const beob = (id, lerngruppe, lernendeId, frageId, wert, datum, patch = {})=>({
  id, lerngruppe, lernendeId, frageId, wert, notiz: '', datum,
  zeitpunkt: `${datum}T10:00:00.000Z`, stundenRef: '', rundeId: '', ...patch,
});

function beispiel(){
  return normalisiereBeobachtungsdaten({
    schema: 1,
    einstellungen: { rundenGroesse: 6 },
    lernende: {
      [FR]: [
        { id: 'l1', name: 'Mia', aktiv: true },
        { id: 'l2', name: 'Noah', aktiv: true },
        { id: 'l3', name: 'Lea', aktiv: false },
      ],
      [MA]: [{ id: 'm1', name: 'Ben', aktiv: true }],
    },
    fragen: [
      { id: 'q1', text: 'Beteiligt sich aktiv.', kategorie: 'Mitarbeit', geltung: 'allgemein', standard: true, erstelltAm: '2026-09-01T08:00:00.000Z' },
      { id: 'q2', text: 'Arbeitet konzentriert.', kategorie: 'Verhalten', geltung: 'allgemein', standard: true },
      { id: 'q3', text: 'Spricht spontan Französisch.', kategorie: 'Kompetenz', geltung: 'lerngruppe', lerngruppe: FR },
      { id: 'q4', text: 'Ruhende Frage.', kategorie: 'Sonstiges', aktiv: false },
      { id: 'q5', text: 'Rechnet im Kopf.', kategorie: 'Kompetenz', geltung: 'lerngruppe', lerngruppe: MA },
    ],
    beobachtungen: [
      beob('o1', FR, 'l1', 'q1', 3, '2026-10-01'),
      beob('o2', FR, 'l1', 'q3', 4, '2026-10-05', { notiz: 'Toller Beitrag' }),
      beob('o3', FR, 'l2', 'q1', 2, '2026-10-02'),
      beob('o4', FR, 'l3', 'q2', 1, '2026-09-20'),
      beob('o5', FR, 'l1', 'q4', 2, '2026-09-15'),
      beob('o6', MA, 'm1', 'q5', 4, '2026-10-03'),
    ],
  });
}

function tiefEinfrieren(o){
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) tiefEinfrieren(v);
  }
  return o;
}

const paare = (runde)=> runde.eintraege.map(e => [e.lernendeId, e.frageId]);

/* ---- Konstanten -------------------------------------------------------- */

test('Die Skala hat vier Stufen ohne Mitte, wortgleich mit Capy-scope', ()=>{
  assert.equal(BEOBACHTUNG_SCHEMA, 1);
  assert.deepEqual(SKALA.map(s => s.wert), [1, 2, 3, 4]);
  assert.deepEqual(SKALA.map(s => s.titel), ['eher negativ', 'leicht negativ', 'leicht positiv', 'eher positiv']);
  assert.deepEqual(SKALA.map(s => s.beschreibung), ['trifft kaum zu', 'trifft eher nicht zu', 'trifft eher zu', 'trifft deutlich zu']);
  assert.ok(Object.isFrozen(SKALA) && Object.isFrozen(SKALA[0]));
  assert.equal(skalaTitel(3), 'leicht positiv');
  assert.equal(skalaTitel(7), '');
  assert.ok(istSkalenwert(1) && istSkalenwert(4));
  assert.ok(!istSkalenwert(0) && !istSkalenwert(5) && !istSkalenwert(2.5) && !istSkalenwert('3'));
});

test('Kategorien tragen die Kennungen von Capy-scope und eigene Namen', ()=>{
  assert.deepEqual(KATEGORIEN.map(k => k.id), ['Mitarbeit', 'Verhalten', 'Kompetenz', 'Sonstiges']);
  assert.equal(kategorieName('Kompetenz'), 'Kompetenzentwicklung');
  assert.equal(kategorieName('gibt es nicht'), 'Sonstiges');
});

test('Die acht Standardfragen stammen unverändert aus Capy-scope', ()=>{
  assert.equal(STANDARD_FRAGEN.length, 8);
  assert.equal(STANDARD_FRAGEN[0].text, 'Der Lernende beteiligt sich aktiv am Unterricht.');
  assert.equal(STANDARD_FRAGEN[3].stichwort, 'mündliche Beteiligung');
  const ids = new Set(KATEGORIEN.map(k => k.id));
  assert.ok(STANDARD_FRAGEN.every(q => ids.has(q.kategorie) && q.text && q.stichwort));
  assert.ok(Object.isFrozen(STANDARD_FRAGEN));
  assert.equal(RUNDE_MIN, 1);
  assert.equal(RUNDE_MAX, 10);
});

/* ---- Lerngruppen-Schlüssel -------------------------------------------- */

test('Der Schlüssel ist Klasse||Fach, getrimmt; das Fach darf fehlen, die Klasse nicht', ()=>{
  assert.equal(lerngruppenSchluessel(' 6a ', ' Französisch '), '6a||Französisch');
  assert.equal(lerngruppenSchluessel('6a', ''), '6a||');
  assert.equal(lerngruppenSchluessel('6a'), '6a||');
  assert.equal(lerngruppenSchluessel('', 'Französisch'), '');
  assert.equal(lerngruppenSchluessel('   ', 'Mathe'), '');
  assert.equal(lerngruppenSchluessel(null, null), '');
});

test('Schlüssel zerlegen, vereinheitlichen und als Namen zeigen', ()=>{
  assert.deepEqual(zerlegeLerngruppenSchluessel('6a||Französisch'), { klasse: '6a', fach: 'Französisch' });
  assert.deepEqual(zerlegeLerngruppenSchluessel('6a||'), { klasse: '6a', fach: '' });
  assert.deepEqual(zerlegeLerngruppenSchluessel('6a'), { klasse: '6a', fach: '' });
  assert.deepEqual(zerlegeLerngruppenSchluessel(undefined), { klasse: '', fach: '' });

  assert.equal(normalisiereLerngruppenSchluessel(' 6a || Französisch '), '6a||Französisch');
  assert.equal(normalisiereLerngruppenSchluessel('6a'), '6a||');
  assert.equal(normalisiereLerngruppenSchluessel('||Französisch'), '');

  assert.equal(lerngruppenName('6a||Französisch'), '6a · Französisch');
  assert.equal(lerngruppenName('6a||'), '6a');
  assert.equal(lerngruppenName(''), '');
});

test('Lerngruppen aus der Planung: nach Häufigkeit, dann nach Name; ohne Archiv', ()=>{
  const db = {
    weeks: {
      '2026-09-07': { lessons: {
        '0-0': { classGroup: '6a', subject: 'Französisch' },
        '0-1': { classGroup: '10c', subject: 'Englisch' },
        '1-0': { classGroup: ' 6a ', subject: 'Französisch ' },
        '1-1': { classGroup: '', subject: 'Sport' },
        '2-0': { classGroup: '9a', subject: '' },
        '2-1': null,
      } },
      '2026-09-14': { lessons: {
        '0-0': { classGroup: '6a', subject: 'Französisch' },
        '0-1': { classGroup: '9a', subject: '' },
        '1-0': { classGroup: '7b', subject: 'Englisch' },
      } },
    },
    schoolYearArchives: [{ data: { weeks: { '2025-09-01': { lessons: { '0-0': { classGroup: '5c', subject: 'Deutsch' } } } } } }],
  };
  const gruppen = lerngruppenAusPlanung(db);
  assert.deepEqual(gruppen.map(g => g.schluessel), ['6a||Französisch', '9a||', '7b||Englisch', '10c||Englisch']);
  assert.deepEqual(gruppen[0], { schluessel: '6a||Französisch', klasse: '6a', fach: 'Französisch', name: '6a · Französisch', stunden: 3 });
  assert.deepEqual(gruppen[1], { schluessel: '9a||', klasse: '9a', fach: '', name: '9a', stunden: 2 });
  assert.deepEqual(lerngruppenAusPlanung(null), []);
  assert.deepEqual(lerngruppenAusPlanung({ weeks: 'kaputt' }), []);
});

/* ---- Leere Form, Startdaten, Normalisierung ---------------------------- */

test('Die leere Form hat keine Fragen, die Startdaten die acht Standardfragen', ()=>{
  const leer = leereBeobachtungsdaten();
  assert.deepEqual(leer, { schema: 1, einstellungen: { rundenGroesse: 6 }, lernende: {}, fragen: [], beobachtungen: [] });
  assert.notEqual(leereBeobachtungsdaten(), leer, 'jedes Mal ein neues Objekt');

  const start = startdaten({ neueId: zaehlendeId(), jetzt: '2026-10-12T07:00:00.000Z' });
  assert.equal(start.fragen.length, 8);
  assert.deepEqual(start.fragen.map(f => f.id), ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
  assert.deepEqual(start.fragen[0], {
    id: 'q1', text: STANDARD_FRAGEN[0].text, kategorie: 'Mitarbeit', stichwort: 'allgemein',
    geltung: 'allgemein', lerngruppe: '', kompetenz: '', aktiv: true, standard: true,
    erstelltAm: '2026-10-12T07:00:00.000Z',
  });
  assert.deepEqual(start.lernende, {});
  assert.deepEqual(start.beobachtungen, []);

  // `jetzt` darf auch ein Date sein; ohne Angaben entstehen trotzdem gültige Kennungen.
  assert.equal(startdaten({ jetzt: new Date('2026-01-02T03:04:05.000Z') }).fragen[0].erstelltAm, '2026-01-02T03:04:05.000Z');
  const ohne = startdaten();
  assert.equal(new Set(ohne.fragen.map(f => f.id)).size, 8);
  assert.ok(ohne.fragen.every(f => f.id.startsWith('q-')));
});

test('Normalisierung: beliebige Eingabe ergibt die leere Form – ohne Standardfragen', ()=>{
  for (const roh of [null, undefined, 'Text', 42, [], true, { schema: 99 }]) {
    assert.deepEqual(normalisiereBeobachtungsdaten(roh), leereBeobachtungsdaten());
  }
  assert.deepEqual(normalisiereBeobachtungsdaten({ fragen: 'keine Liste', lernende: [], beobachtungen: {} }), leereBeobachtungsdaten());
});

test('Normalisierung: die Rundengrösse wird auf 1 bis 10 geklemmt', ()=>{
  const g = (v)=> normalisiereBeobachtungsdaten({ einstellungen: { rundenGroesse: v } }).einstellungen.rundenGroesse;
  assert.equal(g(0), 1);
  assert.equal(g(-3), 1);
  assert.equal(g(99), 10);
  assert.equal(g('4'), 4);
  assert.equal(g(3.6), 4);
  assert.equal(g('viele'), RUNDEN_GROESSE_STANDARD);
  assert.equal(g(null), RUNDEN_GROESSE_STANDARD);
});

test('Normalisierung: Lernende je Lerngruppe', ()=>{
  const d = normalisiereBeobachtungsdaten({
    lernende: {
      '6a||Französisch': [
        { id: 'a', name: '  Mia   K. ' },
        { id: 'b', name: '' },
        { id: 'a', name: 'Doppelte Kennung' },
        { name: 'Ohne Kennung', aktiv: false },
        'kein Objekt',
        { id: 'c', name: { vorname: 'Objekt' } },
      ],
      ' 6a || Französisch ': [{ id: 'd', name: 'Noah' }],
      '||Mathe': [{ id: 'e', name: 'Ohne Klasse' }],
      '9b||': [],
      '8c': [{ id: 'f', name: 'Nur Klasse' }],
    },
  }, { neueId: zaehlendeId() });
  assert.deepEqual(d.lernende, {
    '6a||Französisch': [
      { id: 'a', name: 'Mia K.', aktiv: true },
      { id: 'l1', name: 'Ohne Kennung', aktiv: false },
      { id: 'd', name: 'Noah', aktiv: true },
    ],
    '8c||': [{ id: 'f', name: 'Nur Klasse', aktiv: true }],
  });
});

test('Normalisierung: Fragen, Kategorien und Geltung', ()=>{
  const d = normalisiereBeobachtungsdaten({
    fragen: [
      { id: 'f1', text: '  Hört zu.  ', kategorie: 'verhalten', stichwort: ' Ruhe ' },
      { id: 'f2', text: 'Zeigt Fortschritt.', kategorie: 'Kompetenzentwicklung', kompetenz: ' Hörverstehen ' },
      { id: 'f3', text: 'Unbekannte Kategorie.', kategorie: 'Laune' },
      { id: 'f4', text: 'Nur für 6a.', geltung: 'lerngruppe', lerngruppe: ' 6a || Französisch ' },
      { id: 'f5', text: 'Geltung ohne Gruppe.', geltung: 'lerngruppe', lerngruppe: '' },
      { id: 'f6', text: 'Allgemein mit Gruppe.', geltung: 'allgemein', lerngruppe: '6a||Französisch' },
      { id: 'f7', text: '   ' },
      { id: 'f1', text: 'Doppelte Kennung.' },
      { text: 'Ohne Kennung.', aktiv: false, standard: 'ja', erstelltAm: 'gestern' },
    ],
  }, { neueId: zaehlendeId() });

  assert.deepEqual(d.fragen.map(f => f.id), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'q1']);
  assert.deepEqual(d.fragen[0], {
    id: 'f1', text: 'Hört zu.', kategorie: 'Verhalten', stichwort: 'Ruhe', geltung: 'allgemein',
    lerngruppe: '', kompetenz: '', aktiv: true, standard: false, erstelltAm: '',
  });
  assert.equal(d.fragen[1].kategorie, 'Kompetenz');
  assert.equal(d.fragen[1].kompetenz, 'Hörverstehen');
  assert.equal(d.fragen[2].kategorie, 'Sonstiges');
  assert.equal(d.fragen[3].geltung, 'lerngruppe');
  assert.equal(d.fragen[3].lerngruppe, '6a||Französisch');
  assert.equal(d.fragen[4].geltung, 'allgemein', 'ohne gültige Lerngruppe wird die Frage allgemein');
  assert.equal(d.fragen[5].lerngruppe, '', 'eine allgemeine Frage trägt keine Lerngruppe');
  assert.equal(d.fragen[6].aktiv, false);
  assert.equal(d.fragen[6].standard, false, 'nur true ist Standard');
  assert.equal(d.fragen[6].erstelltAm, '');
});

test('Normalisierung: ungültige Werte fallen weg, verwaiste Beobachtungen bleiben', ()=>{
  const gueltig = beob('ok', FR, 'unbekannt', 'auch-unbekannt', 2, '2026-10-01');
  const d = normalisiereBeobachtungsdaten({
    lernende: {},
    fragen: [],
    beobachtungen: [
      gueltig,
      { ...gueltig, id: 'w0', wert: 0 },
      { ...gueltig, id: 'w5', wert: 5 },
      { ...gueltig, id: 'w25', wert: 2.5 },
      { ...gueltig, id: 'wx', wert: 'gut' },
      { ...gueltig, id: 'wnull', wert: null },
      { ...gueltig, id: 'wtrue', wert: true },
      { ...gueltig, id: 'wtext', wert: '3' },
      { ...gueltig, id: 'ohne-gruppe', lerngruppe: '' },
      { ...gueltig, id: 'ohne-lernende', lernendeId: '' },
      { ...gueltig, id: 'ohne-frage', frageId: '  ' },
      { ...gueltig, id: 'datum-aus-zeit', datum: 'irgendwann', zeitpunkt: '2026-10-04T09:30:00.000Z' },
      { ...gueltig, id: 'ohne-datum', datum: '2026-02-30', zeitpunkt: '' },
      { ...gueltig, id: 'ohne-zeit', zeitpunkt: 'bald' },
      { ...gueltig, id: 'ref', stundenRef: '2026-09-28#0-2', rundeId: 'r9', notiz: '  kurz  ' },
      { ...gueltig, id: 'ref-kaputt', stundenRef: 'Montag' },
      { ...gueltig, id: 'ok', wert: 4 },
      null,
    ],
  });
  const nachId = Object.fromEntries(d.beobachtungen.map(b => [b.id, b]));
  assert.deepEqual(Object.keys(nachId), ['ok', 'wtext', 'datum-aus-zeit', 'ohne-zeit', 'ref', 'ref-kaputt']);
  assert.equal(nachId.ok.wert, 2, 'die erste Beobachtung mit einer Kennung gewinnt');
  assert.equal(nachId.ok.lernendeId, 'unbekannt', 'verwaist, aber erhalten');
  assert.equal(nachId.wtext.wert, 3);
  assert.equal(nachId['datum-aus-zeit'].datum, '2026-10-04');
  assert.equal(nachId['ohne-zeit'].zeitpunkt, '2026-10-01T00:00:00.000Z');
  assert.equal(nachId.ref.stundenRef, '2026-09-28#0-2');
  assert.equal(nachId.ref.rundeId, 'r9');
  assert.equal(nachId.ref.notiz, 'kurz');
  assert.equal(nachId['ref-kaputt'].stundenRef, '');
});

test('Normalisierung ist idempotent', ()=>{
  const einmal = beispiel();
  assert.deepEqual(normalisiereBeobachtungsdaten(einmal), einmal);
  assert.deepEqual(normalisiereBeobachtungsdaten(JSON.parse(JSON.stringify(einmal))), einmal);
});

test('Datum und Vergleichstext', ()=>{
  assert.ok(istDatum('2026-10-12'));
  assert.ok(!istDatum('2026-13-01'));
  assert.ok(!istDatum('2026-02-29'));
  assert.ok(!istDatum('12.10.2026'));
  assert.equal(vergleichsText('  MIA   k. '), 'mia k.');
});

/* ---- Lernende ---------------------------------------------------------- */

test('Lernende der Gruppe: nur aktive, auf Wunsch auch ausgeblendete', ()=>{
  const d = beispiel();
  assert.deepEqual(lernendeDerGruppe(d, FR).map(l => l.id), ['l1', 'l2']);
  assert.deepEqual(lernendeDerGruppe(d, ' 6a || Französisch ', { auchInaktive: true }).map(l => l.id), ['l1', 'l2', 'l3']);
  assert.deepEqual(lernendeDerGruppe(d, '9z||Nichts'), []);
  assert.deepEqual(lernendeDerGruppe(d, ''), []);
  assert.deepEqual(lernendeDerGruppe(null, FR), []);
});

test('Namen einfügen: Zeilen, Leerzeilen, Rand und Doppelte', ()=>{
  const d = beispiel();
  const neu = lernendeHinzufuegen(d, FR, 'Ella\r\n\n  Finn  \nmia\nLEA\nella\n   \nJonas   P.', { neueId: zaehlendeId() });
  assert.deepEqual(lernendeDerGruppe(neu, FR, { auchInaktive: true }).map(l => l.name),
    ['Mia', 'Noah', 'Lea', 'Ella', 'Finn', 'Jonas P.']);
  const ella = lernendeDerGruppe(neu, FR).find(l => l.name === 'Ella');
  assert.deepEqual(ella, { id: 'l1', name: 'Ella', aktiv: true });
  assert.equal(lernendeDerGruppe(neu, FR, { auchInaktive: true }).find(l => l.name === 'Lea').aktiv, false,
    'eine ausgeblendete Lernende wird weder doppelt angelegt noch eingeblendet');

  // Auch als Liste, auch in eine neue Lerngruppe.
  const zweite = lernendeHinzufuegen(d, ' 5c ', ['Ada', ' ', 'Bo', 'ada'], { neueId: zaehlendeId() });
  assert.deepEqual(lernendeDerGruppe(zweite, '5c||').map(l => l.name), ['Ada', 'Bo']);

  // Nichts Neues oder keine gültige Gruppe: unverändert.
  assert.equal(lernendeHinzufuegen(d, FR, 'Mia\nNoah'), d);
  assert.equal(lernendeHinzufuegen(d, FR, ''), d);
  assert.equal(lernendeHinzufuegen(d, '', 'Neu'), d);
  assert.equal(lernendeHinzufuegen(d, FR, 42), d);
});

test('Lernende umbenennen und ausblenden – Beobachtungen bleiben', ()=>{
  const d = beispiel();
  const umbenannt = lernendeAendern(d, FR, 'l1', { name: '  Mia   S. ' });
  assert.equal(lernendeDerGruppe(umbenannt, FR)[0].name, 'Mia S.');
  assert.equal(lernendeAendern(d, FR, 'l1', { name: '   ' }), d, 'ein leerer Name ist kein Umbenennen');
  assert.equal(lernendeAendern(d, FR, 'l1', { name: 'Mia', aktiv: true }), d, 'nichts geändert');
  assert.equal(lernendeAendern(d, FR, 'gibt-es-nicht', { name: 'X' }), d);
  assert.equal(lernendeAendern(d, MA, 'l1', { name: 'X' }), d, 'die Kennung gilt nur in ihrer Gruppe');

  const ausgeblendet = lernendeAendern(d, FR, 'l2', { aktiv: false });
  assert.deepEqual(lernendeDerGruppe(ausgeblendet, FR).map(l => l.id), ['l1']);
  assert.equal(beobachtungenVonLernenden(ausgeblendet, FR, 'l2'), 1);
  const wieder = lernendeAendern(ausgeblendet, FR, 'l2', { aktiv: true });
  assert.deepEqual(lernendeDerGruppe(wieder, FR).map(l => l.id), ['l1', 'l2']);
});

test('Lernende verschieben: hoch, runter, an den Rändern nichts', ()=>{
  const d = beispiel();
  const ids = (x)=> lernendeDerGruppe(x, FR, { auchInaktive: true }).map(l => l.id);
  assert.deepEqual(ids(lernendeVerschieben(d, FR, 'l2', -1)), ['l2', 'l1', 'l3']);
  assert.deepEqual(ids(lernendeVerschieben(d, FR, 'l2', +1)), ['l1', 'l3', 'l2']);
  assert.equal(lernendeVerschieben(d, FR, 'l1', -1), d);
  assert.equal(lernendeVerschieben(d, FR, 'l3', +1), d);
  assert.equal(lernendeVerschieben(d, FR, 'l2', 0), d);
  assert.equal(lernendeVerschieben(d, FR, 'xx', 1), d);
});

test('Lernende löschen nimmt ihre Beobachtungen mit – nur in dieser Gruppe', ()=>{
  // Dieselbe Kennung in einer anderen Gruppe darf nicht mitgehen.
  const d = normalisiereBeobachtungsdaten({
    ...beispiel(),
    lernende: { ...beispiel().lernende, [MA]: [{ id: 'l1', name: 'Mia' }] },
    beobachtungen: [...beispiel().beobachtungen, beob('fremd', MA, 'l1', 'q1', 3, '2026-10-06')],
  });
  assert.equal(beobachtungenVonLernenden(d, FR, 'l1'), 3);
  const ohne = lernendeLoeschen(d, FR, 'l1');
  assert.deepEqual(lernendeDerGruppe(ohne, FR, { auchInaktive: true }).map(l => l.id), ['l2', 'l3']);
  assert.equal(beobachtungenVonLernenden(ohne, FR, 'l1'), 0);
  assert.deepEqual(ohne.beobachtungen.map(b => b.id), ['o3', 'o4', 'o6', 'fremd']);
  assert.deepEqual(lernendeDerGruppe(ohne, MA).map(l => l.id), ['l1']);
  assert.equal(lernendeLoeschen(d, FR, 'gibt-es-nicht'), d);

  // Die letzte Lernende einer Gruppe: die Gruppe verschwindet aus der Liste.
  const leer = lernendeLoeschen(d, MA, 'l1');
  assert.deepEqual(lernendeDerGruppe(leer, MA), []);
  assert.ok(!Object.hasOwn(leer.lernende, MA));
});

test('Liste aus einer anderen Lerngruppe übernehmen: aktive Namen, neue Kennungen, keine Beobachtungen', ()=>{
  const d = lernendeHinzufuegen(beispiel(), '6a||Englisch', ['Noah'], { neueId: ()=> 'vorher' });
  const kopiert = lernendeKopieren(d, FR, '6a||Englisch', { neueId: zaehlendeId() });
  const ziel = lernendeDerGruppe(kopiert, '6a||Englisch', { auchInaktive: true });
  assert.deepEqual(ziel.map(l => [l.id, l.name]), [['vorher', 'Noah'], ['l1', 'Mia']],
    'Lea ist ausgeblendet, Noah gibt es schon');
  assert.equal(kopiert.beobachtungen.length, d.beobachtungen.length);
  assert.equal(beobachtungenVonLernenden(kopiert, '6a||Englisch', 'l1'), 0);
  assert.equal(lernendeKopieren(d, FR, FR), d);
  assert.equal(lernendeKopieren(d, FR, ''), d);
  assert.equal(lernendeKopieren(d, '9z||', FR), d);
});

/* ---- Fragen ------------------------------------------------------------ */

test('Neue Frage: leerer Text ändert nichts, sonst eine eigene Frage', ()=>{
  const d = beispiel();
  assert.equal(frageHinzufuegen(d, { text: '   ' }), d);
  assert.equal(frageHinzufuegen(d, {}), d);

  const neu = frageHinzufuegen(d, {
    text: ' Nutzt die Zielsprache. ', kategorie: 'Kompetenz', stichwort: 'Sprache',
    geltung: 'lerngruppe', lerngruppe: ' 6a || Französisch ', kompetenz: 'Sprechen',
  }, { neueId: zaehlendeId(), jetzt: '2026-10-12T08:00:00.000Z' });
  assert.equal(neu.fragen.length, d.fragen.length + 1);
  assert.deepEqual(neu.fragen.at(-1), {
    id: 'q1', text: 'Nutzt die Zielsprache.', kategorie: 'Kompetenz', stichwort: 'Sprache',
    geltung: 'lerngruppe', lerngruppe: FR, kompetenz: 'Sprechen',
    aktiv: true, standard: false, erstelltAm: '2026-10-12T08:00:00.000Z',
  });

  const ohneGruppe = frageHinzufuegen(d, { text: 'X', geltung: 'lerngruppe', lerngruppe: '' });
  assert.equal(ohneGruppe.fragen.at(-1).geltung, 'allgemein');
  assert.equal(ohneGruppe.fragen.at(-1).kategorie, 'Sonstiges');
});

test('Frage ändern: Felder ja, Kennung, Herkunft und Anlagedatum nein', ()=>{
  const d = beispiel();
  const geaendert = frageAendern(d, 'q1', {
    text: 'Beteiligt sich lebhaft.', kategorie: 'Verhalten', stichwort: 'neu',
    id: 'anders', standard: false, erstelltAm: '1999-01-01T00:00:00.000Z',
  });
  const q1 = geaendert.fragen.find(f => f.id === 'q1');
  assert.equal(q1.text, 'Beteiligt sich lebhaft.');
  assert.equal(q1.kategorie, 'Verhalten');
  assert.equal(q1.stichwort, 'neu');
  assert.equal(q1.standard, true);
  assert.equal(q1.erstelltAm, '2026-09-01T08:00:00.000Z');
  assert.equal(geaendert.fragen.findIndex(f => f.id === 'q1'), 0, 'die Reihenfolge bleibt');

  assert.equal(frageAendern(d, 'q1', { text: '  ' }).fragen[0].text, 'Beteiligt sich aktiv.');
  assert.equal(frageAendern(d, 'q1', { aktiv: false }).fragen[0].aktiv, false);
  assert.equal(frageAendern(d, 'q1', { aktiv: 'nein' }).fragen[0].aktiv, true, 'nur ein Wahrheitswert schaltet');

  const allgemein = frageAendern(d, 'q3', { geltung: 'allgemein' }).fragen.find(f => f.id === 'q3');
  assert.equal(allgemein.geltung, 'allgemein');
  assert.equal(allgemein.lerngruppe, '');
  const verlegt = frageAendern(d, 'q1', { geltung: 'lerngruppe', lerngruppe: MA }).fragen[0];
  assert.equal(verlegt.geltung, 'lerngruppe');
  assert.equal(verlegt.lerngruppe, MA);

  assert.equal(frageAendern(d, 'gibt-es-nicht', { text: 'X' }), d);
});

test('Frage löschen nimmt ihre Beobachtungen in allen Gruppen mit', ()=>{
  const d = normalisiereBeobachtungsdaten({
    ...beispiel(),
    beobachtungen: [...beispiel().beobachtungen, beob('o7', MA, 'm1', 'q1', 2, '2026-10-06')],
  });
  assert.equal(beobachtungenZurFrage(d, 'q1'), 3);
  const ohne = frageLoeschen(d, 'q1');
  assert.ok(!ohne.fragen.some(f => f.id === 'q1'));
  assert.equal(beobachtungenZurFrage(ohne, 'q1'), 0);
  assert.deepEqual(ohne.beobachtungen.map(b => b.id), ['o2', 'o4', 'o5', 'o6']);
  assert.equal(frageLoeschen(d, 'gibt-es-nicht'), d);
});

test('Geltung: allgemeine Fragen plus die eigenen der Lerngruppe', ()=>{
  const d = beispiel();
  assert.deepEqual(fragenFuer(d, FR).map(f => f.id), ['q1', 'q2', 'q3']);
  assert.deepEqual(fragenFuer(d, MA).map(f => f.id), ['q1', 'q2', 'q5']);
  assert.deepEqual(fragenFuer(d, FR, { auchInaktive: true }).map(f => f.id), ['q1', 'q2', 'q4', 'q3']);
  assert.deepEqual(fragenFuer(d, '9z||').map(f => f.id), ['q1', 'q2']);
  assert.deepEqual(fragenFuer(d, '').map(f => f.id), ['q1', 'q2']);
  assert.equal(beobachtungenZurFrage(d, 'q4'), 1);
});

/* ---- Runde ------------------------------------------------------------- */

const G = '5a||Deutsch';
function rundenDaten(beobachtungen = [], patch = {}){
  return normalisiereBeobachtungsdaten({
    lernende: { [G]: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] },
    fragen: [{ id: 'f1', text: 'F1' }, { id: 'f2', text: 'F2' }, { id: 'f3', text: 'F3' }],
    beobachtungen,
    ...patch,
  });
}
const null_zufall = ()=> 0;

test('Runde mit festem Zufall: vollständig vorhersagbar', ()=>{
  const runde = erzeugeRunde(rundenDaten(), G, { anzahl: 6, heuteISO: '2026-10-12', zufall: null_zufall, neueId: zaehlendeId() });
  assert.equal(runde.id, 'r1');
  assert.equal(runde.lerngruppe, G);
  assert.deepEqual(paare(runde), [['a', 'f1'], ['b', 'f2'], ['c', 'f3'], ['c', 'f2'], ['b', 'f3'], ['a', 'f3']]);
  assert.deepEqual(runde.eintraege.map(e => e.id), ['r1-1', 'r1-2', 'r1-3', 'r1-4', 'r1-5', 'r1-6']);
});

test('Runde: gleicher Zufall, gleiche Runde', ()=>{
  // Ein kleiner, reproduzierbarer Zufallsgenerator.
  const saat = (s)=> ()=>{ s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const d = rundenDaten([beob('x', G, 'a', 'f1', 3, '2026-10-01')]);
  const eins = erzeugeRunde(d, G, { anzahl: 7, heuteISO: '2026-10-12', zufall: saat(7), neueId: zaehlendeId() });
  const zwei = erzeugeRunde(d, G, { anzahl: 7, heuteISO: '2026-10-12', zufall: saat(7), neueId: zaehlendeId() });
  assert.deepEqual(eins, zwei);
  assert.equal(new Set(paare(eins).map(p => p.join('/'))).size, 7, 'kein Paar zweimal');
});

test('Runde: der Zufall entscheidet nur bei sonst gleichem Stand', ()=>{
  const d = rundenDaten([], { fragen: [{ id: 'f1', text: 'F1' }] });
  const folge = (werte)=>{ let i = 0; return ()=> werte[i++] ?? 0; };
  assert.deepEqual(paare(erzeugeRunde(d, G, { anzahl: 3, heuteISO: '2026-10-12', zufall: null_zufall })),
    [['a', 'f1'], ['b', 'f1'], ['c', 'f1']]);
  // Erster Zug: a würfelt 0.9, b 0.1, c 0.5 – b kommt zuerst.
  assert.deepEqual(paare(erzeugeRunde(d, G, { anzahl: 1, heuteISO: '2026-10-12', zufall: folge([0.9, 0.1, 0.5]) })),
    [['b', 'f1']]);
  // Eine Beobachtung wiegt 1000 – mehr als jeder Zufall (höchstens 8).
  const mitBeob = rundenDaten([beob('x', G, 'b', 'f1', 3, '2026-10-01')], { fragen: [{ id: 'f1', text: 'F1' }] });
  // a würfelt 0.99, b 0, c 0.5: c vor a, b trotz kleinstem Wurf zuletzt.
  assert.deepEqual(paare(erzeugeRunde(mitBeob, G, { anzahl: 3, heuteISO: '2026-10-12', zufall: folge([0.99, 0, 0.5]) })),
    [['c', 'f1'], ['a', 'f1'], ['b', 'f1']]);
});

test('Runde: erst kommen alle Lernenden dran, dann wiederholt sich jemand', ()=>{
  const runde = erzeugeRunde(rundenDaten(), G, { anzahl: 9, heuteISO: '2026-10-12', zufall: Math.random });
  const lernende = runde.eintraege.map(e => e.lernendeId);
  assert.equal(new Set(lernende.slice(0, 3)).size, 3);
  assert.equal(new Set(lernende.slice(3, 6)).size, 3);
  assert.equal(new Set(lernende.slice(6, 9)).size, 3);
  assert.equal(new Set(paare(runde).map(p => p.join('/'))).size, 9);
});

test('Runde: am selben Tag schon beobachtete Paare kommen zuletzt', ()=>{
  const fragen = [{ id: 'f1', text: 'F1' }];
  const lernende = { [G]: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
  const d = normalisiereBeobachtungsdaten({
    lernende, fragen,
    beobachtungen: [
      beob('heute', G, 'a', 'f1', 3, '2026-10-12'),
      beob('b1', G, 'b', 'f1', 3, '2026-10-01'),
      beob('b2', G, 'b', 'f1', 3, '2026-10-02'),
      beob('b3', G, 'b', 'f1', 3, '2026-10-03'),
    ],
  });
  // Heute: a hat 1 Beobachtung + 10000, b hat 3 Beobachtungen → b zuerst.
  assert.deepEqual(paare(erzeugeRunde(d, G, { anzahl: 2, heuteISO: '2026-10-12', zufall: null_zufall })),
    [['b', 'f1'], ['a', 'f1']]);
  // Am Tag danach zählt nur noch die Anzahl → a zuerst.
  assert.deepEqual(paare(erzeugeRunde(d, G, { anzahl: 2, heuteISO: '2026-10-13', zufall: null_zufall })),
    [['a', 'f1'], ['b', 'f1']]);
});

test('Runde: gezählt wird nur in dieser Lerngruppe; bei Gleichstand die ältere Beobachtung zuerst', ()=>{
  const H = '5a||Englisch';
  const d = normalisiereBeobachtungsdaten({
    lernende: { [G]: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], [H]: [{ id: 'a', name: 'A' }] },
    fragen: [{ id: 'f1', text: 'F1' }],
    beobachtungen: [
      beob('g1', G, 'b', 'f1', 3, '2026-10-01'),
      ...[1, 2, 3, 4, 5].map(i => beob(`h${i}`, H, 'a', 'f1', 2, `2026-10-0${i}`)),
    ],
  });
  assert.deepEqual(paare(erzeugeRunde(d, G, { anzahl: 1, heuteISO: '2026-10-12', zufall: null_zufall })), [['a', 'f1']]);

  const gleichstand = normalisiereBeobachtungsdaten({
    lernende: { [G]: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    fragen: [{ id: 'f1', text: 'F1' }],
    beobachtungen: [beob('neu', G, 'a', 'f1', 3, '2026-10-01'), beob('alt', G, 'b', 'f1', 3, '2026-09-01')],
  });
  assert.deepEqual(paare(erzeugeRunde(gleichstand, G, { anzahl: 2, heuteISO: '2026-10-12', zufall: null_zufall })),
    [['b', 'f1'], ['a', 'f1']]);
});

test('Runde: nur aktive Lernende und die Fragen, die in der Gruppe gelten', ()=>{
  const d = beispiel();
  const runde = erzeugeRunde(d, FR, { anzahl: 10, heuteISO: '2026-10-12', zufall: Math.random });
  assert.equal(runde.eintraege.length, 6, 'zwei aktive Lernende × drei geltende Fragen');
  assert.ok(runde.eintraege.every(e => ['l1', 'l2'].includes(e.lernendeId)));
  assert.ok(runde.eintraege.every(e => ['q1', 'q2', 'q3'].includes(e.frageId)));
});

test('Runde: Anzahl wird geklemmt, ohne Angabe gilt die Einstellung', ()=>{
  const d = rundenDaten();
  const anzahl = (a, daten = d)=> erzeugeRunde(daten, G, { anzahl: a, heuteISO: '2026-10-12', zufall: null_zufall }).eintraege.length;
  assert.equal(anzahl(0), RUNDE_MIN);
  assert.equal(anzahl(-5), RUNDE_MIN);
  assert.equal(anzahl(50), 9, 'mehr als alle Paare geht nicht');
  assert.equal(anzahl(4), 4);
  assert.equal(anzahl(undefined), 6);
  const dreier = normalisiereBeobachtungsdaten({ ...d, einstellungen: { rundenGroesse: 3 } });
  assert.equal(anzahl(undefined, dreier), 3);

  const gross = normalisiereBeobachtungsdaten({
    lernende: { [G]: 'abcdefghijkl'.split('').map(x => ({ id: x, name: x.toUpperCase() })) },
    fragen: [{ id: 'f1', text: 'F1' }],
  });
  assert.equal(anzahl(50, gross), RUNDE_MAX);
});

test('Runde: ohne Lernende oder ohne Fragen bleibt sie leer', ()=>{
  const ohneLernende = erzeugeRunde(rundenDaten([], { lernende: {} }), G, { neueId: zaehlendeId() });
  assert.deepEqual(ohneLernende, { id: 'r1', lerngruppe: G, eintraege: [] });
  assert.deepEqual(erzeugeRunde(rundenDaten([], { fragen: [] }), G).eintraege, []);
  const alleAus = rundenDaten([], { fragen: [{ id: 'f1', text: 'F1', aktiv: false }] });
  assert.deepEqual(erzeugeRunde(alleAus, G).eintraege, []);
  assert.deepEqual(erzeugeRunde(rundenDaten(), '').eintraege, []);
  assert.deepEqual(erzeugeRunde(null, G).eintraege, []);
});

/* ---- Erfassen ---------------------------------------------------------- */

test('Erfassen hängt eine vollständige Beobachtung an', ()=>{
  const d = beispiel();
  const neu = erfasseBeobachtung(d, {
    lerngruppe: ' 6a || Französisch ', lernendeId: 'l2', frageId: 'q3', wert: '4', notiz: '  Hat erklärt. ',
    datum: '2026-10-12', zeitpunkt: '2026-10-12T09:15:00.000Z', stundenRef: '2026-10-12#0-2', rundeId: 'r7',
  }, { neueId: zaehlendeId() });
  assert.equal(neu.beobachtungen.length, d.beobachtungen.length + 1);
  assert.deepEqual(neu.beobachtungen.at(-1), {
    id: 'obs1', lerngruppe: FR, lernendeId: 'l2', frageId: 'q3', wert: 4, notiz: 'Hat erklärt.',
    datum: '2026-10-12', zeitpunkt: '2026-10-12T09:15:00.000Z', stundenRef: '2026-10-12#0-2', rundeId: 'r7',
  });
});

test('Erfassen: ohne Datum und Zeitpunkt gilt jetzt; Ungültiges ändert nichts', ()=>{
  const d = beispiel();
  const ohne = erfasseBeobachtung(d, { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', wert: 2 });
  const b = ohne.beobachtungen.at(-1);
  assert.ok(istDatum(b.datum));
  assert.ok(Math.abs(Date.parse(b.zeitpunkt) - Date.now()) < 60_000);
  assert.equal(b.stundenRef, '');
  assert.equal(b.rundeId, '');
  assert.ok(b.id.startsWith('obs-'));

  const basis = { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', datum: '2026-10-12' };
  for (const wert of [0, 5, 2.5, 'gut', null, undefined, true]) {
    assert.equal(erfasseBeobachtung(d, { ...basis, wert }), d, `wert ${String(wert)}`);
  }
  assert.equal(erfasseBeobachtung(d, { ...basis, wert: 3, lernendeId: '' }), d);
  assert.equal(erfasseBeobachtung(d, { ...basis, wert: 3, frageId: '' }), d);
  assert.equal(erfasseBeobachtung(d, { ...basis, wert: 3, lerngruppe: '' }), d);
});

/* ---- Auswertung -------------------------------------------------------- */

test('Abdeckung: aktive Lernende × geltende aktive Fragen, beobachtet ist mindestens einmal', ()=>{
  const d = beispiel();
  // l1, l2 × q1, q2, q3 = 6 Paare; beobachtet: l1/q1, l1/q3, l2/q1 (l3 ausgeblendet, q4 ruht).
  assert.deepEqual(abdeckung(d, FR), { paare: 6, beobachtet: 3, prozent: 50 });
  assert.deepEqual(abdeckung(d, MA), { paare: 3, beobachtet: 1, prozent: 33 });
  assert.deepEqual(abdeckung(d, '9z||'), { paare: 0, beobachtet: 0, prozent: 0 });

  const doppelt = erfasseBeobachtung(d, { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', wert: 1, datum: '2026-10-12' });
  assert.equal(abdeckung(doppelt, FR).beobachtet, 3, 'eine zweite Beobachtung desselben Paares zählt nicht doppelt');
});

test('Abdeckung: 100 % nur, wenn wirklich alle Paare beobachtet sind, 0 % nur ohne jedes', ()=>{
  const neueId = zaehlendeId();
  const namen = (n)=> Array.from({ length: n }, (_, i)=> `Kind ${i + 1}`);
  const mitPaaren = (anzahlLernende, beobachtet)=>{
    const d = lernendeHinzufuegen(startdaten({ neueId }), FR, namen(anzahlLernende), { neueId });
    const alle = lernendeDerGruppe(d, FR).flatMap(l => fragenFuer(d, FR).map(f => [l.id, f.id]));
    return normalisiereBeobachtungsdaten({
      ...d,
      beobachtungen: alle.slice(0, beobachtet).map(([l, f], i)=> beob(`b${i}`, FR, l, f, 3, '2026-10-12')),
    });
  };
  // 25 Lernende × 8 Standardfragen: 199 von 200 sind 99,5 % – gezeigt wird 99.
  assert.deepEqual(abdeckung(mitPaaren(25, 199), FR), { paare: 200, beobachtet: 199, prozent: 99 });
  assert.equal(abdeckung(mitPaaren(25, 200), FR).prozent, 100);
  // Am anderen Ende: Ein einziges von 208 Paaren ist nicht nichts.
  assert.deepEqual(abdeckung(mitPaaren(26, 1), FR), { paare: 208, beobachtet: 1, prozent: 1 });
  assert.equal(abdeckung(mitPaaren(26, 0), FR).prozent, 0);
});

test('Übersicht je Lernender: Anzahl, Mittel, letzte Beobachtung, je Kategorie', ()=>{
  const d = beispiel();
  const uebersicht = lernendenUebersicht(d, FR);
  assert.deepEqual(uebersicht.map(z => z.lernende.id), ['l1', 'l2', 'l3'], 'ausgeblendete sind dabei');

  const [mia, noah, lea] = uebersicht;
  assert.equal(mia.anzahl, 3);
  assert.equal(mia.mittel, 3);  // 3, 4, 2
  assert.equal(mia.letzteDatum, '2026-10-05');
  assert.deepEqual(mia.jeKategorie, { Mitarbeit: 3, Verhalten: null, Kompetenz: 4, Sonstiges: 2 });

  assert.equal(noah.anzahl, 1);
  assert.equal(noah.mittel, 2);
  assert.equal(lea.lernende.aktiv, false);
  assert.equal(lea.jeKategorie.Verhalten, 1);

  const ohneBeob = lernendenUebersicht(lernendeHinzufuegen(d, FR, 'Neu'), FR).at(-1);
  assert.deepEqual({ ...ohneBeob, lernende: null }, {
    lernende: null, anzahl: 0, mittel: null, letzteDatum: '',
    jeKategorie: { Mitarbeit: null, Verhalten: null, Kompetenz: null, Sonstiges: null },
  });
  assert.deepEqual(lernendenUebersicht(d, '9z||'), []);
});

test('Fragenübersicht: geltende Fragen; ruhende nur mit Beobachtungen', ()=>{
  const d = erfasseBeobachtung(beispiel(), { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', wert: 4, datum: '2026-10-12' });
  const fr = fragenUebersicht(d, FR);
  assert.deepEqual(fr.map(z => [z.frage.id, z.anzahl, z.lernendeMitBeobachtung]), [
    ['q1', 3, 2],
    ['q2', 1, 1],
    ['q4', 1, 1],
    ['q3', 1, 1],
  ]);
  // In 7b hat die ruhende Frage keine Beobachtung – sie erscheint nicht.
  assert.deepEqual(fragenUebersicht(d, MA).map(z => z.frage.id), ['q1', 'q2', 'q5']);
});

test('Einzelverlauf: neueste zuerst, verwaiste Beobachtungen mit frage: null', ()=>{
  const d = normalisiereBeobachtungsdaten({
    ...beispiel(),
    beobachtungen: [
      ...beispiel().beobachtungen,
      beob('waise', FR, 'l1', 'geloescht', 2, '2026-10-08'),
      beob('gleichzeitig', FR, 'l1', 'q2', 3, '2026-10-08'),
    ],
  });
  const verlauf = verlaufVon(d, FR, 'l1');
  assert.deepEqual(verlauf.map(v => v.beobachtung.id), ['gleichzeitig', 'waise', 'o2', 'o1', 'o5']);
  assert.equal(verlauf[1].frage, null);
  assert.equal(verlauf[2].frage.id, 'q3');
  assert.deepEqual(verlaufVon(d, MA, 'l1'), []);
});

test('Einzelverlauf: eine nachträglich erfasste Stunde steht bei ihrem Datum', ()=>{
  const neueId = zaehlendeId();
  let d = beispiel();
  d = erfasseBeobachtung(d, { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', wert: 3, datum: '2026-10-10', zeitpunkt: '2026-10-10T15:00:00.000Z' }, { neueId });
  // Die Stunde vom 6. wird erst am 12. nachbereitet.
  d = erfasseBeobachtung(d, { lerngruppe: FR, lernendeId: 'l1', frageId: 'q2', wert: 2, datum: '2026-10-06', zeitpunkt: '2026-10-12T09:00:00.000Z' }, { neueId });
  const daten = verlaufVon(d, FR, 'l1').map(v => v.beobachtung.datum);
  assert.deepEqual(daten, ['2026-10-10', '2026-10-06', '2026-10-05', '2026-10-01', '2026-09-15']);
  assert.equal(lernendenUebersicht(d, FR)[0].letzteDatum, daten[0], 'Verlauf und „Zuletzt" sagen dasselbe');
});

test('Umfang für das Zurücksetzen', ()=>{
  const d = beispiel();
  assert.deepEqual(beobachtungsUmfang(d), { beobachtungsLerngruppen: 2, lernende: 4, beobachtungen: 6, eigeneFragen: 3 });
  // Eine Gruppe, die nur noch Beobachtungen hat, zählt mit.
  const nurBeob = lernendeLoeschen(d, MA, 'm1');
  assert.deepEqual(beobachtungsUmfang({ ...nurBeob, beobachtungen: d.beobachtungen }),
    { beobachtungsLerngruppen: 2, lernende: 3, beobachtungen: 6, eigeneFragen: 3 });
  assert.deepEqual(beobachtungsUmfang(null), { beobachtungsLerngruppen: 0, lernende: 0, beobachtungen: 0, eigeneFragen: 0 });
  assert.equal(beobachtungsUmfang(startdaten()).eigeneFragen, 0);
});

/* ---- Zusammenführen ---------------------------------------------------- */

test('Zusammenführen derselben Daten ändert nichts', ()=>{
  const d = beispiel();
  const { daten, bericht } = zusammenfuehren(d, d);
  assert.deepEqual(bericht, { lernende: 0, fragen: 0, beobachtungen: 0 });
  assert.deepEqual(daten, d);
});

test('Zusammenführen in leere Daten übernimmt alles', ()=>{
  const d = beispiel();
  const { daten, bericht } = zusammenfuehren(leereBeobachtungsdaten(), d);
  assert.deepEqual(bericht, { lernende: 4, fragen: 5, beobachtungen: 6 });
  assert.deepEqual(daten.lernende, d.lernende);
  assert.deepEqual(daten.fragen, d.fragen);
  assert.deepEqual(daten.beobachtungen, d.beobachtungen);
});

test('Zusammenführen: Lernende über den Namen, Kennungen der Beobachtungen werden umgeschrieben', ()=>{
  const basis = beispiel();
  const eingehend = normalisiereBeobachtungsdaten({
    einstellungen: { rundenGroesse: 2 },
    lernende: {
      [FR]: [
        { id: 'fremd-mia', name: ' mia ' },
        { id: 'neu-1', name: 'Mia' },
        { id: 'l2', name: 'Noah anders geschrieben' },
        { id: 'neu-2', name: 'Ella' },
      ],
      '8c||Musik': [{ id: 'k1', name: 'Kai' }],
    },
    fragen: [],
    beobachtungen: [
      beob('e1', FR, 'fremd-mia', 'q1', 4, '2026-10-10'),
      beob('e2', FR, 'neu-1', 'q1', 1, '2026-10-10'),
      beob('e3', FR, 'l2', 'q2', 3, '2026-10-10'),
      beob('e4', '8c||Musik', 'k1', 'q1', 3, '2026-10-10'),
      beob('o1', FR, 'l1', 'q1', 1, '2026-10-01', { notiz: 'darf nicht überschreiben' }),
    ],
  });
  const { daten, bericht } = zusammenfuehren(basis, eingehend);

  // Die erste "Mia" wird Mia (l1); die zweite ist eine andere Person und kommt neu dazu.
  assert.deepEqual(lernendeDerGruppe(daten, FR, { auchInaktive: true }).map(l => [l.id, l.name]), [
    ['l1', 'Mia'], ['l2', 'Noah'], ['l3', 'Lea'], ['neu-1', 'Mia'], ['neu-2', 'Ella'],
  ]);
  assert.deepEqual(lernendeDerGruppe(daten, '8c||Musik').map(l => l.id), ['k1']);
  assert.deepEqual(bericht, { lernende: 3, fragen: 0, beobachtungen: 4 });

  const nachId = Object.fromEntries(daten.beobachtungen.map(b => [b.id, b]));
  assert.equal(nachId.e1.lernendeId, 'l1');
  assert.equal(nachId.e2.lernendeId, 'neu-1');
  assert.equal(nachId.e3.lernendeId, 'l2');
  assert.equal(nachId.o1.wert, 3, 'eine vorhandene Beobachtung wird nie überschrieben');
  assert.equal(nachId.o1.notiz, '');
  assert.equal(daten.einstellungen.rundenGroesse, 6, 'die Einstellungen der Basis gelten');

  // Ein zweites Mal: nichts mehr neu.
  const nochmal = zusammenfuehren(daten, eingehend);
  assert.deepEqual(nochmal.bericht, { lernende: 0, fragen: 0, beobachtungen: 0 });
  assert.deepEqual(nochmal.daten, daten);
});

test('Zusammenführen: Fragen über die Kennung oder Text, Geltung und Lerngruppe', ()=>{
  const basis = beispiel();
  const eingehend = normalisiereBeobachtungsdaten({
    lernende: { [FR]: [{ id: 'l1', name: 'Mia' }] },
    fragen: [
      { id: 'q1', text: 'Anderer Text, gleiche Kennung.' },
      { id: 'x1', text: '  beteiligt sich   AKTIV. ' },
      { id: 'x3', text: 'Spricht spontan Französisch.', geltung: 'lerngruppe', lerngruppe: FR },
      { id: 'x3b', text: 'Spricht spontan Französisch.', geltung: 'allgemein' },
      { id: 'x9', text: 'Ganz neue Frage.', kategorie: 'Mitarbeit' },
    ],
    beobachtungen: [
      beob('e1', FR, 'l1', 'x1', 4, '2026-10-10'),
      beob('e2', FR, 'l1', 'x3', 4, '2026-10-10'),
      beob('e3', FR, 'l1', 'x3b', 4, '2026-10-10'),
      beob('e4', FR, 'l1', 'x9', 4, '2026-10-10'),
      beob('e5', FR, 'l1', 'q1', 4, '2026-10-10'),
    ],
  });
  const { daten, bericht } = zusammenfuehren(basis, eingehend);
  assert.deepEqual(bericht, { lernende: 0, fragen: 2, beobachtungen: 5 });
  assert.equal(daten.fragen.find(f => f.id === 'q1').text, 'Beteiligt sich aktiv.', 'vorhandene Fragen bleiben');
  assert.deepEqual(daten.fragen.slice(-2).map(f => f.id), ['x3b', 'x9']);

  const frageVon = Object.fromEntries(daten.beobachtungen.map(b => [b.id, b.frageId]));
  assert.deepEqual(
    [frageVon.e1, frageVon.e2, frageVon.e3, frageVon.e4, frageVon.e5],
    ['q1', 'q3', 'x3b', 'x9', 'q1'],
  );
});

test('Zusammenführen: nach dem Umbenennen entsteht beim nächsten Einlesen keine Dublette', ()=>{
  // Zwei Geräte, je mit eigenen Kennungen – auch für die Standardfragen.
  const idA = zaehlendeId();
  const idB = zaehlendeId();
  let a = lernendeHinzufuegen(startdaten({ neueId: (p)=> `a-${idA(p)}` }), FR, ['Mia', 'Leo'], { neueId: (p)=> `a-${idA(p)}` });
  let b = lernendeHinzufuegen(startdaten({ neueId: (p)=> `b-${idB(p)}` }), FR, ['Mia'], { neueId: (p)=> `b-${idB(p)}` });
  const miaA = a.lernende[FR][0].id;
  const frageA = a.fragen[0].id;
  const erfasseB = (d, id, datum)=> erfasseBeobachtung(d, {
    lerngruppe: FR, lernendeId: d.lernende[FR][0].id, frageId: d.fragen[0].id, wert: 3, datum,
  }, { neueId: ()=> id });
  b = erfasseB(b, 'obs-b1', '2026-10-05');

  // Erstes Einlesen: Mia und die Standardfrage werden über Name und Text erkannt.
  const erst = zusammenfuehren(a, b);
  assert.deepEqual(erst.bericht, { lernende: 0, fragen: 0, beobachtungen: 1 });
  a = erst.daten;

  // Auf Gerät A wird umbenannt und umformuliert.
  a = lernendeAendern(a, FR, miaA, { name: 'Mia S.' });
  a = frageAendern(a, frageA, { text: 'Die Lernenden beteiligen sich aktiv am Unterricht.' });

  // Dieselbe Sicherung noch einmal: nichts Neues.
  const nochmal = zusammenfuehren(a, b);
  assert.deepEqual(nochmal.bericht, { lernende: 0, fragen: 0, beobachtungen: 0 });
  assert.deepEqual(nochmal.daten, a);

  // Eine spätere Sicherung von B: Die neue Beobachtung gehört zu Mia S. und zur umformulierten Frage.
  const spaeter = zusammenfuehren(a, erfasseB(b, 'obs-b2', '2026-10-12'));
  assert.deepEqual(spaeter.bericht, { lernende: 0, fragen: 0, beobachtungen: 1 });
  assert.deepEqual(lernendeDerGruppe(spaeter.daten, FR, { auchInaktive: true }).map(l => l.name), ['Mia S.', 'Leo']);
  assert.equal(spaeter.daten.fragen.length, STANDARD_FRAGEN.length);
  const neu = spaeter.daten.beobachtungen.find(x => x.id === 'obs-b2');
  assert.deepEqual([neu.lernendeId, neu.frageId], [miaA, frageA]);
  assert.equal(beobachtungenVonLernenden(spaeter.daten, FR, miaA), 2);
});

test('Zusammenführen: eine frühere Beobachtung legt keine zwei Lernenden zusammen', ()=>{
  // Mia (l1) wurde früher aus der Sicherung übernommen; dieselbe Sicherung kennt l1 aber auch selbst.
  const basis = normalisiereBeobachtungsdaten({
    ...beispiel(),
    beobachtungen: [...beispiel().beobachtungen, beob('e1', FR, 'l1', 'q1', 4, '2026-10-10')],
  });
  const eingehend = normalisiereBeobachtungsdaten({
    lernende: { [FR]: [{ id: 'fremd', name: 'Ella' }, { id: 'l1', name: 'Mia' }] },
    fragen: [],
    beobachtungen: [beob('e1', FR, 'fremd', 'q1', 4, '2026-10-10')],
  });
  const { daten, bericht } = zusammenfuehren(basis, eingehend);
  // l1 ist über die Kennung vergeben – Ella kommt neu dazu, statt in Mia aufzugehen.
  assert.deepEqual(bericht, { lernende: 1, fragen: 0, beobachtungen: 0 });
  assert.ok(lernendeDerGruppe(daten, FR).some(l => l.id === 'fremd' && l.name === 'Ella'));
});

/* ---- Unveränderlichkeit ------------------------------------------------ */

test('Keine Funktion verändert ihre Eingabe', ()=>{
  const d = tiefEinfrieren(beispiel());
  const vorher = JSON.stringify(d);
  const andere = tiefEinfrieren(normalisiereBeobachtungsdaten({
    lernende: { [FR]: [{ id: 'z', name: 'Mia' }] },
    fragen: [{ id: 'zq', text: 'Neu.' }],
    beobachtungen: [beob('z1', FR, 'z', 'zq', 2, '2026-10-11')],
  }));
  const neueId = zaehlendeId();

  // Eingefroren würde jede Änderung im strikten Modus einen Fehler werfen.
  const ergebnisse = [
    normalisiereBeobachtungsdaten(d),
    lernendeHinzufuegen(d, FR, 'Neu\nAuch neu', { neueId }),
    lernendeHinzufuegen(d, '9z||', ['Erste'], { neueId }),
    lernendeAendern(d, FR, 'l1', { name: 'Umbenannt', aktiv: false }),
    lernendeVerschieben(d, FR, 'l2', -1),
    lernendeLoeschen(d, FR, 'l1'),
    lernendeLoeschen(d, MA, 'm1'),
    lernendeKopieren(d, FR, MA, { neueId }),
    frageHinzufuegen(d, { text: 'Neu.' }, { neueId }),
    frageAendern(d, 'q3', { geltung: 'allgemein', text: 'Neu.' }),
    frageLoeschen(d, 'q1'),
    erfasseBeobachtung(d, { lerngruppe: FR, lernendeId: 'l1', frageId: 'q1', wert: 3, datum: '2026-10-12' }, { neueId }),
    zusammenfuehren(d, andere).daten,
    zusammenfuehren(andere, d).daten,
  ];
  erzeugeRunde(d, FR, { anzahl: 10, heuteISO: '2026-10-05', zufall: Math.random });
  abdeckung(d, FR);
  lernendenUebersicht(d, FR);
  fragenUebersicht(d, FR);
  verlaufVon(d, FR, 'l1');
  beobachtungsUmfang(d);
  lernendeDerGruppe(d, FR);
  fragenFuer(d, FR);

  assert.equal(JSON.stringify(d), vorher);
  for (const e of ergebnisse.slice(1)) assert.notEqual(e, d, 'eine Änderung ergibt ein neues Objekt');

  // Und umgekehrt: Das Ergebnis teilt keine veränderten Teile mit der Eingabe.
  const umbenannt = lernendeAendern(d, FR, 'l1', { name: 'Umbenannt' });
  assert.equal(d.lernende[FR][0].name, 'Mia');
  assert.equal(umbenannt.lernende[FR][0].name, 'Umbenannt');
});
