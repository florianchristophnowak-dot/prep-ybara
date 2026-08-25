/* ============================================================
   Auswahl von Kompetenzen und Sprechabsichten

   Beide funktionieren gleich, also gibt es einen Baustein: Chips zum
   Antippen, Mehrfachauswahl, und ein Weg, etwas Eigenes zu ergänzen.

   Zwei Entscheidungen:

   1. Was in Pocket frei ergänzt wird, bleibt in Pocket verfügbar. Es
      landet in den Einstellungen und steht beim nächsten Entwurf wieder
      als Chip bereit. Ohne das müsste man dieselbe eigene Kompetenz in
      jeder Stunde neu tippen.

   2. Was in Pocket entsteht, wandert NICHT ungefragt in die Bibliothek
      des Desktops. Es reist als "custom" mit; der Desktop fragt beim
      Import, ob es dauerhaft aufgenommen werden soll. Diese Entscheidung
      gehört an den grossen Bildschirm, nicht auf den Gang.

   Was in der Stunde steht, bleibt sichtbar – auch wenn es weder im
   Profil noch in den eigenen Einträgen vorkommt. Sonst könnte man es
   nicht mehr abwählen.
   ============================================================ */

import { useMemo, useState } from 'react';
import { Blatt, Chip, Eingabe, Feld, Knopf } from '../ui.jsx';
import { vergleichsSchluessel } from '../../../shared/exchange/index.js';

export default function EtikettWahl({
  katalog = [],          // [{ label, area?, areaName? }] aus dem Profil
  eigene = [],           // in Pocket ergänzte Etiketten
  gewaehlt = [],
  onGewaehlt,
  onEigeneHinzu,
  gruppiert = false,
  neuBeschriftung = '+ Eigener Eintrag',
  neuTitel = 'Neuer Eintrag',
  platzhalter = '',
  primaer = null,        // nur bei Kompetenzen: das hervorgehobene Etikett
  onPrimaer = null,
}){
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuWert, setNeuWert] = useState('');

  const gewaehltSet = useMemo(
    ()=> new Set((gewaehlt || []).map(vergleichsSchluessel)),
    [gewaehlt]
  );

  /* Der vollständige Bestand: Profil, eigene Einträge und alles, was in
     dieser Stunde bereits steht. */
  const bereiche = useMemo(()=>{
    const gesehen = new Set();
    const proBereich = new Map();
    const aufnehmen = (label, bereich, bereichName)=>{
      const key = vergleichsSchluessel(label);
      if (!key || gesehen.has(key)) return;
      gesehen.add(key);
      const id = gruppiert ? (bereich || 'custom') : 'alle';
      const name = gruppiert ? (bereichName || 'Eigene') : '';
      if (!proBereich.has(id)) proBereich.set(id, { id, name, etiketten: [] });
      proBereich.get(id).etiketten.push(label);
    };
    for (const e of katalog) aufnehmen(e.label, e.area, e.areaName);
    for (const l of eigene) aufnehmen(l, 'custom', 'Eigene');
    for (const l of (gewaehlt || [])) aufnehmen(l, 'custom', 'Eigene');
    return [...proBereich.values()];
  }, [katalog, eigene, gewaehlt, gruppiert]);

  const umschalten = (label)=>{
    const key = vergleichsSchluessel(label);
    const drin = gewaehltSet.has(key);
    const naechste = drin
      ? (gewaehlt || []).filter(l => vergleichsSchluessel(l) !== key)
      : [...(gewaehlt || []), label];
    onGewaehlt?.(naechste);
    // Wird die primäre Kompetenz abgewählt, verliert sie ihre Rolle.
    if (drin && primaer && vergleichsSchluessel(primaer) === key) onPrimaer?.('');
  };

  const uebernehmen = ()=>{
    const wert = neuWert.trim();
    setNeuOffen(false);
    setNeuWert('');
    if (!wert) return;
    onEigeneHinzu?.(wert);
    if (!gewaehltSet.has(vergleichsSchluessel(wert))) onGewaehlt?.([...(gewaehlt || []), wert]);
  };

  return (
    <div className="abschnitt">
      {bereiche.map(bereich => (
        <div key={bereich.id} className="abschnitt" style={{ gap: 6 }}>
          {gruppiert && bereich.name ? <span className="leise klein">{bereich.name}</span> : null}
          <div className="chips">
            {bereich.etiketten.map(label => {
              const key = vergleichsSchluessel(label);
              const ist = gewaehltSet.has(key);
              const istPrimaer = Boolean(primaer && vergleichsSchluessel(primaer) === key);
              return (
                <Chip
                  key={label}
                  gewaehlt={ist && !istPrimaer}
                  primaer={istPrimaer}
                  onClick={()=>umschalten(label)}
                >
                  {istPrimaer ? <span className="chipStern" aria-hidden="true">★</span> : null}
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}

      <div className="chips">
        <Chip neu onClick={()=>setNeuOffen(true)}>{neuBeschriftung}</Chip>
      </div>

      {/* Die primäre Kompetenz erscheint erst, wenn es überhaupt etwas
          auszuzeichnen gibt – und nur dort, wo sie gefragt ist. */}
      {onPrimaer && (gewaehlt || []).length ? (
        <Feld name="Primäre Kompetenz">
          <select className="auswahl" value={primaer || ''} onChange={(e)=>onPrimaer(e.target.value)}>
            <option value="">– keine –</option>
            {(gewaehlt || []).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Feld>
      ) : null}

      {neuOffen ? (
        <Blatt
          titel={neuTitel}
          onSchliessen={()=>{ setNeuOffen(false); setNeuWert(''); }}
          aktionen={(
            <>
              <Knopf breit onClick={()=>{ setNeuOffen(false); setNeuWert(''); }}>Abbrechen</Knopf>
              <Knopf breit art="primaer" onClick={uebernehmen}>Hinzufügen</Knopf>
            </>
          )}
        >
          <Feld hinweis="Bleibt in Pocket verfügbar. Ob der Eintrag dauerhaft in die Bibliothek von Prép-ybara kommt, wird beim Import gefragt.">
            <Eingabe
              wert={neuWert}
              onWert={setNeuWert}
              placeholder={platzhalter}
              autoFocus
              enterKeyHint="done"
              onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } }}
            />
          </Feld>
        </Blatt>
      ) : null}
    </div>
  );
}
