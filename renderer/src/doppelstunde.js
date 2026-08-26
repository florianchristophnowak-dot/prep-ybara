/* Doppelstunden
   ============================================================

   Eine Doppelstunde ist kein eigener Stundentyp. Sie ist eine ganz
   normale Stunde, die mehr als einen Stundenplatz belegt: `blockSpan`
   sagt, wie viele unmittelbar aufeinanderfolgende Plätze sie einnimmt.

   Damit bleibt alles, was es schon gibt, unverändert gültig:
   - eine Stunde ohne `blockSpan` ist eine Einzelstunde (span 1),
   - im Wochenraster steht sie weiterhin an ihrem ersten Platz,
   - jede Auswertung, jeder Export und jede Sequenz sieht GENAU EINE
     Stunde – nicht zwei halbe.

   Die belegten Folgeplätze tragen keinen eigenen Eintrag mehr. Welche
   Plätze das sind, ergibt sich aus Startplatz und Spanne und bleibt
   dadurch jederzeit nachvollziehbar.

   In dieser Datei steht nur, was sich ohne Oberfläche entscheiden
   lässt – deshalb ist sie prüfbar. */

/* Die Länge eines Stundenplatzes. Der Zeitrahmen einer Stunde ist ein
   Vielfaches davon: 45, 90, 135 Minuten. */
export const SLOT_MIN = 45;

/* Mehr als vier Plätze am Stück gibt es im Schulalltag nicht. Die
   Grenze verhindert vor allem, dass eine fehlerhafte Angabe halbe
   Wochenraster verschluckt. */
export const MAX_BLOCK_SPAN = 4;

/* Die kleinste sinnvolle Phasendauer. */
export const MIN_PHASE_MIN = 1;

export function normalisiereBlockSpan(v){
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_BLOCK_SPAN, n);
}

export function blockSpanOf(lesson){
  return normalisiereBlockSpan(lesson?.blockSpan);
}

/* Der Zeitrahmen einer Stunde: durchgehend, nicht nach 45 Minuten
   geteilt. Eine Doppelstunde hat 90 Minuten am Stück. */
export function lessonTotalMin(lesson){
  return SLOT_MIN * blockSpanOf(lesson);
}

/* Der Schlüssel eines Stundenplatzes in der Woche. */
export function lessonKey(dayIndex, slotIndex){
  return `${dayIndex}-${slotIndex}`;
}

/* Die Stundenplätze, die eine Stunde belegt – der eigene und die
   Folgeplätze einer Doppel-/Mehrfachstunde. */
export function belegteSlots(slotIndex, span){
  const s = Number(slotIndex) || 0;
  const n = normalisiereBlockSpan(span);
  return Array.from({ length: n }, (_, i)=> s + i);
}

/* Zu welcher Stunde gehört ein Platz? Entweder er trägt selbst eine
   Stunde, oder eine Doppelstunde weiter oben deckt ihn ab.

   Rückgabe: null, oder { slotIndex, lesson, covered }. `covered` sagt,
   ob der gefragte Platz ein Folgeplatz ist. */
export function blockOwnerAt(week, dayIndex, slotIndex){
  const lessons = week?.lessons || {};
  for (let back = 0; back < MAX_BLOCK_SPAN; back++){
    const start = slotIndex - back;
    if (start < 0) break;
    const l = lessons[lessonKey(dayIndex, start)];
    if (!l) continue;
    if (back === 0) return { slotIndex: start, lesson: l, covered: false };
    if (blockSpanOf(l) > back) return { slotIndex: start, lesson: l, covered: true };
    return null;
  }
  return null;
}

/* Ist dieser Platz von einer Doppelstunde abgedeckt – und damit nicht
   selbst bespielbar? */
export function istAbgedeckt(week, dayIndex, slotIndex){
  const o = blockOwnerAt(week, dayIndex, slotIndex);
  return Boolean(o && o.covered);
}

/* "3. Stunde" oder "3.–4. Stunde" – dieselbe Beschriftung überall. */
export function stundenBereichLabel(slotIndex, span){
  const n = normalisiereBlockSpan(span);
  const a = (Number(slotIndex) || 0) + 1;
  if (n <= 1) return `${a}. Stunde`;
  return `${a}.–${a + n - 1}. Stunde`;
}

/* Der Name der Blockgrösse. Mehr als eine Doppelstunde ist selten,
   soll aber nicht namenlos bleiben. */
export function blockName(span){
  const n = normalisiereBlockSpan(span);
  if (n <= 1) return 'Einzelstunde';
  if (n === 2) return 'Doppelstunde';
  if (n === 3) return 'Dreifachstunde';
  return `${n}-fach-Stunde`;
}

/* Zwei Stunden dürfen verbunden werden, wenn sie zur selben Lerngruppe
   gehören: gleiche Klasse UND gleiches Fach. Alles andere wäre eine
   stille Zusammenlegung fremder Planungen. */
export function passenZusammen(a, b){
  if (!a || !b) return false;
  const norm = (v)=> String(v || '').trim().toLowerCase();
  return norm(a.classGroup) === norm(b.classGroup) && norm(a.subject) === norm(b.subject);
}

/* Den durchgehenden Verlaufsplan wieder auf einzelne Stundenplätze
   verteilen.

   Was vor der Stundengrenze liegt, bleibt im ersten Teil; was danach
   beginnt, geht in den zweiten. Eine Phase, die über die Grenze läuft,
   wird an genau dieser Stelle geteilt – ihre Angaben stehen dann in
   beiden Teilen, mit aufgeteilter Dauer.

   `neueId` liefert die Kennung für die entstehenden Phasen; ohne
   Angabe behalten sie ihre bisherige. */
export function verteilePhasenAufPlaetze(phases, span, neueId = null){
  const n = normalisiereBlockSpan(span);
  const teile = Array.from({ length: n }, ()=>[]);
  let offset = 0;
  for (const phase of (Array.isArray(phases) ? phases : [])){
    let rest = Math.max(MIN_PHASE_MIN, Math.round(Number(phase?.duration) || 0));
    while (rest > 0){
      const teilIndex = Math.min(n - 1, Math.floor(offset / SLOT_MIN));
      const platzImTeil = (teilIndex + 1) * SLOT_MIN - offset;
      const nimm = Math.min(rest, Math.max(1, platzImTeil));
      const kopie = { ...phase, duration: nimm };
      if (typeof neueId === 'function') kopie.id = neueId();
      teile[teilIndex].push(kopie);
      offset += nimm;
      rest -= nimm;
    }
  }
  return teile;
}
