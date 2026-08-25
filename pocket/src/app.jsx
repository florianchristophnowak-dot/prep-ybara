/* ============================================================
   Prép-ybara Pocket – Rahmen und Wege

   Vier Ansichten unten, dazu Editoren, die sich darüberlegen. Kein
   Menü, keine Seitenleiste, keine Verschachtelung tiefer als zwei:
   Startseite → Editor. Wer den Weg zur Stunde zählt, zählt zwei
   Berührungen.

   Die Zurück-Taste des Telefons funktioniert wie erwartet, weil jede
   Ansicht ein Eintrag im Verlauf ist. Das ist auf einem Telefon keine
   Feinheit, sondern Grundausstattung – ohne sie verlässt die
   Zurück-Geste die App mitten in der Planung.

   Export und Import laufen hier zusammen, weil beide aus mehreren
   Ansichten aufgerufen werden und beide dieselbe Rückmeldung geben
   sollen.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePocketStore } from './store.js';
import {
  entwurfZuAustausch, entwurfTitel, zahlwort, ART_SCHNELL, ART_STUNDE, leerePhase,
} from './model.js';
import {
  packeStunden, dateiname, fehlertext, EXT_LESSON_BUNDLE, vergleichsSchluessel,
} from '../../shared/exchange/index.js';
import { toISODate } from '../../shared/datum.js';
import { POCKET_NAME, POCKET_VERSION } from './version.js';
import { kannDateienTeilen, ladeHerunter, leseTextdatei, teileDatei } from './files.js';
import { Blatt, Hinweis, Knopf, Meldung, Bestaetigung } from './ui.jsx';
import HomeView from './views/HomeView.jsx';
import DraftsView from './views/DraftsView.jsx';
import IdeasView from './views/IdeasView.jsx';
import SettingsView from './views/SettingsView.jsx';
import LessonEditor from './views/LessonEditor.jsx';
import QuickEditor from './views/QuickEditor.jsx';

const REITER = [
  { id: 'home', name: 'Heute', zeichen: '☀' },
  { id: 'drafts', name: 'Entwürfe', zeichen: '🗒' },
  { id: 'ideas', name: 'Ideen', zeichen: '💡' },
  { id: 'settings', name: 'Einstellungen', zeichen: '⚙' },
];

/* Eine neue Stunde beginnt nicht mit einer leeren Liste, sondern mit
   einer Phase. Das erspart den ersten Fingertipp und zeigt zugleich,
   wie eine Phase aussieht. */
function startPhasen(){
  return [leerePhase({ title: 'Einstieg', duration: 10 })];
}

export default function App(){
  const laden = usePocketStore();
  const {
    bereit, fehler, profil, entwuerfe, ideen, einstellungen,
    entwurfAnlegen, entwurfAendern, entwurfLoeschen, entwurfDuplizieren, entwurfExportiert,
    ideeAnlegen, ideeAendern, ideeLoeschen, ideeUmwandeln,
    profilImportieren, profilEntfernen, einstellungenAendern, jetztSchreiben,
  } = laden;

  const [ansicht, setAnsicht] = useState({ name: 'home' });
  const [meldung, setMeldung] = useState('');
  const [exportBlatt, setExportBlatt] = useState(null);      // { inhalt, name, titel, ids }
  const [profilBlatt, setProfilBlatt] = useState(null);      // { umfang } | { fehler }
  const [mehrBlatt, setMehrBlatt] = useState(null);          // Entwurf
  const [loeschFrage, setLoeschFrage] = useState(null);

  const heuteISO = toISODate(new Date());

  /* ---- Verlauf: die Zurück-Taste des Telefons ------------------------ */
  useEffect(()=>{
    const beiZurueck = (e)=>{
      const ziel = e.state?.pocket;
      setAnsicht(ziel && typeof ziel === 'object' ? ziel : { name: 'home' });
    };
    window.addEventListener('popstate', beiZurueck);
    // Einen Grundzustand hinterlegen, damit die erste Rückkehr nicht die App verlässt.
    if (!window.history.state?.pocket) {
      window.history.replaceState({ pocket: { name: 'home' } }, '');
    }
    return ()=> window.removeEventListener('popstate', beiZurueck);
  }, []);

  const gehe = useCallback((ziel, { ersetzen = false } = {})=>{
    setAnsicht(ziel);
    try {
      if (ersetzen) window.history.replaceState({ pocket: ziel }, '');
      else window.history.pushState({ pocket: ziel }, '');
    } catch { /* Verlauf ist eine Zugabe, kein Muss. */ }
  }, []);

  const zurueck = useCallback(()=>{
    try { window.history.back(); }
    catch { setAnsicht({ name: 'home' }); }
  }, []);

  const offenerEntwurf = useMemo(
    ()=> (ansicht.name === 'editor' || ansicht.name === 'quick')
      ? entwuerfe.find(e => e.id === ansicht.id) || null
      : null,
    [ansicht, entwuerfe]
  );

  /* Ist ein Entwurf gelöscht worden, während er offen war, führt der
     Weg zurück – nicht auf eine leere Seite. */
  useEffect(()=>{
    if ((ansicht.name === 'editor' || ansicht.name === 'quick') && bereit && !offenerEntwurf) {
      setAnsicht({ name: 'drafts' });
    }
  }, [ansicht, bereit, offenerEntwurf]);

  /* ---- Entwürfe öffnen und anlegen ----------------------------------- */

  const oeffne = useCallback((entwurf)=>{
    gehe({ name: entwurf.kind === ART_SCHNELL ? 'quick' : 'editor', id: entwurf.id });
  }, [gehe]);

  const neueStunde = useCallback((vorgabe = {}, art = ART_STUNDE)=>{
    const entwurf = entwurfAnlegen({
      ...vorgabe,
      kind: art,
      phases: vorgabe.phases || (art === ART_STUNDE ? startPhasen() : []),
    });
    gehe({ name: art === ART_SCHNELL ? 'quick' : 'editor', id: entwurf.id });
    return entwurf;
  }, [entwurfAnlegen, gehe]);

  /* ---- Eigene Etiketten ---------------------------------------------- */

  const eigenesEtikettMerken = useCallback((art, label)=>{
    const feld = art === 'kompetenz' ? 'eigeneKompetenzen' : 'eigeneSprechabsichten';
    const bisher = einstellungen?.[feld] || [];
    if (bisher.some(l => vergleichsSchluessel(l) === vergleichsSchluessel(label))) return;
    einstellungenAendern({ [feld]: [...bisher, label] });
  }, [einstellungen, einstellungenAendern]);

  /* ---- Export --------------------------------------------------------- */

  const exportiere = useCallback((liste)=>{
    const entwuerfeZumExport = liste.filter(Boolean);
    if (!entwuerfeZumExport.length) return;

    if (entwuerfeZumExport.length === 1) {
      const stunde = entwurfZuAustausch(entwuerfeZumExport[0], profil);
      setExportBlatt({
        inhalt: JSON.stringify(stunde, null, 2),
        name: dateiname(stunde),
        titel: entwurfTitel(entwuerfeZumExport[0]),
        ids: [entwuerfeZumExport[0].id],
      });
      return;
    }

    const paket = packeStunden(
      entwuerfeZumExport.map(e => entwurfZuAustausch(e, profil)),
      { app: { name: POCKET_NAME, version: POCKET_VERSION } }
    );
    setExportBlatt({
      inhalt: JSON.stringify(paket, null, 2),
      name: `Prepybara-Pocket-${entwuerfeZumExport.length}-Stunden-${heuteISO}${EXT_LESSON_BUNDLE}`,
      titel: `${entwuerfeZumExport.length} Stunden`,
      ids: entwuerfeZumExport.map(e => e.id),
    });
  }, [profil, heuteISO]);

  const exportAbschliessen = useCallback((weg)=>{
    if (!exportBlatt) return;
    entwurfExportiert(exportBlatt.ids);
    setExportBlatt(null);
    setMeldung(weg === 'share' ? 'Datei geteilt. Der Entwurf bleibt hier.' : 'Datei gespeichert. Der Entwurf bleibt hier.');
  }, [exportBlatt, entwurfExportiert]);

  /* ---- Profil einlesen ------------------------------------------------ */

  const profilEinlesen = useCallback(async ()=>{
    const datei = await leseTextdatei();
    if (!datei) return;
    try {
      const { umfang } = await profilImportieren(datei.inhalt);
      setProfilBlatt({ umfang });
    } catch (err) {
      setProfilBlatt({ fehler: fehlertext(err, 'Diese Datei ist kein gültiger Prép-ybara-Export.') });
    }
  }, [profilImportieren]);

  if (!bereit) {
    return (
      <div className="app">
        <main className="inhalt">
          <p className="leise">Einen Augenblick …</p>
        </main>
      </div>
    );
  }

  const reiterSichtbar = ['home', 'drafts', 'ideas', 'settings'].includes(ansicht.name);

  return (
    <div className="app">
      {fehler ? (
        <div style={{ padding: '10px 16px 0' }}>
          <Hinweis art="warnung">
            Die Ablage meldet ein Problem: {fehler}. Exportiere wichtige Entwürfe zeitnah.
          </Hinweis>
        </div>
      ) : null}

      {ansicht.name === 'home' ? (
        <HomeView
          profil={profil}
          entwuerfe={entwuerfe}
          heuteISO={heuteISO}
          onOeffnen={oeffne}
          onNeueStunde={()=>neueStunde()}
          onSchnellplanung={()=>neueStunde({}, ART_SCHNELL)}
          onNeueIdee={()=>gehe({ name: 'ideas', neu: true })}
          onTerminPlanen={(termin)=>neueStunde({
            className: termin.className,
            subjectName: termin.subjectName,
            classId: termin.classId,
            subjectId: termin.subjectId,
            groupId: termin.groupId,
            date: termin.date,
            lessonNumber: termin.lessonNumber,
          })}
          onAlleEntwuerfe={()=>gehe({ name: 'drafts' })}
          onEinstellungen={()=>gehe({ name: 'settings' })}
        />
      ) : null}

      {ansicht.name === 'drafts' ? (
        <DraftsView
          entwuerfe={entwuerfe}
          onOeffnen={oeffne}
          onDuplizieren={(e)=>{ entwurfDuplizieren(e.id); setMeldung('Entwurf dupliziert.'); }}
          onExport={(e)=>exportiere([e])}
          onMehrfachExport={(ids)=>exportiere(ids.map(id => entwuerfe.find(e => e.id === id)))}
          onLoeschen={(e)=>{ entwurfLoeschen(e.id); setMeldung('Entwurf gelöscht.'); }}
        />
      ) : null}

      {ansicht.name === 'ideas' ? (
        <IdeasView
          key={ansicht.neu ? 'ideen-neu' : 'ideen'}
          ideen={ideen}
          profil={profil}
          neuStart={Boolean(ansicht.neu)}
          onAnlegen={(idee)=>ideeAnlegen(idee)}
          onAendern={(id, patch)=>ideeAendern(id, patch)}
          onLoeschen={(idee)=>{ ideeLoeschen(idee.id); setMeldung('Idee gelöscht.'); }}
          onUmwandeln={async (idee)=>{
            const entwurf = await ideeUmwandeln(idee.id);
            if (entwurf) oeffne(entwurf);
          }}
        />
      ) : null}

      {ansicht.name === 'settings' ? (
        <SettingsView
          profil={profil}
          entwurfsZahl={entwuerfe.length}
          onProfilImportieren={profilEinlesen}
          onProfilEntfernen={async ()=>{ await profilEntfernen(); setMeldung('Profil entfernt.'); }}
        />
      ) : null}

      {ansicht.name === 'editor' && offenerEntwurf ? (
        <LessonEditor
          entwurf={offenerEntwurf}
          profil={profil}
          einstellungen={einstellungen}
          onAendern={(patch)=>entwurfAendern(offenerEntwurf.id, patch)}
          onZurueck={zurueck}
          onExport={()=>exportiere([offenerEntwurf])}
          onMehr={()=>setMehrBlatt(offenerEntwurf)}
          onEigenesEtikett={eigenesEtikettMerken}
        />
      ) : null}

      {ansicht.name === 'quick' && offenerEntwurf ? (
        <QuickEditor
          entwurf={offenerEntwurf}
          profil={profil}
          onAendern={(patch)=>entwurfAendern(offenerEntwurf.id, patch)}
          onZurueck={zurueck}
          onExport={()=>exportiere([offenerEntwurf])}
          onMehr={()=>setMehrBlatt(offenerEntwurf)}
          onDetail={()=>gehe({ name: 'editor', id: offenerEntwurf.id }, { ersetzen: true })}
        />
      ) : null}

      {reiterSichtbar ? (
        <nav className="fuss" aria-label="Hauptbereiche">
          {REITER.map(r => (
            <button
              key={r.id}
              type="button"
              className={`fussKnopf${ansicht.name === r.id ? ' aktiv' : ''}`}
              aria-current={ansicht.name === r.id ? 'page' : undefined}
              onClick={()=>gehe({ name: r.id })}
            >
              <span className="fussSymbol" aria-hidden="true">{r.zeichen}</span>
              <span>{r.name}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {/* ---- Blätter ---- */}

      {exportBlatt ? (
        <Blatt
          titel="Für Prép-ybara exportieren"
          onSchliessen={()=>setExportBlatt(null)}
        >
          <p className="leise" style={{ margin: 0 }}>
            {exportBlatt.titel}
            <br />
            <span className="klein">{exportBlatt.name}</span>
          </p>
          <Hinweis>
            Der Entwurf bleibt nach dem Export auf diesem Gerät. Am PC:
            Prép-ybara → Einstellungen → Prép-ybara Pocket → Pocket-Import.
          </Hinweis>
          {kannDateienTeilen() ? (
            <Knopf
              breit
              art="primaer"
              onClick={async ()=>{
                const ergebnis = await teileDatei(exportBlatt.inhalt, exportBlatt.name);
                if (ergebnis.ok) exportAbschliessen('share');
                else if (!ergebnis.abgebrochen) setMeldung('Teilen hat nicht geklappt – versuche „Herunterladen“.');
              }}
            >Teilen …</Knopf>
          ) : null}
          <Knopf
            breit
            art={kannDateienTeilen() ? '' : 'primaer'}
            onClick={()=>{ ladeHerunter(exportBlatt.inhalt, exportBlatt.name); exportAbschliessen('download'); }}
          >Herunterladen</Knopf>
          <Knopf breit onClick={()=>setExportBlatt(null)}>Abbrechen</Knopf>
        </Blatt>
      ) : null}

      {profilBlatt ? (
        <Blatt
          titel={profilBlatt.fehler ? 'Datei nicht gelesen' : 'Profil importiert'}
          onSchliessen={()=>setProfilBlatt(null)}
          aktionen={<Knopf breit art="primaer" onClick={()=>setProfilBlatt(null)}>Weiter</Knopf>}
        >
          {profilBlatt.fehler ? (
            <Hinweis art="fehler">{profilBlatt.fehler}</Hinweis>
          ) : (
            <div className="abschnitt" style={{ gap: 4 }}>
              <span>{zahlwort(profilBlatt.umfang.groups, 'Lerngruppe', 'Lerngruppen')}</span>
              <span>{zahlwort(profilBlatt.umfang.subjects, 'Fach', 'Fächer')}</span>
              <span>{zahlwort(profilBlatt.umfang.competencies, 'Kompetenz', 'Kompetenzen')}</span>
              <span>{zahlwort(profilBlatt.umfang.speechActs, 'Sprechabsicht', 'Sprechabsichten')}</span>
              <span className="leise klein">
                {zahlwort(profilBlatt.umfang.timetable, 'Stundenplaneintrag', 'Stundenplaneinträge')}
                {' · vorhandene Entwürfe bleiben erhalten'}
              </span>
            </div>
          )}
        </Blatt>
      ) : null}

      {mehrBlatt ? (
        <Blatt titel={entwurfTitel(mehrBlatt)} onSchliessen={()=>setMehrBlatt(null)}>
          <Knopf breit onClick={()=>{ const e = mehrBlatt; setMehrBlatt(null); exportiere([e]); }}>
            Für Prép-ybara exportieren
          </Knopf>
          <Knopf
            breit
            onClick={()=>{
              const kopie = entwurfDuplizieren(mehrBlatt.id);
              setMehrBlatt(null);
              if (kopie) { setMeldung('Entwurf dupliziert.'); gehe({ name: kopie.kind === ART_SCHNELL ? 'quick' : 'editor', id: kopie.id }, { ersetzen: true }); }
            }}
          >Duplizieren</Knopf>
          <Knopf breit art="gefahr" onClick={()=>{ const e = mehrBlatt; setMehrBlatt(null); setLoeschFrage(e); }}>
            Löschen
          </Knopf>
        </Blatt>
      ) : null}

      {loeschFrage ? (
        <Bestaetigung
          frage="Entwurf löschen?"
          text={`„${entwurfTitel(loeschFrage)}“ wird von diesem Gerät entfernt.`}
          bestaetigen="Löschen"
          gefahr
          onJa={async ()=>{
            const e = loeschFrage;
            setLoeschFrage(null);
            await entwurfLoeschen(e.id);
            await jetztSchreiben();
            setMeldung('Entwurf gelöscht.');
            gehe({ name: 'drafts' }, { ersetzen: true });
          }}
          onNein={()=>setLoeschFrage(null)}
        />
      ) : null}

      <Meldung text={meldung} onWeg={()=>setMeldung('')} />
    </div>
  );
}
