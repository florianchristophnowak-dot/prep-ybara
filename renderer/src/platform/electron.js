/* ============================================================
   Electron-Umsetzung: leitet auf die Preload-Brücke durch.

   Einzige Abweichung vom reinen Durchreichen ist das Speichern: statt
   die gesamte Datenbank bei jeder Änderung über die Prozessgrenze zu
   schieben, wird nur die tatsächlich geänderte Woche übertragen.
   ============================================================ */

/* Zerlegt die Datenbank in Wochen und den Rest ("meta"). Der Schlüssel
   der Wochen ist bereits der Wochenanfang – das Datenmodell gibt die
   Aufteilung her, es muss nichts umbenannt werden. */
function splitDb(db){
  const { weeks, ...meta } = (db && typeof db === 'object') ? db : {};
  return { weeks: weeks || {}, meta };
}

export function createElectronPlatform(api){
  /* Was zuletzt geschrieben wurde, je Woche: erst die Objektidentität,
     ersatzweise die Zeichenkette. Der Renderer kopiert bei einer Änderung
     nur den betroffenen Pfad, deshalb genügt für unveränderte Wochen der
     Referenzvergleich – sie müssen gar nicht erst serialisiert werden. */
  let lastWeeks = new Map();
  let lastMeta = null;
  let patchSupported = typeof api.patchDB === 'function';

  const loadDB = async () => {
    const db = await api.getDB();
    const { weeks, meta } = splitDb(db);
    lastWeeks = new Map(Object.entries(weeks).map(([k, v]) => [k, { ref: v, json: JSON.stringify(v) }]));
    lastMeta = JSON.stringify(meta);
    return db;
  };

  const saveDB = async (nextDb) => {
    const { weeks, meta } = splitDb(nextDb);

    if (!patchSupported) {
      // Ältere Preload-Brücke: unverändertes Verhalten.
      await api.setDB(nextDb);
      return;
    }

    const changedWeeks = {};
    const seen = new Set();
    let changedCount = 0;
    for (const [key, value] of Object.entries(weeks)) {
      seen.add(key);
      const known = lastWeeks.get(key);
      if (known && known.ref === value) continue;   // unverändert, nichts zu tun
      const json = JSON.stringify(value);
      if (!known || known.json !== json) {
        changedWeeks[key] = value;
        changedCount += 1;
      }
      // Referenz in jedem Fall nachziehen: gleicher Inhalt bei neuer
      // Identität soll beim nächsten Mal wieder über den schnellen
      // Referenzvergleich laufen.
      lastWeeks.set(key, { ref: value, json });
    }
    const removedWeeks = [];
    for (const key of lastWeeks.keys()) {
      if (!seen.has(key)) { removedWeeks.push(key); lastWeeks.delete(key); }
    }

    const metaJson = JSON.stringify(meta);
    const metaChanged = metaJson !== lastMeta;
    if (metaChanged) lastMeta = metaJson;

    // Nichts zu tun: gar nicht erst über die Prozessgrenze gehen.
    if (!changedCount && !removedWeeks.length && !metaChanged) return;

    const res = await api.patchDB({
      weeks: changedWeeks,
      removedWeeks,
      meta: metaChanged ? meta : null,
    });
    // Kennt der Hauptprozess den Teilschreibvorgang nicht, einmal
    // vollständig speichern und künftig dabei bleiben.
    if (res && res.ok === false && res.unsupported) {
      patchSupported = false;
      await api.setDB(nextDb);
    }
  };

  const wrap = (fn) => (typeof fn === 'function' ? fn : null);

  return {
    name: 'desktop',
    capabilities: {
      persistentStorage: true,
      backupFiles: true,
      templateFiles: true,
      pdfExport: true,
      docxExport: true,
      fileAttachments: typeof api.pickFiles === 'function',
      fileLibrary: typeof api.copyToLibrary === 'function',
      revealInFolder: typeof api.revealPath === 'function',
      openExternally: typeof api.openPath === 'function',
      executionWindow: typeof api.openExecutionWindow === 'function',
      // Ältere Preload-Brücken kennen den Pocket-Austausch nicht.
      pocketFiles: typeof api.exportPocketProfile === 'function',
    },

    loadDB,
    saveDB,

    exportBackup: () => api.exportBackup(),
    importBackup: () => api.importBackup(),
    exportTemplates: () => api.exportTemplates(),
    importTemplates: () => api.importTemplates(),

    exportPocketProfile: (payload) => api.exportPocketProfile(payload),
    importPocketFile: () => api.importPocketFile(),

    exportPdf: (payload) => api.exportPdf(payload),
    exportDocx: (payload) => api.exportDocx(payload),

    pickFiles: (payload) => api.pickFiles(payload),
    openPath: (p) => api.openPath(p),
    revealPath: (p) => api.revealPath(p),
    getLibraryRoot: () => api.getLibraryRoot(),
    copyToLibrary: (payload) => api.copyToLibrary(payload),

    openExecutionWindow: (snapshot) => api.openExecutionWindow(snapshot),
    getExecutionSnapshot: () => api.getExecutionSnapshot(),
    onExecutionInit: (cb) => (wrap(api.onExecutionInit) ? api.onExecutionInit(cb) : ()=>{}),
    onOpenHelp: (cb) => (wrap(api.onOpenHelp) ? api.onOpenHelp(cb) : ()=>{}),
    /* Menüpunkt "Import / Export → Prép-ybara Pocket". */
    onPocketMenu: (cb) => (wrap(api.onPocketMenu) ? api.onPocketMenu(cb) : ()=>{}),
  };
}
