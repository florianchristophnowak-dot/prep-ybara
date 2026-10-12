/* ============================================================
   Beobachtung: die Ansicht

   Fünf Reiter über einem einzigen Stand: Runde, Lernende, Fragen,
   Auswertung, Daten. Die Reihenfolge ist die eines Schuljahres von
   hinten gelesen – was am häufigsten gebraucht wird, steht vorn. Wer
   nach der Stunde zwei Minuten hat, landet auf „Runde" und muss nichts
   suchen.

   Die Ansicht rechnet nichts selbst. Welche Paare eine Runde zieht,
   was eine Lernende zählt, wie zusammengeführt wird – das steht in
   beobachtung.js, capy-import.js und beobachtung-sicherung.js. Hier
   wird gezeigt und gefragt.

   Geschrieben wird ausschliesslich über speicher.aendern() mit einer
   reinen Funktion aus beobachtung.js. Der Speicher wendet sie auf den
   neuesten Stand an und gibt das Ergebnis zurück; genau dieses
   Ergebnis wird hier zum angezeigten Stand. Die Ansicht hält also nie
   eine eigene, abweichende Fassung der Daten.

   Drei Regeln, die sich durch die Oberfläche ziehen:

   - Jede Antwort einer Runde wird sofort gespeichert. Eine abgebrochene
     Runde verliert nichts, und „Runde beenden" braucht deshalb keine
     Rückfrage.
   - Die Auswertung beschreibt, sie bewertet nicht. Keine Ampel, keine
     Farbe für gut oder schlecht, kein Sollwert, kein Hinweis auf
     „zu wenig". Auch die vier Skalenknöpfe sind gleich gefärbt.
   - Namen und Einschätzungen sind personenbezogen. Deshalb gibt es
     keinen unverschlüsselten Export, und an keiner Stelle wird HTML
     aus Eingaben gebaut – ausser im PDF des Einzelverlaufs, und dort
     wird jeder Text maskiert.
   ============================================================ */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Binoculars, ChartColumn, Check, ClipboardCheck, Copy, Database, Eye, EyeOff,
  FileDown, FileInput, ListChecks, Lock, Pencil, Play, Plus, SkipForward, Square, Trash2, UserPlus, Users,
} from 'lucide-react';

import { formatDatum } from '../../shared/datum.js';
import {
  SKALA, KATEGORIEN, RUNDE_MIN, RUNDE_MAX,
  skalaTitel, kategorieName, normalisiereRundenGroesse, istDatum,
  lerngruppenSchluessel, normalisiereLerngruppenSchluessel, lerngruppenName,
  lernendeDerGruppe, lernendeHinzufuegen, lernendeAendern, lernendeVerschieben, lernendeLoeschen,
  lernendeKopieren, beobachtungenVonLernenden,
  frageHinzufuegen, frageAendern, frageLoeschen, fragenFuer, beobachtungenZurFrage,
  erzeugeRunde, erfasseBeobachtung,
  abdeckung, lernendenUebersicht, fragenUebersicht, verlaufVon, beobachtungsUmfang,
  zusammenfuehren,
} from './beobachtung.js';
import {
  leseCapyText, vorschlagsZuordnung, capyLerngruppe, capyVorschau, capyUebernehmen, capyBerichtText,
} from './capy-import.js';
import {
  MIN_PASSWORT, erstelleSicherung, leseSicherung, istSicherung, sicherungsDateiname,
} from './beobachtung-sicherung.js';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

const BEREICHE = [
  { id: 'runde', name: 'Runde', Icon: ClipboardCheck },
  { id: 'lernende', name: 'Lernende', Icon: Users },
  { id: 'fragen', name: 'Fragen', Icon: ListChecks },
  { id: 'auswertung', name: 'Auswertung', Icon: ChartColumn },
  { id: 'daten', name: 'Daten', Icon: Database },
];

/* ---- Kleine Helfer ---------------------------------------------------- */

/* Das Kalenderdatum in der Ortszeit – nicht toISOString(), das wäre
   UTC und fiele kurz nach Mitternacht auf den Vortag. */
function lokalesDatum(d = new Date()){
  const p = (n)=> String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function anzahl(n, eins, viele){
  return `${n} ${n === 1 ? eins : viele}`;
}

function aufzaehlung(teile){
  if (teile.length < 2) return teile.join('');
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/* Mittelwerte mit genau einer Nachkommastelle. Ohne Beobachtung steht
   ein Strich – keine Null, denn eine Null wäre ein Wert. */
function mittelText(x){
  return (typeof x === 'number' && Number.isFinite(x))
    ? x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '–';
}

function datumText(iso){
  return istDatum(iso) ? formatDatum(iso) : '';
}

function fehlerText(err, ersatz){
  const t = String(err?.message || '').trim();
  return t || ersatz;
}

function dateiNameAus(pfad){
  return String(pfad || '').split(/[\\/]/).pop();
}

/* Die Tasten 1–4 gelten nur, solange niemand gerade schreibt. Ein
   Kästchen oder ein Knopf im Fokus ist kein Schreiben – eine
   Notiz, ein Namensfeld oder eine Auswahlliste schon. */
const KEINE_TEXTEINGABE = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);
function istTexteingabe(el){
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !KEINE_TEXTEINGABE.has(String(el.type || '').toLowerCase());
  return false;
}

/* Die Lerngruppen für jede Auswahl in dieser Ansicht: zuerst die aus
   der Planung (in deren Reihenfolge, die häufigsten vorn), danach die,
   die nur in den Beobachtungen vorkommen – etwa eine Klasse aus dem
   Vorjahr, eine Übernahme aus Capy-scope oder eine Gruppe, die hier
   von Hand angelegt wurde. `zusaetzlich` hält die gerade gewählte
   Gruppe in der Liste, auch wenn sie noch leer ist. */
function lerngruppenOptionen(lerngruppen, daten, zusaetzlich = []){
  const gesehen = new Set();
  const eintrag = (k)=> ({ schluessel: k, name: lerngruppenName(k) });
  const planung = [];
  for (const lg of Array.isArray(lerngruppen) ? lerngruppen : []) {
    const k = normalisiereLerngruppenSchluessel(typeof lg === 'string' ? lg : lg?.schluessel);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    planung.push(eintrag(k));
  }
  const kandidaten = [
    ...Object.keys(daten?.lernende || {}),
    ...(Array.isArray(daten?.beobachtungen) ? daten.beobachtungen : []).map(b => b?.lerngruppe),
    ...(Array.isArray(daten?.fragen) ? daten.fragen : []).filter(f => f?.geltung === 'lerngruppe').map(f => f.lerngruppe),
    ...zusaetzlich,
  ];
  const weitere = [];
  for (const roh of kandidaten) {
    const k = normalisiereLerngruppenSchluessel(roh);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    weitere.push(eintrag(k));
  }
  weitere.sort((a, b)=> a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }));
  return { planung, weitere, alle: [...planung, ...weitere] };
}

/* Die gewählte Grösse einer Runde wird zur Vorgabe für die nächste.
   beobachtung.js kennt dafür keine eigene Funktion: Die Einstellung ist
   ein einziges Feld, und normalisiereRundenGroesse hält es im
   erlaubten Bereich. Unverändert heisst: derselbe Stand, also kein
   Schreiben. */
function mitRundenGroesse(daten, n){
  const groesse = normalisiereRundenGroesse(n);
  if (daten?.einstellungen?.rundenGroesse === groesse) return daten;
  return { ...daten, einstellungen: { ...(daten?.einstellungen || {}), rundenGroesse: groesse } };
}

function beobachtungenDerGruppe(daten, k){
  return (Array.isArray(daten?.beobachtungen) ? daten.beobachtungen : []).filter(b => b.lerngruppe === k);
}

/* Der Bericht nach dem Einlesen einer Sicherung, als Satz. Er zählt nur
   Neues – wer dieselbe Sicherung zweimal einliest, soll lesen, dass
   beim zweiten Mal nichts dazukam. */
function sicherungsBerichtText(bericht, exportiertAm){
  const b = bericht || {};
  const teile = [];
  if (b.beobachtungen) teile.push(anzahl(b.beobachtungen, 'Beobachtung', 'Beobachtungen'));
  if (b.lernende) teile.push(anzahl(b.lernende, 'Lernende', 'Lernende'));
  if (b.fragen) teile.push(anzahl(b.fragen, 'Frage', 'Fragen'));
  const zeit = new Date(exportiertAm);
  const vom = Number.isFinite(zeit.getTime()) ? ` vom ${formatDatum(lokalesDatum(zeit))}` : '';
  return teile.length
    ? `Sicherung${vom} eingelesen. Neu: ${aufzaehlung(teile)}.`
    : `Sicherung${vom} eingelesen. Es war nichts Neues dabei – alles stand schon hier.`;
}

/* ---- PDF des Einzelverlaufs --------------------------------------------
   Die einzige Stelle, an der aus Eingaben HTML wird. Jeder Text – Name,
   Lerngruppe, Frage, Notiz – läuft durch escapeHtml, auch die, die
   „eigentlich" aus der App stammen: Fragen und Namen können aus einer
   eingelesenen Datei kommen.

   Gedruckt wird von alt nach neu. Auf dem Bildschirm sucht man meist
   die letzte Beobachtung, auf Papier liest man eine Entwicklung von
   vorn nach hinten. */

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pdfDateiname(name, tag){
  const sicher = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Lernende';
  return `Beobachtungen-${sicher}-${tag}.pdf`;
}

function verlaufAlsHtml({ name, lerngruppe, eintraege, tag }){
  const chronologisch = [...eintraege].reverse();
  const zeilen = chronologisch.map(({ beobachtung: b, frage })=> `
      <tr>
        <td class="datum">${escapeHtml(datumText(b.datum))}</td>
        <td>${escapeHtml(frage ? frage.text : 'Frage nicht mehr vorhanden')}</td>
        <td>${escapeHtml(frage ? kategorieName(frage.kategorie) : '')}</td>
        <td class="wert">${escapeHtml(`${b.wert} · ${skalaTitel(b.wert)}`)}</td>
        <td class="notiz">${escapeHtml(b.notiz)}</td>
      </tr>`).join('');
  const von = chronologisch.length ? datumText(chronologisch[0].beobachtung.datum) : '';
  const bis = chronologisch.length ? datumText(chronologisch[chronologisch.length - 1].beobachtung.datum) : '';
  const zeitraum = von && bis && von !== bis ? `${von} – ${bis}` : von;
  const skala = SKALA.map(s => `${s.wert} = ${s.titel} (${s.beschreibung})`).join(' · ');
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`Beobachtungen – ${name}`)}</title>
  <style>
    body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111827; font-size:12px; }
    h1{ margin:0 0 2mm 0; font-size:18px; }
    .meta{ color:#4b5563; font-size:12px; margin-bottom:5mm; }
    table{ width:100%; border-collapse:collapse; }
    th, td{ border:1px solid #d1d5db; vertical-align:top; padding:5px 6px; text-align:left; }
    th{ background:#f3f4f6; font-size:11px; }
    .datum{ white-space:nowrap; }
    .wert{ white-space:nowrap; }
    .notiz{ white-space:pre-wrap; }
    .fuss{ margin-top:5mm; color:#4b5563; font-size:10px; line-height:1.5; }
  </style>
</head>
<body>
  <h1>${escapeHtml(`Beobachtungen: ${name}`)}</h1>
  <div class="meta">${escapeHtml([lerngruppe, anzahl(chronologisch.length, 'Beobachtung', 'Beobachtungen'), zeitraum, `erstellt am ${datumText(tag)}`].filter(Boolean).join(' · '))}</div>
  <table>
    <thead>
      <tr><th>Datum</th><th>Frage</th><th>Kategorie</th><th>Einschätzung</th><th>Notiz</th></tr>
    </thead>
    <tbody>${zeilen}
    </tbody>
  </table>
  <p class="fuss">Skala: ${escapeHtml(skala)}.<br />
  Die Einträge sind Momentaufnahmen aus der Sicht der Lehrperson. Sie beschreiben, was beobachtet wurde, und sind keine Noten.</p>
</body>
</html>`;
}

/* ---- Bestätigung ---------------------------------------------------------
   Nur für Unwiederbringliches: Löschen einer Lernenden oder einer Frage
   samt ihren Beobachtungen. Im Stil der Dialoge der App; der Knopf
   benennt die Handlung. Bei einer gefährlichen Handlung liegt der
   Fokus zunächst auf „Abbrechen" – ein Enter aus Gewohnheit soll
   nichts löschen. */
function BestaetigungsDialog({ frage, onAntwort }){
  const abbrechenRef = useRef(null);
  const knopfRef = useRef(null);
  useEffect(()=>{
    if (!frage) return;
    (frage.ton === 'danger' ? abbrechenRef : knopfRef).current?.focus();
  }, [frage]);
  if (!frage) return null;
  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onAntwort(false); }}>
      <div
        className="modalCard"
        role="alertdialog"
        aria-modal="true"
        aria-label={frage.titel}
        onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); onAntwort(false); } }}
      >
        <h3 className="dialogTitle">{frage.titel}</h3>
        {frage.text ? <p className="dialogBody">{frage.text}</p> : null}
        <div className="dialogActions">
          <button ref={abbrechenRef} type="button" className="btn" onClick={()=>onAntwort(false)}>Abbrechen</button>
          <button ref={knopfRef} type="button" className={`btn ${frage.ton || 'primary'}`} onClick={()=>onAntwort(true)}>
            {frage.knopf}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Auswahl der Lerngruppe ------------------------------------------- */
function LerngruppenWahl({ id, wert, optionen, onChange, beschriftung = 'Lerngruppe' }){
  return (
    <label className="beobFeld" htmlFor={id}>
      <span className="small muted">{beschriftung}</span>
      <select id={id} className="input" value={wert} onChange={(e)=>onChange(e.target.value)}>
        {!wert ? <option value="">Lerngruppe wählen …</option> : null}
        {optionen.planung.length ? (
          <optgroup label="Aus der Planung">
            {optionen.planung.map(o => <option key={o.schluessel} value={o.schluessel}>{o.name}</option>)}
          </optgroup>
        ) : null}
        {optionen.weitere.length ? (
          <optgroup label="Weitere Lerngruppen">
            {optionen.weitere.map(o => <option key={o.schluessel} value={o.schluessel}>{o.name}</option>)}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

/* ============================================================
   Runde
   ============================================================ */
function RundeBereich({
  idBasis, daten, gruppe, optionen, onGruppe, anzahlWahl, onAnzahl,
  kontext, kontextPasst, runde, notiz, onNotiz, vormerken, onVormerkenWahl, kannVormerken,
  speichert, onStart, onAntwort, onUeberspringen, onBeenden, onNeu, onZu,
}){
  const fokusRef = useRef(null);

  /* Nach jedem Schritt steht der Fokus auf dem neuen Namen. So liest
     ein Bildschirmleser vor, wer jetzt dran ist, und die Tasten 1–4
     greifen sofort wieder – auch wenn vorher in der Notiz geschrieben
     wurde. */
  useEffect(()=>{
    if (runde) fokusRef.current?.focus?.();
  }, [runde?.id, runde?.index, runde?.fertig]);

  if (runde && runde.fertig) {
    const offen = Math.max(0, runde.eintraege.length - runde.index);
    return (
      <div className="beobRunde">
        <h3 ref={fokusRef} tabIndex={-1} className="dialogTitle beobFokusZiel">Runde beendet</h3>
        <p className="settingsText" style={{ margin: 0 }}>
          {[
            `${runde.beantwortet} beantwortet`,
            `${runde.uebersprungen} übersprungen`,
            offen ? `${offen} nicht mehr erreicht` : '',
          ].filter(Boolean).join(' · ')}
          {' · '}{lerngruppenName(runde.lerngruppe)}
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          Jede Antwort wurde schon beim Antippen gespeichert.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn primary" onClick={onNeu}><Play {...ICON_SM} /> Neue Runde</button>
          <button type="button" className="btn" onClick={()=>onZu('auswertung')}><ChartColumn {...ICON_SM} /> Zur Auswertung</button>
        </div>
      </div>
    );
  }

  if (runde) {
    const eintrag = runde.eintraege[runde.index];
    const person = lernendeDerGruppe(daten, runde.lerngruppe, { auchInaktive: true })
      .find(l => l.id === eintrag?.lernendeId) || null;
    const frage = (daten.fragen || []).find(f => f.id === eintrag?.frageId) || null;
    const gueltig = Boolean(person && frage);
    const n = runde.eintraege.length;
    const notizId = `${idBasis}-notiz`;
    return (
      <div className="beobRunde">
        <div className="beobRundeKopf">
          <span className="muted small">
            {[lerngruppenName(runde.lerngruppe), datumText(runde.datum), runde.stundenRef ? 'zur Stunde' : ''].filter(Boolean).join(' · ')}
          </span>
          <span className="beobFortschrittText" aria-live="polite">{runde.index + 1} von {n}</span>
        </div>
        <div
          className="beobFortschritt"
          role="progressbar"
          aria-label="Fortschritt der Runde"
          aria-valuemin={0}
          aria-valuemax={n}
          aria-valuenow={runde.index}
        >
          <div className="beobFortschrittFuellung" style={{ width: `${Math.round((runde.index / Math.max(1, n)) * 100)}%` }} />
        </div>

        <div className="beobRundeKarte">
          <div ref={fokusRef} tabIndex={-1} className="beobName beobFokusZiel">
            {person ? person.name : 'Nicht mehr in der Liste'}
          </div>
          <p className="beobFrageText">{frage ? frage.text : 'Diese Frage gibt es nicht mehr.'}</p>
          {frage ? (
            <div className="tagRow">
              <span className="badge">{kategorieName(frage.kategorie)}</span>
              {frage.stichwort ? <span className="badge">{frage.stichwort}</span> : null}
              {frage.kompetenz ? <span className="badge">Kompetenz: {frage.kompetenz}</span> : null}
            </div>
          ) : null}

          {!gueltig ? (
            <div className="inlineNotice inlineNotice--warning">
              Seit dem Start der Runde wurde diese Lernende oder diese Frage gelöscht. Der Eintrag
              lässt sich nur noch überspringen.
            </div>
          ) : null}

          {/* Die Notiz steht VOR der Skala: Das Antippen einer Stufe
              speichert sofort, die Notiz muss also vorher dastehen. */}
          <label className="beobFeld" htmlFor={notizId}>
            <span className="small muted">Notiz (optional)</span>
            <textarea
              id={notizId}
              className="beobNotiz"
              rows={2}
              value={notiz}
              disabled={!gueltig}
              onChange={(e)=>onNotiz(e.target.value)}
              placeholder="z. B. hat in der Gruppenarbeit die Ergebnisse zusammengetragen"
            />
          </label>
          {kannVormerken ? (
            <label className="beobHaken">
              <input
                type="checkbox"
                checked={vormerken}
                disabled={!gueltig || !notiz.trim()}
                onChange={(e)=>onVormerkenWahl(e.target.checked)}
              />
              <span>
                Notiz für die nächste Stunde vormerken
                <span className="muted small beobHakenHinweis">
                  Übernommen wird nur der Notiztext – ohne Namen. Formuliere ihn so, dass er
                  auch ohne Namen verständlich ist.
                </span>
              </span>
            </label>
          ) : null}

          <div className="beobSkala" role="group" aria-label="Einschätzung wählen">
            {SKALA.map(s => (
              <button
                key={s.wert}
                type="button"
                className="beobSkalaKnopf"
                disabled={!gueltig || speichert}
                aria-keyshortcuts={String(s.wert)}
                aria-label={`${s.wert}: ${s.titel} – ${s.beschreibung}`}
                onClick={()=>onAntwort(s.wert)}
              >
                <span className="beobSkalaTaste" aria-hidden="true">{s.wert}</span>
                <span className="beobSkalaTitel">{s.titel}</span>
                <span className="beobSkalaText">{s.beschreibung}</span>
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Die Tasten 1 bis 4 wählen eine Stufe, solange kein Eingabefeld aktiv ist.
          </p>

          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn" disabled={speichert} onClick={onUeberspringen}>
              <SkipForward {...ICON_SM} /> Überspringen
            </button>
            <button type="button" className="btn" disabled={speichert} onClick={onBeenden}>
              <Square {...ICON_SM} /> Runde beenden
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Einrichtung einer Runde */
  const lernende = gruppe ? lernendeDerGruppe(daten, gruppe) : [];
  const fragen = gruppe ? fragenFuer(daten, gruppe) : [];
  const bisher = gruppe ? beobachtungenDerGruppe(daten, gruppe).length : 0;
  const vorgabe = normalisiereRundenGroesse(daten?.einstellungen?.rundenGroesse);
  const groesse = normalisiereRundenGroesse(anzahlWahl ?? vorgabe);
  const groessen = [];
  for (let i = RUNDE_MIN; i <= RUNDE_MAX; i += 1) groessen.push(i);

  return (
    <div className="beobRunde">
      <div>
        <h3 className="settingsHeading">Runde nach der Stunde</h3>
        <p className="settingsText muted small" style={{ margin: 0 }}>
          Eine Runde schlägt Paare aus Lernenden und Fragen vor – zuerst die, die bisher selten
          dran waren. Paare, die heute schon dran waren, kommen erst, wenn alle anderen durch
          sind. Jede Antwort wird sofort gespeichert.
        </p>
      </div>

      <div className="beobFelder">
        <LerngruppenWahl id={`${idBasis}-runde-gruppe`} wert={gruppe} optionen={optionen} onChange={onGruppe} />
        <label className="beobFeld beobFeld--schmal" htmlFor={`${idBasis}-runde-anzahl`}>
          <span className="small muted">Einschätzungen</span>
          <select
            id={`${idBasis}-runde-anzahl`}
            className="input"
            value={groesse}
            onChange={(e)=>onAnzahl(Number(e.target.value))}
          >
            {groessen.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Die gewählte Anzahl gilt beim nächsten Mal als Vorgabe.</p>

      {kontext ? (
        kontextPasst ? (
          <div className="inlineNotice">
            Die Runde gehört zur Stunde <b>{kontext.titel || lerngruppenName(gruppe)}</b>
            {istDatum(kontext.datum) ? <> am {formatDatum(kontext.datum)}</> : null}. Die Beobachtungen tragen
            dieses Datum.
          </div>
        ) : (
          <div className="inlineNotice">
            Diese Lerngruppe gehört nicht zur Stunde „{kontext.titel || lerngruppenName(normalisiereLerngruppenSchluessel(kontext.lerngruppe))}“.
            Die Antworten werden ohne Bezug zur Stunde mit dem heutigen Datum gespeichert.
          </div>
        )
      ) : null}

      {!gruppe ? (
        <div className="emptyState">
          <p className="emptyStateText">
            Noch keine Lerngruppe. Lerngruppen kommen aus der Planung – oder du legst unter
            „Lernende“ eine eigene an.
          </p>
          <button type="button" className="btn primary" onClick={()=>onZu('lernende')}>
            <Users {...ICON_SM} /> Zu den Lernenden
          </button>
        </div>
      ) : !lernende.length ? (
        <div className="emptyState">
          <p className="emptyStateText">
            Für {lerngruppenName(gruppe)} stehen noch keine Lernenden in der Liste. Eine Runde
            braucht mindestens einen Namen.
          </p>
          <button type="button" className="btn primary" onClick={()=>onZu('lernende')}>
            <UserPlus {...ICON_SM} /> Lernende eintragen
          </button>
        </div>
      ) : !fragen.length ? (
        <div className="emptyState">
          <p className="emptyStateText">
            Für {lerngruppenName(gruppe)} ist keine Frage aktiv. Unter „Fragen“ lassen sich
            Fragen anlegen oder wieder einschalten.
          </p>
          <button type="button" className="btn primary" onClick={()=>onZu('fragen')}>
            <ListChecks {...ICON_SM} /> Zu den Fragen
          </button>
        </div>
      ) : (
        <div className="row wrap" style={{ gap: 12 }}>
          <button type="button" className="btn primary" onClick={()=>onStart(groesse)}>
            <Play {...ICON_SM} /> Runde starten
          </button>
          <span className="muted small">
            {[
              anzahl(lernende.length, 'Lernende', 'Lernende'),
              anzahl(fragen.length, 'Frage', 'Fragen'),
              `bisher ${anzahl(bisher, 'Beobachtung', 'Beobachtungen')}`,
            ].join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Lernende
   ============================================================ */
function LernendeBereich({ idBasis, daten, gruppe, optionen, onGruppe, aendere, bestaetige, toast }){
  const [umbenennen, setUmbenennen] = useState(null);      // { id, name }
  const [einfuegen, setEinfuegen] = useState('');
  const [quelle, setQuelle] = useState('');
  const [neueGruppe, setNeueGruppe] = useState(null);      // { klasse, fach }

  const liste = gruppe ? lernendeDerGruppe(daten, gruppe, { auchInaktive: true }) : [];
  const quellen = optionen.alle.filter(o => o.schluessel !== gruppe && lernendeDerGruppe(daten, o.schluessel).length > 0);
  const gewaehlteQuelle = quellen.some(q => q.schluessel === quelle) ? quelle : (quellen[0]?.schluessel || '');

  const anzahlIn = (d)=> lernendeDerGruppe(d, gruppe, { auchInaktive: true }).length;

  const hinzufuegen = async ()=>{
    if (!gruppe || !einfuegen.trim()) return;
    let neu = 0;
    const { gerufen } = await aendere((d)=>{
      const vorher = anzahlIn(d);
      const n = lernendeHinzufuegen(d, gruppe, einfuegen);
      neu = anzahlIn(n) - vorher;
      return n;
    });
    if (!gerufen) return;
    setEinfuegen('');
    toast(neu
      ? `${anzahl(neu, 'Name', 'Namen')} hinzugefügt.`
      : 'Diese Namen stehen schon in der Liste.', { tone: neu ? 'success' : undefined });
  };

  const kopieren = async ()=>{
    if (!gruppe || !gewaehlteQuelle) return;
    let neu = 0;
    const { gerufen } = await aendere((d)=>{
      const vorher = anzahlIn(d);
      const n = lernendeKopieren(d, gewaehlteQuelle, gruppe);
      neu = anzahlIn(n) - vorher;
      return n;
    });
    if (!gerufen) return;
    toast(neu
      ? `${anzahl(neu, 'Name', 'Namen')} aus ${lerngruppenName(gewaehlteQuelle)} übernommen. Beobachtungen wurden nicht kopiert.`
      : `Alle Namen aus ${lerngruppenName(gewaehlteQuelle)} stehen schon in der Liste.`, { tone: neu ? 'success' : undefined });
  };

  const umbenennenSpeichern = async ()=>{
    if (!umbenennen) return;
    const { id, name } = umbenennen;
    if (!name.trim()) { setUmbenennen(null); return; }
    await aendere(d => lernendeAendern(d, gruppe, id, { name }));
    setUmbenennen(null);
  };

  const loeschen = async (l)=>{
    const n = beobachtungenVonLernenden(daten, gruppe, l.id);
    const ok = await bestaetige({
      titel: 'Lernende löschen',
      text: n
        ? `„${l.name}“ wird aus der Liste von ${lerngruppenName(gruppe)} gelöscht – zusammen mit ${anzahl(n, 'Beobachtung', 'Beobachtungen')}. Das lässt sich nicht rückgängig machen. Wer nur die Klasse verlassen hat, lässt sich stattdessen ausblenden; die Beobachtungen bleiben dann erhalten.`
        : `„${l.name}“ wird aus der Liste von ${lerngruppenName(gruppe)} gelöscht. Zu diesem Namen gibt es keine Beobachtungen.`,
      knopf: n ? `Mit ${anzahl(n, 'Beobachtung', 'Beobachtungen')} löschen` : 'Löschen',
      ton: 'danger',
    });
    if (!ok) return;
    const { geaendert } = await aendere(d => lernendeLoeschen(d, gruppe, l.id));
    if (geaendert) toast(`„${l.name}“ gelöscht.`);
  };

  const neueGruppeWaehlen = (e)=>{
    e.preventDefault();
    const k = lerngruppenSchluessel(neueGruppe?.klasse, neueGruppe?.fach);
    if (!k) return;
    onGruppe(k);
    setNeueGruppe(null);
  };

  return (
    <div className="beobBereich">
      <div className="beobFelder">
        <LerngruppenWahl id={`${idBasis}-lernende-gruppe`} wert={gruppe} optionen={optionen} onChange={onGruppe} />
        {!neueGruppe ? (
          <button type="button" className="btn" onClick={()=>setNeueGruppe({ klasse: '', fach: '' })}>
            <Plus {...ICON_SM} /> Andere Lerngruppe …
          </button>
        ) : null}
      </div>

      {neueGruppe ? (
        <form className="beobFormular" onSubmit={neueGruppeWaehlen}
              onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); setNeueGruppe(null); } }}>
          <p className="muted small" style={{ margin: 0 }}>
            Für eine Lerngruppe, die (noch) nicht in der Planung steht – etwa die eigene Klasse
            ohne Fach. Sie bleibt in der Auswahl, sobald sie Lernende hat.
          </p>
          <div className="beobFelder">
            <label className="beobFeld">
              <span className="small muted">Klasse</span>
              <input className="input" autoFocus value={neueGruppe.klasse} placeholder="z. B. 6a"
                     onChange={(e)=>{ const klasse = e.target.value; setNeueGruppe(v => ({ ...v, klasse })); }} />
            </label>
            <label className="beobFeld">
              <span className="small muted">Fach (optional)</span>
              <input className="input" value={neueGruppe.fach} placeholder="z. B. Französisch"
                     onChange={(e)=>{ const fach = e.target.value; setNeueGruppe(v => ({ ...v, fach })); }} />
            </label>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="submit" className="btn primary" disabled={!String(neueGruppe.klasse).trim()}>Auswählen</button>
            <button type="button" className="btn" onClick={()=>setNeueGruppe(null)}>Abbrechen</button>
          </div>
        </form>
      ) : null}

      <div className="inlineNotice">
        <b>Vornamen oder Kürzel genügen.</b> Die Runde braucht nur einen Namen, den du im Raum
        zuordnen kannst. Je weniger in der Liste steht, desto weniger steht auch in einer
        Sicherung.
      </div>

      {!gruppe ? (
        <p className="muted">Wähle oben eine Lerngruppe oder lege eine an.</p>
      ) : (
        <>
          <section className="beobAbschnitt" aria-label={`Lernende in ${lerngruppenName(gruppe)}`}>
            <h3 className="settingsHeading">
              {lerngruppenName(gruppe)} · {anzahl(liste.length, 'Name', 'Namen')}
            </h3>
            {!liste.length ? (
              <p className="muted small">Noch niemand in der Liste. Unten lassen sich Namen einfügen.</p>
            ) : (
              <ol className="beobListe">
                {liste.map((l, i)=>{
                  const nB = beobachtungenVonLernenden(daten, gruppe, l.id);
                  const aus = l.aktiv === false;
                  const bearbeitet = umbenennen?.id === l.id;
                  return (
                    <li key={l.id} className={`beobZeile${aus ? ' is-aus' : ''}`}>
                      <span className="beobNummer">{i + 1}.</span>
                      {bearbeitet ? (
                        <form
                          className="beobInline"
                          onSubmit={(e)=>{ e.preventDefault(); umbenennenSpeichern(); }}
                          onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); setUmbenennen(null); } }}
                        >
                          <input
                            className="input"
                            autoFocus
                            aria-label={`Neuer Name für ${l.name}`}
                            value={umbenennen.name}
                            onChange={(e)=>{ const name = e.target.value; setUmbenennen(v => ({ ...v, name })); }}
                          />
                          <button type="submit" className="btn btnMini primary" disabled={!umbenennen.name.trim()}>
                            <Check {...ICON_SM} /> Übernehmen
                          </button>
                          <button type="button" className="btn btnMini" onClick={()=>setUmbenennen(null)}>Abbrechen</button>
                        </form>
                      ) : (
                        <>
                          <span className="beobZeileText">
                            <span className="beobZeileName">{l.name}</span>
                            {aus ? <span className="badge">ausgeblendet</span> : null}
                            <span className="muted small">{anzahl(nB, 'Beobachtung', 'Beobachtungen')}</span>
                          </span>
                          <span className="beobZeileAktionen">
                            <button type="button" className="iconBtn" disabled={i === 0}
                                    aria-label={`${l.name} nach oben`} title="Nach oben"
                                    onClick={()=>aendere(d => lernendeVerschieben(d, gruppe, l.id, -1))}>
                              <ArrowUp {...ICON_SM} />
                            </button>
                            <button type="button" className="iconBtn" disabled={i === liste.length - 1}
                                    aria-label={`${l.name} nach unten`} title="Nach unten"
                                    onClick={()=>aendere(d => lernendeVerschieben(d, gruppe, l.id, 1))}>
                              <ArrowDown {...ICON_SM} />
                            </button>
                            <button type="button" className="btn btnMini"
                                    aria-label={`${l.name} umbenennen`}
                                    onClick={()=>setUmbenennen({ id: l.id, name: l.name })}>
                              <Pencil {...ICON_SM} /> Umbenennen
                            </button>
                            <button type="button" className="btn btnMini"
                                    aria-label={`${l.name} ${aus ? 'einblenden' : 'ausblenden'}`}
                                    title={aus
                                      ? 'Kommt wieder in Runden vor.'
                                      : 'Kommt in keiner Runde mehr vor. Die Beobachtungen bleiben erhalten.'}
                                    onClick={()=>aendere(d => lernendeAendern(d, gruppe, l.id, { aktiv: aus }))}>
                              {aus ? <><Eye {...ICON_SM} /> Einblenden</> : <><EyeOff {...ICON_SM} /> Ausblenden</>}
                            </button>
                            <button type="button" className="btn btnMini"
                                    aria-label={`${l.name} löschen`}
                                    onClick={()=>loeschen(l)}>
                              <Trash2 {...ICON_SM} /> Löschen
                            </button>
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              <b>Ausblenden</b> ist für alle, die die Klasse verlassen haben: Die Beobachtungen
              bleiben, der Name kommt in keiner Runde mehr vor. <b>Löschen</b> entfernt den Namen
              samt allen Beobachtungen in dieser Lerngruppe.
            </p>
          </section>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Namen einfügen</h3>
            <p className="muted small" style={{ margin: '0 0 6px' }}>
              Ein Name je Zeile – etwa aus einer Tabelle kopiert. Namen, die schon in der Liste
              stehen, werden übergangen.
            </p>
            <textarea
              className="beobNamenFeld"
              rows={5}
              value={einfuegen}
              aria-label="Namen, einer je Zeile"
              placeholder={'Mia\nNoah\nLeonie'}
              onChange={(e)=>setEinfuegen(e.target.value)}
            />
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button type="button" className="btn primary" disabled={!einfuegen.trim()} onClick={hinzufuegen}>
                <UserPlus {...ICON_SM} /> Namen hinzufügen
              </button>
            </div>
          </section>

          {quellen.length ? (
            <section className="beobAbschnitt">
              <h3 className="settingsHeading">Liste aus anderer Lerngruppe übernehmen</h3>
              <p className="muted small" style={{ margin: '0 0 6px' }}>
                Für dieselbe Klasse in einem zweiten Fach. Übernommen werden die eingeblendeten
                Namen, keine Beobachtungen.
              </p>
              <div className="beobFelder">
                <label className="beobFeld" htmlFor={`${idBasis}-kopier-quelle`}>
                  <span className="small muted">Von</span>
                  <select id={`${idBasis}-kopier-quelle`} className="input" value={gewaehlteQuelle}
                          onChange={(e)=>setQuelle(e.target.value)}>
                    {quellen.map(q => (
                      <option key={q.schluessel} value={q.schluessel}>
                        {q.name} ({anzahl(lernendeDerGruppe(daten, q.schluessel).length, 'Name', 'Namen')})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn" onClick={kopieren}>
                  <Copy {...ICON_SM} /> Liste übernehmen
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Fragen
   ============================================================ */
function leereFrage(){
  return { text: '', kategorie: 'Mitarbeit', stichwort: '', geltung: '', kompetenz: '' };
}

/* `geltung` ist hier '' für „alle Lerngruppen" oder der Schlüssel der
   einen Lerngruppe. Das spart ein zweites Feld, das ohnehin nur
   zusammen mit dem ersten Sinn ergäbe. */
function FrageFormular({ idPraefix, wert, onChange, optionen, datalistId, aktuelleGruppe = '' }){
  const setze = (feld)=> (e)=> onChange({ ...wert, [feld]: e.target.value });
  const gruppen = [...optionen.alle];
  if (aktuelleGruppe && !gruppen.some(o => o.schluessel === aktuelleGruppe)) {
    gruppen.push({ schluessel: aktuelleGruppe, name: lerngruppenName(aktuelleGruppe) });
  }
  return (
    <>
      <label className="beobFeld" htmlFor={`${idPraefix}-text`}>
        <span className="small muted">Frage</span>
        <textarea id={`${idPraefix}-text`} className="beobFrageFeld" rows={2} value={wert.text}
                  placeholder="z. B. Der Lernende benutzt die Zielsprache auch spontan."
                  onChange={setze('text')} />
      </label>
      <div className="beobFelder">
        <label className="beobFeld" htmlFor={`${idPraefix}-kategorie`}>
          <span className="small muted">Kategorie</span>
          <select id={`${idPraefix}-kategorie`} className="input" value={wert.kategorie} onChange={setze('kategorie')}>
            {KATEGORIEN.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </label>
        <label className="beobFeld" htmlFor={`${idPraefix}-stichwort`}>
          <span className="small muted">Stichwort (optional)</span>
          <input id={`${idPraefix}-stichwort`} className="input" value={wert.stichwort}
                 placeholder="z. B. mündliche Beteiligung" onChange={setze('stichwort')} />
        </label>
      </div>
      <div className="beobFelder">
        <label className="beobFeld" htmlFor={`${idPraefix}-geltung`}>
          <span className="small muted">Gilt für</span>
          <select id={`${idPraefix}-geltung`} className="input" value={wert.geltung} onChange={setze('geltung')}>
            <option value="">Alle Lerngruppen</option>
            {gruppen.map(o => <option key={o.schluessel} value={o.schluessel}>Nur {o.name}</option>)}
          </select>
        </label>
        <label className="beobFeld" htmlFor={`${idPraefix}-kompetenz`}>
          <span className="small muted">Kompetenz (optional)</span>
          <input id={`${idPraefix}-kompetenz`} className="input" list={datalistId} value={wert.kompetenz}
                 placeholder="aus dem Katalog oder frei" onChange={setze('kompetenz')} />
        </label>
      </div>
    </>
  );
}

function FragenBereich({ idBasis, daten, optionen, aendere, bestaetige, toast, kompetenzVorschlaege }){
  const [neu, setNeu] = useState(leereFrage);
  const [bearbeiten, setBearbeiten] = useState(null);       // { id, ...Felder wie leereFrage }
  const datalistId = `${idBasis}-kompetenzen`;

  const fragen = Array.isArray(daten.fragen) ? daten.fragen : [];
  const allgemein = fragen.filter(f => f.geltung !== 'lerngruppe');
  const gruppenMitFragen = [...new Set(fragen.filter(f => f.geltung === 'lerngruppe').map(f => f.lerngruppe))]
    .sort((a, b)=> lerngruppenName(a).localeCompare(lerngruppenName(b), 'de', { numeric: true, sensitivity: 'base' }));

  const vorschlaege = useMemo(()=>{
    const gesehen = new Set();
    const out = [];
    for (const k of Array.isArray(kompetenzVorschlaege) ? kompetenzVorschlaege : []) {
      const t = String(k ?? '').trim();
      if (!t || gesehen.has(t)) continue;
      gesehen.add(t);
      out.push(t);
    }
    return out;
  }, [kompetenzVorschlaege]);

  const alsEingabe = (w)=> ({
    text: w.text,
    kategorie: w.kategorie,
    stichwort: w.stichwort,
    geltung: w.geltung ? 'lerngruppe' : 'allgemein',
    lerngruppe: w.geltung,
    kompetenz: w.kompetenz,
  });

  const anlegen = async (e)=>{
    e.preventDefault();
    if (!neu.text.trim()) return;
    const { geaendert } = await aendere(d => frageHinzufuegen(d, alsEingabe(neu)));
    if (!geaendert) return;
    // Kategorie und Geltung bleiben stehen: Fragen entstehen oft in Serie.
    setNeu(v => ({ ...leereFrage(), kategorie: v.kategorie, geltung: v.geltung }));
    toast('Frage angelegt.', { tone: 'success' });
  };

  const speichern = async (e)=>{
    e.preventDefault();
    if (!bearbeiten || !bearbeiten.text.trim()) return;
    await aendere(d => frageAendern(d, bearbeiten.id, alsEingabe(bearbeiten)));
    setBearbeiten(null);
  };

  const loeschen = async (f)=>{
    const n = beobachtungenZurFrage(daten, f.id);
    const ok = await bestaetige({
      titel: 'Frage löschen',
      text: n
        ? `„${f.text}“ wird gelöscht – zusammen mit ${anzahl(n, 'Beobachtung', 'Beobachtungen')} in allen Lerngruppen. Das lässt sich nicht rückgängig machen. Wer die Frage nur nicht mehr stellen will, schaltet sie aus; die Beobachtungen bleiben dann erhalten.`
        : `„${f.text}“ wird gelöscht. Zu dieser Frage gibt es keine Beobachtungen.`,
      knopf: n ? `Mit ${anzahl(n, 'Beobachtung', 'Beobachtungen')} löschen` : 'Löschen',
      ton: 'danger',
    });
    if (!ok) return;
    const { geaendert } = await aendere(d => frageLoeschen(d, f.id));
    if (geaendert) toast('Frage gelöscht.');
  };

  const zeile = (f)=>{
    const aus = f.aktiv === false;
    if (bearbeiten?.id === f.id) {
      return (
        <li key={f.id} className="beobFrage">
          <form className="beobFormular" onSubmit={speichern}
                onKeyDown={(e)=>{ if (e.key === 'Escape') { e.stopPropagation(); setBearbeiten(null); } }}>
            <FrageFormular
              idPraefix={`${idBasis}-frage-${f.id}`}
              wert={bearbeiten}
              onChange={setBearbeiten}
              optionen={optionen}
              datalistId={datalistId}
              aktuelleGruppe={f.lerngruppe}
            />
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="submit" className="btn primary" disabled={!bearbeiten.text.trim()}>
                <Check {...ICON_SM} /> Speichern
              </button>
              <button type="button" className="btn" onClick={()=>setBearbeiten(null)}>Abbrechen</button>
            </div>
          </form>
        </li>
      );
    }
    const n = beobachtungenZurFrage(daten, f.id);
    return (
      <li key={f.id} className={`beobFrage${aus ? ' is-aus' : ''}`}>
        <div className="beobFrageKopf">
          <span className="beobFrageTitel">{f.text}</span>
          <label className="beobSchalter" title={aus
            ? 'Ausgeschaltet: kommt in keiner Runde vor, die Beobachtungen bleiben.'
            : 'Eingeschaltet: kann in Runden vorkommen.'}>
            <input
              type="checkbox"
              checked={!aus}
              aria-label={`aktiv: Frage „${f.text}“ in Runden stellen`}
              onChange={(e)=>{
                /* Den Wert sofort lesen: Die Änderung läuft erst nach dem Laden,
                   und bis dahin hat React das Kästchen auf den alten Stand
                   zurückgesetzt. */
                const aktiv = e.target.checked;
                aendere(d => frageAendern(d, f.id, { aktiv }));
              }}
            />
            <span>aktiv</span>
          </label>
        </div>
        <div className="tagRow beobPlaketten">
          <span className="badge">{kategorieName(f.kategorie)}</span>
          {f.stichwort ? <span className="badge">{f.stichwort}</span> : null}
          {f.kompetenz ? <span className="badge">Kompetenz: {f.kompetenz}</span> : null}
          {f.standard ? <span className="badge">mitgeliefert</span> : null}
          {aus ? <span className="badge">ausgeschaltet</span> : null}
        </div>
        <div className="beobZeileAktionen">
          <span className="muted small">{anzahl(n, 'Beobachtung', 'Beobachtungen')}</span>
          <button type="button" className="btn btnMini" aria-label={`Frage „${f.text}“ bearbeiten`}
                  onClick={()=>setBearbeiten({
                    id: f.id, text: f.text, kategorie: f.kategorie, stichwort: f.stichwort,
                    geltung: f.geltung === 'lerngruppe' ? f.lerngruppe : '', kompetenz: f.kompetenz,
                  })}>
            <Pencil {...ICON_SM} /> Bearbeiten
          </button>
          <button type="button" className="btn btnMini" aria-label={`Frage „${f.text}“ löschen`}
                  onClick={()=>loeschen(f)}>
            <Trash2 {...ICON_SM} /> Löschen
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="beobBereich">
      <datalist id={datalistId}>
        {vorschlaege.map(k => <option key={k} value={k} />)}
      </datalist>

      <section>
        <h3 className="settingsHeading">Neue Frage</h3>
        <form className="beobFormular" onSubmit={anlegen}>
          <FrageFormular
            idPraefix={`${idBasis}-neue-frage`}
            wert={neu}
            onChange={setNeu}
            optionen={optionen}
            datalistId={datalistId}
          />
          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn primary" disabled={!neu.text.trim()}>
              <Plus {...ICON_SM} /> Frage anlegen
            </button>
          </div>
        </form>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Die Skala ist für alle Fragen dieselbe: {SKALA.map(s => s.titel).join(', ')}. Formuliere
          Fragen deshalb als Aussage, der man mehr oder weniger zustimmen kann.
        </p>
      </section>

      <section className="beobAbschnitt" aria-label="Für alle Lerngruppen">
        <h3 className="settingsHeading">Für alle Lerngruppen · {allgemein.length}</h3>
        {allgemein.length ? (
          <ul className="beobFragen">{allgemein.map(zeile)}</ul>
        ) : (
          <p className="muted small">Keine gemeinsamen Fragen.</p>
        )}
      </section>

      {gruppenMitFragen.map(k => {
        const eigene = fragen.filter(f => f.geltung === 'lerngruppe' && f.lerngruppe === k);
        return (
          <section key={k} className="beobAbschnitt" aria-label={`Nur ${lerngruppenName(k)}`}>
            <h3 className="settingsHeading">Nur {lerngruppenName(k)} · {eigene.length}</h3>
            <ul className="beobFragen">{eigene.map(zeile)}</ul>
          </section>
        );
      })}

      <p className="muted small" style={{ margin: 0 }}>
        <b>Ausschalten</b> behält alle Beobachtungen zur Frage; sie kommt nur in keiner Runde mehr
        vor. <b>Löschen</b> entfernt die Frage samt ihren Beobachtungen in allen Lerngruppen.
      </p>
    </div>
  );
}

/* ============================================================
   Auswertung

   Rein beschreibend: wie oft, mit welcher Tendenz, wann zuletzt. Die
   Zahlen stehen in neutraler Schrift, ohne Farbe und ohne Markierung
   auffälliger Werte – was sie bedeuten, entscheidet die Lehrperson.
   ============================================================ */
function AuswertungBereich({ idBasis, daten, gruppe, optionen, onGruppe, onZu, exportierePdf, heute, toast }){
  const [verlaufId, setVerlaufId] = useState('');

  const uebersicht = useMemo(()=> (gruppe ? lernendenUebersicht(daten, gruppe) : []), [daten, gruppe]);
  const abd = useMemo(()=> (gruppe ? abdeckung(daten, gruppe) : { paare: 0, beobachtet: 0, prozent: 0 }), [daten, gruppe]);
  const fragenU = useMemo(()=> (gruppe ? fragenUebersicht(daten, gruppe) : []), [daten, gruppe]);
  const gesamt = useMemo(()=> (gruppe ? beobachtungenDerGruppe(daten, gruppe).length : 0), [daten, gruppe]);

  const aktive = uebersicht.filter(u => u.lernende.aktiv !== false).length;
  const ausgeblendet = uebersicht.length - aktive;
  const gewaehlt = uebersicht.find(u => u.lernende.id === verlaufId)?.lernende || null;
  const verlauf = useMemo(()=> (gewaehlt ? verlaufVon(daten, gruppe, gewaehlt.id) : []), [daten, gruppe, gewaehlt]);

  const alsPdf = async ()=>{
    if (!gewaehlt || !verlauf.length || typeof exportierePdf !== 'function') return;
    const html = verlaufAlsHtml({ name: gewaehlt.name, lerngruppe: lerngruppenName(gruppe), eintraege: verlauf, tag: heute });
    try {
      await exportierePdf({ html, fileName: pdfDateiname(gewaehlt.name, heute) });
    } catch (err) {
      toast(fehlerText(err, 'Das PDF konnte nicht erstellt werden.'), { tone: 'warning' });
    }
  };

  return (
    <div className="beobBereich">
      <div className="beobFelder">
        <LerngruppenWahl id={`${idBasis}-auswertung-gruppe`} wert={gruppe} optionen={optionen} onChange={onGruppe} />
      </div>

      {!gruppe ? (
        <p className="muted">Noch keine Lerngruppe mit Beobachtungen.</p>
      ) : !uebersicht.length && !gesamt ? (
        <div className="emptyState">
          <p className="emptyStateText">Für {lerngruppenName(gruppe)} gibt es noch keine Lernenden und keine Beobachtungen.</p>
          <button type="button" className="btn" onClick={()=>onZu('lernende')}><Users {...ICON_SM} /> Zu den Lernenden</button>
        </div>
      ) : (
        <>
          <div className="beobKennzahlen">
            <div className="beobKennzahl">
              <div className="beobKennzahlWert">{aktive}</div>
              <div className="beobKennzahlName">
                Lernende{ausgeblendet ? ` · dazu ${ausgeblendet} ausgeblendet` : ''}
              </div>
            </div>
            <div className="beobKennzahl">
              <div className="beobKennzahlWert">{gesamt}</div>
              <div className="beobKennzahlName">Beobachtungen</div>
            </div>
            <div className="beobKennzahl">
              <div className="beobKennzahlWert">{abd.paare ? `${abd.prozent} %` : '–'}</div>
              <div className="beobKennzahlName">
                Abdeckung · {abd.beobachtet} von {anzahl(abd.paare, 'Paar', 'Paaren')} aus Lernenden und Fragen
              </div>
            </div>
          </div>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Je Lernende</h3>
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Mittel auf der Skala von 1 ({SKALA[0].titel}) bis 4 ({SKALA[SKALA.length - 1].titel}).
              Ein Name öffnet unten den Einzelverlauf.
            </p>
            <div className="beobTabelleWrap">
              <table className="beobTabelle">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col" className="beobZahl">Anzahl</th>
                    <th scope="col" className="beobZahl">Mittel</th>
                    {KATEGORIEN.map(k => <th key={k.id} scope="col" className="beobZahl">{k.name}</th>)}
                    <th scope="col">Zuletzt</th>
                  </tr>
                </thead>
                <tbody>
                  {uebersicht.map(u => (
                    <tr key={u.lernende.id} className={u.lernende.aktiv === false ? 'is-aus' : ''}>
                      <th scope="row">
                        <button
                          type="button"
                          className={`beobNameKnopf${verlaufId === u.lernende.id ? ' is-active' : ''}`}
                          aria-pressed={verlaufId === u.lernende.id}
                          onClick={()=>setVerlaufId(verlaufId === u.lernende.id ? '' : u.lernende.id)}
                        >{u.lernende.name}</button>
                        {u.lernende.aktiv === false ? <span className="muted small"> · ausgeblendet</span> : null}
                      </th>
                      <td className="beobZahl">{u.anzahl}</td>
                      <td className="beobZahl">{mittelText(u.mittel)}</td>
                      {KATEGORIEN.map(k => <td key={k.id} className="beobZahl">{mittelText(u.jeKategorie[k.id])}</td>)}
                      <td>{datumText(u.letzteDatum) || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Je Frage</h3>
            {fragenU.length ? (
              <div className="beobTabelleWrap">
                <table className="beobTabelle">
                  <thead>
                    <tr>
                      <th scope="col">Frage</th>
                      <th scope="col">Kategorie</th>
                      <th scope="col" className="beobZahl">Beobachtungen</th>
                      <th scope="col" className="beobZahl">Lernende mit Beobachtung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fragenU.map(e => (
                      <tr key={e.frage.id} className={e.frage.aktiv === false ? 'is-aus' : ''}>
                        <td>
                          {e.frage.text}
                          {e.frage.geltung === 'lerngruppe' ? <span className="muted small"> · nur diese Lerngruppe</span> : null}
                          {e.frage.aktiv === false ? <span className="muted small"> · ausgeschaltet</span> : null}
                        </td>
                        <td>{kategorieName(e.frage.kategorie)}</td>
                        <td className="beobZahl">{e.anzahl}</td>
                        <td className="beobZahl">{e.lernendeMitBeobachtung}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted small">In dieser Lerngruppe gilt keine Frage.</p>
            )}
          </section>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Einzelverlauf</h3>
            <div className="beobFelder">
              <label className="beobFeld" htmlFor={`${idBasis}-verlauf-wahl`}>
                <span className="small muted">Lernende</span>
                <select id={`${idBasis}-verlauf-wahl`} className="input" value={gewaehlt ? gewaehlt.id : ''}
                        onChange={(e)=>setVerlaufId(e.target.value)}>
                  <option value="">Bitte wählen …</option>
                  {uebersicht.map(u => (
                    <option key={u.lernende.id} value={u.lernende.id}>
                      {u.lernende.name}{u.lernende.aktiv === false ? ' (ausgeblendet)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {typeof exportierePdf === 'function' ? (
                <button type="button" className="btn iconBtn-pdf" disabled={!gewaehlt || !verlauf.length} onClick={alsPdf}>
                  <FileDown {...ICON_SM} /> Als PDF
                </button>
              ) : null}
            </div>
            {!gewaehlt ? null : !verlauf.length ? (
              <p className="muted small">Zu {gewaehlt.name} gibt es in dieser Lerngruppe noch keine Beobachtung.</p>
            ) : (
              <ol className="beobVerlauf" aria-label={`Beobachtungen zu ${gewaehlt.name}, neueste zuerst`}>
                {verlauf.map(({ beobachtung: b, frage })=>(
                  <li key={b.id} className="beobVerlaufEintrag">
                    <div className="beobVerlaufKopf">
                      <span>{datumText(b.datum)}</span>
                      <span className="beobVerlaufWert">{b.wert} · {skalaTitel(b.wert)}</span>
                      {frage ? <span>{kategorieName(frage.kategorie)}</span> : null}
                    </div>
                    <div>{frage ? frage.text : <span className="muted">Frage nicht mehr vorhanden</span>}</div>
                    {b.notiz ? <div className="beobVerlaufNotiz">{b.notiz}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Daten: Sicherung, Einlesen, Übernahme aus Capy-scope

   Eine Datei kann hier zweierlei sein: eine eigene, verschlüsselte
   Sicherung oder ein Export aus Capy-scope. Welcher Knopf gedrückt
   wurde, ist dabei zweitrangig – erkannt wird an der Datei. Wer unter
   „Sicherung einlesen" einen Capy-Export wählt, landet in der Vorschau
   der Übernahme, und umgekehrt. Beides schreibt erst nach einem
   ausdrücklichen Klick.
   ============================================================ */
function DatenBereich({
  idBasis, daten, speicher, optionen, aendere, toast,
  kannDateien, exportiereDatei, importiereDatei, appVersion,
}){
  const [laeuft, setLaeuft] = useState('');                 // '' | 'sichern' | 'datei' | 'einlesen' | 'capy'
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [sicherung, setSicherung] = useState(null);         // { name, content }
  const [pwEin, setPwEin] = useState('');
  const [einlesenFehler, setEinlesenFehler] = useState('');
  const [capy, setCapy] = useState(null);                   // { name, capy }
  const [zuordnung, setZuordnung] = useState({});
  const [dateiFehler, setDateiFehler] = useState('');
  const [dateiHinweis, setDateiHinweis] = useState('');

  /* Was die Dateiwahl ergibt, erscheint ganz unten im Reiter – bei
     üblichen Fensterhöhen unterhalb des sichtbaren Bereichs. Ohne
     Zutun sähe es aus, als wäre nach der Wahl nichts geschehen. Deshalb
     rückt das Ergebnis ins Bild und bekommt den Fokus: eine Meldung
     selbst, eine Vorschau als Ganzes (ein Hinweis darüber bleibt dabei
     sichtbar). Eine Sicherung braucht das nicht – ihr Passwortfeld
     holt sich den Fokus selbst und rückt damit ins Bild. */
  const capyRef = useRef(null);
  const meldungRef = useRef(null);
  const zeigeRef = useRef('');                              // '' | 'capy' | 'meldung'
  useEffect(()=>{
    const ziel = zeigeRef.current;
    if (!ziel) return;
    zeigeRef.current = '';
    const fokus = ziel === 'capy' ? capyRef.current : meldungRef.current;
    const oben = ziel === 'capy' ? (meldungRef.current || fokus) : fokus;
    try { oben?.scrollIntoView?.({ block: 'start' }); } catch {}
    try { fokus?.focus?.({ preventScroll: true }); } catch {}
  }, [capy, dateiFehler, dateiHinweis]);

  const umfang = useMemo(()=> beobachtungsUmfang(daten), [daten]);
  const zeichen = [...pw1].length;
  const pwFehler = !pw1 ? '' : zeichen < MIN_PASSWORT
    ? `Noch ${MIN_PASSWORT - zeichen} Zeichen – mindestens ${MIN_PASSWORT}.`
    : (pw2 && pw1 !== pw2 ? 'Die beiden Eingaben stimmen nicht überein.' : '');
  const kannSichern = kannDateien && typeof exportiereDatei === 'function'
    && zeichen >= MIN_PASSWORT && pw1 === pw2 && !laeuft;
  const kannLesen = kannDateien && typeof importiereDatei === 'function';

  const vorschau = useMemo(
    ()=> (capy ? capyVorschau(capy.capy, daten, { zuordnung }) : null),
    [capy, daten, zuordnung],
  );

  const sichern = async (e)=>{
    e.preventDefault();
    if (!kannSichern) return;
    setLaeuft('sichern');
    try {
      const stand = await speicher.laden();
      /* Liessen sich die gespeicherten Beobachtungen nicht lesen, liefert
         der Speicher die leere Form. Eine Sicherung davon sähe aus wie
         eine echte – und wäre wertlos. */
      if (!speicher.zwischenstand?.()) {
        toast('Die gespeicherten Beobachtungen liessen sich nicht lesen. Es wurde keine Sicherung erstellt.', { tone: 'warning' });
        return;
      }
      const text = await erstelleSicherung(stand, pw1, { appVersion });
      const ziel = await exportiereDatei({ content: text, fileName: sicherungsDateiname() });
      if (!ziel) return;                                    // Dialog abgebrochen
      setPw1('');
      setPw2('');
      toast(`Sicherung gespeichert: ${dateiNameAus(ziel)}`, { tone: 'success' });
    } catch (err) {
      toast(fehlerText(err, 'Die Sicherung konnte nicht gespeichert werden.'), { tone: 'warning' });
    } finally {
      setLaeuft('');
    }
  };

  const capyStarten = (name, capyDaten)=>{
    setCapy({ name, capy: capyDaten });
    setZuordnung(vorschlagsZuordnung(capyDaten, optionen.alle));
  };

  const dateiWaehlen = async (zweck)=>{
    if (!kannLesen || laeuft) return;
    setDateiFehler('');
    setDateiHinweis('');
    setEinlesenFehler('');
    setLaeuft('datei');
    try {
      const datei = await importiereDatei();
      if (!datei) return;
      const name = String(datei.name || '');
      const inhalt = typeof datei.content === 'string' ? datei.content : String(datei.content ?? '');
      if (istSicherung(inhalt)) {
        setCapy(null);
        setPwEin('');
        setSicherung({ name, content: inhalt });
        if (zweck === 'capy') setDateiHinweis('Das ist eine Sicherung aus Prép-ybara, kein Export aus Capy-scope. Sie kann unten mit ihrem Passwort eingelesen werden.');
        return;
      }
      const gelesen = leseCapyText(inhalt);
      zeigeRef.current = gelesen.ok ? 'capy' : 'meldung';
      if (gelesen.ok) {
        setSicherung(null);
        capyStarten(name, gelesen.capy);
        if (zweck === 'sicherung') setDateiHinweis('Das ist ein Export aus Capy-scope, keine Sicherung. Unten steht, was davon übernommen würde.');
        return;
      }
      setDateiFehler(zweck === 'sicherung'
        ? 'Diese Datei ist keine Sicherung der Beobachtungen aus Prép-ybara und auch kein Export aus Capy-scope.'
        : gelesen.fehler);
    } catch (err) {
      zeigeRef.current = 'meldung';
      setDateiFehler(fehlerText(err, 'Die Datei konnte nicht gelesen werden.'));
    } finally {
      setLaeuft('');
    }
  };

  const einlesen = async (e)=>{
    e.preventDefault();
    if (!sicherung || !pwEin || laeuft) return;
    setLaeuft('einlesen');
    setEinlesenFehler('');
    try {
      const gelesen = await leseSicherung(sicherung.content, pwEin);
      let bericht = null;
      await aendere((d)=>{
        const r = zusammenfuehren(d, gelesen.daten);
        bericht = r.bericht;
        return r.daten;
      });
      if (!bericht) return;                                 // Ablage unlesbar – gemeldet hat der Speicher
      setSicherung(null);
      setPwEin('');
      toast(sicherungsBerichtText(bericht, gelesen.exportiertAm), { tone: 'success' });
    } catch (err) {
      setEinlesenFehler(fehlerText(err, 'Die Sicherung konnte nicht gelesen werden.'));
    } finally {
      setLaeuft('');
    }
  };

  const capyUebernehmenKlick = async ()=>{
    if (!capy || laeuft) return;
    setLaeuft('capy');
    try {
      let bericht = null;
      await aendere((d)=>{
        const r = capyUebernehmen(d, capy.capy, zuordnung);
        bericht = r.bericht;
        return r.daten;
      });
      if (!bericht) return;
      setCapy(null);
      setZuordnung({});
      setDateiHinweis('');
      toast(capyBerichtText(bericht), { tone: 'success' });
    } catch (err) {
      toast(fehlerText(err, 'Die Übernahme ist fehlgeschlagen.'), { tone: 'warning' });
    } finally {
      setLaeuft('');
    }
  };

  const zielOptionen = (klasse)=>{
    const eigen = capyLerngruppe({ name: klasse.name, subject: klasse.fach });
    const bekannt = eigen && optionen.alle.some(o => o.schluessel === eigen);
    return (
      <>
        <option value="">Nicht übernehmen</option>
        {optionen.planung.length ? (
          <optgroup label="Aus der Planung">
            {optionen.planung.map(o => <option key={o.schluessel} value={o.schluessel}>{o.name}</option>)}
          </optgroup>
        ) : null}
        {optionen.weitere.length ? (
          <optgroup label="Weitere Lerngruppen">
            {optionen.weitere.map(o => <option key={o.schluessel} value={o.schluessel}>{o.name}</option>)}
          </optgroup>
        ) : null}
        {eigen && !bekannt ? (
          <optgroup label="Neu anlegen">
            <option value={eigen}>{lerngruppenName(eigen)} (wie in Capy-scope)</option>
          </optgroup>
        ) : null}
      </>
    );
  };

  const capyNeues = vorschau
    ? vorschau.fragen.neu + vorschau.beobachtungen.neu + vorschau.klassen.reduce((s, k)=> s + k.lernendeNeu, 0)
    : 0;

  return (
    <div className="beobBereich">
      <section>
        <h3 className="settingsHeading">Wo die Beobachtungen liegen</h3>
        <p className="settingsText">
          In einer eigenen Ablage auf diesem Gerät, getrennt von der Planung. Sie gehören
          <b> nicht</b> zum Backup der Planung, wandern nicht nach Pocket, nicht in Vorlagen,
          nicht in den Versionsverlauf, nicht in die Suche und nicht ins Schuljahresarchiv.
          Gesichert werden sie nur hier – mit einer Datei, die immer ein Passwort hat.
        </p>
        <p className="settingsText muted small">
          Derzeit: {anzahl(umfang.lernende, 'Lernende', 'Lernende')} in {anzahl(umfang.beobachtungsLerngruppen, 'Lerngruppe', 'Lerngruppen')},
          {' '}{anzahl(umfang.beobachtungen, 'Beobachtung', 'Beobachtungen')}, {anzahl(umfang.eigeneFragen, 'eigene Frage', 'eigene Fragen')}.
          „Alle Daten löschen“ in den Einstellungen löscht auch die Beobachtungen.
        </p>
        {!speicher?.verfuegbar ? (
          <div className="inlineNotice inlineNotice--warning">
            Diese Fassung von Prép-ybara kann keine Beobachtungen speichern. Was hier eingetragen
            wird, ist nach dem Schliessen verloren.
          </div>
        ) : null}
        {!kannDateien ? (
          <div className="inlineNotice" style={{ marginTop: 8 }}>
            Sicherung und Übernahme brauchen einen Dateizugriff, den diese Umgebung nicht anbietet.
          </div>
        ) : null}
      </section>

      {kannDateien ? (
        <>
          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Beobachtungen sichern</h3>
            <form className="beobKasten" onSubmit={sichern}>
              <div className="inlineNotice inlineNotice--warning">
                Die Datei enthält die Namen der Lernenden und alle Einschätzungen. Sie wird mit
                deinem Passwort verschlüsselt. <b>Ohne das Passwort ist die Datei verloren</b> – es
                gibt keine Hintertür und keine Wiederherstellung. Bewahre das Passwort getrennt
                von der Datei auf.
              </div>
              <div className="beobFelder">
                <label className="beobFeld" htmlFor={`${idBasis}-pw1`}>
                  <span className="small muted">Passwort (mindestens {MIN_PASSWORT} Zeichen)</span>
                  <input id={`${idBasis}-pw1`} className="input" type="password" autoComplete="new-password"
                         value={pw1} onChange={(e)=>setPw1(e.target.value)} />
                </label>
                <label className="beobFeld" htmlFor={`${idBasis}-pw2`}>
                  <span className="small muted">Passwort wiederholen</span>
                  <input id={`${idBasis}-pw2`} className="input" type="password" autoComplete="new-password"
                         value={pw2} onChange={(e)=>setPw2(e.target.value)} />
                </label>
              </div>
              {pwFehler ? <p className="muted small" role="status" style={{ margin: 0 }}>{pwFehler}</p> : null}
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="submit" className="btn primary" disabled={!kannSichern}>
                  <Lock {...ICON_SM} /> {laeuft === 'sichern' ? 'Wird verschlüsselt …' : 'Sicherung speichern …'}
                </button>
                <span className="muted small">{sicherungsDateiname()}</span>
              </div>
            </form>
          </section>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Sicherung einlesen</h3>
            <p className="settingsText muted small">
              Eine Sicherung wird mit dem Vorhandenen zusammengeführt: Was schon da ist, bleibt,
              Neues kommt dazu. Zweimal dieselbe Sicherung einzulesen, legt nichts doppelt an.
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="button" className="btn" disabled={!kannLesen || Boolean(laeuft)} onClick={()=>dateiWaehlen('sicherung')}>
                <FileInput {...ICON_SM} /> Sicherung wählen …
              </button>
            </div>
          </section>

          <section className="beobAbschnitt">
            <h3 className="settingsHeading">Aus Capy-scope übernehmen</h3>
            <p className="settingsText muted small">
              Gebraucht wird die Datei, die Capy-scope mit „Daten als JSON exportieren“ speichert.
              Vor dem Übernehmen wählst du für jede Capy-Klasse die passende Lerngruppe; es wird
              nichts überschrieben, und ein zweiter Import derselben Datei ändert nichts mehr.
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <button type="button" className="btn" disabled={!kannLesen || Boolean(laeuft)} onClick={()=>dateiWaehlen('capy')}>
                <FileInput {...ICON_SM} /> Capy-Export wählen …
              </button>
            </div>
          </section>

          {dateiFehler ? (
            <div ref={meldungRef} tabIndex={-1} className="inlineNotice inlineNotice--warning beobFokusZiel" role="alert">{dateiFehler}</div>
          ) : null}
          {dateiHinweis ? (
            <div ref={meldungRef} tabIndex={-1} className="inlineNotice beobFokusZiel" role="status">{dateiHinweis}</div>
          ) : null}

          {sicherung ? (
            <form className="beobKasten" onSubmit={einlesen} aria-label="Sicherung einlesen">
              <div><b>{sicherung.name || 'Sicherung'}</b></div>
              <label className="beobFeld" htmlFor={`${idBasis}-pw-ein`}>
                <span className="small muted">Passwort der Sicherung</span>
                <input id={`${idBasis}-pw-ein`} className="input" type="password" autoComplete="off" autoFocus
                       value={pwEin} onChange={(e)=>{ setPwEin(e.target.value); setEinlesenFehler(''); }} />
              </label>
              {einlesenFehler ? <div className="inlineNotice inlineNotice--warning" role="alert">{einlesenFehler}</div> : null}
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="submit" className="btn primary" disabled={!pwEin || Boolean(laeuft)}>
                  <Check {...ICON_SM} /> {laeuft === 'einlesen' ? 'Wird entschlüsselt …' : 'Einlesen und zusammenführen'}
                </button>
                <button type="button" className="btn" disabled={laeuft === 'einlesen'}
                        onClick={()=>{ setSicherung(null); setPwEin(''); setEinlesenFehler(''); setDateiHinweis(''); }}>
                  Abbrechen
                </button>
              </div>
            </form>
          ) : null}

          {capy && vorschau ? (
            <div ref={capyRef} tabIndex={-1} className="beobKasten beobFokusZiel" role="region" aria-label="Übernahme aus Capy-scope">
              <div>
                <b>{capy.name || 'Capy-Export'}</b>
                <span className="muted small">
                  {' · '}{anzahl(capy.capy.classes.length, 'Klasse', 'Klassen')}
                  {' · '}{anzahl(capy.capy.questions.length, 'Frage', 'Fragen')}
                  {' · '}{anzahl(capy.capy.observations.length, 'Beobachtung', 'Beobachtungen')}
                </span>
              </div>
              {vorschau.klassen.length ? (
                <ul className="beobCapyListe">
                  {vorschau.klassen.map(k => (
                    <li key={k.id} className="beobCapyKlasse">
                      <div>
                        <div className="beobZeileName">{[k.name, k.fach].filter(Boolean).join(' · ') || 'Klasse ohne Namen'}</div>
                        <div className="muted small">
                          {anzahl(k.lernende, 'Lernende', 'Lernende')} · {anzahl(k.beobachtungen, 'Beobachtung', 'Beobachtungen')}
                        </div>
                        {k.ziel ? (
                          <div className="muted small">
                            Neu: {anzahl(k.lernendeNeu, 'Lernende', 'Lernende')}, {anzahl(k.beobachtungenNeu, 'Beobachtung', 'Beobachtungen')}
                            {k.lernendeVorhanden ? ` · ${k.lernendeVorhanden} schon in der Liste` : ''}
                          </div>
                        ) : null}
                      </div>
                      <label className="beobFeld" htmlFor={`${idBasis}-capy-${k.id}`}>
                        <span className="small muted">Lerngruppe in Prép-ybara</span>
                        <select
                          id={`${idBasis}-capy-${k.id}`}
                          className="input"
                          value={zuordnung[k.id] || ''}
                          onChange={(e)=>{ const wert = e.target.value; setZuordnung(z => ({ ...z, [k.id]: wert })); }}
                        >
                          {zielOptionen(k)}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Der Export enthält keine Klassen.</p>
              )}
              <p className="muted small" style={{ margin: 0 }}>
                Fragen: {vorschau.fragen.neu} neu, {vorschau.fragen.vorhanden} schon vorhanden.
                {' '}Beobachtungen: {vorschau.beobachtungen.neu} neu
                {vorschau.beobachtungen.schonVorhanden ? `, ${vorschau.beobachtungen.schonVorhanden} schon vorhanden` : ''}
                {vorschau.beobachtungen.ohneZiel ? `, ${vorschau.beobachtungen.ohneZiel} ohne Lerngruppe (werden übersprungen)` : ''}
                {vorschau.beobachtungen.ungueltig ? `, ${vorschau.beobachtungen.ungueltig} mit ungültigem Wert (werden übersprungen)` : ''}
                {vorschau.beobachtungen.unvollstaendig ? `, ${vorschau.beobachtungen.unvollstaendig} ohne Lernende, Frage oder Datum (werden übersprungen)` : ''}.
              </p>
              <div className="row wrap" style={{ gap: 8 }}>
                <button type="button" className="btn primary" disabled={!capyNeues || Boolean(laeuft)} onClick={capyUebernehmenKlick}>
                  <Check {...ICON_SM} /> {laeuft === 'capy' ? 'Wird übernommen …' : 'Übernehmen'}
                </button>
                <button type="button" className="btn" disabled={laeuft === 'capy'}
                        onClick={()=>{ setCapy(null); setZuordnung({}); setDateiHinweis(''); }}>
                  Abbrechen
                </button>
                {!capyNeues ? <span className="muted small">Mit dieser Zuordnung käme nichts Neues dazu.</span> : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   Die Ansicht
   ============================================================ */
export function BeobachtungView({
  speicher,
  lerngruppen = [],
  kontext = null,
  heuteISO = '',
  kompetenzVorschlaege = [],
  kannDateien = false,
  exportiereDatei,
  importiereDatei,
  exportierePdf,
  onVormerken = null,
  onToast,
  appVersion = '',
}){
  const idBasis = useId();
  const kontextGruppe = normalisiereLerngruppenSchluessel(kontext?.lerngruppe);

  /* Liegt der Stand schon im Speicher (die Ansicht war vorhin offen),
     erscheint er sofort; sonst wird er geladen. */
  const [daten, setDaten] = useState(()=> speicher?.zwischenstand?.() || null);
  const [bereich, setBereich] = useState('runde');
  const [gruppe, setGruppe] = useState(kontextGruppe);
  const [anzahlWahl, setAnzahlWahl] = useState(null);       // null = Vorgabe aus den Einstellungen
  const [runde, setRunde] = useState(null);
  const [notiz, setNotiz] = useState('');
  const [vormerken, setVormerken] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [frage, setFrage] = useState(null);                 // offene Bestätigung
  const speichertRef = useRef(false);
  const beantwortetRef = useRef('');                        // Runde und Index der letzten gespeicherten Antwort
  const antwortRef = useRef(null);
  const bestaetigungRef = useRef(null);
  const fokusVorher = useRef(null);
  const reiterRefs = useRef({});

  const heute = istDatum(heuteISO) ? heuteISO : lokalesDatum();
  const toast = useCallback((text, opts = {})=>{
    try { onToast?.(text, opts); } catch {}
  }, [onToast]);

  /* Liessen sich die gespeicherten Beobachtungen nicht lesen, liefert
     der Speicher die leere Form und schreibt nichts. Ohne Hinweis sähe
     das aus wie „alles weg" – deshalb steht es oben in der Ansicht, mit
     der Möglichkeit, das Lesen zu wiederholen. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const laden = useCallback(async ()=>{
    if (typeof speicher?.laden !== 'function') return null;
    const d = await speicher.laden();
    setLadeFehler(Boolean(speicher.verfuegbar) && !speicher.zwischenstand?.());
    return d;
  }, [speicher]);

  useEffect(()=>{
    let aktiv = true;
    laden().then((d)=>{ if (aktiv && d) setDaten(d); }).catch(()=>{});
    return ()=>{ aktiv = false; };
  }, [laden]);

  /* Ein neuer Start aus einer Stunde, während die Ansicht offen ist:
     dann gilt die neue Stunde. Eine laufende Runde endet dabei – ihre
     Antworten sind ohnehin schon gespeichert, und sie gehörte zu einer
     anderen Stunde. */
  const kontextSchluessel = kontext
    ? [kontextGruppe, kontext.stundenRef || '', kontext.datum || ''].join('\u0000')
    : '';
  const ersterKontext = useRef(true);
  useEffect(()=>{
    if (ersterKontext.current) { ersterKontext.current = false; return; }
    if (!kontext) return;
    setBereich('runde');
    setGruppe(kontextGruppe);
    setRunde(null);
    setNotiz('');
    setVormerken(false);
  }, [kontextSchluessel]);

  const optionen = useMemo(
    ()=> lerngruppenOptionen(lerngruppen, daten, [gruppe, kontextGruppe]),
    [lerngruppen, daten, gruppe, kontextGruppe],
  );
  const aktiveGruppe = gruppe || optionen.alle[0]?.schluessel || '';
  const kontextPasst = Boolean(kontext) && Boolean(kontextGruppe) && aktiveGruppe === kontextGruppe;

  /* Jede Änderung: eine reine Funktion über den neuesten Stand. Das
     Ergebnis des Speichers wird zum angezeigten Stand. `gerufen` sagt,
     ob die Funktion überhaupt lief – konnte die Ablage nicht gelesen
     werden, läuft sie nicht, und der Speicher meldet das selbst. */
  const aendere = useCallback(async (fn)=>{
    let gerufen = false;
    let geaendert = false;
    const neu = await speicher.aendern((d)=>{
      gerufen = true;
      const n = fn(d);
      geaendert = Boolean(n) && n !== d;
      return n;
    });
    if (gerufen && neu) {
      setDaten(neu);
      setLadeFehler(false);       // lief die Funktion, war der Stand lesbar
    }
    return { daten: neu, gerufen, geaendert };
  }, [speicher]);

  /* Rückfrage als Promise: `if (!(await bestaetige({...}))) return;`.
     Danach kehrt der Fokus dorthin zurück, wo er vorher war. */
  const bestaetige = useCallback((f)=> new Promise((resolve)=>{
    fokusVorher.current = typeof document !== 'undefined' ? document.activeElement : null;
    bestaetigungRef.current?.(false);
    bestaetigungRef.current = resolve;
    setFrage(f);
  }), []);
  const beantworteFrage = (ja)=>{
    const resolve = bestaetigungRef.current;
    bestaetigungRef.current = null;
    setFrage(null);
    resolve?.(ja);
    const el = fokusVorher.current;
    fokusVorher.current = null;
    setTimeout(()=>{ try { if (el?.isConnected) el.focus(); } catch {} }, 0);
  };
  useEffect(()=> ()=>{ bestaetigungRef.current?.(false); }, []);

  /* ---- Runde ----------------------------------------------------------- */

  const rundeStarten = (groesse)=>{
    if (!daten || !aktiveGruppe) return;
    /* Aus einer Stunde heraus gilt deren Datum – auch dafür, welche
       Paare an diesem Tag schon dran waren und deshalb nach hinten
       rücken. Sonst der heutige Tag. */
    const datum = kontextPasst && istDatum(kontext.datum) ? kontext.datum : heute;
    const r = erzeugeRunde(daten, aktiveGruppe, { anzahl: groesse, heuteISO: datum });
    if (!r.eintraege.length) {
      toast('Für diese Lerngruppe lässt sich noch keine Runde bilden.', { tone: 'warning' });
      return;
    }
    setNotiz('');
    setVormerken(false);
    setRunde({
      ...r,
      index: 0,
      beantwortet: 0,
      uebersprungen: 0,
      stundenRef: kontextPasst ? String(kontext.stundenRef || '') : '',
      datum,
      fertig: false,
    });
    if (groesse !== daten.einstellungen?.rundenGroesse) {
      aendere(d => mitRundenGroesse(d, groesse)).catch(()=>{});
    }
  };

  const weiter = (art)=>{
    setNotiz('');
    setVormerken(false);
    setRunde((r)=>{
      if (!r || r.fertig) return r;
      const index = r.index + 1;
      return { ...r, [art]: r[art] + 1, index, fertig: index >= r.eintraege.length };
    });
  };

  const antworten = async (wert)=>{
    const r = runde;
    if (!r || r.fertig || speichertRef.current) return;
    /* Die Sperre unten fällt, sobald gespeichert ist – neu gezeichnet
       wird erst danach. Eine Taste in dieser Lücke erreicht noch diese
       Fassung der Funktion, mit dem alten Eintrag, der alten Notiz und
       dem alten Haken. Sie gäbe demselben Paar eine zweite Antwort und
       schöbe die Runde über den nächsten Eintrag hinweg. Ein Eintrag,
       der schon beantwortet ist, zählt deshalb kein zweites Mal. */
    const schluessel = `${r.id}\u0000${r.index}`;
    if (beantwortetRef.current === schluessel) return;
    const eintrag = r.eintraege[r.index];
    if (!eintrag) return;
    const bekannt = lernendeDerGruppe(daten, r.lerngruppe, { auchInaktive: true }).some(l => l.id === eintrag.lernendeId)
      && (daten.fragen || []).some(f => f.id === eintrag.frageId);
    if (!bekannt) return;
    /* Gegen doppeltes Antippen und eine gedrückt gehaltene Taste: Bis
       die Antwort gespeichert ist, zählt keine weitere. */
    speichertRef.current = true;
    setSpeichert(true);
    const text = notiz.trim();
    try {
      const { gerufen, geaendert } = await aendere(d => erfasseBeobachtung(d, {
        lerngruppe: r.lerngruppe,
        lernendeId: eintrag.lernendeId,
        frageId: eintrag.frageId,
        wert,
        notiz: text,
        datum: r.datum,
        stundenRef: r.stundenRef,
        rundeId: r.id,
      }));
      if (!geaendert) {
        if (gerufen) toast('Diese Antwort konnte nicht gespeichert werden.', { tone: 'warning' });
        return;
      }
      beantwortetRef.current = schluessel;
      if (vormerken && text && r.stundenRef && typeof onVormerken === 'function') {
        try {
          onVormerken(r.stundenRef, text);
          toast('Notiz für die nächste Stunde vorgemerkt.', { tone: 'success' });
        } catch (err) {
          toast(fehlerText(err, 'Die Notiz konnte nicht vorgemerkt werden.'), { tone: 'warning' });
        }
      }
      weiter('beantwortet');
    } catch (err) {
      toast(fehlerText(err, 'Diese Antwort konnte nicht gespeichert werden.'), { tone: 'warning' });
    } finally {
      speichertRef.current = false;
      setSpeichert(false);
    }
  };
  antwortRef.current = antworten;

  /* Tasten 1–4 während einer laufenden Runde. Nicht, solange in einem
     Eingabefeld geschrieben wird, nicht mit Strg/Alt/Cmd (das sind
     Kürzel anderer Art) und nicht, solange irgendwo ein Dialog offen
     ist – dort gehören die Tasten dem Dialog. */
  useEffect(()=>{
    if (bereich !== 'runde' || !runde || runde.fertig) return undefined;
    const beiTaste = (e)=>{
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (!/^[1-4]$/.test(e.key)) return;
      if (istTexteingabe(e.target) || istTexteingabe(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      antwortRef.current?.(Number(e.key));
    };
    window.addEventListener('keydown', beiTaste);
    return ()=> window.removeEventListener('keydown', beiTaste);
  }, [bereich, runde?.id, runde?.fertig]);

  /* ---- Reiter ----------------------------------------------------------- */

  const zu = (id)=> setBereich(id);
  const reiterTaste = (e, index)=>{
    let ziel = -1;
    if (e.key === 'ArrowRight') ziel = (index + 1) % BEREICHE.length;
    else if (e.key === 'ArrowLeft') ziel = (index - 1 + BEREICHE.length) % BEREICHE.length;
    else if (e.key === 'Home') ziel = 0;
    else if (e.key === 'End') ziel = BEREICHE.length - 1;
    if (ziel < 0) return;
    e.preventDefault();
    const id = BEREICHE[ziel].id;
    setBereich(id);
    reiterRefs.current[id]?.focus();
  };

  const rundeLaeuft = Boolean(runde && !runde.fertig);

  let inhalt = null;
  if (!daten) {
    inhalt = <p className="muted">Beobachtungen werden gelesen …</p>;
  } else if (bereich === 'runde') {
    inhalt = (
      <RundeBereich
        idBasis={idBasis}
        daten={daten}
        gruppe={aktiveGruppe}
        optionen={optionen}
        onGruppe={setGruppe}
        anzahlWahl={anzahlWahl}
        onAnzahl={setAnzahlWahl}
        kontext={kontext}
        kontextPasst={kontextPasst}
        runde={runde}
        notiz={notiz}
        onNotiz={(t)=>{ setNotiz(t); if (!t.trim()) setVormerken(false); }}
        vormerken={vormerken}
        onVormerkenWahl={setVormerken}
        kannVormerken={typeof onVormerken === 'function' && Boolean(runde?.stundenRef)}
        speichert={speichert}
        onStart={rundeStarten}
        onAntwort={(w)=>antwortRef.current?.(w)}
        onUeberspringen={()=>weiter('uebersprungen')}
        onBeenden={()=>setRunde(r => (r ? { ...r, fertig: true } : r))}
        onNeu={()=>setRunde(null)}
        onZu={(id)=>{ if (id === 'auswertung') setRunde(null); zu(id); }}
      />
    );
  } else if (bereich === 'lernende') {
    inhalt = (
      <LernendeBereich
        idBasis={idBasis}
        daten={daten}
        gruppe={aktiveGruppe}
        optionen={optionen}
        onGruppe={setGruppe}
        aendere={aendere}
        bestaetige={bestaetige}
        toast={toast}
      />
    );
  } else if (bereich === 'fragen') {
    inhalt = (
      <FragenBereich
        idBasis={idBasis}
        daten={daten}
        optionen={optionen}
        aendere={aendere}
        bestaetige={bestaetige}
        toast={toast}
        kompetenzVorschlaege={kompetenzVorschlaege}
      />
    );
  } else if (bereich === 'auswertung') {
    inhalt = (
      <AuswertungBereich
        idBasis={idBasis}
        daten={daten}
        gruppe={aktiveGruppe}
        optionen={optionen}
        onGruppe={setGruppe}
        onZu={zu}
        exportierePdf={exportierePdf}
        heute={heute}
        toast={toast}
      />
    );
  } else {
    inhalt = (
      <DatenBereich
        idBasis={idBasis}
        daten={daten}
        speicher={speicher}
        optionen={optionen}
        aendere={aendere}
        toast={toast}
        kannDateien={kannDateien}
        exportiereDatei={exportiereDatei}
        importiereDatei={importiereDatei}
        appVersion={appVersion}
      />
    );
  }

  return (
    <div className="beobAnsicht">
      <div className="card">
        <div>
          <h2 className="dialogTitle" style={{ margin: 0 }}><Binoculars {...ICON} /> Beobachtung</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Kurze Einschätzungen zu Lernenden – nur auf diesem Gerät und getrennt von der Planung.
          </p>
          {kontext ? (
            <p className="beobKontext">
              Aus der Stunde: <b>{kontext.titel || lerngruppenName(kontextGruppe) || 'ohne Titel'}</b>
              {istDatum(kontext.datum) ? <span className="muted"> · {formatDatum(kontext.datum)}</span> : null}
              {kontextGruppe ? <span className="muted"> · {lerngruppenName(kontextGruppe)}</span> : null}
            </p>
          ) : null}
        </div>
        {speicher && !speicher.verfuegbar ? (
          <div className="inlineNotice inlineNotice--warning" style={{ marginTop: 10 }}>
            Diese Fassung kann keine Beobachtungen speichern. Was hier eingetragen wird, ist nach
            dem Schliessen verloren.
          </div>
        ) : null}
        {ladeFehler ? (
          <div className="inlineNotice inlineNotice--warning" role="alert" style={{ marginTop: 10 }}>
            Die gespeicherten Beobachtungen liessen sich nicht lesen. Damit nichts überschrieben
            wird, speichert Prép-ybara vorerst keine Änderungen.
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn small"
                onClick={()=>{ laden().then((d)=>{ if (d) setDaten(d); }).catch(()=>{}); }}
              >Erneut lesen</button>
            </div>
          </div>
        ) : null}
        <div className="beobReiter" role="tablist" aria-label="Bereiche der Beobachtung">
          {BEREICHE.map(({ id, name, Icon }, index)=>(
            <button
              key={id}
              ref={(el)=>{ reiterRefs.current[id] = el; }}
              type="button"
              role="tab"
              id={`${idBasis}-reiter-${id}`}
              aria-selected={bereich === id}
              aria-controls={`${idBasis}-bereich`}
              tabIndex={bereich === id ? 0 : -1}
              className={`beobReiterKnopf${bereich === id ? ' is-active' : ''}`}
              onClick={()=>setBereich(id)}
              onKeyDown={(e)=>reiterTaste(e, index)}
            >
              <Icon {...ICON_SM} /> {name}
              {id === 'runde' && rundeLaeuft
                ? <span className="beobReiterMarke">{runde.index + 1}/{runde.eintraege.length}</span>
                : null}
            </button>
          ))}
        </div>
      </div>

      <div
        className="card"
        role="tabpanel"
        id={`${idBasis}-bereich`}
        aria-labelledby={`${idBasis}-reiter-${bereich}`}
      >
        {inhalt}
      </div>

      <BestaetigungsDialog frage={frage} onAntwort={beantworteFrage} />
    </div>
  );
}

export default BeobachtungView;
