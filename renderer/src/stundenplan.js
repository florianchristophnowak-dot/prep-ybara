/* ============================================================
   Stundenplanvorlagen und Stundenplanmodelle

   Prép-ybara kennt bisher keinen Stundenplan als eigene Sache: Der
   Stundenplan IST das, was in den Wochen steht. Für die wiederkehrende
   Struktur – dienstags dritte Stunde 9b Französisch in A101 – hiess das
   bisher: jede Woche von Hand oder über "in die nächste Woche
   übernehmen".

   Hier kommt die Struktur selbst dazu, und zwar in zwei Ebenen:

     - Eine WOCHENVORLAGE beschreibt eine Woche organisatorisch:
       Wochentag, Stundenplatz, Klasse, Fach, Raum, Einzel- oder
       Doppelstunde. Mehr nicht.
     - Ein STUNDENPLANMODELL fasst die Wochen zu dem zusammen, was für
       einen Zeitraum gilt: eine einzelne Woche, oder ein Zyklus aus
       A- und B-Woche.

   Der Zyklus ist bewusst eine Liste und kein Paar. Ein A-/B-Rhythmus
   ist die Länge 2; eine gleichbleibende Woche die Länge 1. Ein
   dreiwöchiger Rhythmus wäre die Länge 3 – dafür muss hier nichts
   umgebaut werden, nur die Oberfläche müsste ihn anbieten.

   Zwei Regeln ziehen sich durch alles:

     1. Eine Vorlage enthält NIE Planungsinhalt. Thema, Lernziele,
        Phasen, Materialien, Hausaufgaben, Notizen, Sequenzen,
        Nachbereitung – nichts davon wird übernommen, auch nicht
        versehentlich. Was eine Woche zur Vorlage beisteuert, ist genau
        das, was sich jede Woche wiederholt.
     2. Angewendet wird nur auf FREIE Plätze. Eine bestehende Planung
        wird nie stillschweigend überschrieben, eine identische Stunde
        nie doppelt angelegt.

   In dieser Datei steht nur, was sich ohne Oberfläche entscheiden
   lässt – deshalb ist sie prüfbar.
   ============================================================ */

import { blockSpanOf, lessonKey, belegteSlots, normalisiereBlockSpan, MAX_BLOCK_SPAN } from './doppelstunde.js';
import { istSchulfrei, istLeerePlanung, plusTage } from './verschieben.js';

/* ---- Begriffe --------------------------------------------------------- */

export const MODELL_TYP = {
  EINZEL: 'singleWeek',
  WECHSEL: 'alternatingWeeks',
};

export const RHYTHMUS = {
  KALENDERWOCHEN: 'kalenderwochen',
  UNTERRICHTSWOCHEN: 'unterrichtswochen',
};

export const RHYTHMUS_TEXT = {
  [RHYTHMUS.KALENDERWOCHEN]: 'Wechsel nach Kalenderwochen – der Rhythmus läuft auch während der Ferien rechnerisch weiter.',
  [RHYTHMUS.UNTERRICHTSWOCHEN]: 'Wechsel nach Unterrichtswochen – vollständig unterrichtsfreie Wochen werden übersprungen.',
};

/* Die Beschriftung einer Zyklusposition. Länge 1 braucht keine: eine
   gleichbleibende Woche ist einfach "die Woche". */
export const ZYKLUS_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function zyklusLabel(index, laenge = 2){
  if (laenge <= 1) return '';
  return ZYKLUS_LABELS[Number(index) || 0] || String((Number(index) || 0) + 1);
}

/* Der Status einer Zeile in der Anwendungsvorschau. Neutral benannt:
   nichts davon ist ein Fehler der Lehrkraft. */
export const ZEILEN_STATUS = {
  NEU: 'neu',
  IDENTISCH: 'identisch',
  KONFLIKT: 'konflikt',
  FERIEN: 'ferien',
  ERSETZBAR: 'ersetzbar',
};

export const ZEILEN_TEXT = {
  [ZEILEN_STATUS.NEU]: 'wird angelegt',
  [ZEILEN_STATUS.IDENTISCH]: 'schon vorhanden',
  [ZEILEN_STATUS.KONFLIKT]: 'Platz ist belegt',
  [ZEILEN_STATUS.FERIEN]: 'Ferien oder schulfrei',
  [ZEILEN_STATUS.ERSETZBAR]: 'wird ersetzt (leerer Rahmen)',
};

const text = (v)=> String(v ?? '').trim();
const gleich = (a, b)=> text(a).toLowerCase() === text(b).toLowerCase();

function neueId(praefix = 'tt'){
  return `${praefix}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;
}

/* ---- Datumsrechnung ---------------------------------------------------
   Alles rechnet in Montagswochen, wie das Wochenraster der App. */
function fromISO(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toISO(d){
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function montagVon(iso){
  const d = fromISO(iso);
  if (!d) return '';
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

/* Der Abstand zweier Wochen in Wochen – mit Vorzeichen.

   Bewusst als Differenz von Kalendertagen und NICHT über Kalenderwochen-
   nummern: "gerade KW = A-Woche" ist eine Annahme, die zum Jahreswechsel
   und in Schaltwochen bricht. Der Rhythmus hängt allein an der
   Referenzwoche, die die Lehrkraft bestimmt. */
export function wochenAbstand(vonWocheISO, bisWocheISO){
  const a = fromISO(montagVon(vonWocheISO));
  const b = fromISO(montagVon(bisWocheISO));
  if (!a || !b) return 0;
  return Math.round((b - a) / (7 * 86400000));
}

export function plusWochen(weekStartISO, n = 1){
  const ws = montagVon(weekStartISO);
  return ws ? plusTage(ws, 7 * (Number(n) || 0)) : '';
}

export function wochenListe(vonISO, bisISO){
  const start = montagVon(vonISO);
  const ende = montagVon(bisISO);
  if (!start || !ende || ende < start) return [];
  const out = [];
  let aktuell = start;
  // Eine Obergrenze, damit ein vertippter Zeitraum die App nicht anhält.
  for (let i = 0; i < 300 && aktuell <= ende; i++) {
    out.push(aktuell);
    aktuell = plusTage(aktuell, 7);
  }
  return out;
}

/* Eine Woche ohne jeden Unterrichtstag: alle fünf Schultage liegen in
   den Ferien, sind schulfrei oder ausserhalb des Schuljahres. */
export function istUnterrichtsfreieWoche(weekStartISO, schoolCalendar){
  const ws = montagVon(weekStartISO);
  if (!ws) return true;
  const sy = schoolCalendar?.schoolYear || {};
  const von = text(sy.startISO);
  const bis = text(sy.endISO);
  for (let i = 0; i < 5; i++) {
    const tag = plusTage(ws, i);
    if (von && tag < von) continue;
    if (bis && tag > bis) continue;
    if (istSchulfrei(tag, schoolCalendar).frei) continue;
    return false;
  }
  return true;
}

/* ---- Vorlagen ---------------------------------------------------------- */

export function leerenVorlagenEintrag(patch = {}){
  return {
    id: patch.id || neueId('e'),
    dayIndex: Math.max(0, Math.min(4, Number(patch.dayIndex) || 0)),
    slotIndex: Math.max(0, Number(patch.slotIndex) || 0),
    classGroup: text(patch.classGroup),
    subject: text(patch.subject),
    room: text(patch.room),
    blockSpan: normalisiereBlockSpan(patch.blockSpan),
  };
}

export function normalisiereStundenplanVorlage(raw, id = ''){
  const v = (raw && typeof raw === 'object') ? raw : {};
  const eintraege = (Array.isArray(v.eintraege) ? v.eintraege : (Array.isArray(v.entries) ? v.entries : []))
    .map(e => leerenVorlagenEintrag(e))
    /* Ein Eintrag ohne Klasse UND ohne Fach beschreibt nichts. */
    .filter(e => e.classGroup || e.subject);
  const jetzt = new Date().toISOString();
  return {
    id: text(v.id) || text(id) || neueId('vorlage'),
    /* Zu welchem Modell die Vorlage gehört. Leer heisst: eine
       eigenständige Vorlage, die (noch) zu keinem Modell gehört. */
    modelId: text(v.modelId),
    zyklusPosition: Number.isFinite(Number(v.zyklusPosition)) ? Math.max(0, Number(v.zyklusPosition)) : 0,
    name: text(v.name) || 'Wochenvorlage',
    version: Number.isFinite(Number(v.version)) && Number(v.version) > 0 ? Math.round(Number(v.version)) : 1,
    slotsPerDay: Math.max(1, Math.round(Number(v.slotsPerDay) || 6)),
    eintraege,
    createdAt: text(v.createdAt) || jetzt,
    updatedAt: text(v.updatedAt) || text(v.createdAt) || jetzt,
  };
}

/* ---- Modelle ----------------------------------------------------------- */

export function normalisiereStundenplanModell(raw, id = ''){
  const m = (raw && typeof raw === 'object') ? raw : {};
  const jetzt = new Date().toISOString();
  const zyklus = (Array.isArray(m.zyklus) ? m.zyklus : [])
    .map(x => text(x))
    .filter(Boolean)
    .slice(0, ZYKLUS_LABELS.length);
  const typ = (text(m.typ) === MODELL_TYP.WECHSEL || zyklus.length > 1)
    ? MODELL_TYP.WECHSEL
    : MODELL_TYP.EINZEL;

  const ausnahmen = {};
  const rohAusnahmen = (m.ausnahmen && typeof m.ausnahmen === 'object') ? m.ausnahmen : {};
  for (const [woche, wert] of Object.entries(rohAusnahmen)) {
    const ws = montagVon(woche);
    const pos = Number(wert);
    if (!ws || !Number.isFinite(pos) || pos < 0) continue;
    ausnahmen[ws] = Math.round(pos);
  }

  return {
    id: text(m.id) || text(id) || neueId('modell'),
    name: text(m.name) || 'Stundenplan',
    typ,
    zyklus,
    vonISO: text(m.vonISO),
    bisISO: text(m.bisISO),
    aktiv: Boolean(m.aktiv),
    archiviert: Boolean(m.archiviert),
    /* Die Referenzwoche: SIE bestimmt den Rhythmus, nicht die
       Kalenderwochennummer. */
    referenzWocheISO: montagVon(m.referenzWocheISO),
    referenzPosition: Number.isFinite(Number(m.referenzPosition)) ? Math.max(0, Math.round(Number(m.referenzPosition))) : 0,
    wechselregel: (text(m.wechselregel) === RHYTHMUS.UNTERRICHTSWOCHEN)
      ? RHYTHMUS.UNTERRICHTSWOCHEN
      : RHYTHMUS.KALENDERWOCHEN,
    ausnahmen,
    createdAt: text(m.createdAt) || jetzt,
    updatedAt: text(m.updatedAt) || text(m.createdAt) || jetzt,
  };
}

export function zyklusLaenge(modell){
  return Math.max(1, (Array.isArray(modell?.zyklus) ? modell.zyklus : []).length);
}

export function istWechselModell(modell){
  return zyklusLaenge(modell) > 1;
}

/* ---- Die Ablage in der Datenbank --------------------------------------

   Rein additiv. Eine Datenbank ohne diese Felder bekommt leere Ablagen;
   eine Datenbank mit einer alten EINZELNEN Standardvorlage bekommt
   daraus ein Ein-Wochen-Modell. Beides ist verlustfrei und beliebig oft
   wiederholbar. */
export function normalisiereStundenplandaten(db){
  const d = (db && typeof db === 'object') ? db : {};

  const vorlagen = {};
  const rohVorlagen = (d.timetableTemplates && typeof d.timetableTemplates === 'object') ? d.timetableTemplates : {};
  for (const [id, v] of Object.entries(rohVorlagen)) {
    if (!v || typeof v !== 'object') continue;
    const norm = normalisiereStundenplanVorlage(v, id);
    vorlagen[norm.id] = norm;
  }

  let modelle = (Array.isArray(d.timetableModels) ? d.timetableModels : [])
    .map(m => normalisiereStundenplanModell(m))
    .filter(Boolean);

  /* --- Migration: die alte einzelne Standardvorlage -------------------

     Vor den Stundenplanmodellen gab es (in Entwürfen und in fremden
     Datenständen) höchstens EINE Vorlage mit der Kennzeichnung
     "Standard". Sie wird zu einem Ein-Wochen-Modell – dieselbe Sache,
     nur jetzt mit einem Rahmen darum. Die Vorlage selbst bleibt
     unverändert erhalten. */
  const ohneModell = Object.values(vorlagen).filter(v => !v.modelId);
  const alteStandards = ohneModell.filter(v => {
    const roh = rohVorlagen[v.id] || {};
    return Boolean(roh.istStandard || roh.isDefault || roh.standard);
  });
  for (const vorlage of alteStandards) {
    const roh = rohVorlagen[vorlage.id] || {};
    const modell = normalisiereStundenplanModell({
      name: vorlage.name || 'Stundenplan',
      typ: MODELL_TYP.EINZEL,
      zyklus: [vorlage.id],
      vonISO: text(roh.vonISO),
      bisISO: text(roh.bisISO),
      aktiv: true,
      createdAt: vorlage.createdAt,
    });
    vorlagen[vorlage.id] = { ...vorlage, modelId: modell.id, zyklusPosition: 0 };
    modelle = [...modelle, modell];
  }

  /* Verwaiste Verweise sind kein Fehlerfall: Ein Modell, dessen Vorlage
     gelöscht wurde, verliert nur diese Position. */
  modelle = modelle.map(m => ({
    ...m,
    zyklus: m.zyklus.filter(id => vorlagen[id]),
  })).map(m => ({ ...m, typ: m.zyklus.length > 1 ? MODELL_TYP.WECHSEL : m.typ }));

  d.timetableTemplates = vorlagen;
  d.timetableModels = modelle;
  return d;
}

/* ---- Aus einer Woche eine Vorlage machen -------------------------------

   Das ist die heikelste Stelle der ganzen Funktion: Hier wird aus einer
   Woche voller Planung eine Vorlage – und genau hier darf kein einziges
   inhaltliches Feld mitkommen.

   Deshalb wird NICHT kopiert und dann gelöscht, sondern ausdrücklich
   aufgezählt, was übernommen wird. Was künftig an Feldern dazukommt,
   landet damit von selbst nicht in der Vorlage. */
export function vorlagenEintraegeAusWoche(week, { auswahl = null } = {}){
  const lessons = week?.lessons || {};
  const out = [];
  for (const [key, l] of Object.entries(lessons)) {
    if (!l) continue;
    const [dayIndex, slotIndex] = String(key).split('-').map(Number);
    if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
    if (dayIndex > 4) continue;
    if (auswahl && !auswahl.includes(key)) continue;
    const eintrag = leerenVorlagenEintrag({
      dayIndex, slotIndex,
      classGroup: l.classGroup,
      subject: l.subject,
      room: l.room,
      blockSpan: blockSpanOf(l),
    });
    if (!eintrag.classGroup && !eintrag.subject) continue;
    out.push(eintrag);
  }
  out.sort((a, b)=> a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex);
  return out;
}

/* Die Vorschau vor dem Speichern: welche Stunden kämen in die Vorlage,
   und welche davon tragen Planung, die in der Woche bleibt? */
export function wochenVorschau(week){
  const lessons = week?.lessons || {};
  const zeilen = [];
  for (const [key, l] of Object.entries(lessons)) {
    if (!l) continue;
    const [dayIndex, slotIndex] = String(key).split('-').map(Number);
    if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex) || dayIndex > 4) continue;
    const classGroup = text(l.classGroup);
    const subject = text(l.subject);
    if (!classGroup && !subject) continue;
    zeilen.push({
      key,
      dayIndex,
      slotIndex,
      classGroup,
      subject,
      room: text(l.room),
      blockSpan: blockSpanOf(l),
      /* Nur zur Anzeige: "in dieser Stunde steckt Planung, die hier
         bleibt". Sie ändert nichts an dem, was übernommen wird. */
      hatPlanung: !istLeerePlanung(l),
      thema: text(l.topic),
    });
  }
  zeilen.sort((a, b)=> a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex);
  return zeilen;
}

export function vorlageAusWoche(week, { name = 'Wochenvorlage', auswahl = null, modelId = '', zyklusPosition = 0, slotsPerDay } = {}){
  return normalisiereStundenplanVorlage({
    name,
    modelId,
    zyklusPosition,
    slotsPerDay: slotsPerDay || week?.slotsPerDay || 6,
    eintraege: vorlagenEintraegeAusWoche(week, { auswahl }),
  });
}

/* ---- Der Rhythmus ------------------------------------------------------

   Welche Position des Zyklus gilt in dieser Woche? Drei Dinge
   entscheiden das, in dieser Reihenfolge:

     1. Eine ausdrückliche Ausnahme für genau diese Woche.
     2. Die Wechselregel, gemessen ab der Referenzwoche.
     3. Bei einer gleichbleibenden Woche: immer die einzige Position.

   Ausserhalb des Gültigkeitszeitraums gilt das Modell nicht; dann gibt
   es auch keine Position. */
export function positionFuer(modell, weekStartISO, { schoolCalendar = null } = {}){
  const m = modell || {};
  const ws = montagVon(weekStartISO);
  if (!ws) return null;
  const n = zyklusLaenge(m);

  const von = text(m.vonISO) ? montagVon(m.vonISO) : '';
  if (von && ws < von) return null;
  if (text(m.bisISO) && ws > montagVon(m.bisISO)) return null;

  if (Object.prototype.hasOwnProperty.call(m.ausnahmen || {}, ws)) {
    return ((m.ausnahmen[ws] % n) + n) % n;
  }
  if (n <= 1) return 0;

  const ref = montagVon(m.referenzWocheISO) || von;
  if (!ref) return null;
  const refPos = Number(m.referenzPosition) || 0;

  let schritte = 0;
  if (m.wechselregel === RHYTHMUS.UNTERRICHTSWOCHEN) {
    /* Gezählt werden die UNTERRICHTSWOCHEN zwischen Referenz und Ziel:
       vorwärts einschliesslich der Zielwoche, rückwärts einschliesslich
       der Referenzwoche. Eine vollständig unterrichtsfreie Woche zählt
       nicht mit – sie unterbricht den Rhythmus nicht, sie pausiert ihn. */
    const vorwaerts = ws >= ref;
    const start = vorwaerts ? plusTage(ref, 7) : plusTage(ws, 7);
    const ende = vorwaerts ? ws : ref;
    let gezaehlt = 0;
    for (const woche of wochenListe(start, ende)) {
      if (!istUnterrichtsfreieWoche(woche, schoolCalendar)) gezaehlt += 1;
    }
    schritte = vorwaerts ? gezaehlt : -gezaehlt;
  } else {
    schritte = wochenAbstand(ref, ws);
  }
  return (((refPos + schritte) % n) + n) % n;
}

export function labelFuerWoche(modell, weekStartISO, opts = {}){
  const pos = positionFuer(modell, weekStartISO, opts);
  if (pos === null) return '';
  return zyklusLabel(pos, zyklusLaenge(modell));
}

/* Die Vorschau des Rhythmus: Woche für Woche, mit Kennzeichnung. */
export function rhythmusVorschau(modell, { vonISO, bisISO, schoolCalendar = null } = {}){
  const m = modell || {};
  const start = montagVon(vonISO) || montagVon(m.vonISO);
  const ende = montagVon(bisISO) || montagVon(m.bisISO);
  if (!start || !ende) return [];
  const n = zyklusLaenge(m);
  return wochenListe(start, ende).map(ws => {
    const pos = positionFuer(m, ws, { schoolCalendar });
    return {
      weekStartISO: ws,
      kw: kalenderwoche(ws),
      position: pos,
      label: pos === null ? '' : zyklusLabel(pos, n),
      unterrichtsfrei: istUnterrichtsfreieWoche(ws, schoolCalendar),
      ausnahme: Object.prototype.hasOwnProperty.call(m.ausnahmen || {}, ws),
    };
  });
}

export function kalenderwoche(iso){
  const d = fromISO(montagVon(iso));
  if (!d) return 0;
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - tag);
  const jahresStart = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return Math.ceil((((u - jahresStart) / 86400000) + 1) / 7);
}

/* Welche Vorlage gilt in dieser Woche? */
export function vorlageFuerWoche(modell, vorlagen, weekStartISO, opts = {}){
  const pos = positionFuer(modell, weekStartISO, opts);
  if (pos === null) return null;
  const id = (Array.isArray(modell?.zyklus) ? modell.zyklus : [])[pos];
  if (!id) return null;
  return (vorlagen || {})[id] || null;
}

/* ---- Anwenden: erst rechnen ------------------------------------------

   Wie beim Verschieben: Es entsteht ein Vorschlag, kein Schreibvorgang.
   Was er sagt, ist vollständig – auch das, was NICHT geschieht. */
export function anwendungsVorschau(db, {
  modell = null,
  vorlage = null,
  vorlagen = null,
  vonISO,
  bisISO,
  ersetzeOhneInhalt = false,
} = {}){
  const alleVorlagen = vorlagen || db?.timetableTemplates || {};
  const schoolCalendar = db?.schoolCalendar || null;
  const sy = schoolCalendar?.schoolYear || {};

  const start = montagVon(vonISO);
  const ende = montagVon(bisISO);
  const fehler = [];
  if (!start || !ende) fehler.push({ code: 'zeitraum', text: 'Bitte einen Zeitraum wählen.' });
  if (!modell && !vorlage) fehler.push({ code: 'keineVorlage', text: 'Es ist keine Vorlage gewählt.' });
  if (fehler.length) return { ok: false, fehler, wochen: [], summe: leereSumme(), bewegungen: [] };

  const wochen = [];
  const bewegungen = [];
  const summe = leereSumme();

  for (const ws of wochenListe(start, ende)) {
    const woche = db?.weeks?.[ws] || null;
    const slotsAmTag = Number(woche?.slotsPerDay) || 6;
    const unterrichtsfrei = istUnterrichtsfreieWoche(ws, schoolCalendar);
    const gewaehlteVorlage = modell
      ? vorlageFuerWoche(modell, alleVorlagen, ws, { schoolCalendar })
      : vorlage;
    const position = modell ? positionFuer(modell, ws, { schoolCalendar }) : 0;
    const label = modell ? (position === null ? '' : zyklusLabel(position, zyklusLaenge(modell))) : '';

    const zeile = {
      weekStartISO: ws,
      kw: kalenderwoche(ws),
      position,
      label,
      unterrichtsfrei,
      vorlageId: gewaehlteVorlage?.id || '',
      vorlageName: gewaehlteVorlage?.name || '',
      eintraege: [],
      zaehler: { neu: 0, identisch: 0, konflikt: 0, ferien: 0, ersetzbar: 0 },
    };

    if (!gewaehlteVorlage) {
      zeile.hinweis = modell
        ? 'Für diese Woche gilt das Modell nicht.'
        : 'Keine Vorlage.';
      wochen.push(zeile);
      summe.wochen += 1;
      continue;
    }
    if (unterrichtsfrei) {
      zeile.hinweis = 'unterrichtsfreie Woche – wird übersprungen';
      wochen.push(zeile);
      summe.wochen += 1;
      summe.freieWochen += 1;
      continue;
    }

    for (const eintrag of gewaehlteVorlage.eintraege) {
      const dateISO = plusTage(ws, eintrag.dayIndex);
      const frei = istSchulfrei(dateISO, schoolCalendar);
      const ausserhalb = (text(sy.startISO) && dateISO < sy.startISO)
        || (text(sy.endISO) && dateISO > sy.endISO);

      const basis = {
        eintragId: eintrag.id,
        dayIndex: eintrag.dayIndex,
        slotIndex: eintrag.slotIndex,
        dateISO,
        classGroup: eintrag.classGroup,
        subject: eintrag.subject,
        room: eintrag.room,
        blockSpan: eintrag.blockSpan,
      };

      if (frei.frei || ausserhalb) {
        zeile.eintraege.push({
          ...basis,
          status: ZEILEN_STATUS.FERIEN,
          hinweis: ausserhalb ? 'ausserhalb des Schuljahres' : (frei.name ? `${frei.grund}: ${frei.name}` : frei.grund),
        });
        zeile.zaehler.ferien += 1;
        continue;
      }

      const bewertung = bewerteEintrag(woche, eintrag, { slotsAmTag, ersetzeOhneInhalt });
      zeile.eintraege.push({ ...basis, status: bewertung.status, hinweis: bewertung.hinweis });
      zeile.zaehler[bewertung.status] = (zeile.zaehler[bewertung.status] || 0) + 1;

      if (bewertung.status === ZEILEN_STATUS.NEU || bewertung.status === ZEILEN_STATUS.ERSETZBAR) {
        bewegungen.push({
          weekStart: ws,
          dayIndex: eintrag.dayIndex,
          slotIndex: eintrag.slotIndex,
          eintrag,
          vorlageId: gewaehlteVorlage.id,
          vorlageVersion: gewaehlteVorlage.version,
          modelId: modell?.id || '',
          ersetzt: bewertung.status === ZEILEN_STATUS.ERSETZBAR,
        });
      }
    }

    summe.neu += zeile.zaehler.neu;
    summe.identisch += zeile.zaehler.identisch;
    summe.konflikt += zeile.zaehler.konflikt;
    summe.ferien += zeile.zaehler.ferien;
    summe.ersetzbar += zeile.zaehler.ersetzbar;
    summe.wochen += 1;
    wochen.push(zeile);
  }

  return {
    ok: bewegungen.length > 0,
    fehler: bewegungen.length ? [] : [{ code: 'nichtsZuTun', text: 'In diesem Zeitraum gibt es nichts anzulegen.' }],
    wochen,
    summe,
    bewegungen,
  };
}

function leereSumme(){
  return { neu: 0, identisch: 0, konflikt: 0, ferien: 0, ersetzbar: 0, wochen: 0, freieWochen: 0 };
}

/* Was passiert an diesem einen Platz?

   Der Reihe nach: Passt der Block überhaupt? Steht dort schon dieselbe
   Lerngruppe? Steht dort etwas anderes? Nur ein wirklich freier Platz
   wird gefüllt – und ein leerer Rahmen derselben Lerngruppe nur dann,
   wenn das ausdrücklich gewählt wurde. */
function bewerteEintrag(woche, eintrag, { slotsAmTag = 6, ersetzeOhneInhalt = false } = {}){
  const lessons = woche?.lessons || {};
  const span = normalisiereBlockSpan(eintrag.blockSpan);

  if (eintrag.slotIndex + span > slotsAmTag) {
    return { status: ZEILEN_STATUS.KONFLIKT, hinweis: `${span} Stunden passen an diesem Tag nicht mehr` };
  }

  /* Deckt eine Doppelstunde von weiter oben diesen Platz ab? */
  for (let zurueck = 1; zurueck < MAX_BLOCK_SPAN; zurueck++) {
    const start = eintrag.slotIndex - zurueck;
    if (start < 0) break;
    const davor = lessons[lessonKey(eintrag.dayIndex, start)];
    if (!davor) continue;
    if (blockSpanOf(davor) > zurueck) {
      return { status: ZEILEN_STATUS.KONFLIKT, hinweis: 'gehört zu einer Doppelstunde' };
    }
    break;
  }

  const vorhanden = lessons[lessonKey(eintrag.dayIndex, eintrag.slotIndex)] || null;

  /* Die Folgeplätze einer Doppelstunde müssen ebenfalls frei sein. */
  for (const s of belegteSlots(eintrag.slotIndex, span).slice(1)) {
    const nachbar = lessons[lessonKey(eintrag.dayIndex, s)];
    if (nachbar) {
      return { status: ZEILEN_STATUS.KONFLIKT, hinweis: 'die Folgestunde des Blocks ist belegt' };
    }
  }

  if (!vorhanden) return { status: ZEILEN_STATUS.NEU, hinweis: '' };

  const selbeGruppe = gleich(vorhanden.classGroup, eintrag.classGroup) && gleich(vorhanden.subject, eintrag.subject);
  if (selbeGruppe && blockSpanOf(vorhanden) === span) {
    const raumAbweichung = text(vorhanden.room) && text(eintrag.room) && !gleich(vorhanden.room, eintrag.room);
    return {
      status: ZEILEN_STATUS.IDENTISCH,
      hinweis: raumAbweichung ? `Raum weicht ab (${text(vorhanden.room)})` : '',
    };
  }

  /* Ein leerer Rahmen derselben Lerngruppe darf – auf ausdrücklichen
     Wunsch – ersetzt werden. Eine Stunde mit Planung NIE. */
  if (ersetzeOhneInhalt && istLeerePlanung(vorhanden)) {
    return { status: ZEILEN_STATUS.ERSETZBAR, hinweis: 'leerer Rahmen wird ersetzt' };
  }

  const belegtVon = [text(vorhanden.classGroup), text(vorhanden.subject)].filter(Boolean).join(' · ');
  return {
    status: ZEILEN_STATUS.KONFLIKT,
    hinweis: istLeerePlanung(vorhanden)
      ? `Platz ist belegt${belegtVon ? ` (${belegtVon})` : ''}`
      : `hier ist bereits geplant${belegtVon ? ` (${belegtVon})` : ''}`,
  };
}

/* ---- Anwenden: dann schreiben -----------------------------------------

   Ein Vorgang, eine Änderung. Angelegt wird nur, was die Vorschau als
   "neu" (oder ausdrücklich als "ersetzbar") ausgewiesen hat – und auch
   das nur, wenn der Platz beim Schreiben immer noch so aussieht. */
export function wendeVorlageAn(db, plan, {
  neueStunde = null,
  jetzt = new Date().toISOString(),
} = {}){
  if (!plan?.bewegungen?.length) return null;
  const next = JSON.parse(JSON.stringify(db || {}));
  if (!next.weeks || typeof next.weeks !== 'object') next.weeks = {};

  for (const b of plan.bewegungen) {
    const ws = b.weekStart;
    if (!next.weeks[ws]) next.weeks[ws] = { slotsPerDay: 6, lessons: {}, duties: {} };
    const woche = next.weeks[ws];
    if (!woche.lessons || typeof woche.lessons !== 'object') woche.lessons = {};
    const key = lessonKey(b.dayIndex, b.slotIndex);
    const vorhanden = woche.lessons[key];
    /* Sicherheitsnetz: Was Planung trägt, wird nie überschrieben – auch
       dann nicht, wenn die Vorschau älter ist als die Daten. */
    if (vorhanden && !(b.ersetzt && istLeerePlanung(vorhanden))) continue;

    const stunde = typeof neueStunde === 'function'
      ? neueStunde({
          classGroup: b.eintrag.classGroup,
          subject: b.eintrag.subject,
          room: b.eintrag.room,
          blockSpan: b.eintrag.blockSpan,
        })
      : {
          classGroup: b.eintrag.classGroup,
          subject: b.eintrag.subject,
          room: b.eintrag.room,
          blockSpan: b.eintrag.blockSpan,
          phases: [],
        };

    woche.lessons[key] = {
      ...stunde,
      classGroup: b.eintrag.classGroup,
      subject: b.eintrag.subject,
      room: b.eintrag.room,
      blockSpan: b.eintrag.blockSpan,
      /* Woher diese Stunde kommt. Nur zur Wiedererkennung – sie schränkt
         das Bearbeiten in keiner Weise ein und wird beim Ändern der
         Vorlage NICHT nachgezogen. */
      timetableRef: {
        modelId: b.modelId || '',
        templateId: b.vorlageId || '',
        entryId: b.eintrag.id,
        version: b.vorlageVersion || 1,
        appliedAt: jetzt,
      },
      updatedAt: jetzt,
    };
    /* Die Folgeplätze einer Doppelstunde tragen keinen eigenen Eintrag. */
    for (const s of belegteSlots(b.slotIndex, b.eintrag.blockSpan).slice(1)) {
      delete woche.lessons[lessonKey(b.dayIndex, s)];
    }
  }
  return next;
}

/* Die Orte, die ein Plan berührt – für Versionsverlauf und Rückgängig. */
export function betroffeneOrte(plan){
  const orte = new Map();
  for (const b of (plan?.bewegungen || [])) {
    for (const s of belegteSlots(b.slotIndex, b.eintrag.blockSpan)) {
      orte.set(`${b.weekStart}|${b.dayIndex}|${s}`, { weekStart: b.weekStart, dayIndex: b.dayIndex, slotIndex: s });
    }
  }
  return [...orte.values()];
}

/* ---- Verwaltung -------------------------------------------------------- */

/* Zwei Modelle überschneiden sich, wenn ihre Gültigkeitszeiträume es
   tun. Ein fehlendes Datum heisst "offen" – und offen überschneidet
   sich mit allem, was danach liegt. */
export function ueberschneidetSich(a, b){
  const aVon = text(a?.vonISO) || '0000-01-01';
  const aBis = text(a?.bisISO) || '9999-12-31';
  const bVon = text(b?.vonISO) || '0000-01-01';
  const bBis = text(b?.bisISO) || '9999-12-31';
  return aVon <= bBis && bVon <= aBis;
}

export function ueberschneidendeModelle(modelle, modell){
  return (Array.isArray(modelle) ? modelle : [])
    .filter(m => m && m.id !== modell?.id && m.aktiv && !m.archiviert && ueberschneidetSich(m, modell));
}

/* Ein Modell aktivieren.

   Für denselben Zeitraum darf nur EINES aktiv sein – deshalb werden
   überschneidende Modelle dabei stillgelegt. Welche das sind, gibt die
   Funktion zurück: Die Oberfläche fragt danach, bevor sie es tut. */
export function aktiviereModell(modelle, id){
  const liste = (Array.isArray(modelle) ? modelle : []).map(m => ({ ...m }));
  const ziel = liste.find(m => m.id === id);
  if (!ziel) return { modelle: liste, deaktiviert: [] };
  const deaktiviert = ueberschneidendeModelle(liste, ziel).map(m => m.id);
  return {
    modelle: liste.map(m => {
      if (m.id === id) return { ...m, aktiv: true, archiviert: false, updatedAt: new Date().toISOString() };
      if (deaktiviert.includes(m.id)) return { ...m, aktiv: false, updatedAt: new Date().toISOString() };
      return m;
    }),
    deaktiviert,
  };
}

export function archiviereModell(modelle, id){
  return (Array.isArray(modelle) ? modelle : [])
    .map(m => (m.id === id ? { ...m, aktiv: false, archiviert: true, updatedAt: new Date().toISOString() } : m));
}

/* Das Modell, das an einem bestimmten Tag gilt. */
export function aktivesModellFuer(modelle, datumISO){
  const tag = text(datumISO);
  const kandidaten = (Array.isArray(modelle) ? modelle : [])
    .filter(m => m?.aktiv && !m.archiviert)
    .filter(m => (!text(m.vonISO) || tag >= m.vonISO) && (!text(m.bisISO) || tag <= m.bisISO));
  /* Bei mehreren (aus einem alten Datenstand) gewinnt das zuletzt
     geänderte: Es ist das, was zuletzt jemand ausdrücklich wollte. */
  return kandidaten.sort((a, b)=> text(b.updatedAt).localeCompare(text(a.updatedAt)))[0] || null;
}

/* A- und B-Woche tauschen. Es wechseln die Positionen, nicht die
   Inhalte: Die Vorlagen selbst bleiben Zeichen für Zeichen, wie sie
   sind – nur ihre Rolle im Zyklus dreht sich um. */
export function tauscheZyklus(modell, vorlagen, { a = 0, b = 1 } = {}){
  const m = normalisiereStundenplanModell(modell);
  const zyklus = [...m.zyklus];
  if (zyklus.length < 2 || a >= zyklus.length || b >= zyklus.length) {
    return { modell: m, vorlagen: { ...(vorlagen || {}) } };
  }
  [zyklus[a], zyklus[b]] = [zyklus[b], zyklus[a]];
  const naechsteVorlagen = { ...(vorlagen || {}) };
  zyklus.forEach((id, index)=>{
    const v = naechsteVorlagen[id];
    if (v) naechsteVorlagen[id] = { ...v, zyklusPosition: index, updatedAt: new Date().toISOString() };
  });
  return {
    modell: { ...m, zyklus, updatedAt: new Date().toISOString() },
    vorlagen: naechsteVorlagen,
  };
}

export function dupliziereVorlage(vorlage, { name = '', modelId = '', zyklusPosition = 0 } = {}){
  const v = normalisiereStundenplanVorlage(vorlage);
  return normalisiereStundenplanVorlage({
    ...v,
    id: neueId('vorlage'),
    modelId,
    zyklusPosition,
    name: text(name) || `${v.name} (Kopie)`,
    version: 1,
    eintraege: v.eintraege.map(e => ({ ...e, id: neueId('e') })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/* Eine manuelle Abweichung im Rhythmus – für die Woche nach dem
   Feiertag, in der die Schule den Wechsel verschiebt. Sie ändert
   ausschliesslich die Zuordnung, nie eine Stunde. */
export function setzeAusnahme(modell, weekStartISO, position){
  const m = normalisiereStundenplanModell(modell);
  const ws = montagVon(weekStartISO);
  if (!ws) return m;
  const ausnahmen = { ...m.ausnahmen };
  if (position === null || position === undefined || position === '') delete ausnahmen[ws];
  else ausnahmen[ws] = ((Number(position) % zyklusLaenge(m)) + zyklusLaenge(m)) % zyklusLaenge(m);
  return { ...m, ausnahmen, updatedAt: new Date().toISOString() };
}

/* Eine Vorlage bearbeiten: die Fassung zählt hoch. Bereits erzeugte
   Stunden bleiben davon unberührt – sie tragen die alte Fassung in
   ihrem Vermerk und werden nicht nachgezogen. */
export function speichereVorlage(vorlagen, vorlage){
  const v = normalisiereStundenplanVorlage(vorlage);
  const alt = (vorlagen || {})[v.id];
  const naechste = {
    ...v,
    version: alt ? (Number(alt.version) || 1) + 1 : v.version,
    createdAt: alt?.createdAt || v.createdAt,
    updatedAt: new Date().toISOString(),
  };
  return { ...(vorlagen || {}), [naechste.id]: naechste };
}

/* Eine Vorlage löschen. Sie verschwindet aus der Ablage und aus den
   Zyklen – Unterrichtsstunden werden dabei NICHT angefasst, auch nicht
   die, die aus ihr entstanden sind. */
export function loescheVorlage(db, vorlageId){
  const id = text(vorlageId);
  const vorlagen = { ...(db?.timetableTemplates || {}) };
  delete vorlagen[id];
  const modelle = (Array.isArray(db?.timetableModels) ? db.timetableModels : [])
    .map(m => ({ ...m, zyklus: (m.zyklus || []).filter(x => x !== id) }));
  return { timetableTemplates: vorlagen, timetableModels: modelle };
}

/* Gibt es überhaupt schon Stundenplanvorlagen? Das Onboarding fragt
   danach, um niemanden zu etwas zu drängen, das längst da ist. */
export function hatStundenplanVorlagen(db){
  return Object.keys(db?.timetableTemplates || {}).length > 0;
}

export function hatAktivesModell(db){
  return (Array.isArray(db?.timetableModels) ? db.timetableModels : [])
    .some(m => m?.aktiv && !m.archiviert && (m.zyklus || []).length > 0);
}

/* Ob ein Modell vollständig eingerichtet ist. Für den A-/B-Rhythmus
   gehört mehr dazu als zwei Vorlagen: ohne Referenzwoche und Regel
   liesse sich keine Woche zuordnen. */
export function modellVollstaendig(modell, vorlagen){
  const m = normalisiereStundenplanModell(modell);
  const alle = vorlagen || {};
  if (!m.zyklus.length) return false;
  if (!m.zyklus.every(id => alle[id])) return false;
  if (!istWechselModell(m)) return true;
  return Boolean(m.referenzWocheISO && m.wechselregel);
}

/* Wieviele Wochen wurden aus diesem Modell schon befüllt? Das
   Onboarding braucht die Zahl: "auf mindestens zwei aufeinanderfolgende
   Unterrichtswochen angewendet". */
export function angewendeteWochen(db, modelId){
  const id = text(modelId);
  const wochen = new Set();
  for (const [ws, woche] of Object.entries(db?.weeks || {})) {
    for (const l of Object.values(woche?.lessons || {})) {
      const ref = l?.timetableRef;
      if (!ref) continue;
      if (id && text(ref.modelId) !== id) continue;
      wochen.add(ws);
    }
  }
  return [...wochen].sort();
}
