/* ============================================================
   Sicherung der Beobachtungen – verschlüsselt, von Anfang an

   Die Beobachtungen liegen in einer eigenen Ablage und gehen deshalb
   in kein Backup der Planung ein (siehe beobachtung.js, Grundsatz 1).
   Gesichert werden sie über eine eigene Datei, und diese Datei ist
   immer mit einem Passwort geschützt. Es gibt keinen Schalter
   "unverschlüsselt": Eine Sicherung wandert auf einen USB-Stick, in
   eine Cloud, an ein zweites Gerät – genau die Wege, auf denen Namen
   und Einschätzungen von Lernenden nichts verloren haben, solange sie
   lesbar sind.

   Das Verfahren ist bewusst unspektakulär und überall vorhanden
   (WebCrypto im Electron-Renderer, im Browser und in Node):

     - Aus dem Passwort wird mit PBKDF2 (SHA-256) und einem zufälligen
       Salz ein Schlüssel abgeleitet. Die vielen Durchläufe machen
       jedes Ausprobieren eines Passworts teuer.
     - Mit diesem Schlüssel verschlüsselt AES-GCM den Inhalt. GCM prüft
       zugleich die Unversehrtheit: Ein falsches Passwort und eine
       veränderte Datei fallen beide beim Entschlüsseln auf. Sie lassen
       sich – absichtlich – nicht unterscheiden; die Fehlermeldung nennt
       deshalb beides.

   Im Klartext steht in der Datei nur, was zum Entschlüsseln nötig ist:
   Format, Verfahren, Salz, IV. Auch der Zeitpunkt der Sicherung und
   die App-Version stehen erst im verschlüsselten Teil.

   Ohne das Passwort ist die Datei verloren. Es gibt keine Hintertür
   und keine Wiederherstellung – das sagt die Oberfläche vor dem
   Sichern deutlich.

   Diese Datei ist rein: kein DOM, keine Ablage. Ein- und Ausgabe der
   Datei erledigen die Plattformadapter.
   ============================================================ */

import { normalisiereBeobachtungsdaten } from './beobachtung.js';

export const SICHERUNG_FORMAT = 'prepybara-beobachtung';
export const SICHERUNG_ENDUNG = '.prepybara-beobachtung';
export const SICHERUNG_SCHEMA = 1;
export const MIN_PASSWORT = 8;

/* Durchläufe der Schlüsselableitung. 310 000 ist die Empfehlung für
   PBKDF2 mit SHA-256; auf einem gewöhnlichen Rechner dauert das einen
   Augenblick, beim Ausprobieren von Millionen Passwörtern dagegen
   Jahre. Tests dürfen weniger nehmen. */
export const STANDARD_ITERATIONEN = 310000;

/* Obergrenze beim LESEN. Die Zahl der Durchläufe steht im Klartext in
   der Datei; eine Datei mit einer absurden Zahl liesse die App sonst
   minutenlang rechnen, bevor sie "falsches Passwort" sagen kann. */
export const MAX_ITERATIONEN = 10000000;

const SALZ_BYTES = 16;
const IV_BYTES = 12;

export const FEHLER_PASSWORT = 'Das Passwort passt nicht, oder die Datei ist beschädigt.';
export const FEHLER_KEINE_SICHERUNG = 'Die Datei ist keine Sicherung der Beobachtungen aus Prép-ybara.';
export const FEHLER_NEUERE_VERSION = 'Die Sicherung stammt aus einer neueren Version von Prép-ybara. Bitte zuerst die App aktualisieren.';
export const FEHLER_PASSWORT_KURZ = `Das Passwort muss mindestens ${MIN_PASSWORT} Zeichen lang sein.`;
export const FEHLER_PASSWORT_FEHLT = 'Bitte das Passwort der Sicherung eingeben.';
export const FEHLER_KEIN_WEBCRYPTO = 'Diese Umgebung kann keine verschlüsselten Dateien lesen oder schreiben.';
/* Für die Plattformadapter: Ihr Weg für Beobachtungsdateien nimmt nur
   an, was istSicherung() erkennt. */
export const FEHLER_NUR_VERSCHLUESSELT = 'Gespeichert werden nur verschlüsselte Sicherungen der Beobachtungen.';

function fehler(meldung, code){
  const e = new Error(meldung);
  e.code = code;
  return e;
}

function subtle(){
  const s = globalThis.crypto?.subtle;
  if (!s || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw fehler(FEHLER_KEIN_WEBCRYPTO, 'kein-webcrypto');
  }
  return s;
}

/* Dasselbe Passwort soll auf jedem Gerät denselben Schlüssel ergeben.
   Ein "ü" kann als ein Zeichen oder als "u" plus Trema ankommen, je
   nach Tastatur und System – beides wird hier zur selben Form. */
function passwortForm(passwort){
  return typeof passwort === 'string' ? passwort.normalize('NFC') : '';
}

/* ---- base64 ----------------------------------------------------------
   Ohne Buffer, damit dasselbe Modul im Renderer läuft. btoa/atob
   kennen nur "Binärzeichenketten"; die Umwandlung geschieht in
   Stücken, weil String.fromCharCode mit einer sehr langen
   Argumentliste den Aufrufstapel sprengt. */

const STUECK = 0x8000;
const BASE64_MUSTER = /^[A-Za-z0-9+/]*={0,2}$/;

function zuBase64(bytes){
  let binaer = '';
  for (let i = 0; i < bytes.length; i += STUECK) {
    binaer += String.fromCharCode.apply(null, bytes.subarray(i, i + STUECK));
  }
  return btoa(binaer);
}

function ausBase64(text){
  if (typeof text !== 'string' || text.length % 4 !== 0 || !BASE64_MUSTER.test(text)) return null;
  let binaer = '';
  try { binaer = atob(text); } catch { return null; }
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i += 1) bytes[i] = binaer.charCodeAt(i);
  return bytes;
}

/* ---- Schlüssel -------------------------------------------------------- */

async function leiteSchluesselAb(passwort, salz, iterationen){
  const s = subtle();
  const roh = await s.importKey('raw', new TextEncoder().encode(passwortForm(passwort)), 'PBKDF2', false, ['deriveKey']);
  return s.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: iterationen },
    roh,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function zeitpunktAus(jetzt){
  const w = typeof jetzt === 'function' ? jetzt() : jetzt;
  const d = w instanceof Date ? w : new Date(w ?? Date.now());
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

/* ---- Erstellen -------------------------------------------------------

   Die Daten werden vor dem Verschlüsseln normalisiert: In die Datei
   gelangt nur, was sich später auch wieder einlesen lässt. Rückgabe
   ist der fertige Dateiinhalt als Text. */
export async function erstelleSicherung(daten, passwort, {
  appVersion = '',
  jetzt = new Date(),
  iterationen = STANDARD_ITERATIONEN,
} = {}){
  const pw = passwortForm(passwort);
  if ([...pw].length < MIN_PASSWORT) throw fehler(FEHLER_PASSWORT_KURZ, 'passwort-kurz');

  const n = Math.floor(Number(iterationen));
  const durchlaeufe = Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_ITERATIONEN) : STANDARD_ITERATIONEN;

  const s = subtle();
  const salz = globalThis.crypto.getRandomValues(new Uint8Array(SALZ_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const schluessel = await leiteSchluesselAb(pw, salz, durchlaeufe);

  const klartext = JSON.stringify({
    exportiertAm: zeitpunktAus(jetzt),
    appVersion: String(appVersion || ''),
    daten: normalisiereBeobachtungsdaten(daten),
  });
  const chiffrat = await s.encrypt({ name: 'AES-GCM', iv }, schluessel, new TextEncoder().encode(klartext));

  return JSON.stringify({
    format: SICHERUNG_FORMAT,
    schemaVersion: SICHERUNG_SCHEMA,
    verschluesselt: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterationen: durchlaeufe, salz: zuBase64(salz) },
    chiffre: { name: 'AES-GCM', iv: zuBase64(iv) },
    inhalt: zuBase64(new Uint8Array(chiffrat)),
  }, null, 2);
}

/* ---- Erkennen --------------------------------------------------------
   Für die Oberfläche: Ist die gewählte Datei eine Sicherung (dann
   nach dem Passwort fragen) oder etwas anderes, etwa ein Export aus
   Capy-scope? Geprüft wird nur die Hülle, nicht der Inhalt. */

function lies(textOderObjekt){
  if (textOderObjekt && typeof textOderObjekt === 'object') return textOderObjekt;
  if (typeof textOderObjekt !== 'string') return null;
  try {
    const o = JSON.parse(textOderObjekt);
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null;
  } catch { return null; }
}

export function istSicherung(text){
  const o = lies(text);
  return Boolean(o)
    && o.format === SICHERUNG_FORMAT
    && o.verschluesselt === true
    && typeof o.inhalt === 'string';
}

/* ---- Lesen -----------------------------------------------------------

   Drei Fehler lassen sich auseinanderhalten und bekommen eigene
   Meldungen: keine Sicherung, eine Sicherung aus einer neueren
   Version, kein Passwort eingegeben. Alles andere – falsches Passwort,
   veränderte oder abgeschnittene Datei, unpassende Parameter – endet
   in derselben Meldung. Die Fehler tragen zusätzlich ein `code`, falls
   die Oberfläche etwa nur bei einem falschen Passwort erneut fragen
   will. */
export async function leseSicherung(text, passwort){
  const o = lies(text);
  if (!o || o.format !== SICHERUNG_FORMAT) throw fehler(FEHLER_KEINE_SICHERUNG, 'keine-sicherung');
  const schema = Number(o.schemaVersion);
  if (Number.isFinite(schema) && schema > SICHERUNG_SCHEMA) throw fehler(FEHLER_NEUERE_VERSION, 'neuere-version');

  const pw = passwortForm(passwort);
  if (!pw) throw fehler(FEHLER_PASSWORT_FEHLT, 'passwort-fehlt');

  const beschaedigt = ()=> fehler(FEHLER_PASSWORT, 'passwort-oder-beschaedigt');
  const kdf = (o.kdf && typeof o.kdf === 'object') ? o.kdf : {};
  const chiffre = (o.chiffre && typeof o.chiffre === 'object') ? o.chiffre : {};
  const iterationen = kdf.iterationen;
  const salz = ausBase64(kdf.salz);
  const iv = ausBase64(chiffre.iv);
  const inhalt = ausBase64(o.inhalt);
  if (o.verschluesselt !== true
    || kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256'
    || !Number.isInteger(iterationen) || iterationen < 1 || iterationen > MAX_ITERATIONEN
    || chiffre.name !== 'AES-GCM'
    || !salz || salz.length !== SALZ_BYTES
    || !iv || iv.length !== IV_BYTES
    || !inhalt || inhalt.length === 0) {
    throw beschaedigt();
  }

  const s = subtle();
  let klartext = '';
  try {
    const schluessel = await leiteSchluesselAb(pw, salz, iterationen);
    const roh = await s.decrypt({ name: 'AES-GCM', iv }, schluessel, inhalt);
    klartext = new TextDecoder('utf-8', { fatal: true }).decode(roh);
  } catch {
    throw beschaedigt();
  }

  let paket = null;
  try { paket = JSON.parse(klartext); } catch { throw beschaedigt(); }
  if (!paket || typeof paket !== 'object' || Array.isArray(paket)) throw beschaedigt();

  return {
    daten: normalisiereBeobachtungsdaten(paket.daten),
    exportiertAm: typeof paket.exportiertAm === 'string' ? paket.exportiertAm : '',
    appVersion: typeof paket.appVersion === 'string' ? paket.appVersion : '',
  };
}

/* ---- Dateiname -------------------------------------------------------
   Mit dem lokalen Kalenderdatum, nicht dem UTC-Datum: Eine Sicherung
   kurz nach Mitternacht soll den Tag tragen, an dem sie entstand. */
export function sicherungsDateiname(datum = new Date()){
  let tag = '';
  if (typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datum.trim())) {
    tag = datum.trim();
  } else {
    const d = datum instanceof Date && Number.isFinite(datum.getTime()) ? datum : new Date();
    const p = (n)=> String(n).padStart(2, '0');
    tag = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return `Prepybara-Beobachtungen-${tag}${SICHERUNG_ENDUNG}`;
}
