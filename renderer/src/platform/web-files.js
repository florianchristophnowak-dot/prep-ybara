/* ============================================================
   Dateiausgabe im Browser

   Zwei Wege, je nachdem was der Browser kann:
   - File System Access API (Chromium): der Nutzer wählt Ort und Namen,
     wie in der Desktop-App.
   - Sonst: Download in den Download-Ordner, Einlesen über einen
     versteckten Dateiwähler.
   ============================================================ */

import { buildWordDocument, isLandscapeHtml } from '../../../electron/word-export.mjs';

export const hasFileSystemAccess = () =>
  typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

/* --- Speichern ------------------------------------------------------- */

async function saveViaPicker(blob, suggestedName, { description, accept }){
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description, accept }],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return handle.name;
}

function saveViaDownload(blob, suggestedName){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst freigeben, wenn der Download angestossen ist.
  setTimeout(()=> URL.revokeObjectURL(url), 10000);
  return suggestedName;
}

export async function saveBlob(blob, suggestedName, opts){
  if (hasFileSystemAccess()) {
    try { return await saveViaPicker(blob, suggestedName, opts); }
    catch (err) {
      // Abbruch durch den Nutzer ist kein Fehler.
      if (err?.name === 'AbortError') return null;
      // Sonst auf den Download zurückfallen, statt aufzugeben.
    }
  }
  return saveViaDownload(blob, suggestedName);
}

/* --- Einlesen -------------------------------------------------------- */

export async function readTextFile({ description, accept, extensions }){
  if (hasFileSystemAccess() && typeof window.showOpenFilePicker === 'function') {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description, accept }],
      });
      const file = await handle.getFile();
      return await file.text();
    } catch (err) {
      if (err?.name === 'AbortError') return null;
    }
  }
  return new Promise((resolve)=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = (extensions || []).join(',');
    input.style.display = 'none';
    input.addEventListener('change', async ()=>{
      const file = input.files?.[0];
      input.remove();
      if (!file) { resolve(null); return; }
      resolve(await file.text());
    });
    // Bricht der Nutzer ab, feuert kein change – der Wähler bleibt liegen
    // und wird beim nächsten Aufruf ersetzt. Kein Zustand hängt daran.
    document.body.appendChild(input);
    input.click();
  });
}

/* --- Word ------------------------------------------------------------ */

export async function exportDocxInBrowser({ html, suggestedFileName }){
  // Bewusst dasselbe gemeinsame Modul wie im Hauptprozess: der Export
  // erzeugt für Word aufbereitetes HTML als .doc, kein echtes .docx.
  // Eine zweite Umsetzung (etwa über html-to-docx) ergäbe ein anderes
  // Format – und ausgedruckte Planungen landen in Prüfungsakten.
  const name = String(suggestedFileName || 'Unterrichtsstunde.doc').replace(/\.docx$/i, '.doc');
  const blob = new Blob([buildWordDocument(html)], { type: 'application/msword;charset=utf-8' });
  const saved = await saveBlob(blob, name, {
    description: 'Word-Dokument',
    accept: { 'application/msword': ['.doc'] },
  });
  return saved;
}

/* --- PDF -------------------------------------------------------------- */

/* Der Browser kennt kein printToPDF. Stattdessen wird das Export-HTML in
   einen versteckten Rahmen geladen und dessen Druckdialog geöffnet; dort
   wählt der Nutzer "Als PDF speichern".

   Die Seitenmasse entsprechen der Desktop-Ausgabe: A4, Ränder oben
   0.6in, unten 0.8in, seitlich 0.5in, Hintergründe mitgedruckt. Die
   Fusszeile mit Version und Copyright wird nachgebildet – der Desktop
   setzt sie über footerTemplate, das es im Browser nicht gibt. */
export function printHtmlAsPdf({ html, appVersion }){
  return new Promise((resolve)=>{
    const landscape = isLandscapeHtml(html);
    const printCss = `
      <style>
        @page {
          size: A4 ${landscape ? 'landscape' : 'portrait'};
          margin: 0.6in 0.5in 0.8in 0.5in;
        }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pyPrintFooter {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          font-size: 9px;
          color: #6b7280;
          display: flex;
          justify-content: space-between;
        }
      </style>
    `;
    const footer = `<div class="pyPrintFooter">`
      + `<span>Prép-ybara, Version ${appVersion}</span>`
      + `<span>&copy; Florian Nowak</span></div>`;

    const doc = String(html || '');
    const withFooter = doc.includes('</body>')
      ? doc.replace('</body>', `${footer}</body>`)
      : `${doc}${footer}`;
    const withCss = withFooter.includes('</head>')
      ? withFooter.replace('</head>', `${printCss}</head>`)
      : `${printCss}${withFooter}`;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const cleanup = ()=>{ try { frame.remove(); } catch {} };
    frame.onload = ()=>{
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch { cleanup(); resolve(null); return; }
      // Der Druckdialog blockiert; danach aufräumen.
      setTimeout(()=>{ cleanup(); resolve({ printed: true }); }, 500);
    };
    frame.srcdoc = withCss;
  });
}
