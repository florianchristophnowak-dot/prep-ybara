const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Force IPv4 for localhost (prevents Windows setups where localhost resolves to ::1 and breaks dev-server loading)
// This affects Chromium's resolver inside Electron.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP localhost 127.0.0.1');

// Branding (window/app name)
app.setName('Prép-ybara');

// New storage namespace (keeps user data separate). If a legacy store exists, we migrate it once.
const store = new Store({ name: 'prepybara' });
const legacyStore = new Store({ name: 'lehrerplan' });

function defaultDB() {
  return {
    schemaVersion: 7,
    socialForms: {},
    competencies: {},
    sequences: {},
    sequenceTemplates: {},
    schoolCalendar: {
      schoolYear: { startISO: '', endISO: '' },
      lessonTimesEnabled: false,
      lessonTimes: [],
      vacations: [],
      freeDays: [],
      events: []
    },
    weeks: {},
    todos: [],
    groupColors: {},
    classGroups: {},
    subjects: {},
    supervisionLabels: {},
    schoolYearArchives: [],
    schoolYearRollover: { dismissedEndISO: '', snoozeUntilISO: '', lastPromptISO: '' },

    // App-Einstellungen (optional)
    appSettings: { fileCopyOptIn: false }
  };
}

function getDB() {
  if (store.has('db')) return store.get('db');
  if (legacyStore.has('db')) {
    const legacy = legacyStore.get('db');
    store.set('db', legacy);
    return legacy;
  }
  return defaultDB();
}

function setDB(db) {
  store.set('db', db);
}

function attachDebugLogging(win) {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[did-fail-load]', { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[render-process-gone]', details);
  });
  win.webContents.on('unresponsive', () => {
    console.error('[unresponsive] Renderer is unresponsive');
  });
}


async function loadRendererWithFallback(win, { devUrl, fileQuery = null } = {}) {
  const indexPath = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');

  // In dev, try dev server first.
  if (!app.isPackaged) {
    try {
      await win.loadURL(devUrl);
      // Don't auto-open DevTools. If you need them, set PREPYBARA_OPEN_DEVTOOLS=1
      // or use the usual shortcuts (e.g. Ctrl+Shift+I).
      if (process.env.PREPYBARA_OPEN_DEVTOOLS === '1') {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    } catch (err) {
      console.warn('[dev-server unavailable] Falling back to built renderer', err?.message || err);
      // fallthrough
    }
  }

  // Load built files if present
  if (fs.existsSync(indexPath)) {
    try {
      if (fileQuery) {
        await win.loadFile(indexPath, { query: fileQuery });
      } else {
        await win.loadFile(indexPath);
      }
      return;
    } catch (err) {
      console.error('[load-built-failed]', err);
    }
  }

  // Last resort: show a helpful message instead of a white window
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Prép-ybara</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:24px;line-height:1.4}
  code{background:#f3f3f3;padding:2px 6px;border-radius:6px}
  pre{background:#f3f3f3;padding:12px;border-radius:10px;overflow:auto}
</style>
</head>
<body>
  <h2>Prép-ybara konnte nicht starten</h2>
  <p>Der Dev-Server ist nicht erreichbar und es gibt noch keinen Build unter <code>dist/renderer</code>.</p>
  <p>Starte im Projektordner entweder:</p>
  <pre><code>npm run dev</code></pre>
  <p>oder (ohne Dev-Server):</p>
  <pre><code>npm run build
npm start</code></pre>
  <p>Danach dieses Fenster neu laden (<code>Strg+R</code>).</p>
</body>
</html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  attachDebugLogging(win);

  const devUrl = (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/').replace(/\/$/, '') + '/';
  loadRendererWithFallback(win, { devUrl });

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

let helpWin = null;
function openHelpWindow(){
  if (helpWin && !helpWin.isDestroyed()) {
    helpWin.focus();
    return;
  }
  helpWin = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: 'Prép-ybara – README',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  attachDebugLogging(helpWin);

  const devUrl = (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/').replace(/\/$/, '') + '/?view=help';
  loadRendererWithFallback(helpWin, { devUrl, fileQuery: { view: 'help' } });

  helpWin.on('closed', () => { helpWin = null; });
}

// --- Execution / Durchführung window (per-lesson presenter) ---
// We keep a payload per window id and also by webContents id.
// IMPORTANT: Sending an IPC event right after load can race with React mounting.
// Therefore the execution renderer also fetches its snapshot via ipcMain.handle('execution:get').
let executionPayloadByWindowId = new Map();
let executionPayloadByWebContentsId = new Map();

function openExecutionWindow(snapshot){
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 650,
    title: 'Prép-ybara – Durchführung',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  attachDebugLogging(win);

  executionPayloadByWindowId.set(win.id, snapshot || null);
  // Key by webContents.id so the execution renderer can reliably request its payload.
  try {
    executionPayloadByWebContentsId.set(win.webContents.id, snapshot || null);
  } catch {}
  win.on('closed', () => {
    executionPayloadByWindowId.delete(win.id);
    try { executionPayloadByWebContentsId.delete(win.webContents.id); } catch {}
  });

  const devUrl = (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173/').replace(/\/$/, '') + '/?view=execution';
  loadRendererWithFallback(win, { devUrl, fileQuery: { view: 'execution' } });

  // After the renderer is ready, push the snapshot into that window.
  win.webContents.on('did-finish-load', () => {
    try {
      const payload = executionPayloadByWindowId.get(win.id);
      win.webContents.send('execution:init', payload);
    } catch (err) {
      console.error('[execution:init failed]', err);
    }
  });

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}


function installAppMenu(mainWin){
  if (!mainWin) return;
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'README / Hilfe',
          accelerator: 'F1',
          click: () => {
            openHelpWindow();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function exportTextFile(defaultPath, content) {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

async function importJsonFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePaths?.[0]) return null;
  const raw = fs.readFileSync(filePaths[0], 'utf-8');
  return JSON.parse(raw);
}

async function exportPdfFromHtml({ html, suggestedFileName }) {
  const isLandscape = /name=["']page-orientation["']\s+content=["']landscape["']/.test(String(html || ''));
  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  await pdfWin.loadURL(dataUrl);

  const version = app.getVersion();
  const footerTemplate = `
    <div style="width:100%; font-size:9px; padding:0 12px; color:#6b7280;">
      <span style="float:left;">Prép-ybara, Version ${version}</span>
      <span style="float:right;">© Florian Nowak</span>
    </div>
  `;

  const pdfBuffer = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    landscape: isLandscape,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate,
    // margins are in inches (Chrome DevTools Protocol Page.printToPDF)
    margins: { top: 0.6, bottom: 0.8, left: 0.5, right: 0.5 }
  });

  pdfWin.destroy();

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: suggestedFileName || 'Unterrichtsstunde.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, pdfBuffer);
  return filePath;
}



// --- DOCX export (Word) ---
let _htmlToDocx = null;
async function getHtmlToDocx() {
  if (_htmlToDocx) return _htmlToDocx;
  // html-to-docx is ESM in some builds, so use dynamic import from CJS.
  // Hinweis: Wir verwenden in der App standardmäßig .doc (HTML), weil das
  // auf vielen Word-Versionen zuverlässiger öffnet als ein konvertiertes .docx.
  const mod = await import('html-to-docx');
  _htmlToDocx = mod?.default || mod;
  return _htmlToDocx;
}

function buildFullHtmlDocument(html) {
  const src = String(html || '');
  const headMatch = src.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = src.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleTags = src.match(/<style[^>]*>[\s\S]*?<\/style>/ig) || [];

  const headInner = headMatch ? headMatch[1] : '';
  const bodyInner = bodyMatch ? bodyMatch[1] : src;

  // Many converters expect a full HTML document. Keep styles from <head> or inline.
  return `<!doctype html><html><head><meta charset="utf-8" />\n${headInner}\n${styleTags.join('\n')}\n</head><body>${bodyInner}</body></html>`;
}

function ensureDocxBuffer(docx) {
  let buf = docx;
  // Common return types: Buffer, ArrayBuffer, Uint8Array, etc.
  if (Buffer.isBuffer(buf)) return buf;
  if (buf instanceof ArrayBuffer) return Buffer.from(new Uint8Array(buf));
  if (ArrayBuffer.isView(buf)) return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf && typeof buf === 'object') {
    if (Buffer.isBuffer(buf.buffer)) return buf.buffer;
    if (buf.buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(buf.buffer));
    if (ArrayBuffer.isView(buf.data)) return Buffer.from(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
  }
  if (typeof buf === 'string') return Buffer.from(buf, 'binary');
  throw new Error(`Unsupported DOCX export type: ${typeof buf}`);
}

async function exportDocxFromHtml({ html, suggestedFileName }) {
  const src = String(html || '');
  const contentHtml = buildFullHtmlDocument(src);

  const isLandscape = /name=["']page-orientation["']\s+content=["']landscape["']/.test(src);
  const defaultName = String(suggestedFileName || 'Unterrichtsstunde.doc')
    .replace(/\.docx$/i, '.doc');

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Word', extensions: ['doc'] }]
  });

  if (canceled || !filePath) return null;
  const outPath = filePath.toLowerCase().endsWith('.doc') ? filePath : `${filePath}.doc`;

  // Word kann HTML in einer .doc-Datei sehr zuverlässig öffnen.
  // Wir fügen einige mso-/@page-Hinweise hinzu (Querformat, Ränder), damit der Ausdruck passt.
  const wrapped = wrapHtmlForWord(contentHtml, { landscape: isLandscape });
  fs.writeFileSync(outPath, wrapped, { encoding: 'utf8' });
  return outPath;
}

function wrapHtmlForWord(fullHtml, { landscape }) {
  const html = String(fullHtml || '');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headInner = headMatch ? headMatch[1] : '';
  const bodyInner = bodyMatch ? bodyMatch[1] : html;

  // A4 in pt (Word versteht pt zuverlässig):
  // portrait: 595.28pt × 841.89pt, landscape: swap.
  const w = landscape ? 841.89 : 595.28;
  const h = landscape ? 595.28 : 841.89;

  const wordPageCss = `
    <style>
      @page Section1 { size: ${w.toFixed(2)}pt ${h.toFixed(2)}pt; margin: 12mm; mso-page-orientation: ${landscape ? 'landscape' : 'portrait'}; }
      div.Section1 { page: Section1; }
    </style>
  `;

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  ${headInner}
  ${wordPageCss}
</head>
<body>
  <div class="Section1">
    ${bodyInner}
  </div>
</body>
</html>`;
}

app.whenReady().then(() => {
  const mainWin = createMainWindow();
  installAppMenu(mainWin);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit when all windows closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC
ipcMain.handle('db:get', async () => getDB());
ipcMain.handle('db:set', async (_evt, db) => {
  setDB(db);
  return true;
});

ipcMain.handle('backup:export', async () => {
  const db = getDB();
  const stamp = new Date().toISOString().slice(0, 10);
  const content = JSON.stringify(db, null, 2);
  return exportTextFile(`Prepybara-Backup-${stamp}.json`, content);
});

ipcMain.handle('backup:import', async () => {
  const imported = await importJsonFile();
  if (!imported || typeof imported !== 'object') return null;
  // Basic sanity
  if (!('weeks' in imported)) imported.weeks = {};
  if (!('socialForms' in imported)) imported.socialForms = {};
  if (!('competencies' in imported)) imported.competencies = {};
  if (!('sequences' in imported)) imported.sequences = {};
  if (!('sequenceTemplates' in imported)) imported.sequenceTemplates = {};
  if (!('schoolCalendar' in imported)) {
    imported.schoolCalendar = {
      schoolYear: { startISO: '', endISO: '' },
      vacations: [],
      freeDays: [],
      events: []
    };
  }
  if (!('schemaVersion' in imported)) imported.schemaVersion = 4;
  if (imported.schemaVersion < 4) imported.schemaVersion = 4;
  setDB(imported);
  return imported;
});

ipcMain.handle('execution:open', async (_evt, snapshot) => {
  try {
    openExecutionWindow(snapshot);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

// Execution window reliably fetches its payload after React has mounted.
ipcMain.handle('execution:get', async (evt) => {
  try {
    const wcId = evt?.sender?.id;
    if (!wcId) return null;
    return executionPayloadByWebContentsId.get(wcId) || null;
  } catch {
    return null;
  }
});


function nodeUid() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

ipcMain.handle('templates:export', async () => {
  const db = getDB();
  const stamp = new Date().toISOString().slice(0, 10);
  const content = JSON.stringify({
    schema: 'prepybara-sequence-templates',
    exportedAt: new Date().toISOString(),
    sequenceTemplates: db.sequenceTemplates || {}
  }, null, 2);
  return exportTextFile(`Prepybara-Sequenzvorlagen-${stamp}.json`, content);
});

ipcMain.handle('templates:import', async () => {
  const imported = await importJsonFile();
  if (!imported || typeof imported !== 'object') return null;
  const incoming = imported.sequenceTemplates || imported.templates || null;
  if (!incoming || typeof incoming !== 'object') return null;

  const db = getDB();
  if (!db.sequenceTemplates || typeof db.sequenceTemplates !== 'object') db.sequenceTemplates = {};

  // Merge templates; avoid id collisions
  for (const [id, tpl] of Object.entries(incoming)) {
    const safeTpl = (tpl && typeof tpl === 'object') ? tpl : {};
    let nextId = safeTpl.id || id || nodeUid();
    while (db.sequenceTemplates[nextId]) nextId = nodeUid();
    db.sequenceTemplates[nextId] = { ...safeTpl, id: nextId, importedAt: new Date().toISOString() };
  }
  db.schemaVersion = Math.max(Number(db.schemaVersion || 0), 4);
  setDB(db);
  return db;
});

ipcMain.handle('files:pick', async (_evt, payload) => {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const multi = p.multi !== false;
  const filters = Array.isArray(p.filters) && p.filters.length ? p.filters : [
    { name: 'Dokumente', extensions: ['pdf','doc','docx','ppt','pptx','xls','xlsx','odp','odt','ods'] },
    { name: 'Bilder', extensions: ['png','jpg','jpeg','webp','gif'] },
    { name: 'Alle Dateien', extensions: ['*'] }
  ];
  const res = await dialog.showOpenDialog({
    properties: ['openFile', ...(multi ? ['multiSelections'] : [])],
    filters
  });
  if (res.canceled || !res.filePaths?.length) return [];
  return res.filePaths;
});

ipcMain.handle('files:open', async (_evt, p) => {
  const fp = String(p || '').trim();
  if (!fp) return { ok: false, error: 'no-path' };
  const err = await shell.openPath(fp);
  return { ok: !err, error: err || '' };
});

ipcMain.handle('files:reveal', async (_evt, p) => {
  const fp = String(p || '').trim();
  if (!fp) return { ok: false, error: 'no-path' };
  try {
    shell.showItemInFolder(fp);
    return { ok: true, error: '' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});


// --- Dateiablage (opt-in): Dateien in App-Ordner kopieren ---
function sanitizePathPart(input){
  // Windows-safe: <>:"/\\|?* sowie Steuerzeichen entfernen; außerdem trimmen.
  const s = String(input || '').trim();
  if (!s) return '';
  return s
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 80);
}

function ensureDirSync(dirPath){
  try { fs.mkdirSync(dirPath, { recursive: true }); } catch {}
}

function uniqueDestPath(dirPath, fileName){
  const base = path.parse(fileName);
  let candidate = path.join(dirPath, fileName);
  if (!fs.existsSync(candidate)) return candidate;
  for (let i=2;i<9999;i++){
    const nextName = `${base.name} (${i})${base.ext}`;
    candidate = path.join(dirPath, nextName);
    if (!fs.existsSync(candidate)) return candidate;
  }
  // last resort
  return path.join(dirPath, `${base.name}-${Date.now()}${base.ext}`);
}

ipcMain.handle('files:library-root', async () => {
  const root = path.join(app.getPath('userData'), 'Dateien');
  ensureDirSync(root);
  return root;
});

ipcMain.handle('files:copy-to-library', async (_evt, payload) => {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const paths = Array.isArray(p.paths) ? p.paths.map(x=>String(x||'').trim()).filter(Boolean) : [];
  const meta = (p.meta && typeof p.meta === 'object') ? p.meta : {};

  const root = path.join(app.getPath('userData'), 'Dateien');
  ensureDirSync(root);

  const parts = [];
  const sy = sanitizePathPart(meta.schoolYearLabel || meta.schoolYear || '');
  const g = sanitizePathPart(meta.classGroup || '');
  const subj = sanitizePathPart(meta.subject || '');
  const seq = sanitizePathPart(meta.sequenceName || meta.sequence || '');
  const ctx = sanitizePathPart(meta.contextLabel || meta.context || '');

  if (sy) parts.push(sy);
  if (g) parts.push(g);
  if (subj) parts.push(subj);
  if (seq) parts.push(seq);
  if (ctx) parts.push(ctx);

  const targetDir = path.join(root, ...parts.filter(Boolean));
  ensureDirSync(targetDir);

  const out = { ok: true, root, targetDir, files: [], errors: [] };
  for (const src of paths){
    try {
      if (!fs.existsSync(src)) {
        out.errors.push({ source: src, error: 'not-found' });
        continue;
      }
      const name = path.basename(src);
      const dest = uniqueDestPath(targetDir, name);
      fs.copyFileSync(src, dest);
      out.files.push({ source: src, dest, name });
    } catch (e) {
      out.errors.push({ source: src, error: String(e?.message || e) });
    }
  }

  if (out.errors.length) out.ok = false;
  return out;
});


ipcMain.handle('pdf:export', async (_evt, payload) => {
  return exportPdfFromHtml(payload);
});

ipcMain.handle('docx:export', async (_evt, payload) => {
  return exportDocxFromHtml(payload);
});
