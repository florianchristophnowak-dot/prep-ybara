/* ============================================================
   Das Datenmodell von Pocket

   Ein einziges Entwurfsmodell für alles. Schnellplanung und
   Detailplanung sind nicht zwei Datenformen, sondern zwei Ansichten
   auf dieselbe – deshalb kann ein schnell erfasster Entwurf später
   ohne Umwandlung in der Detailplanung geöffnet und ergänzt werden.

   Die Felder heissen wie im Austauschformat. Das erspart eine
   Übersetzungsschicht: der Export ist im Wesentlichen ein Filter, kein
   Umbau. Genau deshalb bleibt der Weg zum Desktop überschaubar.

   Unterrichtsideen sind bewusst eine eigene, viel kleinere Form. Eine
   Idee ist kein halbfertiger Entwurf, sondern ein Satz. Erst
   "In Stunde umwandeln" macht daraus einen Entwurf.
   ============================================================ */

import {
  neueId, neueExternalId, normalisiereEtikett, vergleichsSchluessel,
  normalisiereStunde, gesamtdauer,
} from '../../shared/exchange/index.js';
import { POCKET_NAME, POCKET_VERSION } from './version.js';

export const ART_STUNDE = 'lesson';
export const ART_SCHNELL = 'quick';

function jetzt(){ return new Date().toISOString(); }
function text(x){ return String(x ?? ''); }

export function leerePhase(vorgabe = {}){
  return {
    id: neueId('phase'),
    title: text(vorgabe.title),
    duration: Number.isFinite(Number(vorgabe.duration)) ? Number(vorgabe.duration) : 10,
    content: text(vorgabe.content),
    socialForm: text(vorgabe.socialForm),
    material: text(vorgabe.material),
    materialLink: text(vorgabe.materialLink),
    remarks: text(vorgabe.remarks),
    scaffolds: [],
  };
}

export function leererScaffold(vorgabe = {}){
  return {
    id: neueId('sc'),
    type: vorgabe.type || 'linguistic',
    label: text(vorgabe.label),
    note: text(vorgabe.note),
  };
}

export function neuerEntwurf(vorgabe = {}){
  const zeit = jetzt();
  return {
    id: neueId('draft'),
    externalId: neueExternalId(),
    kind: vorgabe.kind === ART_SCHNELL ? ART_SCHNELL : ART_STUNDE,

    classId: text(vorgabe.classId),
    className: normalisiereEtikett(vorgabe.className),
    subjectId: text(vorgabe.subjectId),
    subjectName: normalisiereEtikett(vorgabe.subjectName),
    groupId: text(vorgabe.groupId),

    date: text(vorgabe.date),
    lessonNumber: Number(vorgabe.lessonNumber) || null,

    topic: text(vorgabe.topic),
    learningGoals: Array.isArray(vorgabe.learningGoals) ? vorgabe.learningGoals.map(text) : [''],
    successCriteria: [],
    competencies: [],
    primaryCompetency: '',
    communicativeTask: { text: '', situation: '', audience: '', intention: '', outcome: '' },
    speechActs: [],
    languageResources: { vocabulary: '', grammar: '', pronunciation: '', other: '' },
    phases: Array.isArray(vorgabe.phases) ? vorgabe.phases : [],
    notes: text(vorgabe.notes),

    createdAt: zeit,
    updatedAt: zeit,
    exportedAt: '',
  };
}

export function neueIdee(vorgabe = {}){
  const zeit = jetzt();
  return {
    id: neueId('idea'),
    classId: text(vorgabe.classId),
    className: normalisiereEtikett(vorgabe.className),
    subjectId: text(vorgabe.subjectId),
    subjectName: normalisiereEtikett(vorgabe.subjectName),
    groupId: text(vorgabe.groupId),
    note: text(vorgabe.note),
    createdAt: zeit,
    updatedAt: zeit,
  };
}

/* Aus einer Idee wird eine Stunde. Die Notiz wandert in die Notiz der
   Stunde – nicht ins Thema: "Fotos verschiedener Freizeitangebote
   verteilen" ist kein Stundenthema, sondern der Einfall, aus dem eines
   werden soll. Das Thema bleibt leer und wartet auf die Formulierung. */
export function ideeZuEntwurf(idee){
  return neuerEntwurf({
    classId: idee?.classId,
    className: idee?.className,
    subjectId: idee?.subjectId,
    subjectName: idee?.subjectName,
    groupId: idee?.groupId,
    notes: idee?.note,
  });
}

/* Eine Kopie ist ein eigener Entwurf – mit eigener id UND eigener
   externalId. Ohne neue externalId hielte der Desktop die Kopie für
   einen zweiten Import desselben Entwurfs. */
export function dupliziereEntwurf(entwurf){
  const zeit = jetzt();
  return {
    ...entwurf,
    id: neueId('draft'),
    externalId: neueExternalId(),
    topic: entwurf.topic ? `${entwurf.topic} (Kopie)` : '',
    phases: (entwurf.phases || []).map(p => ({
      ...p,
      id: neueId('phase'),
      scaffolds: (p.scaffolds || []).map(sc => ({ ...sc, id: neueId('sc') })),
    })),
    createdAt: zeit,
    updatedAt: zeit,
    exportedAt: '',
  };
}

/* ---- Phasen ---------------------------------------------------------- */

export function phaseHinzu(phasen, vorgabe){
  return [...(phasen || []), leerePhase(vorgabe)];
}

export function phaseAendern(phasen, id, patch){
  return (phasen || []).map(p => p.id === id ? { ...p, ...patch } : p);
}

export function phaseWeg(phasen, id){
  return (phasen || []).filter(p => p.id !== id);
}

export function phaseKopieren(phasen, id){
  const liste = phasen || [];
  const index = liste.findIndex(p => p.id === id);
  if (index < 0) return liste;
  const kopie = {
    ...liste[index],
    id: neueId('phase'),
    scaffolds: (liste[index].scaffolds || []).map(sc => ({ ...sc, id: neueId('sc') })),
  };
  return [...liste.slice(0, index + 1), kopie, ...liste.slice(index + 1)];
}

/* Verschieben mit ↑/↓. Bewusst ohne Berührungs-Drag: das ist auf einem
   Telefon fehleranfällig, verlangt eine ruhige Hand und macht die
   Reihenfolge im Zweifel kaputt statt richtig. Zwei Knöpfe sind
   langweilig und funktionieren immer. */
export function phaseVerschieben(phasen, id, richtung){
  const liste = [...(phasen || [])];
  const index = liste.findIndex(p => p.id === id);
  if (index < 0) return liste;
  const ziel = index + (richtung < 0 ? -1 : 1);
  if (ziel < 0 || ziel >= liste.length) return liste;
  [liste[index], liste[ziel]] = [liste[ziel], liste[index]];
  return liste;
}

export function dauerSumme(phasen){
  return (phasen || []).reduce((summe, p) => summe + (Number(p?.duration) || 0), 0);
}

/* ---- Anzeige --------------------------------------------------------- */

export function entwurfTitel(entwurf){
  const t = String(entwurf?.topic || '').trim();
  if (t) return t;
  const ziel = (entwurf?.learningGoals || []).map(z => String(z || '').trim()).find(Boolean);
  if (ziel) return ziel;
  const aufgabe = String(entwurf?.communicativeTask?.text || '').trim();
  if (aufgabe) return aufgabe;
  const notiz = String(entwurf?.notes || '').trim();
  if (notiz) return notiz.split('\n')[0];
  return 'Ohne Titel';
}

/* "1 Fach", nicht "1 Fächer". Eine Zeile, die man einmal schreibt und
   nie wieder ansieht – ohne sie liest sich aber jede Meldung falsch. */
export function zahlwort(anzahl, einzahl, mehrzahl){
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`;
}

export function gruppenBeschriftung(objekt){
  return [normalisiereEtikett(objekt?.className), normalisiereEtikett(objekt?.subjectName)]
    .filter(Boolean).join(' ');
}

export function istLeererEntwurf(entwurf){
  if (!entwurf) return true;
  const e = entwurf;
  return !String(e.topic || '').trim()
    && !(e.learningGoals || []).some(z => String(z || '').trim())
    && !(e.phases || []).length
    && !String(e.notes || '').trim()
    && !String(e.communicativeTask?.text || '').trim()
    && !(e.competencies || []).length;
}

/* ---- Export ---------------------------------------------------------- */

/* Woher ein Etikett stammt – für die Rückfrage im Desktop. Was im
   Profil steht, war dort schon bekannt; alles andere ist in Pocket
   entstanden. */
function quelleAus(profilListe, label){
  const key = vergleichsSchluessel(label);
  const treffer = (profilListe || []).find(e => vergleichsSchluessel(e.label) === key);
  if (!treffer) return 'custom';
  return treffer.source === 'system' ? 'system' : 'profile';
}

/* Aus dem Entwurf wird die Austauschform. Leere Felder fallen in
   normalisiereStunde() von selbst weg – hier wird nichts von Hand
   gefiltert, damit beide Seiten dieselbe Vorstellung von "leer" haben. */
export function entwurfZuAustausch(entwurf, profil = null){
  const e = entwurf || {};
  return normalisiereStunde({
    externalId: e.externalId,
    kind: e.kind === ART_SCHNELL ? ART_SCHNELL : ART_STUNDE,

    classId: e.classId,
    className: e.className,
    subjectId: e.subjectId,
    subjectName: e.subjectName,
    groupId: e.groupId,

    date: e.date,
    lessonNumber: e.lessonNumber,

    topic: e.topic,
    learningGoals: (e.learningGoals || []).map(t => ({ text: t })),
    successCriteria: e.successCriteria,
    competencies: (e.competencies || []).map(label => ({
      label, source: quelleAus(profil?.competencies, label),
    })),
    primaryCompetency: e.primaryCompetency,
    communicativeTask: e.communicativeTask,
    speechActs: (e.speechActs || []).map(label => ({
      label, source: quelleAus(profil?.speechActs, label),
    })),
    languageResources: e.languageResources,
    phases: e.phases,
    notes: e.notes,

    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    app: { name: POCKET_NAME, version: POCKET_VERSION },
  });
}

export function entwurfDauer(entwurf){
  return gesamtdauer({ phases: entwurf?.phases || [] });
}
