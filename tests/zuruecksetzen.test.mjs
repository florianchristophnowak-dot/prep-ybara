/* ============================================================
   Alle Daten löschen

   Zwei Dinge werden hier geprüft, und sie ziehen in verschiedene
   Richtungen:

     - Die Freigabe muss STRENG sein. Ein versehentliches Zurücksetzen
       ist der schlimmste Fall, den diese App kennt – es gibt kein
       Rückgängig dafür. Wer nur das Kästchen anklickt oder nur "ja"
       tippt, kommt nicht durch.
     - Die Aufzählung muss EHRLICH sein. Sie ist die Grundlage der
       Entscheidung; sie darf nichts unterschlagen, am wenigsten die
       archivierten Schuljahre und die Beobachtungen zu Lernenden,
       die beide leicht zu übersehen sind.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BESTAETIGUNGSWORT, normalisiereBestaetigung, bestaetigungStimmt,
  darfLoeschen, ruecksetzUmfang, istLeer, umfangZeilen,
  WEITERE_BEREICHE, BLEIBT_ERHALTEN,
} from '../renderer/src/zuruecksetzen.js';
import {
  startdaten, lernendeHinzufuegen, erfasseBeobachtung, beobachtungsUmfang,
} from '../renderer/src/beobachtung.js';

const stunde = (patch = {})=>({ classGroup: '9b', subject: 'Französisch', topic: '', phases: [], ...patch });

function daten(){
  return {
    weeks: {
      '2025-09-01': { lessons: {
        '0-0': stunde({ topic: 'Le passé composé' }),
        '1-2': stunde({ topic: '' }),
        '2-1': stunde({ classGroup: '7a', subject: 'Mathematik', topic: 'Brüche' }),
      } },
      '2025-09-08': { lessons: { '0-0': stunde({ topic: 'Weiter' }) } },
    },
    sequences: { s1: { id: 's1', name: 'Le passé composé' }, s2: { id: 's2', name: 'Brüche' } },
    sequenceTemplates: { t1: { id: 't1', name: 'Vorlage' } },
    yearBars: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
    todos: [{ id: 'td1' }],
    timetableModels: [{ id: 'm1' }],
    schoolCalendar: {
      schoolYear: { startISO: '2025-08-01', endISO: '2026-07-31' },
      vacations: [{ id: 'v1' }, { id: 'v2' }],
      freeDays: [{ id: 'f1' }],
      events: [],
    },
    schoolYearArchives: [
      { id: 'a1', data: { weeks: { '2024-09-02': { lessons: { '0-0': stunde(), '0-1': stunde() } } } } },
    ],
  };
}

/* --- Das abgetippte Wort ---------------------------------------- */

test('das Bestätigungswort wird grosszügig gelesen', ()=>{
  assert.equal(bestaetigungStimmt(BESTAETIGUNGSWORT), true);
  assert.equal(bestaetigungStimmt('  alles löschen  '), true);   // Rand und Kleinschreibung
  assert.equal(bestaetigungStimmt('Alles   Löschen'), true);      // doppelte Leerzeichen
  assert.equal(bestaetigungStimmt('ALLES LOESCHEN'), true);       // Tastatur ohne Umlaut
});

test('ähnliche Eingaben genügen nicht', ()=>{
  for (const eingabe of ['', ' ', 'ja', 'ok', 'löschen', 'alles', 'ALLESLÖSCHEN', 'alles löschen!', 'delete all']) {
    assert.equal(bestaetigungStimmt(eingabe), false, `„${eingabe}" darf nicht genügen`);
  }
});

test('normalisiereBestaetigung verträgt auch Unfug', ()=>{
  assert.equal(normalisiereBestaetigung(null), '');
  assert.equal(normalisiereBestaetigung(undefined), '');
  assert.equal(normalisiereBestaetigung(42), '42');
});

/* --- Die Freigabe ------------------------------------------------ */

test('Kästchen und Wort – eines allein reicht nicht', ()=>{
  assert.equal(darfLoeschen({ eingabe: BESTAETIGUNGSWORT, verstanden: true }), true);
  assert.equal(darfLoeschen({ eingabe: BESTAETIGUNGSWORT, verstanden: false }), false);
  assert.equal(darfLoeschen({ eingabe: 'ja', verstanden: true }), false);
  assert.equal(darfLoeschen({}), false);
  assert.equal(darfLoeschen(), false);
});

/* --- Was verloren geht ------------------------------------------- */

test('der Umfang wird gezählt, nicht geschätzt', ()=>{
  const u = ruecksetzUmfang(daten());
  assert.equal(u.wochen, 2);
  assert.equal(u.stunden, 4);
  assert.equal(u.mitThema, 3);
  assert.equal(u.lerngruppen, 2);          // 9b · Französisch und 7a · Mathematik
  assert.equal(u.sequenzen, 2);
  assert.equal(u.vorlagen, 1);
  assert.equal(u.balken, 3);
  assert.equal(u.todos, 1);
  assert.equal(u.stundenplaene, 1);
  assert.equal(u.ferien, 3);               // 2 Ferien + 1 freier Tag + 0 Termine
});

test('archivierte Schuljahre werden mitgezählt – sie liegen in derselben Ablage', ()=>{
  const u = ruecksetzUmfang(daten());
  assert.equal(u.archive, 1);
  assert.equal(u.archivStunden, 2);
});

test('eine leere Datenbank ergibt einen leeren Umfang', ()=>{
  assert.equal(istLeer(ruecksetzUmfang({})), true);
  assert.equal(istLeer(ruecksetzUmfang(null)), true);
  assert.equal(istLeer(ruecksetzUmfang(undefined)), true);
});

test('ein einziges archiviertes Schuljahr gilt bereits als "nicht leer"', ()=>{
  const u = ruecksetzUmfang({ schoolYearArchives: [{ id: 'a1', data: {} }] });
  assert.equal(istLeer(u), false);
});

test('unvollständige Daten werfen nicht', ()=>{
  const u = ruecksetzUmfang({
    weeks: { '2025-09-01': null, '2025-09-08': { lessons: null } },
    sequences: null,
    yearBars: 'kaputt',
    schoolYearArchives: [null, { data: null }],
  });
  assert.equal(u.stunden, 0);
  assert.equal(u.balken, 0);
  assert.equal(u.archive, 2);
});

/* --- Die Aufzählung im Dialog ------------------------------------ */

test('die Aufzählung nennt nur, was es gibt', ()=>{
  const zeilen = umfangZeilen(ruecksetzUmfang(daten()));
  assert.ok(zeilen.some(z => z.includes('4 geplante Stunden')));
  assert.ok(zeilen.some(z => z.includes('2 Sequenzen')));
  assert.ok(zeilen.some(z => z.includes('archiviertes Schuljahr')));
  // Keine Nullzeilen: "0 Termine" trägt nichts bei.
  assert.ok(zeilen.every(z => !/^0 /.test(z)));
});

test('Einzahl und Mehrzahl stimmen', ()=>{
  const eine = umfangZeilen(ruecksetzUmfang({
    weeks: { '2025-09-01': { lessons: { '0-0': stunde() } } },
    sequences: { s1: { id: 's1' } },
  }));
  assert.ok(eine.some(z => z.includes('1 geplante Stunde in 1 Woche')));
  assert.ok(eine.some(z => z === '1 Sequenz'));
});

test('ohne Daten bleibt die Aufzählung leer', ()=>{
  assert.deepEqual(umfangZeilen(ruecksetzUmfang({})), []);
});

/* --- Beobachtungen ------------------------------------------------
   Sie liegen in einer eigenen Ablage, gehen beim Zurücksetzen aber mit.
   Der Dialog muss sie deshalb nennen – Namen und Einschätzungen von
   Lernenden sind das Letzte, was auf einem weitergegebenen Gerät
   zurückbleiben darf. */

test('die Zahlen der Beobachtung kommen als zweites Argument dazu', ()=>{
  const u = ruecksetzUmfang(daten(), { beobachtungsLerngruppen: 2, lernende: 12, beobachtungen: 87, eigeneFragen: 3 });
  assert.equal(u.lernende, 12);
  assert.equal(u.beobachtungen, 87);
  assert.equal(u.beobachtungsLerngruppen, 2);
  assert.equal(u.eigeneFragen, 3);
  // Die Planung bleibt davon unberührt.
  assert.equal(u.lerngruppen, 2);
  assert.equal(u.stunden, 4);
});

test('ohne zweites Argument behauptet der Umfang keine Nullen', ()=>{
  const u = ruecksetzUmfang(daten());
  for (const feld of ['lernende', 'beobachtungen', 'beobachtungsLerngruppen', 'eigeneFragen']) {
    assert.equal(feld in u, false, `${feld} darf nicht erfunden werden`);
  }
  // So lassen sich beide Teile auch in beliebiger Reihenfolge zusammenlegen.
  const b = { beobachtungsLerngruppen: 1, lernende: 4, beobachtungen: 9, eigeneFragen: 0 };
  assert.equal({ ...b, ...ruecksetzUmfang(daten()) }.lernende, 4);
});

test('Lernende und Beobachtungen stehen in einer Zeile, gleich nach den Stunden', ()=>{
  const zeilen = umfangZeilen({
    ...ruecksetzUmfang(daten()),
    beobachtungsLerngruppen: 2, lernende: 12, beobachtungen: 87, eigeneFragen: 0,
  });
  assert.ok(zeilen[0].includes('geplante Stunden'));
  assert.equal(zeilen[1], '12 Lernende in 2 Lerngruppen mit 87 Beobachtungen');
  assert.ok(zeilen.every(z => !z.includes('Beobachtungsfrage')), 'keine Nullzeile für eigene Fragen');
});

test('Einzahl, und Lernende ohne Beobachtungen', ()=>{
  assert.deepEqual(
    umfangZeilen({ beobachtungsLerngruppen: 1, lernende: 1, beobachtungen: 1, eigeneFragen: 1 }),
    ['1 Lernende in 1 Lerngruppe mit 1 Beobachtung', '1 eigene Beobachtungsfrage'],
  );
  assert.deepEqual(
    umfangZeilen({ beobachtungsLerngruppen: 3, lernende: 25, beobachtungen: 0 }),
    ['25 Lernende in 3 Lerngruppen'],
  );
});

test('Beobachtungen ohne Lernende werden trotzdem genannt', ()=>{
  assert.deepEqual(
    umfangZeilen({ beobachtungsLerngruppen: 1, lernende: 0, beobachtungen: 5 }),
    ['5 Beobachtungen zu Lernenden in 1 Lerngruppe'],
  );
});

test('wer nur Beobachtungen hat, bekommt trotzdem den vollen Hinweis', ()=>{
  const leer = ruecksetzUmfang({});
  assert.equal(istLeer(leer), true);
  assert.equal(istLeer({ ...leer, lernende: 1 }), false);
  assert.equal(istLeer({ ...leer, beobachtungen: 1 }), false);
  assert.equal(istLeer({ ...leer, beobachtungsLerngruppen: 1 }), false);
  assert.equal(istLeer({ ...leer, eigeneFragen: 1 }), false);
  assert.equal(istLeer(ruecksetzUmfang({}, { beobachtungsLerngruppen: 0, lernende: 0, beobachtungen: 0, eigeneFragen: 0 })), true);
});

test('die Zahlen aus beobachtungsUmfang passen ohne Umweg', ()=>{
  let b = startdaten({ jetzt: '2026-10-01T08:00:00.000Z' });
  b = lernendeHinzufuegen(b, '6a||Französisch', ['Mia', 'Noah']);
  b = lernendeHinzufuegen(b, '7b||', ['Lea']);
  const mia = b.lernende['6a||Französisch'][0];
  b = erfasseBeobachtung(b, { lerngruppe: '6a||Französisch', lernendeId: mia.id, frageId: b.fragen[0].id, wert: 4, datum: '2026-10-12' });

  // Nur Standardfragen und nichts erfasst: eine frische Ablage ist leer.
  assert.equal(istLeer(ruecksetzUmfang({}, beobachtungsUmfang(startdaten()))), true);

  const zeilen = umfangZeilen(ruecksetzUmfang({}, beobachtungsUmfang(b)));
  assert.deepEqual(zeilen, ['3 Lernende in 2 Lerngruppen mit 1 Beobachtung']);
});

test('der Fragenpool der Beobachtung wird in Worten genannt', ()=>{
  assert.ok(WEITERE_BEREICHE.some(z => /Beobachtung/.test(z)));
  // Die Oberfläche reiht die Einträge mit Kommas aneinander.
  assert.ok(WEITERE_BEREICHE.every(z => z === WEITERE_BEREICHE[0] || !z.includes(',')));
  assert.ok(BLEIBT_ERHALTEN.some(z => z.includes('Sicherungen der Beobachtungen')));
});
