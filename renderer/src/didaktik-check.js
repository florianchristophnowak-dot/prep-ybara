/* ============================================================
   Fachdidaktischer Planungscheck

   Eine abgeleitete Sicht auf die vorhandene Planung. Er speichert
   nichts, ändert nichts und läuft nur auf Klick.

   DIE ENTSCHEIDENDE GRENZE: Die App liest keinen Sinn aus Freitext.

   Zwischen "was steht strukturiert in den Feldern" und "was hat die
   Lehrkraft in den Ablauf geschrieben" liegt der ganze Unterschied
   zwischen einer Feststellung und einer Frage:

   - Aus STRUKTURIERTEN Daten – Kompetenzen, ausgefüllte Felder der
     kommunikativen Aufgabe, Sprechabsichten, Unterstützungsstufen –
     darf die App feststellen: "ist bereits angelegt". Das ist keine
     Deutung, sondern das Vorlesen dessen, was dasteht.

   - Aus FREITEXT darf sie nur fragen. Ein Suchwort sagt, dass ein Wort
     vorkommt, nicht ob die Sache didaktisch trägt. "Präsentation" im
     Ablauf heisst nicht, dass präsentiert wird; das Fehlen von
     "Zuhörauftrag" heisst nicht, dass die Zuhörenden untätig sind.
     Deshalb löst ein Suchwort hier ausschliesslich eine Frage aus –
     nie einen Vorwurf und nie ein Häkchen.

   Daraus folgt der Ton: Fragen statt Befunde. "Wo sprechen die
   Lernenden miteinander?" statt "Es fehlt eine Partnerphase." Die
   Lehrkraft weiss, was in ihrer Stunde passiert; die App weiss nur,
   was in den Feldern steht.

   AUSWAHL STATT VOLLSTÄNDIGKEIT: Der Katalog unten ist länger als das,
   was je erscheint. Höchstens zwei Feststellungen und sechs Impulse,
   davon je Prinzip nur einer. Ein Check, der zwanzig Punkte auflistet,
   wird überflogen und nicht gelesen.
   ============================================================ */

/* Ein Prinzip darf höchstens einen Impuls stellen. Ohne diese Klammer
   entstünden aus derselben didaktischen Frage drei Formulierungen. */
export const PRINZIPIEN = [
  'goal',
  'communicative-purpose',
  'peer-interaction',
  'listener-activity',
  'reception-progression',
  'visual-information',
  'reading-purpose',
  'writing-process',
  'mediation-selection',
  'grammar-transfer',
  'vocabulary-production',
  'pronunciation',
  'scaffolding',
  'progression',
  'activation',
  'media',
];

export const MAX_STAERKEN = 2;
export const MAX_IMPULSE = 6;

/* Prioritäten. Kompetenzspezifisches vor Allgemeinem, Konkretes vor
   Grundsätzlichem – so bleibt oben stehen, wofür sich der zweite Blick
   am ehesten lohnt. */
const P = { sehrHoch: 90, hoch: 70, mittel: 50, niedrig: 30, allgemein: 10 };

/* ---- Textaufbereitung ------------------------------------------------ */

function txt(x){ return String(x ?? '').trim(); }

/* Freitext aus der Stunde kommt teils als HTML aus dem Editor. Für die
   Suche nach Stichwörtern zählt nur der lesbare Text. */
function nurText(html){
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function enthaelt(haystack, woerter){
  return woerter.some(w => haystack.includes(w));
}

/* Kleiner deterministischer Hash. Bewusst kein Math.random: der Text
   müsste sich sonst bei jedem Rendern ändern, und derselbe Entwurf
   ergäbe zweimal ein anderes Ergebnis. */
function hash(s){
  let h = 0;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

/* ---- Kompetenzen ------------------------------------------------------
   Die einzigen wirklich strukturierten Angaben zum Vorhaben der Stunde.
   Sie entscheiden, welche Regeln überhaupt zutreffen. */

const K = {
  muendlicheInteraktion: 'mündliche Interaktion',
  schriftlicheInteraktion: 'schriftliche Interaktion',
  onlineInteraktion: 'Online-Interaktion',
  sprechen: 'zusammenhängendes Sprechen',
  schreiben: 'Schreiben',
  hoeren: 'Hörverstehen',
  hoersehen: 'Hörsehverstehen',
  lesen: 'Leseverstehen',
  wortschatz: 'Wortschatz',
  grammatik: 'Grammatik',
  aussprache: 'Aussprache / Phonologie',
};

const MEDIATION = [
  'Informationen vermitteln', 'Texte vermitteln',
  'Konzepte vermitteln', 'Kommunikation ermöglichen',
];

function kompetenzenVon(lesson){
  const alle = new Set();
  const p = txt(lesson?.primaryCompetency);
  if (p) alle.add(p);
  for (const c of (Array.isArray(lesson?.competencies) ? lesson.competencies : [])) {
    const v = txt(c);
    if (v) alle.add(v);
  }
  return alle;
}

/* ---- Aufbereiteter Blick auf die Stunde ------------------------------- */

function lies(lesson){
  const l = (lesson && typeof lesson === 'object') ? lesson : {};
  const phasen = (Array.isArray(l.phases) ? l.phases : [])
    .filter(p => p && typeof p === 'object');

  const komp = kompetenzenVon(l);
  const hat = (name)=> komp.has(name);
  const hatEines = (namen)=> namen.some(n => komp.has(n));

  const aufgabe = {
    text: txt(l.communicativeTask?.text),
    situation: txt(l.communicativeTask?.situation),
    audience: txt(l.communicativeTask?.audience),
    intention: txt(l.communicativeTask?.intention),
    outcome: txt(l.communicativeTask?.outcome),
  };
  const aufgabeDetails = [aufgabe.situation, aufgabe.audience, aufgabe.intention, aufgabe.outcome]
    .filter(Boolean).length;

  const mittel = {
    vocabulary: txt(l.languageResources?.vocabulary),
    grammar: txt(l.languageResources?.grammar),
    pronunciation: txt(l.languageResources?.pronunciation),
    other: txt(l.languageResources?.other),
  };

  const sprechabsichten = (Array.isArray(l.speechActs) ? l.speechActs : [])
    .map(txt).filter(Boolean);
  const kriterien = (Array.isArray(l.successCriteria) ? l.successCriteria : [])
    .map(txt).filter(Boolean);

  const scaffolds = phasen.flatMap(p => (Array.isArray(p.scaffolds) ? p.scaffolds : [])
    .filter(s => s && (txt(s.label) || txt(s.note))));

  const gesamtdauer = phasen.reduce((a, p)=> a + (Number(p.duration) || 0), 0);

  // Je Phase: was sich durchsuchen lässt, in einem Stück.
  const phasenText = phasen.map(p => ({
    phase: p,
    id: txt(p.id),
    titel: txt(p.title),
    sozialform: nurText(p.socialForm),
    medien: nurText(p.materialsMedia),
    // Alles, was die Lehrkraft zu dieser Phase geschrieben hat.
    alles: [p.title, p.socialForm, p.content, p.materialsMedia, p.remarks]
      .map(nurText).join(' '),
  }));

  const allesText = phasenText.map(p => p.alles).join(' ')
    + ' ' + nurText(l.topic) + ' ' + nurText(l.objectives);

  return {
    l, phasen, phasenText, allesText, komp, hat, hatEines,
    aufgabe, aufgabeDetails, mittel, sprechabsichten, kriterien, scaffolds, gesamtdauer,
  };
}

/* ---- Suchwortgruppen --------------------------------------------------
   Sie sagen aus, dass ein Wort vorkommt – nicht, dass die Sache
   didaktisch trägt. Sie lösen deshalb nur Fragen aus. */

const W = {
  partnerarbeit: ['partner', 'paar', 'tandem', 'gruppe', 'gruppenarbeit', ' pa ', ' ga ',
                  'kugellager', 'speed-dating', 'speeddating', 'placemat', 'think-pair'],
  plenum: ['plenum', 'unterrichtsgespräch', ' ug ', 'lehrer-schüler', 'frontal'],
  praesentation: ['präsentation', 'präsentieren', 'vorstellen', 'vortrag', 'vorträge', 'vorstellung'],
  zuhoerauftrag: ['zuhörauftrag', 'hörauftrag', 'beobachtungsauftrag', 'beobachtung', 'feedback',
                  'notieren', 'notiert', 'vergleichen', 'auswählen', 'rückmeldung', 'checkliste'],
  verstehensebenen: ['global', 'selektiv', 'detail', 'überblick', 'grobverständnis', 'detailverstehen',
                     'erstes hören', 'zweites hören', 'erster durchgang'],
  visuell: ['bild', 'mimik', 'gestik', 'szene', 'visuell', 'ort', 'kamera', 'standbild', 'kulisse'],
  video: ['video', 'film', 'clip', 'ausschnitt', 'sequenz', 'trailer'],
  uebersetzen: ['übersetzen', 'übersetzung', 'satz für satz', 'wort für wort'],
  lesestrategie: ['lesestrategie', 'überfliegen', 'scanning', 'skimming', 'schlüsselwör',
                  'markieren', 'unterstreichen', 'erschließen'],
  schreibprozess: ['planen', 'planung', 'entwurf', 'überarbeiten', 'überarbeitung', 'feedback',
                   'rückmeldung', 'schreibkonferenz', 'korrektur', 'redigieren'],
  gelenkteUebung: ['lückentext', 'einsetzen', 'einsetzübung', 'transformation', 'umformen',
                   'regel', 'konjugieren', 'ergänzen sie', 'ausfüllen'],
  anwendung: ['anwend', 'transfer', 'übertrag', 'eigenständig', 'selbstständig', 'frei',
              'rollenspiel', 'dialog', 'gespräch', 'diskussion', 'produzieren', 'erstellen'],
  wortliste: ['vokabelliste', 'wortliste', 'vokabeln lernen', 'wörterliste', 'vokabelheft'],
  praesentationsmedien: ['powerpoint', 'folie', 'folien', 'beamer', 'präsentationsfolien', 'slides'],
};

/* Phasen, deren Name auf eine Funktion hindeutet. */
function istPhase(titel, woerter){
  const t = String(titel || '').toLowerCase();
  return woerter.some(w => t.includes(w));
}

/* ============================================================
   Das Regelwerk

   Jede Regel liefert entweder nichts oder einen Eintrag. Sie kennt ihr
   Prinzip, ihre Priorität und – wo möglich – die Phase, um die es geht.
   ============================================================ */

function impuls(id, prinzip, kategorie, titel, text, prioritaet, extra = {}){
  return {
    id, principle: prinzip, category: kategorie, title: titel, text,
    priority: prioritaet, phaseId: extra.phaseId || null, target: extra.target || 'phases',
  };
}

function staerke(id, titel, text){
  return { id, title: titel, text };
}

/* ---- Feststellungen: nur aus strukturierten Daten --------------------- */
function sammleStaerken(d){
  const out = [];

  // Kommunikative Aufgabe: Text plus mindestens zwei ausgefüllte Felder.
  if (d.aufgabe.text && d.aufgabeDetails >= 2) {
    out.push(staerke('task-detailed', 'Kommunikative Aufgabe konkretisiert',
      'Situation, Adressat, Absicht oder Ergebnis sind bereits genauer beschrieben.'));
  }

  // Sprechabsichten bei mündlichem Vorhaben.
  if (d.sprechabsichten.length
      && d.hatEines([K.muendlicheInteraktion, K.sprechen, K.onlineInteraktion])) {
    out.push(staerke('speechacts-ready', 'Sprachhandeln vorbereitet',
      'Für die geplante Interaktion sind kommunikative Funktionen hinterlegt.'));
  }

  // Scaffolding: unterschiedliche Stufen oder ein geplanter Abbau.
  const stufen = new Set(d.scaffolds.map(s => txt(s.supportLevel)).filter(Boolean));
  const abbau = d.scaffolds.some(s => s.fadeOut);
  if (d.scaffolds.length && (stufen.size > 1 || abbau)) {
    out.push(staerke('scaffolding-differentiated', 'Unterstützung differenziert angelegt',
      'Hilfen und ihre mögliche Rücknahme sind in der Planung sichtbar.'));
  }

  // Erfolgskriterien beim Schreiben.
  if (d.hat(K.schreiben) && d.kriterien.length) {
    out.push(staerke('writing-criteria', 'Erfolgskriterien vorhanden',
      'Kriterien für das Produkt sind in der Planung angelegt.'));
  }

  return out;
}

/* ---- Impulse ---------------------------------------------------------- */
function sammleImpulse(d){
  const out = [];
  const add = (x)=> { if (x) out.push(x); };

  const mundlich = d.hatEines([K.muendlicheInteraktion, K.sprechen, K.onlineInteraktion]);
  const produktivInteraktiv = mundlich
    || d.hatEines([K.schreiben, K.schriftlicheInteraktion, ...MEDIATION]);
  const mediation = d.hatEines(MEDIATION);

  /* --- Sprachhandeln und kommunikative Aufgabe --- */
  if (produktivInteraktiv && !d.aufgabe.text) {
    add(impuls('task-missing', 'communicative-purpose', 'Sprachhandeln',
      'Kommunikative Aufgabe',
      'Welche Aufgabe macht es für die Lernenden notwendig, Sprache tatsächlich zu verwenden?',
      P.sehrHoch, { target: 'didaktik' }));
  } else if (d.aufgabe.text && !d.aufgabe.audience) {
    add(impuls('task-audience', 'communicative-purpose', 'Sprachhandeln',
      'Adressat',
      'Für wen handeln die Lernenden sprachlich – und welchen Unterschied macht dieser Adressat für ihre Äußerungen?',
      P.sehrHoch, { target: 'didaktik' }));
  } else if (d.aufgabe.text && d.aufgabeDetails === 0) {
    add(impuls('task-vague', 'communicative-purpose', 'Sprachhandeln',
      'Kommunikatives Ziel',
      'Was wollen die Lernenden mit ihrer Äußerung erreichen?',
      P.hoch, { target: 'didaktik' }));
  }

  if (mundlich && !d.sprechabsichten.length) {
    add(impuls('speechacts-missing', 'communicative-purpose', 'Sprachhandeln',
      'Sprechabsichten',
      'Welche Sprechabsichten brauchen die Lernenden, um das Gespräch selbstständig führen zu können?',
      P.sehrHoch, { target: 'didaktik' }));
  }

  /* --- Schüler-Schüler-Interaktion --- */
  if (mundlich && d.phasen.length) {
    const hatPartner = d.phasenText.some(p => enthaelt(p.alles, W.partnerarbeit));
    const plenumPhasen = d.phasenText.filter(p => enthaelt(p.alles, W.plenum));
    if (!hatPartner) {
      // Frage, keine Behauptung über die tatsächliche Sprechzeit.
      add(impuls('peer-interaction', 'peer-interaction', 'Interaktion',
        'Lernendeninteraktion',
        plenumPhasen.length
          ? 'Wo sprechen die Lernenden miteinander statt überwiegend mit der Lehrkraft?'
          : 'Wo erhalten möglichst viele Lernende gleichzeitig Gelegenheit, selbst zu sprechen?',
        P.sehrHoch, { phaseId: plenumPhasen[0]?.id || null }));
    }
  }

  /* --- Präsentation und Zuhöraktivität --- */
  const praesPhase = d.phasenText.find(p => enthaelt(p.alles, W.praesentation));
  if (praesPhase && !enthaelt(praesPhase.alles, W.zuhoerauftrag)) {
    add(impuls('listener-activity', 'listener-activity', 'Interaktion',
      'Zuhörende',
      'Was tun die Zuhörenden während der Präsentation – welche Information nehmen sie auf und verwenden sie anschließend weiter?',
      P.sehrHoch, { phaseId: praesPhase.id }));
  }

  /* --- Hör- und Hörsehverstehen --- */
  if (d.hatEines([K.hoeren, K.hoersehen])) {
    if (!enthaelt(d.allesText, W.verstehensebenen)) {
      add(impuls('reception-progression', 'reception-progression', 'Rezeption',
        'Verstehensebenen',
        'Wie staffelst du das Verstehen – beispielsweise global, selektiv und detailliert?',
        P.hoch));
    }
    const videoDa = d.hat(K.hoersehen) || enthaelt(d.allesText, W.video);
    if (videoDa && !enthaelt(d.allesText, W.visuell)) {
      add(impuls('visual-information', 'visual-information', 'Rezeption',
        'Visuelle Informationen',
        'Welche visuellen Informationen können die Lernenden gezielt zum Verstehen nutzen?',
        P.hoch));
    }
  }

  /* --- Leseverstehen --- */
  if (d.hat(K.lesen)) {
    if (enthaelt(d.allesText, W.uebersetzen)) {
      add(impuls('reading-decoding', 'reading-purpose', 'Rezeption',
        'Leseabsicht',
        'Welche Informationen können die Lernenden erschließen, ohne den Text vollständig zu übersetzen?',
        P.hoch));
    } else if (!enthaelt(d.allesText, W.lesestrategie)) {
      add(impuls('reading-purpose', 'reading-purpose', 'Rezeption',
        'Leseabsicht',
        'Mit welcher Leseabsicht gehen die Lernenden an den Text – und was müssen sie verstehen, um die anschließende Aufgabe zu bewältigen?',
        P.hoch));
    }
  }

  /* --- Schreiben --- */
  if (d.hat(K.schreiben)) {
    if (!enthaelt(d.allesText, W.schreibprozess)) {
      add(impuls('writing-process', 'writing-process', 'Produktion',
        'Schreibprozess',
        'Wo erhalten die Lernenden Gelegenheit, ihren Text zu planen, Rückmeldung zu nutzen oder ihn zu überarbeiten?',
        P.hoch));
    } else if (!d.kriterien.length) {
      add(impuls('writing-criteria-missing', 'writing-process', 'Produktion',
        'Erfolgskriterien',
        'Woran erkennen die Lernenden vor dem Schreiben, was ein gelungenes Produkt ausmacht?',
        P.mittel, { target: 'criteria' }));
    }
  }

  /* --- Mediation --- */
  if (mediation) {
    if (!d.aufgabe.audience) {
      add(impuls('mediation-audience', 'mediation-selection', 'Mediation',
        'Adressatenbezug',
        'Welche Informationen braucht der konkrete Adressat tatsächlich – und was kann weggelassen werden?',
        P.hoch, { target: 'didaktik' }));
    } else if (enthaelt(d.allesText, W.uebersetzen)) {
      add(impuls('mediation-selection', 'mediation-selection', 'Mediation',
        'Auswahl statt Übertragung',
        'Welche Informationen müssen ausgewählt, erklärt oder angepasst werden, statt alles vollständig zu übertragen?',
        P.hoch));
    }
  }

  /* --- Grammatik --- */
  if (d.hat(K.grammatik) || d.mittel.grammar) {
    const gelenkt = enthaelt(d.allesText, W.gelenkteUebung);
    const anwendung = enthaelt(d.allesText, W.anwendung) || Boolean(d.aufgabe.text);
    if (!anwendung) {
      add(impuls('grammar-transfer', 'grammar-transfer', 'Sprachliche Mittel',
        'Anwendung',
        'Wofür brauchen die Lernenden diese Struktur anschließend beim eigenen Sprachhandeln?',
        P.hoch));
    } else if (gelenkt && !enthaelt(d.allesText, W.anwendung)) {
      add(impuls('grammar-progression', 'grammar-transfer', 'Sprachliche Mittel',
        'Vom Üben zum Handeln',
        'Wo führt die gelenkte Übung in eine zunehmend selbstständige sprachliche Anwendung?',
        P.mittel));
    }
  }

  /* --- Wortschatz --- */
  if (d.hat(K.wortschatz) || d.mittel.vocabulary) {
    if (enthaelt(d.allesText, W.wortliste)) {
      add(impuls('vocabulary-context', 'vocabulary-production', 'Sprachliche Mittel',
        'Wortschatz im Kontext',
        'In welchem Kontext begegnet und verwendet die Lerngruppe den neuen Wortschatz?',
        P.mittel));
    } else if (!enthaelt(d.allesText, W.anwendung) && !d.aufgabe.text) {
      add(impuls('vocabulary-production', 'vocabulary-production', 'Sprachliche Mittel',
        'Produktive Nutzung',
        'Wo verwenden die Lernenden die neue Lexik anschließend selbst produktiv?',
        P.mittel));
    }
  }

  /* --- Aussprache --- */
  if (d.hat(K.aussprache) || d.mittel.pronunciation) {
    add(impuls('pronunciation', 'pronunciation', 'Sprachliche Mittel',
      'Aussprache',
      'Wo können die Lernenden die relevante Aussprache zunächst wahrnehmen und anschließend selbst erproben?',
      P.mittel));
  }

  /* --- Scaffolding --- */
  if (d.scaffolds.length) {
    const stufen = new Set(d.scaffolds.map(s => txt(s.supportLevel)).filter(Boolean));
    const abbau = d.scaffolds.some(s => s.fadeOut);
    if (d.scaffolds.length >= 2 && !abbau) {
      add(impuls('scaffolding-fadeout', 'scaffolding', 'Unterstützung',
        'Rücknahme',
        'Welche Unterstützung könnte im Verlauf optional werden oder bewusst zurückgenommen werden?',
        P.hoch));
    } else if (stufen.size === 1 && stufen.has('high')) {
      add(impuls('scaffolding-autonomy', 'scaffolding', 'Unterstützung',
        'Selbstständigkeit',
        'Wo können Lernende zunehmend selbstständiger ohne diese Hilfe handeln?',
        P.hoch));
    }
  }

  /* --- Phasen und Progression --- */
  if (d.phasen.length) {
    if (produktivInteraktiv) {
      const hatAnwendung = d.phasenText.some(p =>
        istPhase(p.titel, ['anwend', 'transfer', 'produktion', 'gespräch', 'rollenspiel'])
        || enthaelt(p.alles, W.anwendung));
      if (!hatAnwendung) {
        add(impuls('application-phase', 'progression', 'Verlauf',
          'Anwendung',
          'Wo wenden die Lernenden das Erarbeitete möglichst selbstständig an?',
          P.mittel));
      }
    }

    const einstieg = d.phasenText.find(p => istPhase(p.titel, ['einstieg', 'hinführung', 'warm']));
    if (einstieg) {
      const dauer = Number(einstieg.phase.duration) || 0;
      const anteil = d.gesamtdauer > 0 ? dauer / d.gesamtdauer : 0;
      /* Beides muss zutreffen. Allein nach Minuten gefragt, meldete sich
         ein zwölfminütiger Einstieg in einer Doppelstunde – dort sind das
         13 Prozent und völlig unauffällig. */
      if (dauer > 10 && anteil > 0.25) {
        add(impuls('long-opening', 'progression', 'Verlauf',
          'Einstieg',
          'Führt der Einstieg möglichst direkt zum Lernziel bzw. zur Zielhandlung?',
          P.mittel, { phaseId: einstieg.id }));
      }
    }

    const sicherung = d.phasenText.find(p => istPhase(p.titel, ['sicher', 'ergebnis', 'auswert']));
    if (sicherung) {
      const dauer = Number(sicherung.phase.duration) || 0;
      const anteil = d.gesamtdauer > 0 ? dauer / d.gesamtdauer : 0;
      if (anteil > 0.3) {
        add(impuls('long-consolidation', 'progression', 'Verlauf',
          'Sicherung',
          'Was muss an dieser Stelle tatsächlich für alle gesichert werden – und was könnten die Lernenden selbst überprüfen?',
          P.mittel, { phaseId: sicherung.id }));
      }
    }

    /* --- Aktivierung --- */
    const plenumDauer = d.phasenText
      .filter(p => enthaelt(p.alles, W.plenum))
      .reduce((a, p)=> a + (Number(p.phase.duration) || 0), 0);
    if (d.gesamtdauer > 0 && plenumDauer / d.gesamtdauer > 0.5) {
      add(impuls('activation', 'activation', 'Verlauf',
        'Aktivierung',
        'Können an einer Stelle mehr Lernende gleichzeitig sprachlich oder kognitiv aktiv sein?',
        P.mittel));
    }
  }

  /* --- Medien: nur mit niedriger Priorität --- */
  const folien = d.phasenText.find(p => enthaelt(p.medien, W.praesentationsmedien));
  if (folien) {
    add(impuls('media-visibility', 'media', 'Medien',
      'Sichtbarkeit',
      'Bleiben Arbeitsauftrag und relevante Informationen so lange sichtbar, wie die Lernenden sie benötigen?',
      P.niedrig, { phaseId: folien.id }));
  } else {
    const mitMedien = d.phasenText.filter(p => p.medien.length > 2);
    if (mitMedien.length >= 2) {
      add(impuls('media-function', 'media', 'Medien',
        'Funktion des Mediums',
        'Welche konkrete didaktische Funktion erfüllt das Medium an dieser Stelle?',
        P.niedrig, { phaseId: mitMedien[0].id }));
    }
  }

  return out;
}

/* ---- Allgemeine Reflexionsimpulse -------------------------------------
   Nur zum Auffüllen, wenn wenige konkrete Regeln greifen. Sie rotieren
   über den Seed, damit nicht jede Stunde dieselbe Frage zeigt – aber
   innerhalb einer Stunde stabil bleiben. */
const ALLGEMEIN = [
  { id: 'gen-goal', kategorie: 'Zielorientierung', titel: 'Lernzuwachs',
    text: 'Was können die Lernenden nach dieser Stunde besser als vorher?' },
  { id: 'gen-who', kategorie: 'Sprachhandeln', titel: 'Handelnde',
    text: 'Wer handelt sprachlich mit wem – und warum?' },
  { id: 'gen-less', kategorie: 'Aktivierung', titel: 'Anteile',
    text: 'Wo könnte die Lehrkraft weniger tun, damit die Lernenden mehr tun?' },
  { id: 'gen-result', kategorie: 'Verlauf', titel: 'Weiterverwendung',
    text: 'Was wird mit dem Ergebnis einer Arbeitsphase anschließend gemacht?' },
  { id: 'gen-rise', kategorie: 'Verlauf', titel: 'Anspruch',
    text: 'Wo steigt der Anspruch im Verlauf der Stunde?' },
  { id: 'gen-visible', kategorie: 'Zielorientierung', titel: 'Sichtbarkeit',
    text: 'Wird das Lernziel durch eine sprachliche Handlung sichtbar – oder überwiegend durch das Bearbeiten eines Materials?' },
];

/* ============================================================
   Öffentliche Schnittstelle
   ============================================================ */

export function erstelleDidaktikCheck(lesson, { seed = '' } = {}){
  const d = lies(lesson);

  const staerken = sammleStaerken(d).slice(0, MAX_STAERKEN);

  // Je Prinzip nur ein Impuls, das mit der höchsten Priorität.
  const proPrinzip = new Map();
  for (const i of sammleImpulse(d)) {
    const bisher = proPrinzip.get(i.principle);
    if (!bisher || i.priority > bisher.priority) proPrinzip.set(i.principle, i);
  }
  const impulse = [...proPrinzip.values()]
    .sort((a, b)=> b.priority - a.priority || a.id.localeCompare(b.id));

  /* Auffüllen, aber nur wenn wenig Konkretes zusammenkam. Ein Check aus
     lauter allgemeinen Fragen hilft niemandem; zwei zum Abschluss schon. */
  if (impulse.length < 4) {
    const start = hash(seed);
    const platz = Math.min(2, 4 - impulse.length);
    for (let k = 0; k < platz; k++) {
      const a = ALLGEMEIN[(start + k) % ALLGEMEIN.length];
      impulse.push(impuls(a.id, `general-${a.id}`, a.kategorie, a.titel, a.text, P.allgemein));
    }
  }

  return { strengths: staerken, prompts: impulse.slice(0, MAX_IMPULSE) };
}

/* ---- Zusatzimpuls für die vorhandene Hilfekarte ------------------------
   Höchstens einer, passend zum Phasennamen und zum Vorhaben der Stunde.
   Er ergänzt die allgemeinen Leitfragen, ersetzt sie nicht. */
export function phasenDidaktikImpuls(lesson, phase, phaseIndex, { seed = '' } = {}){
  const d = lies(lesson);
  const titel = txt(phase?.title);
  if (!titel) return null;

  const mundlich = d.hatEines([K.muendlicheInteraktion, K.sprechen, K.onlineInteraktion]);

  if (istPhase(titel, ['einstieg', 'hinführung', 'warm'])) {
    return 'Wie führt dieser Impuls zur späteren sprachlichen Zielhandlung?';
  }
  if (istPhase(titel, ['erarbeit'])) {
    if (d.hat(K.grammatik) || d.mittel.grammar) {
      return 'Wofür benötigen die Lernenden die Struktur anschließend beim eigenen Sprachhandeln?';
    }
    if (d.hatEines([K.hoeren, K.hoersehen, K.lesen])) {
      return 'Welche Verstehensebene ist hier gefragt – und woran erkennen die Lernenden, dass sie genug verstanden haben?';
    }
    return 'Was erschließen die Lernenden hier selbst – und was gibst du vor?';
  }
  if (istPhase(titel, ['präsentation', 'vorstellen', 'vortrag'])) {
    return 'Was tun die Zuhörenden während der Präsentation?';
  }
  if (istPhase(titel, ['anwend', 'transfer', 'produktion'])) {
    return mundlich
      ? 'Wer spricht mit wem – und mit welchem kommunikativen Ziel?'
      : 'Wie selbstständig handeln die Lernenden hier sprachlich?';
  }
  if (istPhase(titel, ['sicher', 'ergebnis', 'auswert'])) {
    return 'Muss wirklich alles noch einmal ins Plenum – oder können die Lernenden Teile selbst überprüfen?';
  }
  if (istPhase(titel, ['reflexion', 'abschluss', 'rückblick'])) {
    return 'Was können die Lernenden jetzt sprachlich besser als zu Beginn?';
  }
  if (istPhase(titel, ['übung', 'üben', 'festig'])) {
    return 'Wo führt das Üben in eine eigene sprachliche Äußerung?';
  }
  return null;
}
