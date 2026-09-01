/* ============================================================
   Versionsverlauf: die Ansicht

   Ein Dialog, drei Zustände: die Liste der Fassungen, das Ansehen einer
   Fassung, die Vorschau vor dem Wiederherstellen. Mehr braucht es
   nicht – und weniger wäre gefährlich: eine Wiederherstellung ohne
   Vorschau wäre eine stille Datenüberschreibung.

   Die Ansicht rechnet nichts aus. Was ein Eintrag bedeutet und was eine
   Wiederherstellung bewirkt, steht in versionsverlauf.js; hier wird es
   nur gezeigt.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileClock, RotateCcw, Eye } from 'lucide-react';

import { formatDatum, relativeZeit } from '../../shared/datum.js';
import { ausloeserName, bereichName, vorschau, zusammenfassung } from './versionsverlauf.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

function uhrzeit(iso){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function zeitpunkt(iso){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tag = formatDatum(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  return `${tag}, ${uhrzeit(iso)} Uhr`;
}

/* Was in einer gespeicherten Fassung steht – lesbar, nicht als JSON.
   Bewusst knapp: es geht darum wiederzuerkennen, welche Fassung das
   war, nicht darum, sie hier zu bearbeiten. */
function StundenSchau({ stunde }){
  if (!stunde) return <p className="muted small">An dieser Stelle war nichts geplant.</p>;
  const phasen = Array.isArray(stunde.phases) ? stunde.phases : [];
  const kompetenzen = Array.isArray(stunde.competencies) ? stunde.competencies : [];
  const zeile = (beschriftung, wert)=> (String(wert || '').trim()
    ? <div key={beschriftung} className="verlaufFeld"><span className="muted small">{beschriftung}</span><div>{wert}</div></div>
    : null);
  return (
    <div className="verlaufSchau">
      {zeile('Thema', stunde.topic)}
      {zeile('Lerngruppe', [stunde.classGroup, stunde.subject].filter(Boolean).join(' · '))}
      {zeile('Raum', stunde.room)}
      {zeile('Lernziele', stunde.objectives)}
      {kompetenzen.length ? zeile('Kompetenzen', kompetenzen.join(', ')) : null}
      {zeile('Hausaufgaben', stunde.homework)}
      {zeile('Notizen', stunde.notes)}
      {phasen.length ? (
        <div className="verlaufFeld">
          <span className="muted small">Verlauf</span>
          <ol className="verlaufPhasen">
            {phasen.map((p, i)=>(
              <li key={p?.id || i}>
                <b>{p?.title || 'Phase'}</b>
                <span className="muted small"> · {Number(p?.duration) || 0} min</span>
                {p?.content ? <div className="muted small">{String(p.content).replace(/<[^>]*>/g, ' ').slice(0, 200)}</div> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function NameSchau({ wert, art }){
  if (!wert) return <p className="muted small">Dieser Eintrag war nicht vorhanden.</p>;
  return (
    <div className="verlaufSchau">
      <div className="verlaufFeld">
        <span className="muted small">{art === 'balken' ? 'Titel' : 'Name'}</span>
        <div>{wert.name || wert.title || 'Ohne Namen'}</div>
      </div>
      {wert.startISO ? (
        <div className="verlaufFeld">
          <span className="muted small">Zeitraum</span>
          <div>{formatDatum(wert.startISO)} – {formatDatum(wert.endISO || wert.startISO)}</div>
        </div>
      ) : null}
      {Array.isArray(wert.competencies) && wert.competencies.length ? (
        <div className="verlaufFeld">
          <span className="muted small">Kompetenzen</span>
          <div>{wert.competencies.join(', ')}</div>
        </div>
      ) : null}
      {Array.isArray(wert.lessons) ? (
        <div className="verlaufFeld">
          <span className="muted small">Umfang</span>
          <div>{wert.lessons.length} {wert.lessons.length === 1 ? 'Einheit' : 'Einheiten'}</div>
        </div>
      ) : null}
    </div>
  );
}

function TeilSchau({ teil }){
  if (!teil) return null;
  if (teil.art === 'stunde') return <StundenSchau stunde={teil.wert} />;
  return <NameSchau wert={teil.wert} art={teil.art} />;
}

export function VersionsverlaufDialog({
  offen,
  titel = 'Versionsverlauf',
  untertitel = '',
  eintraege = [],
  laedt = false,
  db = null,
  readOnly = false,
  ortName = ()=> '',
  onWiederherstellen,
  onSchliessen,
}){
  const [gewaehlt, setGewaehlt] = useState('');
  const [bestaetigung, setBestaetigung] = useState(null);   // Eintrag, der wiederhergestellt werden soll
  const schliessenRef = useRef(null);

  useEffect(()=>{
    if (!offen) return;
    setGewaehlt('');
    setBestaetigung(null);
    const t = setTimeout(()=>schliessenRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [offen]);

  const zeilen = useMemo(
    ()=> (bestaetigung && db ? vorschau(db, bestaetigung) : []),
    [bestaetigung, db],
  );

  /* Nach der Bestätigung – ob zugestimmt oder abgebrochen – gehört der
     Fokus zurück in diesen Dialog. Sonst läge er auf <body>, und Escape
     ginge ins Leere: der Dialog bliebe für die Tastatur unerreichbar
     offen stehen.

     Bewusst in einem Effekt und nicht im Klick: die Wiederherstellung
     löst weitere Aktualisierungen aus, und der Fokus soll NACH deren
     Darstellung gesetzt werden, nicht davor. */
  const bestaetigungSchliessen = ()=> setBestaetigung(null);
  const hatteBestaetigung = useRef(false);
  useEffect(()=>{
    if (hatteBestaetigung.current && !bestaetigung) schliessenRef.current?.focus();
    hatteBestaetigung.current = Boolean(bestaetigung);
  }, [bestaetigung]);

  if (!offen) return null;

  return (
    <div className="modalBackdrop" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div
        className="modal verlaufModal"
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onSchliessen?.(); } }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 className="dialogTitle" style={{ margin: 0 }}>
              <FileClock {...ICON} /> {titel}
            </h3>
            <div className="muted small">
              {untertitel ? `${untertitel} · ` : ''}
              Frühere Fassungen liegen nur auf diesem Gerät und gehören nicht zum Backup.
            </div>
          </div>
          <button ref={schliessenRef} type="button" className="btn" onClick={onSchliessen}>Schließen</button>
        </div>

        <div style={{ height: 12 }} />

        {laedt ? (
          <p className="muted">Verlauf wird gelesen…</p>
        ) : eintraege.length === 0 ? (
          <p className="muted">
            Für diesen Bereich gibt es noch keine gespeicherten Fassungen. Sie entstehen
            beim Verlassen einer geänderten Stunde sowie vor dem Löschen, Verschieben,
            Ersetzen und Wiederherstellen.
          </p>
        ) : (
          <ul className="verlaufListe">
            {eintraege.map((e)=>{
              const aktiv = e.id === gewaehlt;
              return (
                <li key={e.id} className={`verlaufEintrag${aktiv ? ' is-active' : ''}`}>
                  <div className="verlaufKopf">
                    <div>
                      <div className="verlaufZeit">
                        {zeitpunkt(e.at)}
                        <span className="muted small"> · {relativeZeit(e.at)}</span>
                      </div>
                      <div className="muted small">
                        {ausloeserName(e.ausloeser)} · {bereichName(e.bereich)}
                        {e.zielLabel ? ` · ${e.zielLabel}` : ''}
                        {e.transaktion ? ' · Sammelaktion' : ''}
                      </div>
                      <div className="verlaufFelder">{zusammenfassung(e)}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        aria-expanded={aktiv}
                        onClick={()=>setGewaehlt(aktiv ? '' : e.id)}
                      ><Eye {...ICON_SM} /> {aktiv ? 'Schließen' : 'Ansehen'}</button>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={readOnly}
                        title={readOnly
                          ? 'In einem archivierten Schuljahr wird nichts verändert.'
                          : 'Diese Fassung zurückholen – mit Vorschau und Bestätigung'}
                        onClick={()=>setBestaetigung(e)}
                      ><RotateCcw {...ICON_SM} /> Wiederherstellen</button>
                    </div>
                  </div>
                  {aktiv ? (
                    <div className="verlaufDetail">
                      {(e.teile || []).map((teil, i)=>(
                        <div key={i} className="verlaufTeil">
                          <div className="muted small">{ortName(teil) || bereichName(teil.art === 'stunde' ? 'lesson' : teil.art)}</div>
                          <TeilSchau teil={teil} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {bestaetigung ? (
          <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) bestaetigungSchliessen(); }}>
            <div
              className="modalCard modalCard--breit"
              role="alertdialog"
              aria-modal="true"
              aria-label="Fassung wiederherstellen"
              onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); bestaetigungSchliessen(); } }}
            >
              <h3 className="dialogTitle">Fassung wiederherstellen</h3>
              <p className="dialogBody">
                Die Fassung vom {zeitpunkt(bestaetigung.at)} wird zurückgeholt. Der jetzige
                Stand wird vorher selbst als Fassung gesichert – die Wiederherstellung
                lässt sich also ebenfalls zurücknehmen.
              </p>
              <div className="verlaufVorschau">
                <table className="verlaufTabelle">
                  <thead>
                    <tr>
                      <th scope="col">Ort</th>
                      <th scope="col">Jetzt</th>
                      <th scope="col">Danach</th>
                      <th scope="col">Änderung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeilen.map((z, i)=>(
                      <tr key={i}>
                        <td>{ortName(bestaetigung.teile?.[i]) || z.ort}</td>
                        <td>{z.jetzt}</td>
                        <td>{z.danach}</td>
                        <td>{z.aenderung}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dialogActions">
                <button type="button" className="btn" onClick={bestaetigungSchliessen}>Abbrechen</button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={()=>{
                    const e = bestaetigung;
                    bestaetigungSchliessen();
                    onWiederherstellen?.(e);
                  }}
                ><RotateCcw {...ICON_SM} /> Wiederherstellen</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default VersionsverlaufDialog;
