/* ============================================================
   Bausteine der Oberfläche

   Klein gehalten und ausschliesslich für den Daumen gebaut. Es gibt
   hier nichts, was der Desktop-App entspricht – geteilt werden zwischen
   beiden Anwendungen die Daten, nicht die Knöpfe. Ein gemeinsamer
   Baustein müsste beiden Bildschirmgrössen genügen und wäre für keine
   von beiden richtig.
   ============================================================ */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function Kopf({ titel, unter, links = null, rechts = null }){
  return (
    <header className="kopf">
      {links}
      <h1 className="kopfTitel">
        {titel}
        {unter ? <span className="kopfUnter">{unter}</span> : null}
      </h1>
      {rechts}
    </header>
  );
}

export function ZurueckKnopf({ onClick, beschriftung = 'Zurück' }){
  return (
    <button type="button" className="symbolKnopf" onClick={onClick} aria-label={beschriftung} title={beschriftung}>
      ‹
    </button>
  );
}

export function Knopf({ art = '', breit = false, klein = false, children, ...rest }){
  const klassen = ['knopf'];
  if (art === 'primaer') klassen.push('knopf--primaer');
  if (art === 'gefahr') klassen.push('knopf--gefahr');
  if (art === 'leise') klassen.push('knopf--leise');
  if (breit) klassen.push('knopf--breit');
  if (klein) klassen.push('knopf--klein');
  return <button type="button" className={klassen.join(' ')} {...rest}>{children}</button>;
}

export function SymbolKnopf({ zeichen, beschriftung, ...rest }){
  return (
    <button type="button" className="symbolKnopf" aria-label={beschriftung} title={beschriftung} {...rest}>
      {zeichen}
    </button>
  );
}

export function Feld({ name, hinweis, children }){
  return (
    <label className="feld">
      {name ? <span className="feldName">{name}</span> : null}
      {children}
      {hinweis ? <span className="leise klein">{hinweis}</span> : null}
    </label>
  );
}

export function Eingabe({ wert, onWert, ...rest }){
  return (
    <input
      className="eingabe"
      value={wert ?? ''}
      onChange={(e)=>onWert?.(e.target.value)}
      {...rest}
    />
  );
}

/* Mitwachsendes Textfeld. Auf einem Telefon ist eine Bildlaufleiste in
   einem drei Zeilen hohen Kasten die schlechteste aller Lösungen –
   das Feld wächst stattdessen mit dem Text. */
export function Flaeche({ wert, onWert, minZeilen = 2, ...rest }){
  const ref = useRef(null);
  const anpassen = ()=>{
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(anpassen, [wert]);
  return (
    <textarea
      ref={ref}
      className="flaeche"
      rows={minZeilen}
      value={wert ?? ''}
      onChange={(e)=>{ onWert?.(e.target.value); anpassen(); }}
      {...rest}
    />
  );
}

export function Auswahl({ wert, onWert, children, ...rest }){
  return (
    <select className="auswahl" value={wert ?? ''} onChange={(e)=>onWert?.(e.target.value)} {...rest}>
      {children}
    </select>
  );
}

export function Chip({ gewaehlt = false, primaer = false, neu = false, children, ...rest }){
  const klassen = ['chip'];
  if (gewaehlt) klassen.push('gewaehlt');
  if (primaer) klassen.push('primaer');
  if (neu) klassen.push('chip--neu');
  return (
    <button type="button" className={klassen.join(' ')} aria-pressed={gewaehlt} {...rest}>
      {children}
    </button>
  );
}

/* Ein aufklappbarer Bereich. Das Herzstück der Progressive Disclosure:
   Die Standardansicht zeigt sieben Dinge, alles Weitere liegt hinter
   einem Griff – und der Griff sagt, ob dahinter etwas steht. */
export function Klapp({ titel, zahl = 0, offenStart = false, children }){
  const [offen, setOffen] = useState(offenStart);
  return (
    <section className="klapp">
      <button type="button" className="klappGriff" onClick={()=>setOffen(o => !o)} aria-expanded={offen}>
        <span className="klappZeichen" aria-hidden="true">{offen ? '▾' : '▸'}</span>
        <span>{titel}</span>
        {zahl ? <span className="klappZahl">{zahl}</span> : null}
      </button>
      {offen ? <div className="klappInhalt">{children}</div> : null}
    </section>
  );
}

/* Blatt von unten statt Dialog in der Mitte: erreichbar für den Daumen,
   und es verdeckt nicht den ganzen Bildschirm. */
export function Blatt({ titel, onSchliessen, children, aktionen = null }){
  useEffect(()=>{
    const beiTaste = (e)=>{ if (e.key === 'Escape') onSchliessen?.(); };
    window.addEventListener('keydown', beiTaste);
    return ()=> window.removeEventListener('keydown', beiTaste);
  }, [onSchliessen]);

  return (
    <div className="blattHuelle" role="dialog" aria-modal="true" onClick={(e)=>{ if (e.target === e.currentTarget) onSchliessen?.(); }}>
      <div className="blatt">
        {titel ? <h2 className="blattTitel">{titel}</h2> : null}
        {children}
        {aktionen ? <div className="reihe" style={{ gap: 8 }}>{aktionen}</div> : null}
      </div>
    </div>
  );
}

export function Meldung({ text, onWeg }){
  useEffect(()=>{
    if (!text) return;
    const t = setTimeout(()=> onWeg?.(), 3200);
    return ()=> clearTimeout(t);
  }, [text, onWeg]);
  if (!text) return null;
  return <div className="meldung" role="status">{text}</div>;
}

export function Hinweis({ art = '', children }){
  const klassen = ['hinweis'];
  if (art) klassen.push(`hinweis--${art}`);
  return <div className={klassen.join(' ')}>{children}</div>;
}

export function LeerBild({ zeichen = '🗒️', titel, text, aktion = null }){
  return (
    <div className="leerBild">
      <div className="gross" aria-hidden="true">{zeichen}</div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{titel}</div>
      {text ? <div className="klein">{text}</div> : null}
      {aktion}
    </div>
  );
}

/* Eine Rückfrage, die man nicht übersehen kann. Bewusst selten
   eingesetzt: nur dort, wo etwas verschwindet oder überschrieben wird. */
export function Bestaetigung({ frage, text, bestaetigen = 'Ja', abbrechen = 'Abbrechen', gefahr = false, onJa, onNein }){
  return (
    <Blatt
      titel={frage}
      onSchliessen={onNein}
      aktionen={(
        <>
          <Knopf breit onClick={onNein}>{abbrechen}</Knopf>
          <Knopf breit art={gefahr ? 'gefahr' : 'primaer'} onClick={onJa}>{bestaetigen}</Knopf>
        </>
      )}
    >
      {text ? <p className="leise" style={{ margin: 0 }}>{text}</p> : null}
    </Blatt>
  );
}
