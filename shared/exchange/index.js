/* ============================================================
   Gemeinsame Schicht zwischen Prép-ybara Desktop und Prép-ybara Pocket

   Was hier liegt, benutzen BEIDE Anwendungen: das Austauschschema, die
   Ableitung stabiler Kennungen, die Prüfung eingelesener Dateien.

   Was hier NICHT liegt: Oberfläche. Desktop und Pocket teilen sich
   bewusst keine Komponenten. Der Desktop plant am grossen Bildschirm
   mit Tabelle und Zeitstrahl, Pocket erfasst mit dem Daumen im
   Hochformat. Geteilte Bausteine hätten beide Seiten zum schlechteren
   Kompromiss gezwungen; geteilt wird deshalb nur das Format – die
   einzige Stelle, an der sich beide wirklich einig sein müssen.
   ============================================================ */

export {
  EXCHANGE_SCHEMA_VERSION,
  FORMAT_LESSON, FORMAT_LESSON_BUNDLE, FORMAT_PROFILE,
  EXT_LESSON, EXT_LESSON_BUNDLE, EXT_PROFILE,
  FILE_TYPES,
} from './version.js';

export { ExchangeError, FEHLER, fehlertext } from './errors.js';

export {
  normalisiereEtikett, vergleichsSchluessel,
  stableId, classIdFor, subjectIdFor, groupIdFor, groupLabel,
  neueExternalId, neueId,
} from './ids.js';

export {
  ARTEN,
  normalisiereStunde, normalisierePhase, normalisiereScaffold,
  normalisiereLernziel, normalisiereLernziele,
  normalisiereAufgabe, istLeereAufgabe,
  normalisiereMittel, istLeereMittel,
  gesamtdauer, anzeigeName, gruppenName, dateiname,
  packeStunden, leseStunden, leseStundenDatei, istIsoDatum,
} from './lesson.js';

export {
  normalisiereProfil, normalisiereGruppe, normalisiereStundenplanEintrag,
  normalisiereKompetenz, normalisiereSprechabsicht,
  profilUmfang, leseProfil, leseProfilDatei,
} from './profile.js';
