/* ============================================================
   Unterrichtsideen

   Eine Idee ist ein Satz, kein Entwurf. Deshalb gibt es hier drei
   Felder und nicht dreissig: Lerngruppe (optional), Fach (optional),
   Notiz.

   «Fotos verschiedener Freizeitangebote verteilen; Partner müssen sich
   einigen.»

   So etwas fällt einem im Bus ein, nicht am Schreibtisch. Es soll in
   zehn Sekunden erfasst sein. Erst "In Stunde umwandeln" macht daraus
   einen Entwurf – dann mit allem, was dazugehört.
   ============================================================ */

import { useState } from 'react';
import { Bestaetigung, Blatt, Feld, Flaeche, Knopf, Kopf, LeerBild, SymbolKnopf } from '../ui.jsx';
import { GruppenBlatt } from './Zuordnung.jsx';
import { gruppenBeschriftung } from '../model.js';
import { relativeZeit } from '../../../shared/datum.js';

export default function IdeasView({ ideen, profil, neuStart = false, onAnlegen, onAendern, onLoeschen, onUmwandeln }){
  /* Von der Startseite kommt man mit "+ Unterrichtsidee" direkt hierher –
     dann steht das Eingabeblatt schon offen, statt einen zweiten Tipp zu
     verlangen. */
  const [neu, setNeu] = useState(neuStart ? { note: '' } : null);
  const [bearbeitet, setBearbeitet] = useState(null);
  const [gruppeOffen, setGruppeOffen] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState(null);

  const offen = neu || bearbeitet;
  const setzeOffen = (patch)=>{
    if (neu) setNeu({ ...neu, ...patch });
    else setBearbeitet({ ...bearbeitet, ...patch });
  };

  const schliessen = ()=>{ setNeu(null); setBearbeitet(null); setGruppeOffen(false); };

  const uebernehmen = ()=>{
    if (!offen) return;
    const notiz = String(offen.note || '').trim();
    if (neu) {
      if (notiz) onAnlegen(offen);
    } else {
      onAendern(offen.id, {
        note: offen.note,
        className: offen.className,
        subjectName: offen.subjectName,
        classId: offen.classId,
        subjectId: offen.subjectId,
        groupId: offen.groupId,
      });
    }
    schliessen();
  };

  return (
    <>
      <Kopf
        titel="Ideen"
        unter={`${ideen.length} ${ideen.length === 1 ? 'Idee' : 'Ideen'}`}
        rechts={<SymbolKnopf zeichen="+" beschriftung="Neue Idee" onClick={()=>setNeu({ note: '' })} />}
      />

      <main className="inhalt">
        {!ideen.length ? (
          <LeerBild
            zeichen="💡"
            titel="Noch keine Ideen"
            text="Ein Satz genügt. Eine Stunde daraus wird später."
            aktion={<Knopf art="primaer" onClick={()=>setNeu({ note: '' })}>+ Unterrichtsidee</Knopf>}
          />
        ) : null}

        {ideen.map(idee => (
          <div key={idee.id} className="karte">
            <button
              type="button"
              style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
              onClick={()=>setBearbeitet({ ...idee })}
            >
              <span style={{ display: 'block' }}>{idee.note}</span>
              <span className="leise klein" style={{ display: 'block', marginTop: 4 }}>
                {[gruppenBeschriftung(idee), relativeZeit(idee.updatedAt)].filter(Boolean).join(' · ')}
              </span>
            </button>
            <div className="reihe" style={{ gap: 8 }}>
              <Knopf klein onClick={()=>onUmwandeln(idee)}>In Stunde umwandeln</Knopf>
              <span className="wachs" />
              <SymbolKnopf zeichen="🗑" beschriftung="Idee löschen" onClick={()=>setLoeschFrage(idee)} />
            </div>
          </div>
        ))}

        {ideen.length ? (
          <Knopf breit onClick={()=>setNeu({ note: '' })}>+ Unterrichtsidee</Knopf>
        ) : null}
      </main>

      {offen ? (
        <Blatt
          titel={neu ? 'Unterrichtsidee' : 'Idee bearbeiten'}
          onSchliessen={schliessen}
          aktionen={(
            <>
              <Knopf breit onClick={schliessen}>Abbrechen</Knopf>
              <Knopf breit art="primaer" onClick={uebernehmen}>Sichern</Knopf>
            </>
          )}
        >
          <button
            type="button"
            className="knopf knopf--breit"
            onClick={()=>setGruppeOffen(true)}
          >
            {gruppenBeschriftung(offen) || 'Lerngruppe / Fach (optional)'}
          </button>

          <Feld name="Notiz">
            <Flaeche
              wert={offen.note}
              onWert={(v)=>setzeOffen({ note: v })}
              placeholder="z. B. Fotos verschiedener Freizeitangebote verteilen; Partner müssen sich einigen."
              minZeilen={3}
              autoFocus
            />
          </Feld>

          {gruppeOffen ? (
            <GruppenBlatt
              profil={profil}
              aktuell={offen}
              onSchliessen={()=>setGruppeOffen(false)}
              onWahl={(patch)=>{ setzeOffen(patch); setGruppeOffen(false); }}
            />
          ) : null}
        </Blatt>
      ) : null}

      {loeschFrage ? (
        <Bestaetigung
          frage="Idee löschen?"
          bestaetigen="Löschen"
          gefahr
          onJa={()=>{ const i = loeschFrage; setLoeschFrage(null); onLoeschen(i); }}
          onNein={()=>setLoeschFrage(null)}
        />
      ) : null}
    </>
  );
}
