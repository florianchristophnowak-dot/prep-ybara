/* ============================================================
   Globale Suche

   Was einmal geplant wurde, soll wiederzufinden sein – auch aus einem
   Schuljahr, das längst archiviert ist. Genau das ist der Zweck: nicht
   eine zweite Ablage, sondern ein Weg zurück zu dem, was schon da ist.

   Der Aufbau in drei Schritten:

     1. `baueIndex` liest die Daten aus und macht daraus Dokumente:
        Titel, Herkunft, durchsuchbare Felder, ein Ziel zum Öffnen.
     2. `sucheImIndex` vergleicht die Suchbegriffe mit diesen Feldern.
     3. `teileNachTreffern` zerlegt einen Fundtext in Stücke, aus denen
        die Oberfläche React-Elemente baut.

   Der dritte Punkt ist kein Detail: eine Hervorhebung über
   dangerouslySetInnerHTML wäre eine Einladung, fremden Text als
   Markup auszuführen. Hier entstehen ausschliesslich Zeichenketten in
   einer Liste – die Oberfläche setzt daraus <mark>-Elemente.

   Alles hier ist rein: kein React, keine Ablage, keine Netzverbindung.
   Der Index lebt im Arbeitsspeicher und lässt sich jederzeit aus den
   Daten neu bauen.
   ============================================================ */

import { blockSpanOf } from './doppelstunde.js';
import { normalisiereAufgabe, normalisiereMittel, normalisiereSprechabsichten, scaffoldsDerStunde } from './didaktik.js';

/* ---- Normalisierung ---------------------------------------------------

   Gesucht wird ohne Rücksicht auf Gross- und Kleinschreibung, ohne
   Akzente und ohne Unterschied zwischen den Unicode-Normalformen.

   "Québec" und "Quebec" müssen denselben Treffer ergeben – und zwar
   auch dann, wenn das é einmal als ein Zeichen (U+00E9) und einmal als
   e + Accent (U+0065 U+0301) gespeichert ist. Deshalb zuerst NFD, dann
   die kombinierenden Zeichen weg.

   ß wird zu ss, weil "Strasse" und "Straße" dasselbe Wort sind. */
export function normalisiere(str){
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim();
}

/* Die Suchbegriffe einer Eingabe. Mehrere Begriffe werden UND-verknüpft:
   wer "passé 9b" tippt, will beides zugleich. Anführungszeichen fassen
   mehrere Wörter zu einem Begriff zusammen. */
export function begriffeAus(query){
  const roh = String(query ?? '').trim();
  if (!roh) return [];
  const begriffe = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(roh)) !== null) {
    const wert = normalisiere(m[1] || m[2] || '');
    if (wert) begriffe.push(wert);
  }
  return [...new Set(begriffe)];
}

/* ---- Inhaltstypen ----------------------------------------------------- */
export const TYPEN = {
  STUNDE: 'stunde',
  SEQUENZ: 'sequenz',
  VORLAGE: 'vorlage',
  JAHRESPLANUNG: 'jahresplanung',
  TODO: 'todo',
};

export const TYP_NAMEN = {
  [TYPEN.STUNDE]: 'Stunden',
  [TYPEN.SEQUENZ]: 'Sequenzen',
  [TYPEN.VORLAGE]: 'Vorlagen',
  [TYPEN.JAHRESPLANUNG]: 'Jahresplanung',
  [TYPEN.TODO]: 'To-dos',
};

export const TYP_REIHENFOLGE = [TYPEN.STUNDE, TYPEN.SEQUENZ, TYPEN.VORLAGE, TYPEN.JAHRESPLANUNG, TYPEN.TODO];

/* ---- Hilfen für den Aufbau -------------------------------------------- */
const text = (v)=> String(v ?? '').trim();

/* Reiner Text aus einem Feld, das auch angereichert sein kann.

   Die Phaseninhalte werden seit dem Rich-Text-Editor als sehr
   eingeschränktes HTML gespeichert. Für die Suche zählt das Wort, nicht
   das Markup – also weg damit. Entstehende Zeichenreferenzen werden
   aufgelöst, damit "Sch&uuml;ler" nicht als Fundstelle erscheint. */
export function reinerText(wert){
  const s = String(wert ?? '');
  if (!s) return '';
  if (!/[<&]/.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n)=> String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function feld(name, wert){
  const t = reinerText(wert);
  return t ? { name, text: t } : null;
}

function felderAusStunde(l){
  const aufgabe = normalisiereAufgabe(l?.communicativeTask);
  const mittel = normalisiereMittel(l?.languageResources);
  const scaffolds = scaffoldsDerStunde(l);
  const felder = [
    feld('Thema', l?.topic),
    feld('Lernziele', l?.objectives),
    feld('Klasse', l?.classGroup),
    feld('Fach', l?.subject),
    feld('Raum', l?.room),
    feld('Hausaufgaben', l?.homework),
    feld('Notizen', l?.notes),
    feld('Progressionsnotiz', l?.progressionNote),
    feld('Kompetenz', l?.primaryCompetency),
    feld('Kompetenzen', (Array.isArray(l?.competencies) ? l.competencies : []).join(', ')),
    feld('Sprechabsichten', normalisiereSprechabsichten(l?.speechActs).join(', ')),
    feld('Kommunikative Aufgabe', [aufgabe.text, aufgabe.situation, aufgabe.audience, aufgabe.intention, aufgabe.outcome].filter(Boolean).join(' · ')),
    feld('Sprachliche Mittel', [mittel.vocabulary, mittel.grammar, mittel.pronunciation, mittel.other].filter(Boolean).join(' · ')),
    feld('Erfolgskriterien', (Array.isArray(l?.successCriteria) ? l.successCriteria : [])
      .map(k => (typeof k === 'string' ? k : text(k?.text))).filter(Boolean).join(' · ')),
    feld('Hilfen', scaffolds.map(s => [s.label, s.note].filter(Boolean).join(' – ')).filter(Boolean).join(' · ')),
  ];
  for (const p of (Array.isArray(l?.phases) ? l.phases : [])) {
    const titel = text(p?.title);
    felder.push(feld(titel ? `Phase „${titel}“` : 'Phase', [
      titel,
      reinerText(p?.content),
      text(p?.socialForm),
      reinerText(p?.materialsMedia),
      reinerText(p?.remarks),
    ].filter(Boolean).join(' · ')));
  }
  for (const f of (Array.isArray(l?.files) ? l.files : [])) {
    felder.push(feld('Material', [text(f?.name), text(f?.path)].filter(Boolean).join(' · ')));
  }
  for (const link of (Array.isArray(l?.links) ? l.links : [])) {
    felder.push(feld('Link', [text(link?.title), text(link?.url)].filter(Boolean).join(' · ')));
  }
  return felder.filter(Boolean);
}

function felderAusSequenz(seq, { einheiten = [] } = {}){
  const aufgabe = normalisiereAufgabe(seq?.finalTask);
  const mittel = normalisiereMittel(seq?.languageResources);
  const felder = [
    feld('Name', seq?.name),
    feld('Beschreibung', seq?.description),
    feld('Klasse', seq?.classGroup),
    feld('Fach', seq?.subject),
    feld('Kompetenz', seq?.primaryCompetency),
    feld('Kompetenzen', (Array.isArray(seq?.competencies) ? seq.competencies : []).join(', ')),
    feld('Zielaufgabe', [aufgabe.text, aufgabe.situation, aufgabe.audience, aufgabe.intention, aufgabe.outcome].filter(Boolean).join(' · ')),
    feld('Zielprodukt', seq?.targetProduct),
    feld('Voraussetzungen', seq?.prerequisites),
    feld('Lehrwerksbezug', seq?.courseRef),
    feld('Klassenstufe', seq?.gradeLevel),
    feld('Lernjahr', seq?.learningYear),
    feld('Sprachliche Mittel', [mittel.vocabulary, mittel.grammar, mittel.pronunciation, mittel.other].filter(Boolean).join(' · ')),
  ];
  for (const e of einheiten) {
    felder.push(feld('Einheit', [text(e?.topic), reinerText(e?.objectives)].filter(Boolean).join(' · ')));
  }
  return felder.filter(Boolean);
}

function datumAusWoche(weekStart, dayIndex){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekStart || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + (Number(dayIndex) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---- Der Index --------------------------------------------------------

   Ein Dokument je Sache. `quelle` sagt, woher es kommt: das laufende
   Schuljahr oder ein bestimmtes Archiv. Das `ziel` beschreibt, wie man
   dorthin gelangt – die Oberfläche baut daraus ihre Navigation, hier
   sind es nur Angaben.

   Der Index wird NICHT gespeichert. Er entsteht aus den Daten und lässt
   sich jederzeit daraus neu bauen; damit kann er auch nicht veralten
   oder in einem Backup landen. */
export function baueIndex(db, { archive = [], quelleName = 'Aktuelles Schuljahr', quelleId = 'aktuell', archiviert = false } = {}){
  const dokumente = [];
  const quelle = { id: quelleId, name: quelleName, archiviert };

  const sequenzNamen = new Map();
  for (const [id, seq] of Object.entries(db?.sequences || {})) {
    if (seq) sequenzNamen.set(id, text(seq.name));
  }

  // --- Stunden ---
  for (const [weekStart, week] of Object.entries(db?.weeks || {})) {
    for (const [key, l] of Object.entries(week?.lessons || {})) {
      if (!l) continue;
      const [dayIndex, slotIndex] = String(key).split('-').map(Number);
      if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
      const felder = felderAusStunde(l);
      const seqName = sequenzNamen.get(text(l.sequenceId)) || '';
      if (seqName) felder.push({ name: 'Sequenz', text: seqName });
      if (!felder.length) continue;
      const dateISO = datumAusWoche(weekStart, dayIndex);
      dokumente.push({
        id: `${quelle.id}:stunde:${weekStart}:${key}`,
        typ: TYPEN.STUNDE,
        titel: text(l.topic) || 'Stunde ohne Thema',
        classGroup: text(l.classGroup),
        subject: text(l.subject),
        kompetenzen: kompetenzenAus(l),
        dateISO,
        vonISO: dateISO,
        bisISO: dateISO,
        span: blockSpanOf(l),
        slotIndex,
        quelle,
        felder,
        ziel: { art: 'stunde', quelleId: quelle.id, weekStart, dayIndex, slotIndex },
      });
    }
  }

  // --- Sequenzen ---
  for (const [id, seq] of Object.entries(db?.sequences || {})) {
    if (!seq) continue;
    const stundenDerSequenz = dokumente.filter(d => d.typ === TYPEN.STUNDE
      && d.ziel.quelleId === quelle.id
      && (db?.weeks?.[d.ziel.weekStart]?.lessons?.[`${d.ziel.dayIndex}-${d.ziel.slotIndex}`]?.sequenceId === id));
    const daten = stundenDerSequenz.map(d => d.dateISO).filter(Boolean).sort();
    const gruppen = [...new Set(stundenDerSequenz.map(d => [d.classGroup, d.subject].filter(Boolean).join(' · ')).filter(Boolean))];
    const felder = felderAusSequenz(seq);
    for (const d of stundenDerSequenz) {
      if (d.titel && d.titel !== 'Stunde ohne Thema') felder.push({ name: 'Stunde', text: d.titel });
    }
    dokumente.push({
      id: `${quelle.id}:sequenz:${id}`,
      typ: TYPEN.SEQUENZ,
      titel: text(seq.name) || 'Sequenz',
      classGroup: text(stundenDerSequenz[0]?.classGroup),
      subject: text(stundenDerSequenz[0]?.subject),
      kompetenzen: [
        ...(Array.isArray(seq.competencies) ? seq.competencies : []),
        text(seq.primaryCompetency),
      ].map(text).filter(Boolean),
      gruppenText: gruppen.join(', '),
      vonISO: daten[0] || '',
      bisISO: daten[daten.length - 1] || '',
      anzahl: stundenDerSequenz.length,
      quelle,
      felder,
      ziel: { art: 'sequenz', quelleId: quelle.id, sequenceId: id },
    });
  }

  // --- Vorlagen (gehören der App, nicht dem Schuljahr) ---
  if (!archiviert) {
    for (const [id, tpl] of Object.entries(db?.sequenceTemplates || {})) {
      if (!tpl) continue;
      const einheiten = Array.isArray(tpl.lessons) ? tpl.lessons : [];
      const felder = felderAusSequenz(tpl, { einheiten });
      for (const e of einheiten) {
        for (const p of (Array.isArray(e?.phases) ? e.phases : [])) {
          const f = feld('Phase', [text(p?.title), reinerText(p?.content)].filter(Boolean).join(' · '));
          if (f) felder.push(f);
        }
      }
      dokumente.push({
        id: `vorlage:${id}`,
        typ: TYPEN.VORLAGE,
        titel: text(tpl.name) || 'Vorlage',
        classGroup: '',
        subject: text(tpl.subject),
        kompetenzen: [
          ...(Array.isArray(tpl.competencies) ? tpl.competencies : []),
          text(tpl.primaryCompetency),
        ].map(text).filter(Boolean),
        anzahl: einheiten.length,
        quelle: { id: 'bibliothek', name: 'Bibliothek', archiviert: false },
        felder,
        ziel: { art: 'vorlage', templateId: id },
      });
    }
  }

  // --- Jahresplanung ---
  for (const bar of (Array.isArray(db?.yearBars) ? db.yearBars : [])) {
    if (!bar) continue;
    const seqName = sequenzNamen.get(text(bar.sequenceId)) || '';
    const felder = [
      feld('Titel', bar.title),
      feld('Klasse', bar.classGroup),
      feld('Fach', bar.subject),
      seqName ? { name: 'Verknüpfte Sequenz', text: seqName } : null,
    ].filter(Boolean);
    if (!felder.length) continue;
    dokumente.push({
      id: `${quelle.id}:balken:${bar.id}`,
      typ: TYPEN.JAHRESPLANUNG,
      titel: text(bar.title) || 'Balken ohne Titel',
      classGroup: text(bar.classGroup),
      subject: text(bar.subject),
      kompetenzen: [],
      vonISO: text(bar.startISO),
      bisISO: text(bar.endISO),
      quelle,
      felder,
      ziel: { art: 'jahresplanung', quelleId: quelle.id, barId: bar.id, focusISO: text(bar.startISO), sequenceId: text(bar.sequenceId) },
    });
  }

  // --- To-dos ---
  for (const todo of (Array.isArray(db?.todos) ? db.todos : [])) {
    if (!todo) continue;
    const f = feld('To-do', todo.text);
    if (!f) continue;
    dokumente.push({
      id: `${quelle.id}:todo:${todo.id}`,
      typ: TYPEN.TODO,
      titel: text(todo.text),
      classGroup: '',
      subject: '',
      kompetenzen: [],
      erledigt: Boolean(todo.done),
      vonISO: text(todo.dateISO) || text(todo.deadlineISO) || text(todo.weekStartISO),
      bisISO: text(todo.deadlineISO),
      quelle,
      felder: [f],
      ziel: { art: 'todo', quelleId: quelle.id, todoId: todo.id, weekStartISO: text(todo.weekStartISO) },
    });
  }

  /* Archivierte Schuljahre. Jedes bringt seine eigene Quelle mit; die
     Dokumente sind dieselben wie oben, nur eben als "archiviert"
     gekennzeichnet. Geschrieben wird dorthin nie. */
  for (const archiv of (Array.isArray(archive) ? archive : [])) {
    if (!archiv?.id) continue;
    const abzug = (archiv.data && typeof archiv.data === 'object') ? archiv.data : {};
    const teilIndex = baueIndex(abzug, {
      quelleId: `archiv:${archiv.id}`,
      quelleName: text(archiv.label) || 'Archiviertes Schuljahr',
      archiviert: true,
    });
    for (const d of teilIndex.dokumente) {
      d.archivId = archiv.id;
      if (d.ziel) d.ziel.archivId = archiv.id;
      dokumente.push(d);
    }
  }

  /* Der vorbereitete Suchtext je Dokument. Er wird EINMAL gebildet und
     nicht bei jedem Tastendruck neu – das ist der ganze Unterschied
     zwischen "läuft flüssig" und "hakt". */
  for (const d of dokumente) {
    d.suchtext = normalisiere([
      d.titel,
      d.classGroup,
      d.subject,
      d.quelle?.name,
      ...(d.kompetenzen || []),
      ...d.felder.map(f => `${f.name} ${f.text}`),
    ].filter(Boolean).join(' \n '));
  }

  return { dokumente, gebautAm: Date.now() };
}

function kompetenzenAus(l){
  const liste = Array.isArray(l?.competencies) ? l.competencies : [];
  const primaer = text(l?.primaryCompetency);
  const alle = new Set(liste.map(text).filter(Boolean));
  if (primaer) alle.add(primaer);
  return [...alle];
}

/* ---- Suchen ------------------------------------------------------------

   Alle Begriffe müssen vorkommen (UND). Wo sie vorkommen, ist gleich –
   nur die Reihenfolge der Treffer richtet sich danach: Titel zuerst,
   dann der Rest. */
export function sucheImIndex(index, query, filter = {}){
  const begriffe = begriffeAus(query);
  const dokumente = index?.dokumente || [];
  const {
    typen = null,          // Menge erlaubter Inhaltstypen
    lerngruppe = '',       // "9b · Französisch"
    quelle = '',           // Kennung einer Quelle
    kompetenz = '',
    mitArchiv = true,
  } = filter || {};

  const treffer = [];
  for (const d of dokumente) {
    if (typen && typen.size && !typen.has(d.typ)) continue;
    if (!mitArchiv && d.quelle?.archiviert) continue;
    if (quelle && d.quelle?.id !== quelle) continue;
    if (lerngruppe) {
      const eigene = [d.classGroup, d.subject].filter(Boolean).join(' · ');
      if (normalisiere(eigene) !== normalisiere(lerngruppe)) continue;
    }
    if (kompetenz) {
      const gesucht = normalisiere(kompetenz);
      if (!(d.kompetenzen || []).some(k => normalisiere(k) === gesucht)) continue;
    }
    if (begriffe.length) {
      if (!begriffe.every(b => d.suchtext.includes(b))) continue;
    }
    treffer.push({ dokument: d, fundstelle: fundstelleFuer(d, begriffe), rang: rangVon(d, begriffe) });
  }

  treffer.sort((a, b)=> a.rang - b.rang
    || String(b.dokument.vonISO || '').localeCompare(String(a.dokument.vonISO || ''))
    || String(a.dokument.titel).localeCompare(String(b.dokument.titel), 'de'));
  return treffer;
}

function rangVon(d, begriffe){
  if (!begriffe.length) return 2;
  const titel = normalisiere(d.titel);
  if (begriffe.every(b => titel.includes(b))) return 0;
  if (begriffe.some(b => titel.includes(b))) return 1;
  return 2;
}

/* Die Fundstelle: das Feld, in dem der erste Begriff steht, und ein
   Ausschnitt daraus. Ohne Begriffe der Anfang des ersten Feldes – dann
   ist es eine Vorschau, keine Fundstelle. */
export function fundstelleFuer(d, begriffe, { laenge = 160 } = {}){
  const felder = d?.felder || [];
  if (!felder.length) return null;
  if (!begriffe?.length) {
    return { feld: felder[0].name, text: ausschnitt(felder[0].text, 0, laenge) };
  }
  for (const b of begriffe) {
    for (const f of felder) {
      const pos = normalisiere(f.text).indexOf(b);
      if (pos >= 0) return { feld: f.name, text: ausschnitt(f.text, pos, laenge) };
    }
  }
  return { feld: felder[0].name, text: ausschnitt(felder[0].text, 0, laenge) };
}

/* Ein Ausschnitt um eine Fundstelle herum.

   Die Position stammt aus dem normalisierten Text. Weil die
   Normalisierung nur Zeichen ERSETZT und nicht entfernt – ausser bei ß,
   das zu zwei Zeichen wird –, stimmt sie nahe genug; der Ausschnitt
   beginnt ohnehin ein Stück davor. Es geht um Lesbarkeit, nicht um
   Zeichengenauigkeit. */
function ausschnitt(str, pos, laenge){
  const s = String(str || '');
  if (s.length <= laenge) return s;
  const start = Math.max(0, pos - Math.floor(laenge / 3));
  const ende = Math.min(s.length, start + laenge);
  return `${start > 0 ? '…' : ''}${s.slice(start, ende).trim()}${ende < s.length ? '…' : ''}`;
}

/* ---- Hervorhebung ------------------------------------------------------

   Zerlegt einen Text in Stücke: `{ text, treffer }`. Die Oberfläche
   macht daraus <mark>-Elemente und gewöhnlichen Text.

   Bewusst KEIN HTML: es wird nie eine Zeichenkette mit Markup gebaut
   und nie irgendwo eingesetzt. Ein Suchbegriff wie "<script>" ist damit
   genau das – ein Suchbegriff, der nichts findet. */
export function teileNachTreffern(str, begriffe){
  const s = String(str ?? '');
  const liste = (Array.isArray(begriffe) ? begriffe : []).filter(Boolean);
  if (!s || !liste.length) return s ? [{ text: s, treffer: false }] : [];

  /* Verglichen wird auf dem normalisierten Text, ausgegeben der
     ursprüngliche. Das geht, weil die Normalisierung zeichenweise
     arbeitet – für jedes Zeichen des Originals wird notiert, wo seine
     normalisierte Entsprechung beginnt. */
  let norm = '';
  const abbildung = [];        // Position in `norm` -> Position in `s`
  for (let i = 0; i < s.length; i++) {
    const stueck = normalisiere(s[i]);
    for (let k = 0; k < stueck.length; k++) abbildung.push(i);
    norm += stueck;
  }

  const marken = new Array(s.length).fill(false);
  for (const b of liste) {
    let ab = 0;
    for (;;) {
      const pos = norm.indexOf(b, ab);
      if (pos < 0) break;
      const von = abbildung[pos];
      const bis = (pos + b.length - 1 < abbildung.length) ? abbildung[pos + b.length - 1] : s.length - 1;
      for (let i = von; i <= bis && i < s.length; i++) marken[i] = true;
      ab = pos + Math.max(1, b.length);
    }
  }

  const teile = [];
  let aktuell = '';
  let istTreffer = marken[0] === true;
  for (let i = 0; i < s.length; i++) {
    if (marken[i] === istTreffer) { aktuell += s[i]; continue; }
    if (aktuell) teile.push({ text: aktuell, treffer: istTreffer });
    aktuell = s[i];
    istTreffer = marken[i];
  }
  if (aktuell) teile.push({ text: aktuell, treffer: istTreffer });
  return teile;
}

/* ---- Gruppierung und Filterwerte --------------------------------------- */
export function gruppiereTreffer(treffer){
  const gruppen = new Map();
  for (const t of (Array.isArray(treffer) ? treffer : [])) {
    const typ = t.dokument.typ;
    if (!gruppen.has(typ)) gruppen.set(typ, []);
    gruppen.get(typ).push(t);
  }
  return TYP_REIHENFOLGE
    .filter(typ => gruppen.has(typ))
    .map(typ => ({ typ, name: TYP_NAMEN[typ], treffer: gruppen.get(typ) }));
}

/* Woraus die Filterlisten bestehen. Alles daraus kommt aus dem Index –
   es wird nichts angeboten, wozu es nichts gäbe. */
export function filterWerte(index){
  const lerngruppen = new Set();
  const quellen = new Map();
  const kompetenzen = new Set();
  for (const d of (index?.dokumente || [])) {
    const g = [d.classGroup, d.subject].filter(Boolean).join(' · ');
    if (g) lerngruppen.add(g);
    if (d.quelle?.id) quellen.set(d.quelle.id, d.quelle);
    for (const k of (d.kompetenzen || [])) if (k) kompetenzen.add(k);
  }
  return {
    lerngruppen: [...lerngruppen].sort((a, b)=> a.localeCompare(b, 'de')),
    quellen: [...quellen.values()],
    kompetenzen: [...kompetenzen].sort((a, b)=> a.localeCompare(b, 'de')),
  };
}
