/* ============================================================
   .prepybara-profile – das Pocket-Profil

   Der Weg Desktop → Pocket. Es enthält AUSSCHLIESSLICH das, was beim
   Planen unterwegs hilft: Lerngruppen, Fächer, ein Ausschnitt des
   Stundenplans, die Kompetenzen, die Sprechabsichten, Sozialformen,
   häufige Phasentypen und Vorlagen für Hilfen.

   Was ausdrücklich NICHT hineingehört – und wofür es hier deshalb
   keine Felder gibt, nicht einmal leere:

     Schülerlisten, Noten, Leistungsdaten, Nachbereitungen, Aufsichten,
     To-dos, Kalendereinträge, Dateien.

   Ein Handy geht verloren, wird verliehen, liegt offen. Das Profil ist
   deshalb kein Auszug der Datenbank, sondern eine kurze Liste von
   Bezeichnungen. Selbst wenn es in fremde Hände gerät, steht darin
   nichts über einzelne Lernende.

   Der Stundenplan reist als DATIERTE Liste, nicht als Wochenraster:
   Prép-ybara kennt kein wiederkehrendes Raster, sondern konkrete Wochen.
   Ein Ausschnitt von wenigen Wochen genügt für "Heute" und "Demnächst"
   und hält die Datei klein.
   ============================================================ */

import { EXCHANGE_SCHEMA_VERSION, FORMAT_PROFILE } from './version.js';
import { keinGueltigerExport, keinJson, zuNeu, fehlendeVersion } from './errors.js';
import {
  normalisiereEtikett, classIdFor, subjectIdFor, groupIdFor, groupLabel, vergleichsSchluessel,
} from './ids.js';
import { istIsoDatum } from './lesson.js';

function text(x){ return String(x ?? '').replace(/\r\n?/g, '\n').trim(); }
function liste(raw){ return Array.isArray(raw) ? raw : []; }

function ganzzahl(x, min, max){
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  const g = Math.round(n);
  return (g < min || g > max) ? null : g;
}

/* ---- Bausteine ------------------------------------------------------- */

function normalisiereBenanntes(raw, kennung){
  const o = (raw && typeof raw === 'object') ? raw : { name: raw };
  const name = normalisiereEtikett(o.name ?? o.label);
  if (!name) return null;
  return { id: text(o.id) || kennung(name), name };
}

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

export function normalisiereKlasse(raw){
  return normalisiereBenanntes(raw, classIdFor);
}

export function normalisiereFach(raw){
  return normalisiereBenanntes(raw, subjectIdFor);
}

/* Eine Lerngruppe ist das Paar Klasse + Fach – "9b Französisch". Genau
   so plant der Desktop, genau so soll Pocket auswählen lassen. */
export function normalisiereGruppe(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const className = normalisiereEtikett(o.className ?? o.class ?? o.classGroup);
  const subjectName = normalisiereEtikett(o.subjectName ?? o.subject);
  if (!className && !subjectName) return null;
  return {
    id: text(o.id) || groupIdFor(className, subjectName),
    className,
    subjectName,
    classId: text(o.classId) || classIdFor(className),
    subjectId: text(o.subjectId) || subjectIdFor(subjectName),
    label: text(o.label) || groupLabel(className, subjectName),
    ...(text(o.color) ? { color: text(o.color) } : {}),
  };
}

/* Ein Stundenplaneintrag: an welchem Tag, in welcher Stunde, welche
   Lerngruppe. `planned` sagt, ob im Desktop für diesen Termin bereits
   etwas steht – Pocket kann dann darauf hinweisen, statt eine bereits
   geplante Stunde ein zweites Mal anzubieten. */
export function normalisiereStundenplanEintrag(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const date = text(o.date ?? o.dateISO);
  if (!istIsoDatum(date)) return null;
  const lessonNumber = ganzzahl(o.lessonNumber, 1, 12);
  if (!lessonNumber) return null;
  const className = normalisiereEtikett(o.className ?? o.classGroup);
  const subjectName = normalisiereEtikett(o.subjectName ?? o.subject);
  return {
    date,
    lessonNumber,
    className,
    subjectName,
    classId: text(o.classId) || classIdFor(className),
    subjectId: text(o.subjectId) || subjectIdFor(subjectName),
    groupId: text(o.groupId) || groupIdFor(className, subjectName),
    ...(text(o.startTime) ? { startTime: text(o.startTime) } : {}),
    ...(text(o.room) ? { room: text(o.room) } : {}),
    ...(o.planned ? { planned: true } : {}),
  };
}

export function normalisiereKompetenz(raw){
  const o = (raw && typeof raw === 'object') ? raw : { label: raw };
  const label = normalisiereEtikett(o.label ?? o.name);
  if (!label) return null;
  return {
    label,
    area: text(o.area) || 'custom',
    areaName: text(o.areaName),
    source: o.source === 'system' ? 'system' : 'custom',
  };
}

export function normalisiereSprechabsicht(raw){
  const o = (raw && typeof raw === 'object') ? raw : { label: raw };
  const label = normalisiereEtikett(o.label ?? o.name);
  if (!label) return null;
  return { label, source: o.source === 'system' ? 'system' : 'custom' };
}

export function normalisiereScaffoldVorlage(raw){
  const o = (raw && typeof raw === 'object') ? raw : { label: raw };
  const label = normalisiereEtikett(o.label ?? o.name);
  if (!label) return null;
  return { label, type: text(o.type) || 'linguistic' };
}

function etikettenListe(raw){
  const gesehen = new Set();
  const out = [];
  for (const e of liste(raw)) {
    const label = normalisiereEtikett(typeof e === 'object' ? (e?.label ?? e?.name) : e);
    if (!label) continue;
    const key = vergleichsSchluessel(label);
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(label);
  }
  return out;
}

function etikettObjekte(raw, normalisierer){
  const gesehen = new Set();
  const out = [];
  for (const e of liste(raw)) {
    const o = normalisierer(e);
    if (!o) continue;
    const key = vergleichsSchluessel(o.label);
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(o);
  }
  return out;
}

/* ---- Das Profil ------------------------------------------------------ */

export function normalisiereProfil(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};

  const classes = eindeutig(liste(o.classes).map(normalisiereKlasse).filter(Boolean));
  const subjects = eindeutig(liste(o.subjects).map(normalisiereFach).filter(Boolean));
  const groups = eindeutig(liste(o.groups).map(normalisiereGruppe).filter(Boolean));

  const profil = {
    format: FORMAT_PROFILE,
    schemaVersion: EXCHANGE_SCHEMA_VERSION,
    exportedAt: text(o.exportedAt) || new Date().toISOString(),
    languageMode: Boolean(o.languageMode),
    classes,
    subjects,
    groups,
    timetable: liste(o.timetable).map(normalisiereStundenplanEintrag).filter(Boolean),
    competencies: etikettObjekte(o.competencies, normalisiereKompetenz),
    speechActs: etikettObjekte(o.speechActs, normalisiereSprechabsicht),
    socialForms: etikettenListe(o.socialForms),
    phaseTypes: etikettenListe(o.phaseTypes),
    scaffoldTemplates: etikettObjekte(o.scaffoldTemplates, normalisiereScaffoldVorlage),
    lessonTimes: liste(o.lessonTimes).map((t)=>{
      const e = (t && typeof t === 'object') ? t : {};
      const start = text(e.start ?? e.startTime);
      const end = text(e.end ?? e.endTime);
      return (start || end) ? { start, end } : null;
    }).filter(Boolean),
  };

  const app = (o.app && typeof o.app === 'object') ? o.app : null;
  if (app) {
    const name = text(app.name);
    const version = text(app.version);
    if (name || version) profil.app = { ...(name ? { name } : {}), ...(version ? { version } : {}) };
  }

  return profil;
}

/* Was nach dem Import gemeldet wird: "4 Lerngruppen, 2 Fächer,
   18 Kompetenzen, 23 Sprechabsichten". */
export function profilUmfang(profil){
  const p = (profil && typeof profil === 'object') ? profil : {};
  return {
    groups: liste(p.groups).length,
    classes: liste(p.classes).length,
    subjects: liste(p.subjects).length,
    competencies: liste(p.competencies).length,
    speechActs: liste(p.speechActs).length,
    timetable: liste(p.timetable).length,
    socialForms: liste(p.socialForms).length,
    phaseTypes: liste(p.phaseTypes).length,
  };
}

export function leseProfil(objekt){
  if (!objekt || typeof objekt !== 'object' || Array.isArray(objekt)) {
    throw keinGueltigerExport('Prép-ybara-Profil');
  }
  if (String(objekt.format || '') !== FORMAT_PROFILE) throw keinGueltigerExport('Prép-ybara-Profil');
  if (!('schemaVersion' in objekt)) throw fehlendeVersion();
  const version = Number(objekt.schemaVersion);
  if (!Number.isFinite(version) || version < 1) throw fehlendeVersion();
  if (version > EXCHANGE_SCHEMA_VERSION) throw zuNeu(version, EXCHANGE_SCHEMA_VERSION);
  return normalisiereProfil(objekt);
}

export function leseProfilDatei(inhalt){
  let objekt = null;
  try { objekt = JSON.parse(String(inhalt ?? '')); }
  catch { throw keinJson(); }
  return leseProfil(objekt);
}
