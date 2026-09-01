/* ============================================================
   Lokaler Versionsverlauf

   Das Rückgängig (Strg+Z) nimmt zurück, was gerade eben geschah. Es
   liegt im Arbeitsspeicher, zählt zehn Schritte und ist nach einem
   Neustart weg. Für "die Fassung von vorletzter Woche" taugt es nicht.

   Der Versionsverlauf ergänzt es um genau das: wenige, gut gewählte
   Wiederherstellungspunkte, die den Neustart überleben. Er ersetzt das
   Rückgängig nicht und tastet es nicht an.

   In dieser Datei steht nur, was sich ohne Oberfläche und ohne Ablage
   entscheiden lässt – deshalb ist sie prüfbar:

     - wie ein Eintrag aussieht,
     - wann zwei Einträge zu einem gebündelt werden,
     - was die Aufbewahrung übrigläßt,
     - was eine Wiederherstellung an den Daten ändert.

   Wo die Einträge liegen, steht in verlauf-speicher.js und in den
   Plattformadaptern. Bewusst getrennt von der Unterrichtsdatenbank:
   ein Backup soll die Planung enthalten, nicht deren Geschichte.

   Grundsätze, die hier eingehalten werden:

     - Es wird NIE eine Binärkopie einer angehängten Datei gespeichert.
       Von Dateien bleiben Name, Verweis und Vermerk – mehr nicht.
     - Ein Eintrag beschreibt den Stand VOR einer Änderung. Wer ihn
       wiederherstellt, bekommt genau diesen Stand zurück.
     - Eine Sammelaktion ist ein Eintrag mit mehreren Teilen. Sie wird
       vollständig oder gar nicht wiederhergestellt.
   ============================================================ */

/* ---- Anlässe ---------------------------------------------------------

   Der Anlass steht im Eintrag als Kennung und wird erst beim Anzeigen
   zu Text. So bleibt ein alter Eintrag lesbar, auch wenn die Formulierung
   sich später ändert. */
export const AUSLOESER = {
  bearbeitet:        'nach dem Bearbeiten',
  vorLoeschen:       'vor dem Löschen',
  vorImport:         'vor dem Ersetzen durch einen Import',
  vorVerschieben:    'vor dem Verschieben',
  vorStruktur:       'vor einer strukturellen Änderung',
  vorWiederherstellen: 'vor einer Wiederherstellung',
  vorBalken:         'vor einer Änderung am verknüpften Jahresbalken',
};

export function ausloeserName(id){
  return AUSLOESER[String(id || '')] || 'gespeicherter Stand';
}

/* ---- Bereiche -------------------------------------------------------- */
export const BEREICHE = {
  lesson:   'Stunde',
  sequence: 'Sequenz',
  template: 'Vorlage',
  yearBar:  'Jahresbalken',
  bulk:     'Sammelaktion',
};

export function bereichName(id){
  return BEREICHE[String(id || '')] || 'Planung';
}

/* ---- Grenzen der Aufbewahrung ---------------------------------------

   Der Verlauf ist eine Sicherheitsleine, kein Archiv. Er darf deshalb
   nicht unbegrenzt wachsen: drei Grenzen greifen nacheinander, und was
   sie übriglassen, bleibt. Angetastet wird dabei ausschliesslich die
   Liste der Einträge – die Unterrichtsdaten sieht diese Datei beim
   Bereinigen gar nicht. */
export const MAX_TAGE = 30;
export const MAX_JE_ZIEL = 20;
export const MAX_GESAMT = 400;
/* Grob gerechnet: die serialisierte Länge aller Einträge. Kein exaktes
   Speichermass, aber eine verlässliche Obergrenze in derselben
   Grössenordnung. */
export const MAX_ZEICHEN = 4 * 1024 * 1024;

/* Wie lange mehrere Änderungen desselben Ziels zu EINEM Eintrag
   verschmelzen. Wer eine Stunde dreimal hintereinander öffnet und
   ändert, will nicht drei Fassungen aus derselben Viertelstunde. */
export const BUENDEL_MS = 5 * 60 * 1000;

/* ---- Kennungen ------------------------------------------------------- */

function standardId(){
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/* Der stabile Schlüssel einer Stunde im Verlauf: ihr Platz. Nicht ihr
   Inhalt – der ändert sich ja gerade. */
export function stundenZiel({ weekStart, dayIndex, slotIndex } = {}){
  return `stunde:${String(weekStart || '')}:${Number(dayIndex) || 0}:${Number(slotIndex) || 0}`;
}

export function sequenzZiel(id){ return `sequenz:${String(id || '')}`; }
export function vorlagenZiel(id){ return `vorlage:${String(id || '')}`; }
export function balkenZiel(id){ return `balken:${String(id || '')}`; }

/* ---- Keine Binärkopien ----------------------------------------------

   Angehängte Dateien liegen als Verweis in der Stunde: Name, Pfad,
   Vermerk. Genau das wandert in den Verlauf. Was wie eingebettete
   Binärdaten aussieht, wird entfernt – auch dann, wenn es über einen
   Import in die Daten geraten sein sollte.

   Zwei Wege dorthin, beide bewusst grob:

     - Felder, deren Name Binärinhalt ankündigt (data, blob, bytes …).
       "content" gehört ausdrücklich NICHT dazu: das ist der
       Phaseninhalt, also Text.
     - Zeichenketten, die als data:-URL beginnen und länger sind als
       ein Verweis je wäre. */
const BINAER_FELDER = new Set([
  'data', 'blob', 'bytes', 'base64', 'dataUrl', 'dataURL', 'buffer',
  'arrayBuffer', 'binary', 'fileData', 'thumbnail', 'preview',
]);

const DATA_URL_GRENZE = 256;

export function ohneBinaerdaten(wert){
  if (Array.isArray(wert)) return wert.map(ohneBinaerdaten);
  if (wert && typeof wert === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(wert)) {
      if (BINAER_FELDER.has(k)) continue;
      out[k] = ohneBinaerdaten(v);
    }
    return out;
  }
  if (typeof wert === 'string' && wert.length > DATA_URL_GRENZE && /^data:/i.test(wert.trim())) return '';
  return wert;
}

/* Eine Kopie, die nichts mit den Originaldaten mehr teilt. Der Verlauf
   darf sich nie ändern, nur weil die Planung sich ändert. */
function kopie(wert){
  if (wert === undefined || wert === null) return null;
  return JSON.parse(JSON.stringify(wert));
}

/* ---- Teile eines Eintrags -------------------------------------------

   Ein Eintrag besteht aus Teilen. Ein Teil sagt: DIESER Ort trug DIESEN
   Stand. `wert: null` heisst "hier war nichts" – das ist kein Fehler,
   sondern die einzige Art, das Anlegen einer Stunde rückgängig zu
   machen.

   Vier Orte gibt es, mehr braucht es nicht: ein Stundenplatz, eine
   Sequenz, eine Vorlage, ein Jahresbalken. */
export function stundenTeil({ weekStart, dayIndex, slotIndex, stunde }){
  return {
    art: 'stunde',
    weekStart: String(weekStart || ''),
    dayIndex: Number(dayIndex) || 0,
    slotIndex: Number(slotIndex) || 0,
    wert: stunde ? ohneBinaerdaten(kopie(stunde)) : null,
  };
}

export function sequenzTeil(id, sequenz){
  return { art: 'sequenz', id: String(id || ''), wert: sequenz ? ohneBinaerdaten(kopie(sequenz)) : null };
}

export function vorlagenTeil(id, vorlage){
  return { art: 'vorlage', id: String(id || ''), wert: vorlage ? ohneBinaerdaten(kopie(vorlage)) : null };
}

export function balkenTeil(id, balken){
  return { art: 'balken', id: String(id || ''), wert: balken ? ohneBinaerdaten(kopie(balken)) : null };
}

/* ---- Geänderte Felder -----------------------------------------------

   Die Zusammenfassung im Verlauf soll in einem Blick sagen, worum es
   ging: "Thema, Phasen, Hausaufgaben". Verglichen wird der Stand vorher
   mit dem Stand nachher – beides Stunden, beides ohne Kennungen und
   Zeitstempel, die sich ohnehin bei jeder Speicherung ändern. */
const STUNDEN_FELDER = [
  ['topic', 'Thema'],
  ['objectives', 'Lernziele'],
  ['subject', 'Fach'],
  ['classGroup', 'Klasse/Kurs'],
  ['room', 'Raum'],
  ['homework', 'Hausaufgaben'],
  ['notes', 'Notizen'],
  ['sequenceId', 'Sequenz'],
  ['primaryCompetency', 'Schwerpunktkompetenz'],
  ['competencies', 'Kompetenzen'],
  ['phases', 'Phasen'],
  ['files', 'Dateien'],
  ['links', 'Links'],
  ['successCriteria', 'Erfolgskriterien'],
  ['communicativeTask', 'Kommunikative Aufgabe'],
  ['speechActs', 'Sprechabsichten'],
  ['languageResources', 'Sprachliche Mittel'],
  ['progressionNote', 'Progressionsnotiz'],
  ['review', 'Nachbereitung'],
  ['blockSpan', 'Doppelstunde'],
];

function gleich(a, b){
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function geaenderteFelder(vorher, nachher){
  const a = (vorher && typeof vorher === 'object') ? vorher : {};
  const b = (nachher && typeof nachher === 'object') ? nachher : {};
  const out = [];
  for (const [key, label] of STUNDEN_FELDER) {
    if (!gleich(a[key], b[key])) out.push(label);
  }
  return out;
}

/* ---- Einen Eintrag anlegen ------------------------------------------- */
export function erstelleEintrag({
  ausloeser = 'bearbeitet',
  bereich = 'lesson',
  zielId = '',
  zielLabel = '',
  felder = [],
  teile = [],
  transaktion = '',
  notiz = '',
} = {}, { jetzt = new Date().toISOString(), neueId = standardId } = {}){
  const liste = (Array.isArray(teile) ? teile : []).filter(t => t && typeof t === 'object');
  return {
    id: neueId(),
    at: jetzt,
    /* Wann zuletzt etwas dazugebündelt wurde. Der Stand selbst ist der
       von `at` – das hier sagt nur, bis wann er "frisch" war. */
    aktualisiertAm: jetzt,
    ausloeser: String(ausloeser || 'bearbeitet'),
    bereich: String(bereich || 'lesson'),
    zielId: String(zielId || ''),
    zielLabel: String(zielLabel || ''),
    felder: [...new Set((Array.isArray(felder) ? felder : []).map(f => String(f || '')).filter(Boolean))],
    teile: liste,
    transaktion: String(transaktion || ''),
    notiz: String(notiz || ''),
  };
}

/* ---- Bündeln ---------------------------------------------------------

   Zwei Einträge gehören zusammen, wenn sie dasselbe Ziel aus demselben
   Anlass betreffen und zeitlich dicht beieinanderliegen.

   Behalten wird dann der ÄLTERE Stand. Das ist der ganze Sinn: wer
   dreimal an derselben Stunde gearbeitet hat, will zurück zu dem, was
   davor war – nicht zum Zwischenstand von vor zwei Minuten. Die
   geänderten Felder werden zusammengeführt, damit die Zusammenfassung
   trotzdem vollständig bleibt.

   Sammelaktionen (mit Transaktionskennung) werden NIE gebündelt: sie
   sind ein abgeschlossener Vorgang und müssen als solcher zurückholbar
   bleiben. */
export function fuegeEin(liste, eintrag, { buendelMs = BUENDEL_MS } = {}){
  const arr = Array.isArray(liste) ? [...liste] : [];
  if (!eintrag || typeof eintrag !== 'object') return arr;
  if (!eintrag.transaktion) {
    const idx = arr.findIndex(e => e
      && !e.transaktion
      && e.bereich === eintrag.bereich
      && e.zielId === eintrag.zielId
      && e.ausloeser === eintrag.ausloeser
      && Math.abs(new Date(eintrag.at).getTime() - new Date(e.aktualisiertAm || e.at).getTime()) <= buendelMs);
    if (idx >= 0) {
      const alt = arr[idx];
      arr[idx] = {
        ...alt,
        aktualisiertAm: eintrag.at,
        zielLabel: eintrag.zielLabel || alt.zielLabel,
        felder: [...new Set([...(alt.felder || []), ...(eintrag.felder || [])])],
      };
      return arr;
    }
  }
  arr.push(eintrag);
  return arr;
}

/* ---- Aufbewahrung ----------------------------------------------------

   Die Reihenfolge ist Absicht: erst das Alter, dann die Menge je Ziel,
   dann die Gesamtmenge, zuletzt der Platz. Jede Stufe entfernt nur
   Einträge – Unterrichtsdaten kommen hier nicht vor.

   Bei Sammelaktionen zählt die Transaktion als EIN Vorgang: entweder
   bleiben alle ihre Einträge oder keiner. Sonst liesse sich eine
   Sammelverschiebung nur zur Hälfte zurücknehmen, und das wäre
   schlimmer als sie gar nicht anzubieten. */
export function bereinige(liste, {
  jetzt = Date.now(),
  maxTage = MAX_TAGE,
  maxJeZiel = MAX_JE_ZIEL,
  maxGesamt = MAX_GESAMT,
  maxZeichen = MAX_ZEICHEN,
} = {}){
  const arr = (Array.isArray(liste) ? liste : []).filter(e => e && typeof e === 'object' && e.id);
  const zeit = (e)=> {
    const t = new Date(e.aktualisiertAm || e.at || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  // Neueste zuerst – so ist "die ersten n behalten" immer das Richtige.
  const sortiert = [...arr].sort((a, b)=> zeit(b) - zeit(a));

  const grenze = jetzt - Math.max(0, maxTage) * 86400000;
  const jung = sortiert.filter(e => zeit(e) >= grenze);

  const proZiel = new Map();
  const nachZiel = [];
  for (const e of jung) {
    const schluessel = `${e.bereich}|${e.zielId}`;
    const n = (proZiel.get(schluessel) || 0) + 1;
    proZiel.set(schluessel, n);
    if (n <= Math.max(1, maxJeZiel)) nachZiel.push(e);
  }

  const begrenzt = nachZiel.slice(0, Math.max(1, maxGesamt));

  let zeichen = 0;
  const behalten = [];
  for (const e of begrenzt) {
    zeichen += JSON.stringify(e).length;
    if (zeichen > maxZeichen && behalten.length) break;
    behalten.push(e);
  }

  /* Angebrochene Sammelaktionen wieder auffüllen oder ganz verwerfen.
     Geprüft wird gegen die Einträge, die die Zeitgrenze überlebt haben:
     was älter als 30 Tage ist, geht auch als Teil einer Transaktion. */
  const ganz = new Set(behalten.map(e => e.transaktion).filter(Boolean));
  const ergaenzt = [...behalten];
  const bekannt = new Set(behalten.map(e => e.id));
  for (const e of jung) {
    if (!e.transaktion || bekannt.has(e.id)) continue;
    if (!ganz.has(e.transaktion)) continue;
    ergaenzt.push(e);
    bekannt.add(e.id);
  }

  // Wieder in die gewohnte Reihenfolge: neueste zuerst.
  return ergaenzt.sort((a, b)=> zeit(b) - zeit(a));
}

/* ---- Auswahl für eine Ansicht ---------------------------------------

   Gefragt wird immer aus der Sicht einer Sache: "Was gab es zu dieser
   Stunde?" Sammelaktionen zählen dazu, sobald sie diese Stunde berühren
   – sonst fehlte der wichtigste Eintrag genau dort, wo man ihn sucht. */
export function betrifft(eintrag, { bereich, zielId } = {}){
  if (!eintrag) return false;
  if (eintrag.bereich === bereich && eintrag.zielId === zielId) return true;
  if (!zielId) return false;
  for (const teil of (eintrag.teile || [])) {
    if (teilZiel(teil) === zielId) return true;
  }
  return false;
}

export function teilZiel(teil){
  if (!teil || typeof teil !== 'object') return '';
  if (teil.art === 'stunde') return stundenZiel(teil);
  if (teil.art === 'sequenz') return sequenzZiel(teil.id);
  if (teil.art === 'vorlage') return vorlagenZiel(teil.id);
  if (teil.art === 'balken') return balkenZiel(teil.id);
  return '';
}

export function eintraegeFuer(liste, { bereich, zielId } = {}){
  return (Array.isArray(liste) ? liste : []).filter(e => betrifft(e, { bereich, zielId }));
}

/* ---- Zusammenfassung ------------------------------------------------- */
export function zusammenfassung(eintrag){
  const felder = Array.isArray(eintrag?.felder) ? eintrag.felder : [];
  if (felder.length) return felder.join(', ');
  const teile = Array.isArray(eintrag?.teile) ? eintrag.teile : [];
  if (teile.length > 1) return `${teile.length} betroffene Einträge`;
  return 'Vollständiger Stand';
}

/* ---- Wiederherstellen -----------------------------------------------

   Angewendet werden alle Teile eines Eintrags auf einmal. `wert: null`
   entfernt, alles andere setzt. Die Funktion arbeitet auf einer Kopie
   und gibt eine neue Datenbank zurück – sie ändert nichts an dem, was
   ihr übergeben wurde.

   Was hier NICHT passiert: es wird nichts zusammengeführt, nichts
   geraten und nichts nachgezogen. Eine Wiederherstellung setzt genau
   den gespeicherten Stand, nicht mehr. */
export function wendeAn(db, eintrag){
  const next = kopie(db) || {};
  if (!next.weeks || typeof next.weeks !== 'object') next.weeks = {};
  if (!next.sequences || typeof next.sequences !== 'object') next.sequences = {};
  if (!next.sequenceTemplates || typeof next.sequenceTemplates !== 'object') next.sequenceTemplates = {};
  if (!Array.isArray(next.yearBars)) next.yearBars = [];

  for (const teil of (eintrag?.teile || [])) {
    if (!teil || typeof teil !== 'object') continue;
    if (teil.art === 'stunde') {
      const ws = String(teil.weekStart || '');
      if (!ws) continue;
      const woche = next.weeks[ws] || { slotsPerDay: 6, lessons: {}, duties: {} };
      if (!woche.lessons || typeof woche.lessons !== 'object') woche.lessons = {};
      const key = `${Number(teil.dayIndex) || 0}-${Number(teil.slotIndex) || 0}`;
      if (teil.wert) woche.lessons[key] = kopie(teil.wert);
      else delete woche.lessons[key];
      next.weeks[ws] = woche;
      continue;
    }
    if (teil.art === 'sequenz') {
      const id = String(teil.id || '');
      if (!id) continue;
      if (teil.wert) next.sequences[id] = kopie(teil.wert);
      else delete next.sequences[id];
      continue;
    }
    if (teil.art === 'vorlage') {
      const id = String(teil.id || '');
      if (!id) continue;
      if (teil.wert) next.sequenceTemplates[id] = kopie(teil.wert);
      else delete next.sequenceTemplates[id];
      continue;
    }
    if (teil.art === 'balken') {
      const id = String(teil.id || '');
      if (!id) continue;
      const idx = next.yearBars.findIndex(b => b?.id === id);
      if (teil.wert) {
        if (idx >= 0) next.yearBars[idx] = kopie(teil.wert);
        else next.yearBars.push(kopie(teil.wert));
      } else if (idx >= 0) {
        next.yearBars.splice(idx, 1);
      }
      continue;
    }
  }
  return next;
}

/* ---- Der Stand, der gerade gilt --------------------------------------

   Vor jeder Wiederherstellung wird er selbst als Eintrag gesichert.
   Deshalb braucht es zu einem Eintrag den passenden Gegen-Eintrag: die
   gleichen Orte, aber mit dem, was dort JETZT steht. */
export function aktuellerStand(db, eintrag){
  const teile = [];
  for (const teil of (eintrag?.teile || [])) {
    if (!teil || typeof teil !== 'object') continue;
    if (teil.art === 'stunde') {
      const key = `${Number(teil.dayIndex) || 0}-${Number(teil.slotIndex) || 0}`;
      const jetzt = db?.weeks?.[teil.weekStart]?.lessons?.[key] || null;
      teile.push(stundenTeil({
        weekStart: teil.weekStart, dayIndex: teil.dayIndex, slotIndex: teil.slotIndex, stunde: jetzt,
      }));
      continue;
    }
    if (teil.art === 'sequenz') { teile.push(sequenzTeil(teil.id, db?.sequences?.[teil.id] || null)); continue; }
    if (teil.art === 'vorlage') { teile.push(vorlagenTeil(teil.id, db?.sequenceTemplates?.[teil.id] || null)); continue; }
    if (teil.art === 'balken') {
      const bar = (Array.isArray(db?.yearBars) ? db.yearBars : []).find(b => b?.id === teil.id) || null;
      teile.push(balkenTeil(teil.id, bar));
      continue;
    }
  }
  return teile;
}

/* ---- Vorschau --------------------------------------------------------

   Vor dem Wiederherstellen soll dastehen, was geschieht – Zeile für
   Zeile, in derselben Sprache wie die Oberfläche. Bewertet wird nichts:
   die Vorschau sagt, was ersetzt, angelegt oder entfernt wird. */
function stundenBeschreibung(l){
  if (!l) return 'nicht vorhanden';
  const thema = String(l.topic || '').trim();
  const gruppe = [String(l.classGroup || '').trim(), String(l.subject || '').trim()].filter(Boolean).join(' · ');
  return [thema || 'ohne Thema', gruppe].filter(Boolean).join(' — ');
}

function nameBeschreibung(o){
  if (!o) return 'nicht vorhanden';
  return String(o.name || o.title || '').trim() || 'ohne Namen';
}

export function vorschau(db, eintrag){
  const zeilen = [];
  for (const teil of (eintrag?.teile || [])) {
    if (!teil || typeof teil !== 'object') continue;
    let jetzt = null;
    let ort = '';
    if (teil.art === 'stunde') {
      const key = `${Number(teil.dayIndex) || 0}-${Number(teil.slotIndex) || 0}`;
      jetzt = db?.weeks?.[teil.weekStart]?.lessons?.[key] || null;
      ort = `${teil.weekStart} · Tag ${Number(teil.dayIndex) + 1} · ${Number(teil.slotIndex) + 1}. Stunde`;
    } else if (teil.art === 'sequenz') {
      jetzt = db?.sequences?.[teil.id] || null;
      ort = 'Sequenz';
    } else if (teil.art === 'vorlage') {
      jetzt = db?.sequenceTemplates?.[teil.id] || null;
      ort = 'Vorlage';
    } else if (teil.art === 'balken') {
      jetzt = (Array.isArray(db?.yearBars) ? db.yearBars : []).find(b => b?.id === teil.id) || null;
      ort = 'Jahresbalken';
    } else {
      continue;
    }
    const beschreibe = teil.art === 'stunde' ? stundenBeschreibung : nameBeschreibung;
    const aenderung = (!jetzt && teil.wert) ? 'wird angelegt'
      : (jetzt && !teil.wert) ? 'wird entfernt'
      : (gleich(jetzt, teil.wert) ? 'bleibt unverändert' : 'wird ersetzt');
    zeilen.push({
      art: teil.art,
      ort,
      jetzt: beschreibe(jetzt),
      danach: beschreibe(teil.wert),
      aenderung,
    });
  }
  return zeilen;
}
