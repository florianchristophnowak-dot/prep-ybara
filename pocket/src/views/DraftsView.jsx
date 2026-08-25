/* ============================================================
   Entwurfsverwaltung

   Alle lokalen Entwürfe, das zuletzt Bearbeitete zuerst. Je Entwurf
   vier Handlungen: öffnen, duplizieren, exportieren, löschen.

   Der Mehrfachexport ist ein eigener Zustand der Liste und kein zweiter
   Bildschirm: Auswahlkästchen erscheinen, unten steht "n Stunden
   exportieren". So bleibt der Weg kurz, wenn man am Freitag drei
   Stunden auf einmal an den PC schicken will.

   "Zuletzt exportiert" steht dezent unter dem Entwurf. Es ist eine
   Auskunft, keine Erledigung: der Entwurf bleibt liegen und lässt sich
   weiter bearbeiten und erneut ausgeben.
   ============================================================ */

import { useState } from 'react';
import { Bestaetigung, Blatt, Knopf, Kopf, LeerBild, SymbolKnopf } from '../ui.jsx';
import { entwurfTitel, gruppenBeschriftung, entwurfDauer } from '../model.js';
import { relativeZeit } from '../../../shared/datum.js';

export default function DraftsView({
  entwuerfe, onOeffnen, onDuplizieren, onExport, onMehrfachExport, onLoeschen,
}){
  const [auswahlModus, setAuswahlModus] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(()=> new Set());
  const [menue, setMenue] = useState(null);
  const [loeschFrage, setLoeschFrage] = useState(null);

  const umschalten = (id)=>{
    setGewaehlt((prev)=>{
      const naechste = new Set(prev);
      if (naechste.has(id)) naechste.delete(id); else naechste.add(id);
      return naechste;
    });
  };

  const beenden = ()=>{ setAuswahlModus(false); setGewaehlt(new Set()); };

  return (
    <>
      <Kopf
        titel="Entwürfe"
        unter={`${entwuerfe.length} ${entwuerfe.length === 1 ? 'Entwurf' : 'Entwürfe'}`}
        rechts={entwuerfe.length ? (
          <SymbolKnopf
            zeichen={auswahlModus ? '✕' : '☑'}
            beschriftung={auswahlModus ? 'Auswahl beenden' : 'Mehrere auswählen'}
            onClick={()=> auswahlModus ? beenden() : setAuswahlModus(true)}
          />
        ) : null}
      />

      <main className="inhalt">
        {!entwuerfe.length ? (
          <LeerBild zeichen="🗒️" titel="Keine Entwürfe" text="Was hier entsteht, bleibt auf diesem Gerät." />
        ) : null}

        {entwuerfe.map(entwurf => (
          auswahlModus ? (
            <label key={entwurf.id} className="wahlZeile">
              <input
                type="checkbox"
                checked={gewaehlt.has(entwurf.id)}
                onChange={()=>umschalten(entwurf.id)}
              />
              <span className="wachs">
                <span className="karteTitel">{entwurfTitel(entwurf)}</span>
                <span className="leise klein" style={{ display: 'block' }}>
                  {[gruppenBeschriftung(entwurf), relativeZeit(entwurf.updatedAt)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          ) : (
            <div key={entwurf.id} className="reihe" style={{ gap: 8 }}>
              <button type="button" className="karteKnopf wachs" onClick={()=>onOeffnen(entwurf)}>
                <span className="karteTitel">{entwurfTitel(entwurf)}</span>
                <span className="leise klein">
                  {[
                    gruppenBeschriftung(entwurf),
                    relativeZeit(entwurf.updatedAt),
                    (entwurf.phases || []).length ? `${(entwurf.phases || []).length} Phasen · ${entwurfDauer(entwurf)} min` : '',
                  ].filter(Boolean).join(' · ')}
                </span>
                {entwurf.exportedAt ? (
                  <span className="leise klein">Exportiert {relativeZeit(entwurf.exportedAt)}</span>
                ) : null}
              </button>
              <SymbolKnopf zeichen="⋯" beschriftung="Aktionen" onClick={()=>setMenue(entwurf)} />
            </div>
          )
        ))}

        {auswahlModus ? (
          <div className="aktionsLeiste">
            <Knopf
              breit
              art="primaer"
              disabled={!gewaehlt.size}
              onClick={()=>{ onMehrfachExport([...gewaehlt]); beenden(); }}
            >
              {gewaehlt.size ? `${gewaehlt.size} ${gewaehlt.size === 1 ? 'Stunde' : 'Stunden'} exportieren` : 'Nichts ausgewählt'}
            </Knopf>
          </div>
        ) : null}
      </main>

      {menue ? (
        <Blatt titel={entwurfTitel(menue)} onSchliessen={()=>setMenue(null)}>
          <Knopf breit onClick={()=>{ const e = menue; setMenue(null); onOeffnen(e); }}>Öffnen</Knopf>
          <Knopf breit onClick={()=>{ const e = menue; setMenue(null); onExport(e); }}>Für Prép-ybara exportieren</Knopf>
          <Knopf breit onClick={()=>{ const e = menue; setMenue(null); onDuplizieren(e); }}>Duplizieren</Knopf>
          <Knopf breit art="gefahr" onClick={()=>{ const e = menue; setMenue(null); setLoeschFrage(e); }}>Löschen</Knopf>
        </Blatt>
      ) : null}

      {loeschFrage ? (
        <Bestaetigung
          frage="Entwurf löschen?"
          text={`„${entwurfTitel(loeschFrage)}“ wird von diesem Gerät entfernt. Bereits exportierte Dateien bleiben erhalten.`}
          bestaetigen="Löschen"
          gefahr
          onJa={()=>{ const e = loeschFrage; setLoeschFrage(null); onLoeschen(e); }}
          onNein={()=>setLoeschFrage(null)}
        />
      ) : null}
    </>
  );
}
