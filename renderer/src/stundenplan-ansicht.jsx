/* ============================================================
   Unterrichtszeiten: die Oberfläche

   Die Verwaltung sieht aus wie das Wochenraster – das ist Absicht: Eine
   Wochenvorlage IST eine Woche, nur ohne Inhalt. Damit sie trotzdem
   nicht mit einer echten Unterrichtswoche verwechselt wird, trägt sie
   durchgehend ihre Beschriftung („Vorlage · A-Woche") und eine eigene
   Kante.

   Vier Bausteine:

     - die Übersicht der Stundenplanmodelle und freien Vorlagen,
     - der Vorlageneditor (Raster + ein Formular je Eintrag),
     - der Assistent zum Anlegen (gleichbleibend oder A/B),
     - der Anwenden-Dialog mit Vorschau.

   Gerechnet wird nirgends hier – das steht in stundenplan.js.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock, CalendarRange, Check, ChevronRight, Copy, Pencil, Plus,
  ArrowRightLeft, Trash2, Archive, Play, X,
} from 'lucide-react';

import { formatDatum } from '../../shared/datum.js';
import {
  MODELL_TYP, RHYTHMUS, RHYTHMUS_TEXT, ZEILEN_STATUS, ZEILEN_TEXT,
  normalisiereStundenplanVorlage, normalisiereStundenplanModell,
  leerenVorlagenEintrag, zyklusLabel, zyklusLaenge, istWechselModell,
  rhythmusVorschau, anwendungsVorschau, montagVon, plusWochen, kalenderwoche,
  modellVollstaendig, wochenVorschau, ueberschneidendeModelle,
} from './stundenplan.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

function eintragText(e){
  return [e.classGroup, e.subject].filter(Boolean).join(' · ') || 'ohne Angabe';
}

function stundenText(slotIndex, span = 1){
  const a = (Number(slotIndex) || 0) + 1;
  const n = Math.max(1, Number(span) || 1);
  return n <= 1 ? `${a}. Stunde` : `${a}.–${a + n - 1}. Stunde`;
}

/* ============================================================
   Vorlageneditor

   Dasselbe Raster wie die Wochenansicht, nur ohne Inhalt: Ein Klick auf
   einen Platz legt einen Eintrag an oder öffnet ihn.
   ============================================================ */
export function VorlagenEditor({
  vorlage,
  titel = '',
  slots = 6,
  komponenten = {},
  onChange,
  onSchliessen,
  readOnly = false,
}){
  const [offenerEintrag, setOffenerEintrag] = useState(null);   // { id } oder { dayIndex, slotIndex }
  const KlasseEingabe = komponenten.ClassGroupInput;
  const FachEingabe = komponenten.SubjectInput;

  const eintraege = Array.isArray(vorlage?.eintraege) ? vorlage.eintraege : [];
  const anzahlSlots = Math.max(slots, vorlage?.slotsPerDay || slots);

  const eintragAn = (dayIndex, slotIndex)=> eintraege.find(e => e.dayIndex === dayIndex && e.slotIndex === slotIndex) || null;
  const abgedeckt = (dayIndex, slotIndex)=> eintraege.some(e => e.dayIndex === dayIndex
    && e.slotIndex < slotIndex && e.slotIndex + Math.max(1, e.blockSpan) > slotIndex);

  const setzeEintrag = (naechster)=>{
    const rest = eintraege.filter(e => e.id !== naechster.id);
    onChange?.({ ...vorlage, eintraege: [...rest, naechster].sort((a, b)=> a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex) });
  };
  const entferneEintrag = (id)=>{
    onChange?.({ ...vorlage, eintraege: eintraege.filter(e => e.id !== id) });
    setOffenerEintrag(null);
  };

  const offen = offenerEintrag
    ? (eintraege.find(e => e.id === offenerEintrag.id) || offenerEintrag.entwurf || null)
    : null;

  return (
    <div className="vorlagenEditor">
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>
            {titel || vorlage?.name || 'Wochenvorlage'}
            <span className="badge vorlagenBadge" style={{ marginLeft: 8 }}>Vorlage</span>
          </div>
          <div className="muted small">
            Nur Unterrichtszeiten und organisatorische Angaben – keine Themen, Phasen oder Materialien.
          </div>
        </div>
        {onSchliessen ? <button className="btn" onClick={onSchliessen}>Fertig</button> : null}
      </div>

      <div style={{ height: 10 }} />

      <div className="vorlagenRaster" role="table" aria-label={`Wochenvorlage ${vorlage?.name || ''}`}>
        <div className="vorlagenKopf" role="row">
          <div className="vorlagenEcke" role="columnheader" />
          {TAGE.map(t => <div key={t} className="vorlagenTag" role="columnheader">{t}</div>)}
        </div>
        {Array.from({ length: anzahlSlots }).map((_, slotIndex)=>(
          <div className="vorlagenZeile" role="row" key={slotIndex}>
            <div className="vorlagenStunde" role="rowheader">{slotIndex + 1}.</div>
            {TAGE.map((tag, dayIndex)=>{
              const e = eintragAn(dayIndex, slotIndex);
              if (!e && abgedeckt(dayIndex, slotIndex)) {
                return <div key={dayIndex} className="vorlagenPlatz vorlagenPlatz--abgedeckt" role="cell" aria-hidden="true" />;
              }
              return (
                <button
                  key={dayIndex}
                  type="button"
                  role="cell"
                  className={`vorlagenPlatz${e ? ' is-belegt' : ''}${offenerEintrag && e && offenerEintrag.id === e.id ? ' is-offen' : ''}`}
                  disabled={readOnly}
                  aria-label={e
                    ? `${tag}, ${stundenText(slotIndex, e.blockSpan)}: ${eintragText(e)} bearbeiten`
                    : `${tag}, ${stundenText(slotIndex)}: Unterrichtszeit hinzufügen`}
                  onClick={()=>{
                    if (readOnly) return;
                    if (e) { setOffenerEintrag({ id: e.id }); return; }
                    const entwurf = leerenVorlagenEintrag({ dayIndex, slotIndex });
                    setOffenerEintrag({ id: entwurf.id, entwurf });
                  }}
                >
                  {e ? (
                    <>
                      <span className="vorlagenPlatzGruppe">{e.classGroup || '—'}</span>
                      <span className="vorlagenPlatzFach">{e.subject}</span>
                      {e.room ? <span className="muted small">{e.room}</span> : null}
                      {e.blockSpan > 1 ? <span className="badge">Doppelstunde</span> : null}
                    </>
                  ) : (
                    <span className="vorlagenPlatzLeer" aria-hidden="true"><Plus {...ICON_SM} /></span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {offen && !readOnly ? (
        <div className="vorlagenFormular" role="group" aria-label="Eintrag bearbeiten">
          <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
            <div className="muted small" style={{ minWidth: 120 }}>
              {TAGE[offen.dayIndex]} · {stundenText(offen.slotIndex, offen.blockSpan)}
            </div>
            <div className="grow" style={{ minWidth: 160 }}>
              <label className="small muted" htmlFor="vorlageKlasse">Klasse/Kurs</label>
              {KlasseEingabe ? (
                <KlasseEingabe
                  value={offen.classGroup}
                  suggestions={komponenten.classGroupSuggestions || []}
                  onChange={(v)=>setzeEintrag({ ...offen, classGroup: v })}
                  onCommit={()=>{}}
                  onHideSuggestion={()=>{}}
                />
              ) : (
                <input id="vorlageKlasse" className="input" value={offen.classGroup}
                       onChange={(e)=>setzeEintrag({ ...offen, classGroup: e.target.value })} />
              )}
            </div>
            <div className="grow" style={{ minWidth: 160 }}>
              <label className="small muted" htmlFor="vorlageFach">Fach</label>
              {FachEingabe ? (
                <FachEingabe
                  value={offen.subject}
                  suggestions={komponenten.subjectSuggestions || []}
                  onChange={(v)=>setzeEintrag({ ...offen, subject: v })}
                  onCommit={()=>{}}
                  onHideSuggestion={()=>{}}
                />
              ) : (
                <input id="vorlageFach" className="input" value={offen.subject}
                       onChange={(e)=>setzeEintrag({ ...offen, subject: e.target.value })} />
              )}
            </div>
            <div style={{ width: 130 }}>
              <label className="small muted" htmlFor="vorlageRaum">Raum</label>
              <input id="vorlageRaum" className="input" value={offen.room} placeholder="optional"
                     onChange={(e)=>setzeEintrag({ ...offen, room: e.target.value })} />
            </div>
            <div style={{ width: 150 }}>
              <label className="small muted" htmlFor="vorlageDauer">Dauer</label>
              <select id="vorlageDauer" className="input" value={offen.blockSpan}
                      onChange={(e)=>setzeEintrag({ ...offen, blockSpan: Number(e.target.value) })}>
                <option value={1}>Einzelstunde</option>
                <option value={2}>Doppelstunde</option>
                <option value={3}>Dreifachstunde</option>
              </select>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" onClick={()=>setOffenerEintrag(null)}>Schließen</button>
              <button className="btn danger" onClick={()=>entferneEintrag(offen.id)}
                      title="Diesen Eintrag aus der Vorlage entfernen">
                <Trash2 {...ICON_SM} /> Entfernen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="muted small" style={{ marginTop: 8 }}>
        {eintraege.length === 0
          ? 'Noch keine Unterrichtszeiten. Klicke auf einen Platz im Raster.'
          : `${eintraege.length} ${eintraege.length === 1 ? 'Unterrichtszeit' : 'Unterrichtszeiten'} in dieser Vorlage.`}
      </div>
    </div>
  );
}

/* ============================================================
   Woche als Vorlage speichern

   Mit Vorschau und Abwahl: Vertretungsstunden, Klassenarbeiten und
   andere einmalige Termine sollen nicht in den Stundenplan geraten.
   ============================================================ */
export function WocheAlsVorlageDialog({
  offen, woche, weekStartISO, modelle = [], vorlagen = {},
  onSpeichern, onSchliessen,
}){
  const zeilen = useMemo(()=> (offen ? wochenVorschau(woche) : []), [offen, woche]);
  const [abgewaehlt, setAbgewaehlt] = useState(()=> new Set());
  const [name, setName] = useState('');
  const [ziel, setZiel] = useState('frei');        // frei | A | B
  const [modellId, setModellId] = useState('neu');
  const ersterRef = useRef(null);

  useEffect(()=>{
    if (!offen) return undefined;
    setAbgewaehlt(new Set());
    setName(weekStartISO ? `Unterrichtszeiten ab ${formatDatum(weekStartISO)}` : 'Meine Unterrichtszeiten');
    setZiel('frei');
    setModellId('neu');
    const t = setTimeout(()=>ersterRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [offen, weekStartISO]);

  if (!offen) return null;

  const gewaehlt = zeilen.filter(z => !abgewaehlt.has(z.key));
  const wechselModelle = modelle.filter(m => istWechselModell(m) && !m.archiviert);

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div className="modal stundenplanModal" role="dialog" aria-modal="true"
           aria-label="Diese Woche als Stundenplanvorlage speichern"
           onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="dialogTitle" style={{ margin: 0 }}>
              <CalendarRange {...ICON} /> Diese Woche als Stundenplanvorlage speichern
            </h3>
            <div className="muted small">{weekStartISO ? `Woche ab ${formatDatum(weekStartISO)}` : ''}</div>
          </div>
          <button ref={ersterRef} className="btn" onClick={onSchliessen}>Schließen</button>
        </div>

        <div className="inlineNotice" style={{ marginTop: 12 }}>
          Es werden nur Unterrichtszeiten und organisatorische Angaben übernommen. Themen,
          Lernziele, Phasen, Materialien und Notizen bleiben in der ursprünglichen Woche.
        </div>

        {zeilen.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            In dieser Woche stehen noch keine Stunden mit Klasse und Fach.
          </p>
        ) : (
          <div className="verschiebenVorschau" style={{ marginTop: 12 }}>
            <table className="verlaufTabelle">
              <thead>
                <tr>
                  <th scope="col">Übernehmen</th>
                  <th scope="col">Tag und Zeit</th>
                  <th scope="col">Lerngruppe</th>
                  <th scope="col">Fach</th>
                  <th scope="col">Raum</th>
                  <th scope="col">Dauer</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map(z => (
                  <tr key={z.key}>
                    <td>
                      <label className="row" style={{ gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={!abgewaehlt.has(z.key)}
                          aria-label={`${TAGE[z.dayIndex]} ${stundenText(z.slotIndex, z.blockSpan)} übernehmen`}
                          onChange={(e)=>setAbgewaehlt(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(z.key); else next.add(z.key);
                            return next;
                          })}
                        />
                        <span className="visuallyHidden">übernehmen</span>
                      </label>
                    </td>
                    <td>{TAGE[z.dayIndex]} · {stundenText(z.slotIndex, z.blockSpan)}</td>
                    <td>{z.classGroup || <span className="muted">—</span>}</td>
                    <td>{z.subject || <span className="muted">—</span>}</td>
                    <td>{z.room || <span className="muted">—</span>}</td>
                    <td>
                      {z.blockSpan > 1 ? 'Doppelstunde' : 'Einzelstunde'}
                      {z.hatPlanung ? <div className="muted small">Planung bleibt in der Woche</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end', marginTop: 6 }}>
          <div className="grow" style={{ minWidth: 240 }}>
            <label className="small muted" htmlFor="vorlagenName">Name der Vorlage</label>
            <input id="vorlagenName" className="input" value={name} onChange={(e)=>setName(e.target.value)} />
          </div>
          <div style={{ minWidth: 230 }}>
            <label className="small muted" htmlFor="vorlagenZiel">Speichern als</label>
            <select id="vorlagenZiel" className="input" value={ziel} onChange={(e)=>setZiel(e.target.value)}>
              <option value="frei">normale Wochenvorlage</option>
              <option value="A">A-Woche eines Stundenplanmodells</option>
              <option value="B">B-Woche eines Stundenplanmodells</option>
            </select>
          </div>
          {ziel !== 'frei' ? (
            <div style={{ minWidth: 230 }}>
              <label className="small muted" htmlFor="vorlagenModell">Stundenplanmodell</label>
              <select id="vorlagenModell" className="input" value={modellId} onChange={(e)=>setModellId(e.target.value)}>
                <option value="neu">neues Modell anlegen</option>
                {wechselModelle.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          ) : null}
        </div>

        <div className="dialogActions">
          <button className="btn" onClick={onSchliessen}>Abbrechen</button>
          <button
            className="btn primary"
            disabled={!gewaehlt.length || !name.trim()}
            onClick={()=>onSpeichern?.({
              name: name.trim(),
              auswahl: gewaehlt.map(z => z.key),
              ziel,
              modellId,
            })}
          ><Check {...ICON_SM} /> Vorlage speichern</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Anwenden

   Ziel wählen, Vorschau lesen, ausführen. Angelegt wird nur, was frei
   ist – der Rest steht als Grund dabei.
   ============================================================ */
export function AnwendenDialog({
  offen, db, modell = null, vorlage = null, aktuelleWoche = '', schuljahr = null,
  onAusfuehren, onSchliessen,
}){
  const [ziel, setZiel] = useState('woche');
  const [vonISO, setVonISO] = useState('');
  const [bisISO, setBisISO] = useState('');
  const [ersetzeOhneInhalt, setErsetze] = useState(false);
  const ersterRef = useRef(null);

  useEffect(()=>{
    if (!offen) return undefined;
    setZiel('woche');
    setVonISO(aktuelleWoche || '');
    setBisISO(aktuelleWoche || '');
    setErsetze(false);
    const t = setTimeout(()=>ersterRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [offen, aktuelleWoche]);

  const zeitraum = useMemo(()=>{
    const heuteWoche = aktuelleWoche || '';
    if (ziel === 'woche') return { vonISO: heuteWoche, bisISO: heuteWoche };
    if (ziel === 'schuljahr') {
      return {
        vonISO: heuteWoche,
        bisISO: montagVon(schuljahr?.endISO || '') || heuteWoche,
      };
    }
    return { vonISO: montagVon(vonISO), bisISO: montagVon(bisISO) };
  }, [ziel, aktuelleWoche, schuljahr, vonISO, bisISO]);

  const plan = useMemo(()=>{
    if (!offen || (!modell && !vorlage)) return null;
    if (!zeitraum.vonISO || !zeitraum.bisISO) return null;
    return anwendungsVorschau(db, {
      modell, vorlage,
      vonISO: zeitraum.vonISO, bisISO: zeitraum.bisISO,
      ersetzeOhneInhalt,
    });
  }, [offen, db, modell, vorlage, zeitraum, ersetzeOhneInhalt]);

  if (!offen) return null;

  const name = modell?.name || vorlage?.name || 'Vorlage';

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div className="modal stundenplanModal" role="dialog" aria-modal="true"
           aria-label="Stundenplanvorlage anwenden"
           onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="dialogTitle" style={{ margin: 0 }}>
              <CalendarClock {...ICON} /> Unterrichtszeiten übernehmen
            </h3>
            <div className="muted small">{name}</div>
          </div>
          <button ref={ersterRef} className="btn" onClick={onSchliessen}>Schließen</button>
        </div>

        <fieldset className="verschiebenFeld" style={{ marginTop: 12 }}>
          <legend className="small muted">Zeitraum</legend>
          <div className="row wrap" style={{ gap: 14, alignItems: 'flex-end' }}>
            {[
              ['woche', 'Aktuelle Woche'],
              ['zeitraum', 'Gewählter Zeitraum'],
              ['schuljahr', 'Restliches Schuljahr'],
            ].map(([wert, label])=>(
              <label key={wert} className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input type="radio" name="anwendenZiel" checked={ziel === wert} onChange={()=>setZiel(wert)} />
                <span>{label}</span>
              </label>
            ))}
            <div style={{ width: 180 }}>
              <label className="small muted" htmlFor="anwendenVon">Von (Woche)</label>
              <input id="anwendenVon" className="input" type="date" value={vonISO}
                     disabled={ziel !== 'zeitraum'} onChange={(e)=>setVonISO(e.target.value)} />
            </div>
            <div style={{ width: 180 }}>
              <label className="small muted" htmlFor="anwendenBis">Bis (Woche)</label>
              <input id="anwendenBis" className="input" type="date" value={bisISO}
                     disabled={ziel !== 'zeitraum'} onChange={(e)=>setBisISO(e.target.value)} />
            </div>
          </div>
          {zeitraum.vonISO ? (
            <div className="muted small" style={{ marginTop: 6 }}>
              {formatDatum(zeitraum.vonISO)} bis {formatDatum(zeitraum.bisISO)}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Regeln</legend>
          <p className="muted small" style={{ margin: '0 0 6px' }}>
            Es werden ausschliesslich freie Plätze gefüllt. Bereits geplante Stunden bleiben
            unverändert – auch dann, wenn die Vorlage dort etwas anderes vorsieht.
          </p>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={ersetzeOhneInhalt} onChange={(e)=>setErsetze(e.target.checked)} />
            <span>Leere Stundenplan-Rahmen ohne Planung ersetzen</span>
          </label>
        </fieldset>

        {!plan ? (
          <p className="muted">Bitte einen Zeitraum wählen.</p>
        ) : (
          <>
            <div className="verschiebenVorschau">
              <table className="verlaufTabelle">
                <thead>
                  <tr>
                    <th scope="col">Woche</th>
                    <th scope="col">Rhythmus</th>
                    <th scope="col">Neu</th>
                    <th scope="col">Schon vorhanden</th>
                    <th scope="col">Konflikte</th>
                    <th scope="col">Ferien / schulfrei</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.wochen.map(w => (
                    <tr key={w.weekStartISO}>
                      <td>
                        {formatDatum(w.weekStartISO)}
                        <div className="muted small">KW {w.kw}</div>
                      </td>
                      <td>
                        {w.label ? <span className="badge rhythmusBadge">{w.label}-Woche</span> : <span className="muted">—</span>}
                        {w.hinweis ? <div className="muted small">{w.hinweis}</div> : null}
                        {w.vorlageName ? <div className="muted small">{w.vorlageName}</div> : null}
                      </td>
                      <td>{w.zaehler.neu + (w.zaehler.ersetzbar || 0) || <span className="muted">—</span>}</td>
                      <td>{w.zaehler.identisch || <span className="muted">—</span>}</td>
                      <td>
                        {w.zaehler.konflikt ? (
                          <details>
                            <summary>{w.zaehler.konflikt}</summary>
                            <ul className="stundenplanGruende">
                              {w.eintraege.filter(e => e.status === ZEILEN_STATUS.KONFLIKT).map((e, i)=>(
                                <li key={i}>{TAGE[e.dayIndex]} · {stundenText(e.slotIndex, e.blockSpan)}: {e.hinweis}</li>
                              ))}
                            </ul>
                          </details>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>{w.zaehler.ferien || (w.unterrichtsfrei ? 'ganze Woche' : '') || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="muted small">
              {plan.summe.neu + plan.summe.ersetzbar} {(plan.summe.neu + plan.summe.ersetzbar) === 1 ? 'Stunde wird angelegt' : 'Stunden werden angelegt'}
              {plan.summe.identisch ? ` · ${plan.summe.identisch} schon vorhanden` : ''}
              {plan.summe.konflikt ? ` · ${plan.summe.konflikt} Konflikte bleiben unverändert` : ''}
              {plan.summe.freieWochen ? ` · ${plan.summe.freieWochen} unterrichtsfreie Wochen übersprungen` : ''}
            </div>
          </>
        )}

        <div className="dialogActions">
          <button className="btn" onClick={onSchliessen}>Abbrechen</button>
          <button
            className="btn primary"
            disabled={!plan?.ok}
            title={plan?.ok ? 'Die geprüfte Übernahme ausführen' : 'In diesem Zeitraum gibt es nichts anzulegen.'}
            onClick={()=>onAusfuehren?.({ plan, zeitraum })}
          ><Check {...ICON_SM} /> Übernehmen</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Rhythmus festlegen

   Referenzwoche und Wechselregel – mit Vorschau, bevor es gilt.
   ============================================================ */
export function RhythmusDialog({ offen, modell, schoolCalendar, schuljahr, aktuelleWoche = '', onSpeichern, onSchliessen }){
  const [referenzWocheISO, setReferenz] = useState('');
  const [referenzPosition, setPosition] = useState(0);
  const [wechselregel, setRegel] = useState(RHYTHMUS.KALENDERWOCHEN);
  const [vonISO, setVon] = useState('');
  const [bisISO, setBis] = useState('');

  useEffect(()=>{
    if (!offen) return;
    const m = modell || {};
    /* Ohne gespeicherte Referenz gilt die Woche, die gerade offen ist:
       "Diese Woche ist eine A-Woche" ist die Frage, die man beantworten
       kann – der Beginn des Schuljahres liegt meist in den Ferien. */
    setReferenz(m.referenzWocheISO || montagVon(aktuelleWoche) || montagVon(m.vonISO || schuljahr?.startISO || '') || '');
    setPosition(Number(m.referenzPosition) || 0);
    setRegel(m.wechselregel || RHYTHMUS.KALENDERWOCHEN);
    setVon(m.vonISO || schuljahr?.startISO || '');
    setBis(m.bisISO || schuljahr?.endISO || '');
  }, [offen, modell, schuljahr, aktuelleWoche]);

  const entwurf = useMemo(()=> normalisiereStundenplanModell({
    ...(modell || {}),
    referenzWocheISO, referenzPosition, wechselregel, vonISO, bisISO,
  }), [modell, referenzWocheISO, referenzPosition, wechselregel, vonISO, bisISO]);

  /* Die Vorschau beginnt bei der REFERENZWOCHE, nicht am Anfang des
     Gültigkeitszeitraums: Über sie hat die Lehrkraft gerade entschieden,
     und die Wochen davor liegen meist in den Sommerferien. */
  const vorschau = useMemo(()=>{
    if (!offen || !referenzWocheISO) return [];
    const start = montagVon(referenzWocheISO);
    const grenze = montagVon(bisISO);
    /* Ohne Enddatum – etwa weil noch kein Schuljahr eingetragen ist –
       zeigt die Vorschau trotzdem zehn Wochen. Eine einzelne Zeile
       verriete nichts über den Wechsel. */
    const ende = (grenze && grenze > start) ? grenze : plusWochen(start, 9);
    const alle = rhythmusVorschau(entwurf, { vonISO: start, bisISO: ende, schoolCalendar });
    return alle.slice(0, 10);
  }, [offen, entwurf, referenzWocheISO, bisISO, schoolCalendar]);

  if (!offen) return null;

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div className="modal stundenplanModal" role="dialog" aria-modal="true" aria-label="Wochenrhythmus festlegen"
           onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="dialogTitle" style={{ margin: 0 }}>Wochenrhythmus festlegen</h3>
            <div className="muted small">{modell?.name || 'Stundenplanmodell'}</div>
          </div>
          <button className="btn" onClick={onSchliessen}>Schließen</button>
        </div>

        <fieldset className="verschiebenFeld" style={{ marginTop: 12 }}>
          <legend className="small muted">Gültig</legend>
          <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div style={{ width: 180 }}>
              <label className="small muted" htmlFor="rhythmusVon">Ab</label>
              <input id="rhythmusVon" className="input" type="date" value={vonISO} onChange={(e)=>setVon(e.target.value)} />
            </div>
            <div style={{ width: 180 }}>
              <label className="small muted" htmlFor="rhythmusBis">Bis</label>
              <input id="rhythmusBis" className="input" type="date" value={bisISO} onChange={(e)=>setBis(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Referenzwoche</legend>
          <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div style={{ width: 200 }}>
              <label className="small muted" htmlFor="rhythmusReferenz">Woche</label>
              <input id="rhythmusReferenz" className="input" type="date" value={referenzWocheISO}
                     onChange={(e)=>setReferenz(montagVon(e.target.value))} />
              {referenzWocheISO ? <div className="muted small">Woche ab {formatDatum(referenzWocheISO)} · KW {kalenderwoche(referenzWocheISO)}</div> : null}
            </div>
            <div className="row wrap" style={{ gap: 12 }}>
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input type="radio" name="referenzPosition" checked={referenzPosition === 0} onChange={()=>setPosition(0)} />
                <span>Diese Woche ist eine A-Woche</span>
              </label>
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <input type="radio" name="referenzPosition" checked={referenzPosition === 1} onChange={()=>setPosition(1)} />
                <span>Diese Woche ist eine B-Woche</span>
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="verschiebenFeld">
          <legend className="small muted">Wechselregel</legend>
          {[RHYTHMUS.KALENDERWOCHEN, RHYTHMUS.UNTERRICHTSWOCHEN].map(regel => (
            <label key={regel} className="row" style={{ gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <input type="radio" name="wechselregel" checked={wechselregel === regel} onChange={()=>setRegel(regel)} />
              <span>{RHYTHMUS_TEXT[regel]}</span>
            </label>
          ))}
        </fieldset>

        {vorschau.length ? (
          <div className="stundenplanRhythmus" aria-label="Vorschau der Wochen">
            {vorschau.map(z => (
              <span key={z.weekStartISO} className={`rhythmusZelle${z.unterrichtsfrei ? ' is-frei' : ''}`}>
                <span className="rhythmusZelleWoche">KW {z.kw}</span>
                <span className="badge rhythmusBadge">{z.label || '—'}</span>
                {z.unterrichtsfrei ? <span className="muted small">frei</span> : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="dialogActions">
          <button className="btn" onClick={onSchliessen}>Abbrechen</button>
          <button className="btn primary" disabled={!referenzWocheISO}
                  onClick={()=>onSpeichern?.({ referenzWocheISO, referenzPosition, wechselregel, vonISO, bisISO })}>
            <Check {...ICON_SM} /> Rhythmus speichern
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Die Verwaltung

   Modelle, ihre Wochenvorlagen und die freien Vorlagen. Ein sichtbarer
   Umschalter zwischen A- und B-Woche – wer die falsche Woche bearbeitet,
   merkt es sonst erst Wochen später.
   ============================================================ */
export function StundenplanView({
  db,
  aktuelleWoche = '',
  komponenten = {},
  readOnly = false,
  onNeuesModell,
  onSpeichereModell,
  onSpeichereVorlage,
  onLoescheVorlage,
  onAktiviere,
  onArchiviere,
  onTausche,
  onDupliziere,
  onAnwenden,
  onRhythmus,
  onAusWoche,
  startModellId = '',
}){
  const modelle = useMemo(()=> (Array.isArray(db?.timetableModels) ? db.timetableModels : []), [db?.timetableModels]);
  const vorlagen = db?.timetableTemplates || {};
  const [gewaehlt, setGewaehlt] = useState(startModellId || modelle.find(m => m.aktiv)?.id || modelle[0]?.id || '');
  const [position, setPosition] = useState(0);

  useEffect(()=>{
    if (startModellId) setGewaehlt(startModellId);
  }, [startModellId]);
  useEffect(()=>{
    if (!gewaehlt && modelle.length) setGewaehlt(modelle.find(m => m.aktiv)?.id || modelle[0].id);
  }, [modelle, gewaehlt]);

  const modell = modelle.find(m => m.id === gewaehlt) || null;
  const laenge = modell ? zyklusLaenge(modell) : 1;
  const sicherePosition = Math.min(position, Math.max(0, laenge - 1));
  const vorlageId = modell?.zyklus?.[sicherePosition] || '';
  const vorlage = vorlagen[vorlageId] || null;
  const freieVorlagen = Object.values(vorlagen).filter(v => !v.modelId);

  return (
    <div className="card">
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="dialogTitle" style={{ margin: 0 }}>Meine Unterrichtszeiten</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Stundenplanvorlagen und Stundenplanmodelle. Sie beschreiben, wann du regelmässig
            unterrichtest – nicht, was du in einer Stunde planst.
          </p>
        </div>
        {!readOnly ? (
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn" onClick={()=>onAusWoche?.()}>Aus vorhandener Woche</button>
            <button className="btn primary" onClick={()=>onNeuesModell?.()}>+ Stundenplan anlegen</button>
          </div>
        ) : null}
      </div>

      <div style={{ height: 14 }} />

      {modelle.length === 0 && freieVorlagen.length === 0 ? (
        <p className="muted">
          Noch keine Unterrichtszeiten hinterlegt. Lege deine regelmässig wiederkehrenden
          Unterrichtszeiten einmalig als Vorlage an – anschliessend kann Prép-ybara die
          passenden Stundenplätze für deine Unterrichtswochen vorbereiten.
        </p>
      ) : null}

      {modelle.length ? (
        <div className="stundenplanListe" role="list">
          {modelle.map(m => {
            const aktiv = m.id === gewaehlt;
            const vollstaendig = modellVollstaendig(m, vorlagen);
            return (
              <div key={m.id} role="listitem"
                   className={`stundenplanKarte${aktiv ? ' is-offen' : ''}${m.archiviert ? ' is-archiviert' : ''}`}>
                <button
                  type="button"
                  className="stundenplanKopf"
                  aria-expanded={aktiv}
                  onClick={()=>{ setGewaehlt(m.id); setPosition(0); }}
                >
                  <ChevronRight {...ICON_SM} className={aktiv ? 'is-offen' : ''} />
                  <span className="stundenplanName">{m.name}</span>
                  <span className="badge">{istWechselModell(m) ? 'A-/B-Woche' : 'jede Woche gleich'}</span>
                  {m.aktiv && !m.archiviert ? <span className="badge badge--aktiv">aktiv</span> : null}
                  {m.archiviert ? <span className="badge">archiviert</span> : null}
                  {!vollstaendig ? <span className="badge badge--offen">unvollständig</span> : null}
                  <span className="muted small">
                    {m.vonISO || m.bisISO
                      ? `${m.vonISO ? formatDatum(m.vonISO) : '…'} – ${m.bisISO ? formatDatum(m.bisISO) : '…'}`
                      : 'ohne Zeitraum'}
                  </span>
                </button>

                {aktiv ? (
                  <div className="stundenplanInhalt">
                    <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
                      {laenge > 1 ? (
                        <div className="rhythmusUmschalter" role="tablist" aria-label="Wochenvorlage wählen">
                          {m.zyklus.map((id, index)=>(
                            <button
                              key={id || index}
                              type="button"
                              role="tab"
                              aria-selected={index === sicherePosition}
                              className={`rhythmusTab${index === sicherePosition ? ' is-active' : ''}`}
                              onClick={()=>setPosition(index)}
                            >{zyklusLabel(index, laenge)}-Woche</button>
                          ))}
                        </div>
                      ) : <div className="muted small">Eine Wochenvorlage für jede Woche.</div>}

                      {!readOnly ? (
                        <div className="row wrap" style={{ gap: 6 }}>
                          <button className="btn small" onClick={()=>onRhythmus?.(m)}
                                  disabled={!istWechselModell(m)}
                                  title={istWechselModell(m) ? 'Referenzwoche und Wechselregel' : 'Nur bei A-/B-Rhythmus nötig'}>
                            Rhythmus…
                          </button>
                          <button className="btn small" onClick={()=>onTausche?.(m)} disabled={!istWechselModell(m)}
                                  title="A- und B-Woche vertauschen">
                            <ArrowRightLeft {...ICON_SM} /> A/B tauschen
                          </button>
                          <button className="btn small" onClick={()=>onAktiviere?.(m)} disabled={m.aktiv && !m.archiviert}>
                            <Play {...ICON_SM} /> Aktivieren
                          </button>
                          <button className="btn small" onClick={()=>onArchiviere?.(m)} disabled={m.archiviert}>
                            <Archive {...ICON_SM} /> Archivieren
                          </button>
                          <button className="btn small primary" onClick={()=>onAnwenden?.({ modell: m })}
                                  disabled={!vollstaendig}>
                            <CalendarClock {...ICON_SM} /> Übernehmen…
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ height: 10 }} />

                    {vorlage ? (
                      <VorlagenEditor
                        vorlage={vorlage}
                        titel={`${m.name}${laenge > 1 ? ` · ${zyklusLabel(sicherePosition, laenge)}-Woche` : ''}`}
                        komponenten={komponenten}
                        readOnly={readOnly}
                        onChange={(naechste)=>onSpeichereVorlage?.(naechste, { modell: m })}
                      />
                    ) : (
                      <div className="muted">
                        Für diese Position gibt es noch keine Wochenvorlage.
                        {!readOnly ? (
                          <div className="row" style={{ gap: 8, marginTop: 8 }}>
                            <button className="btn" onClick={()=>onSpeichereVorlage?.(
                              normalisiereStundenplanVorlage({
                                name: `${m.name} · ${zyklusLabel(sicherePosition, laenge) || 'Woche'}`,
                                modelId: m.id, zyklusPosition: sicherePosition,
                              }),
                              { modell: m, position: sicherePosition },
                            )}>Leere Vorlage anlegen</button>
                            <button className="btn" onClick={()=>onAusWoche?.({ modell: m, position: sicherePosition })}>
                              Aus vorhandener Woche
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {freieVorlagen.length ? (
        <>
          <h3 className="settingsHeading" style={{ marginTop: 18 }}>Einzelne Wochenvorlagen</h3>
          <div className="stundenplanListe">
            {freieVorlagen.map(v => (
              <div key={v.id} className="stundenplanKarte">
                <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="stundenplanName">{v.name}</span>
                    <span className="muted small"> · {v.eintraege.length} {v.eintraege.length === 1 ? 'Unterrichtszeit' : 'Unterrichtszeiten'}</span>
                  </div>
                  {!readOnly ? (
                    <div className="row wrap" style={{ gap: 6 }}>
                      <button className="btn small" onClick={()=>onDupliziere?.(v)}><Copy {...ICON_SM} /> Duplizieren</button>
                      <button className="btn small" onClick={()=>onAnwenden?.({ vorlage: v })}>
                        <CalendarClock {...ICON_SM} /> Übernehmen…
                      </button>
                      <button className="btn small danger" onClick={()=>onLoescheVorlage?.(v)}>
                        <Trash2 {...ICON_SM} /> Löschen
                      </button>
                    </div>
                  ) : null}
                </div>
                <VorlagenEditor
                  vorlage={v}
                  komponenten={komponenten}
                  readOnly={readOnly}
                  onChange={(naechste)=>onSpeichereVorlage?.(naechste)}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   Der Assistent

   Zuerst die Frage, die alles Weitere bestimmt: gleichbleibend oder
   A/B? Danach nur noch Name und Zeitraum – die Vorlagen selbst füllt
   der Editor.
   ============================================================ */
export function ModellAssistent({ offen, schuljahr, vorhandeneWoche = false, onAnlegen, onSchliessen }){
  const [typ, setTyp] = useState(MODELL_TYP.EINZEL);
  const [name, setName] = useState('');
  const [quelle, setQuelle] = useState('neu');
  const ersterRef = useRef(null);

  useEffect(()=>{
    if (!offen) return undefined;
    setTyp(MODELL_TYP.EINZEL);
    setName(schuljahr?.startISO ? `Stundenplan ${new Date(`${schuljahr.startISO}T00:00:00`).getFullYear()}` : 'Mein Stundenplan');
    setQuelle('neu');
    const t = setTimeout(()=>ersterRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [offen, schuljahr]);

  if (!offen) return null;

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div className="modalCard stundenplanModal" role="dialog" aria-modal="true" aria-label="Stundenplan anlegen"
           onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}>
        <h3 className="dialogTitle">Welchen Stundenplan verwendest du?</h3>
        <p className="dialogBody">
          Lege deine regelmässig wiederkehrenden Unterrichtszeiten einmalig als Vorlage an.
          Anschliessend kann Prép-ybara die passenden Stundenplätze für deine Unterrichtswochen
          vorbereiten.
        </p>

        <div className="onboardingWege" role="radiogroup" aria-label="Art des Stundenplans">
          {[
            [MODELL_TYP.EINZEL, 'Jede Woche gleich', 'Eine Wochenvorlage gilt für alle Wochen.'],
            [MODELL_TYP.WECHSEL, 'A- und B-Woche im Wechsel', 'Zwei Wochenvorlagen, die sich abwechseln.'],
          ].map(([wert, label, hinweis], i)=>(
            <button
              key={wert}
              ref={i === 0 ? ersterRef : null}
              type="button"
              role="radio"
              aria-checked={typ === wert}
              className={`onboardingWeg${typ === wert ? ' onboardingWeg--primaer' : ''}`}
              onClick={()=>setTyp(wert)}
            >
              <span className="onboardingWegLabel">{label}</span>
              <span className="muted small">{hinweis}</span>
            </button>
          ))}
        </div>

        <div style={{ height: 12 }} />

        <label className="small muted" htmlFor="modellName">Name</label>
        <input id="modellName" className="input" value={name} onChange={(e)=>setName(e.target.value)} />

        {vorhandeneWoche ? (
          <>
            <div style={{ height: 10 }} />
            <fieldset className="verschiebenFeld">
              <legend className="small muted">Woher kommen die Unterrichtszeiten?</legend>
              <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="radio" name="modellQuelle" checked={quelle === 'neu'} onChange={()=>setQuelle('neu')} />
                <span>Neue Wochenvorlage anlegen</span>
              </label>
              <label className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="radio" name="modellQuelle" checked={quelle === 'woche'} onChange={()=>setQuelle('woche')} />
                <span>Vorhandene Woche als Vorlage verwenden</span>
              </label>
            </fieldset>
          </>
        ) : null}

        <div className="dialogActions">
          <button className="btn" onClick={onSchliessen}>Abbrechen</button>
          <button className="btn primary" disabled={!name.trim()}
                  onClick={()=>onAnlegen?.({ typ, name: name.trim(), quelle })}>
            Weiter <ChevronRight {...ICON_SM} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default StundenplanView;
