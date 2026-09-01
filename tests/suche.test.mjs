/* ============================================================
   Globale Suche

   Geprüft wird, was die Suche brauchbar macht:

     - Gross- und Kleinschreibung spielen keine Rolle.
     - "Quebec" findet "Québec" – auch dann, wenn das é aus zwei
       Zeichen besteht.
     - Mehrere Begriffe werden UND-verknüpft.
     - Alle vorgesehenen Inhaltstypen kommen vor, archivierte
       eingeschlossen und als solche gekennzeichnet.
     - Die Hervorhebung baut niemals HTML.
     - Der Versionsverlauf wird NICHT durchsucht.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TYPEN, normalisiere, begriffeAus, reinerText,
  baueIndex, sucheImIndex, gruppiereTreffer, filterWerte,
  teileNachTreffern, fundstelleFuer,
} from '../renderer/src/suche.js';

function stunde(patch = {}){
  return {
    subject: 'Französisch', classGroup: '9b', room: 'A101',
    topic: '', objectives: '', phases: [], homework: '', notes: '',
    files: [], links: [], sequenceId: '', competencies: [], blockSpan: 1,
    ...patch,
  };
}

function daten(){
  return {
    sequences: {
      s1: {
        id: 's1', name: 'Le passé composé', color: '#4f6ef7',
        competencies: ['Sprechen'], primaryCompetency: 'Sprechen',
        finalTask: { text: 'Über die Ferien berichten', situation: 'Klassengespräch', audience: '', intention: '', outcome: '' },
        description: 'Einführung der Vergangenheit',
        targetProduct: 'Podcast',
        prerequisites: 'Présent sicher',
        courseRef: 'Découvertes 3, Lektion 2',
      },
    },
    sequenceTemplates: {
      t1: {
        id: 't1', name: 'Séjour à Québec', subject: 'Französisch',
        description: 'Landeskunde Kanada',
        competencies: ['Interkulturelle Kompetenz'],
        lessons: [{ topic: 'Einstieg Québec', objectives: 'Orientierung', phases: [{ title: 'Einstieg', content: '<p>Bildimpuls <b>Winter</b></p>' }] }],
      },
    },
    weeks: {
      '2025-09-01': {
        slotsPerDay: 6,
        lessons: {
          '0-2': stunde({
            sequenceId: 's1',
            topic: 'Le passé composé mit avoir',
            objectives: 'Die Lernenden berichten über das Wochenende.',
            competencies: ['Sprechen', 'Schreiben'],
            primaryCompetency: 'Sprechen',
            homework: 'Übungen Seite 42',
            notes: 'Beamer mitbringen',
            phases: [{ id: 'p1', title: 'Einstieg', content: '<p>Bildimpuls: <b>Québec</b> im Winter</p>', socialForm: 'Plenum' }],
            links: [{ id: 'l1', title: 'Video zur Grammatik', url: 'https://example.org/video' }],
            files: [{ id: 'f1', name: 'Arbeitsblatt Passé.pdf', path: '/home/x/Arbeitsblatt.pdf' }],
            languageResources: { vocabulary: 'le week-end', grammar: 'avoir + participe', pronunciation: '', other: '' },
            speechActs: ['berichten'],
          }),
          '2-1': stunde({ topic: 'Wiederholung', classGroup: '7a', subject: 'Mathematik' }),
        },
        duties: {},
      },
    },
    yearBars: [
      { id: 'b1', title: 'Passé composé (Lektion 2)', classGroup: '9b', subject: 'Französisch', startISO: '2025-09-01', endISO: '2025-09-29', sequenceId: 's1' },
      { id: 'b2', title: 'Klassenfahrt', classGroup: '', subject: '', startISO: '2025-10-06', endISO: '2025-10-10' },
    ],
    todos: [
      { id: 'td1', text: 'Kopien für Québec-Stunde machen', done: false, dateISO: '2025-09-01', deadlineISO: '', weekStartISO: '2025-09-01' },
    ],
    schoolCalendar: { schoolYear: { startISO: '2025-08-01', endISO: '2026-07-31' }, vacations: [], freeDays: [], events: [] },
    schoolYearArchives: [
      {
        id: 'a1', label: 'Schuljahr 2024/25', startISO: '2024-08-01', endISO: '2025-07-31',
        data: {
          sequences: { alt1: { id: 'alt1', name: 'Les vacances au Québec' } },
          weeks: {
            '2024-09-02': {
              slotsPerDay: 6,
              lessons: {
                '0-2': stunde({
                  sequenceId: 'alt1', topic: 'Voyage à Québec',
                  objectives: 'Reisebericht schreiben', competencies: ['Schreiben'],
                }),
              },
              duties: {},
            },
          },
          yearBars: [],
          todos: [],
        },
      },
    ],
  };
}

function index(){
  const db = daten();
  return baueIndex(db, { archive: db.schoolYearArchives });
}

/* ---- Normalisierung --------------------------------------------------- */

test('Gross- und Kleinschreibung spielen keine Rolle', ()=>{
  assert.equal(normalisiere('Passé COMPOSÉ'), 'passe compose');
  const treffer = sucheImIndex(index(), 'PASSÉ');
  assert.ok(treffer.length >= 2);
});

test('Akzente und Unicode-Normalformen werden zusammengeführt', ()=>{
  const zusammen = 'Québec';                    // é als ein Zeichen
  const zerlegt = 'Québec';               // e + Combining Accent
  assert.notEqual(zusammen, zerlegt, 'die Ausgangstexte sind wirklich verschieden');
  assert.equal(normalisiere(zusammen), normalisiere(zerlegt));
  assert.equal(normalisiere(zusammen), 'quebec');

  const idx = index();
  const ohneAkzent = sucheImIndex(idx, 'Quebec');
  const mitAkzent = sucheImIndex(idx, zusammen);
  const zerlegtGesucht = sucheImIndex(idx, zerlegt);
  assert.ok(ohneAkzent.length > 0);
  assert.equal(ohneAkzent.length, mitAkzent.length);
  assert.equal(ohneAkzent.length, zerlegtGesucht.length);
});

test('ß und ss finden einander', ()=>{
  assert.equal(normalisiere('Straße'), 'strasse');
  assert.equal(normalisiere('STRASSE'), 'strasse');
});

test('Mehrere Suchbegriffe werden UND-verknüpft', ()=>{
  const idx = index();
  assert.deepEqual(begriffeAus('passé   composé'), ['passe', 'compose']);
  assert.equal(sucheImIndex(idx, 'passé wochenende').length, 1);
  assert.equal(sucheImIndex(idx, 'passé rechenweg').length, 0);
});

test('Ein Begriff in Anführungszeichen bleibt zusammen', ()=>{
  assert.deepEqual(begriffeAus('"passé composé" 9b'), ['passe compose', '9b']);
  assert.ok(sucheImIndex(index(), '"passé composé"').length > 0);
});

/* ---- Inhaltstypen ------------------------------------------------------ */

test('Alle vorgesehenen Inhaltstypen sind im Index', ()=>{
  const typen = new Set(index().dokumente.map(d => d.typ));
  assert.ok(typen.has(TYPEN.STUNDE));
  assert.ok(typen.has(TYPEN.SEQUENZ));
  assert.ok(typen.has(TYPEN.VORLAGE));
  assert.ok(typen.has(TYPEN.JAHRESPLANUNG));
  assert.ok(typen.has(TYPEN.TODO));
});

test('In Stunden werden auch Phasen, Materialien und Links gefunden', ()=>{
  const idx = index();
  const finde = (q)=> sucheImIndex(idx, q).filter(t => t.dokument.typ === TYPEN.STUNDE);
  assert.ok(finde('bildimpuls').length, 'Phaseninhalt');
  assert.ok(finde('plenum').length, 'Sozialform');
  assert.ok(finde('beamer').length, 'Notiz');
  assert.ok(finde('seite 42').length, 'Hausaufgabe');
  assert.ok(finde('arbeitsblatt').length, 'Material');
  assert.ok(finde('grammatik').length, 'Link');
  assert.ok(finde('participe').length, 'sprachliche Mittel');
  assert.ok(finde('berichten').length, 'Sprechabsicht');
  assert.ok(finde('A101').length, 'Raum');
});

test('In Sequenzen werden Zielaufgabe, Zielprodukt und Lehrwerksbezug gefunden', ()=>{
  const idx = index();
  const finde = (q)=> sucheImIndex(idx, q).filter(t => t.dokument.typ === TYPEN.SEQUENZ);
  assert.ok(finde('podcast').length, 'Zielprodukt');
  assert.ok(finde('découvertes').length, 'Lehrwerksbezug');
  assert.ok(finde('présent sicher').length, 'Voraussetzungen');
  assert.ok(finde('ferien berichten').length, 'Zielaufgabe');
  assert.ok(finde('einführung der vergangenheit').length, 'Beschreibung');
});

test('Vorlagen werden mit ihren Einheiten durchsucht', ()=>{
  const treffer = sucheImIndex(index(), 'landeskunde').filter(t => t.dokument.typ === TYPEN.VORLAGE);
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].dokument.titel, 'Séjour à Québec');
  assert.ok(sucheImIndex(index(), 'winter').some(t => t.dokument.typ === TYPEN.VORLAGE));
});

test('Jahresbalken werden samt verknüpfter Sequenz gefunden', ()=>{
  const idx = index();
  const balken = sucheImIndex(idx, 'lektion 2').filter(t => t.dokument.typ === TYPEN.JAHRESPLANUNG);
  assert.equal(balken.length, 1);
  const ueberSequenz = sucheImIndex(idx, 'klassenfahrt');
  assert.equal(ueberSequenz.length, 1);
});

test('To-dos werden gefunden', ()=>{
  const treffer = sucheImIndex(index(), 'kopien').filter(t => t.dokument.typ === TYPEN.TODO);
  assert.equal(treffer.length, 1);
});

/* ---- Archiv ------------------------------------------------------------ */

test('Archivierte Schuljahre werden mitdurchsucht und gekennzeichnet', ()=>{
  const treffer = sucheImIndex(index(), 'voyage');
  /* Gefunden werden die archivierte Stunde UND ihre Sequenz: eine
     Sequenz ist auch über die Themen ihrer Stunden auffindbar. */
  assert.equal(treffer.length, 2);
  assert.ok(treffer.every(t => t.dokument.quelle.archiviert === true));
  assert.ok(treffer.every(t => t.dokument.quelle.name === 'Schuljahr 2024/25'));
  assert.ok(treffer.every(t => t.dokument.ziel.archivId === 'a1'));
  const stunde = treffer.find(t => t.dokument.typ === TYPEN.STUNDE);
  assert.equal(stunde.dokument.titel, 'Voyage à Québec');
});

test('Das Archiv lässt sich aus der Suche ausschliessen', ()=>{
  const idx = index();
  assert.equal(sucheImIndex(idx, 'québec', { mitArchiv: false }).some(t => t.dokument.quelle.archiviert), false);
  assert.ok(sucheImIndex(idx, 'québec', { mitArchiv: true }).some(t => t.dokument.quelle.archiviert));
});

/* ---- Filter ------------------------------------------------------------ */

test('Nach Inhaltstyp filtern', ()=>{
  const idx = index();
  const nurStunden = sucheImIndex(idx, 'québec', { typen: new Set([TYPEN.STUNDE]) });
  assert.ok(nurStunden.length > 0);
  assert.ok(nurStunden.every(t => t.dokument.typ === TYPEN.STUNDE));
});

test('Nach Lerngruppe filtern', ()=>{
  const idx = index();
  const treffer = sucheImIndex(idx, '', { lerngruppe: '7a · Mathematik' });
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].dokument.titel, 'Wiederholung');
});

test('Nach Schuljahr filtern', ()=>{
  const idx = index();
  const treffer = sucheImIndex(idx, 'québec', { quelle: 'archiv:a1' });
  assert.ok(treffer.length > 0);
  assert.ok(treffer.every(t => t.dokument.quelle.id === 'archiv:a1'));
});

test('Nach Kompetenz filtern', ()=>{
  const idx = index();
  const treffer = sucheImIndex(idx, '', { kompetenz: 'Schreiben' });
  assert.ok(treffer.length >= 2, 'aktuelle und archivierte Stunde');
  assert.ok(treffer.every(t => t.dokument.kompetenzen.includes('Schreiben')));
});

test('Die Filterlisten entstehen aus dem Index', ()=>{
  const werte = filterWerte(index());
  assert.ok(werte.lerngruppen.includes('9b · Französisch'));
  assert.ok(werte.lerngruppen.includes('7a · Mathematik'));
  assert.ok(werte.kompetenzen.includes('Sprechen'));
  assert.ok(werte.quellen.some(q => q.id === 'aktuell'));
  assert.ok(werte.quellen.some(q => q.id === 'archiv:a1'));
});

/* ---- Gruppierung und Ausgabe ------------------------------------------- */

test('Treffer werden nach Inhaltstyp gruppiert', ()=>{
  const gruppen = gruppiereTreffer(sucheImIndex(index(), 'québec'));
  assert.ok(gruppen.length >= 2);
  assert.equal(gruppen[0].typ, TYPEN.STUNDE, 'Stunden stehen vorn');
  assert.ok(gruppen.every(g => g.treffer.length > 0));
});

test('Treffer im Titel stehen vor Treffern im Text', ()=>{
  const treffer = sucheImIndex(index(), 'passé composé');
  assert.ok(treffer.length >= 2);
  assert.ok(['Le passé composé', 'Le passé composé mit avoir', 'Passé composé (Lektion 2)']
    .includes(treffer[0].dokument.titel));
});

test('Jeder Treffer nennt Fundstelle und Herkunft', ()=>{
  const treffer = sucheImIndex(index(), 'beamer');
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].fundstelle.feld, 'Notizen');
  assert.match(treffer[0].fundstelle.text, /Beamer/);
  assert.equal(treffer[0].dokument.quelle.name, 'Aktuelles Schuljahr');
  assert.equal(treffer[0].dokument.dateISO, '2025-09-01');
  assert.equal(treffer[0].dokument.classGroup, '9b');
});

test('Aus angereichertem Text wird für die Suche reiner Text', ()=>{
  assert.equal(reinerText('<p>Bildimpuls: <b>Québec</b></p>'), 'Bildimpuls: Québec');
  assert.equal(reinerText('Sch&uuml;ler &amp; Lehrkraft'), 'Sch&uuml;ler & Lehrkraft');
  assert.equal(reinerText('a<br>b'), 'a b');
});

/* ---- Hervorhebung ohne HTML -------------------------------------------- */

test('Die Hervorhebung liefert Textstücke, kein Markup', ()=>{
  const teile = teileNachTreffern('Le passé composé mit avoir', ['passe']);
  assert.deepEqual(teile.map(t => t.text).join(''), 'Le passé composé mit avoir');
  assert.deepEqual(teile.filter(t => t.treffer).map(t => t.text), ['passé']);
  for (const t of teile) assert.equal(typeof t.text, 'string');
});

test('Ein Suchbegriff mit spitzen Klammern bleibt Text', ()=>{
  const teile = teileNachTreffern('Ein <script>alert(1)</script> im Thema', ['<script>']);
  assert.equal(teile.map(t => t.text).join(''), 'Ein <script>alert(1)</script> im Thema');
  assert.deepEqual(teile.filter(t => t.treffer).map(t => t.text), ['<script>']);
  // Es gibt keinerlei HTML-Zeichenkette – nur Stücke mit einem Merker.
  for (const t of teile) assert.deepEqual(Object.keys(t).sort(), ['text', 'treffer']);
});

test('Die Hervorhebung findet Akzente über die Normalform hinweg', ()=>{
  const teile = teileNachTreffern('Séjour à Québec', ['quebec']);
  assert.deepEqual(teile.filter(t => t.treffer).map(t => t.text), ['Québec']);
});

test('Ohne Begriffe wird nichts hervorgehoben', ()=>{
  assert.deepEqual(teileNachTreffern('Text', []), [{ text: 'Text', treffer: false }]);
  assert.deepEqual(teileNachTreffern('', ['x']), []);
});

/* ---- Aktualität --------------------------------------------------------- */

test('Nach einer Datenänderung findet der neu gebaute Index den neuen Stand', ()=>{
  const db = daten();
  const vorher = baueIndex(db);
  assert.equal(sucheImIndex(vorher, 'Vulkanausbruch').length, 0);

  db.weeks['2025-09-01'].lessons['0-2'].topic = 'Vulkanausbruch in der Auvergne';
  const nachher = baueIndex(db);
  const stunden = sucheImIndex(nachher, 'Vulkanausbruch').filter(t => t.dokument.typ === TYPEN.STUNDE);
  assert.equal(stunden.length, 1);
  assert.equal(stunden[0].dokument.titel, 'Vulkanausbruch in der Auvergne');
  // Und der alte Titel ist weg – auch aus der Sequenz, die ihn mitführte.
  assert.equal(sucheImIndex(vorher, '"composé mit avoir"').length, 2);
  assert.equal(sucheImIndex(nachher, '"composé mit avoir"').length, 0);
});

test('Eine gelöschte Stunde verschwindet aus dem Index', ()=>{
  const db = daten();
  delete db.weeks['2025-09-01'].lessons['0-2'];
  const idx = baueIndex(db);
  assert.equal(idx.dokumente.filter(d => d.typ === TYPEN.STUNDE).length, 1);
});

/* ---- Was NICHT durchsucht wird ------------------------------------------ */

test('Der Versionsverlauf wird nicht durchsucht', ()=>{
  const db = daten();
  /* Selbst wenn jemand Verlaufsdaten in die Datenbank legte: die Suche
     kennt diese Felder nicht und macht daraus keine Dokumente. */
  db.versionHistory = [{ id: 'v1', teile: [{ art: 'stunde', wert: { topic: 'Geheime alte Fassung' } }] }];
  const idx = baueIndex(db);
  assert.equal(sucheImIndex(idx, 'geheime').length, 0);
});

test('Ein leerer Index und eine leere Suche kommen ohne Fehler aus', ()=>{
  const leer = baueIndex(null);
  assert.deepEqual(leer.dokumente, []);
  assert.deepEqual(sucheImIndex(leer, 'irgendwas'), []);
  assert.equal(fundstelleFuer({ felder: [] }, ['x']), null);
});
