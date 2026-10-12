/* ============================================================
   Sicherung der Beobachtungen

   Die Sicherungsdatei verlässt das Gerät. Geprüft wird deshalb vor
   allem, was in ihr NICHT steht: kein Name, keine Notiz, kein
   Zeitpunkt im Klartext. Und dass sie sich mit dem richtigen Passwort
   vollständig zurückholen lässt – und mit einem falschen gar nicht.

   Die Tests nehmen wenige Durchläufe für die Schlüsselableitung, damit
   sie schnell bleiben. Ein einziger Test läuft mit dem Standardwert.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SICHERUNG_FORMAT, SICHERUNG_ENDUNG, SICHERUNG_SCHEMA, MIN_PASSWORT, STANDARD_ITERATIONEN,
  MAX_ITERATIONEN, FEHLER_PASSWORT, FEHLER_KEINE_SICHERUNG, FEHLER_NEUERE_VERSION,
  FEHLER_PASSWORT_KURZ, FEHLER_PASSWORT_FEHLT,
  erstelleSicherung, leseSicherung, istSicherung, sicherungsDateiname,
} from '../renderer/src/beobachtung-sicherung.js';
import {
  startdaten, lernendeHinzufuegen, erfasseBeobachtung, normalisiereBeobachtungsdaten,
} from '../renderer/src/beobachtung.js';

const KEY = '6a||Französisch';
const PASSWORT = 'Herbst-Ferien 2026';
const SCHNELL = { iterationen: 1000, appVersion: '1.1.0', jetzt: new Date('2026-10-12T14:00:00.000Z') };

let zaehler = 0;
const neueId = (praefix = 'id')=> `${praefix}-${++zaehler}`;

function daten(){
  let d = startdaten({ neueId, jetzt: '2026-10-01T08:00:00.000Z' });
  d = lernendeHinzufuegen(d, KEY, ['Mia Muster', 'Noah'], { neueId });
  const [mia] = d.lernende[KEY];
  d = erfasseBeobachtung(d, {
    lerngruppe: KEY, lernendeId: mia.id, frageId: d.fragen[0].id, wert: 3,
    notiz: 'Hat heute die Gruppe angeleitet', datum: '2026-10-12', zeitpunkt: '2026-10-12T10:15:00.000Z',
  }, { neueId });
  return d;
}

const ausBase64 = (s)=> Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ---- Hin und zurück --------------------------------------------------- */

test('mit dem richtigen Passwort kommt alles zurück', async ()=>{
  const d = daten();
  const text = await erstelleSicherung(d, PASSWORT, SCHNELL);
  const gelesen = await leseSicherung(text, PASSWORT);
  assert.deepEqual(gelesen.daten, normalisiereBeobachtungsdaten(d));
  assert.equal(gelesen.exportiertAm, '2026-10-12T14:00:00.000Z');
  assert.equal(gelesen.appVersion, '1.1.0');
});

test('die Hülle hat die vereinbarte Form', async ()=>{
  const o = JSON.parse(await erstelleSicherung(daten(), PASSWORT, SCHNELL));
  assert.deepEqual(Object.keys(o).sort(), ['chiffre', 'format', 'inhalt', 'kdf', 'schemaVersion', 'verschluesselt']);
  assert.equal(o.format, SICHERUNG_FORMAT);
  assert.equal(o.schemaVersion, SICHERUNG_SCHEMA);
  assert.equal(o.verschluesselt, true);
  assert.deepEqual({ ...o.kdf, salz: '…' }, { name: 'PBKDF2', hash: 'SHA-256', iterationen: 1000, salz: '…' });
  assert.equal(o.chiffre.name, 'AES-GCM');
  assert.equal(ausBase64(o.kdf.salz).length, 16);
  assert.equal(ausBase64(o.chiffre.iv).length, 12);
  assert.ok(ausBase64(o.inhalt).length > 16, 'Inhalt samt Prüfsumme');
});

test('im Klartext steht weder ein Name noch eine Notiz noch ein Zeitpunkt', async ()=>{
  const o = JSON.parse(await erstelleSicherung(daten(), PASSWORT, SCHNELL));
  /* Die Hülle ohne die base64-Felder: Dort könnte "6a" auch zufällig
     stehen, das wäre kein Befund. */
  const huelle = JSON.stringify({ ...o, kdf: { ...o.kdf, salz: '' }, chiffre: { ...o.chiffre, iv: '' }, inhalt: '' });
  for (const verraeterisch of ['Mia', 'Noah', 'angeleitet', 'Französisch', '6a', '2026', '1.1.0', 'Lernende']) {
    assert.equal(huelle.includes(verraeterisch), false, `„${verraeterisch}" darf nicht in der Hülle stehen`);
  }
  // Und der verschlüsselte Teil enthält die Texte auch nicht als Bytes.
  const roh = String.fromCharCode(...ausBase64(o.inhalt));
  for (const verraeterisch of ['Mia Muster', 'angeleitet', 'exportiertAm', 'beobachtungen', 'Der Lernende']) {
    assert.equal(roh.includes(verraeterisch), false, `„${verraeterisch}" darf nicht unverschlüsselt im Inhalt stehen`);
  }
});

test('zwei Sicherungen derselben Daten sehen verschieden aus', async ()=>{
  const d = daten();
  const a = JSON.parse(await erstelleSicherung(d, PASSWORT, SCHNELL));
  const b = JSON.parse(await erstelleSicherung(d, PASSWORT, SCHNELL));
  assert.notEqual(a.kdf.salz, b.kdf.salz);
  assert.notEqual(a.chiffre.iv, b.chiffre.iv);
  assert.notEqual(a.inhalt, b.inhalt);
});

test('auch grosse Bestände überstehen den Weg über base64', async ()=>{
  let d = daten();
  const [mia, noah] = d.lernende[KEY];
  for (let i = 0; i < 1500; i += 1) {
    d = erfasseBeobachtung(d, {
      lerngruppe: KEY, lernendeId: i % 2 ? mia.id : noah.id, frageId: d.fragen[i % 8].id,
      wert: (i % 4) + 1, notiz: `Notiz ${i} mit Umlauten äöü und einem Gedankenstrich –`,
      datum: '2026-10-12', zeitpunkt: '2026-10-12T10:15:00.000Z',
    }, { neueId });
  }
  const text = await erstelleSicherung(d, PASSWORT, SCHNELL);
  assert.ok(text.length > 200000, 'mehr als ein Stück der base64-Umwandlung');
  const gelesen = await leseSicherung(text, PASSWORT);
  assert.equal(gelesen.daten.beobachtungen.length, 1501);
  assert.deepEqual(gelesen.daten, normalisiereBeobachtungsdaten(d));
});

test('ein Umlaut im Passwort passt, gleich wie er eingetippt wurde', async ()=>{
  const zusammengesetzt = 'Grüne Wiese 42';                  // ü als ein Zeichen
  const zerlegt = 'Grüne Wiese 42';                     // u plus Trema
  assert.notEqual(zusammengesetzt, zerlegt);
  const text = await erstelleSicherung(daten(), zusammengesetzt, SCHNELL);
  const gelesen = await leseSicherung(text, zerlegt);
  assert.equal(gelesen.daten.lernende[KEY].length, 2);
});

/* ---- Passwort --------------------------------------------------------- */

test('ein zu kurzes Passwort wird abgelehnt, bevor etwas entsteht', async ()=>{
  assert.equal(MIN_PASSWORT, 8);
  for (const pw of ['', 'kurz', '1234567', undefined, null, 12345678]) {
    await assert.rejects(erstelleSicherung(daten(), pw, SCHNELL), { message: FEHLER_PASSWORT_KURZ });
  }
  // Genau die Mindestlänge genügt.
  assert.ok(istSicherung(await erstelleSicherung(daten(), '12345678', SCHNELL)));
});

test('ein falsches Passwort ergibt die vereinbarte Meldung', async ()=>{
  const text = await erstelleSicherung(daten(), PASSWORT, SCHNELL);
  await assert.rejects(leseSicherung(text, 'Herbst-Ferien 2025'), {
    message: 'Das Passwort passt nicht, oder die Datei ist beschädigt.',
  });
  await assert.rejects(leseSicherung(text, PASSWORT.toLowerCase()), { message: FEHLER_PASSWORT });
});

test('ohne Passwort wird gar nicht erst gerechnet', async ()=>{
  const text = await erstelleSicherung(daten(), PASSWORT, SCHNELL);
  await assert.rejects(leseSicherung(text, ''), { message: FEHLER_PASSWORT_FEHLT });
  await assert.rejects(leseSicherung(text, undefined), { message: FEHLER_PASSWORT_FEHLT });
});

/* ---- Beschädigte und fremde Dateien ------------------------------------ */

test('eine veränderte Datei fällt auf – mit derselben Meldung wie ein falsches Passwort', async ()=>{
  const o = JSON.parse(await erstelleSicherung(daten(), PASSWORT, SCHNELL));
  const bytes = ausBase64(o.inhalt);
  bytes[5] ^= 0x01;   // ein einziges Bit
  const veraendert = JSON.stringify({ ...o, inhalt: btoa(String.fromCharCode(...bytes)) });
  await assert.rejects(leseSicherung(veraendert, PASSWORT), { message: FEHLER_PASSWORT });

  const abgeschnitten = JSON.stringify({ ...o, inhalt: o.inhalt.slice(0, 8) });
  await assert.rejects(leseSicherung(abgeschnitten, PASSWORT), { message: FEHLER_PASSWORT });

  const kaputtesIv = JSON.stringify({ ...o, chiffre: { ...o.chiffre, iv: 'kein base64!' } });
  await assert.rejects(leseSicherung(kaputtesIv, PASSWORT), { message: FEHLER_PASSWORT });

  const anderesVerfahren = JSON.stringify({ ...o, kdf: { ...o.kdf, hash: 'SHA-1' } });
  await assert.rejects(leseSicherung(anderesVerfahren, PASSWORT), { message: FEHLER_PASSWORT });
});

test('eine absurde Zahl von Durchläufen wird nicht erst ausgerechnet', async ()=>{
  const o = JSON.parse(await erstelleSicherung(daten(), PASSWORT, SCHNELL));
  for (const iterationen of [MAX_ITERATIONEN + 1, 0, -5, 1.5, '1000']) {
    const text = JSON.stringify({ ...o, kdf: { ...o.kdf, iterationen } });
    await assert.rejects(leseSicherung(text, PASSWORT), { message: FEHLER_PASSWORT });
  }
});

test('was keine Sicherung ist, bekommt eine eigene Meldung', async ()=>{
  const capy = JSON.stringify({ version: 1, classes: [], questions: [], observations: [] });
  for (const text of [capy, 'kein JSON', '', '[]', 'null', JSON.stringify({ format: 'prepybara-backup' })]) {
    await assert.rejects(leseSicherung(text, PASSWORT), { message: FEHLER_KEINE_SICHERUNG });
    assert.equal(istSicherung(text), false);
  }
});

test('eine Sicherung aus einer neueren Fassung wird nicht falsch gelesen', async ()=>{
  const o = JSON.parse(await erstelleSicherung(daten(), PASSWORT, SCHNELL));
  const text = JSON.stringify({ ...o, schemaVersion: SICHERUNG_SCHEMA + 1 });
  await assert.rejects(leseSicherung(text, PASSWORT), { message: FEHLER_NEUERE_VERSION });
});

test('die Fehler tragen einen Code für die Oberfläche', async ()=>{
  const text = await erstelleSicherung(daten(), PASSWORT, SCHNELL);
  await assert.rejects(leseSicherung(text, 'falsch-falsch'), { code: 'passwort-oder-beschaedigt' });
  await assert.rejects(leseSicherung('{}', PASSWORT), { code: 'keine-sicherung' });
  await assert.rejects(erstelleSicherung(daten(), 'kurz'), { code: 'passwort-kurz' });
});

/* ---- Erkennen und Dateiname ------------------------------------------- */

test('istSicherung erkennt die eigene Hülle, als Text oder als Objekt', async ()=>{
  const text = await erstelleSicherung(daten(), PASSWORT, SCHNELL);
  assert.equal(istSicherung(text), true);
  assert.equal(istSicherung(JSON.parse(text)), true);
  // Unverschlüsselt gibt es nicht – auch nicht als Hülle.
  assert.equal(istSicherung(JSON.stringify({ format: SICHERUNG_FORMAT, verschluesselt: false, inhalt: '{}' })), false);
  assert.equal(istSicherung(undefined), false);
});

test('der Dateiname trägt das lokale Datum und die eigene Endung', ()=>{
  assert.equal(SICHERUNG_ENDUNG, '.prepybara-beobachtung');
  assert.equal(sicherungsDateiname(new Date(2026, 9, 12, 0, 30)), 'Prepybara-Beobachtungen-2026-10-12.prepybara-beobachtung');
  assert.equal(sicherungsDateiname('2026-01-05'), 'Prepybara-Beobachtungen-2026-01-05.prepybara-beobachtung');
  assert.match(sicherungsDateiname(), /^Prepybara-Beobachtungen-\d{4}-\d{2}-\d{2}\.prepybara-beobachtung$/);
  assert.match(sicherungsDateiname(new Date('kaputt')), /^Prepybara-Beobachtungen-\d{4}-\d{2}-\d{2}\.prepybara-beobachtung$/);
});

/* ---- Standardwert ------------------------------------------------------ */

test('mit dem Standardwert der Durchläufe geht es hin und zurück', async ()=>{
  const text = await erstelleSicherung(daten(), PASSWORT, { appVersion: '1.1.0' });
  assert.equal(JSON.parse(text).kdf.iterationen, STANDARD_ITERATIONEN);
  const gelesen = await leseSicherung(text, PASSWORT);
  assert.equal(gelesen.daten.lernende[KEY].length, 2);
  assert.ok(gelesen.exportiertAm);
});
