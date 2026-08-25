/* ============================================================
   Lerngruppe, Datum, Stunde

   Die drei Angaben, die darüber entscheiden, ob der Desktop den Entwurf
   später von selbst am richtigen Platz einsetzt.

   Wichtig ist dabei weniger, was man sieht, als was gespeichert wird:
   Pocket merkt sich nicht nur "9b Französisch", sondern die stabilen
   Kennungen aus dem Profil (classId, subjectId, groupId). Nur dadurch
   findet der Desktop die Lerngruppe auch dann wieder, wenn sie dort
   anders geschrieben steht.

   Ohne Profil funktioniert alles genauso, nur mit freier Eingabe. Die
   Kennungen werden dann aus dem Namen abgeleitet – dieselbe Rechnung,
   die der Desktop benutzt, also derselbe Wert.
   ============================================================ */

import { useState } from 'react';
import { Blatt, Chip, Eingabe, Feld, Knopf } from '../ui.jsx';
import { classIdFor, subjectIdFor, groupIdFor, groupLabel } from '../../../shared/exchange/index.js';
import { formatDatum } from '../../../shared/datum.js';

export function gruppenPatch({ className, subjectName }){
  return {
    className: className || '',
    subjectName: subjectName || '',
    classId: classIdFor(className || ''),
    subjectId: subjectIdFor(subjectName || ''),
    groupId: groupIdFor(className || '', subjectName || ''),
  };
}

export function GruppenBlatt({ profil, onWahl, onSchliessen, aktuell = null }){
  const gruppen = profil?.groups || [];
  const [klasse, setKlasse] = useState(aktuell?.className || '');
  const [fach, setFach] = useState(aktuell?.subjectName || '');

  return (
    <Blatt
      titel="Lerngruppe"
      onSchliessen={onSchliessen}
      aktionen={(
        <>
          <Knopf breit onClick={onSchliessen}>Abbrechen</Knopf>
          <Knopf
            breit
            art="primaer"
            onClick={()=>{ onWahl(gruppenPatch({ className: klasse.trim(), subjectName: fach.trim() })); }}
          >Übernehmen</Knopf>
        </>
      )}
    >
      {gruppen.length ? (
        <div className="chips">
          {gruppen.map(g => (
            <Chip
              key={g.id}
              gewaehlt={aktuell?.groupId === g.id}
              onClick={()=>onWahl({
                className: g.className,
                subjectName: g.subjectName,
                classId: g.classId,
                subjectId: g.subjectId,
                groupId: g.id,
              })}
            >{g.label || groupLabel(g.className, g.subjectName)}</Chip>
          ))}
        </div>
      ) : (
        <p className="leise" style={{ margin: 0 }}>
          Noch kein Profil eingelesen. Lerngruppe und Fach können frei eingetragen werden –
          der Desktop ordnet sie später über den Namen zu.
        </p>
      )}

      <div className="trenner" />

      <Feld name="Lerngruppe / Klasse">
        <Eingabe wert={klasse} onWert={setKlasse} placeholder="z. B. 9b" />
      </Feld>
      <Feld name="Fach">
        <Eingabe wert={fach} onWert={setFach} placeholder="z. B. Französisch" />
      </Feld>
    </Blatt>
  );
}

export default function Zuordnung({ entwurf, profil, onAendern, mitTermin = true }){
  const [wahlOffen, setWahlOffen] = useState(false);
  const name = groupLabel(entwurf.className, entwurf.subjectName);

  return (
    <section className="karte">
      <button
        type="button"
        className="reihe"
        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: 'var(--tap)' }}
        onClick={()=>setWahlOffen(true)}
      >
        <span className="wachs">
          <span className="feldName">Lerngruppe</span>
          <span style={{ display: 'block', fontWeight: 640 }}>{name || 'Auswählen …'}</span>
        </span>
        <span className="leise" aria-hidden="true">›</span>
      </button>

      {mitTermin ? (
        <div className="reihe" style={{ gap: 10 }}>
          <Feld name="Datum">
            <input
              className="eingabe"
              type="date"
              value={entwurf.date || ''}
              onChange={(e)=>onAendern({ date: e.target.value })}
            />
          </Feld>
          <Feld name="Stunde">
            <select
              className="auswahl"
              value={entwurf.lessonNumber || ''}
              onChange={(e)=>onAendern({ lessonNumber: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">–</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}.</option>)}
            </select>
          </Feld>
        </div>
      ) : null}

      {mitTermin && entwurf.date ? (
        <span className="leise klein">{formatDatum(entwurf.date, { lang: true })}</span>
      ) : null}

      {wahlOffen ? (
        <GruppenBlatt
          profil={profil}
          aktuell={entwurf}
          onSchliessen={()=>setWahlOffen(false)}
          onWahl={(patch)=>{ onAendern(patch); setWahlOffen(false); }}
        />
      ) : null}
    </section>
  );
}
