/* ============================================================
   Übernahme aus Capy-scope

   Wer bisher mit Capy-scope beobachtet hat, soll Klassenlisten,
   Fragen und Beobachtungen mitnehmen können, ohne etwas abzutippen.
   Capy-scope legt alles in einer JSON-Datei ab („Daten als JSON
   exportieren"). Dieses Modul liest diese Datei und übersetzt sie in
   die Form von beobachtung.js – mehr nicht. Wo das Ergebnis landet,
   entscheidet der Speicher.

   Der Ablauf hat drei Schritte, damit vor dem Schreiben alles
   sichtbar ist:

     1. leseCapyText()          Ist das überhaupt ein Capy-Export?
     2. schlageLerngruppeVor()  Wohin gehört jede Capy-Klasse?
        capyVorschau()          Was würde dabei neu, was ist schon da?
     3. capyUebernehmen()       Erst jetzt wird zusammengeführt.

   Die Vorschau rechnet dieselbe Übernahme wie Schritt 3 und wirft das
   Ergebnis danach weg. So können die Zahlen der Vorschau und die des
   Berichts nicht auseinanderlaufen.

   REGELN, die sich durch die Übernahme ziehen:

   - Eine Capy-Klasse ist keine Lerngruppe. Capy-scope kennt Klassen
     mit eigener Kennung und frei gewähltem Namen („6a Französisch"),
     die App kennt Lerngruppen aus Klasse und Fach. Die Zuordnung
     trifft die Lehrperson, das Modul schlägt nur vor. Eine Klasse ohne
     Ziel wird übersprungen, samt ihren Beobachtungen.
   - Es wird nichts überschrieben. Was schon da ist, bleibt, wie es
     ist; nur Neues kommt dazu.
   - Die Kennungen aus Capy-scope bleiben erhalten. Deshalb ändert ein
     zweiter Import derselben Datei nichts mehr: Jede Beobachtung wird
     an ihrer Kennung wiedererkannt.
   - Lernende werden zusammengelegt, wenn es in der Ziel-Lerngruppe
     schon jemanden mit demselben Namen gibt. Sonst stünde Mia nach dem
     Import zweimal in der Liste – einmal mit und einmal ohne
     Beobachtungen.
   - Die mitgelieferten Fragen von Capy-scope sind wortgleich die
     Standardfragen hier. Sie werden auf diese abgebildet, statt ein
     zweites Mal zu erscheinen.
   - Ein Wert ausserhalb der Skala ist keine Beobachtung. Er wird
     übersprungen und im Bericht gezählt, nicht still verworfen.
     Ebenso eine Beobachtung, der Lernende, Frage oder jede Zeitangabe
     fehlt – aber getrennt gezählt, damit der Bericht den richtigen
     Grund nennt.

   Rein wie beobachtung.js: kein DOM, keine Ablage, und die Eingaben
   bleiben unberührt.
   ============================================================ */

import {
  STANDARD_FRAGEN, vergleichsText, neueKennung, istSkalenwert,
  lerngruppenSchluessel, zerlegeLerngruppenSchluessel, normalisiereLerngruppenSchluessel,
  normalisiereBeobachtungsdaten, normalisiereFrage, normalisiereBeobachtung,
} from './beobachtung.js';
/* Das Format der eigenen Beobachtungs-Sicherung. Hier nur, um eine
   verwechselte Datei mit einem passenden Hinweis abzuweisen – gelesen
   wird sie in beobachtung-sicherung.js. */
import { SICHERUNG_FORMAT } from './beobachtung-sicherung.js';

/* ---- Kleine Helfer ---------------------------------------------------
   Dieselbe Strenge wie in beobachtung.js: Nur Text und Zahlen gelten,
   aus einem Objekt wird kein Name "[object Object]". */
function text(x){
  if (typeof x === 'string') return x.trim();
  if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return '';
}
function einzeilig(x){ return text(x).replace(/\s+/g, ' '); }
const objekt = (v)=> (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const liste = (v)=> (Array.isArray(v) ? v : []);
const istObjekt = (v)=> Boolean(v && typeof v === 'object' && !Array.isArray(v));
const paar = (a, b)=> `${a}\u0000${b}`;

/* Wie normalisiereBeobachtung() einen Wert liest: eine Zahl oder
   Ziffern als Text. Gebraucht nur, um den Grund einer Ablehnung zu
   nennen. */
function zahlAus(v){
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) return Number(v);
  return NaN;
}

function eindeutig(eintraege){
  const gesehen = new Set();
  return eintraege.filter((e)=>{
    if (!e || gesehen.has(e.id)) return false;
    gesehen.add(e.id);
    return true;
  });
}

/* ---- Erkennen und Lesen ----------------------------------------------
   Capy-scope schreibt seinen ganzen Zustand, wie ensureStateShape() ihn
   formt: version, settings, classes, questions, observations. Die drei
   Listen sind das Erkennungszeichen; settings braucht die Übernahme
   nicht (die Skala ist hier fest, die Rundengrösse bleibt die eigene). */

export function istCapyExport(json){
  return istObjekt(json)
    && Array.isArray(json.classes)
    && Array.isArray(json.questions)
    && Array.isArray(json.observations);
}

/* Beliebige Eingabe, gültige Capy-Form. Was keine Kennung hat, bekommt
   eine, die sich aus der Datei selbst ergibt – nicht aus Zeit oder
   Zufall. Nur so erkennt ein zweiter Import dieselbe Datei wieder.
   Eine Beobachtung ohne Kennung heisst deshalb nach ihrem Inhalt; zwei
   inhaltsgleiche fallen dabei zusammen, und das ist richtig so. */
export function normalisiereCapy(raw){
  const o = objekt(raw);

  const classes = eindeutig(liste(o.classes).filter(istObjekt).map((k, i)=>{
    const id = text(k.id) || `capy-klasse-${i + 1}`;
    return {
      id,
      name: einzeilig(k.name),
      subject: einzeilig(k.subject),
      students: eindeutig(liste(k.students).filter(istObjekt).map((s, j)=> ({
        id: text(s.id) || `${id}-lernende-${j + 1}`,
        name: einzeilig(s.name),
      })).filter(s => s.name)),
    };
  }));

  const questions = eindeutig(liste(o.questions).filter(istObjekt).map((q, i)=> ({
    id: text(q.id) || `capy-frage-${i + 1}`,
    text: text(q.text),
    category: text(q.category),
    subjectArea: text(q.subjectArea),
    active: q.active !== false,
    builtIn: q.builtIn === true,
    createdAt: text(q.createdAt),
  })).filter(q => q.text));

  const observations = eindeutig(liste(o.observations).filter(istObjekt).map((b)=>{
    const classId = text(b.classId);
    const studentId = text(b.studentId);
    const questionId = text(b.questionId);
    const date = text(b.date);
    const timestamp = text(b.timestamp);
    return {
      id: text(b.id) || ['capy', classId, studentId, questionId, timestamp || date].join('-'),
      sessionId: text(b.sessionId),
      classId,
      studentId,
      questionId,
      // Roh belassen: Ob der Wert gilt, entscheidet erst die Übernahme – und zählt mit.
      score: (typeof b.score === 'number' || typeof b.score === 'string') ? b.score : null,
      note: text(b.note),
      date,
      timestamp,
    };
  }));

  return { version: Number(o.version) || 1, classes, questions, observations };
}

/* Der Text aus der gewählten Datei. Ein Byte-Order-Mark am Anfang
   (Windows-Editoren setzen es gern) stört JSON.parse und wird
   entfernt. Die Fehlertexte sind für die Meldung in der Oberfläche
   gedacht und sagen, was stattdessen zu tun ist. */
export function leseCapyText(eingabe){
  const roh = typeof eingabe === 'string' ? eingabe.replace(/^﻿/, '').trim() : '';
  if (!roh) return { ok: false, fehler: 'Die Datei ist leer.' };
  let json;
  try {
    json = JSON.parse(roh);
  } catch {
    return { ok: false, fehler: 'Die Datei lässt sich nicht lesen: Sie ist keine gültige JSON-Datei.' };
  }
  if (istObjekt(json) && json.format === SICHERUNG_FORMAT) {
    return {
      ok: false,
      fehler: 'Das ist eine Beobachtungs-Sicherung aus Prép-ybara, kein Export aus Capy-scope. Sie wird über „Sicherung einlesen" geöffnet.',
    };
  }
  if (!istCapyExport(json)) {
    return {
      ok: false,
      fehler: 'Das ist kein Export aus Capy-scope. Gebraucht wird die Datei, die Capy-scope mit „Daten als JSON exportieren" speichert.',
    };
  }
  return { ok: true, capy: normalisiereCapy(json) };
}

/* ---- Vorschlag für die Zuordnung -------------------------------------
   Capy-scope hat für das Fach ein eigenes Feld, aber viele tragen es
   gleich in den Namen ein: „6a Französisch", „7b Mathe", „Französisch
   6a". Verglichen wird deshalb Wort für Wort, ohne Gross-/Klein-
   schreibung und ohne Trennzeichen, und Capy-Name und -Fach zählen
   zusammen.

   Vorgeschlagen wird in dieser Reihenfolge:

     1. Klasse und Fach bestehen aus genau denselben Wörtern
        („6a" + „Französisch", „6a Französisch", „Französisch 6a").
     2. Die Klasse steht vollständig im Capy-Namen, und was übrig
        bleibt, ist der Anfang des Fachs („7b Mathe" → Mathematik,
        mindestens drei Zeichen).
     3. Capy-scope nennt nur die Klasse, und die Planung kennt sie in
        genau EINEM Fach.
     4. Capy-scope nennt ein Fach, die Planung kennt die Klasse genau
        einmal, und zwar ohne Fach – in keinem Fach daneben.

   Ist ein Schritt mehrdeutig – „6a" ohne Fach, die Planung hat 6a in
   Französisch UND Deutsch –, gibt es keinen Vorschlag. Ein falscher
   Vorschlag, der übersehen wird, legte Beobachtungen in die falsche
   Lerngruppe; eine leere Auswahl fällt dagegen auf. */

function woerter(x){
  return vergleichsText(x)
    .replace(/[·•|/\\,;:()[\]{}_–—-]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

const wortSchluessel = (w)=> [...new Set(w)].sort().join(' ');

function kandidatenAus(lerngruppen){
  const gesehen = new Set();
  const out = [];
  for (const lg of liste(lerngruppen)) {
    const schluessel = normalisiereLerngruppenSchluessel(typeof lg === 'string' ? lg : objekt(lg).schluessel);
    if (!schluessel || gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    const { klasse, fach } = zerlegeLerngruppenSchluessel(schluessel);
    out.push({ schluessel, klasseW: woerter(klasse), fachW: woerter(fach) });
  }
  return out;
}

export function schlageLerngruppeVor(capyKlasse, lerngruppen = []){
  const k = objekt(capyKlasse);
  const nameW = woerter(k.name);
  if (!nameW.length) return '';
  const capyW = [...nameW, ...woerter(k.subject)];
  const capyMenge = new Set(capyW);
  const kandidaten = kandidatenAus(lerngruppen);

  const exakt = kandidaten.find(c => wortSchluessel([...c.klasseW, ...c.fachW]) === wortSchluessel(capyW));
  if (exakt) return exakt.schluessel;

  const fachAnfang = [];
  const nurKlasse = [];
  const planungOhneFach = [];
  for (const c of kandidaten) {
    if (!c.klasseW.length || !c.klasseW.every(w => capyMenge.has(w))) continue;
    const rest = [...new Set(capyW.filter(w => !c.klasseW.includes(w)))];
    if (!rest.length) { nurKlasse.push(c); continue; }
    if (!c.fachW.length) { planungOhneFach.push(c); continue; }
    const restText = rest.join(' ');
    if (restText.length >= 3 && c.fachW.join(' ').startsWith(restText)) fachAnfang.push(c);
  }

  const eindeutigerTreffer = (treffer)=> (treffer.length === 1 ? treffer[0].schluessel : '');
  if (fachAnfang.length) return eindeutigerTreffer(fachAnfang);
  if (nurKlasse.length) return eindeutigerTreffer(nurKlasse);

  /* Regel 4 verlangt, dass die Planung die Klasse NUR ohne Fach kennt.
     Steht 6a dort auch mit Deutsch und Mathematik, ist die fachlose 6a
     eher Klassenleitung oder Vertretung – „6a Französisch" gehört dann
     nicht ungefragt dorthin. */
  if (planungOhneFach.length !== 1) return '';
  const [einzige] = planungOhneFach;
  const klasse = wortSchluessel(einzige.klasseW);
  return kandidaten.some(c => c !== einzige && wortSchluessel(c.klasseW) === klasse) ? '' : einzige.schluessel;
}

/* Die Startbelegung der Auswahl in der Vorschau: je Capy-Klasse der
   Vorschlag, sonst ''. */
export function vorschlagsZuordnung(capy, lerngruppen = []){
  const zuordnung = {};
  for (const klasse of normalisiereCapy(capy).classes) {
    zuordnung[klasse.id] = schlageLerngruppeVor(klasse, lerngruppen);
  }
  return zuordnung;
}

/* Die Lerngruppe, die Capy-scope selbst nahelegt – für den Fall, dass
   die Planung keine passende kennt und die Klasse trotzdem übernommen
   werden soll. Steht das Fach nur im Namen, wird der ganze Name zur
   Klasse; aufgeteilt wird hier bewusst nichts. */
export function capyLerngruppe(capyKlasse){
  const k = objekt(capyKlasse);
  return lerngruppenSchluessel(einzeilig(k.name), einzeilig(k.subject));
}

/* ---- Die Übernahme ---------------------------------------------------
   Eine einzige Rechnung für Vorschau und Übernahme. Sie bekommt eine
   bereits normalisierte Capy-Form und eine bereinigte Zuordnung.

   Wiedererkennen der Lernenden, je Capy-Klasse und Ziel-Lerngruppe:
     1. über die Kennung – sie stammt aus einem früheren Import;
     2. über eine früher übernommene Beobachtung dieser Capy-Lernenden:
        Deren lernendeId sagt, mit wem sie damals zusammengelegt wurde.
        Das trägt auch dann noch, wenn die Lernende inzwischen
        umbenannt wurde („Mia S." → „Mia").
     3. über den gleichen Namen – je vorhandener Lernender höchstens
        einmal je Capy-Klasse, damit zwei verschiedene „Mia" einer Klasse
        nicht zu einer werden.
   Wer so nicht gefunden wird, kommt mit der Capy-Kennung dazu.

   Wiedererkennen der Fragen:
     1. eine mitgelieferte Capy-Frage über den Text einer Standardfrage;
     2. über die Kennung;
     3. über eine früher übernommene Beobachtung (wie oben);
     4. über den gleichen Text einer Frage, die für alle Lerngruppen
        gilt. Capy-scope kennt nur einen gemeinsamen Pool – eine Frage
        „nur für 6a" wäre für die Beobachtungen der anderen Klassen das
        falsche Ziel.
   Übernommen werden alle Fragen des Exports, auch solche ohne
   Beobachtung: Der Fragenpool ist ein Teil dessen, was man mitnehmen
   will. Neue Fragen gelten für alle Lerngruppen. Als Standardfrage
   zählt eine neue Frage nur, wenn sie in Capy-scope mitgeliefert UND
   im Wortlaut unverändert ist – eine umformulierte Frage ist eine
   eigene. */

function bereinigeZuordnung(zuordnung){
  const out = {};
  for (const [id, schluessel] of Object.entries(objekt(zuordnung))) {
    const k = typeof schluessel === 'string' ? normalisiereLerngruppenSchluessel(schluessel) : '';
    if (k) out[text(id)] = k;
  }
  return out;
}

function leererBericht(){
  return {
    klassen: 0,
    lernende: 0,
    lernendeVorhanden: 0,
    fragen: 0,
    fragenVorhanden: 0,
    beobachtungen: 0,
    schonVorhanden: 0,
    ohneZiel: 0,
    ungueltig: 0,
    unvollstaendig: 0,
  };
}

function rechneUebernahme(daten, capy, zuordnung, neueId){
  const basis = normalisiereBeobachtungsdaten(daten, { neueId });
  const bericht = leererBericht();
  const jeKlasse = new Map();
  const vorher = new Map(basis.beobachtungen.map(b => [b.id, b]));

  /* Lernende ------------------------------------------------------------ */
  const lernende = { ...basis.lernende };
  const lernendeAbbildung = new Map();   // paar(Capy-Klasse, Capy-Lernende) → lernendeId

  for (const klasse of capy.classes) {
    const zahlen = { lernendeNeu: 0, lernendeVorhanden: 0, beobachtungenNeu: 0 };
    jeKlasse.set(klasse.id, zahlen);
    const k = zuordnung[klasse.id] || '';
    if (!k) continue;
    bericht.klassen += 1;

    const ziel = [...(lernende[k] || [])];
    const zielIds = new Set(ziel.map(l => l.id));
    const vergeben = new Set();
    const zuordnen = (s, id)=>{
      lernendeAbbildung.set(paar(klasse.id, s.id), id);
      vergeben.add(id);
      zahlen.lernendeVorhanden += 1;
      bericht.lernendeVorhanden += 1;
    };

    const frueher = new Map();
    for (const o of capy.observations) {
      if (o.classId !== klasse.id || frueher.has(o.studentId)) continue;
      const alt = vorher.get(o.id);
      if (alt && alt.lerngruppe === k && zielIds.has(alt.lernendeId)) frueher.set(o.studentId, alt.lernendeId);
    }

    const offen = [];
    for (const s of klasse.students) {
      if (zielIds.has(s.id)) zuordnen(s, s.id);
      else offen.push(s);
    }
    const ohneTreffer = [];
    for (const s of offen) {
      const id = frueher.get(s.id);
      if (id && !vergeben.has(id)) zuordnen(s, id);
      else ohneTreffer.push(s);
    }
    for (const s of ohneTreffer) {
      const v = vergleichsText(s.name);
      const treffer = ziel.find(l => !vergeben.has(l.id) && vergleichsText(l.name) === v);
      if (treffer) {
        zuordnen(s, treffer.id);
        continue;
      }
      const id = zielIds.has(s.id) ? neueKennung(neueId, 'l') : s.id;
      ziel.push({ id, name: s.name, aktiv: true });
      zielIds.add(id);
      vergeben.add(id);
      lernendeAbbildung.set(paar(klasse.id, s.id), id);
      zahlen.lernendeNeu += 1;
      bericht.lernende += 1;
    }
    if (ziel.length) lernende[k] = ziel;
  }

  /* Fragen -------------------------------------------------------------- */
  const fragen = [...basis.fragen];
  const fragenIds = new Set(fragen.map(f => f.id));
  const fragenAbbildung = new Map();
  const standardTexte = new Set(STANDARD_FRAGEN.map(f => vergleichsText(f.text)));

  const fruehereFrage = new Map();
  for (const o of capy.observations) {
    const alt = vorher.get(o.id);
    if (alt && fragenIds.has(alt.frageId) && !fruehereFrage.has(o.questionId)) fruehereFrage.set(o.questionId, alt.frageId);
  }

  for (const q of capy.questions) {
    const v = vergleichsText(q.text);
    const zielId = (q.builtIn ? fragen.find(f => f.standard && vergleichsText(f.text) === v)?.id : '')
      || (fragenIds.has(q.id) ? q.id : '')
      || fruehereFrage.get(q.id)
      || fragen.find(f => f.geltung !== 'lerngruppe' && vergleichsText(f.text) === v)?.id;
    if (zielId) {
      fragenAbbildung.set(q.id, zielId);
      bericht.fragenVorhanden += 1;
      continue;
    }
    const frage = normalisiereFrage({
      id: q.id,
      text: q.text,
      kategorie: q.category,
      stichwort: q.subjectArea,
      geltung: 'allgemein',
      lerngruppe: '',
      kompetenz: '',
      aktiv: q.active,
      standard: q.builtIn && standardTexte.has(v),
      erstelltAm: q.createdAt,
    }, { neueId });
    fragen.push(frage);
    fragenIds.add(frage.id);
    fragenAbbildung.set(q.id, frage.id);
    bericht.fragen += 1;
  }

  /* Beobachtungen --------------------------------------------------------
     Eine Beobachtung, deren Capy-Lernende oder -Frage nicht (mehr) im
     Export steht, behält deren Kennung. Sie wird übernommen wie in
     beobachtung.js jede verwaiste Beobachtung: nicht still gelöscht. */
  const beobachtungen = [...basis.beobachtungen];
  const beobachtungsIds = new Set(vorher.keys());
  const klassenIds = new Set(capy.classes.map(c => c.id));

  for (const o of capy.observations) {
    const k = klassenIds.has(o.classId) ? (zuordnung[o.classId] || '') : '';
    if (!k) { bericht.ohneZiel += 1; continue; }
    if (beobachtungsIds.has(o.id)) { bericht.schonVorhanden += 1; continue; }
    const b = normalisiereBeobachtung({
      id: o.id,
      lerngruppe: k,
      lernendeId: lernendeAbbildung.get(paar(o.classId, o.studentId)) || o.studentId,
      frageId: fragenAbbildung.get(o.questionId) || o.questionId,
      wert: o.score,
      notiz: o.note,
      datum: o.date,
      zeitpunkt: o.timestamp,
      stundenRef: '',
      rundeId: o.sessionId,
    }, { neueId });
    if (!b) {
      /* Ein gültiger Wert, und trotzdem keine Beobachtung: Dann fehlt
         die Lernende, die Frage oder jede Zeitangabe. */
      if (istSkalenwert(zahlAus(o.score))) bericht.unvollstaendig += 1;
      else bericht.ungueltig += 1;
      continue;
    }
    beobachtungsIds.add(b.id);
    beobachtungen.push(b);
    bericht.beobachtungen += 1;
    jeKlasse.get(o.classId).beobachtungenNeu += 1;
  }

  return {
    daten: { ...basis, lernende, fragen, beobachtungen },
    bericht,
    jeKlasse,
  };
}

/* Was die Übernahme mit der gewählten Zuordnung täte. Die Zahlen je
   Klasse erlauben in der Auswahl Sätze wie „24 Lernende, davon 3 schon
   vorhanden". `fragen.vorhanden` zählt die Capy-Fragen, die auf eine
   bestehende Frage abgebildet werden – meist die acht Standardfragen. */
export function capyVorschau(capy, daten, { zuordnung } = {}){
  const c = normalisiereCapy(capy);
  const z = bereinigeZuordnung(zuordnung);
  const { bericht, jeKlasse } = rechneUebernahme(daten, c, z);
  const jeKlasseBeobachtungen = new Map();
  for (const o of c.observations) jeKlasseBeobachtungen.set(o.classId, (jeKlasseBeobachtungen.get(o.classId) || 0) + 1);
  return {
    klassen: c.classes.map((k)=>{
      const zahlen = jeKlasse.get(k.id);
      return {
        id: k.id,
        name: k.name,
        fach: k.subject,
        lernende: k.students.length,
        beobachtungen: jeKlasseBeobachtungen.get(k.id) || 0,
        ziel: z[k.id] || '',
        lernendeNeu: zahlen.lernendeNeu,
        lernendeVorhanden: zahlen.lernendeVorhanden,
        beobachtungenNeu: zahlen.beobachtungenNeu,
      };
    }),
    fragen: { neu: bericht.fragen, vorhanden: bericht.fragenVorhanden },
    beobachtungen: {
      neu: bericht.beobachtungen,
      schonVorhanden: bericht.schonVorhanden,
      ohneZiel: bericht.ohneZiel,
      ungueltig: bericht.ungueltig,
      unvollstaendig: bericht.unvollstaendig,
    },
  };
}

/* Die eigentliche Übernahme. `zuordnung` bildet Capy-Klassen-Kennungen
   auf Lerngruppen-Schlüssel ab; '' oder ein fehlender Eintrag heisst
   „nicht übernehmen". Der Bericht zählt, was NEU angelegt wurde
   (lernende, fragen, beobachtungen – wie bei zusammenfuehren()), dazu
   was wiedererkannt oder übersprungen wurde. */
export function capyUebernehmen(daten, capy, zuordnung = {}, { neueId } = {}){
  const { daten: ergebnis, bericht } = rechneUebernahme(daten, normalisiereCapy(capy), bereinigeZuordnung(zuordnung), neueId);
  return { daten: ergebnis, bericht };
}

/* ---- Bericht als Satz ------------------------------------------------
   Für die Meldung nach der Übernahme. Was übersprungen wurde, steht
   ausdrücklich da – wer 200 Beobachtungen erwartet und 180 bekommt,
   soll den Grund lesen können. */

function anzahl(n, eins, viele){
  return `${n} ${n === 1 ? eins : viele}`;
}

function aufzaehlung(teile){
  if (teile.length < 2) return teile.join('');
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

export function capyBerichtText(bericht){
  const b = objekt(bericht);
  const n = (feld)=> Math.max(0, Math.round(Number(b[feld])) || 0);
  const neu = [];
  if (n('beobachtungen')) neu.push(anzahl(n('beobachtungen'), 'Beobachtung', 'Beobachtungen'));
  if (n('lernende')) neu.push(anzahl(n('lernende'), 'Lernende', 'Lernende'));
  if (n('fragen')) neu.push(anzahl(n('fragen'), 'Frage', 'Fragen'));
  const saetze = [neu.length ? `Übernommen: ${aufzaehlung(neu)}.` : 'Nichts Neues übernommen.'];
  if (n('lernendeVorhanden')) saetze.push(`${anzahl(n('lernendeVorhanden'), 'Lernende stand', 'Lernende standen')} schon in der Liste.`);
  if (n('schonVorhanden')) saetze.push(`${anzahl(n('schonVorhanden'), 'Beobachtung war', 'Beobachtungen waren')} schon vorhanden.`);
  if (n('ohneZiel')) saetze.push(`${anzahl(n('ohneZiel'), 'Beobachtung', 'Beobachtungen')} ohne Lerngruppe übersprungen.`);
  if (n('ungueltig')) saetze.push(`${anzahl(n('ungueltig'), 'Beobachtung', 'Beobachtungen')} mit ungültigem Wert übersprungen.`);
  if (n('unvollstaendig')) saetze.push(`${anzahl(n('unvollstaendig'), 'Beobachtung', 'Beobachtungen')} ohne Lernende, Frage oder Datum übersprungen.`);
  return saetze.join(' ');
}
