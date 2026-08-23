/* ============================================================
   Fachdidaktische Planung im Fremdsprachenmodus

   Fünf Bausteine, die zusammen eine Kette abbilden: vom Lernziel über
   das kommunikative Handeln und die sprachlichen Mittel bis zur
   Unterstützung in den einzelnen Phasen – und über eine Sequenz hinweg
   bis zur Zielaufgabe.

   Die Kette ist ein fachliches Leitbild, kein technischer Zwang. Jedes
   Feld ist einzeln benutzbar und jedes darf leer bleiben. Wer nur Thema,
   Lernziel und Phasen einträgt, merkt von alledem nichts.

   ZWEI ENTSCHEIDUNGEN, die den Rest tragen:

   1. Sprechabsichten sind Etiketten – genau wie Kompetenzen. Damit gilt
      dasselbe wie dort: die Bezeichnung IST die Identität, eigene
      Einträge liegen in der vorhandenen Merk-Ablage (db.speechActs),
      und eine Stunde verliert nichts, wenn ein Eintrag später aus der
      Auswahl genommen wird.

   2. Alles Neue ist ein optionales Feld neben den bestehenden. Es gibt
      keine Umschreibung vorhandener Stunden. Eine Stunde ohne diese
      Felder ist eine gültige Stunde – gestern wie heute.
   ============================================================ */

/* ---- Sprechabsichten -------------------------------------------------
   Ein Startbestand, ausdrücklich kein abgeschlossener Katalog. Die
   Formulierungen sind sprachneutral: sie beschreiben die Handlung, nicht
   ihre Realisierung in einer bestimmten Sprache. */
export const SPRECHABSICHTEN = [
  'begrüßen',
  'sich vorstellen',
  'Informationen erfragen',
  'nachfragen',
  'etwas beschreiben',
  'erzählen',
  'vergleichen',
  'begründen',
  'Meinung äußern',
  'zustimmen',
  'widersprechen',
  'Vorschläge machen',
  'auf Vorschläge reagieren',
  'ablehnen',
  'Kompromiss finden',
  'überzeugen',
  'argumentieren',
  'Vermutungen äußern',
  'Gefühle ausdrücken',
  'Wünsche äußern',
  'Ratschläge geben',
  'erklären',
  'zusammenfassen',
  'präsentieren',
  'Gespräch eröffnen',
  'Gespräch aufrechterhalten',
  'Gespräch beenden',
];

const SPRECHABSICHT_SET = new Set(SPRECHABSICHTEN);

export function istSystemSprechabsicht(label){
  return SPRECHABSICHT_SET.has(String(label ?? '').trim());
}

/* ---- Scaffolds ------------------------------------------------------- */
export const SCAFFOLD_ARTEN = [
  { id: 'linguistic',     name: 'Sprachlich',      beispiel: 'Redemittel, Satzanfänge, Modelldialog' },
  { id: 'content',        name: 'Inhaltlich',      beispiel: 'Leitfragen, Bildimpuls, Informationskarte' },
  { id: 'strategic',      name: 'Strategisch',     beispiel: 'Lesestrategie, Checkliste, Arbeitsschritte' },
  { id: 'organizational', name: 'Organisatorisch', beispiel: 'Rollen, Partnerzuordnung, mehr Zeit' },
  { id: 'other',          name: 'Sonstiges',       beispiel: '' },
];
const SCAFFOLD_ART_IDS = new Set(SCAFFOLD_ARTEN.map(a => a.id));
export const SCAFFOLD_ART_STANDARD = 'linguistic';

export function scaffoldArtName(id){
  return SCAFFOLD_ARTEN.find(a => a.id === id)?.name || 'Sonstiges';
}

/* Häufige Bezeichnungen als Startvorschläge. Sie ersparen das Tippen,
   schreiben aber nichts vor – das Feld bleibt frei. */
export const SCAFFOLD_VORSCHLAEGE = [
  'Redemittel', 'Satzanfänge', 'Wortschatzhilfe', 'Formulierungshilfe',
  'Modelldialog', 'Modelltext', 'Strukturhilfe',
  'Leitfragen', 'Zusätzliche Information', 'Bildimpuls', 'Visualisierung', 'Informationskarte',
  'Lesestrategie', 'Hörstrategie', 'Planungshilfe', 'Checkliste', 'Gesprächsstrategie', 'Arbeitsschritte',
  'Partnerzuordnung', 'Rollen', 'Zusätzliche Bearbeitungszeit', 'Teilaufgabe',
];

/* Das Unterstützungsniveau ist freiwillig. Es beschreibt, was die
   Lehrkraft geplant hat – die App leitet daraus nichts ab und bewertet
   es nicht. Ohne Angabe bleibt die Spalte in der Progression leer. */
export const UNTERSTUETZUNGSSTUFEN = [
  { id: 'high',   name: 'stark' },
  { id: 'medium', name: 'mittel' },
  { id: 'low',    name: 'gering' },
];
const STUFEN_IDS = new Set(UNTERSTUETZUNGSSTUFEN.map(s => s.id));

export function stufenName(id){
  return UNTERSTUETZUNGSSTUFEN.find(s => s.id === id)?.name || '';
}

/* ---- Normalisierung --------------------------------------------------
   Jede Funktion nimmt beliebigen Müll entgegen und liefert eine gültige,
   leere Form. Dadurch ist die Migration nichts weiter als ein Aufruf:
   fehlt das Feld, entsteht die leere Form; ist es schon da, bleibt es.
   Zweimal aufgerufen ändert sich nichts mehr. */

function text(x){ return String(x ?? '').trim(); }

/* Erfolgskriterien: eine schlichte Liste von Sätzen. Bewusst KEINE
   Objekte mit id – die Reihenfolge ist die Identität, wie bei den
   Kompetenzen das Etikett. Das erspart Migration und IDs beim Kopieren. */
export function normalisiereErfolgskriterien(raw){
  if (!Array.isArray(raw)) return [];
  return raw.map(text).filter(Boolean);
}

export function normalisiereAufgabe(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  return {
    text: text(o.text),
    situation: text(o.situation),
    audience: text(o.audience),
    intention: text(o.intention),
    outcome: text(o.outcome),
  };
}

export function istLeereAufgabe(a){
  const o = normalisiereAufgabe(a);
  return !o.text && !o.situation && !o.audience && !o.intention && !o.outcome;
}

/* Nur die vier Detailfelder – für die Frage, ob der Details-Bereich
   aufgeklappt starten soll. */
export function hatAufgabenDetails(a){
  const o = normalisiereAufgabe(a);
  return Boolean(o.situation || o.audience || o.intention || o.outcome);
}

export function normalisiereMittel(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  return {
    vocabulary: text(o.vocabulary),
    grammar: text(o.grammar),
    pronunciation: text(o.pronunciation),
    other: text(o.other),
  };
}

export function istLeereMittel(m){
  const o = normalisiereMittel(m);
  return !o.vocabulary && !o.grammar && !o.pronunciation && !o.other;
}

export function normalisiereSprechabsichten(raw){
  if (!Array.isArray(raw)) return [];
  // Set-Semantik wie bei den Kompetenzen: zweimal dasselbe gibt es nicht.
  return [...new Set(raw.map(text).filter(Boolean))];
}

/* Eine Hilfe ohne Bezeichnung und ohne Notiz sagt nichts aus. Sie wird
   trotzdem NICHT verworfen: genau so sieht eine gerade angelegte Zeile
   aus, in die noch niemand geschrieben hat. Würde die Normalisierung
   sie wegwerfen, verschwände die Zeile im selben Augenblick wieder, in
   dem man sie anlegt. Verborgen wird sie stattdessen dort, wo sie
   stören würde – beim Zählen, in der Progression und im Export. */
export function istLeererScaffold(sc){
  return !text(sc?.label) && !text(sc?.note);
}

export function normalisiereScaffolds(raw, neueId){
  if (!Array.isArray(raw)) return [];
  return raw.map((s)=>{
    const o = (s && typeof s === 'object') ? s : null;
    if (!o) return null;
    const label = text(o.label);
    const note = text(o.note);
    return {
      id: text(o.id) || (typeof neueId === 'function' ? neueId() : `sc-${Math.random().toString(16).slice(2)}`),
      type: SCAFFOLD_ART_IDS.has(o.type) ? o.type : SCAFFOLD_ART_STANDARD,
      label,
      note,
      supportLevel: STUFEN_IDS.has(o.supportLevel) ? o.supportLevel : '',
      fadeOut: Boolean(o.fadeOut),
    };
  }).filter(Boolean);
}

/* Alle ausgefüllten Hilfen einer Stunde, über die Phasen hinweg. Leere
   Zeilen bleiben aussen vor – siehe istLeererScaffold. */
export function scaffoldsDerStunde(lesson){
  const phasen = Array.isArray(lesson?.phases) ? lesson.phases : [];
  return phasen
    .flatMap(p => Array.isArray(p?.scaffolds) ? p.scaffolds : [])
    .filter(sc => !istLeererScaffold(sc));
}

/* Eine Stunde trägt fachdidaktische Angaben, wenn irgendetwas davon
   ausgefüllt ist. Entscheidet, ob ein Export-Block überhaupt erscheint. */
export function hatFachdidaktik(lesson){
  return Boolean(
    !istLeereAufgabe(lesson?.communicativeTask)
    || normalisiereSprechabsichten(lesson?.speechActs).length
    || !istLeereMittel(lesson?.languageResources)
    || scaffoldsDerStunde(lesson).length
  );
}

/* ---- Sequenzprogression ----------------------------------------------
   Reine Ableitung aus dem, was in den Stunden bereits steht. Es wird
   nichts doppelt eingegeben und nichts gespeichert – ausser der freien
   Notiz, die in der Stunde selbst liegt.

   Die Ansicht beschreibt und bewertet nicht: keine Reihenfolgeprüfung,
   kein Hinweis auf angeblich fehlende Progression, keine Ampel. Ob sich
   die Sequenz sinnvoll entwickelt, entscheidet die Lehrkraft.

   `stunden` sind die Vorkommen der Sequenz in zeitlicher Reihenfolge,
   wie sie sequenceOccurrences() liefert. */
export function sequenzProgression(stunden){
  return (Array.isArray(stunden) ? stunden : []).map((o, i)=>{
    const l = o?.lesson || {};
    const aufgabe = normalisiereAufgabe(l.communicativeTask);
    const mittel = normalisiereMittel(l.languageResources);
    const scaffolds = scaffoldsDerStunde(l);

    /* Das Unterstützungsniveau steht nur, wenn die Lehrkraft es selbst
       hinterlegt hat – und nur, wenn sich die Hilfen einig sind. Aus
       unterschiedlichen Angaben einen Mittelwert zu bilden hiesse, eine
       Aussage zu erfinden, die niemand getroffen hat. */
    const stufen = [...new Set(scaffolds.map(s => s.supportLevel).filter(Boolean))];
    const stufe = stufen.length === 1 ? stufen[0] : '';

    return {
      key: `${o.weekStart}#${o.dayIndex}-${o.slotIndex}`,
      nummer: i + 1,
      dateISO: o.dateISO || '',
      weekStart: o.weekStart,
      dayIndex: o.dayIndex,
      slotIndex: o.slotIndex,
      topic: text(l.topic),
      /* Die Sprachhandlung ist die kommunikative Aufgabe; ohne sie tritt
         das Stundenthema an ihre Stelle, damit die Zeile nicht leer bleibt. */
      sprachhandlung: aufgabe.text || text(l.topic),
      ausAufgabe: Boolean(aufgabe.text),
      kompetenzPrimaer: text(l.primaryCompetency),
      kompetenzen: Array.isArray(l.competencies) ? l.competencies.map(text).filter(Boolean) : [],
      sprechabsichten: normalisiereSprechabsichten(l.speechActs),
      mittel: [mittel.vocabulary, mittel.grammar, mittel.pronunciation, mittel.other].filter(Boolean),
      scaffolds,
      stufe,
      notiz: text(l.progressionNote),
    };
  });
}
