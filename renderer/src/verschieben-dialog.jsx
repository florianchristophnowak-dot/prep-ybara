/* ============================================================
   Sequenz verschieben: die Vorschau

   Der Dialog rechnet nicht selbst. Er stellt die Fragen – welcher
   Umfang, welcher neue Termin – und zeigt, was daraus folgt. Gerechnet
   wird in verschieben.js, ausgeführt erst nach ausdrücklichem Klick.

   Deshalb ist "Verschiebung ausführen" auch nur dann anwählbar, wenn
   der Vorschlag vollständig aufgeht. Ein halb passender Plan wird nicht
   angeboten, sondern erklärt.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ArrowRight, Check } from 'lucide-react';

import { formatDatum } from '../../shared/datum.js';
import {
  UMFANG, STATUS, STATUS_TEXT, planeVerschiebung, plusTage,
} from './verschieben.js';
import { balkenZuSequenz } from './jahresbalken.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

const UMFANG_TEXT = {
  [UMFANG.EINZELN]: 'Nur die ausgewählte Stunde',
  [UMFANG.AB_FOLGENDE]: 'Ausgewählte und alle folgenden Stunden',
  [UMFANG.GESAMT]: 'Die gesamte Sequenz',
};

function stundenText(slotIndex, span){
  const a = (Number(slotIndex) || 0) + 1;
  const n = Math.max(1, Number(span) || 1);
  return n <= 1 ? `${a}. Std.` : `${a}.–${a + n - 1}. Std.`;
}

function terminText(ort){
  if (!ort) return '—';
  return `${formatDatum(ort.dateISO)} · ${stundenText(ort.slotIndex, 1)}`;
}

export function VerschiebenDialog({
  offen,
  db,
  sequenceId,
  ab = null,
  startUmfang = UMFANG.GESAMT,
  startWochen = null,
  heuteISO = '',
  onAusfuehren,
  onSchliessen,
}){
  /* `Number.isFinite` bewusst OHNE Umwandlung: `Number(null)` wäre 0,
     und aus "keine Angabe" würde stillschweigend "um 0 Wochen
     verschieben" – ein Vorschlag, der nichts verschiebt. Ohne Angabe
     ist eine Woche später der sinnvolle Ausgangspunkt. */
  const vorgabeWochen = Number.isFinite(startWochen) ? Number(startWochen) : null;
  const [umfang, setUmfang] = useState(startUmfang);
  const [zielArt, setZielArt] = useState('wochen');
  const [wochen, setWochen] = useState(vorgabeWochen === null ? 1 : vorgabeWochen);
  const [datum, setDatum] = useState('');
  const [auchVergangene, setAuchVergangene] = useState(false);
  const [ueberspringen, setUeberspringen] = useState(true);
  const [balkenAnpassen, setBalkenAnpassen] = useState(true);
  const schliessenRef = useRef(null);

  const sequenz = db?.sequences?.[sequenceId] || null;
  const balken = useMemo(()=> balkenZuSequenz(db?.yearBars, sequenceId), [db?.yearBars, sequenceId]);

  useEffect(()=>{
    if (!offen) return;
    setUmfang(startUmfang);
    setZielArt('wochen');
    setWochen(vorgabeWochen === null ? 1 : vorgabeWochen);
    setDatum('');
    setAuchVergangene(false);
    setUeberspringen(true);
    setBalkenAnpassen(true);
    const t = setTimeout(()=>schliessenRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [offen, startUmfang, vorgabeWochen]);

  const plan = useMemo(()=>{
    if (!offen || !db || !sequenceId) return null;
    const ziel = zielArt === 'wochen'
      ? { wochen: Number(wochen) || 0 }
      : (datum ? { dateISO: datum } : null);
    if (!ziel) return null;
    return planeVerschiebung(db, {
      sequenceId,
      umfang,
      ab,
      ziel,
      heuteISO,
      auchVergangene,
      beiKonflikt: ueberspringen ? 'ueberspringen' : 'stoppen',
    });
  }, [offen, db, sequenceId, umfang, ab, zielArt, wochen, datum, heuteISO, auchVergangene, ueberspringen]);

  if (!offen) return null;

  const zeilen = plan?.zeilen || [];
  const verschiebbar = plan?.bewegungen?.length || 0;

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div
        className="modal verschiebenModal"
        role="dialog"
        aria-modal="true"
        aria-label="Sequenz verschieben"
        onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="dialogTitle" style={{ margin: 0 }}>
              <CalendarClock {...ICON} /> Sequenz verschieben
            </h3>
            <div className="muted small">
              {sequenz?.name || 'Sequenz'}
              {plan?.gruppe && (plan.gruppe.classGroup || plan.gruppe.subject)
                ? ` · ${[plan.gruppe.classGroup, plan.gruppe.subject].filter(Boolean).join(' · ')}`
                : ''}
            </div>
          </div>
          <button ref={schliessenRef} type="button" className="btn" onClick={onSchliessen}>Schließen</button>
        </div>

        <div style={{ height: 12 }} />

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Umfang</legend>
          <div className="row wrap" style={{ gap: 12 }}>
            {[UMFANG.EINZELN, UMFANG.AB_FOLGENDE, UMFANG.GESAMT].map((wert)=>(
              <label key={wert} className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input
                  type="radio"
                  name="verschiebenUmfang"
                  value={wert}
                  checked={umfang === wert}
                  disabled={!ab && wert !== UMFANG.GESAMT}
                  onChange={()=>setUmfang(wert)}
                />
                <span className={(!ab && wert !== UMFANG.GESAMT) ? 'muted' : ''}>{UMFANG_TEXT[wert]}</span>
              </label>
            ))}
          </div>
          {!ab ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Ohne ausgewählte Stunde lässt sich nur die gesamte Sequenz verschieben.
            </div>
          ) : null}
        </fieldset>

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Neuer Termin</legend>
          <div className="row wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
            <label className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input type="radio" name="verschiebenZiel" checked={zielArt === 'wochen'} onChange={()=>setZielArt('wochen')} />
              <span>Um Wochen verschieben</span>
            </label>
            <div style={{ width: 120 }}>
              <label className="small muted" htmlFor="verschiebenWochen">Wochen</label>
              <input
                id="verschiebenWochen"
                className="input"
                type="number"
                step={1}
                value={wochen}
                disabled={zielArt !== 'wochen'}
                onChange={(e)=>setWochen(Number(e.target.value))}
              />
            </div>
            <label className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input type="radio" name="verschiebenZiel" checked={zielArt === 'datum'} onChange={()=>setZielArt('datum')} />
              <span>Ab Datum</span>
            </label>
            <div style={{ width: 190 }}>
              <label className="small muted" htmlFor="verschiebenDatum">Neuer Starttermin</label>
              <input
                id="verschiebenDatum"
                className="input"
                type="date"
                value={datum}
                disabled={zielArt !== 'datum'}
                onChange={(e)=>setDatum(e.target.value)}
              />
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Gesucht wird ab diesem Tag der nächste passende Stundenplanplatz der Lerngruppe.
            Ferien, schulfreie Tage und belegte Termine werden dabei übersprungen.
          </div>
        </fieldset>

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Regeln</legend>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={ueberspringen} onChange={(e)=>setUeberspringen(e.target.checked)} />
            <span>Belegte Termine überspringen statt abzubrechen</span>
          </label>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={auchVergangene} onChange={(e)=>setAuchVergangene(e.target.checked)} />
            <span>Auch vergangene und bereits nachbereitete Stunden verschieben</span>
          </label>
          {balken.length ? (
            <label className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={balkenAnpassen} onChange={(e)=>setBalkenAnpassen(e.target.checked)} />
              <span>
                {balken.length === 1 ? 'Verknüpften Jahresbalken' : `${balken.length} verknüpfte Jahresbalken`} an den neuen Zeitraum anpassen
              </span>
            </label>
          ) : null}
        </fieldset>

        {!plan ? (
          <p className="muted">Bitte einen neuen Termin wählen.</p>
        ) : (
          <>
            {plan.fehler?.length ? (
              <ul className="verschiebenFehler">
                {plan.fehler.map((f, i)=> <li key={i}>{f.text}</li>)}
              </ul>
            ) : null}

            {zeilen.length ? (
              <div className="verschiebenVorschau">
                <table className="verlaufTabelle">
                  <thead>
                    <tr>
                      <th scope="col">Bisher</th>
                      <th scope="col">Neu</th>
                      <th scope="col">Klasse/Fach</th>
                      <th scope="col">Thema</th>
                      <th scope="col">Dauer</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeilen.map((z)=>(
                      <tr key={z.id}>
                        <td>{terminText(z.von)} <span className="muted small">({stundenText(z.von.slotIndex, z.span)})</span></td>
                        <td>
                          {z.nach ? (
                            <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                              <ArrowRight {...ICON_SM} />
                              {formatDatum(z.nach.dateISO)} · {stundenText(z.nach.slotIndex, z.span)}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td>{[z.classGroup, z.subject].filter(Boolean).join(' · ') || <span className="muted">—</span>}</td>
                        <td>{z.thema || <span className="muted">ohne Thema</span>}</td>
                        <td>{z.dauer}</td>
                        <td>
                          <div>{STATUS_TEXT[z.status] || z.status}</div>
                          {z.hinweise?.length ? (
                            <div className="muted small">{z.hinweise.join(' · ')}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="muted small">
              {verschiebbar
                ? `${verschiebbar} ${verschiebbar === 1 ? 'Stunde wird verschoben' : 'Stunden werden verschoben'}.`
                : 'Es wird nichts verschoben.'}
              {plan.uebersprungeneFerien ? ` ${plan.uebersprungeneFerien} freie Tage übersprungen.` : ''}
              {plan.uebersprungeneBelegt ? ` ${plan.uebersprungeneBelegt} belegte Termine übersprungen.` : ''}
            </div>
          </>
        )}

        <div className="dialogActions">
          <button type="button" className="btn" onClick={onSchliessen}>Abbrechen</button>
          <button
            type="button"
            className="btn primary"
            disabled={!plan?.ok}
            title={plan?.ok
              ? 'Die geprüfte Verschiebung ausführen'
              : 'Erst wenn der Vorschlag vollständig aufgeht, lässt er sich ausführen.'}
            onClick={()=>onAusfuehren?.({ plan, balkenAnpassen: balkenAnpassen && balken.length > 0 })}
          ><Check {...ICON_SM} /> Verschiebung ausführen</button>
        </div>
      </div>
    </div>
  );
}

export default VerschiebenDialog;

/* Nur der Vollständigkeit halber nach aussen gereicht: die Statuswerte
   werden auch von der aufrufenden Ansicht für Meldungen gebraucht. */
export { STATUS, UMFANG, plusTage };
