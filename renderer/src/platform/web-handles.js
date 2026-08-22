/* ============================================================
   Dateianhänge im Browser

   Ein Browser kennt keine Dateipfade. Was die File System Access API
   stattdessen liefert, ist ein Handle – ein Zeiger auf eine Datei, den
   man in IndexedDB ablegen kann und der einen Neustart übersteht.

   Damit das Datenmodell unberührt bleibt, wird der Handle NICHT im
   Stundenobjekt gespeichert. Dort steht weiterhin nur eine Zeichenkette
   im Feld `path`, in der Form:

       pyfs://<id>/<dateiname>

   Der Dateiname steht hinten, weil fileNameFromPath() am letzten
   Schrägstrich trennt – die vorhandene Anzeige funktioniert dadurch
   unverändert. Der Handle selbst liegt unter <id> in einer eigenen
   IndexedDB-Ablage.

   Zwei Dinge, die es auf dem Desktop nicht gibt und die hier behandelt
   werden müssen:

   1. Berechtigungen verfallen. Nach einem Neustart steht der Handle auf
      "prompt"; der Browser fragt erst wieder, wenn eine Nutzergeste
      vorliegt. Deshalb wird die Erlaubnis beim Öffnen angefordert, nicht
      beim Laden.
   2. Handles können ins Leere zeigen. Wird die Datei verschoben oder
      gelöscht, wirft getFile(). Das muss die Oberfläche als klaren
      Hinweis bekommen, nicht als stillen Fehlschlag.
   ============================================================ */

import { createStore, get, set, del, keys } from 'idb-keyval';

const handleStore = createStore('prepybara-dateien', 'handles');
const REF_PREFIX = 'pyfs://';

function neueId(){
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeFileRef(id, name){
  // Der Name wird kodiert, damit Schrägstriche darin die Zerlegung nicht
  // zerbrechen; angezeigt wird er wieder dekodiert.
  return `${REF_PREFIX}${id}/${encodeURIComponent(String(name || 'Datei'))}`;
}

export function parseFileRef(ref){
  const s = String(ref || '');
  if (!s.startsWith(REF_PREFIX)) return null;
  const rest = s.slice(REF_PREFIX.length);
  const schnitt = rest.indexOf('/');
  if (schnitt < 0) return null;
  const id = rest.slice(0, schnitt);
  let name = rest.slice(schnitt + 1);
  try { name = decodeURIComponent(name); } catch {}
  return id ? { id, name } : null;
}

export function isFileRef(ref){ return !!parseFileRef(ref); }

/* Erlaubnis prüfen und, falls nötig, anfordern. Das Anfordern verlangt
   eine Nutzergeste – der Aufruf muss aus einem Klick heraus erfolgen. */
async function ensurePermission(handle, mode = 'read'){
  if (!handle?.queryPermission) return true;   // ältere Umsetzung ohne Abfrage
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/* Dateien auswählen und ihre Handles dauerhaft ablegen.
   Rückgabe: Liste von Referenzen, passend zum Feld `path`. */
export async function pickAndStoreFiles({ multi = true } = {}){
  if (typeof window.showOpenFilePicker !== 'function') return [];
  let handles = [];
  try {
    handles = await window.showOpenFilePicker({ multiple: !!multi });
  } catch (err) {
    if (err?.name === 'AbortError') return [];
    throw err;
  }
  const refs = [];
  for (const handle of handles) {
    const id = neueId();
    await set(id, handle, handleStore);
    refs.push(makeFileRef(id, handle.name));
  }
  return refs;
}

/* Datei zum Anzeigen öffnen. Ohne Betriebssystem-Zugriff bleibt nur ein
   Blob-Verweis in einem neuen Tab; der Browser entscheidet, ob er die
   Datei darstellt oder herunterlädt. */
export async function openStoredFile(ref){
  const parsed = parseFileRef(ref);
  if (!parsed) return { ok: false, error: 'Kein gültiger Dateiverweis.' };

  const handle = await get(parsed.id, handleStore);
  if (!handle) {
    return { ok: false, error: 'Der Verweis auf diese Datei ist nicht mehr vorhanden. Häng sie erneut an.' };
  }
  if (!(await ensurePermission(handle, 'read'))) {
    return { ok: false, error: 'Der Zugriff auf die Datei wurde nicht erlaubt.' };
  }

  let file = null;
  try {
    file = await handle.getFile();
  } catch (err) {
    // Verschoben, umbenannt oder gelöscht.
    if (err?.name === 'NotFoundError') {
      return { ok: false, error: `„${parsed.name}“ liegt nicht mehr am ursprünglichen Ort. Häng die Datei erneut an.` };
    }
    return { ok: false, error: String(err?.message || err) };
  }

  const url = URL.createObjectURL(file);
  const fenster = window.open(url, '_blank', 'noopener');
  // Erst freigeben, wenn der Tab Zeit zum Laden hatte.
  setTimeout(()=> URL.revokeObjectURL(url), 60000);
  if (!fenster) return { ok: false, error: 'Das Fenster wurde vom Browser blockiert.' };
  return { ok: true };
}

/* Aufräumen: Handles wegwerfen, auf die keine Stunde mehr verweist.

   Nötig, weil das Entfernen eines Anhangs im Stundeneditor nur den
   lokalen Entwurf ändert – dort darf noch nichts gelöscht werden, sonst
   wäre die Datei weg, sobald man die Bearbeitung verwirft. Deshalb wird
   erst beim Laden abgeglichen, wenn der gespeicherte Stand feststeht. */
export function collectFileRefs(db){
  const refs = new Set();
  const sammle = (liste)=>{
    for (const f of (Array.isArray(liste) ? liste : [])) {
      const p = parseFileRef(f?.path);
      if (p) refs.add(p.id);
    }
  };
  for (const week of Object.values(db?.weeks || {})) {
    for (const lesson of Object.values(week?.lessons || {})) sammle(lesson?.files);
  }
  for (const seq of Object.values(db?.sequences || {})) sammle(seq?.files);
  for (const tpl of Object.values(db?.sequenceTemplates || {})) sammle(tpl?.files);
  return refs;
}

export async function pruneUnusedHandles(db){
  try {
    const benutzt = collectFileRefs(db);
    const vorhanden = await keys(handleStore);
    let entfernt = 0;
    for (const id of vorhanden) {
      if (!benutzt.has(String(id))) { await del(id, handleStore); entfernt += 1; }
    }
    return entfernt;
  } catch {
    return 0;
  }
}
