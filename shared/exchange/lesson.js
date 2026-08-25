/* ============================================================
   .prepybara-lesson – eine Unterrichtsstunde aus Pocket

   Der Weg Pocket → Desktop. Die Datei beschreibt genau das, was man
   unterwegs sinnvoll erfassen kann, und nicht mehr: Thema, Ziele,
   Kompetenzen, kommunikative Aufgabe, sprachliche Mittel, Phasen,
   Notizen – dazu die Zuordnung (Lerngruppe, Fach, Datum, Stunde) und
   eine Kennung, an der der Desktop dieselbe Planung wiedererkennt.

   ZWEI GRUNDENTSCHEIDUNGEN:

   1. Alles ausser format/schemaVersion/externalId ist optional. Eine
      Stunde, in der nur ein Thema und zwei Phasen stehen, ist eine
      gültige Datei. Pocket soll in Minuten benutzbar sein; ein
      Pflichtformular widerspräche dem.

   2. Kompetenzen und Sprechabsichten reisen als ETIKETT, nicht als
      Fremdschlüssel. Das ist keine Vereinfachung, sondern die
      Übernahme der Entscheidung, die im Desktop bereits gilt (siehe
      renderer/src/competencies.js): das Etikett IST die Identität.
      Eine Kennung wandert zusätzlich mit, wo es eine gibt – sie ist
      Beiwerk, nicht Bedingung.

   Alle Textfelder sind REINER TEXT. Der Desktop führt in Phasen ein
   kleines HTML (fett, kursiv, Listen); reiner Text ist dort gültig und
   wird beim Anzeigen umgesetzt. Umgekehrt hätte Pocket mit HTML nichts
   anzufangen – deshalb geht in diese Richtung nichts hinein.
   ============================================================ */

import {
  EXCHANGE_SCHEMA_VERSION, FORMAT_LESSON, FORMAT_LESSON_BUNDLE, EXT_LESSON,
} from './version.js';
import { ExchangeError, keinGueltigerExport, keinJson, zuNeu, fehlendeVersion } from './errors.js';
import { normalisiereEtikett, neueExternalId } from './ids.js';

/* ---- kleine Helfer --------------------------------------------------- */

function text(x){
  const s = String(x ?? '');
  // Zeilenenden vereinheitlichen: Windows-Dateien sollen sich nicht
  // anders verhalten als solche aus dem Browser.
  return s.replace(/\r\n?/g, '\n').trim();
}

function liste(raw){
  return Array.isArray(raw) ? raw : [];
}

function textListe(raw){
  return liste(raw).map(text).filter(Boolean);
}

function ganzzahl(x, { min = 1, max = 1440 } = {}){
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  const g = Math.round(n);
  if (g < min || g > max) return null;
  return g;
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;
export function istIsoDatum(s){
  if (!ISO_DATUM.test(String(s || ''))) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

function zeitstempel(x){
  const s = text(x);
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/* ---- Teilstrukturen -------------------------------------------------- */

/* Ein Lernziel ist ein Satz. Es reist trotzdem als Objekt: so kann
   später eine Kennung oder eine Zuordnung dazukommen, ohne dass die
   Fassung angehoben werden muss. Beim Einlesen wird die schlichte
   Zeichenkette ebenso angenommen – ältere und fremde Erzeuger sollen
   nicht daran scheitern. */
export function normalisiereLernziel(raw){
  if (typeof raw === 'string') {
    const t = text(raw);
    return t ? { text: t } : null;
  }
  const o = (raw && typeof raw === 'object') ? raw : null;
  if (!o) return null;
  const t = text(o.text ?? o.label ?? o.goal);
  if (!t) return null;
  return { text: t };
}

export function normalisiereLernziele(raw){
  return liste(raw).map(normalisiereLernziel).filter(Boolean);
}

/* Kompetenz und Sprechabsicht: dieselbe Bauart. `source` sagt, ob der
   Eintrag aus dem mitgereisten Profil stammt ("system"/"profile") oder
   in Pocket frei getippt wurde ("custom"). Der Desktop braucht das für
   die Rückfrage bei unbekannten Einträgen. */
function normalisiereReferenz(raw){
  if (typeof raw === 'string') {
    const l = normalisiereEtikett(raw);
    return l ? { label: l, source: 'custom' } : null;
  }
  const o = (raw && typeof raw === 'object') ? raw : null;
  if (!o) return null;
  const label = normalisiereEtikett(o.label ?? o.name ?? o.text);
  if (!label) return null;
  const ref = { label, source: o.source === 'system' || o.source === 'profile' ? o.source : 'custom' };
  const id = text(o.id);
  if (id) ref.id = id;
  return ref;
}

function normalisiereReferenzen(raw){
  const gesehen = new Set();
  const out = [];
  for (const eintrag of liste(raw)) {
    const ref = normalisiereReferenz(eintrag);
    if (!ref) continue;
    const key = ref.label.toLowerCase();
    if (gesehen.has(key)) continue;   // Mengensemantik wie im Desktop
    gesehen.add(key);
    out.push(ref);
  }
  return out;
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

/* Hilfen/Scaffolds hängen an der Phase – wie im Desktop. Die Arten sind
   dieselben Kennungen wie dort (linguistic, content, strategic,
   organizational, other), damit nichts übersetzt werden muss. */
const SCAFFOLD_ARTEN = new Set(['linguistic', 'content', 'strategic', 'organizational', 'other']);

export function normalisiereScaffold(raw){
  const o = (raw && typeof raw === 'object') ? raw : null;
  if (!o) return null;
  const label = text(o.label);
  const note = text(o.note);
  if (!label && !note) return null;   // leere Zeilen reisen nicht mit
  return {
    type: SCAFFOLD_ARTEN.has(o.type) ? o.type : 'linguistic',
    label,
    note,
  };
}

/* Eine Phase. `material` ist eine Notiz, `materialLink` ein optionaler
   Verweis – mehr braucht die mobile Fassung bewusst nicht (kein
   Dateiupload, keine Materialbibliothek). */
export function normalisierePhase(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const phase = {
    title: text(o.title),
    duration: ganzzahl(o.duration, { min: 1, max: 600 }) ?? 5,
    content: text(o.content),
    socialForm: text(o.socialForm),
    material: text(o.material ?? o.materials ?? o.materialsMedia),
    materialLink: text(o.materialLink ?? o.link),
    remarks: text(o.remarks),
  };
  const scaffolds = liste(o.scaffolds).map(normalisiereScaffold).filter(Boolean);
  if (scaffolds.length) phase.scaffolds = scaffolds;
  const id = text(o.id);
  if (id) phase.id = id;
  return phase;
}

/* ---- Die Stunde ------------------------------------------------------ */

/* Welche Art von Entwurf: die vollständige mobile Planung, die
   Schnellplanung oder eine reine Unterrichtsidee. Der Desktop zeigt es
   in der Vorschau an; am Import ändert es nichts – auch eine Idee wird
   zu einer regulären Stunde, wenn man sie importiert. */
export const ARTEN = ['lesson', 'quick', 'idea'];

export function normalisiereStunde(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};

  const stunde = {
    format: FORMAT_LESSON,
    schemaVersion: EXCHANGE_SCHEMA_VERSION,
    externalId: text(o.externalId) || neueExternalId(),
    kind: ARTEN.includes(o.kind) ? o.kind : 'lesson',

    createdAt: zeitstempel(o.createdAt) || new Date().toISOString(),
    updatedAt: zeitstempel(o.updatedAt) || zeitstempel(o.createdAt) || new Date().toISOString(),
  };

  /* Zuordnung. Kennung UND Name reisen mit: die Kennung trifft
     zuverlässig, der Name rettet die Zuordnung, wenn die Lerngruppe
     zwischenzeitlich umbenannt wurde. */
  const setze = (schluessel, wert)=>{ if (wert) stunde[schluessel] = wert; };
  setze('classId', text(o.classId));
  setze('className', normalisiereEtikett(o.className));
  setze('subjectId', text(o.subjectId));
  setze('subjectName', normalisiereEtikett(o.subjectName));
  setze('groupId', text(o.groupId));

  const datum = text(o.date);
  if (istIsoDatum(datum)) stunde.date = datum;
  const stundenNr = ganzzahl(o.lessonNumber, { min: 1, max: 12 });
  if (stundenNr) stunde.lessonNumber = stundenNr;

  /* Inhalt. Leere Felder werden weggelassen statt leer geschrieben –
     die Datei bleibt lesbar und der Import muss nicht zwischen "leer"
     und "nicht angegeben" unterscheiden. */
  setze('topic', text(o.topic));

  const lernziele = normalisiereLernziele(o.learningGoals);
  if (lernziele.length) stunde.learningGoals = lernziele;

  const kriterien = textListe(o.successCriteria);
  if (kriterien.length) stunde.successCriteria = kriterien;

  const kompetenzen = normalisiereReferenzen(o.competencies);
  if (kompetenzen.length) stunde.competencies = kompetenzen;

  const primaer = normalisiereEtikett(o.primaryCompetency);
  if (primaer) stunde.primaryCompetency = primaer;

  const aufgabe = normalisiereAufgabe(o.communicativeTask);
  if (!istLeereAufgabe(aufgabe)) stunde.communicativeTask = aufgabe;

  const sprechabsichten = normalisiereReferenzen(o.speechActs);
  if (sprechabsichten.length) stunde.speechActs = sprechabsichten;

  const mittel = normalisiereMittel(o.languageResources);
  if (!istLeereMittel(mittel)) stunde.languageResources = mittel;

  const phasen = liste(o.phases).map(normalisierePhase);
  if (phasen.length) stunde.phases = phasen;

  setze('notes', text(o.notes));

  /* Woher der Entwurf kommt. Reine Auskunft für die Vorschau. */
  const app = (o.app && typeof o.app === 'object') ? o.app : null;
  if (app) {
    const name = text(app.name);
    const version = text(app.version);
    if (name || version) stunde.app = { ...(name ? { name } : {}), ...(version ? { version } : {}) };
  }

  return stunde;
}

/* ---- Ableitungen für Vorschau und Anzeige ---------------------------- */

export function gesamtdauer(stunde){
  return liste(stunde?.phases).reduce((summe, p)=> summe + (Number(p?.duration) || 0), 0);
}

export function anzeigeName(stunde){
  const s = normalisiereStunde(stunde);
  return s.topic
    || s.learningGoals?.[0]?.text
    || s.communicativeTask?.text
    || s.notes
    || 'Ohne Titel';
}

export function gruppenName(stunde){
  const s = (stunde && typeof stunde === 'object') ? stunde : {};
  return [normalisiereEtikett(s.className), normalisiereEtikett(s.subjectName)]
    .filter(Boolean).join(' ');
}

/* Ein Dateiname, der auf jedem Betriebssystem funktioniert und den man
   im Download-Ordner wiedererkennt: "Les-loisirs-a-Montreal-9b". Akzente
   werden NUR hier entfernt – im Inhalt der Datei bleiben sie erhalten. */
export function dateiname(stunde, endung = EXT_LESSON){
  const teile = [anzeigeName(stunde), gruppenName(stunde)].filter(Boolean).join('-');
  let s = teile;
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch {}
  s = s
    .replace(/[^A-Za-z0-9\- _]+/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${s || 'Pocket-Stunde'}${endung}`;
}

/* ---- Paket aus mehreren Stunden -------------------------------------- */

/* Bewusst kein ZIP: ein Austauschobjekt mit einer Liste tut dasselbe,
   ist lesbar, braucht keine Bibliothek und lässt sich mit demselben
   Prüfweg behandeln wie die Einzeldatei. */
export function packeStunden(stunden, { app = null } = {}){
  return {
    format: FORMAT_LESSON_BUNDLE,
    schemaVersion: EXCHANGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...(app ? { app } : {}),
    lessons: liste(stunden).map(normalisiereStunde),
  };
}

/* ---- Prüfung --------------------------------------------------------- */

function pruefeKopf(o, erlaubteFormate){
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw keinGueltigerExport();
  const format = String(o.format || '');
  if (!erlaubteFormate.includes(format)) throw keinGueltigerExport();
  if (!('schemaVersion' in o)) throw fehlendeVersion();
  const version = Number(o.schemaVersion);
  if (!Number.isFinite(version) || version < 1) throw fehlendeVersion();
  if (version > EXCHANGE_SCHEMA_VERSION) throw zuNeu(version, EXCHANGE_SCHEMA_VERSION);
  return version;
}

/* Nimmt ein bereits geparstes Objekt und liefert IMMER eine Liste von
   Stunden – gleich ob Einzeldatei oder Paket. Die Oberfläche muss
   dadurch nur einen Fall behandeln. */
export function leseStunden(objekt){
  const format = String(objekt?.format || '');
  if (format === FORMAT_LESSON_BUNDLE) {
    pruefeKopf(objekt, [FORMAT_LESSON_BUNDLE]);
    const roh = liste(objekt.lessons);
    if (!roh.length) {
      throw new ExchangeError('leer', 'Diese Datei enthält keine Stunden.');
    }
    return roh.map(normalisiereStunde);
  }
  pruefeKopf(objekt, [FORMAT_LESSON]);
  return [normalisiereStunde(objekt)];
}

/* Der ganze Weg von der Datei: Text → JSON → Prüfung → Stunden. */
export function leseStundenDatei(inhalt){
  let objekt = null;
  try { objekt = JSON.parse(String(inhalt ?? '')); }
  catch { throw keinJson(); }
  return leseStunden(objekt);
}
