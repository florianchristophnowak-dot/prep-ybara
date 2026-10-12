/* ============================================================
   Beobachtung – kurze Einschätzungen zu Lernenden

   Nach einer Stunde bleiben ein paar Minuten, in denen sich noch
   festhalten lässt, wer heute wie mitgearbeitet hat. Für mehr reicht
   es selten, und genau darauf ist dieser Bereich zugeschnitten: Eine
   Runde schlägt eine Handvoll Paare aus Lernender und Frage vor, man
   tippt je Paar eine von vier Stufen an, fertig. Über Wochen ergibt
   sich daraus ein Bild, das nicht nur aus den Lautesten besteht.

   Die Idee und der Auswahlalgorithmus der Runde stammen aus
   Capy-scope. Sie werden hier übernommen, nicht neu erfunden – wer
   von dort kommt, soll dieselben Vorschläge bekommen.

   GRUNDSÄTZE, die den Entwurf tragen:

   1. Beobachtungen sind personenbezogen. Sie liegen deshalb in einer
      EIGENEN Ablage und nicht in der Planungsdatenbank: Ein Backup der
      Planung, eine Vorlage, ein Pocket-Profil oder ein archiviertes
      Schuljahr sollen keine Namen und keine Einschätzungen mitnehmen,
      nur weil sie zufällig in derselben Datei stehen. Die einzige
      Brücke zur Planung ist die Stundenreferenz – eine Zeichenkette,
      kein Verweis, der die Planung an diese Daten bindet.

   2. Eine Lerngruppe hat keine id. Sie ist, wie überall in der App,
      das Paar aus Klasse und Fach (groupKey). Anders als dort darf
      das Fach hier fehlen: Eine Klassenlehrerin beobachtet ihre
      Klasse auch ohne Fachbezug. Die Klasse dagegen ist Pflicht –
      ohne sie gibt es keine Gruppe, der man Lernende zuordnen könnte.

   3. Die Skala ist fest: vier Stufen ohne Mitte. Eine Mitte lädt dazu
      ein, sich nicht festzulegen, und eine je Frage wählbare Skala
      machte alte und neue Einschätzungen unvergleichbar. Deshalb ist
      die Skala eine Konstante und kein Teil der Daten.

   4. Die Auswertung beschreibt, sie bewertet nicht. Es gibt keine
      Sollwerte, keine Ampel, keine Warnung. Eine Beobachtung ist eine
      Momentaufnahme aus Sicht einer Lehrperson, keine Note.

   5. Verwaiste Daten werden nicht stillschweigend gelöscht. Eine
      Beobachtung, deren Lernende oder Frage (noch) fehlt, bleibt
      erhalten – sie kann aus einer Sicherung stammen, die erst halb
      eingelesen ist. Gelöscht wird nur, was jemand ausdrücklich
      löscht: eine Lernende samt ihren Beobachtungen, eine Frage samt
      ihren Beobachtungen.

   Diese Datei ist rein: kein React, kein DOM, keine Ablage. Jede
   Funktion gibt neue Objekte zurück und lässt ihre Eingabe unberührt.
   Wo die Daten liegen, steht in beobachtung-speicher.js und in den
   Plattformadaptern.
   ============================================================ */

import { parseStundenRef } from './nachbereitung.js';

export const BEOBACHTUNG_SCHEMA = 1;

/* ---- Skala -----------------------------------------------------------
   Wortgleich mit Capy-scope, damit eine übernommene Beobachtung
   dasselbe bedeutet wie vorher. Der Titel ist die Kurzform für Knöpfe
   und Listen, die Beschreibung die Lesart als Aussage. */
export const SKALA = Object.freeze([
  Object.freeze({ wert: 1, titel: 'eher negativ',   beschreibung: 'trifft kaum zu' }),
  Object.freeze({ wert: 2, titel: 'leicht negativ', beschreibung: 'trifft eher nicht zu' }),
  Object.freeze({ wert: 3, titel: 'leicht positiv', beschreibung: 'trifft eher zu' }),
  Object.freeze({ wert: 4, titel: 'eher positiv',   beschreibung: 'trifft deutlich zu' }),
]);

export function istSkalenwert(wert){
  return Number.isInteger(wert) && wert >= 1 && wert <= SKALA.length;
}

export function skalaTitel(wert){
  return SKALA.find(s => s.wert === Number(wert))?.titel || '';
}

/* ---- Kategorien ------------------------------------------------------
   Die Kennungen sind die von Capy-scope ("Kompetenz", nicht
   "Kompetenzentwicklung"), damit ein Import nichts übersetzen muss.
   Was keiner Kategorie zuzuordnen ist, landet bei "Sonstiges" statt
   verworfen zu werden. */
export const KATEGORIEN = Object.freeze([
  Object.freeze({ id: 'Mitarbeit', name: 'Mitarbeit' }),
  Object.freeze({ id: 'Verhalten', name: 'Verhalten' }),
  Object.freeze({ id: 'Kompetenz', name: 'Kompetenzentwicklung' }),
  Object.freeze({ id: 'Sonstiges', name: 'Sonstiges' }),
]);

export function kategorieName(id){
  return KATEGORIEN.find(k => k.id === id)?.name || 'Sonstiges';
}

export const GELTUNGEN = Object.freeze(['allgemein', 'lerngruppe']);

/* ---- Standardfragen --------------------------------------------------
   Die acht Fragen, mit denen Capy-scope startet – Text, Kategorie und
   Stichwort unverändert. Der gleiche Wortlaut ist Absicht: Beim Import
   aus Capy-scope werden dessen mitgelieferte Fragen über den Text auf
   diese hier abgebildet, statt doppelt zu erscheinen.

   Angelegt werden sie nur ein einziges Mal, in den Startdaten. Wer sie
   löscht, soll sie beim nächsten Laden nicht wiederfinden. */
export const STANDARD_FRAGEN = Object.freeze([
  Object.freeze({ text: 'Der Lernende beteiligt sich aktiv am Unterricht.',               kategorie: 'Mitarbeit', stichwort: 'allgemein' }),
  Object.freeze({ text: 'Der Lernende hört aufmerksam zu und bleibt bei der Sache.',      kategorie: 'Verhalten', stichwort: 'allgemein' }),
  Object.freeze({ text: 'Der Lernende arbeitet kooperativ mit anderen zusammen.',         kategorie: 'Verhalten', stichwort: 'Sozialverhalten' }),
  Object.freeze({ text: 'Der Lernende bringt eigene Ideen oder Beiträge ein.',            kategorie: 'Mitarbeit', stichwort: 'mündliche Beteiligung' }),
  Object.freeze({ text: 'Der Lernende setzt fachliche Inhalte sicher und passend um.',    kategorie: 'Kompetenz', stichwort: 'fachspezifisch' }),
  Object.freeze({ text: 'Der Lernende kann Aufgaben zunehmend selbstständig bearbeiten.', kategorie: 'Kompetenz', stichwort: 'Selbstständigkeit' }),
  Object.freeze({ text: 'Der Lernende nutzt die Unterrichtszeit konzentriert.',           kategorie: 'Verhalten', stichwort: 'Arbeitsverhalten' }),
  Object.freeze({ text: 'Der Lernende zeigt Fortschritte in der angestrebten Kompetenz.', kategorie: 'Kompetenz', stichwort: 'Lernentwicklung' }),
]);

/* ---- Grösse einer Runde ----------------------------------------------
   Eine Runde ist für die Minuten nach der Stunde gedacht. Mehr als
   zehn Einschätzungen am Stück werden ungenau, weniger als eine ist
   keine Runde. */
export const RUNDE_MIN = 1;
export const RUNDE_MAX = 10;
export const RUNDEN_GROESSE_STANDARD = 6;

export function normalisiereRundenGroesse(v, standard = RUNDEN_GROESSE_STANDARD){
  const n = Math.round(zahlAus(v));
  if (!Number.isFinite(n)) return standard;
  return Math.min(RUNDE_MAX, Math.max(RUNDE_MIN, n));
}

/* ---- Kleine Helfer ---------------------------------------------------
   Bewusst streng: Aus einem Objekt oder true wird kein Name
   "[object Object]" oder "true". Nur Text und Zahlen gelten. */
function text(x){
  if (typeof x === 'string') return x.trim();
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return '';
}
function einzeilig(x){ return text(x).replace(/\s+/g, ' '); }
function zahlAus(v){
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) return Number(v);
  return NaN;
}
const objekt = (v)=> (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const liste = (v)=> (Array.isArray(v) ? v : []);
const istObjekt = (v)=> Boolean(v && typeof v === 'object' && !Array.isArray(v));

/* Wie zwei Namen oder Fragetexte verglichen werden: ohne Rand, mit
   einfachen Leerzeichen, ohne Gross-/Kleinschreibung. "mia " und "Mia"
   sind dieselbe Person – zumindest in derselben Lerngruppe. */
export function vergleichsText(x){
  return einzeilig(x).toLocaleLowerCase('de');
}

/* Kennungen wie sonst im Repo: Präfix, Zeit, Zufall. Eine von aussen
   gereichte `neueId` hat Vorrang – sie bekommt das Präfix angeboten,
   darf es aber übergehen (uid() in app.jsx tut das). */
export function neueKennung(neueId, praefix = 'id'){
  if (typeof neueId === 'function') {
    const id = text(neueId(praefix));
    if (id) return id;
  }
  return `${praefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/* `jetzt` darf eine Zeichenkette, ein Date oder eine Funktion sein –
   die Aufrufer im Repo halten es unterschiedlich. Heraus kommt immer
   ein ISO-Zeitpunkt. */
function zeitpunktAus(jetzt){
  const w = typeof jetzt === 'function' ? jetzt() : jetzt;
  if (w instanceof Date && Number.isFinite(w.getTime())) return w.toISOString();
  const t = text(w);
  if (t && Number.isFinite(Date.parse(t))) return new Date(t).toISOString();
  return new Date().toISOString();
}

const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;

export function istDatum(s){
  const t = text(s);
  if (!DATUM_MUSTER.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/* Das Kalenderdatum in der Ortszeit. Nicht toISOString().slice(0, 10):
   Das wäre UTC, und eine Runde kurz nach Mitternacht fiele auf den
   Vortag. */
function lokalesDatum(d = new Date()){
  const p = (n)=> String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Der Zeitwert einer Beobachtung zum Sortieren. Ohne gültigen
   Zeitpunkt zählt der Tagesbeginn, ohne beides der Anfang der Zeit –
   so wie Capy-scope "1970-01-01" für "nie" nimmt. */
function zeitwert(b){
  const z = Date.parse(b?.zeitpunkt);
  if (Number.isFinite(z)) return z;
  const d = Date.parse(`${b?.datum}T00:00:00Z`);
  return Number.isFinite(d) ? d : 0;
}

function vergleicheNamen(a, b){
  return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
}

/* Schlüssel für ein Paar aus zwei Kennungen. Das Nullzeichen kommt in
   keiner Kennung vor, "a|b" + "c" und "a" + "b|c" bleiben getrennt. */
const paar = (a, b)=> `${a}\u0000${b}`;

/* ---- Lerngruppen -----------------------------------------------------
   Dieselbe Schreibweise wie groupKey() in app.jsx, damit eine
   Lerngruppe hier und in der Planung denselben Schlüssel trägt. */
export function lerngruppenSchluessel(klasse, fach){
  const k = text(klasse);
  if (!k) return '';
  return `${k}||${text(fach)}`;
}

export function zerlegeLerngruppenSchluessel(key){
  const s = text(key);
  const i = s.indexOf('||');
  if (i < 0) return { klasse: s, fach: '' };
  return { klasse: s.slice(0, i).trim(), fach: s.slice(i + 2).trim() };
}

/* Ein Schlüssel in seiner einzigen gültigen Form – oder ''. Alles, was
   von aussen kommt, läuft hier durch, bevor es verglichen wird. */
export function normalisiereLerngruppenSchluessel(key){
  const { klasse, fach } = zerlegeLerngruppenSchluessel(key);
  return lerngruppenSchluessel(klasse, fach);
}

export function lerngruppenName(key){
  const { klasse, fach } = zerlegeLerngruppenSchluessel(key);
  if (!klasse) return '';
  return fach ? `${klasse} · ${fach}` : klasse;
}

/* Die Lerngruppen, die in der Planung vorkommen – als Vorschlag für
   die Auswahl. Gezählt werden die laufenden Wochen, nicht die Archive:
   Wer vor zwei Jahren eine 5c hatte, beobachtet sie heute nicht mehr.
   Die häufigsten zuerst, weil das meist die eigenen Klassen sind. */
export function lerngruppenAusPlanung(db){
  const gezaehlt = new Map();
  for (const woche of Object.values(objekt(objekt(db).weeks))) {
    for (const l of Object.values(objekt(objekt(woche).lessons))) {
      if (!istObjekt(l)) continue;
      const schluessel = lerngruppenSchluessel(l.classGroup, l.subject);
      if (!schluessel) continue;
      gezaehlt.set(schluessel, (gezaehlt.get(schluessel) || 0) + 1);
    }
  }
  return [...gezaehlt].map(([schluessel, stunden])=>{
    const { klasse, fach } = zerlegeLerngruppenSchluessel(schluessel);
    return { schluessel, klasse, fach, name: lerngruppenName(schluessel), stunden };
  }).sort((a, b)=> b.stunden - a.stunden
    || vergleicheNamen(a.name, b.name)
    || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0));
}

/* ---- Leere Form und Startdaten --------------------------------------- */

export function leereBeobachtungsdaten(){
  return {
    schema: BEOBACHTUNG_SCHEMA,
    einstellungen: { rundenGroesse: RUNDEN_GROESSE_STANDARD },
    lernende: {},
    fragen: [],
    beobachtungen: [],
  };
}

/* Was eine Ablage enthält, in die noch nie geschrieben wurde. Der
   Unterschied zur leeren Form sind die Standardfragen: Ohne Fragen
   liesse sich keine einzige Runde starten. */
export function startdaten({ neueId, jetzt } = {}){
  const erstelltAm = zeitpunktAus(jetzt);
  return {
    ...leereBeobachtungsdaten(),
    fragen: STANDARD_FRAGEN.map(q => ({
      id: neueKennung(neueId, 'q'),
      text: q.text,
      kategorie: q.kategorie,
      stichwort: q.stichwort,
      geltung: 'allgemein',
      lerngruppe: '',
      kompetenz: '',
      aktiv: true,
      standard: true,
      erstelltAm,
    })),
  };
}

/* ---- Normalisierung --------------------------------------------------
   Wie überall in dieser App: beliebige Eingabe, gültige leere Form.
   Verworfen wird, was sich nicht sinnvoll lesen lässt (kein Name,
   kein Fragetext, ein Wert ausserhalb der Skala). Behalten wird, was
   lediglich nicht zusammenpasst – siehe Grundsatz 5. */

function normalisiereLernendenEintrag(raw, neueId){
  if (!istObjekt(raw)) return null;
  const name = einzeilig(raw.name);
  if (!name) return null;
  return { id: text(raw.id) || neueKennung(neueId, 'l'), name, aktiv: raw.aktiv !== false };
}

function normalisiereKategorie(k){
  const v = vergleichsText(k);
  if (!v) return 'Sonstiges';
  const treffer = KATEGORIEN.find(x => vergleichsText(x.id) === v || vergleichsText(x.name) === v);
  return treffer ? treffer.id : 'Sonstiges';
}

export function normalisiereFrage(raw, { neueId } = {}){
  if (!istObjekt(raw)) return null;
  const t = text(raw.text);
  if (!t) return null;
  /* Eine Frage "nur für eine Lerngruppe" ohne gültige Lerngruppe wird
     allgemein. Verwerfen hiesse, ihre Beobachtungen zu verwaisen;
     allgemein ist sie wenigstens wieder auffindbar. */
  const lerngruppe = normalisiereLerngruppenSchluessel(raw.lerngruppe);
  const geltung = (raw.geltung === 'lerngruppe' && lerngruppe) ? 'lerngruppe' : 'allgemein';
  const erstelltAm = text(raw.erstelltAm);
  return {
    id: text(raw.id) || neueKennung(neueId, 'q'),
    text: t,
    kategorie: normalisiereKategorie(raw.kategorie),
    stichwort: text(raw.stichwort),
    geltung,
    lerngruppe: geltung === 'lerngruppe' ? lerngruppe : '',
    kompetenz: text(raw.kompetenz),
    aktiv: raw.aktiv !== false,
    standard: raw.standard === true,
    erstelltAm: erstelltAm && Number.isFinite(Date.parse(erstelltAm)) ? erstelltAm : '',
  };
}

export function normalisiereBeobachtung(raw, { neueId } = {}){
  if (!istObjekt(raw)) return null;
  const wert = zahlAus(raw.wert);
  if (!istSkalenwert(wert)) return null;
  const lerngruppe = normalisiereLerngruppenSchluessel(raw.lerngruppe);
  const lernendeId = text(raw.lernendeId);
  const frageId = text(raw.frageId);
  if (!lerngruppe || !lernendeId || !frageId) return null;

  /* Ohne Tag lässt sich eine Beobachtung weder einordnen noch für die
     Runde berücksichtigen. Fehlt er, hilft der Zeitpunkt aus (in UTC,
     damit das Ergebnis nicht von der Zeitzone des Rechners abhängt). */
  const zp = text(raw.zeitpunkt);
  const zpGueltig = Boolean(zp) && Number.isFinite(Date.parse(zp));
  const datum = istDatum(raw.datum)
    ? text(raw.datum)
    : (zpGueltig ? new Date(zp).toISOString().slice(0, 10) : '');
  if (!datum) return null;

  const ref = text(raw.stundenRef);
  return {
    id: text(raw.id) || neueKennung(neueId, 'obs'),
    lerngruppe,
    lernendeId,
    frageId,
    wert,
    notiz: text(raw.notiz),
    datum,
    zeitpunkt: zpGueltig ? new Date(zp).toISOString() : `${datum}T00:00:00.000Z`,
    stundenRef: parseStundenRef(ref) ? ref : '',
    rundeId: text(raw.rundeId),
  };
}

/* Doppelte Kennungen: die erste gewinnt. Eine zweite Beobachtung mit
   derselben id ist kein zweiter Befund, sondern eine Kopie. */
function eindeutig(eintraege){
  const gesehen = new Set();
  const out = [];
  for (const e of eintraege) {
    if (!e || gesehen.has(e.id)) continue;
    gesehen.add(e.id);
    out.push(e);
  }
  return out;
}

export function normalisiereBeobachtungsdaten(raw, { neueId } = {}){
  const o = objekt(raw);

  /* Zwei Schlüssel, die nur in Leerzeichen abweichen, sind dieselbe
     Lerngruppe – ihre Listen werden zusammengelegt. Eine leere Liste
     bleibt nicht als Gerippe stehen. */
  const lernende = {};
  for (const [key, eintraege] of Object.entries(objekt(o.lernende))) {
    const k = normalisiereLerngruppenSchluessel(key);
    if (!k) continue;
    const zusammen = eindeutig([
      ...(lernende[k] || []),
      ...liste(eintraege).map(e => normalisiereLernendenEintrag(e, neueId)),
    ]);
    if (zusammen.length) lernende[k] = zusammen;
  }

  return {
    schema: BEOBACHTUNG_SCHEMA,
    einstellungen: { rundenGroesse: normalisiereRundenGroesse(objekt(o.einstellungen).rundenGroesse) },
    lernende,
    fragen: eindeutig(liste(o.fragen).map(f => normalisiereFrage(f, { neueId }))),
    beobachtungen: eindeutig(liste(o.beobachtungen).map(b => normalisiereBeobachtung(b, { neueId }))),
  };
}

/* ---- Zugriff ohne Normalisierung -------------------------------------
   Die Operationen unten bekommen normalerweise normalisierte Daten aus
   dem Speicher. Sie verlassen sich trotzdem nicht darauf, dass jedes
   Feld da ist – nur normalisieren sie nicht bei jedem Aufruf neu. */

function rahmen(daten){
  return istObjekt(daten) ? daten : leereBeobachtungsdaten();
}

function gruppe(daten, k){
  return k ? liste(objekt(objekt(daten).lernende)[k]).filter(istObjekt) : [];
}

function mitGruppe(daten, k, eintraege){
  const lernende = { ...objekt(objekt(daten).lernende) };
  if (eintraege.length) lernende[k] = eintraege;
  else delete lernende[k];
  return { ...rahmen(daten), lernende };
}

function alleFragen(daten){
  return liste(objekt(daten).fragen).filter(istObjekt);
}

function alleBeobachtungen(daten){
  return liste(objekt(daten).beobachtungen).filter(istObjekt);
}

function beobachtungenDerGruppe(daten, k){
  return k ? alleBeobachtungen(daten).filter(b => b.lerngruppe === k) : [];
}

function mitBeobachtungen(daten, beobachtungen){
  return { ...rahmen(daten), beobachtungen };
}

/* ---- Lernende --------------------------------------------------------
   Ausblenden und Löschen sind zwei verschiedene Dinge. Wer die Klasse
   verlässt, wird ausgeblendet: Die Beobachtungen bleiben, aber in
   keiner Runde taucht der Name mehr auf. Löschen nimmt die
   Beobachtungen mit – das ist der Weg für "hier war nie jemand", etwa
   nach einem Tippfehler oder auf Wunsch der Familie. */

export function lernendeDerGruppe(daten, key, { auchInaktive = false } = {}){
  const k = normalisiereLerngruppenSchluessel(key);
  return gruppe(daten, k).filter(l => auchInaktive || l.aktiv !== false);
}

/* Namen kommen meist als eingefügte Liste aus einer Tabelle oder
   E-Mail, ein Name je Zeile. Leere Zeilen und Namen, die es in der
   Gruppe schon gibt (auch ausgeblendet), werden übergangen – ein
   zweites Einfügen derselben Liste legt nichts doppelt an. */
export function lernendeHinzufuegen(daten, key, namen, { neueId } = {}){
  const k = normalisiereLerngruppenSchluessel(key);
  if (!k) return daten;
  const roh = typeof namen === 'string' ? namen.split(/\r\n|\r|\n/) : liste(namen);
  const vorhanden = gruppe(daten, k);
  const bekannt = new Set(vorhanden.map(l => vergleichsText(l.name)));
  const neu = [];
  for (const n of roh) {
    const name = einzeilig(n);
    const v = vergleichsText(name);
    if (!name || bekannt.has(v)) continue;
    bekannt.add(v);
    neu.push({ id: neueKennung(neueId, 'l'), name, aktiv: true });
  }
  if (!neu.length) return daten;
  return mitGruppe(daten, k, [...vorhanden, ...neu]);
}

export function lernendeAendern(daten, key, id, patch = {}){
  const k = normalisiereLerngruppenSchluessel(key);
  const lid = text(id);
  const vorhanden = gruppe(daten, k);
  const i = vorhanden.findIndex(l => l.id === lid);
  if (i < 0) return daten;
  const p = objekt(patch);
  const alt = vorhanden[i];
  // Ein leerer Name ist kein Umbenennen, sondern ein Versehen.
  const name = einzeilig(p.name) || alt.name;
  const aktiv = typeof p.aktiv === 'boolean' ? p.aktiv : alt.aktiv !== false;
  if (name === alt.name && aktiv === (alt.aktiv !== false)) return daten;
  const neu = vorhanden.slice();
  neu[i] = { ...alt, name, aktiv };
  return mitGruppe(daten, k, neu);
}

/* Die Reihenfolge der Liste ist die der Klassenliste im Kopf der
   Lehrperson – sie wird nur von Hand geändert, nie automatisch
   sortiert. */
export function lernendeVerschieben(daten, key, id, richtung){
  const k = normalisiereLerngruppenSchluessel(key);
  const vorhanden = gruppe(daten, k);
  const i = vorhanden.findIndex(l => l.id === text(id));
  const schritt = Math.sign(Number(richtung) || 0);
  const j = i + schritt;
  if (i < 0 || !schritt || j < 0 || j >= vorhanden.length) return daten;
  const neu = vorhanden.slice();
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return mitGruppe(daten, k, neu);
}

export function lernendeLoeschen(daten, key, id){
  const k = normalisiereLerngruppenSchluessel(key);
  const lid = text(id);
  const vorhanden = gruppe(daten, k);
  if (!vorhanden.some(l => l.id === lid)) return daten;
  const ohne = mitGruppe(daten, k, vorhanden.filter(l => l.id !== lid));
  return mitBeobachtungen(ohne, alleBeobachtungen(daten).filter(b => !(b.lerngruppe === k && b.lernendeId === lid)));
}

/* Dieselbe Klasse in einem zweiten Fach: Die Namensliste wird
   übernommen, die Beobachtungen nicht. Was in Mathematik beobachtet
   wurde, gehört nicht ungefragt nach Französisch. Neue Kennungen, damit
   beide Listen danach unabhängig voneinander geändert werden können. */
export function lernendeKopieren(daten, vonKey, nachKey, { neueId } = {}){
  const von = normalisiereLerngruppenSchluessel(vonKey);
  const nach = normalisiereLerngruppenSchluessel(nachKey);
  if (!von || !nach || von === nach) return daten;
  const namen = gruppe(daten, von).filter(l => l.aktiv !== false).map(l => l.name);
  return lernendeHinzufuegen(daten, nach, namen, { neueId });
}

export function beobachtungenVonLernenden(daten, key, id){
  const k = normalisiereLerngruppenSchluessel(key);
  const lid = text(id);
  return beobachtungenDerGruppe(daten, k).filter(b => b.lernendeId === lid).length;
}

/* ---- Fragen ----------------------------------------------------------
   Ein gemeinsamer Pool für alle Lerngruppen, dazu Fragen, die nur in
   einer Lerngruppe gelten ("benutzt die Zielsprache spontan" passt nicht
   in Mathematik). Eine Runde mischt beides.

   Deaktivieren behält die Beobachtungen, Löschen nimmt sie mit – wie in
   Capy-scope. */

export function frageHinzufuegen(daten, eingabe = {}, { neueId, jetzt } = {}){
  const e = objekt(eingabe);
  if (!text(e.text)) return daten;
  const frage = normalisiereFrage({
    text: e.text,
    kategorie: e.kategorie,
    stichwort: e.stichwort,
    geltung: e.geltung,
    lerngruppe: e.lerngruppe,
    kompetenz: e.kompetenz,
    id: neueKennung(neueId, 'q'),
    aktiv: true,
    standard: false,
    erstelltAm: zeitpunktAus(jetzt),
  });
  return { ...rahmen(daten), fragen: [...alleFragen(daten), frage] };
}

const AENDERBARE_FRAGEFELDER = ['kategorie', 'stichwort', 'geltung', 'lerngruppe', 'kompetenz'];

export function frageAendern(daten, id, patch = {}){
  const fid = text(id);
  const fragen = alleFragen(daten);
  const i = fragen.findIndex(f => f.id === fid);
  if (i < 0) return daten;
  const p = objekt(patch);
  const alt = fragen[i];
  const zusammen = { ...alt };
  for (const feld of AENDERBARE_FRAGEFELDER) {
    if (Object.hasOwn(p, feld) && p[feld] !== undefined) zusammen[feld] = p[feld];
  }
  // Wie beim Anlegen: ein leerer Text löscht die Frage nicht nebenbei.
  if (text(p.text)) zusammen.text = p.text;
  if (typeof p.aktiv === 'boolean') zusammen.aktiv = p.aktiv;
  // Kennung, Herkunft und Anlagedatum sind keine Eigenschaften, die man bearbeitet.
  const frage = normalisiereFrage({ ...zusammen, id: alt.id, standard: alt.standard, erstelltAm: alt.erstelltAm });
  if (!frage) return daten;
  const neu = fragen.slice();
  neu[i] = frage;
  return { ...rahmen(daten), fragen: neu };
}

export function frageLoeschen(daten, id){
  const fid = text(id);
  const fragen = alleFragen(daten);
  if (!fragen.some(f => f.id === fid)) return daten;
  return {
    ...rahmen(daten),
    fragen: fragen.filter(f => f.id !== fid),
    beobachtungen: alleBeobachtungen(daten).filter(b => b.frageId !== fid),
  };
}

/* Die Fragen, die in einer Lerngruppe gelten: zuerst die allgemeinen,
   dann die eigenen der Gruppe, jeweils in der Reihenfolge des Pools. */
export function fragenFuer(daten, key, { auchInaktive = false } = {}){
  const k = normalisiereLerngruppenSchluessel(key);
  const fragen = alleFragen(daten).filter(f => auchInaktive || f.aktiv !== false);
  return [
    ...fragen.filter(f => f.geltung !== 'lerngruppe'),
    ...(k ? fragen.filter(f => f.geltung === 'lerngruppe' && f.lerngruppe === k) : []),
  ];
}

export function beobachtungenZurFrage(daten, id){
  const fid = text(id);
  return alleBeobachtungen(daten).filter(b => b.frageId === fid).length;
}

/* ---- Runde -----------------------------------------------------------
   Der Algorithmus aus Capy-scope (generateSessionItems), Gewicht für
   Gewicht. Jedes Paar aus aktiver Lernender und aktiver Frage bekommt
   eine Punktzahl, die niedrigste wird gezogen:

     + 10000  wenn das Paar zuletzt HEUTE beobachtet wurde
     + 1000   je bisheriger Beobachtung des Paares in dieser Lerngruppe
     + 120    je Mal, das die Lernende in dieser Runde schon dran war
     + 70     je Mal, das die Frage in dieser Runde schon dran war
     + 0..8   Zufall, damit bei Gleichstand nicht immer dieselben zuerst
              kommen

   Bei gleicher Punktzahl kommt das Paar zuerst, dessen letzte
   Beobachtung länger zurückliegt. Nach jedem Zug wird neu gerechnet.

   Ergebnis: Wer selten dran war, kommt eher dran. Bei gleicher
   Vorgeschichte erscheint dieselbe Lernende in einer Runde erst
   wieder, wenn alle anderen schon dran waren – hat sie aber deutlich
   weniger Beobachtungen als die anderen, kann sie mehrmals hintereinander
   kommen (120 je Einsatz wiegen weniger als 1000 je Beobachtung). Ein
   Paar, das heute schon dran war, kommt erst, wenn alle anderen Paare
   durch sind; ausgeschlossen ist es nicht. Bei kleinen Gruppen oder
   mehreren Runden am selben Tag kommt es deshalb vor.

   Eine Abweichung im Kleinen: Capy-scope würfelt bei JEDEM Vergleich
   neu, sodass die Sortierung mit sich selbst uneins sein kann. Hier
   wird je Zug und Paar EINMAL gewürfelt. Die Gewichte bleiben gleich,
   die Sortierung wird dadurch widerspruchsfrei – und mit einem festen
   `zufall` vollständig wiederholbar. */
export function erzeugeRunde(daten, key, { anzahl, heuteISO, zufall = Math.random, neueId } = {}){
  const k = normalisiereLerngruppenSchluessel(key);
  const id = neueKennung(neueId, 'r');
  const runde = { id, lerngruppe: k, eintraege: [] };
  const lernende = lernendeDerGruppe(daten, k);
  const fragen = fragenFuer(daten, k);
  if (!lernende.length || !fragen.length) return runde;

  const groesse = normalisiereRundenGroesse(
    anzahl,
    normalisiereRundenGroesse(objekt(objekt(daten).einstellungen).rundenGroesse),
  );
  const heute = istDatum(heuteISO) ? text(heuteISO) : lokalesDatum();
  const wuerfel = typeof zufall === 'function' ? zufall : Math.random;

  // Ein Durchgang über die Beobachtungen statt einer Suche je Paar.
  const statistik = new Map();
  for (const b of beobachtungenDerGruppe(daten, k)) {
    const s = paar(b.lernendeId, b.frageId);
    const bisher = statistik.get(s);
    const z = zeitwert(b);
    if (!bisher) statistik.set(s, { anzahl: 1, letzte: b, letzteZeit: z });
    else {
      bisher.anzahl += 1;
      if (z >= bisher.letzteZeit) { bisher.letzte = b; bisher.letzteZeit = z; }
    }
  }

  let offen = lernende.flatMap(l => fragen.map((f)=>{
    const s = statistik.get(paar(l.id, f.id));
    return {
      lernendeId: l.id,
      frageId: f.id,
      anzahl: s ? s.anzahl : 0,
      letzteZeit: s ? s.letzteZeit : 0,
      sameDayPenalty: s && s.letzte.datum === heute ? 10000 : 0,
    };
  }));

  const lernendeEinsatz = new Map();
  const frageEinsatz = new Map();
  const eintraege = [];
  const ziel = Math.min(groesse, offen.length);

  while (eintraege.length < ziel) {
    const bewertet = offen.map(p => ({
      p,
      punkte: p.sameDayPenalty
        + p.anzahl * 1000
        + (lernendeEinsatz.get(p.lernendeId) || 0) * 120
        + (frageEinsatz.get(p.frageId) || 0) * 70
        + (Number(wuerfel()) || 0) * 8,
    }));
    bewertet.sort((a, b)=> (a.punkte - b.punkte) || (a.p.letzteZeit - b.p.letzteZeit));
    const [naechstes, ...rest] = bewertet;
    offen = rest.map(x => x.p);
    eintraege.push({ id: `${id}-${eintraege.length + 1}`, lernendeId: naechstes.p.lernendeId, frageId: naechstes.p.frageId });
    lernendeEinsatz.set(naechstes.p.lernendeId, (lernendeEinsatz.get(naechstes.p.lernendeId) || 0) + 1);
    frageEinsatz.set(naechstes.p.frageId, (frageEinsatz.get(naechstes.p.frageId) || 0) + 1);
  }

  return { ...runde, eintraege };
}

/* ---- Erfassen --------------------------------------------------------
   Jede Antwort wird einzeln gespeichert, sobald sie gegeben ist. Eine
   abgebrochene Runde verliert so nichts von dem, was schon erfasst
   war. Ein Wert ausserhalb der Skala ist keine Antwort und ändert
   nichts. */
export function erfasseBeobachtung(daten, eingabe = {}, { neueId } = {}){
  const e = objekt(eingabe);
  const zeitpunkt = zeitpunktAus(e.zeitpunkt || undefined);
  const datum = istDatum(e.datum) ? text(e.datum) : lokalesDatum(new Date(zeitpunkt));
  const geprueft = normalisiereBeobachtung({
    lerngruppe: e.lerngruppe,
    lernendeId: e.lernendeId,
    frageId: e.frageId,
    wert: e.wert,
    notiz: e.notiz,
    datum,
    zeitpunkt,
    stundenRef: e.stundenRef,
    rundeId: e.rundeId,
    id: '-',
  });
  if (!geprueft) return daten;
  const beobachtung = { ...geprueft, id: neueKennung(neueId, 'obs') };
  return mitBeobachtungen(daten, [...alleBeobachtungen(daten), beobachtung]);
}

/* ---- Auswertung ------------------------------------------------------
   Rein beschreibend (Grundsatz 4). Die Zahlen sagen, wie oft und mit
   welcher Tendenz beobachtet wurde – nicht, ob das genug oder gut ist.
   Mittelwerte bleiben ungerundet; wie viele Stellen gezeigt werden,
   entscheidet die Oberfläche. */

function mittelwert(beobachtungen){
  if (!beobachtungen.length) return null;
  return beobachtungen.reduce((s, b)=> s + b.wert, 0) / beobachtungen.length;
}

/* Wie viele der möglichen Paare schon mindestens einmal beobachtet
   wurden. Nur aktive Lernende und aktive Fragen zählen: Das ist der
   Raum, aus dem eine Runde zieht.

   Die Prozentzahl wird gerundet, aber nie auf 100 oder 0, solange das
   nicht stimmt: Ab 200 Paaren (25 Lernende × 8 Fragen) ergäbe ein
   einziges fehlendes Paar sonst „100 %" – und genau diese Zahl soll
   sagen, ob schon alle einmal dran waren. */
export function abdeckung(daten, key){
  const k = normalisiereLerngruppenSchluessel(key);
  const lernende = lernendeDerGruppe(daten, k);
  const fragen = fragenFuer(daten, k);
  const gesehen = new Set(beobachtungenDerGruppe(daten, k).map(b => paar(b.lernendeId, b.frageId)));
  let beobachtet = 0;
  for (const l of lernende) {
    for (const f of fragen) if (gesehen.has(paar(l.id, f.id))) beobachtet += 1;
  }
  const paare = lernende.length * fragen.length;
  let prozent = 0;
  if (paare && beobachtet >= paare) prozent = 100;
  else if (paare && beobachtet > 0) prozent = Math.min(99, Math.max(1, Math.round((beobachtet / paare) * 100)));
  return { paare, beobachtet, prozent };
}

/* Je Lernender, in der Reihenfolge der Liste. Ausgeblendete sind
   dabei: Gerade wer die Klasse verlassen hat, braucht womöglich noch
   einen Bericht. Die Oberfläche kann sie an `lernende.aktiv`
   erkennen. */
export function lernendenUebersicht(daten, key){
  const k = normalisiereLerngruppenSchluessel(key);
  const kategorieVon = new Map(alleFragen(daten).map(f => [f.id, f.kategorie]));
  const beobachtungen = beobachtungenDerGruppe(daten, k);
  return lernendeDerGruppe(daten, k, { auchInaktive: true }).map((lernende)=>{
    const eigene = beobachtungen.filter(b => b.lernendeId === lernende.id);
    const jeKategorie = {};
    for (const kat of KATEGORIEN) {
      jeKategorie[kat.id] = mittelwert(eigene.filter(b => kategorieVon.get(b.frageId) === kat.id));
    }
    return {
      lernende,
      anzahl: eigene.length,
      mittel: mittelwert(eigene),
      letzteDatum: eigene.reduce((m, b)=> (b.datum > m ? b.datum : m), ''),
      jeKategorie,
    };
  });
}

/* Je Frage, die in der Gruppe gilt. Eine deaktivierte Frage erscheint
   nur, wenn es zu ihr in dieser Gruppe Beobachtungen gibt – sonst
   verschwänden vorhandene Daten aus der Auswertung, bloss weil die
   Frage gerade nicht mehr gestellt wird. */
export function fragenUebersicht(daten, key){
  const k = normalisiereLerngruppenSchluessel(key);
  const beobachtungen = beobachtungenDerGruppe(daten, k);
  return fragenFuer(daten, k, { auchInaktive: true })
    .map((frage)=>{
      const zurFrage = beobachtungen.filter(b => b.frageId === frage.id);
      return {
        frage,
        anzahl: zurFrage.length,
        lernendeMitBeobachtung: new Set(zurFrage.map(b => b.lernendeId)).size,
      };
    })
    .filter(e => e.frage.aktiv !== false || e.anzahl > 0);
}

/* Der Einzelverlauf, neueste Beobachtung zuerst. Die Frage wird
   mitgeliefert, damit die Oberfläche nicht selbst suchen muss; fehlt
   sie (verwaiste Beobachtung), steht dort null.

   "Neueste" heisst: nach dem Datum, das die Oberfläche zeigt. Wer eine
   Stunde erst Tage später nachbereitet, erfasst mit dem Datum der
   Stunde, aber mit dem Zeitpunkt von heute. Sortiert nach dem
   Zeitpunkt stünde diese Stunde vor allem, was in den Tagen
   dazwischen beobachtet wurde – in der Liste wie im PDF. Der
   Zeitpunkt entscheidet erst innerhalb eines Tages, danach die
   Reihenfolge der Erfassung. */
export function verlaufVon(daten, key, lernendeId){
  const k = normalisiereLerngruppenSchluessel(key);
  const lid = text(lernendeId);
  const fragen = new Map(alleFragen(daten).map(f => [f.id, f]));
  return beobachtungenDerGruppe(daten, k)
    .map((b, i)=> ({ b, i }))
    .filter(({ b })=> b.lernendeId === lid)
    .sort((x, y)=> (y.b.datum > x.b.datum ? 1 : y.b.datum < x.b.datum ? -1 : 0)
      || (zeitwert(y.b) - zeitwert(x.b))
      || (y.i - x.i))
    .map(({ b })=> ({ beobachtung: b, frage: fragen.get(b.frageId) || null }));
}

/* Was in der Ablage steht – für den Dialog "Alle Daten löschen". Eine
   Lerngruppe zählt, sobald sie Lernende ODER Beobachtungen hat. Eigene
   Fragen sind die, die nicht mitgeliefert wurden; nur sie wären beim
   Löschen ein Verlust. */
export function beobachtungsUmfang(daten){
  const d = normalisiereBeobachtungsdaten(daten);
  const gruppen = new Set(Object.keys(d.lernende));
  for (const b of d.beobachtungen) gruppen.add(b.lerngruppe);
  return {
    beobachtungsLerngruppen: gruppen.size,
    lernende: Object.values(d.lernende).reduce((s, l)=> s + l.length, 0),
    beobachtungen: d.beobachtungen.length,
    eigeneFragen: d.fragen.filter(f => !f.standard).length,
  };
}

/* ---- Zusammenführen --------------------------------------------------
   Für das Einlesen einer Sicherung. Ersetzt wird nichts: Was schon da
   ist, bleibt, wie es ist, und Neues kommt dazu. Zweimal dieselbe
   Sicherung einzulesen, ändert beim zweiten Mal nichts mehr.

   Wiedererkannt wird in dieser Reihenfolge:
     1. über die Kennung;
     2. über eine früher schon übernommene Beobachtung: Deren
        Lernende bzw. Frage in der Basis sagt, worauf die eingehende
        Kennung damals abgebildet wurde. Das trägt auch dann noch, wenn
        die Lernende oder die Frage inzwischen auf einem der beiden
        Geräte umbenannt wurde – sonst entstünde beim nächsten Einlesen
        eine Dublette, an die sich alle späteren Beobachtungen hängten
        (wie beim Import aus Capy-scope, capy-import.js);
     3. eine Lernende über den gleichen Namen in derselben Lerngruppe –
        je vorhandener Lernender höchstens einmal, damit zwei
        verschiedene "Mia" der Sicherung nicht zu einer werden;
        eine Frage über gleichen Text, gleiche Geltung und gleiche
        Lerngruppe. Das ist auch der Weg für die Standardfragen: Jedes
        Gerät gibt ihnen beim Einrichten eigene Kennungen.
   Wird so wiedererkannt, schreibt das die Kennungen in den
   eingehenden Beobachtungen um. Beobachtungen selbst werden nur über
   die Kennung erkannt und nie überschrieben.

   Eine Grenze bleibt: Wurde zu einer Lernenden oder Frage noch nie
   etwas übernommen, gibt es keine Beobachtung, die Schritt 2 trüge.
   Dann zählt nach einer Umbenennung wieder nur der Name bzw. Text.

   Der Bericht zählt, was NEU angelegt wurde. */
export function zusammenfuehren(basis, eingehend){
  const b = normalisiereBeobachtungsdaten(basis);
  const e = normalisiereBeobachtungsdaten(eingehend);
  const bericht = { lernende: 0, fragen: 0, beobachtungen: 0 };
  const vorher = new Map(b.beobachtungen.map(x => [x.id, x]));

  const lernende = { ...b.lernende };
  const lernendeAbbildung = new Map();
  for (const [k, eingehendeListe] of Object.entries(e.lernende)) {
    const ziel = [...(lernende[k] || [])];
    const zielIds = new Set(ziel.map(l => l.id));
    const vergeben = new Set();
    const zuordnen = (l, id)=>{
      vergeben.add(id);
      lernendeAbbildung.set(paar(k, l.id), id);
    };

    /* Je eingehender Lernender die erste schon übernommene Beobachtung
       in dieser Lerngruppe – und nur, wenn deren Lernende hier noch
       existiert. */
    const frueher = new Map();
    for (const o of e.beobachtungen) {
      if (o.lerngruppe !== k || frueher.has(o.lernendeId)) continue;
      const alt = vorher.get(o.id);
      if (alt && alt.lerngruppe === k && zielIds.has(alt.lernendeId)) frueher.set(o.lernendeId, alt.lernendeId);
    }

    const offen = [];
    for (const l of eingehendeListe) {
      if (zielIds.has(l.id)) zuordnen(l, l.id);
      else offen.push(l);
    }
    const ohneTreffer = [];
    for (const l of offen) {
      const id = frueher.get(l.id);
      if (id && !vergeben.has(id)) zuordnen(l, id);
      else ohneTreffer.push(l);
    }
    for (const l of ohneTreffer) {
      const v = vergleichsText(l.name);
      const treffer = ziel.find(z => !vergeben.has(z.id) && vergleichsText(z.name) === v);
      if (treffer) {
        zuordnen(l, treffer.id);
        continue;
      }
      ziel.push({ ...l });
      zielIds.add(l.id);
      vergeben.add(l.id);
      bericht.lernende += 1;
    }
    if (ziel.length) lernende[k] = ziel;
  }

  const fragen = [...b.fragen];
  const fragenIds = new Set(fragen.map(f => f.id));
  const fragenAbbildung = new Map();
  const gleicheFrage = (x, y)=> vergleichsText(x.text) === vergleichsText(y.text)
    && x.geltung === y.geltung
    && x.lerngruppe === y.lerngruppe;
  const fruehereFrage = new Map();
  for (const o of e.beobachtungen) {
    if (fruehereFrage.has(o.frageId)) continue;
    const alt = vorher.get(o.id);
    if (alt && fragenIds.has(alt.frageId)) fruehereFrage.set(o.frageId, alt.frageId);
  }
  for (const f of e.fragen) {
    if (fragenIds.has(f.id)) continue;
    const treffer = fruehereFrage.get(f.id) || fragen.find(x => gleicheFrage(x, f))?.id;
    if (treffer) {
      fragenAbbildung.set(f.id, treffer);
      continue;
    }
    fragen.push({ ...f });
    fragenIds.add(f.id);
    bericht.fragen += 1;
  }

  const beobachtungen = [...b.beobachtungen];
  const beobachtungsIds = new Set(beobachtungen.map(x => x.id));
  for (const o of e.beobachtungen) {
    if (beobachtungsIds.has(o.id)) continue;
    beobachtungsIds.add(o.id);
    beobachtungen.push({
      ...o,
      lernendeId: lernendeAbbildung.get(paar(o.lerngruppe, o.lernendeId)) || o.lernendeId,
      frageId: fragenAbbildung.get(o.frageId) || o.frageId,
    });
    bericht.beobachtungen += 1;
  }

  return {
    daten: { schema: BEOBACHTUNG_SCHEMA, einstellungen: { ...b.einstellungen }, lernende, fragen, beobachtungen },
    bericht,
  };
}
