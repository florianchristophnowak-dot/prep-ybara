/* ============================================================
   Zustand und Auto-Speichern

   Es gibt keinen Speichern-Knopf. Jede Änderung geht in den Zustand und
   kurz darauf in die Ablage – gebündelt, damit nicht jeder Tastendruck
   schreibt, aber schnell genug, dass ein weggelegtes Telefon nichts
   verliert.

   Zwei Vorkehrungen machen daraus ein Versprechen und nicht nur eine
   Absicht:

   1. Vor dem Verschwinden der Seite (pagehide, Wechsel in den
      Hintergrund) wird sofort geschrieben, ohne auf die Sammelfrist zu
      warten. Genau dieser Augenblick ist der gefährliche: Auf einem
      Telefon wird eine App nicht geschlossen, sie wird verdrängt.

   2. Geschrieben wird je Entwurf. Ein Fehlschlag bei einem Eintrag
      betrifft die anderen nicht.

   Ein Export verändert nur den Vermerk "zuletzt exportiert" – der
   Entwurf bleibt liegen, wo er ist.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ladeAlles, schreibeEntwurf, loescheEntwurf as dbLoescheEntwurf,
  schreibeIdee, loescheIdee as dbLoescheIdee, schreibeProfil, loescheProfil,
  schreibeEinstellungen, speicherFehler,
} from './db.js';
import {
  neuerEntwurf, neueIdee, ideeZuEntwurf, dupliziereEntwurf as kopiereEntwurf,
} from './model.js';
import { leseProfilDatei, profilUmfang } from '../../shared/exchange/index.js';

const SAMMELFRIST_MS = 400;

export function usePocketStore(){
  const [bereit, setBereit] = useState(false);
  const [profil, setProfil] = useState(null);
  const [entwuerfe, setEntwuerfe] = useState([]);
  const [ideen, setIdeen] = useState([]);
  const [einstellungen, setEinstellungen] = useState({});
  const [fehler, setFehler] = useState(null);

  /* Was noch geschrieben werden muss. Der Schlüssel ist die Kennung,
     der Wert die zuletzt bekannte Fassung – mehrfaches Tippen im selben
     Feld erzeugt dadurch genau einen Schreibvorgang. */
  const offen = useRef(new Map());
  const timer = useRef(null);

  const schreibeOffene = useCallback(async ()=>{
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!offen.current.size) return;
    const aufgaben = [...offen.current.values()];
    offen.current.clear();
    for (const aufgabe of aufgaben) {
      if (aufgabe.typ === 'entwurf') await schreibeEntwurf(aufgabe.objekt);
      else if (aufgabe.typ === 'idee') await schreibeIdee(aufgabe.objekt);
    }
    const f = speicherFehler();
    setFehler(f);
  }, []);

  const planeSchreiben = useCallback((typ, objekt)=>{
    if (!objekt?.id) return;
    offen.current.set(`${typ}:${objekt.id}`, { typ, objekt });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(()=>{ schreibeOffene(); }, SAMMELFRIST_MS);
  }, [schreibeOffene]);

  /* Erstes Laden. */
  useEffect(()=>{
    let abgebrochen = false;
    (async ()=>{
      const daten = await ladeAlles();
      if (abgebrochen) return;
      setProfil(daten.profil);
      setEntwuerfe(sortiereNachAenderung(daten.entwuerfe));
      setIdeen(sortiereNachAenderung(daten.ideen));
      setEinstellungen(daten.einstellungen || {});
      setFehler(speicherFehler());
      setBereit(true);
    })();
    return ()=>{ abgebrochen = true; };
  }, []);

  /* Der wichtige Augenblick: die Seite verschwindet. */
  useEffect(()=>{
    const sofort = ()=>{ schreibeOffene(); };
    const beiSichtbarkeit = ()=>{ if (document.visibilityState === 'hidden') schreibeOffene(); };
    window.addEventListener('pagehide', sofort);
    window.addEventListener('beforeunload', sofort);
    document.addEventListener('visibilitychange', beiSichtbarkeit);
    return ()=>{
      window.removeEventListener('pagehide', sofort);
      window.removeEventListener('beforeunload', sofort);
      document.removeEventListener('visibilitychange', beiSichtbarkeit);
      schreibeOffene();
    };
  }, [schreibeOffene]);

  /* ---- Entwürfe ------------------------------------------------------ */

  const entwurfAnlegen = useCallback((vorgabe = {})=>{
    const entwurf = neuerEntwurf(vorgabe);
    setEntwuerfe(prev => [entwurf, ...prev]);
    planeSchreiben('entwurf', entwurf);
    return entwurf;
  }, [planeSchreiben]);

  const entwurfAendern = useCallback((id, patchOderFn)=>{
    setEntwuerfe((prev)=>{
      let geaendert = null;
      const naechste = prev.map((e)=>{
        if (e.id !== id) return e;
        const patch = typeof patchOderFn === 'function' ? patchOderFn(e) : patchOderFn;
        geaendert = { ...e, ...patch, updatedAt: new Date().toISOString() };
        return geaendert;
      });
      if (geaendert) planeSchreiben('entwurf', geaendert);
      return naechste;
    });
  }, [planeSchreiben]);

  const entwurfLoeschen = useCallback(async (id)=>{
    offen.current.delete(`entwurf:${id}`);
    setEntwuerfe(prev => prev.filter(e => e.id !== id));
    await dbLoescheEntwurf(id);
  }, []);

  const entwurfDuplizieren = useCallback((id)=>{
    let kopie = null;
    setEntwuerfe((prev)=>{
      const quelle = prev.find(e => e.id === id);
      if (!quelle) return prev;
      kopie = kopiereEntwurf(quelle);
      planeSchreiben('entwurf', kopie);
      return [kopie, ...prev];
    });
    return kopie;
  }, [planeSchreiben]);

  /* Nach dem Export nur einen Vermerk setzen. Der Entwurf bleibt. */
  const entwurfExportiert = useCallback((ids)=>{
    const menge = new Set(Array.isArray(ids) ? ids : [ids]);
    const zeit = new Date().toISOString();
    setEntwuerfe((prev)=> prev.map((e)=>{
      if (!menge.has(e.id)) return e;
      const naechster = { ...e, exportedAt: zeit };
      planeSchreiben('entwurf', naechster);
      return naechster;
    }));
  }, [planeSchreiben]);

  /* ---- Ideen --------------------------------------------------------- */

  const ideeAnlegen = useCallback((vorgabe = {})=>{
    const idee = neueIdee(vorgabe);
    setIdeen(prev => [idee, ...prev]);
    planeSchreiben('idee', idee);
    return idee;
  }, [planeSchreiben]);

  const ideeAendern = useCallback((id, patch)=>{
    setIdeen((prev)=>{
      let geaendert = null;
      const naechste = prev.map((i)=>{
        if (i.id !== id) return i;
        geaendert = { ...i, ...patch, updatedAt: new Date().toISOString() };
        return geaendert;
      });
      if (geaendert) planeSchreiben('idee', geaendert);
      return naechste;
    });
  }, [planeSchreiben]);

  const ideeLoeschen = useCallback(async (id)=>{
    offen.current.delete(`idee:${id}`);
    setIdeen(prev => prev.filter(i => i.id !== id));
    await dbLoescheIdee(id);
  }, []);

  /* Aus der Idee wird ein Entwurf. Die Idee selbst verschwindet dabei –
     sonst stünde dieselbe Sache an zwei Stellen und man müsste beide
     pflegen. */
  const ideeUmwandeln = useCallback(async (id)=>{
    const idee = ideen.find(i => i.id === id);
    if (!idee) return null;
    const entwurf = ideeZuEntwurf(idee);
    setEntwuerfe(prev => [entwurf, ...prev]);
    planeSchreiben('entwurf', entwurf);
    await schreibeOffene();
    await ideeLoeschen(id);
    return entwurf;
  }, [ideen, planeSchreiben, schreibeOffene, ideeLoeschen]);

  /* ---- Profil -------------------------------------------------------- */

  /* Wirft ExchangeError mit verständlichem Text, wenn die Datei nicht
     passt. Entwürfe und Ideen werden nicht angefasst – sie liegen an
     eigenen Schlüsseln. */
  const profilImportieren = useCallback(async (inhalt)=>{
    const gelesen = leseProfilDatei(inhalt);
    await schreibeProfil(gelesen);
    setProfil(gelesen);
    return { profil: gelesen, umfang: profilUmfang(gelesen) };
  }, []);

  const profilEntfernen = useCallback(async ()=>{
    await loescheProfil();
    setProfil(null);
  }, []);

  const einstellungenAendern = useCallback((patch)=>{
    setEinstellungen((prev)=>{
      const naechste = { ...prev, ...patch };
      schreibeEinstellungen(naechste);
      return naechste;
    });
  }, []);

  const sortierteEntwuerfe = useMemo(()=> sortiereNachAenderung(entwuerfe), [entwuerfe]);
  const sortierteIdeen = useMemo(()=> sortiereNachAenderung(ideen), [ideen]);

  return {
    bereit, fehler,
    profil, entwuerfe: sortierteEntwuerfe, ideen: sortierteIdeen, einstellungen,
    entwurfAnlegen, entwurfAendern, entwurfLoeschen, entwurfDuplizieren, entwurfExportiert,
    ideeAnlegen, ideeAendern, ideeLoeschen, ideeUmwandeln,
    profilImportieren, profilEntfernen,
    einstellungenAendern,
    jetztSchreiben: schreibeOffene,
  };
}

function sortiereNachAenderung(liste){
  return [...(liste || [])].sort((a, b)=> String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')));
}
