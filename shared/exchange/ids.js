/* ============================================================
   Stabile Kennungen für Lerngruppen und Fächer

   AUSGANGSLAGE, die alles bestimmt: Prép-ybara Desktop speichert
   Lerngruppe und Fach seit jeher als Etiketten – "9b" und "Französisch"
   in lesson.classGroup und lesson.subject. Es gibt dort keine
   Datensätze mit eigener id, die man exportieren könnte.

   Der naheliegende Weg wäre gewesen, im Desktop nun Klassen- und
   Fachobjekte mit id einzuführen. Genau das ist der Umbau, der hier
   nicht stattfinden soll: er fasste jede gespeicherte Stunde an.

   Stattdessen wird die Kennung ABGELEITET – aus dem Etikett, mit einer
   festen Rechenvorschrift. Dieselbe Rechnung auf beiden Seiten ergibt
   dieselbe Kennung, ohne dass irgendwo etwas zusätzlich gespeichert
   werden müsste:

       "9b"          -> class_1i2wq8
       "Französisch" -> subject_x9k4m1

   Daraus folgen drei Eigenschaften, die für den Austausch genügen:

   1. Stabil: Solange die Lehrkraft ihre Lerngruppe gleich benennt,
      bleibt die Kennung über Exporte, Neuinstallationen und Backups
      hinweg dieselbe.
   2. Verträglich: Die Kennung ist unabhängig von der Reihenfolge, in der
      Lerngruppen angelegt wurden – anders als eine laufende Nummer.
   3. Ehrlich: Wird eine Lerngruppe umbenannt, ändert sich die Kennung.
      Deshalb reist der Name IMMER mit, und der Import fällt auf den
      Namen zurück, wenn die Kennung nichts trifft. Zuordnung ist eine
      Hilfe, keine Bedingung.

   Die Normalisierung (NFC, klein, Leerraum zusammengezogen) sorgt
   dafür, dass "9B", "9b" und " 9b " dieselbe Kennung ergeben – und dass
   "Französisch" auf jeder Plattform gleich gerechnet wird, unabhängig
   davon, ob das ç als ein Zeichen oder als c + Cedille gespeichert ist.
   ============================================================ */

/* FNV-1a, 32 Bit. Klein, schnell, ohne Abhängigkeit – und ausreichend:
   verglichen werden Handvoll-Mengen von Etiketten, nicht Millionen. */
function fnv1a(text){
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    // h * 16777619 in 32-Bit-Arithmetik, ohne Genauigkeitsverlust
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function normalisiereEtikett(label){
  let s = String(label ?? '').trim();
  try { s = s.normalize('NFC'); } catch {}
  return s.replace(/\s+/g, ' ');
}

/* Der Schlüssel, über den gerechnet und verglichen wird. Nur hier wird
   klein geschrieben – die Anzeige behält immer die Schreibweise der
   Lehrkraft. */
export function vergleichsSchluessel(label){
  return normalisiereEtikett(label).toLowerCase();
}

export function stableId(prefix, label){
  const key = vergleichsSchluessel(label);
  if (!key) return '';
  return `${prefix}_${fnv1a(key).toString(36)}`;
}

export function classIdFor(className){
  return stableId('class', className);
}

export function subjectIdFor(subjectName){
  return stableId('subject', subjectName);
}

/* Eine Lerngruppe im Sinne der App ist das Paar aus Klasse und Fach –
   "9b Französisch". Der Desktop führt beides getrennt und schlüsselt
   z. B. die Gruppenfarbe über "9b|Französisch". Genau dieses Paar
   bekommt hier eine eigene Kennung. */
export function groupIdFor(className, subjectName){
  const a = vergleichsSchluessel(className);
  const b = vergleichsSchluessel(subjectName);
  if (!a && !b) return '';
  return `group_${fnv1a(`${a}|${b}`).toString(36)}`;
}

export function groupLabel(className, subjectName){
  return [normalisiereEtikett(className), normalisiereEtikett(subjectName)]
    .filter(Boolean)
    .join(' ');
}

/* Die Kennung eines Pocket-Entwurfs. Sie entsteht EINMAL beim Anlegen
   und begleitet den Entwurf danach unverändert – auch über mehrere
   Exporte hinweg. Nur so kann der Desktop erkennen, dass er dieselbe
   Planung schon einmal gesehen hat. */
export function neueExternalId(){
  const zeit = Date.now().toString(36);
  const zufall = Math.random().toString(36).slice(2, 10);
  return `pocket_${zeit}_${zufall}`;
}

/* Interne Kennungen (Entwürfe, Phasen, Ideen) – bewusst getrennt von
   der externalId, damit man beim Lesen sieht, worum es geht. */
export function neueId(prefix = 'id'){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
