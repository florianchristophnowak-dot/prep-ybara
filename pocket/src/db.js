/* ============================================================
   Lokale Ablage von Pocket

   IndexedDB, ein Eintrag je Entwurf. Bewusst nicht ein grosser
   JSON-Block in localStorage: dort würde jede Tastatureingabe die
   gesamte Ablage neu serialisieren, synchron und auf dem Haupt-Thread.
   Hier wird nur der eine geänderte Entwurf geschrieben, asynchron; die
   Eingabe bleibt flüssig, auch auf einem älteren Telefon.

   Die Schlüssel sind sprechend:

     profile          das eingelesene Pocket-Profil (höchstens eines)
     draft:<id>       ein Entwurf
     idea:<id>        eine Unterrichtsidee
     settings         Kleinigkeiten der Oberfläche

   Daraus folgt unmittelbar die wichtigste Zusage: ein neues Profil
   berührt die Einträge draft:* und idea:* nicht. Es kann gar nicht
   anders sein – es liegt an einem anderen Schlüssel.

   Ein Export liest nur; er löscht nichts.
   ============================================================ */

import { createStore, get, set, del, keys, getMany } from 'idb-keyval';

const store = createStore('prepybara-pocket', 'pocket');

const SCHLUESSEL_PROFIL = 'profile';
const SCHLUESSEL_EINSTELLUNGEN = 'settings';
const PRAEFIX_ENTWURF = 'draft:';
const PRAEFIX_IDEE = 'idea:';

/* Jeder Zugriff ist gekapselt: Ein Browser im privaten Modus, eine
   verweigerte Freigabe oder ein voller Speicher darf die App nicht
   anhalten. Sie läuft dann für diese Sitzung weiter, nur ohne Ablage –
   und sagt es (siehe speicherFehler). */
let letzterFehler = null;
export function speicherFehler(){ return letzterFehler; }

async function sicher(aktion, rueckfall = null){
  try {
    const wert = await aktion();
    letzterFehler = null;
    return wert;
  } catch (err) {
    letzterFehler = String(err?.message || err);
    return rueckfall;
  }
}

export async function ladeAlles(){
  return sicher(async ()=>{
    const alle = await keys(store);
    const entwurfsKeys = alle.filter(k => typeof k === 'string' && k.startsWith(PRAEFIX_ENTWURF));
    const ideenKeys = alle.filter(k => typeof k === 'string' && k.startsWith(PRAEFIX_IDEE));
    const [profil, einstellungen, entwuerfe, ideen] = await Promise.all([
      get(SCHLUESSEL_PROFIL, store),
      get(SCHLUESSEL_EINSTELLUNGEN, store),
      getMany(entwurfsKeys, store),
      getMany(ideenKeys, store),
    ]);
    return {
      profil: profil || null,
      einstellungen: einstellungen || {},
      entwuerfe: (entwuerfe || []).filter(Boolean),
      ideen: (ideen || []).filter(Boolean),
    };
  }, { profil: null, einstellungen: {}, entwuerfe: [], ideen: [] });
}

export async function schreibeEntwurf(entwurf){
  if (!entwurf?.id) return false;
  return sicher(async ()=>{ await set(PRAEFIX_ENTWURF + entwurf.id, entwurf, store); return true; }, false);
}

export async function loescheEntwurf(id){
  return sicher(async ()=>{ await del(PRAEFIX_ENTWURF + id, store); return true; }, false);
}

export async function schreibeIdee(idee){
  if (!idee?.id) return false;
  return sicher(async ()=>{ await set(PRAEFIX_IDEE + idee.id, idee, store); return true; }, false);
}

export async function loescheIdee(id){
  return sicher(async ()=>{ await del(PRAEFIX_IDEE + id, store); return true; }, false);
}

/* Ein neues Profil ersetzt genau das Profil – nicht mehr. */
export async function schreibeProfil(profil){
  return sicher(async ()=>{ await set(SCHLUESSEL_PROFIL, profil, store); return true; }, false);
}

export async function loescheProfil(){
  return sicher(async ()=>{ await del(SCHLUESSEL_PROFIL, store); return true; }, false);
}

export async function schreibeEinstellungen(einstellungen){
  return sicher(async ()=>{ await set(SCHLUESSEL_EINSTELLUNGEN, einstellungen, store); return true; }, false);
}

/* Dauerhafte Ablage anfragen. Ohne diese Zusage darf der Browser die
   Daten bei Platzmangel verwerfen. Die Antwort steht in den
   Einstellungen – wer sie nicht bekommt, sollte häufiger exportieren. */
export async function frageDauerhafteAblage(){
  try {
    if (!navigator.storage?.persist) return { unterstuetzt: false, zugesagt: false };
    const schon = await navigator.storage.persisted?.();
    if (schon) return { unterstuetzt: true, zugesagt: true };
    const zugesagt = await navigator.storage.persist();
    return { unterstuetzt: true, zugesagt: Boolean(zugesagt) };
  } catch {
    return { unterstuetzt: false, zugesagt: false };
  }
}
