/* ============================================================
   Dateien aus Pocket heraus und in Pocket hinein

   Pocket legt NICHT fest, wie die Datei auf den PC kommt. Es stellt
   zwei Wege bereit und überlässt die Wahl der Lehrkraft:

     Teilen        der native Teilen-Dialog des Telefons – Mail, Messenger,
                   Cloud-Ordner, Kabel, was immer dort eingerichtet ist.
     Herunterladen die Datei landet im Download-Ordner des Geräts.

   Beim EINLESEN wird bewusst kein `accept` gesetzt. Die Endungen
   .prepybara-profile und .prepybara-lesson sind keinem MIME-Typ
   zugeordnet; Android-Dateiwähler blenden dann genau die Datei aus, die
   man sucht. Die Prüfung des Inhalts entscheidet ohnehin – und sie muss
   jede Datei überstehen, auch eine falsche.
   ============================================================ */

export function kannTeilen(){
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/* Ob dieses Gerät DATEIEN teilen kann – nicht nur Text. Wird mit einer
   Beispieldatei geprüft, weil canShare() ohne Argument nichts aussagt. */
export function kannDateienTeilen(){
  try {
    if (typeof navigator?.canShare !== 'function' || typeof navigator?.share !== 'function') return false;
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function alsDatei(inhalt, dateiname){
  return new File([inhalt], dateiname, { type: 'application/json' });
}

export async function teileDatei(inhalt, dateiname, { titel = 'Prép-ybara Pocket' } = {}){
  const datei = alsDatei(inhalt, dateiname);
  try {
    await navigator.share({ files: [datei], title: titel });
    return { ok: true, weg: 'share' };
  } catch (err) {
    // Abbruch durch die Lehrkraft ist kein Fehler.
    if (err?.name === 'AbortError') return { ok: false, abgebrochen: true };
    return { ok: false, fehler: String(err?.message || err) };
  }
}

export function ladeHerunter(inhalt, dateiname){
  const blob = new Blob([inhalt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 10000);
  return { ok: true, weg: 'download' };
}

/* Öffnet den Dateiwähler und liefert den Textinhalt. Liefert null,
   wenn nichts ausgewählt wurde – ein Abbruch ist kein Fehler. */
export function leseTextdatei(){
  return new Promise((resolve)=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    let erledigt = false;
    const fertig = (wert)=>{
      if (erledigt) return;
      erledigt = true;
      input.remove();
      resolve(wert);
    };
    input.addEventListener('change', async ()=>{
      const datei = input.files?.[0];
      if (!datei) { fertig(null); return; }
      try { fertig({ name: datei.name, inhalt: await datei.text() }); }
      catch { fertig(null); }
    });
    /* Wird der Wähler abgebrochen, feuert in manchen Browsern kein
       Ereignis. Der Aufräumer verhindert, dass unsichtbare Eingaben
       liegenbleiben; das Versprechen bleibt so lange offen, bis der
       Fokus zurückkehrt. */
    window.addEventListener('focus', ()=>{
      setTimeout(()=>{ if (!input.files?.length) fertig(null); }, 800);
    }, { once: true });
    input.click();
  });
}
