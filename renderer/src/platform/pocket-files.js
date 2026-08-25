/* ============================================================
   Pocket-Dateien im Browser

   Bewusst OHNE File System Access API, obwohl der Rest der Browser-
   Fassung sie benutzt. Grund ist eine harte Grenze der Schnittstelle:
   Dateiendungen dürfen dort höchstens 16 Zeichen lang sein.
   ".prepybara-profile" und ".prepybara-lesson" sind länger – der
   Dateiwähler würde die Angabe zurückweisen.

   Der schlichte Weg – Download zum Speichern, verstecktes
   Dateifeld zum Einlesen – kennt diese Grenze nicht und funktioniert in
   jedem Browser gleich.

   Beim Einlesen wird ausserdem kein `accept` gesetzt: Endungen ohne
   bekannten MIME-Typ führen sonst dazu, dass genau die gesuchte Datei
   ausgegraut ist. Geprüft wird der Inhalt – das muss ohnehin sein.
   ============================================================ */

export function speichereText(inhalt, dateiname){
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
  return dateiname;
}

export function waehleTextdatei(){
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
      try { fertig({ name: datei.name, content: await datei.text() }); }
      catch { fertig(null); }
    });
    // Abbruch meldet in vielen Browsern kein Ereignis; der Rückkehr des
    // Fokus folgt deshalb ein Aufräumen.
    window.addEventListener('focus', ()=>{
      setTimeout(()=>{ if (!input.files?.length) fertig(null); }, 800);
    }, { once: true });
    input.click();
  });
}
