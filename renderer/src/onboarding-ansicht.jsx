/* ============================================================
   Onboarding: die Oberfläche

   Drei Bausteine, mehr braucht die Einführung nicht:

     - die Willkommensansicht, einmalig und als einziges grossflächiges
       Overlay,
     - der Coachmark: ein kleiner Hinweis, der an einem echten Element
       hängt,
     - die Checkliste: drei Zeilen, einklappbar, danach weg.

   Alles benutzt die vorhandenen Flächen, Farben und Knöpfe. Es entsteht
   keine zweite Bildsprache – eine Einführung, die anders aussieht als
   die App, führt in die falsche App ein.

   Verankert wird über `data-onboarding-target`. Keine Bildschirm-
   koordinaten, keine Selektoren auf Klassennamen: Wird ein Element
   umgebaut, wandert das Attribut mit. Fehlt das Ziel, legt sich der
   Hinweis unten an den Rand, statt zu verschwinden.
   ============================================================ */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, GraduationCap, X } from 'lucide-react';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

/* Der Abstand zwischen Ziel und Hinweis. */
const LUFT = 10;

function zielElement(ziel){
  const name = String(ziel || '').trim();
  if (!name || typeof document === 'undefined') return null;
  try { return document.querySelector(`[data-onboarding-target="${CSS.escape(name)}"]`); }
  catch { return null; }
}

/* ============================================================
   Coachmark

   Ein Kästchen neben einem Element, mit einem Ring um das Element. Er
   nimmt keine Eingaben entgegen und sperrt nichts: Man kann weiter
   tippen, während er dasteht – das ist der Sinn, denn genau das soll
   man ja tun.
   ============================================================ */
export function Coachmark({
  offen,
  titel,
  text,
  ziel = '',
  fortschritt = '',
  aktionen = [],
  onSchliessen,
}){
  const [lage, setLage] = useState(null);   // { top, left, ringTop, ringLeft, ringBreite, ringHoehe }
  const karteRef = useRef(null);

  const messen = useCallback(()=>{
    const el = zielElement(ziel);
    if (!el || typeof window === 'undefined') { setLage(null); return; }
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) { setLage(null); return; }
    const karte = karteRef.current;
    const breite = karte?.offsetWidth || 320;
    const hoehe = karte?.offsetHeight || 120;

    /* Unter das Ziel, wenn dort Platz ist; sonst darüber. Waagerecht am
       linken Rand des Ziels ausgerichtet und ins Fenster gerückt. */
    const untenPlatz = window.innerHeight - r.bottom;
    const top = (untenPlatz > hoehe + LUFT + 16 || r.top < hoehe + LUFT)
      ? r.bottom + LUFT
      : Math.max(8, r.top - hoehe - LUFT);
    const left = Math.min(
      Math.max(8, r.left),
      Math.max(8, window.innerWidth - breite - 8),
    );
    setLage({
      top: Math.round(top),
      left: Math.round(left),
      ringTop: Math.round(r.top - 4),
      ringLeft: Math.round(r.left - 4),
      ringBreite: Math.round(r.width + 8),
      ringHoehe: Math.round(r.height + 8),
    });
  }, [ziel]);

  useLayoutEffect(()=>{
    if (!offen) { setLage(null); return undefined; }
    messen();
    /* Zwei Nachmessungen: Die erste kommt, bevor die Karte ihre Grösse
       hat, die zweite nachdem sich das Layout gesetzt hat. */
    const r1 = requestAnimationFrame(messen);
    const t1 = setTimeout(messen, 120);
    const beiBewegung = ()=> messen();
    window.addEventListener('resize', beiBewegung);
    window.addEventListener('scroll', beiBewegung, true);
    return ()=>{
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      window.removeEventListener('resize', beiBewegung);
      window.removeEventListener('scroll', beiBewegung, true);
    };
  }, [offen, messen, titel, text]);

  useEffect(()=>{
    if (!offen) return undefined;
    const beiTaste = (e)=>{
      if (e.key !== 'Escape') return;
      /* In einem Eingabefeld gehört Escape dem Feld – dort schliesst es
         die Vorschlagsliste. */
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      onSchliessen?.();
    };
    window.addEventListener('keydown', beiTaste);
    return ()=> window.removeEventListener('keydown', beiTaste);
  }, [offen, onSchliessen]);

  if (!offen) return null;

  const angedockt = !lage;
  const stil = angedockt ? undefined : { top: lage.top, left: lage.left };

  return (
    <>
      {lage ? (
        <div
          className="onboardingRing"
          aria-hidden="true"
          style={{ top: lage.ringTop, left: lage.ringLeft, width: lage.ringBreite, height: lage.ringHoehe }}
        />
      ) : null}
      <div
        ref={karteRef}
        className={`onboardingKarte${angedockt ? ' onboardingKarte--angedockt' : ''}`}
        style={stil}
        role="dialog"
        aria-live="polite"
        aria-label={`Hinweis: ${titel}`}
      >
        <div className="onboardingKopf">
          <span className="onboardingTitel">{titel}</span>
          {fortschritt ? <span className="muted small">{fortschritt}</span> : null}
          {onSchliessen ? (
            <button type="button" className="onboardingSchliessen" aria-label="Hinweis schließen" onClick={onSchliessen}>
              <X {...ICON_SM} />
            </button>
          ) : null}
        </div>
        <p className="onboardingText">{text}</p>
        {aktionen.length ? (
          <div className="onboardingAktionen">
            {aktionen.map((a, i)=>(
              <button
                key={a.id || i}
                type="button"
                className={`btn small${a.tone ? ` ${a.tone}` : ''}`}
                onClick={a.onSelect}
              >{a.label}</button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ============================================================
   Willkommen

   Das einzige grossflächige Overlay der Einführung – und es kommt
   genau einmal, bei einer leeren Datenbank. Vier Wege plus "Später";
   der empfohlene steht vorn und ist der einzige hervorgehobene.
   ============================================================ */
export function WillkommenAnsicht({ offen, onWaehlen, onSpaeter, importMoeglich = true }){
  const ersterRef = useRef(null);
  useEffect(()=>{
    if (!offen) return undefined;
    const t = setTimeout(()=>ersterRef.current?.focus(), 0);
    /* Escape am Fenster und nicht nur an der Karte: Die Ansicht ist das
       Erste, was jemand sieht – sie muss sich schliessen lassen, egal
       wo der Fokus gerade liegt. */
    const beiTaste = (e)=>{ if (e.key === 'Escape') onSpaeter?.(); };
    window.addEventListener('keydown', beiTaste);
    return ()=>{ clearTimeout(t); window.removeEventListener('keydown', beiTaste); };
  }, [offen, onSpaeter]);

  if (!offen) return null;

  const wege = [
    {
      id: 'stunde',
      label: 'Meine erste Stunde planen',
      hinweis: 'Der empfohlene Weg: in drei Schritten zur ersten Planung.',
      primaer: true,
    },
    {
      id: 'unterrichtszeiten',
      label: 'Meine Unterrichtszeiten einrichten',
      hinweis: 'Die regelmässig wiederkehrenden Zeiten einmalig als Vorlage anlegen.',
    },
    {
      id: 'import',
      label: 'Vorhandene Daten importieren',
      hinweis: 'Ein Backup aus Prép-ybara einlesen – dein Stand ist sofort da.',
      aus: !importMoeglich,
    },
    {
      id: 'erkunden',
      label: 'Selbst erkunden',
      hinweis: 'Ohne Führung. Erklärungen erscheinen später dort, wo du sie brauchst.',
    },
  ];

  return (
    <div className="modalOverlay onboardingOverlay">
      <div
        className="modalCard onboardingWillkommen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboardingWillkommenTitel"
        onKeyDown={(e)=>{ if (e.key === 'Escape') onSpaeter?.(); }}
      >
        <h2 className="dialogTitle" id="onboardingWillkommenTitel">
          <GraduationCap {...ICON} /> Willkommen bei Prép-ybara
        </h2>
        <p className="dialogBody">
          Plane deine erste Stunde und lerne die weiteren Möglichkeiten kennen, wenn du sie
          brauchst. Alle Daten bleiben auf diesem Gerät.
        </p>

        <ul className="onboardingWege">
          {wege.map((w, i)=>(
            <li key={w.id}>
              <button
                ref={i === 0 ? ersterRef : null}
                type="button"
                className={`onboardingWeg${w.primaer ? ' onboardingWeg--primaer' : ''}`}
                disabled={Boolean(w.aus)}
                onClick={()=>onWaehlen?.(w.id)}
              >
                <span className="onboardingWegLabel">
                  {w.label}
                  {w.primaer ? <span className="badge">empfohlen</span> : null}
                </span>
                <span className="muted small">{w.hinweis}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="onboardingSpaeter">
          <button type="button" className="btnLeise" onClick={onSpaeter}>Später</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Checkliste

   Drei Zeilen am Rand, während der Schnellstart läuft. Sie zählt, was
   getan ist – und verschwindet, sobald alles getan ist. Ausblenden geht
   jederzeit; wiederkommen kann sie über die Einstellungen.
   ============================================================ */
export function OnboardingCheckliste({
  offen,
  schritte = {},
  reihenfolge = [],
  texte = {},
  eingeklappt = false,
  onEinklappen,
  onAusblenden,
}){
  if (!offen) return null;
  const erledigt = reihenfolge.filter(id => schritte[id]).length;

  return (
    <aside className="onboardingCheckliste" aria-label="Erste Schritte">
      <div className="onboardingChecklisteKopf">
        <button
          type="button"
          className="onboardingChecklisteTitel"
          aria-expanded={!eingeklappt}
          onClick={()=>onEinklappen?.(!eingeklappt)}
        >
          {eingeklappt ? <ChevronRight {...ICON_SM} /> : <ChevronDown {...ICON_SM} />}
          <span>Erste Schritte</span>
          <span className="muted small">· {erledigt} von {reihenfolge.length}</span>
        </button>
        <button
          type="button"
          className="onboardingSchliessen"
          aria-label="Checkliste ausblenden"
          title="Checkliste ausblenden – über die Einstellungen kommt sie zurück"
          onClick={onAusblenden}
        ><X {...ICON_SM} /></button>
      </div>
      {!eingeklappt ? (
        <ul className="onboardingChecklisteListe">
          {reihenfolge.map(id => (
            <li key={id} className={schritte[id] ? 'is-erledigt' : ''}>
              <span className="onboardingHaken" aria-hidden="true">
                {schritte[id] ? <Check {...ICON_SM} /> : null}
              </span>
              <span>{texte[id] || id}</span>
              <span className="visuallyHidden">{schritte[id] ? ' (erledigt)' : ' (offen)'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

export default Coachmark;
