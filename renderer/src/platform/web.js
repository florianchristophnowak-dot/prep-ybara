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

   Die dateibezogenen Fähigkeiten sind hier bewusst noch nicht belegt –
   sie gehören zum PWA-Umbau. Die Oberfläche liest das an `capabilities`
   ab und bietet sie gar nicht erst an, statt nach dem Klick zu melden.
   ============================================================ */

import { createStore, get, set, del, keys, getMany, setMany } from 'idb-keyval';

const LEGACY_KEY = 'lehrerplan_db';
const META_KEY = 'meta';
const WEEK_PREFIX = 'week:';

const store = createStore('prepybara', 'db');

function splitDb(db){
  const { weeks, ...meta } = (db && typeof db === 'object') ? db : {};
  return { weeks: weeks || {}, meta };
}

export function createWebPlatform(){
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
    return { ...meta, weeks };
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

  return {
    name: 'browser',
    capabilities: {
      persistentStorage: true,
      // Alles Dateibezogene folgt mit dem PWA-Umbau.
      backupFiles: false,
      templateFiles: false,
      pdfExport: false,
      docxExport: false,
      fileAttachments: false,
      fileLibrary: false,
      revealInFolder: false,
      openExternally: true,
      executionWindow: false,
    },

    loadDB,
    saveDB,
    requestPersistence,

    exportBackup: notAvailable,
    importBackup: notAvailable,
    exportTemplates: notAvailable,
    importTemplates: notAvailable,
    exportPdf: notAvailable,
    exportDocx: notAvailable,
    pickFiles: notAvailable,
    openPath: async (p) => { try { window.open(p, '_blank', 'noopener'); return { ok: true }; } catch (e) { return { ok: false, error: String(e?.message || e) }; } },
    revealPath: notAvailable,
    getLibraryRoot: notAvailable,
    copyToLibrary: notAvailable,
    openExecutionWindow: notAvailable,
    getExecutionSnapshot: notAvailable,
    onExecutionInit: () => ()=>{},
    onOpenHelp: () => ()=>{},
  };
}
