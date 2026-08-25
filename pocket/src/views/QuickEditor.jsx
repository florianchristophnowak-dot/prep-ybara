/* ============================================================
   Schnellplanung

   Drei Fragen und eine Notiz. Mehr nicht.

   Der Zweck ist ausdrücklich nicht Vollständigkeit, sondern
   Geschwindigkeit: In der Pause zwischen zwei Stunden soll eine
   brauchbare Stundenidee entstehen, die am PC nicht noch einmal von
   vorne begonnen werden muss.

   Technisch ist das kein eigenes Datenmodell, sondern dieselbe Stunde
   mit einem anderen Fenster davor. Deshalb genügt ein Knopf, um sie in
   der Detailplanung weiterzuführen – es wird nichts umgewandelt und
   nichts kopiert.
   ============================================================ */

import { Flaeche, Feld, Knopf, Kopf, SymbolKnopf, ZurueckKnopf } from '../ui.jsx';
import Zuordnung from './Zuordnung.jsx';
import PhaseListe from './PhaseListe.jsx';
import { ART_STUNDE } from '../model.js';

export default function QuickEditor({
  entwurf, profil, onAendern, onZurueck, onExport, onMehr, onDetail,
}){
  const ziel = (entwurf.learningGoals || [''])[0] || '';
  const aufgabe = entwurf.communicativeTask || {};

  return (
    <>
      <Kopf
        titel="Schnellplanung"
        unter={[entwurf.className, entwurf.subjectName].filter(Boolean).join(' ')}
        links={<ZurueckKnopf onClick={onZurueck} />}
        rechts={<SymbolKnopf zeichen="⋯" beschriftung="Weitere Aktionen" onClick={onMehr} />}
      />

      <main className="inhalt">
        <Zuordnung entwurf={entwurf} profil={profil} onAendern={onAendern} />

        <Feld name="Was sollen die Lernenden am Ende können?">
          <Flaeche
            wert={ziel}
            onWert={(v)=>onAendern({ learningGoals: [v, ...(entwurf.learningGoals || []).slice(1)] })}
            placeholder="Die Lernenden können …"
            minZeilen={2}
          />
        </Feld>

        <Feld name="Was tun sie dafür?">
          <Flaeche
            wert={aufgabe.text || ''}
            onWert={(v)=>onAendern({ communicativeTask: { ...aufgabe, text: v } })}
            placeholder="z. B. gemeinsam ein Wochenendprogramm planen"
            minZeilen={2}
          />
        </Feld>

        <div className="abschnitt">
          <span className="feldName">Wie läuft die Stunde ab?</span>
          <PhaseListe
            phasen={entwurf.phases || []}
            onPhasen={(v)=>onAendern({ phases: v })}
            phasenTypen={profil?.phaseTypes || []}
            sozialformen={profil?.socialForms || []}
          />
        </div>

        <Feld name="Notiz">
          <Flaeche
            wert={entwurf.notes}
            onWert={(v)=>onAendern({ notes: v })}
            placeholder="optional"
            minZeilen={1}
          />
        </Feld>

        <Knopf breit onClick={()=>{ onAendern({ kind: ART_STUNDE }); onDetail(); }}>
          In der Detailplanung öffnen
        </Knopf>

        <div className="aktionsLeiste">
          <Knopf breit art="primaer" onClick={onExport}>Für Prép-ybara exportieren</Knopf>
        </div>
      </main>
    </>
  );
}
