/* ============================================================
   Nachbereitung gehaltener Stunden

   Der Kreislauf: Planung → Durchführung → Nachbereitung → offene
   Punkte → nächste Stunde derselben Lerngruppe → übernehmen. Alles
   davon ist freiwillig. Eine Stunde ohne Nachbereitung ist eine
   fertige Stunde; die App mahnt nichts an.

   DREI BEFUNDE AUS DER ARCHITEKTUR, die den Entwurf tragen:

   1. Eine Stunde hat KEINE id. Sie wird über (Wochenbeginn, Tag,
      Stunde) adressiert. Ein sourceLessonId gibt es deshalb nicht –
      an seine Stelle tritt dieses Tripel.

   2. Eine Lerngruppe hat KEINE id. Sie ist das Paar aus Klasse und
      Fach, und die App fasst das seit jeher in groupKey() zusammen –
      dieselbe Kennung, an der auch die Lerngruppenfarben hängen. Weil
      das Fach darin steckt, können offene Punkte aus Französisch gar
      nicht in einer anderen Fachplanung auftauchen, und 9a und 9b
      bleiben getrennt. Echte IDs einzuführen hiesse, jede vorhandene
      Stunde umzuschreiben.

   3. Die Durchführungsansicht speichert nichts. Sie bekommt einen
      Abzug der Stunde und hält Restzeit und Phase nur im Arbeits-
      speicher. Tatsächliche Dauern lassen sich daher nicht übernehmen,
      ohne eine neue Zeiterfassung zu bauen – und genau die soll für
      dieses Feature nicht entstehen.

   Daraus folgt: die Nachbereitung liegt IN der Stunde, die sie
   betrifft (lesson.review). Es entsteht keine zweite Ablage neben den
   Wochen, und die Wochenpersistenz trägt sie ohne Zutun mit.
   ============================================================ */

/* Neutrale Zustände. Bewusst ohne Wertung: "offen" ist kein Fehler,
   und "entfallen" ist etwas anderes als "nicht geschafft" – das eine
   ist eine Entscheidung, das andere ein Verlauf. */
export const PHASEN_STATUS = [
  { id: 'completed',     name: 'durchgeführt',          kurz: 'durchgeführt', zeichen: '✓' },
  { id: 'partial',       name: 'teilweise durchgeführt', kurz: 'teilweise',    zeichen: '◐' },
  { id: 'not_completed', name: 'offen geblieben',        kurz: 'offen',        zeichen: '○' },
  { id: 'skipped',       name: 'bewusst entfallen',      kurz: 'entfallen',    zeichen: '—' },
];
const STATUS_IDS = new Set(PHASEN_STATUS.map(s => s.id));

export function statusZeichen(id){
  return PHASEN_STATUS.find(s => s.id === id)?.zeichen || '';
}
export function statusName(id){
  return PHASEN_STATUS.find(s => s.id === id)?.name || '';
}

export const CARRY_TYPEN = ['unfinished_phase', 'partial_phase', 'review_note', 'manual_follow_up'];
export const CARRY_STATUS = ['open', 'transferred', 'completed', 'dismissed'];

export const REVIEW_STATUS = ['not_reviewed', 'in_progress', 'reviewed'];

function text(x){ return String(x ?? '').trim(); }

/* ---- Stundenreferenz -------------------------------------------------
   Der Ersatz für eine fehlende Stunden-id. Als Zeichenkette, damit sie
   sich vergleichen und als Schlüssel benutzen lässt. */
export function stundenRef(o){
  const w = text(o?.weekStart);
  const d = Number(o?.dayIndex);
  const s = Number(o?.slotIndex);
  if (!w || !Number.isFinite(d) || !Number.isFinite(s)) return '';
  return `${w}#${d}-${s}`;
}

export function parseStundenRef(ref){
  const m = /^(\d{4}-\d{2}-\d{2})#(\d+)-(\d+)$/.exec(text(ref));
  if (!m) return null;
  return { weekStart: m[1], dayIndex: Number(m[2]), slotIndex: Number(m[3]) };
}

/* ---- Normalisierung --------------------------------------------------
   Wie überall in dieser App: beliebige Eingabe, gültige leere Form.
   Fehlt review ganz, entsteht die leere Form – eine Stunde ohne
   Nachbereitung bleibt damit unverändert gültig. */

function normalisiereSnapshot(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  return {
    title: text(o.title),
    duration: Math.max(0, Math.round(Number(o.duration) || 0)),
    socialForm: text(o.socialForm),
    content: String(o.content ?? ''),
    materialsMedia: String(o.materialsMedia ?? ''),
    remarks: String(o.remarks ?? ''),
    scaffolds: Array.isArray(o.scaffolds) ? o.scaffolds : [],
  };
}

export function normalisiereCarryOver(raw, neueId){
  if (!Array.isArray(raw)) return [];
  return raw.map((x)=>{
    const o = (x && typeof x === 'object') ? x : null;
    if (!o) return null;
    const title = text(o.title);
    const content = text(o.content);
    if (!title && !content) return null;
    return {
      id: text(o.id) || (typeof neueId === 'function' ? neueId() : `co-${Math.random().toString(16).slice(2)}`),
      type: CARRY_TYPEN.includes(o.type) ? o.type : 'manual_follow_up',
      title: title || content,
      content,
      status: CARRY_STATUS.includes(o.status) ? o.status : 'open',
      sourcePhaseId: text(o.sourcePhaseId),
      /* Der Abzug macht den Punkt unabhängig davon, was später mit der
         Ursprungsstunde geschieht. Bewusst nur die Phase, nicht die
         ganze Stunde – mehr braucht die Übernahme nicht. */
      snapshot: o.snapshot ? normalisiereSnapshot(o.snapshot) : null,
      createdAt: text(o.createdAt) || new Date().toISOString(),
      resolvedAt: text(o.resolvedAt),
      // Wohin er übernommen wurde – rein zur Anzeige in der Herkunft.
      targetRef: text(o.targetRef),
    };
  }).filter(Boolean);
}

export function normalisiereReview(raw, neueId){
  const o = (raw && typeof raw === 'object') ? raw : {};

  const phaseReviews = {};
  for (const [phaseId, wert] of Object.entries((o.phaseReviews && typeof o.phaseReviews === 'object') ? o.phaseReviews : {})) {
    const id = text(phaseId);
    const w = (wert && typeof wert === 'object') ? wert : {};
    const executionStatus = STATUS_IDS.has(w.executionStatus) ? w.executionStatus : '';
    const note = text(w.note);
    const unfinishedContent = text(w.unfinishedContent);
    if (!id || (!executionStatus && !note && !unfinishedContent)) continue;
    phaseReviews[id] = { executionStatus, note, unfinishedContent };
  }

  return {
    status: REVIEW_STATUS.includes(o.status) ? o.status : 'not_reviewed',
    generalNotes: String(o.generalNotes ?? ''),
    phaseReviews,
    carryOverItems: normalisiereCarryOver(o.carryOverItems, neueId),
    reviewedAt: text(o.reviewedAt),
  };
}

export function leeresReview(){
  return { status: 'not_reviewed', generalNotes: '', phaseReviews: {}, carryOverItems: [], reviewedAt: '' };
}

/* Ob an einer Stunde überhaupt etwas nachbereitet wurde. Entscheidet,
   ob im Wochenraster ein Kennzeichen erscheint. */
export function hatNachbereitung(review){
  const r = normalisiereReview(review);
  return Boolean(
    r.status !== 'not_reviewed'
    || r.generalNotes.trim()
    || Object.keys(r.phaseReviews).length
    || r.carryOverItems.length
  );
}

export function offeneCarryOver(review){
  return normalisiereReview(review).carryOverItems.filter(i => i.status === 'open');
}

/* ---- Offene Punkte erzeugen ------------------------------------------
   Nichts davon geschieht von allein. Eine offen gebliebene Phase wird
   VORGEMERKT, nicht übernommen – die Entscheidung fällt später in der
   nächsten Stunde. */

export function carryOverAusPhase(phase, { nurOffenerTeil = false, offenerText = '', neueId } = {}){
  const p = (phase && typeof phase === 'object') ? phase : {};
  const id = typeof neueId === 'function' ? neueId() : `co-${Math.random().toString(16).slice(2)}`;
  if (nurOffenerTeil) {
    const t = text(offenerText);
    if (!t) return null;
    return {
      id,
      type: 'partial_phase',
      title: t,
      content: '',
      status: 'open',
      sourcePhaseId: text(p.id),
      /* Beim offenen Teil wird bewusst NICHT die ganze Phase mitgenommen:
         gefragt ist der Rest, nicht die Wiederholung. Dauer und Sozialform
         bleiben als Anhalt erhalten. */
      snapshot: normalisiereSnapshot({
        title: t, duration: p.duration, socialForm: p.socialForm, content: '', materialsMedia: '', remarks: '',
      }),
      createdAt: new Date().toISOString(),
      resolvedAt: '',
      targetRef: '',
    };
  }
  return {
    id,
    type: 'unfinished_phase',
    title: text(p.title) || 'Phase',
    content: '',
    status: 'open',
    sourcePhaseId: text(p.id),
    snapshot: normalisiereSnapshot(p),
    createdAt: new Date().toISOString(),
    resolvedAt: '',
    targetRef: '',
  };
}

export function carryOverAusNotiz(inhalt, { type = 'review_note', neueId } = {}){
  const t = text(inhalt);
  if (!t) return null;
  return {
    id: typeof neueId === 'function' ? neueId() : `co-${Math.random().toString(16).slice(2)}`,
    type: CARRY_TYPEN.includes(type) ? type : 'review_note',
    title: t,
    content: '',
    status: 'open',
    sourcePhaseId: '',
    snapshot: null,
    createdAt: new Date().toISOString(),
    resolvedAt: '',
    targetRef: '',
  };
}

/* ---- Übernahme -------------------------------------------------------
   Aus einem offenen Punkt wird eine ganz normale Phase. Keine
   Sonderform, kein zweiter Typ – sie lässt sich danach verschieben,
   ändern, löschen wie jede andere.

   Die Ursprungsphase bleibt unangetastet: hier wird kopiert, nicht
   verschoben. Neue id, damit Kopie und Original nie auf denselben
   Schlüssel zeigen. */
export function phaseAusCarryOver(item, neueId){
  const i = (item && typeof item === 'object') ? item : {};
  const s = i.snapshot ? normalisiereSnapshot(i.snapshot) : null;
  const mach = typeof neueId === 'function' ? neueId : ()=> `p-${Math.random().toString(16).slice(2)}`;
  const titel = text(i.title) || text(s?.title) || 'Übernommen';
  return {
    id: mach(),
    title: titel,
    duration: Math.max(1, Math.round(Number(s?.duration) || 5)),
    socialForm: text(s?.socialForm),
    /* Ohne Abzug (freie Notiz) steht der Text im Ablauf – der Titel
       allein ginge sonst verloren. Keine Umformulierung, kein Deuten. */
    content: s?.content || (i.type === 'unfinished_phase' || i.type === 'partial_phase' ? '' : text(i.title)),
    materialsMedia: s?.materialsMedia || '',
    remarks: s?.remarks || '',
    scaffolds: Array.isArray(s?.scaffolds)
      ? s.scaffolds.map(sc => ({ ...sc, id: mach() }))
      : [],
    /* Herkunft, rein informativ. Sie schränkt nichts ein. */
    carriedOverFrom: { ref: text(i.sourceRef), phaseId: text(i.sourcePhaseId), itemId: text(i.id) },
  };
}
