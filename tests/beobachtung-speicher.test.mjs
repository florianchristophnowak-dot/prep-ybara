/* ============================================================
   Ablage der Beobachtungen

   Geprüft wird die Schicht zwischen reiner Logik und Plattform, mit
   einer Attrappe statt einer echten Ablage. Vier Versprechen:

     - Gelesen wird erst, wenn jemand fragt – und nur einmal.
     - Die Startdaten landen erst mit der ersten Änderung auf der
       Platte; wer nur hineinschaut, hinterlässt nichts.
     - Geschrieben wird der Reihe nach, und keine Änderung geht
       verloren, auch wenn mehrere gleichzeitig angestossen werden.
     - Fehler werden gemeldet, nicht verschluckt – und ein
       unlesbarer Stand wird nicht überschrieben.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { erstelleBeobachtungSpeicher, NICHT_GELESEN } from '../renderer/src/beobachtung-speicher.js';
import {
  STANDARD_FRAGEN, startdaten, lernendeHinzufuegen, erfasseBeobachtung,
} from '../renderer/src/beobachtung.js';

const KEY = '6a||Französisch';
const klon = (x)=> JSON.parse(JSON.stringify(x));
const warte = (ms)=> new Promise(r => setTimeout(r, ms));

let zaehler = 0;
const neueId = (praefix = 'id')=> `${praefix}-${++zaehler}`;

/* Eine Ablage zum Zusehen: zählt Lese- und Schreibvorgänge, hebt jeden
   geschriebenen Stand auf und kann auf Wunsch zögern oder scheitern. */
function attrappe({ daten = null, ladeFehler = 0, schreibFehler = 0, ladeVerzoegerung = 0, schreibVerzoegerungen = [], antwort } = {}){
  const zustand = {
    daten, ladevorgaenge: 0, schreibvorgaenge: 0, geschrieben: [],
    ladeFehler, schreibFehler,
  };
  return {
    zustand,
    capabilities: { beobachtung: true },
    loadBeobachtung: async ()=>{
      zustand.ladevorgaenge += 1;
      if (ladeVerzoegerung) await warte(ladeVerzoegerung);
      if (zustand.ladeFehler > 0) { zustand.ladeFehler -= 1; throw new Error('Lesefehler'); }
      return zustand.daten === null ? null : klon(zustand.daten);
    },
    saveBeobachtung: async (d)=>{
      zustand.schreibvorgaenge += 1;
      const ms = schreibVerzoegerungen.shift() || 0;
      if (ms) await warte(ms);
      if (zustand.schreibFehler > 0) { zustand.schreibFehler -= 1; throw new Error('Platte voll'); }
      if (antwort) return antwort;
      zustand.daten = klon(d);
      zustand.geschrieben.push(klon(d));
      return { ok: true };
    },
  };
}

function gespeicherteDaten(){
  const d = startdaten({ neueId, jetzt: '2026-10-01T08:00:00.000Z' });
  return lernendeHinzufuegen(d, KEY, ['Mia', 'Noah'], { neueId });
}

/* ---- Ohne Ablage ------------------------------------------------------ */

test('ohne Plattformfähigkeit: nicht verfügbar, Startdaten im Speicher, nichts geschrieben', async ()=>{
  const speicher = erstelleBeobachtungSpeicher({});
  assert.equal(speicher.verfuegbar, false);
  const d = await speicher.laden();
  assert.equal(d.fragen.length, STANDARD_FRAGEN.length);
  assert.ok(d.fragen.every(f => f.standard));

  // Änderungen gelten bis zum Neustart, ohne dass etwas geschrieben würde.
  const neu = await speicher.aendern(x => lernendeHinzufuegen(x, KEY, 'Mia', { neueId }));
  assert.equal(neu.lernende[KEY].length, 1);
  assert.equal(speicher.zwischenstand(), neu);
});

test('eine Plattform, die die Ablage ausdrücklich verneint, gilt als nicht verfügbar', async ()=>{
  const p = attrappe();
  p.capabilities.beobachtung = false;
  const speicher = erstelleBeobachtungSpeicher(p);
  assert.equal(speicher.verfuegbar, false);
  await speicher.laden();
  await speicher.aendern(x => lernendeHinzufuegen(x, KEY, 'Mia', { neueId }));
  assert.equal(p.zustand.ladevorgaenge, 0);
  assert.equal(p.zustand.schreibvorgaenge, 0);
});

/* ---- Laden erst bei Bedarf ------------------------------------------- */

test('gelesen wird erst beim ersten Zugriff, und nur einmal', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten(), ladeVerzoegerung: 5 });
  const speicher = erstelleBeobachtungSpeicher(p);
  assert.equal(speicher.verfuegbar, true);
  assert.equal(p.zustand.ladevorgaenge, 0, 'kein Zugriff beim Anlegen');
  assert.equal(speicher.zwischenstand(), null);

  // Zwei gleichzeitige Zugriffe teilen sich einen Ladevorgang.
  const [a, b] = await Promise.all([speicher.laden(), speicher.laden()]);
  assert.equal(a, b);
  await speicher.laden();
  assert.equal(p.zustand.ladevorgaenge, 1);
  assert.equal(speicher.zwischenstand(), a);
  assert.equal(a.lernende[KEY].length, 2);
});

test('Gespeichertes wird normalisiert gelesen, ohne dass dabei geschrieben wird', async ()=>{
  const roh = gespeicherteDaten();
  roh.beobachtungen.push({ id: 'kaputt', lerngruppe: KEY, lernendeId: 'x', frageId: 'y', wert: 9, datum: '2026-10-01' });
  roh.einstellungen.rundenGroesse = 99;
  const p = attrappe({ daten: roh });
  const d = await erstelleBeobachtungSpeicher(p).laden();
  assert.equal(d.beobachtungen.length, 0, 'Wert ausserhalb der Skala fällt weg');
  assert.equal(d.einstellungen.rundenGroesse, 10);
  assert.equal(p.zustand.schreibvorgaenge, 0);
});

/* ---- Startdaten ------------------------------------------------------- */

test('nie geschrieben: Startdaten im Speicher, aber noch nicht auf der Platte', async ()=>{
  const p = attrappe({ daten: null });
  const speicher = erstelleBeobachtungSpeicher(p, { neueId, jetzt: '2026-10-12T09:00:00.000Z' });
  const d = await speicher.laden();
  assert.equal(d.fragen.length, STANDARD_FRAGEN.length);
  assert.ok(d.fragen.every(f => f.erstelltAm === '2026-10-12T09:00:00.000Z'));
  assert.equal(p.zustand.schreibvorgaenge, 0, 'Hineinschauen schreibt nichts');

  // Eine Änderung, die nichts ändert (ungültige Eingabe), schreibt auch nichts.
  const gleich = await speicher.aendern(x => erfasseBeobachtung(x, { lerngruppe: KEY, wert: 7 }));
  assert.equal(gleich, d);
  assert.equal(p.zustand.schreibvorgaenge, 0);

  // Die erste echte Änderung schreibt – samt den Standardfragen.
  await speicher.aendern(x => lernendeHinzufuegen(x, KEY, 'Mia', { neueId }));
  assert.equal(p.zustand.schreibvorgaenge, 1);
  assert.equal(p.zustand.daten.fragen.length, STANDARD_FRAGEN.length);
  assert.deepEqual(p.zustand.daten.fragen.map(f => f.id), d.fragen.map(f => f.id), 'dieselben Fragen, keine neu erzeugten');
  assert.equal(p.zustand.daten.lernende[KEY][0].name, 'Mia');
});

/* ---- Ändern ----------------------------------------------------------- */

test('aendern liefert den neuen Stand und schreibt ihn normalisiert', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p);
  const neu = await speicher.aendern(d => ({
    ...d,
    einstellungen: { rundenGroesse: '4' },
    lernende: { ...d.lernende, ' 7b ||  ': [{ name: '  Lea  ' }] },
  }));
  assert.equal(neu.einstellungen.rundenGroesse, 4);
  assert.equal(neu.lernende['7b||'][0].name, 'Lea');
  assert.ok(neu.lernende['7b||'][0].id, 'fehlende Kennung wird ergänzt');
  assert.deepEqual(p.zustand.daten, klon(neu));
});

test('gleichzeitig angestossene Änderungen bauen aufeinander auf', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten(), ladeVerzoegerung: 5 });
  const speicher = erstelleBeobachtungSpeicher(p);
  // Beide starten, bevor überhaupt geladen ist.
  const [a, b] = await Promise.all([
    speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId })),
    speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Tim', { neueId })),
  ]);
  assert.deepEqual(a.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea']);
  assert.deepEqual(b.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea', 'Tim']);
  assert.deepEqual(p.zustand.daten.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea', 'Tim']);
  assert.equal(p.zustand.ladevorgaenge, 1);
});

test('geschrieben wird der Reihe nach, auch wenn ein Schreibvorgang länger dauert', async ()=>{
  // Der erste Schreibvorgang braucht lange, der zweite ist sofort fertig.
  const p = attrappe({ daten: gespeicherteDaten(), schreibVerzoegerungen: [30, 0, 0] });
  const speicher = erstelleBeobachtungSpeicher(p);
  await speicher.laden();
  const d = await speicher.laden();
  const [mia, noah] = d.lernende[KEY];
  const frage = d.fragen[0];
  const erfasse = (lernende, wert)=> speicher.aendern(x => erfasseBeobachtung(x, {
    lerngruppe: KEY, lernendeId: lernende.id, frageId: frage.id, wert, datum: '2026-10-12',
  }, { neueId }));

  await Promise.all([erfasse(mia, 3), erfasse(noah, 2), erfasse(mia, 4)]);
  assert.equal(p.zustand.schreibvorgaenge, 3);
  // Jeder geschriebene Stand enthält alles Vorherige – nie geht es zurück.
  assert.deepEqual(p.zustand.geschrieben.map(s => s.beobachtungen.length), [1, 2, 3]);
  assert.deepEqual(p.zustand.daten.beobachtungen.map(b => b.wert), [3, 2, 4]);
});

test('ersetzen schreibt den übergebenen Stand normalisiert', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p);
  const neu = await speicher.ersetzen({ lernende: { '8c||Deutsch': [{ id: 'l1', name: 'Ada' }] } });
  assert.deepEqual(Object.keys(neu.lernende), ['8c||Deutsch']);
  assert.equal(neu.fragen.length, 0);
  assert.deepEqual(p.zustand.daten, klon(neu));
  assert.equal(speicher.zwischenstand(), neu);
});

test('leeren beginnt wieder bei den Startdaten und schreibt sofort', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p);
  await speicher.laden();
  const frisch = await speicher.leeren();
  assert.deepEqual(frisch.lernende, {});
  assert.equal(frisch.fragen.length, STANDARD_FRAGEN.length);
  assert.deepEqual(p.zustand.daten, klon(frisch));
});

test('die übergebene Eingabe wird nicht verändert', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p);
  const vorher = await speicher.laden();
  const abbild = JSON.stringify(vorher);
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  assert.equal(JSON.stringify(vorher), abbild);
});

/* ---- Fehlerwege ------------------------------------------------------- */

test('ein gescheiterter Schreibvorgang wird gemeldet und bricht die Kette nicht ab', async ()=>{
  const fehler = [];
  const p = attrappe({ daten: gespeicherteDaten(), schreibFehler: 1 });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: e => fehler.push(e) });

  const erster = await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  assert.equal(fehler.length, 1);
  assert.match(String(fehler[0].message), /Platte voll/);
  assert.deepEqual(erster.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea'], 'der Stand gilt im Speicher');
  assert.equal(p.zustand.daten.lernende[KEY].length, 2, 'auf der Platte fehlt Lea noch');

  // Der nächste Schreibvorgang holt nach, was fehlte.
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Tim', { neueId }));
  assert.equal(fehler.length, 1);
  assert.deepEqual(p.zustand.daten.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea', 'Tim']);
});

test('eine Absage der Plattform ({ ok: false }) gilt als Fehler', async ()=>{
  const fehler = [];
  const p = attrappe({ daten: gespeicherteDaten(), antwort: { ok: false, error: 'Kein Zugriff' } });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: e => fehler.push(e) });
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  assert.equal(fehler.length, 1);
  assert.match(String(fehler[0].message), /Kein Zugriff/);
});

test('ein unlesbarer Stand wird nicht überschrieben – und beim nächsten Zugriff erneut gelesen', async ()=>{
  const fehler = [];
  const gespeichert = gespeicherteDaten();
  const p = attrappe({ daten: gespeichert, ladeFehler: 1 });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: e => fehler.push(e) });

  const leer = await speicher.laden();
  assert.equal(fehler.length, 1);
  assert.match(String(fehler[0].message), /Lesefehler/);
  assert.deepEqual(leer.fragen, [], 'keine Startdaten vortäuschen');
  assert.equal(speicher.zwischenstand(), null);

  // Inzwischen klappt das Lesen wieder: Die Änderung baut auf dem echten Stand auf.
  const neu = await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  assert.equal(p.zustand.ladevorgaenge, 2);
  assert.deepEqual(neu.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea']);
  assert.equal(p.zustand.daten.fragen.length, gespeichert.fragen.length);
});

test('scheitert das Lesen weiter, schreiben aendern und ersetzen nichts', async ()=>{
  const fehler = [];
  const p = attrappe({ daten: gespeicherteDaten(), ladeFehler: 5 });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: e => fehler.push(e) });
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  await speicher.ersetzen({ lernende: {} });
  assert.equal(p.zustand.schreibvorgaenge, 0);
  assert.ok(fehler.some(e => e.message === NICHT_GELESEN));
  assert.equal(p.zustand.daten.lernende[KEY].length, 2, 'die Ablage ist unberührt');
});

test('leeren ist der ausdrückliche Ausweg, auch wenn das Lesen scheitert', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten(), ladeFehler: 5 });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: ()=>{} });
  await speicher.laden();
  await speicher.leeren();
  assert.equal(p.zustand.schreibvorgaenge, 1);
  assert.deepEqual(p.zustand.daten.lernende, {});
  // Danach gilt der geleerte Stand, ohne erneut zu lesen.
  const d = await speicher.laden();
  assert.deepEqual(d.lernende, {});
});

test('leeren während eines laufenden Ladevorgangs gewinnt', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten(), ladeVerzoegerung: 10 });
  const speicher = erstelleBeobachtungSpeicher(p);
  const laeuft = speicher.laden();
  await speicher.leeren();
  const d = await laeuft;
  assert.deepEqual(d.lernende, {}, 'der vor dem Leeren gelesene Stand kommt nicht zurück');
});

/* ---- Verwerfen ---------------------------------------------------------
   "Alle Daten löschen" leert die Ablage an diesem Speicher vorbei. Was
   er danach noch im Kopf hat, darf nicht zurück auf die Platte. */

test('verwerfen: nach dem Leeren von aussen kommt der alte Stand nicht zurück', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p, { neueId });
  const d = await speicher.laden();
  await speicher.aendern(x => erfasseBeobachtung(x, {
    lerngruppe: KEY, lernendeId: d.lernende[KEY][0].id, frageId: d.fragen[0].id, wert: 2,
    notiz: 'vergisst Heft', datum: '2026-10-12',
  }, { neueId }));

  p.zustand.daten = null;                  // die Ablage wurde geleert
  speicher.verwerfen();
  assert.equal(speicher.zwischenstand(), null, 'nichts mehr im Speicher');

  const neu = await speicher.aendern(x => lernendeHinzufuegen(x, '7b||', 'Tim', { neueId }));
  assert.equal(p.zustand.ladevorgaenge, 2, 'erneut von der Platte gelesen');
  assert.deepEqual(Object.keys(p.zustand.daten.lernende), ['7b||']);
  assert.deepEqual(p.zustand.daten.beobachtungen, []);
  assert.equal(p.zustand.daten.fragen.length, STANDARD_FRAGEN.length);
  assert.deepEqual(p.zustand.daten, klon(neu));
});

test('verwerfen: ein laufender Ladevorgang und wartende Schreibvorgänge zählen nicht mehr', async ()=>{
  // Ein Ladevorgang, der den alten Stand noch gelesen hat, aber erst nach dem Verwerfen fertig wird.
  let freigeben = null;
  let lesen = 0;
  const p = {
    capabilities: { beobachtung: true },
    loadBeobachtung: ()=>{
      lesen += 1;
      if (lesen > 1) return Promise.resolve(null);      // inzwischen geleert
      const alt = klon(gespeicherteDaten());
      return new Promise((r)=>{ freigeben = ()=> r(alt); });
    },
    saveBeobachtung: async ()=> ({ ok: true }),
  };
  const speicher = erstelleBeobachtungSpeicher(p);
  const laeuft = speicher.laden();
  speicher.verwerfen();
  freigeben();
  assert.deepEqual((await laeuft).lernende, {}, 'wer wartet, bekommt den neu gelesenen Stand');
  assert.equal(lesen, 2);
  assert.deepEqual(speicher.zwischenstand().lernende, {});

  // Der erste Schreibvorgang läuft schon und ist nicht mehr aufzuhalten; der zweite wartet noch.
  const q = attrappe({ daten: gespeicherteDaten(), schreibVerzoegerungen: [20, 0] });
  const zweiter = erstelleBeobachtungSpeicher(q);
  await zweiter.laden();
  const a = zweiter.aendern(x => lernendeHinzufuegen(x, KEY, 'Lea', { neueId }));
  const b = zweiter.aendern(x => lernendeHinzufuegen(x, KEY, 'Tim', { neueId }));
  await warte(5);
  zweiter.verwerfen();
  await Promise.all([a, b]);
  assert.equal(q.zustand.schreibvorgaenge, 1);
  assert.deepEqual(q.zustand.daten.lernende[KEY].map(l => l.name), ['Mia', 'Noah', 'Lea']);
});

test('eine Änderung, die wirft oder kein Stand ist, ändert nichts', async ()=>{
  const fehler = [];
  const p = attrappe({ daten: gespeicherteDaten() });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: e => fehler.push(e) });
  const vorher = await speicher.laden();

  assert.equal(await speicher.aendern(()=>{ throw new Error('Tippfehler'); }), vorher);
  assert.equal(await speicher.aendern(async d => d), vorher, 'ein Promise ist kein Stand');
  assert.equal(await speicher.aendern(()=> []), vorher);
  assert.equal(await speicher.aendern(()=> undefined), vorher);
  assert.equal(await speicher.ersetzen(null), vorher);

  assert.equal(p.zustand.schreibvorgaenge, 0);
  assert.equal(fehler.length, 4);
});

test('ein Fehler in beiFehler selbst bringt die Ablage nicht durcheinander', async ()=>{
  const p = attrappe({ daten: gespeicherteDaten(), schreibFehler: 1 });
  const speicher = erstelleBeobachtungSpeicher(p, { beiFehler: ()=>{ throw new Error('Meldung kaputt'); } });
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Lea', { neueId }));
  await speicher.aendern(d => lernendeHinzufuegen(d, KEY, 'Tim', { neueId }));
  assert.equal(p.zustand.daten.lernende[KEY].length, 4);
});
