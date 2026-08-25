/* ============================================================
   Austauschschema zwischen Prép-ybara (Desktop) und Prép-ybara Pocket

   EINE Zahl entscheidet über die Verträglichkeit: schemaVersion.

   Sie hat nichts mit der Version der Desktop-App und nichts mit der
   Version von Pocket zu tun. Beide Anwendungen dürfen sich unabhängig
   voneinander weiterentwickeln; getauscht werden kann, solange beide
   dieselbe Schemafassung lesen. Deshalb steht die Zahl hier – an einer
   Stelle, die beide Anwendungen einbinden – und nicht zweimal.

   Regel für spätere Fassungen:
   - Rein additive Felder (optional, leer erlaubt) ändern die Zahl NICHT.
     Eine ältere Anwendung ignoriert, was sie nicht kennt.
   - Erst eine Änderung, die eine ältere Anwendung falsch verstehen
     würde, hebt die Zahl an.

   Eine Datei mit einer höheren als der hier bekannten Fassung wird
   NICHT geraten, sondern mit einer verständlichen Meldung abgelehnt.
   ============================================================ */

export const EXCHANGE_SCHEMA_VERSION = 1;

/* Die Formatkennungen. Sie stehen in jeder Datei und sagen, was sie ist –
   die Dateiendung allein ist keine Zusicherung. */
export const FORMAT_LESSON = 'prepybara-lesson';
export const FORMAT_LESSON_BUNDLE = 'prepybara-lessons';
export const FORMAT_PROFILE = 'prepybara-profile';

/* Dateiendungen. Bewusst sprechend statt .json: der Doppelklick soll
   nicht im Texteditor landen, und die Herkunft soll sichtbar sein.
   Technisch ist der Inhalt JSON. */
export const EXT_LESSON = '.prepybara-lesson';
export const EXT_LESSON_BUNDLE = '.prepybara-lessons';
export const EXT_PROFILE = '.prepybara-profile';

/* Wofür die jeweilige Datei gut ist – für Dateidialoge. */
export const FILE_TYPES = {
  lesson: { description: 'Prép-ybara Pocket – Stunde', extensions: [EXT_LESSON, EXT_LESSON_BUNDLE] },
  profile: { description: 'Prép-ybara – Pocket-Profil', extensions: [EXT_PROFILE] },
};
