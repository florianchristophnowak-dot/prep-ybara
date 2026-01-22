const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDB: () => ipcRenderer.invoke('db:get'),
  setDB: (db) => ipcRenderer.invoke('db:set', db),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  exportTemplates: () => ipcRenderer.invoke('templates:export'),
  importTemplates: () => ipcRenderer.invoke('templates:import'),
  exportPdf: (payload) => ipcRenderer.invoke('pdf:export', payload),
  exportDocx: (payload) => ipcRenderer.invoke('docx:export', payload),

  // Durchführung / Execution presenter window
  openExecutionWindow: (snapshot) => ipcRenderer.invoke('execution:open', snapshot),
  getExecutionSnapshot: () => ipcRenderer.invoke('execution:get'),
  onExecutionInit: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_evt, payload) => cb(payload);
    ipcRenderer.on('execution:init', handler);
    return () => ipcRenderer.removeListener('execution:init', handler);
  },

  pickFiles: (payload) => ipcRenderer.invoke('files:pick', payload),
  openPath: (p) => ipcRenderer.invoke('files:open', p),
  revealPath: (p) => ipcRenderer.invoke('files:reveal', p),

  // Dateiablage (opt-in): Dateien in einen App-eigenen Ordner kopieren
  getLibraryRoot: () => ipcRenderer.invoke('files:library-root'),
  copyToLibrary: (payload) => ipcRenderer.invoke('files:copy-to-library', payload),

  // Menu actions (triggered from the native menubar)
  onOpenHelp: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = () => cb();
    ipcRenderer.on('menu:open-help', handler);
    return () => ipcRenderer.removeListener('menu:open-help', handler);
  }
});
