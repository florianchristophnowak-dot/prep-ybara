/* ============================================================
   Planungsprofile und Exportlayouts

   Zwei verschiedene Dinge, die hier bewusst nebeneinander stehen:

   1. Ein PLANUNGSPROFIL bestimmt, welche Angaben beim Planen einer
      Phase sichtbar und bearbeitbar sind.
   2. Ein EXPORTLAYOUT bestimmt, welche der vorhandenen Angaben im
      tabellarischen Verlaufsplan ausgegeben werden.

   Beides ist frei kombinierbar. Wer im Ausbildungsentwurf plant, darf
   kompakt exportieren; wer kompakt geplant hat, darf ein ausführliches
   Layout wählen und bekommt vor dem Export einen Hinweis auf das, was
   noch fehlt.

   DREI ENTSCHEIDUNGEN, die den Rest tragen:

   1. Es gibt EIN Datenmodell für eine Phase, nicht eines je Profil.
      Ein Profil blendet Felder ein und aus – es löscht nie etwas. Der
      Wechsel zwischen Profilen ist deshalb in beide Richtungen
      verlustfrei und beliebig oft wiederholbar.

   2. Alles, was ein Feld ausmacht – Bezeichnung, Eingabeart, Breite im
      Export, Zugehörigkeit zu einem Profil –, steht genau hier. Weder
      die Phasenplanung noch der Export führen eine eigene Liste.

   3. Vorhandene Felder werden weiterverwendet. `phase`, `content`,
      `socialForm`, `materialsMedia`, `remarks` und `scaffolds` gibt es
      seit der ersten Fassung; sie bekommen hier nur einen Eintrag, kein
      zweites Feld daneben.

   Ausdrücklich NICHT vorgesehen ist ein Profil "kompetenzorientiert".
   Kompetenzorientierung ist kein Umfang, den man wählt, sondern die
   Grundlage jeder Planung in dieser App – auch der kompakten.
   ============================================================ */

import { normalisiereScaffolds, istLeererScaffold, scaffoldArtName, stufenName } from './didaktik.js';

/* ---- Textwert eines Feldes ------------------------------------------
   Die Inhaltsfelder speichern angereicherten Text (HTML). Für die Frage
   "steht hier etwas?" zählt allein der Text, nicht das Markup: ein
   leeres <p></p> aus dem Editor ist eine leere Angabe. */
export function textAusWert(wert){
  if (wert === null || wert === undefined) return '';
  return String(wert)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---- Die Registry ---------------------------------------------------
   Die Reihenfolge hier ist die fachliche Reihenfolge und zugleich die
   Standardreihenfolge im Export: vom Lernziel über das Handeln der
   Lernenden und die Aufgabe zur Interaktion und zum Ergebnis. Material
   und Lehrerhandeln stehen bewusst NICHT am Anfang.

   Bedeutung der Angaben:
     id           Schlüssel in Profilen, Layouts und Konfigurationen
     key          Feldname in der gespeicherten Phase
     label        volle Bezeichnung in der Planung
     kurz         Spaltenüberschrift im Export
     eingabe      Eingabeart in der Phasenplanung
     zelle        Darstellung in der Exporttabelle
     breite       Richtwert der Spaltenbreite (wird auf 100 % skaliert)
     basis        steht in der Phasenplanung immer offen (nicht unter
                  "Weitere Angaben")
     pflicht      wird im Export nie automatisch ausgeblendet */
export const PLANUNGSFELDER = [
  {
    id: 'time', key: 'duration',
    label: 'Zeit / Dauer', kurz: 'Zeit',
    eingabe: 'zeit', zelle: 'zeit', breite: 8,
    basis: true, pflicht: true,
  },
  {
    id: 'phase', key: 'title',
    label: 'Phase', kurz: 'Phase',
    eingabe: 'phasenname', zelle: 'stark', breite: 12,
    basis: true, pflicht: true,
    platzhalter: 'z. B. Einstieg, Erarbeitung, Sicherung',
  },
  {
    id: 'phaseFunction', key: 'phaseFunction',
    label: 'Funktion der Phase', kurz: 'Funktion',
    eingabe: 'text', zelle: 'text', breite: 10,
    platzhalter: 'z. B. aktivieren, erschließen, sichern, übertragen',
  },
  {
    id: 'learningGoal', key: 'learningGoal',
    label: 'Lernzielbezug', kurz: 'Lernziel',
    eingabe: 'text', zelle: 'text', breite: 12,
    platzhalter: 'Worauf zahlt diese Phase ein?',
  },
  {
    id: 'learnerActivity', key: 'learnerActivity',
    label: 'Lernaktivität der Lernenden', kurz: 'Lernaktivität',
    eingabe: 'rich', zelle: 'rich', breite: 14,
    platzhalter: 'Was tun die Lernenden? (nicht: was tut die Lehrkraft)',
  },
  {
    id: 'languageAction', key: 'languageAction',
    label: 'Sprachhandeln', kurz: 'Sprachhandeln',
    eingabe: 'text', zelle: 'text', breite: 12,
    platzhalter: 'z. B. Vorschläge machen und darauf reagieren',
  },
  {
    id: 'content', key: 'content',
    label: 'Inhalt / Ablauf', kurz: 'Inhalt, Aktivität, methodisches Vorgehen',
    eingabe: 'rich', zelle: 'rich', breite: 22,
    basis: true, pflicht: true,
    platzhalter: 'Was passiert in dieser Phase? Material? Fragen? Differenzierung?',
  },
  {
    id: 'task', key: 'task',
    label: 'Arbeitsauftrag', kurz: 'Arbeitsauftrag',
    eingabe: 'rich', zelle: 'rich', breite: 16,
    platzhalter: 'Der Auftrag so, wie die Lernenden ihn hören oder lesen.',
  },
  {
    id: 'socialForm', key: 'socialForm',
    label: 'Sozialform', kurz: 'Sozialform',
    eingabe: 'sozialform', zelle: 'text', breite: 9,
    basis: true,
  },
  {
    id: 'interaction', key: 'interaction',
    label: 'Interaktionsform', kurz: 'Interaktion',
    eingabe: 'text', zelle: 'text', breite: 9,
    platzhalter: 'z. B. L–S, S–S, Plenum, Austausch in Gruppen',
  },
  {
    id: 'materialsMedia', key: 'materialsMedia',
    label: 'Materialien & Medien', kurz: 'Materialien und Medien',
    eingabe: 'rich', zelle: 'rich', breite: 11,
    basis: true,
    platzhalter: 'z. B. AB, Tafelbild, Beamer, Karten, ...',
  },
  {
    id: 'teacherPrompt', key: 'teacherPrompt',
    label: 'Lehrerimpuls / Lehrerhandeln', kurz: 'Lehrerimpuls',
    eingabe: 'rich', zelle: 'rich', breite: 14,
    platzhalter: 'Impuls, Frage oder Handlung der Lehrkraft.',
  },
  {
    id: 'scaffolding', key: 'scaffolds',
    label: 'Sprachliche Unterstützung / Scaffolding', kurz: 'Scaffolding',
    eingabe: 'scaffolds', zelle: 'scaffolds', breite: 12,
  },
  {
    id: 'differentiation', key: 'differentiation',
    label: 'Differenzierung', kurz: 'Differenzierung',
    eingabe: 'rich', zelle: 'rich', breite: 12,
    platzhalter: 'Was ist für wen anders – Umfang, Hilfe, Anspruch, Zeit?',
  },
  {
    id: 'expectedOutcome', key: 'expectedOutcome',
    label: 'Erwartetes Ergebnis', kurz: 'Erwartetes Ergebnis',
    eingabe: 'rich', zelle: 'rich', breite: 13,
    platzhalter: 'Was liegt am Ende der Phase vor?',
  },
  {
    id: 'successIndicator', key: 'successIndicator',
    label: 'Indikator der Zielerreichung', kurz: 'Indikator Zielerreichung',
    eingabe: 'text', zelle: 'text', breite: 12,
    platzhalter: 'Woran ist erkennbar, dass die Phase getragen hat?',
  },
  {
    id: 'remarks', key: 'remarks',
    label: 'Bemerkungen / didaktisch-methodische Notiz', kurz: 'Bemerkungen',
    eingabe: 'rich', zelle: 'rich', breite: 10,
    basis: true,
    platzhalter: 'z. B. Hinweise, Beobachtungen, Alternativen, ...',
  },
];

export const FELD_IDS = PLANUNGSFELDER.map(f => f.id);
const FELD_NACH_ID = new Map(PLANUNGSFELDER.map(f => [f.id, f]));

export function feldDefinition(id){
  return FELD_NACH_ID.get(String(id || '')) || null;
}

/* Die neuen Felder als reine Textfelder – gebraucht beim Anlegen und
   Normalisieren einer Phase. `duration`, `title`, `content`,
   `socialForm`, `materialsMedia`, `remarks` und `scaffolds` gab es
   schon; sie werden dort weiter behandelt, wo sie immer behandelt
   wurden. */
export const NEUE_PHASENFELDER = PLANUNGSFELDER
  .filter(f => f.eingabe === 'text' || f.eingabe === 'rich')
  .map(f => f.key)
  .filter(k => !['content', 'materialsMedia', 'remarks'].includes(k));

/* ---- Profile --------------------------------------------------------
   Jedes Profil erweitert das vorherige. Damit ist der Wechsel nach oben
   immer ein Hinzukommen und nach unten immer ein Ausblenden – nie ein
   Umbau. */
const PROFIL_KOMPAKT = ['time', 'phase', 'content', 'socialForm', 'materialsMedia'];
const PROFIL_STANDARD = [
  'time', 'phase', 'learningGoal', 'learnerActivity', 'languageAction',
  'content', 'task', 'socialForm', 'materialsMedia', 'remarks',
];
const PROFIL_ERWEITERT = [
  ...PROFIL_STANDARD, 'interaction', 'scaffolding', 'differentiation', 'expectedOutcome',
];
const PROFIL_AUSBILDUNG = [
  ...PROFIL_ERWEITERT, 'phaseFunction', 'teacherPrompt', 'successIndicator',
];

export const PLANUNGSPROFILE = [
  {
    id: 'kompakt', name: 'Kompakt', felder: PROFIL_KOMPAKT,
    beschreibung: 'Zeit, Phase, Inhalt, Sozialform, Material.',
  },
  {
    id: 'standard', name: 'Standard', felder: PROFIL_STANDARD,
    beschreibung: 'Zusätzlich Lernzielbezug, Lernaktivität, Sprachhandeln und Arbeitsauftrag.',
  },
  {
    id: 'erweitert', name: 'Erweitert', felder: PROFIL_ERWEITERT,
    beschreibung: 'Zusätzlich Interaktion, Scaffolding, Differenzierung und erwartetes Ergebnis.',
  },
  {
    id: 'ausbildungsentwurf', name: 'Ausbildungsentwurf', felder: PROFIL_AUSBILDUNG,
    beschreibung: 'Zusätzlich Funktion der Phase, Lehrerimpuls und Indikator der Zielerreichung.',
  },
  {
    id: 'eigenes', name: 'Benutzerdefiniert', felder: PROFIL_STANDARD,
    beschreibung: 'Selbst festlegen, welche Angaben in der Phasenplanung erscheinen.',
    eigen: true,
  },
];

const PROFIL_NACH_ID = new Map(PLANUNGSPROFILE.map(p => [p.id, p]));
export const STANDARD_PROFIL = 'standard';

export function normalisiereProfilId(id){
  const s = String(id || '').trim();
  return PROFIL_NACH_ID.has(s) ? s : STANDARD_PROFIL;
}

export function profilName(id){
  return PROFIL_NACH_ID.get(normalisiereProfilId(id))?.name || 'Standard';
}

/* Eine Feldliste in die kanonische Reihenfolge bringen und Unbekanntes
   verwerfen. Gilt für gespeicherte eigene Profile ebenso wie für
   gespeicherte eigene Layouts: was hier nicht durchkommt, ist kein
   Feld dieser App. */
export function normalisiereFeldListe(raw, { erzwingePflicht = true } = {}){
  const liste = Array.isArray(raw) ? raw : [];
  const gesehen = new Set();
  const gewaehlt = [];
  for (const eintrag of liste){
    const id = String(eintrag || '').trim();
    if (!FELD_NACH_ID.has(id) || gesehen.has(id)) continue;
    gesehen.add(id);
    gewaehlt.push(id);
  }
  if (erzwingePflicht) {
    /* Ein fehlendes Pflichtfeld kommt dorthin, wo es hingehört: hinter
       das letzte bereits gewählte Feld, das ihm in der kanonischen
       Reihenfolge vorausgeht. Vorn anzuhängen wäre einfacher, ergäbe
       aber Spaltenfolgen wie "Inhalt, Zeit, Phase" – die selbst gewählte
       Reihenfolge bliebe zwar erhalten, sähe aber falsch aus. */
    for (const f of PLANUNGSFELDER){
      if (!f.pflicht || gesehen.has(f.id)) continue;
      const vorher = new Set(FELD_IDS.slice(0, FELD_IDS.indexOf(f.id)));
      let pos = 0;
      gewaehlt.forEach((id, i) => { if (vorher.has(id)) pos = i + 1; });
      gewaehlt.splice(pos, 0, f.id);
      gesehen.add(f.id);
    }
  }
  return gewaehlt;
}

/* Die sichtbaren Felder eines Profils, in kanonischer Reihenfolge. Beim
   eigenen Profil zählt die selbst gewählte Reihenfolge. */
export function profilFelder(profilId, eigeneFelder){
  const id = normalisiereProfilId(profilId);
  if (id === 'eigenes') {
    /* Ohne eigene Wahl beginnt "Benutzerdefiniert" beim Standard, nicht
       bei den drei Pflichtfeldern. Deshalb wird hier OHNE Pflichtfelder
       geprüft: sonst wäre die Liste nie leer und der Einstieg bestünde
       aus einer fast leeren Phasenkarte. */
    const gewaehlt = normalisiereFeldListe(eigeneFelder, { erzwingePflicht: false });
    return gewaehlt.length ? normalisiereFeldListe(gewaehlt) : [...PROFIL_STANDARD];
  }
  const felder = new Set(PROFIL_NACH_ID.get(id)?.felder || PROFIL_STANDARD);
  return FELD_IDS.filter(fid => felder.has(fid));
}

/* ---- Werte einer Phase ---------------------------------------------- */

export function feldWert(phase, feldId){
  const def = feldDefinition(feldId);
  if (!def || !phase || typeof phase !== 'object') return '';
  return phase[def.key];
}

/* Der Text einer Zelle – unabhängig davon, ob dahinter ein Textfeld,
   ein Editor oder die Hilfenliste steckt. Einzige Quelle für die Frage
   "ist diese Angabe gemacht?". */
export function feldText(phase, feldId){
  const def = feldDefinition(feldId);
  if (!def) return '';
  if (def.id === 'time') {
    const d = Number(phase?.duration || 0);
    return d > 0 ? `${d}` : '';
  }
  if (def.eingabe === 'scaffolds') {
    const liste = normalisiereScaffolds(phase?.scaffolds).filter(sc => !istLeererScaffold(sc));
    return liste
      .map(sc => [sc.label || scaffoldArtName(sc.type), sc.note, sc.supportLevel ? stufenName(sc.supportLevel) : '']
        .filter(Boolean).join(' '))
      .join(' · ');
  }
  return textAusWert(feldWert(phase, feldId));
}

export function feldHatInhalt(phase, feldId){
  return feldText(phase, feldId) !== '';
}

/* §27 der Vorgabe: eine einzige Prüfung, ob eine Spalte überhaupt etwas
   zu zeigen hat. */
export function hatInhaltFuerSpalte(phasen, feldId){
  return (Array.isArray(phasen) ? phasen : []).some(p => feldHatInhalt(p, feldId));
}

/* Wie viele Phasen zu einem Feld nichts sagen. Zählt nur – es bewertet
   nicht, ob das Eingetragene fachlich trägt. */
export function fehlendeAngaben(phasen, feldId){
  const liste = Array.isArray(phasen) ? phasen : [];
  const offen = [];
  liste.forEach((p, i) => { if (!feldHatInhalt(p, feldId)) offen.push(i); });
  return offen;
}

/* Die offenen Angaben EINER Phase, gemessen am gewählten Profil. Zeit
   und Phasenname zählen nicht mit: die sind immer gesetzt. */
export function offeneFelderDerPhase(phase, feldIds){
  return (Array.isArray(feldIds) ? feldIds : [])
    .filter(id => id !== 'time')
    .filter(id => !feldHatInhalt(phase, id));
}

/* ---- Exportlayouts --------------------------------------------------
   Dieselben Bezeichnungen wie bei den Profilen, aber eine andere Sache:
   sie beschreiben den Umfang der AUSGABE. Ein Layout darf ausführlicher
   sein als das Profil, mit dem geplant wurde – dann meldet die
   Vollständigkeitsprüfung, was fehlt, und der Export läuft trotzdem. */
const LAYOUT_KOMPAKT = ['time', 'phase', 'content', 'socialForm', 'materialsMedia'];
const LAYOUT_STANDARD = [
  'time', 'phase', 'learningGoal', 'learnerActivity',
  'content', 'task', 'socialForm', 'materialsMedia', 'remarks',
];
const LAYOUT_ERWEITERT = [
  ...LAYOUT_STANDARD, 'languageAction', 'interaction',
  'scaffolding', 'differentiation', 'expectedOutcome',
];
const LAYOUT_AUSBILDUNG = [
  ...LAYOUT_ERWEITERT, 'phaseFunction', 'teacherPrompt', 'successIndicator',
];

export const EXPORTLAYOUTS = [
  {
    id: 'kompakt', name: 'Kompakt', spalten: LAYOUT_KOMPAKT,
    beschreibung: 'Fünf Spalten – bleibt auch bei vielen Phasen lesbar.',
  },
  {
    id: 'standard', name: 'Standard', spalten: LAYOUT_STANDARD,
    beschreibung: 'Der gewohnte Verlaufsplan, ergänzt um Lernziel, Lernaktivität und Auftrag.',
  },
  {
    id: 'erweitert', name: 'Erweitert', spalten: LAYOUT_ERWEITERT,
    beschreibung: 'Zusätzlich Sprachhandeln, Interaktion, Scaffolding, Differenzierung, Ergebnis.',
  },
  {
    id: 'ausbildungsentwurf', name: 'Ausbildungsentwurf', spalten: LAYOUT_AUSBILDUNG,
    beschreibung: 'Alle Spalten des Entwurfs – auf A4 quer nur mit wenigen Phasen lesbar.',
  },
  {
    id: 'eigenes', name: 'Benutzerdefiniert', spalten: LAYOUT_STANDARD,
    beschreibung: 'Spalten selbst wählen, ordnen und in der Breite anpassen.',
    eigen: true,
  },
];

const LAYOUT_NACH_ID = new Map(EXPORTLAYOUTS.map(l => [l.id, l]));
export const STANDARD_LAYOUT = 'standard';

export function normalisiereLayoutId(id){
  const s = String(id || '').trim();
  return LAYOUT_NACH_ID.has(s) ? s : STANDARD_LAYOUT;
}

export function layoutName(id){
  return LAYOUT_NACH_ID.get(normalisiereLayoutId(id))?.name || 'Standard';
}

/* Das eigene Layout: welche Spalten, in welcher Reihenfolge, wie breit
   und – wo gewünscht – unter welcher Überschrift. Fehlt etwas, gilt der
   Wert aus der Registry. */
export function normalisiereEigenesLayout(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  // Aus demselben Grund wie bei profilFelder: erst prüfen, ob überhaupt
  // etwas gewählt wurde – und nur dann die Pflichtspalten ergänzen.
  const gewaehlt = normalisiereFeldListe(o.spalten || o.columnOrder || o.visibleColumns,
                                         { erzwingePflicht: false });
  const spalten = gewaehlt.length ? normalisiereFeldListe(gewaehlt) : [];
  const breiten = {};
  const quelleB = (o.breiten && typeof o.breiten === 'object') ? o.breiten : (o.columnWidths || {});
  for (const [k, v] of Object.entries(quelleB || {})){
    if (!FELD_NACH_ID.has(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) breiten[k] = Math.min(60, Math.max(4, Math.round(n)));
  }
  const bezeichnungen = {};
  const quelleL = (o.bezeichnungen && typeof o.bezeichnungen === 'object') ? o.bezeichnungen : (o.customLabels || {});
  for (const [k, v] of Object.entries(quelleL || {})){
    if (!FELD_NACH_ID.has(k)) continue;
    const s = String(v || '').trim().slice(0, 60);
    if (s) bezeichnungen[k] = s;
  }
  return {
    spalten: spalten.length ? spalten : [...LAYOUT_STANDARD],
    breiten,
    bezeichnungen,
  };
}

export function leeresEigenesLayout(){
  return { spalten: [...LAYOUT_STANDARD], breiten: {}, bezeichnungen: {} };
}

/* ---- Die zentrale Funktion vor jedem Renderer ------------------------

   Sie beantwortet für einen Verlaufsplan genau eine Frage: welche
   Spalten kommen in welcher Reihenfolge und Breite heraus? PDF, Word
   und die Vorschau bekommen dieselbe Antwort – es gibt keine zweite
   Stelle, an der Spalten entstehen.

   `alleBehalten` ist der Unterschied zwischen Preset und eigenem
   Layout: eine ausdrücklich angehakte Spalte bleibt stehen, auch wenn
   sie leer ist (§12 der Vorgabe). */
/* Die im Layout VORGESEHENEN Spalten – vor jedem Ausblenden. Die
   Vollständigkeitsprüfung braucht genau diese Liste: eine Spalte, die
   in allen Phasen leer ist, verschwindet aus dem Export, muss aber im
   Dialog trotzdem auftauchen. Sonst meldete die Prüfung ausgerechnet
   dort nichts, wo am meisten fehlt. */
export function layoutSpaltenIds(layoutId, eigenesLayout){
  const id = normalisiereLayoutId(layoutId);
  if (id === 'eigenes') return normalisiereEigenesLayout(eigenesLayout).spalten;
  const gesetzt = new Set(LAYOUT_NACH_ID.get(id)?.spalten || LAYOUT_STANDARD);
  return FELD_IDS.filter(fid => gesetzt.has(fid));
}

export function getLessonPlanExportColumns(layoutId, phasen, optionen = {}){
  const id = normalisiereLayoutId(layoutId);
  const eigen = normalisiereEigenesLayout(optionen.eigenesLayout);
  const istEigen = id === 'eigenes';
  const alleBehalten = istEigen ? optionen.alleBehalten !== false : Boolean(optionen.alleBehalten);

  const roh = layoutSpaltenIds(id, eigen);

  const gewaehlt = roh
    .map(fid => feldDefinition(fid))
    .filter(Boolean)
    .filter(def => def.pflicht || alleBehalten || hatInhaltFuerSpalte(phasen, def.id));

  const spalten = gewaehlt.length ? gewaehlt : [feldDefinition('time'), feldDefinition('phase'), feldDefinition('content')];

  const breiteVon = (def) => {
    const b = istEigen ? eigen.breiten[def.id] : undefined;
    return Number.isFinite(b) && b > 0 ? b : def.breite;
  };
  const summe = spalten.reduce((a, def) => a + breiteVon(def), 0) || 1;

  return spalten.map((def) => ({
    id: def.id,
    key: def.key,
    label: (istEigen && eigen.bezeichnungen[def.id]) ? eigen.bezeichnungen[def.id] : def.kurz,
    zelle: def.zelle,
    pflicht: Boolean(def.pflicht),
    breite: Math.round((breiteVon(def) / summe) * 1000) / 10,
  }));
}

/* Ab wann wird A4 quer eng? Der Wert ist eine Erfahrungsgrösse, kein
   Grenzwert: gewarnt wird, gesperrt wird nichts. */
export const SPALTEN_WARNGRENZE = 8;

/* Die Vollständigkeitsprüfung vor dem Export (§13).

   Sie stellt ausschliesslich fest, ob ein Feld ausgefüllt ist. Sie
   bewertet ausdrücklich NICHT, ob ein Lernziel, ein Arbeitsauftrag oder
   ein Sprachhandeln fachlich gut formuliert ist. Kein Score, keine
   Note, keine automatische Beurteilung. */
export function exportPruefung(layoutId, phasen, optionen = {}){
  const spalten = getLessonPlanExportColumns(layoutId, phasen, optionen);
  const anzahlPhasen = (Array.isArray(phasen) ? phasen : []).length;
  const ausgegeben = new Set(spalten.map(s => s.id));

  /* Geprüft wird über die VORGESEHENEN Spalten, nicht über die
     übriggebliebenen – sonst bliebe genau die Spalte unerwähnt, die
     wegen fehlender Angaben gerade herausgefallen ist. */
  const zeilen = layoutSpaltenIds(layoutId, optionen.eigenesLayout)
    .map(id => feldDefinition(id))
    .filter(def => def && !def.pflicht)
    .map(def => {
      const offen = fehlendeAngaben(phasen, def.id);
      return {
        id: def.id,
        label: spalten.find(s => s.id === def.id)?.label || def.kurz,
        offen: offen.length,
        phasen: offen,
        gesamt: anzahlPhasen,
        ausgegeben: ausgegeben.has(def.id),
      };
    });

  return {
    spalten,
    anzahlPhasen,
    zeilen,
    unvollstaendig: zeilen.filter(z => z.offen > 0 && z.offen < anzahlPhasen),
    leer: zeilen.filter(z => anzahlPhasen > 0 && z.offen === anzahlPhasen),
    zuVieleSpalten: spalten.length > SPALTEN_WARNGRENZE,
  };
}
