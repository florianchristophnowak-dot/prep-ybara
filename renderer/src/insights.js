/* ============================================================
   Auswertungen

   Alles hier wird aus vorhandenen Feldern abgeleitet – es gibt keine
   neuen Datenfelder. Bewusst reine Funktionen ohne React: so lassen sie
   sich prüfen, ohne eine Oberfläche zu bauen.

   Grundsatz für die Anzeige: Keine dieser Zahlen bewertet jemanden. Sie
   zeigen, was vorbereitet und gehalten wurde – nicht, ob das genug war.
   ============================================================ */

import { alleBereiche, bereichVon } from './competencies.js';

/* Ein Stundenschlüssel ist "tag-stunde" innerhalb einer Woche. */
export function parseLessonKey(key){
  const parts = String(key || '').split('-');
  const dayIndex = Number(parts[0]);
  const slotIndex = Number(parts[1]);
  if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) return null;
  return { dayIndex, slotIndex };
}

function addDaysISO(iso, days){
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* Alle Stunden der Datenbank in zeitlicher Reihenfolge, mit Datum. */
export function allLessonsChronological(db){
  const out = [];
  for (const [weekStart, week] of Object.entries(db?.weeks || {})) {
    for (const [key, raw] of Object.entries(week?.lessons || {})) {
      if (!raw) continue;
      const pos = parseLessonKey(key);
      if (!pos) continue;
      out.push({
        weekStart, key, ...pos,
        dateISO: addDaysISO(weekStart, pos.dayIndex),
        lesson: raw,
      });
    }
  }
  out.sort((a, b)=> a.dateISO.localeCompare(b.dateISO)
    || (a.slotIndex - b.slotIndex)
    || String(a.lesson.classGroup || '').localeCompare(String(b.lesson.classGroup || '')));
  return out;
}

/* ---- Sequenzfortschritt ---------------------------------------------
   "Le passé composé – Stunde 4 von 9". Die Zuordnung steckt in
   lesson.sequenceId, die Reihenfolge ergibt sich aus dem Datum. */
export function sequenceOccurrences(db, sequenceId){
  const id = String(sequenceId || '');
  if (!id) return [];
  return allLessonsChronological(db).filter(x => String(x.lesson?.sequenceId || '') === id);
}

export function sequenceProgress(db, sequenceId, { weekStart, dayIndex, slotIndex } = {}){
  const id = String(sequenceId || '');
  const seq = db?.sequences?.[id];
  if (!seq) return null;
  const occ = sequenceOccurrences(db, id);
  if (!occ.length) return null;
  const position = occ.findIndex(x =>
    x.weekStart === weekStart && x.dayIndex === dayIndex && x.slotIndex === slotIndex);
  return {
    id,
    name: seq.name || 'Sequenz',
    color: seq.color || '',
    total: occ.length,
    // 1-basiert; -1 wenn die Stunde (noch) nicht dazugehört.
    position: position >= 0 ? position + 1 : -1,
  };
}

/* ---- Kompetenz-Wärmekarte -------------------------------------------
   competencies liegen als Etiketten je Stunde vor, primaryCompetency
   hebt eine hervor. Beides wird nur gezählt, nichts bewertet. */
export function competencyHeatmap(db, { fromISO, toISO } = {}){
  const buckets = new Map();   // Kompetenz -> Map(Monat -> {anzahl, primaer})
  const months = new Set();
  let gesamt = 0;

  for (const item of allLessonsChronological(db)) {
    const d = item.dateISO;
    if (fromISO && d < fromISO) continue;
    if (toISO && d > toISO) continue;
    const monat = d.slice(0, 7);
    const liste = Array.isArray(item.lesson?.competencies) ? item.lesson.competencies : [];
    const primaer = String(item.lesson?.primaryCompetency || '').trim();
    const alle = new Set(liste.map(x => String(x || '').trim()).filter(Boolean));
    if (primaer) alle.add(primaer);
    if (!alle.size) continue;
    months.add(monat);
    for (const name of alle) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const perMonat = buckets.get(name);
      const cur = perMonat.get(monat) || { anzahl: 0, primaer: 0 };
      cur.anzahl += 1;
      if (name === primaer) cur.primaer += 1;
      perMonat.set(monat, cur);
      gesamt += 1;
    }
  }

  const monatsListe = [...months].sort();
  const zeilen = [...buckets.entries()]
    .map(([name, perMonat])=>{
      const zellen = monatsListe.map(m => perMonat.get(m) || { anzahl: 0, primaer: 0 });
      const summe = zellen.reduce((a, z)=> a + z.anzahl, 0);
      const primaerSumme = zellen.reduce((a, z)=> a + z.primaer, 0);
      return { name, zellen, summe, primaerSumme };
    })
    .sort((a, b)=> b.summe - a.summe || a.name.localeCompare(b.name));

  const hoechst = zeilen.reduce((m, z)=> Math.max(m, ...z.zellen.map(c => c.anzahl)), 0);
  return { monate: monatsListe, zeilen, hoechst, gesamt };
}

/* ---- Kompetenzprofil --------------------------------------------------
   Dieselben Zahlen wie die Wärmekarte, nur nach Bereichen gebündelt.
   Sie beschreibt und bewertet nicht: kein Soll, keine Ampel, kein
   Hinweis auf ein angebliches Ungleichgewicht. Was hier steht, ist
   ausschliesslich, was in den Stunden eingetragen wurde.

   Gezählt wird je Stunde und Etikett genau einmal – die primäre
   Kompetenz zählt nicht doppelt, auch wenn sie zusätzlich in der Liste
   steht. */
export function competencyProfile(db, { modell, fromISO, toISO } = {}){
  const proKompetenz = new Map();   // Etikett -> { anzahl, primaer }
  let gesamt = 0;

  for (const item of allLessonsChronological(db)) {
    const d = item.dateISO;
    if (fromISO && d < fromISO) continue;
    if (toISO && d > toISO) continue;
    const liste = Array.isArray(item.lesson?.competencies) ? item.lesson.competencies : [];
    const primaer = String(item.lesson?.primaryCompetency || '').trim();
    const alle = new Set(liste.map(x => String(x || '').trim()).filter(Boolean));
    if (primaer) alle.add(primaer);
    for (const name of alle) {
      const cur = proKompetenz.get(name) || { anzahl: 0, primaer: 0 };
      cur.anzahl += 1;
      if (name === primaer) cur.primaer += 1;
      proKompetenz.set(name, cur);
      gesamt += 1;
    }
  }

  const proBereich = new Map();
  for (const [name, werte] of proKompetenz.entries()) {
    const bereichId = bereichVon(name, modell);
    if (!proBereich.has(bereichId)) proBereich.set(bereichId, { anzahl: 0, kompetenzen: [] });
    const eintrag = proBereich.get(bereichId);
    eintrag.anzahl += werte.anzahl;
    eintrag.kompetenzen.push({ name, anzahl: werte.anzahl, primaer: werte.primaer });
  }

  const bereiche = alleBereiche(modell)
    .map(b => {
      const eintrag = proBereich.get(b.id);
      if (!eintrag || !eintrag.anzahl) return null;
      return {
        id: b.id,
        name: b.name,
        anzahl: eintrag.anzahl,
        anteil: gesamt > 0 ? eintrag.anzahl / gesamt : 0,
        kompetenzen: eintrag.kompetenzen
          .sort((a, b2)=> b2.anzahl - a.anzahl || a.name.localeCompare(b2.name)),
      };
    })
    .filter(Boolean);

  return { gesamt, bereiche };
}

/* ---- Heute -----------------------------------------------------------
   Die Stunden des laufenden Tages, Aufsichten und die ANZAHL offener
   To-dos. Die Inhalte bleiben verborgen: die bestehende Datenschutzlogik
   zeigt sie erst nach dem Öffnen der Liste. */
export function todayOverview(db, todayISO, weekStartISO){
  const week = db?.weeks?.[weekStartISO] || null;
  const tag = (()=>{
    const a = new Date(`${weekStartISO}T00:00:00`);
    const b = new Date(`${todayISO}T00:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return -1;
    return Math.round((b - a) / 86400000);
  })();

  const stunden = [];
  if (week && tag >= 0) {
    for (const [key, raw] of Object.entries(week.lessons || {})) {
      const pos = parseLessonKey(key);
      if (!pos || pos.dayIndex !== tag || !raw) continue;
      stunden.push({ key, ...pos, lesson: raw });
    }
    stunden.sort((a, b)=> a.slotIndex - b.slotIndex);
  }

  const aufsichten = [];
  if (week && tag >= 0) {
    for (const [key, duty] of Object.entries(week.duties || {})) {
      const parts = String(key).split('-');
      if (Number(parts[0]) !== tag || !duty) continue;
      aufsichten.push({ key, pos: parts[1], title: duty.title || duty.label || 'Aufsicht' });
    }
  }

  const todos = Array.isArray(db?.todos) ? db.todos : [];
  const offeneHeute = todos.filter(t => !t?.done
    && ((t?.dateISO || '') === todayISO || (t?.deadlineISO || '') === todayISO)).length;
  const offeneUeberfaellig = todos.filter(t => !t?.done
    && (t?.deadlineISO || '') && t.deadlineISO < todayISO).length;

  return { tagIndex: tag, stunden, aufsichten, offeneHeute, offeneUeberfaellig };
}

/* ---- Wochenabschluss --------------------------------------------------
   Eine Zusammenfassung, keine Bewertung: was geplant war, welche
   Sequenzen fortgesetzt wurden, welche To-dos erledigt sind. Bewusst
   ohne Prozentwerte und ohne Vergleich mit irgendeinem Soll. */
export function weekSummary(db, weekStartISO){
  const week = db?.weeks?.[weekStartISO] || null;
  const lessons = Object.entries(week?.lessons || {})
    .map(([key, raw])=> ({ key, lesson: raw }))
    .filter(x => !!x.lesson);

  const geplant = lessons.filter(x => String(x.lesson.topic || '').trim()).length;
  const gesamt = lessons.length;

  const sequenzen = new Map();
  for (const { lesson } of lessons) {
    const id = String(lesson.sequenceId || '');
    if (!id) continue;
    const seq = db?.sequences?.[id];
    if (!seq) continue;
    sequenzen.set(id, { name: seq.name || 'Sequenz', color: seq.color || '', anzahl: (sequenzen.get(id)?.anzahl || 0) + 1 });
  }

  const wochenEnde = addDaysISO(weekStartISO, 6);
  const todos = Array.isArray(db?.todos) ? db.todos : [];
  const erledigt = todos.filter(t => t?.done
    && ((t?.weekStartISO || '') === weekStartISO
      || ((t?.dateISO || '') >= weekStartISO && (t?.dateISO || '') <= wochenEnde))).length;

  const gruppen = new Set(lessons.map(x => String(x.lesson.classGroup || '').trim()).filter(Boolean));

  return {
    geplant,
    gesamt,
    sequenzen: [...sequenzen.values()].sort((a, b)=> b.anzahl - a.anzahl),
    erledigteTodos: erledigt,
    lerngruppen: gruppen.size,
  };
}
