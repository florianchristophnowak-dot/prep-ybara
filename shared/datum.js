/* ============================================================
   Datumsrechnung, die Desktop und Pocket teilen

   Klein und ohne Abhängigkeiten. Alles rechnet in LOKALER Zeit: ein
   Schultag ist ein Kalendertag am Ort der Schule, keine UTC-Angabe.
   Deshalb wird nirgends Date.toISOString() für ein Datum benutzt – das
   verschiebt in westlichen Zeitzonen auf den Vortag.

   Die Woche beginnt am Montag; dayIndex 0 ist Montag. Das entspricht
   der Wochenansicht des Desktops und ist die Grundlage dafür, dass ein
   Pocket-Datum dort denselben Platz trifft.
   ============================================================ */

export function toISODate(date){
  const d = (date instanceof Date) ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

export function fromISODate(iso){
  const s = String(iso || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(date, tage){
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + (Number(tage) || 0));
  return d;
}

export function startOfWeekMonday(date){
  const d = new Date(date.getTime());
  const wochentag = (d.getDay() + 6) % 7;   // Montag = 0
  d.setDate(d.getDate() - wochentag);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Der Platz eines Datums im Wochenraster des Desktops. */
export function wochenPosition(iso){
  const d = fromISODate(iso);
  if (Number.isNaN(d.getTime())) return null;
  const montag = startOfWeekMonday(d);
  return { weekStart: toISODate(montag), dayIndex: (d.getDay() + 6) % 7 };
}

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function formatDatum(iso, { lang = false } = {}){
  const d = fromISODate(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tag = WOCHENTAGE[(d.getDay() + 6) % 7];
  const kurz = WOCHENTAGE_KURZ[(d.getDay() + 6) % 7];
  const datum = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  return lang ? `${tag}, ${datum}` : `${kurz}, ${datum}`;
}

/* "vor 12 Minuten", "gestern" – die Angabe, die auf der Startseite von
   Pocket unter jedem Entwurf steht. Bewusst grob: es geht um
   Orientierung, nicht um Buchführung. */
export function relativeZeit(iso, jetzt = new Date()){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sekunden = Math.round((jetzt.getTime() - d.getTime()) / 1000);
  if (sekunden < 45) return 'gerade eben';
  const minuten = Math.round(sekunden / 60);
  if (minuten < 60) return `vor ${minuten} Minute${minuten === 1 ? '' : 'n'}`;
  const heute = toISODate(jetzt);
  const gestern = toISODate(addDays(jetzt, -1));
  const tag = toISODate(d);
  if (tag === heute) {
    const stunden = Math.round(minuten / 60);
    return `vor ${stunden} Stunde${stunden === 1 ? '' : 'n'}`;
  }
  if (tag === gestern) return 'gestern';
  const tage = Math.round((fromISODate(heute).getTime() - fromISODate(tag).getTime()) / 86400000);
  if (tage > 1 && tage < 7) return `vor ${tage} Tagen`;
  return formatDatum(tag);
}
