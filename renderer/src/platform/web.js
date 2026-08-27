/* ============================================================
   Browser-Umsetzung

   Persistenz über IndexedDB statt localStorage. Der bisherige
   Rückfallweg schrieb die vollständige Datenbank alle 250 ms als einen
   JSON-String synchron in localStorage – gegen ein 5-MB-Limit und auf
   dem Haupt-Thread. Ein Schuljahr mit 40 Wochen à 50 Stunden liegt bei
   rund 4,2 MB; das Limit ist damit absehbar erreicht, und die
   Serialisierung blockiert die Eingabe schon lange vorher.

   Hier wird pro Woche ein eigener Eintrag geschrieben, und nur der
   geänderte. IndexedDB arbeitet asynchron, die Eingabe bleibt frei.

   Dateiausgabe über die File System Access API, wo vorhanden, sonst über
   Download und einen Dateiwähler. Was die Umgebung nicht kann, steht in
   `capabilities` auf false – die Oberfläche bietet es dann gar nicht erst
   an, statt nach dem Klick zu melden.
   ============================================================ */

import { createStore, get, set, del, keys, getMany, setMany } from 'idb-keyval';
import {
  exportDocxInBrowser, printHtmlAsPdf, readTextFile, saveBlob, hasFileSystemAccess,
} from './web-files.js';
import {
  createExecutionBridge, requestSnapshotOverChannel, hasDocumentPip,
} from './web-execution.js';
import {
  pickAndStoreFiles, openStoredFile, pruneUnusedHandles, isFileRef,
} from './web-handles.js';
import { speichereText, waehleTextdatei } from './pocket-files.js';

const LEGACY_KEY = 'lehrerplan_db';
const META_KEY = 'meta';
const WEEK_PREFIX = 'week:';

const store = createStore('prepybara', 'db');

function splitDb(db){
  const { weeks, ...meta } = (db && typeof db === 'object') ? db : {};
  return { weeks: weeks || {}, meta };
}

export function createWebPlatform({ appVersion = '', mountExecution = null } = {}){
  const execution = createExecutionBridge({ onMount: mountExecution });
  let lastWeeks = new Map();
  let lastMeta = null;

  /* Einmalige Übernahme aus dem alten localStorage-Eintrag. Der Eintrag
     bleibt danach liegen: Erst wenn die neue Ablage nachweislich trägt,
     darf er verschwinden – deshalb wird nur ein Vermerk gesetzt. */
  const migrateFromLocalStorage = async () => {
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch { return null; }
    if (!raw) return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed !== 'object') return null;

    const { weeks, meta } = splitDb(parsed);
    const entries = [[META_KEY, meta], ...Object.entries(weeks).map(([k, v]) => [WEEK_PREFIX + k, v])];
    await setMany(entries, store);
    try { localStorage.setItem(`${LEGACY_KEY}__migriert`, new Date().toISOString()); } catch {}
    return parsed;
  };

  const loadDB = async () => {
    let meta = await get(META_KEY, store);
    if (meta === undefined) {
      const migrated = await migrateFromLocalStorage();
      if (migrated) {
        const s = splitDb(migrated);
        lastWeeks = new Map(Object.entries(s.weeks).map(([k, v]) => [k, { ref: v, json: JSON.stringify(v) }]));
        lastMeta = JSON.stringify(s.meta);
        return migrated;
      }
      return null; // Nichts gespeichert – der Aufrufer legt die Grundform an.
    }

    const allKeys = await keys(store);
    const weekKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(WEEK_PREFIX));
    const values = await getMany(weekKeys, store);
    const weeks = {};
    weekKeys.forEach((k, i) => { weeks[k.slice(WEEK_PREFIX.length)] = values[i]; });

    lastWeeks = new Map(Object.entries(weeks).map(([k, v]) => [k, { ref: v, json: JSON.stringify(v) }]));
    lastMeta = JSON.stringify(meta);
    const db = { ...meta, weeks };
    // Handles wegräumen, auf die keine Stunde mehr verweist. Bewusst erst
    // hier: im Stundeneditor ist das Entfernen nur ein Entwurf.
    pruneUnusedHandles(db);
    return db;
  };

  const saveDB = async (nextDb) => {
    const { weeks, meta } = splitDb(nextDb);
    const writes = [];
    const seen = new Set();

    for (const [key, value] of Object.entries(weeks)) {
      seen.add(key);
      const known = lastWeeks.get(key);
      if (known && known.ref === value) continue;   // unverändert, nichts zu tun
      const json = JSON.stringify(value);
      if (!known || known.json !== json) writes.push([WEEK_PREFIX + key, value]);
      // Referenz in jedem Fall nachziehen, siehe electron.js.
      lastWeeks.set(key, { ref: value, json });
    }
    const removals = [];
    for (const key of lastWeeks.keys()) {
      if (!seen.has(key)) { removals.push(WEEK_PREFIX + key); lastWeeks.delete(key); }
    }

    const metaJson = JSON.stringify(meta);
    if (metaJson !== lastMeta) { lastMeta = metaJson; writes.push([META_KEY, meta]); }

    if (!writes.length && !removals.length) return;
    if (writes.length) await setMany(writes, store);
    for (const key of removals) await del(key, store);
  };

  /* Dauerhafte Ablage anfragen. Ohne diese Zusage darf der Browser die
     Daten bei Platzmangel verwerfen – das muss die Oberfläche wissen. */
  const requestPersistence = async () => {
    try {
      if (!navigator.storage?.persist) return { supported: false, granted: false };
      const already = await navigator.storage.persisted?.();
      if (already) return { supported: true, granted: true };
      const granted = await navigator.storage.persist();
      return { supported: true, granted: !!granted };
    } catch {
      return { supported: false, granted: false };
    }
  };

  const notAvailable = async () => null;

  const BACKUP_TYPE = { description: 'Prép-ybara Backup', accept: { 'application/json': ['.json'] } };

  /* Backup und Vorlagen sind JSON-Dateien – im Browser genügt derselbe
     Inhalt wie auf dem Desktop. */
  const exportBackup = async () => {
    const db = await loadDB();
    if (!db) return null;
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    return saveBlob(blob, `prepybara-backup-${stamp}.json`, BACKUP_TYPE);
  };

  /* Ein archiviertes Schuljahr: dieselbe Backup-Form, nur mit den
     Daten eines Jahres. Kein zweites Dateiformat. */
  const exportArchive = async ({ data, suggestedFileName } = {}) => {
    if (!data || typeof data !== 'object') return null;
    const name = String(suggestedFileName || '').trim() || 'prepybara-archiv.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    return saveBlob(blob, name, BACKUP_TYPE);
  };

  const importBackup = async () => {
    const text = await readTextFile({ ...BACKUP_TYPE, extensions: ['.json'] });
    if (!text) return null;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges Backup.'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('Die Datei ist kein gültiges Backup.');
    // Vollständig übernehmen: erst leeren, dann neu schreiben.
    const existing = await keys(store);
    for (const k of existing) await del(k, store);
    lastWeeks = new Map();
    lastMeta = null;
    await saveDB(parsed);
    return parsed;
  };

  const exportTemplates = async () => {
    const db = await loadDB();
    const templates = db?.sequenceTemplates || {};
    const blob = new Blob([JSON.stringify({ sequenceTemplates: templates }, null, 2)], { type: 'application/json' });
    return saveBlob(blob, 'prepybara-vorlagen.json', BACKUP_TYPE);
  };

  const importTemplates = async () => {
    const text = await readTextFile({ ...BACKUP_TYPE, extensions: ['.json'] });
    if (!text) return null;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { throw new Error('Die Datei enthält keine gültigen Vorlagen.'); }
    const incoming = parsed?.sequenceTemplates || parsed || {};
    const db = (await loadDB()) || {};
    const merged = { ...db, sequenceTemplates: { ...(db.sequenceTemplates || {}) } };
    for (const [id, tpl] of Object.entries(incoming)) {
      if (!tpl || typeof tpl !== 'object') continue;
      let nextId = tpl.id || id;
      while (merged.sequenceTemplates[nextId]) nextId = `${nextId}_${Math.random().toString(36).slice(2, 6)}`;
      merged.sequenceTemplates[nextId] = { ...tpl, id: nextId, importedAt: new Date().toISOString() };
    }
    await saveDB(merged);
    return merged;
  };

  return {
    name: 'browser',
    capabilities: {
      persistentStorage: true,
      // Alles Dateibezogene folgt mit dem PWA-Umbau.
      backupFiles: true,
      archiveFiles: true,
      templateFiles: true,
      pdfExport: true,
      docxExport: true,
      // Dateianhänge brauchen dauerhafte Zugriffsrechte auf Dateien;
      // ohne File System Access API gibt es die nicht.
      fileAttachments: hasFileSystemAccess(),
      fileLibrary: false,
      revealInFolder: false,
      openExternally: true,
      executionWindow: true,
      // Nur Chromium legt ein echtes, immer obenauf liegendes Fenster an.
      executionAlwaysOnTop: hasDocumentPip(),
      // Nur der Browser kann den Speicherplatz zusichern.
      storagePersistence: true,
      installable: true,
      // Austausch mit Prép-ybara Pocket: Download und Dateifeld genügen.
      pocketFiles: true,
    },

    loadDB,
    saveDB,
    requestPersistence,

    exportBackup,
    exportArchive,
    importBackup,
    exportTemplates,
    importTemplates,

    /* Austausch mit Prép-ybara Pocket. Der Inhalt wird im Renderer
       erzeugt und geprüft; hier geht es nur um Datei rein, Datei raus. */
    exportPocketProfile: async ({ content, fileName }) => speichereText(content, fileName),
    importPocketFile: async () => waehleTextdatei(),
    exportPdf: ({ html }) => printHtmlAsPdf({ html, appVersion }),
    exportDocx: (payload) => exportDocxInBrowser(payload),
    /* Dateianhänge: Der Handle wandert in eine eigene IndexedDB-Ablage,
       in der Stunde steht nur eine Referenz im Feld `path`. Das
       Datenmodell bleibt dadurch unberührt. */
    pickFiles: async ({ multi = true } = {}) => pickAndStoreFiles({ multi }),
    openPath: async (p) => {
      if (isFileRef(p)) return openStoredFile(p);
      // Kein Dateiverweis, sondern ein Link aus der Stunde.
      try { window.open(p, '_blank', 'noopener'); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e?.message || e) }; }
    },
    // Es gibt im Browser keinen Dateimanager, den man ansteuern könnte.
    revealPath: notAvailable,
    getLibraryRoot: notAvailable,
    copyToLibrary: notAvailable,
    openExecutionWindow: (snapshot) => execution.oeffnen(snapshot),
    /* Im selben Kontext (Picture-in-Picture) liegt der Stand direkt vor;
       in einem eigenen Fenster wird er über den Kanal angefordert. */
    getExecutionSnapshot: async () => execution.snapshotHolen() || await requestSnapshotOverChannel(),
    onExecutionInit: () => ()=>{},
    onOpenHelp: () => ()=>{},
  };
}
