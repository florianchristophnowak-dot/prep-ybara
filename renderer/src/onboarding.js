/* ============================================================
   Onboarding

   Eine Einführung, die niemand wegklicken muss, weil sie ohnehin kurz
   ist: drei Handlungsschritte bis zur ersten geplanten Stunde, und
   alles Weitere erst dann, wenn es zum ersten Mal gebraucht wird.

   Der Grundsatz dahinter zieht sich durch dieses Modul: ein Schritt
   gilt als erledigt, wenn er WIRKLICH getan wurde – nicht, wenn jemand
   auf "Weiter" geklickt hat. Deshalb wird der Fortschritt aus den Daten
   abgeleitet und nur ergänzend gespeichert. Wer die App schon benutzt
   hat, bekommt keine Einführung mehr angeboten; wer eine Funktion
   bereits benutzt, bekommt sie nicht mehr erklärt.

   In dieser Datei steht nur, was sich ohne Oberfläche entscheiden
   lässt – deshalb ist sie prüfbar:

     - wann eine Datenbank als leer gilt,
     - welcher Schritt gerade dran ist,
     - welcher kontextbezogene Hinweis passt (und welcher nicht mehr),
     - was beim Zurücksetzen passiert.

   Gespeichert wird ausschliesslich lokal, unter `appSettings.onboarding`.
   Es gibt keine Konten, keine Statistik, keine Verbindung nach aussen –
   das Onboarding ändert daran nichts.
   ============================================================ */

import { blockSpanOf, lessonKey, passenZusammen } from './doppelstunde.js';
import { hatNachbereitung } from './nachbereitung.js';

/* Die Fassung der Einführung.

   Sie erlaubt es, später eine NEUE Einführung zu ergänzen, ohne dass
   erledigte Hinweise unkontrolliert wieder auftauchen: Was als
   verstanden vermerkt ist, bleibt es. Nur ausdrücklich neue Hinweise
   erscheinen. */
export const ONBOARDING_VERSION = 1;

export const STATUS = {
  NEU: 'neu',
  AKTIV: 'aktiv',
  PAUSIERT: 'pausiert',
  ABGESCHLOSSEN: 'abgeschlossen',
  UEBERSPRUNGEN: 'uebersprungen',
};

const STATUS_WERTE = new Set(Object.values(STATUS));

export const PFADE = {
  STUNDE: 'stunde',
  STUNDENPLAN: 'stundenplan',
  IMPORT: 'import',
  ERKUNDEN: 'erkunden',
};

/* Die drei Pflichtschritte. Mehr sind es nicht – die Zahl steht in der
   Checkliste und ist damit ein Versprechen. */
export const SCHRITTE = ['lerngruppe', 'stunde', 'phase'];

export const SCHRITT_TEXT = {
  lerngruppe: 'Lerngruppe eingetragen',
  stunde: 'erste Stunde angelegt',
  phase: 'erste Unterrichtsphase geplant',
};

/* ---- Zustand ---------------------------------------------------------- */

export function leeresOnboarding(){
  return {
    version: ONBOARDING_VERSION,
    status: STATUS.NEU,
    pfad: '',
    schritte: {},          // id -> Zeitstempel des Abschlusses
    hinweise: {},          // id -> { status: 'verstanden' | 'nie', at }
    checkliste: { sichtbar: true, eingeklappt: false },
    gestartetAm: '',
    beendetAm: '',
    letztesBackup: '',
  };
}

const text = (v)=> String(v ?? '').trim();

/* Aus irgendeinem gespeicherten Stand einen gültigen machen.

   Rein additiv: Eine Datenbank aus einer früheren Fassung trägt das Feld
   gar nicht und bekommt hier den Anfangszustand. Ein Backup von heute
   bleibt in einer älteren Fassung lesbar, weil nichts umgeschrieben
   wird, was sie nicht kennt. */
export function normalisiereOnboarding(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const basis = leeresOnboarding();

  const schritte = {};
  const rohSchritte = (o.schritte && typeof o.schritte === 'object') ? o.schritte : {};
  for (const id of SCHRITTE) {
    const wert = rohSchritte[id];
    if (!wert) continue;
    schritte[id] = (typeof wert === 'string') ? wert : new Date().toISOString();
  }

  const hinweise = {};
  const rohHinweise = (o.hinweise && typeof o.hinweise === 'object') ? o.hinweise : {};
  for (const [id, wert] of Object.entries(rohHinweise)) {
    if (!id) continue;
    /* Zwei Formen werden gelesen: das Objekt von heute und die blosse
       Kennzeichnung "erledigt", falls je eine kürzere Form entsteht. */
    const status = (wert && typeof wert === 'object') ? text(wert.status) : (wert ? 'verstanden' : '');
    if (status !== 'verstanden' && status !== 'nie') continue;
    hinweise[id] = { status, at: (wert && typeof wert === 'object') ? text(wert.at) : '' };
  }

  const checkliste = (o.checkliste && typeof o.checkliste === 'object') ? o.checkliste : {};

  return {
    ...basis,
    version: Number.isFinite(Number(o.version)) && Number(o.version) > 0 ? Number(o.version) : ONBOARDING_VERSION,
    status: STATUS_WERTE.has(text(o.status)) ? text(o.status) : basis.status,
    pfad: Object.values(PFADE).includes(text(o.pfad)) ? text(o.pfad) : '',
    schritte,
    hinweise,
    checkliste: {
      sichtbar: checkliste.sichtbar === undefined ? true : Boolean(checkliste.sichtbar),
      eingeklappt: Boolean(checkliste.eingeklappt),
    },
    gestartetAm: text(o.gestartetAm),
    beendetAm: text(o.beendetAm),
    letztesBackup: text(o.letztesBackup),
  };
}

/* ---- Ist hier schon geplant worden? -----------------------------------

   Die Einführung erscheint nur bei einer wirklich leeren Datenbank.
   "Leer" heisst: keine Stunde, keine Sequenz, keine Vorlage, kein
   Jahresbalken, kein To-do, kein Archiv – und kein Schulkalender, in dem
   schon etwas eingerichtet wurde.

   Bewusst grosszügig gefasst: Lieber einmal keine Einführung anbieten,
   als sie jemandem vorsetzen, der längst arbeitet. */
export function istLeereDatenbank(db){
  if (!db || typeof db !== 'object') return true;

  for (const woche of Object.values(db.weeks || {})) {
    for (const l of Object.values(woche?.lessons || {})) {
      if (l) return false;
    }
    if (Object.keys(woche?.duties || {}).length) return false;
  }
  if (Object.keys(db.sequences || {}).length) return false;
  if (Object.keys(db.sequenceTemplates || {}).length) return false;
  if ((Array.isArray(db.yearBars) ? db.yearBars : []).length) return false;
  if ((Array.isArray(db.yearPlanLanes) ? db.yearPlanLanes : []).length) return false;
  if ((Array.isArray(db.todos) ? db.todos : []).length) return false;
  if ((Array.isArray(db.schoolYearArchives) ? db.schoolYearArchives : []).length) return false;

  /* Vorschlagslisten entstehen nur durch Benutzung. Sie sind deshalb ein
     verlässliches Zeichen dafür, dass hier schon jemand gearbeitet hat –
     auch wenn die Stunden inzwischen gelöscht wurden. */
  if (Object.keys(db.classGroups || {}).length) return false;
  if (Object.keys(db.subjects || {}).length) return false;
  if (Object.keys(db.groupColors || {}).length) return false;

  const cal = db.schoolCalendar || {};
  if ((Array.isArray(cal.vacations) ? cal.vacations : []).length) return false;
  if ((Array.isArray(cal.freeDays) ? cal.freeDays : []).length) return false;
  if ((Array.isArray(cal.events) ? cal.events : []).length) return false;
  if ((Array.isArray(cal.lessonTimes) ? cal.lessonTimes : []).length) return false;

  return true;
}

/* ---- Fortschritt aus den Daten ----------------------------------------

   Nicht aus Klicks, sondern aus dem, was in der Datenbank steht. Wer die
   Einführung neu startet und schon Stunden hat, sieht die Schritte
   deshalb sofort als erledigt – und niemand muss etwas nachholen, das
   längst getan ist. */
export function datenSchritte(db){
  let lerngruppe = false;
  let stunde = false;
  let phase = false;

  for (const woche of Object.values(db?.weeks || {})) {
    for (const l of Object.values(woche?.lessons || {})) {
      if (!l) continue;
      stunde = true;
      if (text(l.classGroup) && text(l.subject)) lerngruppe = true;
      /* Eine frisch angelegte Stunde bringt vier Phasen mit Namen mit.
         Geplant ist eine Phase erst, wenn etwas darin steht. */
      for (const p of (Array.isArray(l.phases) ? l.phases : [])) {
        if (text(p?.socialForm) || text(p?.content) || text(p?.materialsMedia) || text(p?.remarks)) phase = true;
      }
      if (lerngruppe && phase) return { lerngruppe, stunde, phase };
    }
  }
  return { lerngruppe, stunde, phase };
}

/* Die Schritte, wie die Checkliste sie zeigt: was in den Daten steht,
   ergänzt um das, was während der Einführung vermerkt wurde (etwa das
   blosse Öffnen einer Stunde). */
export function schritteAus(db, zustand){
  const aus = datenSchritte(db);
  const vermerkt = normalisiereOnboarding(zustand).schritte;
  const out = {};
  for (const id of SCHRITTE) out[id] = Boolean(aus[id] || vermerkt[id]);
  return out;
}

export function anzahlErledigt(schritte){
  return SCHRITTE.filter(id => schritte?.[id]).length;
}

export function schnellstartFertig(schritte){
  return SCHRITTE.every(id => schritte?.[id]);
}

/* ---- Welcher Hinweis ist jetzt dran? ----------------------------------

   Die Reihenfolge ist die des Schnellstarts. Ein Schritt wird erst
   gezeigt, wenn der vorherige wirklich erledigt ist – deshalb genügt
   die erste Bedingung, die nicht zutrifft.

   `entwurf` ist der Stand der gerade geöffneten Stunde, bevor er
   gespeichert wurde. Ohne ihn hinkte die Führung dem Tippen hinterher. */
export function schnellstartSchritt({ ansicht = '', entwurf = null, schritte = {} } = {}){
  if (ansicht !== 'lesson') {
    return schritte.stunde ? '' : 'stunde';
  }
  const e = entwurf || {};
  if (!e.lerngruppe) return 'lerngruppe';
  if (!e.thema) return 'thema';
  if (!e.lernziel) return 'lernziel';
  if (!e.phase) return 'phase';
  return 'abschluss';
}

/* Die Texte der Führung. Sie stehen hier und nicht in der Oberfläche,
   damit sie zusammen mit ihren Bedingungen gelesen werden können. */
export const SCHNELLSTART_TEXTE = {
  stunde: {
    titel: 'Erste Stunde',
    text: 'Klicke auf den Zeitpunkt deiner ersten Stunde.',
    ziel: 'wochen-freier-platz',
  },
  lerngruppe: {
    titel: 'Lerngruppe',
    text: 'Eine Lerngruppe besteht in Prép-ybara aus Klasse/Kurs und Fach.',
    ziel: 'stunde-lerngruppe',
  },
  thema: {
    titel: 'Thema',
    text: 'Worum geht es in dieser Stunde? Ein Stichwort genügt.',
    ziel: 'stunde-thema',
  },
  lernziel: {
    titel: 'Lernziel',
    text: 'Was sollen die Lernenden danach können? Auch das darf knapp sein.',
    ziel: 'stunde-lernziele',
  },
  phase: {
    titel: 'Erste Phase',
    text: 'Trage in einer Phase ein, was passiert – Sozialform oder Inhalt genügt.',
    ziel: 'stunde-phasen',
  },
  abschluss: {
    titel: 'Deine erste Stunde ist geplant.',
    text: 'Das war der Schnellstart. Alles Weitere erklärt Prép-ybara dann, wenn du es brauchst.',
    ziel: 'stunde-phasen',
  },
};

/* Der einmalige Hinweis nach der ersten Phase. Er gehört zum
   Schnellstart, ist aber kein Schritt: er verlangt nichts. */
export const PHASEN_HINWEIS = {
  id: 'phasen-verschieben',
  titel: 'Phasen anpassen',
  text: 'Du kannst Phasen per Drag-and-drop verschieben und ihre Dauer anpassen.',
};

/* ---- Zustandsübergänge ------------------------------------------------

   Alle geben einen NEUEN Zustand zurück und ändern nichts an dem, was
   sie bekommen. Unterrichtsdaten kommen hier nirgends vor – auch nicht
   beim Zurücksetzen. */
export function starteOnboarding(zustand, { pfad = '', jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  return {
    ...z,
    version: ONBOARDING_VERSION,
    status: STATUS.AKTIV,
    pfad: Object.values(PFADE).includes(pfad) ? pfad : z.pfad,
    gestartetAm: z.gestartetAm || jetzt,
    beendetAm: '',
    checkliste: { ...z.checkliste, sichtbar: true },
  };
}

export function pausiereOnboarding(zustand){
  const z = normalisiereOnboarding(zustand);
  if (z.status === STATUS.ABGESCHLOSSEN) return z;
  return { ...z, status: STATUS.PAUSIERT };
}

export function ueberspringeOnboarding(zustand, { jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  return {
    ...z,
    status: STATUS.UEBERSPRUNGEN,
    beendetAm: jetzt,
    checkliste: { ...z.checkliste, sichtbar: false },
  };
}

export function schliesseOnboardingAb(zustand, { jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  return { ...z, status: STATUS.ABGESCHLOSSEN, beendetAm: jetzt };
}

export function markiereSchritt(zustand, id, { jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  if (!SCHRITTE.includes(id) || z.schritte[id]) return z;
  return { ...z, schritte: { ...z.schritte, [id]: jetzt } };
}

export function setzeCheckliste(zustand, patch){
  const z = normalisiereOnboarding(zustand);
  return { ...z, checkliste: { ...z.checkliste, ...(patch || {}) } };
}

export function setzeBackupZeitpunkt(zustand, jetzt = new Date().toISOString()){
  const z = normalisiereOnboarding(zustand);
  return { ...z, letztesBackup: jetzt };
}

/* Den Schnellstart neu starten: Status und Schritte auf Anfang, die
   verstandenen Hinweise bleiben. Wer die Einführung wiederholt, will
   nicht alles noch einmal erklärt bekommen. */
export function starteSchnellstartNeu(zustand, { jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  return {
    ...z,
    version: ONBOARDING_VERSION,
    status: STATUS.AKTIV,
    pfad: '',
    schritte: {},
    gestartetAm: jetzt,
    beendetAm: '',
    checkliste: { sichtbar: true, eingeklappt: false },
  };
}

/* Die kontextbezogenen Hinweise zurücksetzen: Sie dürfen wieder
   erscheinen, wenn ihre Situation erneut entsteht. Am Schnellstart und
   an den Daten ändert das nichts. */
export function setzeHinweiseZurueck(zustand){
  const z = normalisiereOnboarding(zustand);
  return { ...z, hinweise: {} };
}

/* ---- Kontextbezogene Hinweise ----------------------------------------

   Ein Hinweis erscheint, wenn seine Situation zum ersten Mal entsteht –
   und nie, wenn die Funktion offensichtlich schon benutzt wird. Das ist
   der Unterschied zwischen einer Erklärung und einer Belehrung.

   `bedingung` bekommt den Kontext (siehe onboardingKontext) und
   entscheidet allein daraus. Keine Zeitschaltung, keine Zufallsauswahl. */
export const HINWEISE = [
  {
    id: 'doppelstunde',
    titel: 'Zwei Stunden hintereinander',
    text: 'Zwei aufeinanderfolgende Stunden derselben Lerngruppe lassen sich zu einer Doppelstunde verbinden – öffne eine davon und wähle „Als Doppelstunde verbinden".',
    ziel: 'nav-week',
    bedingung: (k)=> k.ansicht === 'week' && k.hatBenachbarte && !k.hatDoppelstunde,
  },
  {
    id: 'makro',
    titel: 'Stunden und Sequenzen',
    text: 'Im Makro-Plan siehst du mehrere Wochen am Stück. Ordnest du Stunden derselben Sequenz zu, wird ihr Verlauf hier sichtbar – die Sequenz ist die Klammer über die einzelne Stunde hinaus.',
    ziel: 'nav-macro',
    bedingung: (k)=> k.ansicht === 'macro' && !k.hatSequenzen,
  },
  {
    id: 'jahresplanung',
    titel: 'Balken sind Orientierung',
    text: 'Die Balken der Jahresplanung sind zunächst nur eine Übersicht: Sie verschieben keine Stunden und erscheinen in keinem Export. Später kannst du einen Balken mit einer Sequenz verknüpfen.',
    ziel: 'nav-year',
    bedingung: (k)=> k.ansicht === 'year' && !k.hatBalken,
  },
  {
    id: 'bibliothek',
    titel: 'Sequenz oder Vorlage?',
    text: 'Eine Sequenz gehört zu diesem Schuljahr und liegt auf echten Terminen. Eine Vorlage ist ihr Abzug ohne Termine – zum Wiederverwenden im nächsten Jahr.',
    ziel: 'nav-library',
    bedingung: (k)=> k.ansicht === 'library' && !k.hatVorlagen,
  },
  {
    id: 'durchfuehrung',
    titel: 'Durchführung',
    text: 'Die Durchführungsansicht zeigt deine Phasen gross, mit Timer. Der Wechsel zur nächsten Phase geschieht auf Klick – an der Planung ändert sie nichts.',
    ziel: '',
    bedingung: (k)=> k.ereignis === 'durchfuehrung',
  },
  {
    id: 'nachbereitung',
    titel: 'Nachbereiten',
    text: 'Eine gehaltene Stunde kannst du nachbereiten: festhalten, was offen blieb, und es in die nächste Stunde mitnehmen. Du findest es in der Stunde unter „Nachbereiten".',
    ziel: '',
    bedingung: (k)=> (k.ansicht === 'week' || k.ansicht === 'today') && k.hatVergangeneStunde && !k.hatNachbereitung,
  },
  {
    id: 'pocket',
    titel: 'Pocket ohne Cloud',
    text: 'Der Austausch mit Prép-ybara Pocket läuft über Dateien: Profil exportieren, auf dem Telefon planen, Datei zurückspielen. Es gibt keine Verbindung und keine gemeinsame Datenbank.',
    ziel: '',
    bedingung: (k)=> k.ansicht === 'pocket',
  },
  {
    id: 'backup',
    titel: 'Zeit für ein Backup',
    text: 'Du hast inzwischen einiges geplant. Ein Backup ist eine einzelne Datei auf deinem Gerät – lege sie am besten regelmässig neben deine Unterlagen.',
    ziel: '',
    bedingung: (k)=> k.ansicht === 'week' && k.stundenAnzahl >= 5 && !k.letztesBackup,
  },
];

export function hinweisNach(id){
  return HINWEISE.find(h => h.id === String(id || '')) || null;
}

/* Die Tatsachen, aus denen die Bedingungen entscheiden. Alles davon
   steht in den Daten – bis auf Ansicht und Ereignis, die aus der
   Bedienung kommen. */
export function onboardingKontext(db, { ansicht = '', ereignis = '', heuteISO = '', zustand = null } = {}){
  const z = normalisiereOnboarding(zustand);
  let stundenAnzahl = 0;
  let hatDoppelstunde = false;
  let hatBenachbarte = false;
  let hatNachbereitet = false;
  let hatVergangeneStunde = false;
  const sequenzenMitStunden = new Set();

  for (const [weekStart, woche] of Object.entries(db?.weeks || {})) {
    const lessons = woche?.lessons || {};
    for (const [key, l] of Object.entries(lessons)) {
      if (!l) continue;
      stundenAnzahl += 1;
      if (blockSpanOf(l) > 1) hatDoppelstunde = true;
      if (text(l.sequenceId)) sequenzenMitStunden.add(text(l.sequenceId));
      if (hatNachbereitung(l.review)) hatNachbereitet = true;

      const [di, si] = String(key).split('-').map(Number);
      if (Number.isFinite(di) && Number.isFinite(si)) {
        if (heuteISO && text(l.topic)) {
          const datum = datumImRaster(weekStart, di);
          if (datum && datum < heuteISO) hatVergangeneStunde = true;
        }
        const nachbar = lessons[lessonKey(di, si + blockSpanOf(l))];
        if (nachbar && passenZusammen(l, nachbar) && blockSpanOf(l) === 1 && blockSpanOf(nachbar) === 1) {
          hatBenachbarte = true;
        }
      }
    }
  }

  return {
    ansicht: String(ansicht || ''),
    ereignis: String(ereignis || ''),
    stundenAnzahl,
    hatDoppelstunde,
    hatBenachbarte,
    hatSequenzen: sequenzenMitStunden.size > 0,
    hatBalken: (Array.isArray(db?.yearBars) ? db.yearBars : []).length > 0,
    hatVorlagen: Object.keys(db?.sequenceTemplates || {}).length > 0,
    hatNachbereitung: hatNachbereitet,
    hatVergangeneStunde,
    letztesBackup: z.letztesBackup,
  };
}

function datumImRaster(weekStart, dayIndex){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekStart || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + (Number(dayIndex) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Der Hinweis, der jetzt erscheinen darf – oder keiner.

   Drei Filter liegen davor, und jeder von ihnen darf allein "nein"
   sagen:

     - Was als verstanden oder dauerhaft ausgeblendet vermerkt ist,
       kommt nie wieder.
     - Was in dieser Sitzung schon gezeigt oder auf später vertagt
       wurde, kommt in dieser Sitzung nicht mehr.
     - Höchstens EIN Hinweis je Sitzung. Zwei wären schon eine Tour. */
export function naechsterHinweis({ zustand, kontext, sitzung = {} } = {}){
  const z = normalisiereOnboarding(zustand);
  const { gezeigt = false, vertagt = [] } = sitzung || {};
  if (gezeigt) return null;
  const vertagtSet = new Set(vertagt);
  for (const hinweis of HINWEISE) {
    if (z.hinweise[hinweis.id]) continue;
    if (vertagtSet.has(hinweis.id)) continue;
    let passt = false;
    try { passt = Boolean(hinweis.bedingung(kontext || {})); } catch { passt = false; }
    if (passt) return hinweis;
  }
  return null;
}

/* Die Antwort auf einen Hinweis.

   "Verstanden" und "Nicht mehr anzeigen" sind dauerhaft – der
   Unterschied liegt im Ton, nicht in der Wirkung, und beides wird
   gespeichert. "Später" wird bewusst NICHT gespeichert: Es gilt für
   diese Sitzung und darf in einer späteren wiederkommen. */
export function merkeHinweis(zustand, id, wahl, { jetzt = new Date().toISOString() } = {}){
  const z = normalisiereOnboarding(zustand);
  const status = (wahl === 'nie') ? 'nie' : (wahl === 'verstanden' ? 'verstanden' : '');
  if (!status || !id) return z;
  return { ...z, hinweise: { ...z.hinweise, [id]: { status, at: jetzt } } };
}

export function istHinweisErledigt(zustand, id){
  return Boolean(normalisiereOnboarding(zustand).hinweise[String(id || '')]);
}

/* ---- Wo die Einführung ansetzt ----------------------------------------

   Der erste freie Stundenplatz der Woche: dort wird beim Schnellstart
   der Hinweis verankert. Bewusst der erste FREIE – ein belegter Platz
   wäre eine Aufforderung, etwas zu überschreiben. */
export function ersterFreierPlatz(db, weekStart, { tage = 5, slots = 6 } = {}){
  const woche = db?.weeks?.[weekStart];
  const lessons = woche?.lessons || {};
  const anzahl = Number(woche?.slotsPerDay) || slots;
  for (let slotIndex = 0; slotIndex < anzahl; slotIndex++) {
    for (let dayIndex = 0; dayIndex < tage; dayIndex++) {
      if (!lessons[lessonKey(dayIndex, slotIndex)]) return { dayIndex, slotIndex };
    }
  }
  return null;
}

/* Soll die Willkommensansicht erscheinen?

   Nur bei leerer Datenbank und nur, solange niemand entschieden hat.
   "Pausiert" zählt dazu: Wer "Später" gewählt hat, bekommt sie beim
   nächsten Start wieder – solange noch nichts geplant wurde. */
export function zeigeWillkommen(db, zustand){
  const z = normalisiereOnboarding(zustand);
  if (z.status === STATUS.ABGESCHLOSSEN || z.status === STATUS.UEBERSPRUNGEN || z.status === STATUS.AKTIV) return false;
  return istLeereDatenbank(db);
}

/* Soll die Checkliste erscheinen? Nur während des Schnellstarts, nur
   solange sie nicht ausgeblendet wurde – und nur, solange es noch etwas
   zu tun gibt. */
export function zeigeCheckliste(db, zustand){
  const z = normalisiereOnboarding(zustand);
  if (z.status !== STATUS.AKTIV) return false;
  if (!z.checkliste.sichtbar) return false;
  return !schnellstartFertig(schritteAus(db, z));
}
