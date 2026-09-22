/* ============================================================
   Alle Daten löschen – die App wieder auf null setzen

   Es gibt einen guten Grund für diesen Weg: Ein Gerät wird
   weitergegeben, eine Probephase ist zu Ende, ein verunglückter Import
   soll weg. Und es gibt einen ebenso guten Grund, ihn zu erschweren:
   Was hier verschwindet, ist die Unterrichtsplanung eines ganzen
   Jahres, und es gibt kein Rückgängig dafür – kein Strg+Z, keinen
   Versionsverlauf, denn der geht mit.

   Deshalb steht die Logik hier und nicht in der Oberfläche. Sie
   beantwortet drei Fragen, jede für sich prüfbar:

     1. WAS geht verloren? (`ruecksetzUmfang`) – gezählt aus den
        vorhandenen Daten, nicht behauptet. Wer liest, dass 214 Stunden
        und 9 Sequenzen betroffen sind, entscheidet anders als jemand,
        dem nur "alle Daten" gesagt wird.
     2. WIE sicher ist die Absicht? (`bestaetigungStimmt`) – ein Wort,
        das abgetippt werden muss. Nicht als Schikane, sondern weil ein
        zweiter Klick auf "Ja" kein zweiter Gedanke ist.
     3. DARF gelöscht werden? (`darfLoeschen`) – Kontrollkästchen UND
        Wort, beides zusammen. Eines allein genügt nicht.

   Was hier bewusst NICHT steht: das Löschen selbst. Das gehört in den
   Plattformadapter, weil es auf dem Desktop andere Ablagen sind als im
   Browser. Diese Datei ist rein.
   ============================================================ */

/* Das Wort, das abgetippt werden muss.

   Deutsch, weil die App deutsch ist, und mit Umlaut, weil "LOESCHEN"
   aussähe wie ein Tippfehler. Der Vergleich unten nimmt beides an. */
export const BESTAETIGUNGSWORT = 'ALLES LÖSCHEN';

/* Eingaben werden grosszügig gelesen, das Ergebnis aber nicht.

   Grosszügig heisst: Leerzeichen am Rand und doppelte Leerzeichen in
   der Mitte fallen weg, Gross- und Kleinschreibung ist egal, und ein
   „LOESCHEN" statt „LÖSCHEN" wird angenommen – auf einer fremden
   Tastatur ist der Umlaut nicht immer da.

   Nicht grosszügig heisst: Es muss dieses Wort sein. "ja", "ok" oder
   "löschen" allein reichen nicht. */
export function normalisiereBestaetigung(eingabe){
  return String(eingabe ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/Ö/g, 'OE')
    .replace(/Ä/g, 'AE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/gi, 'SS');
}

export function bestaetigungStimmt(eingabe){
  const soll = normalisiereBestaetigung(BESTAETIGUNGSWORT);
  return normalisiereBestaetigung(eingabe) === soll;
}

/* Die Freigabe. Beides muss zutreffen: das Kontrollkästchen („mir ist
   klar, dass …") und das abgetippte Wort. Das Kästchen allein ist zu
   schnell angeklickt, das Wort allein zu leicht aus einer Anleitung
   abgeschrieben. */
export function darfLoeschen({ eingabe = '', verstanden = false } = {}){
  return Boolean(verstanden) && bestaetigungStimmt(eingabe);
}

const zahl = (v)=> (Number.isFinite(v) ? v : 0);
const objekt = (v)=> (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const liste = (v)=> (Array.isArray(v) ? v : []);

/* Was beim Zurücksetzen verloren geht – gezählt, nicht geschätzt.

   Gezählt wird aus der laufenden Datenbank. Der Versionsverlauf liegt
   in einer eigenen Ablage und taucht hier deshalb nicht als Zahl auf;
   dass er mitgeht, sagt die Oberfläche in Worten.

   Archivierte Schuljahre sind ausdrücklich dabei: Sie liegen in
   derselben Datenbank und wären sonst die eine Sache, die jemand
   übersieht. */
export function ruecksetzUmfang(db){
  const d = objekt(db);
  const weeks = objekt(d.weeks);

  let stunden = 0;
  let mitThema = 0;
  const lerngruppen = new Set();
  for (const woche of Object.values(weeks)) {
    for (const l of Object.values(objekt(objekt(woche).lessons))) {
      if (!l || typeof l !== 'object') continue;
      stunden += 1;
      if (String(l.topic || '').trim()) mitThema += 1;
      const g = `${String(l.classGroup || '').trim()}|${String(l.subject || '').trim()}`;
      if (g !== '|') lerngruppen.add(g);
    }
  }

  const archive = liste(d.schoolYearArchives);
  let archivStunden = 0;
  for (const a of archive) {
    for (const woche of Object.values(objekt(objekt(objekt(a).data).weeks))) {
      archivStunden += Object.keys(objekt(objekt(woche).lessons)).length;
    }
  }

  const kalender = objekt(d.schoolCalendar);

  return {
    wochen: Object.keys(weeks).length,
    stunden,
    mitThema,
    lerngruppen: lerngruppen.size,
    sequenzen: Object.keys(objekt(d.sequences)).length,
    vorlagen: Object.keys(objekt(d.sequenceTemplates)).length,
    balken: liste(d.yearBars).length,
    todos: liste(d.todos).length,
    archive: archive.length,
    archivStunden,
    stundenplaene: liste(d.timetableModels).length,
    ferien: liste(kalender.vacations).length + liste(kalender.freeDays).length + liste(kalender.events).length,
  };
}

/* Gibt es überhaupt etwas zu löschen?

   Eine frisch eingerichtete App auf null zu setzen ist kein Vorgang,
   vor dem gewarnt werden müsste – die Oberfläche kann den Hinweis dann
   knapper halten. */
export function istLeer(umfang){
  const u = objekt(umfang);
  return zahl(u.stunden) === 0
    && zahl(u.sequenzen) === 0
    && zahl(u.vorlagen) === 0
    && zahl(u.balken) === 0
    && zahl(u.todos) === 0
    && zahl(u.archive) === 0
    && zahl(u.stundenplaene) === 0
    && zahl(u.ferien) === 0;
}

const mehrzahl = (n, eins, viele)=> `${n} ${n === 1 ? eins : viele}`;

/* Der Umfang als Liste in Worten – für den Dialog.

   Was es nicht gibt, wird nicht aufgezählt: Eine Zeile "0 Sequenzen"
   trägt nichts bei und macht die Liste länger, als sie sein muss. Die
   Reihenfolge folgt dem Gewicht, nicht dem Datenmodell: zuerst der
   Unterricht, zuletzt die Nebensachen. */
export function umfangZeilen(umfang){
  const u = objekt(umfang);
  const zeilen = [];
  const stunden = zahl(u.stunden);
  if (stunden) {
    const teile = [mehrzahl(stunden, 'geplante Stunde', 'geplante Stunden')];
    if (zahl(u.wochen)) teile.push(`in ${mehrzahl(zahl(u.wochen), 'Woche', 'Wochen')}`);
    if (zahl(u.lerngruppen)) teile.push(`aus ${mehrzahl(zahl(u.lerngruppen), 'Lerngruppe', 'Lerngruppen')}`);
    zeilen.push(teile.join(' '));
  }
  if (zahl(u.sequenzen)) zeilen.push(mehrzahl(zahl(u.sequenzen), 'Sequenz', 'Sequenzen'));
  if (zahl(u.vorlagen)) zeilen.push(mehrzahl(zahl(u.vorlagen), 'Sequenz-Vorlage', 'Sequenz-Vorlagen'));
  if (zahl(u.stundenplaene)) zeilen.push(mehrzahl(zahl(u.stundenplaene), 'Wochenvorlage der Unterrichtszeiten', 'Wochenvorlagen der Unterrichtszeiten'));
  if (zahl(u.balken)) zeilen.push(mehrzahl(zahl(u.balken), 'Balken der Jahresgrobplanung', 'Balken der Jahresgrobplanung'));
  if (zahl(u.todos)) zeilen.push(mehrzahl(zahl(u.todos), 'To-do', 'To-dos'));
  if (zahl(u.ferien)) zeilen.push(`${mehrzahl(zahl(u.ferien), 'Eintrag', 'Einträge')} im Schulkalender (Ferien, freie Tage, Termine)`);
  if (zahl(u.archive)) {
    const zusatz = zahl(u.archivStunden) ? ` mit ${mehrzahl(zahl(u.archivStunden), 'Stunde', 'Stunden')}` : '';
    zeilen.push(`${mehrzahl(zahl(u.archive), 'archiviertes Schuljahr', 'archivierte Schuljahre')}${zusatz}`);
  }
  return zeilen;
}

/* Was ausserdem verschwindet, ohne dass es sich zählen liesse: die
   Einstellungen und die Einführung (beide liegen in derselben
   Datenbank) und der Versionsverlauf (eigene Ablage, geht trotzdem
   mit – sonst bliebe die Geschichte einer gelöschten Planung übrig). */
export const WEITERE_BEREICHE = [
  'alle Einstellungen, Farben, Kompetenzen und Vorschlagslisten',
  'der Stand der Einführung',
  'der gesamte Versionsverlauf',
];

/* Und was ausdrücklich BLEIBT. Dieser Satz gehört in den Dialog: Er
   ist der Unterschied zwischen einem Schreck und einem Schaden. */
export const BLEIBT_ERHALTEN = [
  'Exportierte Backups, Vorlagen und PDF-/Word-Dateien – sie liegen als Dateien ausserhalb der App.',
  'Angehängte Dateien: Prép-ybara löscht keine einzige davon. Es verschwinden nur die Verweise – auch Kopien im Dateiordner der App bleiben stehen.',
  'Die jeweils andere Fassung (Desktop-App bzw. Browser-Version) – beide teilen ihre Daten nicht.',
];
