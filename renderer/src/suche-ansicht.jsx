/* ============================================================
   Globale Suche: die Ansicht

   Ein grosses Suchfeld, Filter, gruppierte Treffer. Mehr ist es nicht –
   und mehr soll es nicht sein: die Suche ist ein Weg zu vorhandenen
   Inhalten, kein zweiter Ort, an dem geplant wird.

   Deshalb gibt es hier auch keine eigene Kopier- oder Importlogik. Was
   ein Treffer kann, kann er über die Wege, die es schon gibt: öffnen,
   in der Vorschau ansehen, mit der vorhandenen Kopierfunktion
   übernehmen.

   Die Hervorhebung entsteht aus Textstücken (suche.js) und wird hier zu
   <mark>-Elementen. Es wird an keiner Stelle HTML aus Suchtext gebaut.
   ============================================================ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Archive, Copy, ArrowRight, Funnel } from 'lucide-react';

import { formatDatum } from '../../shared/datum.js';
import {
  TYPEN, TYP_NAMEN, TYP_REIHENFOLGE,
  begriffeAus, sucheImIndex, gruppiereTreffer, filterWerte, teileNachTreffern,
} from './suche.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

/* Hervorhebung ohne HTML: aus Stücken werden Elemente. */
export function Hervorgehoben({ text, begriffe }){
  const teile = useMemo(()=> teileNachTreffern(text, begriffe), [text, begriffe]);
  return (
    <>
      {teile.map((t, i)=> (t.treffer
        ? <mark key={i} className="sucheMarke">{t.text}</mark>
        : <React.Fragment key={i}>{t.text}</React.Fragment>))}
    </>
  );
}

function zeitraumText(d){
  if (d.typ === TYPEN.STUNDE) return d.dateISO ? formatDatum(d.dateISO) : '';
  if (d.vonISO && d.bisISO && d.vonISO !== d.bisISO) return `${formatDatum(d.vonISO)} – ${formatDatum(d.bisISO)}`;
  if (d.vonISO) return formatDatum(d.vonISO);
  return '';
}

function umfangText(d){
  if (d.typ === TYPEN.SEQUENZ) return d.anzahl ? `${d.anzahl} ${d.anzahl === 1 ? 'Stunde' : 'Stunden'}` : 'noch ohne Stunden';
  if (d.typ === TYPEN.VORLAGE) return d.anzahl ? `${d.anzahl} ${d.anzahl === 1 ? 'Einheit' : 'Einheiten'}` : '';
  if (d.typ === TYPEN.TODO) return d.erledigt ? 'erledigt' : 'offen';
  return '';
}

export function GlobaleSucheView({
  index,
  startQuery = '',
  onQueryChange,
  onOeffnen,
  onKopieren,
}){
  const [query, setQuery] = useState(startQuery);
  const [typen, setTypen] = useState(()=> new Set());
  const [lerngruppe, setLerngruppe] = useState('');
  const [quelle, setQuelle] = useState('');
  const [kompetenz, setKompetenz] = useState('');
  const feldRef = useRef(null);

  useEffect(()=>{ setQuery(startQuery); }, [startQuery]);
  useEffect(()=>{
    const t = setTimeout(()=>{ feldRef.current?.focus(); feldRef.current?.select?.(); }, 0);
    return ()=> clearTimeout(t);
  }, []);
  useEffect(()=>{ onQueryChange?.(query); }, [query]);

  const werte = useMemo(()=> filterWerte(index), [index]);
  const begriffe = useMemo(()=> begriffeAus(query), [query]);

  const treffer = useMemo(()=> {
    if (!query.trim() && !lerngruppe && !kompetenz && !quelle && !typen.size) return [];
    return sucheImIndex(index, query, { typen, lerngruppe, quelle, kompetenz });
  }, [index, query, typen, lerngruppe, quelle, kompetenz]);

  const gruppen = useMemo(()=> gruppiereTreffer(treffer), [treffer]);

  const typUmschalten = (typ)=>{
    setTypen(prev => {
      const next = new Set(prev);
      if (next.has(typ)) next.delete(typ); else next.add(typ);
      return next;
    });
  };

  const filterAktiv = Boolean(typen.size || lerngruppe || quelle || kompetenz);

  return (
    <div className="card">
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="dialogTitle" style={{ margin: 0 }}><Search {...ICON} /> Suche</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Durchsucht Stunden, Sequenzen, Vorlagen, Jahresplanung und To-dos – im laufenden
            wie in archivierten Schuljahren. Alles davon geschieht auf diesem Gerät.
          </p>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="sucheFeldZeile">
        <Search {...ICON} />
        <input
          ref={feldRef}
          className="sucheFeld"
          type="search"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="Suchen – z. B. Québec, passé composé, Klassenarbeit"
          aria-label="Suchbegriff"
        />
      </div>

      <div className="sucheFilter" role="group" aria-label="Filter">
        <div className="sucheFilterZeile">
          <span className="sucheFilterTitel"><Funnel {...ICON_SM} /> Inhaltstyp</span>
          {TYP_REIHENFOLGE.map(typ => (
            <button
              key={typ}
              type="button"
              className={`btn small${typen.has(typ) ? ' primary' : ''}`}
              aria-pressed={typen.has(typ)}
              onClick={()=>typUmschalten(typ)}
            >{TYP_NAMEN[typ]}</button>
          ))}
        </div>
        <div className="sucheFilterZeile">
          <label className="sucheFilterFeld">
            <span className="small muted">Lerngruppe</span>
            <select className="input" value={lerngruppe} onChange={(e)=>setLerngruppe(e.target.value)}>
              <option value="">Alle</option>
              {werte.lerngruppen.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="sucheFilterFeld">
            <span className="small muted">Schuljahr</span>
            <select className="input" value={quelle} onChange={(e)=>setQuelle(e.target.value)}>
              <option value="">Alle</option>
              {werte.quellen.map(q => (
                <option key={q.id} value={q.id}>{q.name}{q.archiviert ? ' (Archiv)' : ''}</option>
              ))}
            </select>
          </label>
          <label className="sucheFilterFeld">
            <span className="small muted">Kompetenz</span>
            <select className="input" value={kompetenz} onChange={(e)=>setKompetenz(e.target.value)}>
              <option value="">Alle</option>
              {werte.kompetenzen.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {filterAktiv ? (
            <button
              type="button"
              className="btn small"
              onClick={()=>{ setTypen(new Set()); setLerngruppe(''); setQuelle(''); setKompetenz(''); }}
            >Filter zurücksetzen</button>
          ) : null}
        </div>
      </div>

      {!query.trim() && !filterAktiv ? (
        <p className="muted">
          Tippe einen Begriff. Gesucht wird in Themen, Lernzielen, Phasen, Materialien,
          Kompetenzen, Sequenzen, Vorlagen, Jahresbalken und To-dos. Der Versionsverlauf
          bleibt aussen vor.
        </p>
      ) : treffer.length === 0 ? (
        <p className="muted">Kein Treffer{query.trim() ? ` für „${query.trim()}“` : ''}.</p>
      ) : (
        <>
          <div className="muted small" aria-live="polite">
            {treffer.length} {treffer.length === 1 ? 'Treffer' : 'Treffer'}
            {treffer.some(t => t.dokument.quelle?.archiviert)
              ? ' · darunter Treffer aus archivierten Schuljahren'
              : ''}
          </div>
          {gruppen.map(gruppe => (
            <section key={gruppe.typ} className="sucheGruppe" aria-label={gruppe.name}>
              <h3 className="sucheGruppeTitel">{gruppe.name} <span className="muted small">({gruppe.treffer.length})</span></h3>
              <ul className="sucheListe">
                {gruppe.treffer.map(({ dokument, fundstelle })=>(
                  <li key={dokument.id} className="sucheTreffer">
                    <div className="sucheTrefferKopf">
                      <button
                        type="button"
                        className="sucheTitel"
                        onClick={()=>onOeffnen?.(dokument)}
                        title={dokument.quelle?.archiviert
                          ? 'Im Archiv ansehen (schreibgeschützt)'
                          : 'Öffnen'}
                      >
                        <Hervorgehoben text={dokument.titel} begriffe={begriffe} />
                      </button>
                      <div className="row wrap" style={{ gap: 6, alignItems: 'center' }}>
                        {dokument.quelle?.archiviert ? (
                          <span className="badge" title={`Aus ${dokument.quelle.name}`}>
                            <Archive {...ICON_SM} /> {dokument.quelle.name}
                          </span>
                        ) : (
                          <span className="muted small">{dokument.quelle?.name}</span>
                        )}
                        {dokument.typ === TYPEN.STUNDE && typeof onKopieren === 'function' && !dokument.quelle?.archiviert ? (
                          <button
                            type="button"
                            className="btn small"
                            title="Diese Stunde in die Zwischenablage von Prép-ybara legen"
                            onClick={()=>onKopieren(dokument)}
                          ><Copy {...ICON_SM} /> Kopieren</button>
                        ) : null}
                        <button
                          type="button"
                          className="btn small"
                          onClick={()=>onOeffnen?.(dokument)}
                        ><ArrowRight {...ICON_SM} /> Öffnen</button>
                      </div>
                    </div>
                    <div className="muted small sucheMeta">
                      {[
                        zeitraumText(dokument),
                        [dokument.classGroup, dokument.subject].filter(Boolean).join(' · '),
                        umfangText(dokument),
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {fundstelle ? (
                      <div className="sucheAusschnitt">
                        <span className="muted small">{fundstelle.feld}: </span>
                        <Hervorgehoben text={fundstelle.text} begriffe={begriffe} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

export default GlobaleSucheView;
