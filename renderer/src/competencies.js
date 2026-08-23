/* ============================================================
   Kompetenzkatalog für den Fremdsprachenmodus

   ENTSCHEIDUNG, aus der alles Weitere folgt: Das Etikett bleibt die
   Identität einer Kompetenz.

   Die App speichert Kompetenzen seit jeher als Zeichenketten – in
   lesson.competencies und lesson.primaryCompetency. Der naheliegende
   Weg wäre gewesen, daraus Objekte mit id, categoryId und source zu
   machen. Dagegen sprechen drei Dinge:

   1. Jede vorhandene Stunde müsste umgeschrieben werden. Eine Migration,
      die tausende Stunden anfasst, ist genau das Risiko, das hier
      niemand eingehen will.
   2. Die App bietet freie Eingabe an und soll sie behalten. Eine frei
      getippte Kompetenz hat keine natürliche id – man müsste eine
      erfinden und ab da zwei Wege pflegen.
   3. Etiketten sind bereits eindeutig: die Auswahl arbeitet mit
      Set-Semantik, zweimal dasselbe Etikett gibt es in einer Stunde
      nicht.

   Stattdessen liegt hier ein KATALOG neben den Daten. Er ordnet
   Etiketten einem Bereich zu und sagt, welche vom System kommen. Die
   Stunden selbst bleiben unverändert – auch nach dem Update, auch beim
   Abschalten des Modus, auch in alten Sicherungen.

   Daraus folgt: `source` wird abgeleitet, nicht gespeichert. Was im
   Katalog unten steht, ist eine Systemkompetenz; alles andere ist eine
   eigene. Es gibt keinen Zustand, der davon abweichen könnte.

   Sprachneutral: Die Bereiche folgen dem handlungsorientierten Ansatz
   des GER und gelten für jede Fremdsprache. Nichts hier ist auf eine
   einzelne Sprache zugeschnitten.
   ============================================================ */

/* Die Systembereiche. Einzige Stelle, an der diese Bezeichnungen stehen. */
export const SYSTEM_BEREICHE = [
  {
    id: 'reception',
    name: 'Rezeption',
    kompetenzen: ['Hörverstehen', 'Hörsehverstehen', 'Leseverstehen'],
  },
  {
    id: 'production',
    name: 'Produktion',
    kompetenzen: ['zusammenhängendes Sprechen', 'Schreiben'],
  },
  {
    id: 'interaction',
    name: 'Interaktion',
    kompetenzen: ['mündliche Interaktion', 'schriftliche Interaktion', 'Online-Interaktion'],
  },
  {
    id: 'mediation',
    name: 'Mediation',
    kompetenzen: [
      'Informationen vermitteln',
      'Texte vermitteln',
      'Konzepte vermitteln',
      'Kommunikation ermöglichen',
    ],
  },
  {
    id: 'means',
    name: 'Sprachliche Mittel',
    kompetenzen: ['Wortschatz', 'Grammatik', 'Aussprache / Phonologie', 'Orthografie'],
  },
  {
    id: 'further',
    name: 'Weitere Kompetenzen',
    kompetenzen: ['Lernstrategien', 'interkulturelle Kompetenz', 'plurilinguale Kompetenz'],
  },
];

/* Auffangbereich. Hier landet, was keinem Bereich zugeordnet ist –
   frei getippte Kompetenzen aus der Zeit vor dem Modus ebenso wie
   neue, für die die Lehrkraft keinen Bereich gewählt hat. Er ist kein
   Systembereich im Sinne der Auswahlliste, sondern die Voreinstellung. */
export const OHNE_BEREICH_ID = 'custom';
export const OHNE_BEREICH_NAME = 'Ohne Bereich';

const SYSTEM_BEREICH_IDS = new Set(SYSTEM_BEREICHE.map(b => b.id));

/* Etikett → Bereichs-id, für alle Systemkompetenzen. */
const SYSTEM_ZUORDNUNG = (()=>{
  const m = new Map();
  for (const b of SYSTEM_BEREICHE) {
    for (const k of b.kompetenzen) m.set(k, b.id);
  }
  return m;
})();

export function normalisiereEtikett(label){
  return String(label ?? '').trim();
}

/* Eine Kompetenz gilt als Systemkompetenz, wenn sie im Katalog oben
   steht. Mehr Zustand braucht es dafür nicht. */
export function istSystemKompetenz(label){
  return SYSTEM_ZUORDNUNG.has(normalisiereEtikett(label));
}

export function quelleVon(label){
  return istSystemKompetenz(label) ? 'system' : 'custom';
}

export function istSystemBereich(bereichId){
  return SYSTEM_BEREICH_IDS.has(String(bereichId || ''));
}

/* Der gespeicherte Teil des Katalogs. Bewusst klein: eigene Bereiche,
   die Zuordnung eigener Kompetenzen und die ausgeblendeten Etiketten.
   Alles andere steht in der Konfiguration oben. */
export function leeresModell(){
  return { customAreas: [], areaOf: {}, hidden: {} };
}

export function normalisiereModell(raw){
  const m = (raw && typeof raw === 'object') ? raw : {};

  const gesehen = new Set();
  const customAreas = (Array.isArray(m.customAreas) ? m.customAreas : [])
    .map((a)=>{
      const o = (a && typeof a === 'object') ? a : null;
      if (!o) return null;
      const id = String(o.id || '').trim();
      const name = String(o.name || '').trim();
      // Ein eigener Bereich darf die id eines Systembereichs nicht
      // überschreiben – sonst verschwände dessen Name aus der Auswahl.
      if (!id || !name || istSystemBereich(id) || id === OHNE_BEREICH_ID) return null;
      if (gesehen.has(id)) return null;
      gesehen.add(id);
      return { id, name };
    })
    .filter(Boolean);

  const bekannteBereiche = new Set([
    ...SYSTEM_BEREICH_IDS,
    ...customAreas.map(a => a.id),
    OHNE_BEREICH_ID,
  ]);

  const areaOf = {};
  for (const [label, bereichId] of Object.entries((m.areaOf && typeof m.areaOf === 'object') ? m.areaOf : {})) {
    const l = normalisiereEtikett(label);
    const b = String(bereichId || '');
    if (!l || !bekannteBereiche.has(b)) continue;
    // Systemkompetenzen behalten ihren Bereich aus der Konfiguration.
    if (istSystemKompetenz(l)) continue;
    areaOf[l] = b;
  }

  const hidden = {};
  for (const [label, wert] of Object.entries((m.hidden && typeof m.hidden === 'object') ? m.hidden : {})) {
    const l = normalisiereEtikett(label);
    if (l && wert) hidden[l] = true;
  }

  return { customAreas, areaOf, hidden };
}

/* Der Bereich einer Kompetenz: erst die Konfiguration, dann die
   gespeicherte Zuordnung, sonst der Auffangbereich. */
export function bereichVon(label, modell){
  const l = normalisiereEtikett(label);
  const ausSystem = SYSTEM_ZUORDNUNG.get(l);
  if (ausSystem) return ausSystem;
  const zug = modell?.areaOf?.[l];
  return zug || OHNE_BEREICH_ID;
}

/* Alle Bereiche in Anzeigereihenfolge: Systembereiche in der
   fachdidaktisch begründeten Reihenfolge, danach eigene, zuletzt der
   Auffangbereich. */
export function alleBereiche(modell){
  return [
    ...SYSTEM_BEREICHE.map(b => ({ id: b.id, name: b.name, source: 'system' })),
    ...(modell?.customAreas || []).map(a => ({ id: a.id, name: a.name, source: 'custom' })),
    { id: OHNE_BEREICH_ID, name: OHNE_BEREICH_NAME, source: 'system' },
  ];
}

/* Der vollständige Katalog: Systemkompetenzen plus alles, was die
   Lehrkraft je benutzt hat, nach Bereichen gruppiert.

   `benutzte` sind die Etiketten aus db.competencies – dort stehen seit
   jeher alle frei eingegebenen Kompetenzen. Genau deshalb sind eigene
   Kompetenzen ohne eine einzige Zeile Migration wiederverwendbar.

   `zusaetzlich` nimmt Etiketten auf, die zwar in der gerade offenen
   Stunde stehen, aber nicht mehr im Katalog – etwa weil sie ausgeblendet
   oder gelöscht wurden. Sie sollen sichtbar bleiben, nicht verschwinden. */
export function katalogNachBereichen({
  modell, benutzte = [], zusaetzlich = [],
  mitAusgeblendeten = false, mitLeeren = false,
} = {}){
  const m = modell || leeresModell();
  const behalten = new Set((zusaetzlich || []).map(normalisiereEtikett).filter(Boolean));

  const proBereich = new Map();
  for (const b of alleBereiche(m)) proBereich.set(b.id, []);

  const gesehen = new Set();
  const aufnehmen = (label)=>{
    const l = normalisiereEtikett(label);
    if (!l || gesehen.has(l)) return;
    const ausgeblendet = Boolean(m.hidden?.[l]);
    // Ausgeblendetes bleibt sichtbar, wenn es in dieser Stunde steht –
    // sonst könnte man es nicht mehr abwählen.
    if (ausgeblendet && !mitAusgeblendeten && !behalten.has(l)) return;
    gesehen.add(l);
    const bereichId = bereichVon(l, m);
    if (!proBereich.has(bereichId)) proBereich.set(bereichId, []);
    proBereich.get(bereichId).push({
      label: l,
      source: quelleVon(l),
      hidden: ausgeblendet,
      bereichId,
    });
  };

  for (const b of SYSTEM_BEREICHE) for (const k of b.kompetenzen) aufnehmen(k);
  for (const l of benutzte) aufnehmen(l);
  for (const l of behalten) aufnehmen(l);

  /* Leere Bereiche bleiben bei der Auswahl aus – eine Überschrift ohne
     Einträge hilft beim Planen niemandem. In der Verwaltung müssen sie
     dagegen sichtbar sein: sonst sähe ein gerade angelegter eigener
     Bereich aus, als wäre er nicht entstanden, und man käme nicht dazu,
     ihm etwas zuzuordnen. */
  return alleBereiche(m)
    .map(b => ({ ...b, kompetenzen: proBereich.get(b.id) || [] }))
    .filter(b => mitLeeren ? (b.kompetenzen.length > 0 || b.source === 'custom') : b.kompetenzen.length > 0);
}

/* Suche über System- und eigene Kompetenzen. Ohne Suchbegriff bleibt
   die Gliederung unverändert. */
export function filterKatalog(bereiche, suche){
  const q = String(suche || '').trim().toLowerCase();
  if (!q) return bereiche;
  return bereiche
    .map(b => ({ ...b, kompetenzen: b.kompetenzen.filter(k => k.label.toLowerCase().includes(q)) }))
    .filter(b => b.kompetenzen.length > 0);
}
