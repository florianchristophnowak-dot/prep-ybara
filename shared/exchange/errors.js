/* ============================================================
   Fehler beim Einlesen einer Austauschdatei

   Grundsatz: Eine kaputte, fremde oder zu neue Datei darf niemals einen
   Absturz auslösen. Sie erzeugt einen Fehler mit einem Text, den man
   ohne technisches Vorwissen versteht – und mit einem `code`, an dem
   die Oberfläche entscheiden kann, ob sie zusätzlich etwas anbietet.
   ============================================================ */

export const FEHLER = {
  KEIN_JSON: 'kein-json',
  FALSCHES_FORMAT: 'falsches-format',
  FEHLENDE_VERSION: 'fehlende-version',
  ZU_NEU: 'zu-neu',
  LEER: 'leer',
};

export class ExchangeError extends Error {
  constructor(code, message, details = null){
    super(message);
    this.name = 'ExchangeError';
    this.code = code;
    this.details = details;
  }
}

export function keinGueltigerExport(was = 'Prép-ybara-Pocket-Export'){
  return new ExchangeError(
    FEHLER.FALSCHES_FORMAT,
    `Diese Datei ist kein gültiger ${was}.`
  );
}

export function keinJson(){
  return new ExchangeError(
    FEHLER.KEIN_JSON,
    'Diese Datei lässt sich nicht lesen. Sie ist beschädigt oder stammt nicht aus Prép-ybara.'
  );
}

export function zuNeu(gefunden, bekannt){
  return new ExchangeError(
    FEHLER.ZU_NEU,
    `Diese Datei stammt aus einer neueren Fassung (Austauschschema ${gefunden}). `
    + `Diese Anwendung kennt Schema ${bekannt}. Bitte aktualisiere Prép-ybara bzw. Prép-ybara Pocket.`,
    { gefunden, bekannt }
  );
}

export function fehlendeVersion(){
  return new ExchangeError(
    FEHLER.FEHLENDE_VERSION,
    'Diese Datei nennt keine Schemafassung. Sie stammt nicht aus Prép-ybara.'
  );
}

/* Für Aufrufstellen, die nur eine Meldung anzeigen wollen und nicht
   zwischen Fehlerarten unterscheiden. */
export function fehlertext(err, rueckfall = 'Die Datei konnte nicht gelesen werden.'){
  if (err instanceof ExchangeError) return err.message;
  const t = String(err?.message || '').trim();
  return t || rueckfall;
}
