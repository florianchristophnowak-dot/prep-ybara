/* ============================================================
   Lokaler Versionsverlauf

   Geprüft wird das Modell, nicht die Oberfläche: wie ein Eintrag
   entsteht, wann zwei Einträge zu einem werden, was die Aufbewahrung
   übriglässt und was eine Wiederherstellung an den Daten ändert.

   Zwei Versprechen ziehen sich durch alle Prüfungen:

     - Der Verlauf enthält keine Binärkopien angehängter Dateien.
     - Die Bereinigung entfernt Einträge, niemals Unterrichtsdaten.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUSLOESER, MAX_JE_ZIEL,
  ausloeserName, bereichName,
  stundenZiel, sequenzZiel, balkenZiel,
  ohneBinaerdaten, geaenderteFelder,
  erstelleEintrag, stundenTeil, sequenzTeil, vorlagenTeil, balkenTeil,
  fuegeEin, bereinige, betrifft, eintraegeFuer, zusammenfassung,
  wendeAn, aktuellerStand, vorschau,
} from '../renderer/src/versionsverlauf.js';

import { erstelleVerlaufSpeicher } from '../renderer/src/verlauf-speicher.js';

let zaehler = 0;
const neueId = ()=> `v-${++zaehler}`;

const stunde = (patch = {})=>({
  subject: 'Französisch', classGroup: '9b', room: 'A101',
  topic: 'Le passé composé', objectives: '', phases: [], homework: '', notes: '',
  files: [], links: [], sequenceId: '', competencies: [], blockSpan: 1,
  ...patch,
});

const datenbank = ()=>({
  weeks: {
    '2025-09-01': { slotsPerDay: 6, lessons: { '0-2': stunde({ topic: 'Alt' }) }, duties: {} },
  },
  sequences: { s1: { id: 's1', name: 'Passé composé', color: '#123456' } },
  sequenceTemplates: { t1: { id: 't1', name: 'Vorlage', lessons: [] } },
  yearBars: [{ id: 'b1', title: 'Balken', startISO: '2025-09-01', endISO: '2025-09-29' }],
});

/* ---- Form eines Eintrags --------------------------------------------- */

test('Ein Eintrag trägt Anlass, Bereich, Ziel und Zeitpunkt', ()=>{
  const e = erstelleEintrag({
    ausloeser: 'vorLoeschen',
    bereich: 'lesson',
    zielId: stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 }),
    zielLabel: 'Mo · 3. Stunde',
    felder: ['Thema'],
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde() })],
  }, { jetzt: '2025-09-01T10:00:00.000Z', neueId });

  assert.equal(e.ausloeser, 'vorLoeschen');
  assert.equal(ausloeserName(e.ausloeser), AUSLOESER.vorLoeschen);
  assert.equal(bereichName(e.bereich), 'Stunde');
  assert.equal(e.at, '2025-09-01T10:00:00.000Z');
  assert.equal(e.aktualisiertAm, e.at);
  assert.equal(e.teile.length, 1);
  assert.equal(e.teile[0].wert.topic, 'Le passé composé');
});

test('Ein leerer Stundenplatz ist ein gültiger Teil', ()=>{
  const teil = stundenTeil({ weekStart: '2025-09-01', dayIndex: 1, slotIndex: 0, stunde: null });
  assert.equal(teil.wert, null);
});

test('Der Eintrag ist eine Kopie – spätere Änderungen an der Stunde erreichen ihn nicht', ()=>{
  const l = stunde();
  const teil = stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: l });
  l.topic = 'Geändert';
  assert.equal(teil.wert.topic, 'Le passé composé');
});

/* ---- Keine Binärdateien ---------------------------------------------- */

test('Verweise auf Dateien bleiben, eingebettete Binärdaten nicht', ()=>{
  const l = stunde({
    files: [{
      id: 'f1', name: 'Arbeitsblatt.pdf', path: '/home/x/Arbeitsblatt.pdf', mode: 'link',
      data: 'AAAA'.repeat(1000),
      thumbnail: 'AAAA'.repeat(50),
    }],
  });
  const sauber = ohneBinaerdaten(l);
  assert.equal(sauber.files[0].name, 'Arbeitsblatt.pdf');
  assert.equal(sauber.files[0].path, '/home/x/Arbeitsblatt.pdf');
  assert.equal(sauber.files[0].mode, 'link');
  assert.equal('data' in sauber.files[0], false);
  assert.equal('thumbnail' in sauber.files[0], false);
});

test('Eine als Text getarnte Binärdatei wird ebenfalls entfernt', ()=>{
  const gross = `data:application/pdf;base64,${'A'.repeat(4000)}`;
  const sauber = ohneBinaerdaten({ files: [{ name: 'x.pdf', path: gross }] });
  assert.equal(sauber.files[0].path, '');
  // Ein normaler Verweis bleibt unangetastet.
  const kurz = ohneBinaerdaten({ files: [{ path: 'data:kurz' }] });
  assert.equal(kurz.files[0].path, 'data:kurz');
});

test('Der Phaseninhalt ist Text und bleibt erhalten', ()=>{
  const sauber = ohneBinaerdaten({ phases: [{ title: 'Einstieg', content: 'Bildimpuls' }] });
  assert.equal(sauber.phases[0].content, 'Bildimpuls');
});

/* ---- Zusammenfassung geänderter Felder ------------------------------- */

test('Die Zusammenfassung nennt genau die geänderten Felder', ()=>{
  const a = stunde();
  const b = stunde({ topic: 'Neu', homework: 'Nichts' });
  assert.deepEqual(geaenderteFelder(a, b), ['Thema', 'Hausaufgaben']);
  assert.deepEqual(geaenderteFelder(a, a), []);
});

test('Ohne benannte Felder sagt die Zusammenfassung, worum es ging', ()=>{
  const e = erstelleEintrag({ teile: [sequenzTeil('s1', { id: 's1', name: 'X' })] }, { neueId });
  assert.equal(zusammenfassung(e), 'Vollständiger Stand');
  const bulk = erstelleEintrag({
    transaktion: 'tx1',
    teile: [
      stundenTeil({ weekStart: 'w', dayIndex: 0, slotIndex: 0, stunde: null }),
      stundenTeil({ weekStart: 'w', dayIndex: 0, slotIndex: 1, stunde: stunde() }),
    ],
  }, { neueId });
  assert.equal(zusammenfassung(bulk), '2 betroffene Einträge');
});

/* ---- Bündelung -------------------------------------------------------- */

test('Mehrere Änderungen derselben Stunde in kurzer Zeit werden gebündelt', ()=>{
  const ziel = stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 });
  const mach = (jetzt, felder)=> erstelleEintrag({
    ausloeser: 'bearbeitet', bereich: 'lesson', zielId: ziel, felder,
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde({ topic: `Stand ${jetzt}` }) })],
  }, { jetzt, neueId });

  let liste = [];
  liste = fuegeEin(liste, mach('2025-09-01T10:00:00.000Z', ['Thema']));
  liste = fuegeEin(liste, mach('2025-09-01T10:01:00.000Z', ['Hausaufgaben']));
  liste = fuegeEin(liste, mach('2025-09-01T10:02:00.000Z', ['Notizen']));

  assert.equal(liste.length, 1, 'drei Änderungen, ein Eintrag');
  // Behalten wird der ÄLTESTE Stand – dorthin will man zurück.
  assert.equal(liste[0].teile[0].wert.topic, 'Stand 2025-09-01T10:00:00.000Z');
  assert.deepEqual(liste[0].felder, ['Thema', 'Hausaufgaben', 'Notizen']);
  assert.equal(liste[0].aktualisiertAm, '2025-09-01T10:02:00.000Z');
});

test('Nach Ablauf des Fensters entsteht eine neue Fassung', ()=>{
  const ziel = stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 });
  const mach = (jetzt)=> erstelleEintrag({ ausloeser: 'bearbeitet', bereich: 'lesson', zielId: ziel }, { jetzt, neueId });
  let liste = [];
  liste = fuegeEin(liste, mach('2025-09-01T10:00:00.000Z'));
  liste = fuegeEin(liste, mach('2025-09-01T11:00:00.000Z'));
  assert.equal(liste.length, 2);
});

test('Verschiedene Anlässe und verschiedene Ziele werden nie vermischt', ()=>{
  const zielA = stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 });
  const zielB = stundenZiel({ weekStart: '2025-09-01', dayIndex: 1, slotIndex: 2 });
  let liste = [];
  liste = fuegeEin(liste, erstelleEintrag({ ausloeser: 'bearbeitet', zielId: zielA }, { jetzt: '2025-09-01T10:00:00.000Z', neueId }));
  liste = fuegeEin(liste, erstelleEintrag({ ausloeser: 'vorLoeschen', zielId: zielA }, { jetzt: '2025-09-01T10:01:00.000Z', neueId }));
  liste = fuegeEin(liste, erstelleEintrag({ ausloeser: 'bearbeitet', zielId: zielB }, { jetzt: '2025-09-01T10:01:00.000Z', neueId }));
  assert.equal(liste.length, 3);
});

test('Eine Sammelaktion wird nie gebündelt', ()=>{
  const ziel = sequenzZiel('s1');
  let liste = [];
  liste = fuegeEin(liste, erstelleEintrag({ ausloeser: 'vorVerschieben', bereich: 'bulk', zielId: ziel, transaktion: 'tx1' }, { jetzt: '2025-09-01T10:00:00.000Z', neueId }));
  liste = fuegeEin(liste, erstelleEintrag({ ausloeser: 'vorVerschieben', bereich: 'bulk', zielId: ziel, transaktion: 'tx2' }, { jetzt: '2025-09-01T10:00:30.000Z', neueId }));
  assert.equal(liste.length, 2);
});

/* ---- Aufbewahrung ----------------------------------------------------- */

const tage = (n)=> n * 86400000;

test('Was älter als 30 Tage ist, fällt weg', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const liste = [
    erstelleEintrag({ zielId: 'a' }, { jetzt: new Date(jetzt - tage(2)).toISOString(), neueId }),
    erstelleEintrag({ zielId: 'a' }, { jetzt: new Date(jetzt - tage(31)).toISOString(), neueId }),
  ];
  const behalten = bereinige(liste, { jetzt });
  assert.equal(behalten.length, 1);
});

test('Je Ziel bleiben höchstens 20 Fassungen – die neuesten', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const liste = [];
  for (let i = 0; i < 30; i++){
    liste.push(erstelleEintrag(
      { zielId: 'a', bereich: 'lesson', notiz: `Nr ${i}` },
      { jetzt: new Date(jetzt - i * 60000).toISOString(), neueId },
    ));
  }
  // Ein zweites Ziel bleibt davon unberührt.
  liste.push(erstelleEintrag({ zielId: 'b', bereich: 'lesson' }, { jetzt: new Date(jetzt - tage(1)).toISOString(), neueId }));
  const behalten = bereinige(liste, { jetzt });
  assert.equal(behalten.filter(e => e.zielId === 'a').length, MAX_JE_ZIEL);
  assert.equal(behalten.filter(e => e.zielId === 'b').length, 1);
  assert.equal(behalten[0].notiz, 'Nr 0', 'der neueste Eintrag steht vorne');
});

test('Die Gesamtgrenze greift über alle Ziele hinweg', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const liste = [];
  for (let i = 0; i < 40; i++){
    liste.push(erstelleEintrag({ zielId: `ziel-${i}` }, { jetzt: new Date(jetzt - i * 60000).toISOString(), neueId }));
  }
  assert.equal(bereinige(liste, { jetzt, maxGesamt: 10 }).length, 10);
});

test('Die Platzgrenze lässt mindestens einen Eintrag stehen', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const liste = [
    erstelleEintrag({ zielId: 'a', notiz: 'x'.repeat(500) }, { jetzt: new Date(jetzt).toISOString(), neueId }),
    erstelleEintrag({ zielId: 'b', notiz: 'x'.repeat(500) }, { jetzt: new Date(jetzt - 1000).toISOString(), neueId }),
  ];
  const behalten = bereinige(liste, { jetzt, maxZeichen: 100 });
  assert.equal(behalten.length, 1);
  assert.equal(behalten[0].zielId, 'a');
});

test('Eine Sammelaktion wird nie halb bereinigt', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const liste = [
    erstelleEintrag({ zielId: 'a', transaktion: 'tx1' }, { jetzt: new Date(jetzt).toISOString(), neueId }),
    erstelleEintrag({ zielId: 'b', transaktion: 'tx1' }, { jetzt: new Date(jetzt - 1000).toISOString(), neueId }),
    erstelleEintrag({ zielId: 'c' }, { jetzt: new Date(jetzt - 2000).toISOString(), neueId }),
  ];
  const behalten = bereinige(liste, { jetzt, maxGesamt: 1 });
  assert.equal(behalten.filter(e => e.transaktion === 'tx1').length, 2);
});

test('Die Bereinigung fasst nur die Liste an', ()=>{
  const jetzt = Date.parse('2025-10-01T00:00:00.000Z');
  const daten = datenbank();
  const liste = [erstelleEintrag({ zielId: 'a' }, { jetzt: new Date(jetzt - tage(90)).toISOString(), neueId })];
  const vorher = JSON.stringify(daten);
  bereinige(liste, { jetzt });
  assert.equal(JSON.stringify(daten), vorher);
});

/* ---- Auswahl ---------------------------------------------------------- */

test('Eine Sammelaktion erscheint auch bei jeder betroffenen Stunde', ()=>{
  const zielA = stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 });
  const e = erstelleEintrag({
    bereich: 'bulk', zielId: sequenzZiel('s1'), transaktion: 'tx1',
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde() })],
  }, { neueId });
  assert.equal(betrifft(e, { bereich: 'lesson', zielId: zielA }), true);
  assert.equal(betrifft(e, { bereich: 'lesson', zielId: stundenZiel({ weekStart: 'x', dayIndex: 0, slotIndex: 0 }) }), false);
  assert.equal(eintraegeFuer([e], { bereich: 'lesson', zielId: zielA }).length, 1);
});

/* ---- Wiederherstellen ------------------------------------------------- */

test('Eine Stunde wird an ihren Platz zurückgeschrieben', ()=>{
  const db = datenbank();
  const e = erstelleEintrag({
    bereich: 'lesson',
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde({ topic: 'Frühere Fassung' }) })],
  }, { neueId });
  const next = wendeAn(db, e);
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, 'Frühere Fassung');
  // Die übergebene Datenbank bleibt unangetastet.
  assert.equal(db.weeks['2025-09-01'].lessons['0-2'].topic, 'Alt');
});

test('Ein leerer Stand entfernt die Stunde wieder', ()=>{
  const db = datenbank();
  const e = erstelleEintrag({
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: null })],
  }, { neueId });
  const next = wendeAn(db, e);
  assert.equal('0-2' in next.weeks['2025-09-01'].lessons, false);
});

test('Eine gelöschte Sequenz kommt zurück', ()=>{
  const db = datenbank();
  delete db.sequences.s1;
  const e = erstelleEintrag({
    bereich: 'sequence',
    teile: [sequenzTeil('s1', { id: 's1', name: 'Passé composé', color: '#123456' })],
  }, { neueId });
  const next = wendeAn(db, e);
  assert.equal(next.sequences.s1.name, 'Passé composé');
});

test('Eine Sammelverschiebung wird vollständig zurückgenommen', ()=>{
  // Ausgangslage: die Stunde stand auf 0-2, nach dem Verschieben auf 1-2.
  const db = datenbank();
  db.weeks['2025-09-01'].lessons['1-2'] = db.weeks['2025-09-01'].lessons['0-2'];
  delete db.weeks['2025-09-01'].lessons['0-2'];

  const e = erstelleEintrag({
    bereich: 'bulk', transaktion: 'tx1',
    teile: [
      stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde({ topic: 'Alt' }) }),
      stundenTeil({ weekStart: '2025-09-01', dayIndex: 1, slotIndex: 2, stunde: null }),
    ],
  }, { neueId });

  const next = wendeAn(db, e);
  assert.equal(next.weeks['2025-09-01'].lessons['0-2'].topic, 'Alt');
  assert.equal('1-2' in next.weeks['2025-09-01'].lessons, false);
});

test('Ein Jahresbalken lässt sich zurückholen und wieder entfernen', ()=>{
  const db = datenbank();
  db.yearBars = [];
  const zurueck = erstelleEintrag({
    bereich: 'yearBar',
    teile: [balkenTeil('b1', { id: 'b1', title: 'Balken', startISO: '2025-09-01', endISO: '2025-09-29' })],
  }, { neueId });
  const mitBalken = wendeAn(db, zurueck);
  assert.equal(mitBalken.yearBars.length, 1);

  const weg = erstelleEintrag({ bereich: 'yearBar', teile: [balkenTeil('b1', null)] }, { neueId });
  assert.equal(wendeAn(mitBalken, weg).yearBars.length, 0);
});

test('Vor der Wiederherstellung lässt sich der aktuelle Stand sichern', ()=>{
  const db = datenbank();
  const e = erstelleEintrag({
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde({ topic: 'Frühere Fassung' }) })],
  }, { neueId });

  const gegenTeile = aktuellerStand(db, e);
  const gegenEintrag = erstelleEintrag({ ausloeser: 'vorWiederherstellen', teile: gegenTeile }, { neueId });

  const wiederhergestellt = wendeAn(db, e);
  assert.equal(wiederhergestellt.weeks['2025-09-01'].lessons['0-2'].topic, 'Frühere Fassung');

  // Und die Wiederherstellung selbst ist rückgängig zu machen.
  const zurueck = wendeAn(wiederhergestellt, gegenEintrag);
  assert.equal(zurueck.weeks['2025-09-01'].lessons['0-2'].topic, 'Alt');
});

test('Die Vorschau sagt für jeden Ort, was geschieht', ()=>{
  const db = datenbank();
  const e = erstelleEintrag({
    teile: [
      stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: stunde({ topic: 'Frühere Fassung' }) }),
      stundenTeil({ weekStart: '2025-09-01', dayIndex: 1, slotIndex: 2, stunde: null }),
      stundenTeil({ weekStart: '2025-09-01', dayIndex: 2, slotIndex: 0, stunde: stunde({ topic: 'Neu' }) }),
      vorlagenTeil('t1', { id: 't1', name: 'Vorlage', lessons: [] }),
    ],
  }, { neueId });
  const zeilen = vorschau(db, e);
  assert.equal(zeilen[0].aenderung, 'wird ersetzt');
  assert.equal(zeilen[1].aenderung, 'bleibt unverändert');   // war leer, bleibt leer
  assert.equal(zeilen[2].aenderung, 'wird angelegt');
  assert.equal(zeilen[3].aenderung, 'bleibt unverändert');
  assert.match(zeilen[0].jetzt, /Alt/);
  assert.match(zeilen[0].danach, /Frühere Fassung/);
});

/* ---- Ablage ----------------------------------------------------------- */

function speicherAttrappe(){
  const zustand = { daten: null, schreibvorgaenge: 0, ladevorgaenge: 0 };
  return {
    zustand,
    loadHistory: async ()=>{ zustand.ladevorgaenge += 1; return zustand.daten; },
    saveHistory: async (d)=>{ zustand.schreibvorgaenge += 1; zustand.daten = JSON.parse(JSON.stringify(d)); },
  };
}

test('Ohne Zugriff auf den Verlauf bleibt die Ablage still', async ()=>{
  const speicher = erstelleVerlaufSpeicher({});
  assert.equal(speicher.verfuegbar, false);
  assert.deepEqual(await speicher.liste(), []);
  assert.equal(await speicher.anhaengen(erstelleEintrag({}, { neueId })), null);
});

test('Der Verlauf wird erst gelesen, wenn er gebraucht wird', async ()=>{
  const p = speicherAttrappe();
  const speicher = erstelleVerlaufSpeicher(p);
  assert.equal(p.zustand.ladevorgaenge, 0, 'kein Zugriff beim Anlegen');
  assert.equal(speicher.zwischenstand(), null);
  await speicher.liste();
  assert.equal(p.zustand.ladevorgaenge, 1);
});

test('Angehängte Einträge werden gebündelt und begrenzt gespeichert', async ()=>{
  const p = speicherAttrappe();
  const speicher = erstelleVerlaufSpeicher(p);
  const ziel = stundenZiel({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2 });
  const jetzt = new Date().toISOString();

  const erster = await speicher.anhaengen(erstelleEintrag({ bereich: 'lesson', zielId: ziel, ausloeser: 'bearbeitet' }, { jetzt, neueId }));
  assert.ok(erster);
  const zweiter = await speicher.anhaengen(erstelleEintrag({ bereich: 'lesson', zielId: ziel, ausloeser: 'bearbeitet' }, { jetzt, neueId }));
  assert.equal(zweiter, null, 'gebündelt, kein zweiter Eintrag');

  assert.equal((await speicher.liste()).length, 1);
  assert.equal(p.zustand.daten.eintraege.length, 1);
});

test('Der Verlauf berührt die Unterrichtsdaten nicht', async ()=>{
  const p = speicherAttrappe();
  const speicher = erstelleVerlaufSpeicher(p);
  const daten = datenbank();
  const vorher = JSON.stringify(daten);
  await speicher.anhaengen(erstelleEintrag({
    bereich: 'lesson',
    teile: [stundenTeil({ weekStart: '2025-09-01', dayIndex: 0, slotIndex: 2, stunde: daten.weeks['2025-09-01'].lessons['0-2'] })],
  }, { neueId }));
  assert.equal(JSON.stringify(daten), vorher);
  // Und umgekehrt: was gespeichert wurde, enthält keine Datenbank.
  assert.equal('weeks' in p.zustand.daten, false);
});

test('Der Verlauf lässt sich leeren', async ()=>{
  const p = speicherAttrappe();
  const speicher = erstelleVerlaufSpeicher(p);
  await speicher.anhaengen(erstelleEintrag({ zielId: 'a' }, { neueId }));
  await speicher.leeren();
  assert.deepEqual(await speicher.liste(), []);
});
