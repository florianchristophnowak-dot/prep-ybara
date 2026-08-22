/* ============================================================
   Durchführungsfenster im Browser

   Zwei Wege, beide mit demselben Ziel: ein eigenes Fenster in
   Präsentationsgrösse, wie es die Desktop-Fassung öffnet.

   1. Document Picture-in-Picture (Chromium): ein echtes, immer
      obenauf liegendes Fenster. Die Ansicht wird dort hineingehängt,
      die Stilvorlagen werden mitkopiert.
   2. Sonst window.open(). Das ist ein eigener JavaScript-Kontext,
      deshalb läuft die Übergabe über einen BroadcastChannel.
   ============================================================ */

const CHANNEL = 'prepybara-execution';
const REQUEST = 'snapshot:anfrage';
const DELIVER = 'snapshot:antwort';

export function hasDocumentPip(){
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

/* Der Elternkontext hält den zuletzt geöffneten Stand vor und beantwortet
   Anfragen aus dem Kindfenster. */
export function createExecutionBridge({ onMount } = {}){
  let letzterSnapshot = null;
  let kanal = null;
  let pipFenster = null;

  const kanalOeffnen = ()=>{
    if (kanal || typeof BroadcastChannel === 'undefined') return kanal;
    kanal = new BroadcastChannel(CHANNEL);
    kanal.addEventListener('message', (e)=>{
      if (e.data?.typ === REQUEST && letzterSnapshot) {
        kanal.postMessage({ typ: DELIVER, snapshot: letzterSnapshot });
      }
    });
    return kanal;
  };

  /* Stilvorlagen in das neue Dokument übernehmen. Ohne sie stünde die
     Ansicht dort ohne jede Gestaltung. */
  const stileKopieren = (zielDoc)=>{
    for (const bogen of Array.from(document.styleSheets)) {
      try {
        const regeln = Array.from(bogen.cssRules).map(r=>r.cssText).join('\n');
        const el = zielDoc.createElement('style');
        el.textContent = regeln;
        zielDoc.head.appendChild(el);
      } catch {
        // Fremde Stilvorlagen (andere Herkunft) lassen sich nicht lesen –
        // dann als Verweis einhängen.
        if (bogen.href) {
          const link = zielDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = bogen.href;
          zielDoc.head.appendChild(link);
        }
      }
    }
    // Die Darstellungswahl mitnehmen.
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) zielDoc.documentElement.setAttribute('data-theme', theme);
  };

  const oeffnen = async (snapshot)=>{
    letzterSnapshot = snapshot || null;
    kanalOeffnen();

    if (hasDocumentPip() && typeof onMount === 'function') {
      try {
        pipFenster = await window.documentPictureInPicture.requestWindow({
          width: 1100, height: 720,
        });
        stileKopieren(pipFenster.document);
        pipFenster.document.title = 'Prép-ybara – Durchführung';
        const wurzel = pipFenster.document.createElement('div');
        wurzel.className = 'app';
        pipFenster.document.body.appendChild(wurzel);
        onMount(wurzel, pipFenster);
        return { ok: true, art: 'pip' };
      } catch {
        // Abgelehnt oder nicht möglich – auf das eigene Fenster ausweichen.
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.set('view', 'execution');
    const w = window.open(url.toString(), 'prepybara-durchfuehrung',
      'popup=yes,width=1100,height=720,menubar=no,toolbar=no,location=no,status=no');
    if (!w) return { ok: false, error: 'Das Fenster wurde vom Browser blockiert.' };
    // Der Kanal beantwortet die Anfrage des neuen Fensters.
    return { ok: true, art: 'fenster' };
  };

  return {
    oeffnen,
    snapshotHolen: ()=> letzterSnapshot,
    schliessen: ()=>{ try { pipFenster?.close(); } catch {} },
  };
}

/* Im Kindfenster: den Stand über den Kanal anfordern. */
export function requestSnapshotOverChannel(timeoutMs = 3000){
  return new Promise((resolve)=>{
    if (typeof BroadcastChannel === 'undefined') { resolve(null); return; }
    const kanal = new BroadcastChannel(CHANNEL);
    let fertig = false;
    const beenden = (wert)=>{
      if (fertig) return;
      fertig = true;
      try { kanal.close(); } catch {}
      resolve(wert);
    };
    kanal.addEventListener('message', (e)=>{
      if (e.data?.typ === DELIVER) beenden(e.data.snapshot || null);
    });
    kanal.postMessage({ typ: REQUEST });
    setTimeout(()=> beenden(null), timeoutMs);
  });
}
