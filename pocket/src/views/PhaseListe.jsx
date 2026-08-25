/* ============================================================
   Phasen als senkrechte Karten

   Der zentrale mobile Bereich – und die Stelle, an der Pocket sich am
   deutlichsten von der Desktop-App unterscheidet. Dort ist die
   Phasenplanung eine Tabelle mit Zeitstrahl; hier ist sie eine Liste
   von Karten, die man mit dem Daumen durchgeht.

   Eine Karte zeigt zugeklappt genau das, was man beim Überfliegen
   braucht: Nummer, Titel, Dauer, die erste Zeile des Ablaufs,
   Sozialform und Material. Aufgeklappt wird sie bearbeitet.

   Verschoben wird mit ↑ und ↓. Berührungs-Drag wäre die elegantere
   Geste und ist deshalb als Möglichkeit offen – aber Knöpfe treffen
   auch mit kalten Fingern im Treppenhaus, und sie funktionieren mit
   Screenreader und Tastatur unverändert.
   ============================================================ */

import { useState } from 'react';
import { Chip, Feld, Eingabe, Flaeche, Knopf, SymbolKnopf, Klapp } from '../ui.jsx';
import {
  leerePhase, leererScaffold, phaseAendern, phaseKopieren, phaseVerschieben, phaseWeg, dauerSumme,
} from '../model.js';

const DAUER_SCHRITT = 5;
const SCAFFOLD_ARTEN = [
  { id: 'linguistic', name: 'Sprachlich' },
  { id: 'content', name: 'Inhaltlich' },
  { id: 'strategic', name: 'Strategisch' },
  { id: 'organizational', name: 'Organisatorisch' },
  { id: 'other', name: 'Sonstiges' },
];

function ersteZeile(text){
  const s = String(text || '').trim();
  if (!s) return '';
  const zeile = s.split('\n')[0];
  return zeile.length > 90 ? `${zeile.slice(0, 88)}…` : zeile;
}

function PhasenKarte({
  phase, nummer, offen, onOffen, onAendern, onWeg, onKopieren, onHoch, onRunter,
  ersteMoeglich, letzteMoeglich, phasenTypen, sozialformen, hilfenVorschlaege, zeigeHilfen,
}){
  const setze = (patch)=> onAendern(patch);

  return (
    <article className="phase">
      <button
        type="button"
        className="phaseKopf"
        style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={onOffen}
        aria-expanded={offen}
      >
        <span className="phaseNummer" aria-hidden="true">{nummer}</span>
        <span className="wachs">
          <span className="phaseTitel">{phase.title || 'Phase'}</span>
          {!offen && ersteZeile(phase.content) ? (
            <span className="karteZeile" style={{ display: 'block' }}>{ersteZeile(phase.content)}</span>
          ) : null}
          {!offen && (phase.socialForm || phase.material) ? (
            <span className="leise klein" style={{ display: 'block' }}>
              {[phase.socialForm, phase.material].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </span>
        <span className="phaseDauer">{phase.duration} min</span>
      </button>

      {offen ? (
        <>
          <div className="phaseKoerper">
            <Feld name="Titel / Phasentyp">
              <Eingabe
                wert={phase.title}
                onWert={(v)=>setze({ title: v })}
                placeholder="z. B. Erarbeitung"
                list="phasentypen"
                enterKeyHint="done"
              />
            </Feld>
            {phasenTypen.length ? (
              <div className="chips">
                {phasenTypen.slice(0, 6).map(t => (
                  <Chip key={t} gewaehlt={phase.title === t} onClick={()=>setze({ title: t })}>{t}</Chip>
                ))}
              </div>
            ) : null}

            <Feld name="Dauer">
              <div className="dauerReihe">
                <SymbolKnopf
                  zeichen="−"
                  beschriftung="Dauer verringern"
                  onClick={()=>setze({ duration: Math.max(1, (Number(phase.duration) || 0) - DAUER_SCHRITT) })}
                />
                <span className="dauerWert">{phase.duration} min</span>
                <SymbolKnopf
                  zeichen="+"
                  beschriftung="Dauer erhöhen"
                  onClick={()=>setze({ duration: (Number(phase.duration) || 0) + DAUER_SCHRITT })}
                />
              </div>
            </Feld>

            <Feld name="Inhalt / Ablauf">
              <Flaeche
                wert={phase.content}
                onWert={(v)=>setze({ content: v })}
                placeholder="Was passiert in dieser Phase?"
                minZeilen={2}
              />
            </Feld>

            <Feld name="Sozialform">
              <Eingabe
                wert={phase.socialForm}
                onWert={(v)=>setze({ socialForm: v })}
                placeholder="z. B. Partnerarbeit"
                list="sozialformen"
              />
            </Feld>
            {sozialformen.length ? (
              <div className="chips">
                {sozialformen.slice(0, 6).map(s => (
                  <Chip key={s} gewaehlt={phase.socialForm === s} onClick={()=>setze({ socialForm: s })}>{s}</Chip>
                ))}
              </div>
            ) : null}

            <Feld name="Material" hinweis="Nur eine Notiz – Dateien bleiben am PC.">
              <Eingabe
                wert={phase.material}
                onWert={(v)=>setze({ material: v })}
                placeholder="z. B. Buch S. 53"
              />
            </Feld>
          </div>

          <div style={{ padding: '0 14px 12px' }}>
            <Klapp titel="Bemerkung, Link, Hilfen" zahl={(phase.scaffolds || []).length}>
              <Feld name="Bemerkung">
                <Flaeche
                  wert={phase.remarks}
                  onWert={(v)=>setze({ remarks: v })}
                  placeholder="z. B. Differenzierung, Hinweis"
                />
              </Feld>
              <Feld name="Link (optional)">
                <Eingabe
                  wert={phase.materialLink}
                  onWert={(v)=>setze({ materialLink: v })}
                  placeholder="https://…"
                  type="url"
                  inputMode="url"
                />
              </Feld>

              {zeigeHilfen ? (
                <div className="abschnitt">
                  <span className="feldName">Scaffolds / Hilfen</span>
                  {(phase.scaffolds || []).map((sc)=>(
                    <div key={sc.id} className="karte karte--flach">
                      <Eingabe
                        wert={sc.label}
                        onWert={(v)=>setze({
                          scaffolds: (phase.scaffolds || []).map(x => x.id === sc.id ? { ...x, label: v } : x),
                        })}
                        placeholder="z. B. Redemittel"
                        list="hilfen"
                      />
                      <div className="reihe">
                        <select
                          className="auswahl"
                          value={sc.type}
                          onChange={(e)=>setze({
                            scaffolds: (phase.scaffolds || []).map(x => x.id === sc.id ? { ...x, type: e.target.value } : x),
                          })}
                        >
                          {SCAFFOLD_ARTEN.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <SymbolKnopf
                          zeichen="🗑"
                          beschriftung="Hilfe löschen"
                          onClick={()=>setze({ scaffolds: (phase.scaffolds || []).filter(x => x.id !== sc.id) })}
                        />
                      </div>
                      <Flaeche
                        wert={sc.note}
                        onWert={(v)=>setze({
                          scaffolds: (phase.scaffolds || []).map(x => x.id === sc.id ? { ...x, note: v } : x),
                        })}
                        placeholder="Notiz (optional)"
                        minZeilen={1}
                      />
                    </div>
                  ))}
                  <Knopf
                    klein
                    onClick={()=>setze({ scaffolds: [...(phase.scaffolds || []), leererScaffold()] })}
                  >+ Hilfe</Knopf>
                  {hilfenVorschlaege.length ? (
                    <div className="chips">
                      {hilfenVorschlaege.slice(0, 6).map(h => (
                        <Chip
                          key={h}
                          neu
                          onClick={()=>setze({ scaffolds: [...(phase.scaffolds || []), leererScaffold({ label: h })] })}
                        >+ {h}</Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Klapp>
          </div>

          <div className="phaseWerkzeuge">
            <SymbolKnopf zeichen="↑" beschriftung="Phase nach oben" disabled={ersteMoeglich} onClick={onHoch} />
            <SymbolKnopf zeichen="↓" beschriftung="Phase nach unten" disabled={letzteMoeglich} onClick={onRunter} />
            <SymbolKnopf zeichen="⧉" beschriftung="Phase duplizieren" onClick={onKopieren} />
            <span className="wachs" />
            <SymbolKnopf zeichen="🗑" beschriftung="Phase löschen" onClick={onWeg} />
          </div>
        </>
      ) : null}
    </article>
  );
}

export default function PhaseListe({
  phasen = [], onPhasen, phasenTypen = [], sozialformen = [], hilfenVorschlaege = [], zeigeHilfen = false,
}){
  const [offeneId, setOffeneId] = useState(null);

  const hinzu = ()=>{
    const neue = leerePhase({ title: phasenTypen[0] && phasen.length === 0 ? phasenTypen[0] : '' });
    onPhasen([...(phasen || []), neue]);
    setOffeneId(neue.id);
  };

  return (
    <div className="abschnitt">
      {/* Vorschlagslisten einmal je Ansicht, nicht je Phase. */}
      <datalist id="phasentypen">{phasenTypen.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id="sozialformen">{sozialformen.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="hilfen">{hilfenVorschlaege.map(h => <option key={h} value={h} />)}</datalist>

      {(phasen || []).map((phase, index)=>(
        <PhasenKarte
          key={phase.id}
          phase={phase}
          nummer={index + 1}
          offen={offeneId === phase.id}
          onOffen={()=>setOffeneId(offeneId === phase.id ? null : phase.id)}
          onAendern={(patch)=>onPhasen(phaseAendern(phasen, phase.id, patch))}
          onWeg={()=>{ onPhasen(phaseWeg(phasen, phase.id)); setOffeneId(null); }}
          onKopieren={()=>onPhasen(phaseKopieren(phasen, phase.id))}
          onHoch={()=>onPhasen(phaseVerschieben(phasen, phase.id, -1))}
          onRunter={()=>onPhasen(phaseVerschieben(phasen, phase.id, 1))}
          ersteMoeglich={index === 0}
          letzteMoeglich={index === phasen.length - 1}
          phasenTypen={phasenTypen}
          sozialformen={sozialformen}
          hilfenVorschlaege={hilfenVorschlaege}
          zeigeHilfen={zeigeHilfen}
        />
      ))}

      <div className="reihe">
        <Knopf breit onClick={hinzu}>+ Phase</Knopf>
        {phasen.length ? <span className="leise klein" style={{ whiteSpace: 'nowrap' }}>{dauerSumme(phasen)} min</span> : null}
      </div>
    </div>
  );
}
