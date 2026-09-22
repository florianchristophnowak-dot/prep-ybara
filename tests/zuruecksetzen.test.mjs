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
       archivierten Schuljahre.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BESTAETIGUNGSWORT, normalisiereBestaetigung, bestaetigungStimmt,
  darfLoeschen, ruecksetzUmfang, istLeer, umfangZeilen,
} from '../renderer/src/zuruecksetzen.js';

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
