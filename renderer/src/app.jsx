import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/logo.webp';
import eastereggImg from './assets/easteregg.webp';
import helpMd from './assets/HELP.md?raw';
import platform, { capabilities, platformName } from './platform/index.js';
import { APP_VERSION } from './version.js';
import { setupServiceWorker } from './pwa.js';
import {
  sequenceProgress, sequenceOccurrences, competencyHeatmap, competencyProfile,
  offenePunkteFuer, todayOverview, weekSummary, allLessonsChronological,
} from './insights.js';
import {
  OHNE_BEREICH_ID, normalisiereModell, normalisiereEtikett,
  katalogNachBereichen, filterKatalog, alleBereiche, bereichVon,
  istSystemKompetenz, istSystemBereich,
} from './competencies.js';
import { erstelleDidaktikCheck, phasenDidaktikImpuls } from './didaktik-check.js';
/* Austausch mit Prép-ybara Pocket. Geteilt wird ausschliesslich das
   Format – Oberfläche und Datenmodell bleiben je Anwendung eigen. */
import { fehlertext, leseStundenDatei, FORMAT_PROFILE } from '../../shared/exchange/index.js';
import { formatDatum as formatDatumLang } from '../../shared/datum.js';
import { buildPocketProfile, pocketProfilDateiname } from './pocket-profile.js';
import {
  MODI as POCKET_MODI, analysierePocketStunde, fuehrePocketImportAus,
  naechsterFreierSlot, pruefeZiel, vorschauZeilen, zielFuer,
} from './pocket-import.js';
import {
  PLANUNGSFELDER, PLANUNGSPROFILE, EXPORTLAYOUTS, NEUE_PHASENFELDER,
  STANDARD_PROFIL, STANDARD_LAYOUT,
  feldDefinition, feldWert, feldText, feldHatInhalt,
  normalisiereProfilId, normalisiereLayoutId, normalisiereFeldListe,
  normalisiereEigenesLayout,
  profilFelder, offeneFelderDerPhase,
  getLessonPlanExportColumns, exportPruefung,
} from './planung.js';
import {
  PHASEN_STATUS, statusZeichen, statusName,
  normalisiereReview, leeresReview, hatNachbereitung, offeneCarryOver,
  stundenRef, parseStundenRef, carryOverAusPhase, carryOverAusNotiz, phaseAusCarryOver,
} from './nachbereitung.js';
import {
  SPRECHABSICHTEN, SCAFFOLD_ARTEN, SCAFFOLD_ART_STANDARD, SCAFFOLD_VORSCHLAEGE,
  UNTERSTUETZUNGSSTUFEN, scaffoldArtName, stufenName, istSystemSprechabsicht,
  normalisiereErfolgskriterien, normalisiereAufgabe, normalisiereMittel,
  normalisiereSprechabsichten, normalisiereScaffolds,
  istLeereAufgabe, istLeereMittel, istLeererScaffold, hatAufgabenDetails, hatFachdidaktik,
  scaffoldsDerStunde, sequenzProgression,
} from './didaktik.js';
import {
  SLOT_MIN, MAX_BLOCK_SPAN, MIN_PHASE_MIN,
  normalisiereBlockSpan, blockSpanOf, lessonTotalMin, lessonKey, belegteSlots,
  blockOwnerAt, istAbgedeckt, stundenBereichLabel, blockName, passenZusammen,
  verteilePhasenAufPlaetze,
} from './doppelstunde.js';
/* Versionsverlauf: längerfristige Wiederherstellungspunkte neben dem
   Rückgängig. Die Logik steht im Modul, die Ablage im Plattformadapter –
   hier werden nur die Sicherungspunkte gesetzt. */
import {
  MAX_TAGE as MAX_VERLAUF_TAGE, MAX_JE_ZIEL as MAX_VERLAUF_JE_ZIEL, MAX_GESAMT as MAX_VERLAUF_GESAMT,
  erstelleEintrag as erstelleVerlaufEintrag,
  stundenTeil, sequenzTeil, vorlagenTeil, balkenTeil,
  stundenZiel, sequenzZiel, vorlagenZiel, balkenZiel,
  geaenderteFelder, eintraegeFuer, aktuellerStand, wendeAn as wendeVerlaufAn,
} from './versionsverlauf.js';
import { erstelleVerlaufSpeicher } from './verlauf-speicher.js';
/* Die optionale Verbindung von Jahresbalken und Sequenzen. Der Balken
   speichert nur die Kennung – alles Weitere wird hieraus gerechnet. */
import {
  auswahlSequenzen, balkenBeschriftung, balkenSequenzId,
  entferneSequenzAusBalken, istVerwaist, zeitraumAusSequenz,
} from './jahresbalken.js';
/* Sequenzen verschieben: erst rechnen, dann zeigen, dann ausführen.
   Die Berechnung ist rein und liegt im Modul; hier steht, was danach
   mit den Daten geschieht. */
import {
  UMFANG as VERSCHIEBE_UMFANG,
  wendeVerschiebungAn, betroffeneOrte, balkenNachVerschiebung,
} from './verschieben.js';
import { VerschiebenDialog } from './verschieben-dialog.jsx';
/* Globale Suche. Der Index entsteht im Arbeitsspeicher aus den Daten
   und wird nirgends gespeichert – er kann deshalb weder veralten noch
   in einem Backup landen. */
import {
  TYPEN as SUCH_TYPEN, baueIndex, sucheImIndex, begriffeAus, normalisiere as foldForSearch,
} from './suche.js';
import { GlobaleSucheView } from './suche-ansicht.jsx';
/* Onboarding. Der Zustand liegt in appSettings.onboarding, die
   Bedingungen im Modul – hier steht nur, was gezeigt wird. */
import {
  STATUS as ONB_STATUS, PFADE as ONB_PFADE, SCHRITT_TEXT as ONB_SCHRITT_TEXT,
  SCHNELLSTART_TEXTE, ZEITEN_TEXTE, PHASEN_HINWEIS,
  normalisiereOnboarding, schritteAus, schnellstartSchritt, zeitenSchritt,
  checklistenArt, checklistenSchritte, onboardingModell,
  onboardingKontext, naechsterHinweis, merkeHinweis, istHinweisErledigt,
  starteOnboarding, pausiereOnboarding, ueberspringeOnboarding, schliesseOnboardingAb,
  markiereSchritt, setzeCheckliste, setzeBackupZeitpunkt,
  starteSchnellstartNeu, setzeHinweiseZurueck,
  ersterFreierPlatz, zeigeWillkommen, zeigeCheckliste,
} from './onboarding.js';
import { Coachmark, WillkommenAnsicht, OnboardingCheckliste } from './onboarding-ansicht.jsx';
/* Unterrichtszeiten: Wochenvorlagen und Stundenplanmodelle. Die
   Berechnung steht im Modul, die Ansicht daneben – hier wird nur
   verbunden. */
import {
  MODELL_TYP, RHYTHMUS, ZEILEN_STATUS,
  normalisiereStundenplandaten, normalisiereStundenplanVorlage, normalisiereStundenplanModell,
  vorlageAusWoche, anwendungsVorschau, wendeVorlageAn, betroffeneOrte as stundenplanOrte,
  aktiviereModell, archiviereModell, aktivesModellFuer, tauscheZyklus, dupliziereVorlage,
  speichereVorlage as speichereVorlageIn, loescheVorlage as loescheVorlageAus,
  setzeAusnahme, labelFuerWoche, positionFuer, zyklusLabel, zyklusLaenge, istWechselModell,
  hatStundenplanVorlagen, hatAktivesModell, modellVollstaendig, angewendeteWochen,
  montagVon as stundenplanMontag,
} from './stundenplan.js';
import {
  StundenplanView, ModellAssistent, AnwendenDialog, RhythmusDialog, WocheAlsVorlageDialog,
} from './stundenplan-ansicht.jsx';
import { VersionsverlaufDialog } from './verlauf-ansicht.jsx';
// Einzelimporte, damit nur die tatsächlich benutzten Symbole im Bündel landen.
import {
  ArrowDown, ArrowLeft, ArrowRight, Ban, CalendarClock, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  Archive, CalendarCheck, CalendarRange, Check, CircleHelp, ClipboardCheck, ClipboardPaste, Copy, Download, Eraser, Eye,
  FileClock, FileDown, FileText, Grid3x3, Library, Link2, ListTree, Maximize2, MoreHorizontal, NotebookPen, Palmtree,
  GraduationCap, Pencil, Play, Plus, Rows3, Scissors, Search, Settings,
  Square, Star, Sun, Trash2, Unlink, X,
} from 'lucide-react';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
/* Der Schlüssel eines Stundenplatzes. Er kommt aus dem Doppelstunden-
   Modul, damit dort und hier dieselbe Form gilt. */
const keyOf = lessonKey;
const PX_PER_MIN = 10;
const TOTAL_MIN = SLOT_MIN;

/* Doppelstunden: eine Stunde kann mehrere Stundenplätze belegen.
   Das Modell dazu steht in ./doppelstunde.js – hier wird es nur
   benutzt. MIN_PHASE_MIN und TOTAL_MIN behalten ihre Namen, damit
   der vorhandene Code unverändert lesbar bleibt. */

// Optional clock-times support
// Users can configure lesson period start times in the school calendar settings.
// If present, we can show the clock start time for each phase (and export it).
function parseHHMM(s){
  const m = String(s || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatHHMM(totalMinutes){
  if (!Number.isFinite(totalMinutes)) return '';
  const mins = ((totalMinutes % (24*60)) + (24*60)) % (24*60);
  const h = String(Math.floor(mins / 60)).padStart(2,'0');
  const m = String(mins % 60).padStart(2,'0');
  return `${h}:${m}`;
}

function addMinutesToHHMM(hhmm, addMin){
  const base = parseHHMM(hhmm);
  if (!Number.isFinite(base)) return '';
  return formatHHMM(base + (Number(addMin) || 0));
}

function getLessonStartTime(schoolCalendar, slotIndex){
  const cal = (schoolCalendar && typeof schoolCalendar === 'object') ? schoolCalendar : {};
  if (!cal.lessonTimesEnabled) return '';
  const arr = Array.isArray(cal.lessonTimes) ? cal.lessonTimes : [];
  const raw = arr?.[slotIndex] || {};
  const t = (raw.start || raw.startTime || '').trim();
  return parseHHMM(t) === null ? '' : t;
}

function computePhaseTimes(phases, lessonStartHHMM){
  const start = parseHHMM(lessonStartHHMM);
  if (start === null) return (phases || []).map(()=>({ start:'', end:'' }));
  let offset = 0;
  return (phases || []).map(p => {
    const s = formatHHMM(start + offset);
    offset += Number(p?.duration || 0);
    const e = formatHHMM(start + offset);
    return { start: s, end: e };
  });
}

// Keep in sync with package.json



const PHASE_HELP_QUESTIONS = {
  Einstieg:
    'Wie werden die Lernenden aktiviert? Woran knüpft die Stunde an? Welcher Impuls führt zum Thema?',
  Erarbeitung:
    'Was wird neu erschlossen? Wie gehen die Lernenden vor? Welche Hilfen stehen zur Verfügung?',
  Anwendung:
    'Wie wenden die Lernenden das Erarbeitete aktiv an? Ist die Aufgabe sprachlich/kommunikativ bedeutsam?',
  Sicherung:
    'Wie werden Ergebnisse sichtbar gemacht? Was muss für alle verfügbar sein?',
  Vertiefung:
    'Wie wird das Gelernte erweitert, differenziert oder genauer durchdrungen?',
  Transfer:
    'Wie wird das Gelernte auf eine neue Situation übertragen?',
  Reflexion:
    'Was haben die Lernenden gelernt? Wie schätzen sie ihr Vorgehen oder Ergebnis ein? Was bleibt offen?',
};

function getPhaseHelpEntry(phaseTitle){
  const normalizedTitle = String(phaseTitle || '').trim().toLowerCase();
  if (!normalizedTitle) return null;
  return Object.entries(PHASE_HELP_QUESTIONS).find(([phase]) =>
    normalizedTitle.includes(phase.toLowerCase())
  ) || null;
}

/* Die Hilfekarte bleibt, was sie ist: allgemeine Leitfragen zum
   Phasennamen, sichtbar nur auf Klick.

   Im Fremdsprachenmodus kommt höchstens EIN fachdidaktischer Zusatz
   dazu – abgeleitet aus dem, was in der Stunde steht. Die vorhandenen
   Leitfragen bleiben unverändert; sie gelten für jedes Fach. */
function PhaseHelpCard({ phaseTitle, lesson = null, phase = null, phaseIndex = 0, languageMode = false }){
  const [open, setOpen] = useState(false);
  const helpEntry = getPhaseHelpEntry(phaseTitle);

  const zusatz = useMemo(
    ()=> (languageMode && open ? phasenDidaktikImpuls(lesson, phase || { title: phaseTitle }, phaseIndex) : null),
    [languageMode, open, lesson, phase, phaseTitle, phaseIndex]
  );

  if (!helpEntry) return null;

  const [phaseName, questions] = helpEntry;
  return (
    <div className="phaseHelp">
      <button
        type="button"
        className="phaseHelpToggle"
        title="Optionale Hilfekarte zu Inhalt / Ablauf"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {open ? 'Hilfekarte ausblenden' : 'Hilfekarte'}
      </button>

      {open ? (
        <div className="phaseHelpCard" role="note">
          <div className="phaseHelpTitle">Leitfragen – {phaseName}</div>
          <div className="phaseHelpText">{questions}</div>
          {zusatz ? (
            <div className="phaseHelpZusatz">
              <div className="phaseHelpZusatzTitel">Fremdsprachendidaktischer Impuls</div>
              <div className="phaseHelpText">{zusatz}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


/* ============================================================
   Farbsystem – die Paletten der Fassung 1.0.9

   Zwei Paletten, wie im Release: 18 Pastelltöne für Lerngruppen und
   12 kräftige Farben für Sequenzen. Die gespeicherte Farbe wird
   unverändert dargestellt – ein Pastellton ist die Fläche, eine
   Sequenzfarbe ist die Linie und die Schrift. Es wird nichts
   umgerechnet; genau das ist die alte Farblogik.

   Ausnahme ist die dunkle Darstellung, die es im Release noch nicht
   gab: dort würde ein Pastellton auf dunklem Grund verschwinden und
   eine kräftige Linie zu dunkel stehen. Nur für diesen Fall wird die
   Helligkeit angepasst – der Farbton bleibt, der Wert in der Datenbank
   ohnehin.
   ============================================================ */

// --- OKLab: perzeptuell gleichmäßige Helligkeitsanpassung ----------------
function _srgbToLinear(c){ return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
function _linearToSrgb(c){ return c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c, 1/2.4)-0.055; }
function _cbrt(v){ return Math.sign(v) * Math.pow(Math.abs(v), 1/3); }

function parseHex(hex){
  let h = String(hex || '').trim().replace('#','');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255);
}
function toHex(rgb){
  return '#' + rgb.map(c => {
    const v = Math.max(0, Math.min(255, Math.round(c*255)));
    return v.toString(16).padStart(2,'0');
  }).join('');
}
function hexToLch(hex){
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r,g,b] = rgb.map(_srgbToLinear);
  const l = _cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = _cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = _cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  const L = 0.2104542553*l + 0.7936177850*m - 0.0040720468*s;
  const A = 1.9779984951*l - 2.4285922050*m + 0.4505937099*s;
  const B = 0.0259040371*l + 0.7827717662*m - 0.8086757660*s;
  return { L, C: Math.hypot(A,B), H: Math.atan2(B,A) };
}
function lchToHex(L, C, H){
  const a = C*Math.cos(H), b = C*Math.sin(H);
  const l = Math.pow(L + 0.3963377774*a + 0.2158037573*b, 3);
  const m = Math.pow(L - 0.1055613458*a - 0.0638541728*b, 3);
  const s = Math.pow(L - 0.0894841775*a - 1.2914855480*b, 3);
  return toHex([
     4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
    -0.0041960863*l - 0.7034186147*m + 1.7076147010*s,
  ].map(v => _linearToSrgb(Math.max(0, Math.min(1, v)))));
}

/* Ob gerade dunkel dargestellt wird. Wird von App beim Rendern gesetzt,
   bevor Kinder rendern, und von den Ableitungen unten gelesen. */
let __prefersDark = false;
function setDarkMode(v){ __prefersDark = Boolean(v); }
function isDarkMode(){ return __prefersDark; }

/* Helligkeit auf einen Zielwert setzen, Farbton und Sättigung behalten.
   Wird ausschliesslich in der dunklen Darstellung aufgerufen. */
function withLightness(hex, L){
  const c = hexToLch(hex);
  if (!c) return '';
  return lchToHex(L, c.C, c.H);
}

/* Fläche: im Hellen der gespeicherte Ton selbst, wie im Release. */
function surfaceColor(hex, dark = isDarkMode()){
  if (!hex) return '';
  return dark ? withLightness(hex, 0.44) : hex;
}
/* Linie und Rand: im Hellen der gespeicherte Ton selbst. */
function lineColor(hex, dark = isDarkMode()){
  if (!hex) return '';
  return dark ? withLightness(hex, 0.72) : hex;
}
/* Schrift: im Hellen der gespeicherte Ton selbst. */
function textColor(hex, dark = isDarkMode()){
  if (!hex) return 'var(--text)';
  return dark ? withLightness(hex, 0.80) : hex;
}

/* Sequenzen: kräftige Farben, sie tragen Linien und Schrift. */
const SEQ_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#d97706',
  '#059669', '#0f766e', '#0891b2', '#4f46e5', '#9333ea', '#be123c'
];

/* Lerngruppen: Pastelltöne, sie tragen Flächen. */
const GROUP_PASTELS = [
  '#fde68a', '#fef3c7',
  '#fecaca', '#ffe4e6',
  '#fbcfe8', '#fce7f3',
  '#f5d0fe', '#e9d5ff', '#ddd6fe',
  '#c7d2fe', '#bfdbfe', '#bae6fd', '#a5f3fc', '#99f6e4',
  '#a7f3d0', '#bbf7d0', '#d9f99d',
  '#e5e7eb'
];

function groupKey(classGroup, subject){
  const g = (classGroup || '').trim();
  const s = (subject || '').trim();
  if (!g || !s) return '';
  return `${g}||${s}`;
}

function defaultGroupColor(key){
  if (!key) return '';
  return GROUP_PASTELS[Math.abs(hashCode(key)) % GROUP_PASTELS.length];
}

function hexToRgba(hex, alpha){
  const h = (hex || '').trim().replace('#','');
  if (h.length === 3){
    const r = parseInt(h[0]+h[0], 16);
    const g = parseInt(h[1]+h[1], 16);
    const b = parseInt(h[2]+h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length === 6){
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}


/* onDismiss wird nur beim Wiederholen gesetzt. Beim Start soll das Bild
   seine drei Sekunden stehen; wer es selbst aufruft, will es auch selbst
   wieder wegklicken können. */
function SplashOverlay({ visible, onDismiss = null }){
  return (
    <div
      className={`splashOverlay${visible ? '' : ' splashOverlay--hide'}${onDismiss ? ' splashOverlay--dismissable' : ''}`}
      aria-hidden={!visible}
      onClick={onDismiss || undefined}
    >
      <div className="splashCard">
        <img className="splashLogo" src={logo} alt="Prép-ybara" />
        <div className="splashTitle">Prép-ybara</div>
        <div className="splashSubtitle">Unterrichtsvorbereitung, entspannt.</div>
      </div>
    </div>
  );
}

/* Die Bildmarke in der Kopfleiste.

   Sie sah bisher nach etwas aus, das man anfassen kann, tat beim Klick
   aber nichts. Statt die Andeutung zu entfernen, löst sie jetzt ein, was
   sie verspricht: das Startbild noch einmal. Als echter Knopf, damit sie
   auch mit der Tastatur erreichbar ist und angesagt wird. */
function LogoButton({ onClick }){
  return (
    <button
      type="button"
      className="logoBtn"
      onClick={onClick}
      title="Startbild noch einmal zeigen"
      aria-label="Startbild noch einmal zeigen"
    >
      <img className="logo" src={logo} alt="" aria-hidden="true" />
    </button>
  );
}

function EasterEggOverlay({ visible }){
  return (
    <div className={`splashOverlay ${visible ? '' : 'splashOverlay--hide'}`} aria-hidden={!visible}>
      <div className="splashCard">
        <img className="easterImage" src={eastereggImg} alt="Prép-ybara Easter Egg" />
      </div>
    </div>
  );
}


function HelpView({ version, onStarteEinfuehrung }){
  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Hilfe</div>
          <div className="muted small">Prép-ybara {version || ''} – Kurzhandbuch</div>
        </div>
        {typeof onStarteEinfuehrung === 'function' ? (
          <button className="btn" onClick={onStarteEinfuehrung}
                  title="Den Schnellstart noch einmal durchlaufen – an der Planung ändert sich nichts">
            <GraduationCap {...ICON_SM} /> Einführung erneut starten
          </button>
        ) : null}
      </div>

      <div style={{height:12}} />

      <div className="helpBox" role="document" aria-label="Hilfe">
        <pre className="helpPre">{helpMd}</pre>
      </div>
    </div>
  );
}

// --- Durchführung / Execution Presenter ---
function clamp01(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}


/* Vorgabe des Schriftfarbwählers im Rich-Text-Editor.

   Bewusst ein fester Wert und kein Token: Die Farbe wird in den
   Stundeninhalt geschrieben und landet unverändert im PDF- und
   Word-Export. Dort ist der Grund immer weiß, unabhängig davon, wie
   die App gerade dargestellt wird. Ein mitschwenkender Wert würde in
   dunkler Darstellung helle Schrift auf weißes Papier exportieren.
   input[type=color] akzeptiert ausserdem kein var(). */
const RTE_DEFAULT_INK = '#111827';


/* ============================================================
   Durchführungsansicht

   Die Präsentationsfassung des Releases: ein grosses Fenster, das die
   laufende Phase zeigt. Die Farbe ist hier die eigentliche Anzeige –
   der Grund wandert über den Verlauf der Phase von Grün nach Rot. Man
   sieht die verbleibende Zeit, ohne die Zahl zu lesen.

   Steht der Countdown still (aus oder pausiert) oder ist die Stunde bei
   den Hausaufgaben angekommen, gibt es nichts zu signalisieren: der
   Grund bleibt dann weiß.
   ============================================================ */

function formatMMSS(totalSeconds){
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/* Grün (Farbton 120) am Anfang der Phase, Rot (Farbton 0) am Ende.
   Hell und schwach gesättigt, damit der Text darauf ruhig bleibt. */
export function bgFromProgress(progress){
  const p = clamp01(progress);
  const hue = 120 * (1 - p);
  return `hsla(${hue}, 55%, 93%, 1)`;
}

export function ExecutionWindow(){
  const [snapshot, setSnapshot] = useState(null);
  const [idx, setIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [isCountdownOn, setIsCountdownOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const endTsRef = useRef(null);
  const tickRef = useRef(null);
  const wurzelRef = useRef(null);

  const snapshotRef = useRef(null);
  const idxRef = useRef(0);
  const remainingRef = useRef(0);
  const countdownRef = useRef(true);
  const pausedRef = useRef(false);

  useEffect(()=>{ snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(()=>{ idxRef.current = idx; }, [idx]);
  useEffect(()=>{ remainingRef.current = remainingSec; }, [remainingSec]);
  useEffect(()=>{ countdownRef.current = isCountdownOn; }, [isCountdownOn]);
  useEffect(()=>{ pausedRef.current = isPaused; }, [isPaused]);

  /* Die Ansicht lebt von der Verlaufsfarbe auf hellem Grund. Sie legt
     sich deshalb – anders als die App – auf die helle Darstellung fest,
     auch wenn das System auf dunkel steht. Gilt für das Electron-Fenster
     wie für das Bild-im-Bild-Fenster im Browser. */
  useEffect(()=>{
    const dok = wurzelRef.current?.ownerDocument;
    try { dok?.documentElement?.setAttribute('data-theme', 'light'); } catch {}
  }, []);

  const phases = Array.isArray(snapshot?.phases) ? snapshot.phases : [];
  const isHomeworkView = snapshot && idx >= phases.length;
  const phase = (!isHomeworkView) ? (phases[idx] || null) : null;
  const durationSec = Math.max(0, Math.round((Number(phase?.duration) || 0) * 60));
  const progress = durationSec > 0 ? (1 - (remainingSec / durationSec)) : 0;
  const bg = (!isHomeworkView && isCountdownOn && !isPaused) ? bgFromProgress(progress) : '#ffffff';

  const resetPhaseTime = (nextIdx) => {
    // Die Hausaufgabenansicht steht NACH der letzten Phase.
    if (nextIdx >= phases.length) {
      endTsRef.current = null;
      setRemainingSec(0);
      setIsPaused(true);
      return;
    }
    const p = phases[nextIdx] || null;
    const d = Math.max(0, Math.round((Number(p?.duration) || 0) * 60));
    endTsRef.current = null;
    setRemainingSec(d);
  };

  const goPrev = () => {
    setIdx((cur)=>{
      const next = Math.max(0, cur - 1);
      setTimeout(()=>resetPhaseTime(next), 0);
      return next;
    });
  };
  const goNext = () => {
    setIdx((cur)=>{
      const next = Math.min(phases.length, cur + 1);
      setTimeout(()=>resetPhaseTime(next), 0);
      return next;
    });
  };

  const toggleFullscreen = async () => {
    try {
      const dok = wurzelRef.current?.ownerDocument || document;
      if (dok.fullscreenElement) await dok.exitFullscreen();
      else await dok.documentElement.requestFullscreen();
    } catch {}
  };

  // Snapshot beziehen
  useEffect(()=>{
    let off = () => {};

    const applySnapshot = (payload) => {
      const snap = (payload && typeof payload === 'object') ? payload : null;
      setSnapshot(snap);
      setIdx(0);
      setIsCountdownOn(true);
      setIsPaused(false);
      endTsRef.current = null;
      const first = Array.isArray(snap?.phases) ? snap.phases[0] : null;
      setRemainingSec(Math.max(0, Math.round((Number(first?.duration) || 0) * 60)));
    };

    (async () => {
      try {
        if (capabilities.executionWindow) {
          const p = await platform.getExecutionSnapshot();
          if (p) applySnapshot(p);
        }
      } catch {}
    })();

    if (capabilities.executionWindow) {
      off = platform.onExecutionInit((payload)=>applySnapshot(payload));
    }
    return () => off && off();
  }, []);

  // Taktgeber, ohne Drift
  useEffect(()=>{
    const loop = () => {
      const snap = snapshotRef.current;
      const i = idxRef.current;
      const isOn = countdownRef.current;
      const isP = pausedRef.current;
      const phasesNow = Array.isArray(snap?.phases) ? snap.phases : [];

      if (!snap || !phasesNow.length) {
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      if (i >= phasesNow.length) {
        // Hausaufgabenansicht: die Uhr steht.
        endTsRef.current = null;
        if (remainingRef.current !== 0) setRemainingSec(0);
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      const ph = phasesNow[i] || null;

      if (!isOn || isP) {
        // Countdown aus oder pausiert: die Zeit bleibt stehen.
        endTsRef.current = null;
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      const dur = Math.max(0, Math.round((Number(ph?.duration) || 0) * 60));
      const rem = Math.max(0, Number(remainingRef.current) || 0);
      if (endTsRef.current == null) endTsRef.current = performance.now() + rem * 1000;

      const msLeft = endTsRef.current - performance.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      if (secLeft !== rem) setRemainingSec(secLeft);

      if (secLeft <= 0) {
        endTsRef.current = null;
        if (i < phasesNow.length - 1) {
          const next = i + 1;
          setIdx(next);
          const nextP = phasesNow[next] || null;
          setRemainingSec(Math.max(0, Math.round((Number(nextP?.duration) || 0) * 60)));
        } else {
          // Nach der letzten Phase folgt die Hausaufgabenansicht.
          setIdx(phasesNow.length);
          setIsPaused(true);
          setRemainingSec(0);
        }
      }

      // Falls sich die Dauer geändert hat: die Restzeit darf sie nicht übersteigen.
      if (dur > 0 && remainingRef.current > dur) setRemainingSec(dur);

      tickRef.current = requestAnimationFrame(loop);
    };

    tickRef.current = requestAnimationFrame(loop);
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, []);

  // Tastenkürzel
  useEffect(()=>{
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === ' ') { e.preventDefault(); setIsPaused(p=>!p); }
      if (String(e.key || '').toLowerCase() === 'c') setIsCountdownOn(v=>!v);
      if (String(e.key || '').toLowerCase() === 'f') toggleFullscreen();
      if (e.key === 'Escape') window.close?.();
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [phases.length]);

  const pct = Math.round(clamp01(progress) * 100);
  const contentLen = (
    String(phase?.content || '').length +
    String(phase?.materialsMedia || '').length +
    String(phase?.remarks || '').length
  );
  // Viel Text: die Ansicht rückt zusammen, damit weniger gescrollt wird.
  const isDense = contentLen > 900;

  return (
    <div ref={wurzelRef} className={`execRoot ${isDense ? 'dense' : ''}`} style={{ background: bg }}>
      <div className="execTopbar">
        <div className="execTitle">
          <div className="execTitleMain">{snapshot?.lessonTitle || 'Durchführung'}</div>
          {snapshot?.meta ? <div className="execTitleSub">{snapshot.meta}</div> : null}
        </div>

        <div className="execActions">
          <button className="btn" onClick={()=>setIsCountdownOn(v=>!v)} title="C">
            Countdown: {isCountdownOn ? 'An' : 'Aus'}
          </button>
          <button className="btn" onClick={()=>setIsPaused(p=>!p)} title="Leertaste">
            {isPaused ? 'Weiter' : 'Pause'}
          </button>
          <button className="btn" onClick={toggleFullscreen} title="F"><Maximize2 {...ICON_SM} /> Vollbild</button>
          <button className="btn danger" onClick={()=>window.close?.()} title="Escape"><X {...ICON_SM} /> Schließen</button>
        </div>
      </div>

      <div className="execProgress">
        <div className="execProgressBar" style={{ width: `${pct}%` }} />
      </div>

      <div className="execMain">
        {!snapshot ? (
          <div className="muted">Warte auf Stunden-Daten…</div>
        ) : (!phases.length ? (
          <div className="muted">Keine Phasen vorhanden.</div>
        ) : isHomeworkView ? (
          <div className="execCard">
            <div className="execPhaseTitle">Hausaufgaben</div>

            <div className="execDetails execDetailsGrow">
              <div className="execBlock">
                <div className="execBlockTitle">Hausaufgaben</div>
                <div className="execRich" style={{ whiteSpace: 'pre-wrap' }}>
                  {String(snapshot?.homework || '').trim() ? String(snapshot.homework) : 'Keine Hausaufgaben hinterlegt.'}
                </div>
              </div>
            </div>

            <div className="execNav">
              <button className="btn" onClick={goPrev} disabled={idx<=0} aria-label="Vorherige Phase"><ArrowLeft {...ICON} /></button>
              <button className="btn" onClick={goNext} disabled={idx>=phases.length} aria-label="Nächste Phase"><ArrowRight {...ICON} /></button>
            </div>
          </div>
        ) : (
          <div className="execCard">
            <div className="execCardHeader">
              <div className="execCornerLeft">
                <div className="execCornerChip">Phase {idx + 1} / {phases.length}</div>
                <div className="execCornerChip">{Number(phase?.duration) || 0} min</div>
                {(phase?.start || phase?.end) ? (
                  <div className="execCornerChip">
                    {phase?.start ? `${phase.start}` : ''}{(phase?.start && phase?.end) ? ' – ' : ''}{phase?.end ? phase.end : ''}
                  </div>
                ) : null}
              </div>
              <div className="execCornerRight" aria-label="Countdown">
                <div className="execCornerTimer">{formatMMSS(remainingSec)}</div>
              </div>
            </div>

            <div className="execCenterHeader">
              <div className="execPhaseTitle">{phase?.title || '—'}</div>
              {phase?.socialForm ? (
                <div className="execSocialProminent" aria-label={`Sozialform: ${phase.socialForm}`}>
                  {phase.socialForm}
                </div>
              ) : null}
            </div>

            {(phase?.content || phase?.materialsMedia || phase?.remarks) ? (
              <div className="execDetails execDetailsGrow">
                {phase?.content ? (
                  <div className="execBlock">
                    <div className="execBlockTitle">Inhalt / Ablauf</div>
                    <div className="execRich" dangerouslySetInnerHTML={{ __html: String(phase.content) }} />
                  </div>
                ) : null}

                {phase?.materialsMedia ? (
                  <div className="execBlock">
                    <div className="execBlockTitle">Materialien &amp; Medien</div>
                    <div className="execRich" dangerouslySetInnerHTML={{ __html: String(phase.materialsMedia) }} />
                  </div>
                ) : null}

                {phase?.remarks ? (
                  <div className="execBlock">
                    <div className="execBlockTitle">Bemerkungen</div>
                    <div className="execRich" dangerouslySetInnerHTML={{ __html: String(phase.remarks) }} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="execNav">
              <button className="btn" onClick={goPrev} disabled={idx<=0} aria-label="Vorherige Phase"><ArrowLeft {...ICON} /></button>
              <button className="btn" onClick={goNext} disabled={idx>=phases.length} aria-label="Nächste Phase"><ArrowRight {...ICON} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



function TodoReminderOverlay({ visible, count, onOpen, onDismiss }){
  if (!visible) return null;
  const c = Number(count || 0);
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div style={{fontWeight:900, fontSize:16}}>Hinweis</div>
        <div className="muted small" style={{marginTop:6}}>
          Heute gibt es {c} To-do{c === 1 ? '' : 's'} mit Datumsangabe. (Der Inhalt wird aus Datenschutzgründen erst nach dem Öffnen angezeigt.)
        </div>
        <div className="row" style={{justifyContent:'flex-end', marginTop:12}}>
          <button className="btn" onClick={onDismiss}>Später</button>
          <button className="btn primary" onClick={onOpen}>To-dos öffnen</button>
        </div>
      </div>
    </div>
  );
}


function PastelPaletteModal({ visible, title, current, colors, onPick, onReset, onClose }){
  if (!visible) return null;
  const list = Array.isArray(colors) && colors.length ? colors : GROUP_PASTELS;
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div style={{fontWeight:900, fontSize:16}}>{title || 'Farbe auswählen'}</div>
        <div className="muted small" style={{marginTop:6}}>
          Pastellfarben – klick zum Auswählen. (Die Farbe gilt für die Lerngruppe über das ganze Schuljahr.)
        </div>

        <div className="paletteGrid">
          {list.map((c)=>(
            <button
              key={c}
              className={`paletteSwatch ${c === current ? 'paletteSwatch--active' : ''}`}
              style={{background: c}}
              onClick={()=>onPick?.(c)}
              title={c}
              aria-label={`Farbe ${c} auswählen`}
            />
          ))}
        </div>

        <div className="row" style={{justifyContent:'flex-end', marginTop:14, gap:8}}>
          <button className="btn" onClick={onReset}>Standard</button>
          <button className="btn primary" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  );
}


function DutyDialog({ visible, dayIndex, pos, slots, dayName, existingTitle, suggestions, onSave, onDelete, onClose, onHideSuggestion }){
  const [title, setTitle] = useState('');

  useEffect(()=>{
    if (!visible) return;
    setTitle((existingTitle || '').trim());
  }, [visible, existingTitle]);

  if (!visible) return null;

  const label = (() => {
    if (!dayName) return '';
    if (pos === 0) return `${dayName} – vor der 1. Stunde`;
    if (pos === slots) return `${dayName} – nach der letzten Stunde`;
    return `${dayName} – zwischen ${pos}. und ${pos + 1}. Stunde`;
  })();

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div style={{fontWeight:900, fontSize:16}}>Aufsicht eintragen</div>
        {label ? <div className="muted small" style={{marginTop:6}}>{label}</div> : null}

        <div style={{height:10}} />

        <label className="small muted">Bezeichnung</label>
        <TypeaheadInput
          value={title}
          suggestions={suggestions}
          onChange={(v)=>setTitle(v)}
          onCommit={(v)=>setTitle((v || '').toString())}
          onHideSuggestion={onHideSuggestion}
          placeholder="z. B. Hofaufsicht"
          autoFocus
          wrapStyle={{width:'100%'}}
        />

        <div className="row" style={{justifyContent:'space-between', marginTop:14}}>
          <button className="btn danger" onClick={onDelete} disabled={!(existingTitle || '').trim()}>Löschen</button>
          <div className="row" style={{gap:8}}>
            <button className="btn" onClick={onClose}>Abbrechen</button>
            <button className="btn primary" onClick={()=>onSave?.(title)}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function uid(){
  // Stable-enough IDs for client-side lists
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function fileNameFromPath(p){
  const s = String(p || '');
  const parts = s.split(/[/\\]/);
  return parts[parts.length - 1] || s;
}



function pad2(n){ return String(n).padStart(2,'0'); }

// Display dates in German format: TT.MM.JJJJ
// (Internally we still store and compare ISO dates YYYY-MM-DD.)
function formatDateDE(iso){
  const s = (iso || '').trim();
  if (!s) return '';
  // ISO date
  let m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  // ISO datetime
  m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return s;
}
function toISODate(d){
  const y = d.getFullYear();
  const m = pad2(d.getMonth()+1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function fromISODate(s){
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function addDays(date, days){
  const d = new Date(date);
  d.setDate(d.getDate()+days);
  return d;
}

function addDaysISO(iso, days){
  return toISODate(addDays(fromISODate(iso), days));
}


function shiftISOByDays(iso, days){
  const s = (iso || '').trim();
  if (!s) return '';
  try{
    return toISODate(addDays(fromISODate(s), days));
  }catch(e){
    return s;
  }
}

function inISOInclusive(iso, startISO, endISO){
  if (!startISO || !endISO) return false;
  return iso >= startISO && iso <= endISO;
}

function getDayInfo(iso, schoolCalendar){
  const cal = schoolCalendar || {};
  const vacations = Array.isArray(cal.vacations) ? cal.vacations : [];
  const freeDays = Array.isArray(cal.freeDays) ? cal.freeDays : [];
  const events = Array.isArray(cal.events) ? cal.events : [];

  const vac = vacations.find(v => v?.startISO && v?.endISO && inISOInclusive(iso, v.startISO, v.endISO)) || null;
  const fd = freeDays.find(f => f?.dateISO === iso) || null;
  const evs = events.filter(e => e?.dateISO === iso);
  const isOff = Boolean(vac || fd);
  return { vac, fd, evs, isOff };
}

function unfoldIcsLines(text){
  const raw = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (const line of raw){
    if (!line) continue;
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length){
      out[out.length-1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsDateValue(value){
  // Returns { allDay, dateISO, timeHHMM }
  const v = (value || '').trim();
  if (/^\d{8}$/.test(v)) {
    const y = v.slice(0,4), m = v.slice(4,6), d = v.slice(6,8);
    return { allDay: true, dateISO: `${y}-${m}-${d}`, timeHHMM: '' };
  }
  const m = v.match(/^(\d{8})T(\d{6})/);
  if (m) {
    const y = m[1].slice(0,4), mo = m[1].slice(4,6), da = m[1].slice(6,8);
    const hh = m[2].slice(0,2), mm = m[2].slice(2,4);
    return { allDay: false, dateISO: `${y}-${mo}-${da}`, timeHHMM: `${hh}:${mm}` };
  }
  // fallback: try ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { allDay: true, dateISO: v, timeHHMM: '' };
  return { allDay: true, dateISO: '', timeHHMM: '' };
}

function parseICS(text){
  const lines = unfoldIcsLines(text);
  const events = [];
  let cur = null;
  for (const line of lines){
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (upper === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx+1);
    const [keyRaw, ...params] = left.split(';');
    const key = keyRaw.toUpperCase();
    if (key === 'SUMMARY') cur.summary = value;
    if (key === 'DESCRIPTION') cur.description = value;
    if (key === 'DTSTART') {
      const dt = parseIcsDateValue(value);
      cur.dtStart = dt;
      cur.allDay = dt.allDay;
    }
    if (key === 'DTEND') {
      const dt = parseIcsDateValue(value);
      cur.dtEnd = dt;
    }
  }

  // Normalize
  return events
    .map(e => {
      const start = e.dtStart || { allDay:true, dateISO:'', timeHHMM:'' };
      const end = e.dtEnd || null;
      const summary = (e.summary || '').trim() || 'Ohne Titel';
      const allDay = Boolean(start.allDay);

      let startISO = start.dateISO;
      let endISO = start.dateISO;
      let startTime = start.timeHHMM || '';
      let endTime = '';

      if (end && end.dateISO) {
        if (allDay) {
          // For all-day events DTEND is usually exclusive -> subtract 1 day
          const exclusive = end.dateISO;
          endISO = addDaysISO(exclusive, -1);
        } else {
          endISO = end.dateISO;
          endTime = end.timeHHMM || '';
        }
      }
      if (!startISO) return null;
      return {
        id: uid(),
        summary,
        description: (e.description || '').trim(),
        allDay,
        startISO,
        endISO,
        startTime,
        endTime
      };
    })
    .filter(Boolean);
}
function startOfWeekMonday(date){
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun, 1 Mon ...
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}
function formatWeekLabel(weekStartISO){
  const start = fromISODate(weekStartISO);
  const end = addDays(start, 4);
  return `${formatDateDE(toISODate(start))} – ${formatDateDE(toISODate(end))} (${weekNumberISO(start)})`;
}
function weekNumberISO(date){
  // ISO week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `KW ${weekNo} / ${d.getUTCFullYear()}`;
}

/* Eine leere Phase – mit ALLEN unterstützten Feldern.

   Der Kern der Erweiterung steht in dieser einen Funktion: es gibt ein
   Phasenmodell, nicht eines je Planungsprofil. Ein Profil entscheidet
   nur, welche dieser Felder man zu sehen bekommt. Deshalb kann man
   zwischen Profilen beliebig wechseln, ohne dass etwas verlorengeht. */
function neuePhase(titel = '', dauer = 5){
  const p = {
    id: uid(),
    title: titel,
    duration: dauer,
    socialForm: '',
    content: '',
    materialsMedia: '',
    remarks: '',
    scaffolds: [],
  };
  for (const key of NEUE_PHASENFELDER) p[key] = '';
  return p;
}

function defaultLesson(){
  return {
    subject: '',
    classGroup: '',
    room: '',
    topic: '',
    objectives: '',
    phases: [
      neuePhase('Einstieg', 5),
      neuePhase('Erarbeitung', 20),
      neuePhase('Sicherung', 15),
      neuePhase('Abschluss', 5)
    ],
    homework: '',
    notes: '',

    // Dateien/Links (nur Organisation, nicht in Exports)
    files: [],
    links: [],
    // Makro-Ebene
    sequenceId: '',
    primaryCompetency: '',
    competencies: [],

    /* Fachdidaktische Planung. Alles optional und leer voreingestellt;
       eine Stunde ohne diese Felder ist unverändert eine gültige Stunde.

       successCriteria steht bewusst NICHT unter der fremdsprachlichen
       Planung: woran man erkennt, dass ein Ziel erreicht ist, ist keine
       Frage des Fachs. Es bleibt deshalb auch bei abgeschaltetem
       Fremdsprachenmodus sichtbar. */
    successCriteria: [],
    communicativeTask: { text: '', situation: '', audience: '', intention: '', outcome: '' },
    speechActs: [],
    languageResources: { vocabulary: '', grammar: '', pronunciation: '', other: '' },
    /* Die Progressionsnotiz beschreibt die Stunde IN ihrer Sequenz. Sie
       liegt trotzdem in der Stunde und nicht in der Sequenz: nur so
       überlebt sie das Verschieben, Kopieren und Übernehmen in eine
       Vorlage. In der normalen Stundenplanung wird sie nicht angezeigt –
       sie erscheint allein in der Progressionsansicht. */
    progressionNote: '',

    /* Planungsprofil und Exportlayout dieser Stunde.

       Das Profil bestimmt, welche Phasenfelder beim Planen sichtbar
       sind; das Layout, welche Spalten der Verlaufsplan ausgibt. Beides
       ist unabhängig voneinander wählbar und beides ändert NIE die
       gespeicherten Angaben – es entscheidet allein über Sichtbarkeit.

       Fehlt die Angabe (jede vor dieser Fassung gespeicherte Stunde),
       gilt "standard": genau die Felder, die es bisher gab, plus die
       neuen als optionale Ergänzung. */
    planningProfile: STANDARD_PROFIL,
    customPlanningFields: [],
    preferredExportLayout: '',

    /* Wie viele Stundenplätze diese Stunde belegt. 1 = Einzelstunde,
       2 = Doppelstunde. Fehlt die Angabe (jede bisher gespeicherte
       Stunde), gilt 1 – es ändert sich dadurch nichts. */
    blockSpan: 1,

    /* Nachbereitung. Sie gehört zur Stunde, die sie betrifft – so trägt
       die vorhandene Wochenpersistenz sie ohne eine zweite Ablage mit.
       Eine Stunde ohne diese Angaben ist eine gültige Stunde. */
    review: leeresReview(),

    updatedAt: new Date().toISOString()
  };
}

/* Die Gesamtdauer ist ab jetzt ein Parameter statt einer Konstanten.

   Grund: eine Doppelstunde hat einen durchgehenden Zeitrahmen von 90
   Minuten. Ohne Angabe bleibt es bei den 45 Minuten der Einzelstunde –
   jeder bestehende Aufruf verhält sich dadurch exakt wie zuvor. */
function normalizePhases(phases, gesamt = TOTAL_MIN){
  const TOTAL = Math.max(MIN_PHASE_MIN, Math.round(Number(gesamt) || TOTAL_MIN));
  // Ensure sum = TOTAL, min durations
  const p = (phases || []).map(ph => {
    const src = (ph && typeof ph === 'object') ? ph : {};
    return {
      // Keep any extra fields we may add in the future
      ...src,
      id: src.id || uid(),
      title: (src.title || ''),
      socialForm: (src.socialForm || ''),
      content: (src.content || ''),
      materialsMedia: (src.materialsMedia || ''),
      remarks: (src.remarks || ''),
      /* Die zusätzlichen Planungsfelder. Rein additiv: fehlt eines,
         entsteht der leere Text – eine Phase aus einer älteren Fassung
         bleibt dadurch unverändert gültig. */
      ...Object.fromEntries(NEUE_PHASENFELDER.map(k => [k, String(src[k] || '')])),
      duration: Math.max(MIN_PHASE_MIN, Math.round(src.duration || 0)),
      /* Hilfen dieser Phase. Keine zweite Phasenstruktur – sie hängen
         an der Phase, die es ohnehin gibt. Fehlt das Feld, entsteht die
         leere Liste; vorhandene Phasen ändern sich dadurch nicht. */
      scaffolds: normalisiereScaffolds(src.scaffolds, uid)
    };
  });
  /* Ohne Phasen gibt es nichts zu verteilen.

     Vorher stand hier ein Zweig für Summe 0, der p[0].duration setzte.
     Bei einer leeren Liste ist p[0] undefined – das warf beim Öffnen
     jeder Stunde ohne Phasen. Da jede Dauer oben auf MIN_PHASE_MIN
     angehoben wird, ist Summe 0 ausserdem nur bei einer leeren Liste
     überhaupt erreichbar; der Zweig entfällt damit ersatzlos. Eine
     Stunde ohne Phasen bleibt eine Stunde ohne Phasen. */
  if (!p.length) return p;

  let sum = p.reduce((a,b)=>a+b.duration,0);
  if (sum === TOTAL) return p;
  // adjust last phase to fit
  const diff = TOTAL - sum;
  p[p.length-1].duration = Math.max(MIN_PHASE_MIN, p[p.length-1].duration + diff);
  // if we pushed below min, redistribute backwards
  while (p[p.length-1].duration < MIN_PHASE_MIN) {
    const need = MIN_PHASE_MIN - p[p.length-1].duration;
    p[p.length-1].duration = MIN_PHASE_MIN;
    for (let i=p.length-2; i>=0 && need>0; i--){
      const take = Math.min(need, Math.max(0, p[i].duration - MIN_PHASE_MIN));
      p[i].duration -= take;
    }
    break;
  }
  // final clamp
  sum = p.reduce((a,b)=>a+b.duration,0);
  if (sum !== TOTAL) {
    const delta = TOTAL - sum;
    p[0].duration = Math.max(MIN_PHASE_MIN, p[0].duration + delta);
  }
  return p;
}


/* Einen Verlaufsplan auf einen anderen Zeitrahmen bringen.

   Gebraucht beim Einsetzen einer Vorlage: eine Einheit, die als
   Doppelstunde geplant war, findet nicht immer zwei freie Plätze. Dann
   wird sie zur Einzelstunde – und ihre Phasen behalten ihr Verhältnis
   zueinander, statt dass die Kürzung auf die letzte Phase fiele.

   Der Rest, den das Runden übriglässt, gleicht normalizePhases aus. */
function skalierePhasen(phases, vonMin, aufMin){
  const alt = Math.max(1, Math.round(Number(vonMin) || 0));
  const neu = Math.max(1, Math.round(Number(aufMin) || 0));
  const liste = Array.isArray(phases) ? phases : [];
  if (!liste.length || alt === neu) return liste;
  const faktor = neu / alt;
  return liste.map(p => ({
    ...p,
    duration: Math.max(MIN_PHASE_MIN, Math.round((Number(p?.duration) || 0) * faktor)),
  }));
}

/* Beim Kopieren bekommt eine Phase eine neue id – sonst trügen zwei
   Stunden dieselbe. Für die Hilfen darin gilt dasselbe: sie sind eigene
   Objekte mit eigener id und müssen mitgezogen werden, sonst zeigten
   Kopie und Original auf denselben Schlüssel. */
/* Eine Kopie ist eine neue Planung, keine Fortsetzung der alten Stunde.

   Nachbereitung beschreibt, was in EINER bestimmten Stunde geschehen
   ist: welche Phase offen blieb, was aufgefallen ist, was noch aussteht.
   Auf eine Kopie übertragen wäre das schlicht falsch – die kopierte
   Stunde wurde nie gehalten. Schlimmer noch: die mitkopierten offenen
   Punkte tauchten ein zweites Mal in der Lerngruppe auf.

   Deshalb geht hier alles Nachbereitende verloren, absichtlich. Die
   Planung selbst – Phasen, Inhalte, Kompetenzen, Fachdidaktik – bleibt
   vollständig erhalten. */
/* --- Archivierte Schuljahre -----------------------------------------

   Beim Start eines neuen Schuljahres wandert das alte in
   `db.schoolYearArchives`: ein Abzug seiner jahresbezogenen Daten,
   nicht mehr und nicht weniger.

   Diese Datei liest daraus – sie schreibt nie hinein. Die
   Archivansicht ist ein Blick zurück, kein zweiter Arbeitsstand:

     - Aus dem Abzug entsteht eine vollständige, aber NUR GELESENE
       Datenbank (`archivDatenbank`). Sie geht durch dieselbe
       Formangleichung wie die echte, damit jede Ansicht sie ohne
       Sonderfall darstellen kann.
     - Was nicht zum Schuljahr gehört – Vorlagenbibliothek,
       Einstellungen, Vorschlagslisten –, wird bewusst NICHT aus dem
       Abzug genommen, sondern aus den aktuellen Daten. Sonst sähe die
       Bibliothek im Archiv leer aus und die Darstellung spränge um.

   Ältere Abzüge tragen weniger Felder (etwa keine Jahresplanung). Das
   ist kein Fehlerfall: was fehlt, entsteht leer. */
const ARCHIV_JAHRESDATEN = ['schoolCalendar', 'weeks', 'sequences', 'todos', 'groupColors', 'supervisionLabels', 'yearBars', 'yearPlanLanes'];

function archivAbzug(archiv){
  const d = (archiv?.data && typeof archiv.data === 'object') ? archiv.data : {};
  return d;
}

/* Die Datenbank, die eine Archivansicht zu sehen bekommt. */
function archivDatenbank(archiv, liveDb){
  const abzug = archivAbzug(archiv);
  /* Aus den aktuellen Daten kommt NUR, was nicht zum Schuljahr gehört.
     Deren Wochen, Sequenzen und Abzüge werden gleich überschrieben –
     sie vorher mitzukopieren wäre bei einem vollen Schuljahr eine
     Kopie von einigen Megabyte für nichts. */
  const roh = (liveDb && typeof liveDb === 'object') ? liveDb : {};
  const live = {};
  const nichtUebernehmen = new Set([...ARCHIV_JAHRESDATEN, 'schoolYearArchives']);
  for (const [k, v] of Object.entries(roh)) {
    if (!nichtUebernehmen.has(k)) live[k] = v;
  }
  const jahresdaten = {};
  for (const feld of ARCHIV_JAHRESDATEN) {
    if (abzug[feld] !== undefined && abzug[feld] !== null) jahresdaten[feld] = abzug[feld];
  }
  return ensureDbShape({
    /* Nicht jahresbezogen und deshalb aus den aktuellen Daten: die
       Vorlagenbibliothek, die Darstellungseinstellungen, der
       Kompetenzkatalog, die Vorschlagslisten und die Archivliste
       selbst – sonst käme man aus dem Archiv nicht mehr heraus. */
    ...deepClone(live),
    /* Und jetzt das Schuljahr aus dem Abzug. Fehlt ein Feld, greift
       die Grundform von ensureDbShape: leer statt kaputt. */
    weeks: {},
    sequences: {},
    todos: [],
    yearBars: [],
    yearPlanLanes: [],
    groupColors: {},
    supervisionLabels: {},
    schoolCalendar: { schoolYear: { startISO: '', endISO: '' }, lessonTimesEnabled: false, lessonTimes: [], vacations: [], freeDays: [], events: [] },
    ...deepClone(jahresdaten),
    /* Die Archivliste gehört nicht in eine Archivansicht: sie wird
       überall aus den echten Daten gelesen. */
    schoolYearArchives: [],
  });
}

/* Welche Bereiche dieses Archiv überhaupt KENNT.

   Gefragt wird nach dem Feld, nicht nach seinem Inhalt: ein leeres
   Feld heisst "da war nichts", ein fehlendes heisst "diese Fassung
   kannte den Bereich noch nicht". Nur das Zweite ist eine Lücke, über
   die man Bescheid wissen will. */
function archivBereiche(archiv){
  const abzug = archivAbzug(archiv);
  const kennt = (feld)=> Object.prototype.hasOwnProperty.call(abzug, feld) && abzug[feld] != null;
  return {
    wochen: kennt('weeks'),
    sequenzen: kennt('sequences'),
    jahresplanung: kennt('yearBars'),
    todos: kennt('todos'),
    kalender: kennt('schoolCalendar'),
  };
}

/* Kennzahlen für die Übersicht. Sie werden aus dem Abzug gerechnet,
   nicht gespeichert – so stimmen sie auch für alte Archive. */
function archivKennzahlen(archiv){
  const abzug = archivAbzug(archiv);
  const weeks = (abzug.weeks && typeof abzug.weeks === 'object') ? abzug.weeks : {};
  const lerngruppen = new Set();
  let stunden = 0;
  let stundenplaetze = 0;
  let mitThema = 0;
  for (const w of Object.values(weeks)){
    for (const l of Object.values(w?.lessons || {})){
      if (!l) continue;
      stunden += 1;
      stundenplaetze += normalisiereBlockSpan(l.blockSpan);
      if (String(l.topic || '').trim()) mitThema += 1;
      const g = groupKey(l.classGroup, l.subject);
      if (g) lerngruppen.add(g);
    }
  }
  const sequenzen = Object.keys((abzug.sequences && typeof abzug.sequences === 'object') ? abzug.sequences : {}).length;
  const balken = Array.isArray(abzug.yearBars) ? abzug.yearBars.length : 0;
  const todos = Array.isArray(abzug.todos) ? abzug.todos.length : 0;
  return { lerngruppen: lerngruppen.size, stunden, stundenplaetze, mitThema, sequenzen, balken, todos, wochen: Object.keys(weeks).length };
}

/* --- Jahresplanung: Zeilen (Lerngruppen) -----------------------------

   Eine Zeile der Jahresplanung ist eine Lerngruppe: Klasse und Fach.
   Der Schlüssel wird an mehreren Stellen gebraucht und steht deshalb
   genau einmal hier. */
function jahresZeileKey(classGroup, subject){
  const g = String(classGroup || '').trim();
  const f = String(subject || '').trim();
  if (!g && !f) return 'allgemein';
  return `${g}||${f}`;
}

function jahresZeileTeile(key){
  if (!key || key === 'allgemein') return { classGroup: '', subject: '' };
  const [g, f] = String(key).split('||');
  return { classGroup: (g || '').trim(), subject: (f || '').trim() };
}

function jahresZeileLabel(key){
  if (key === 'allgemein') return 'Allgemein';
  const { classGroup, subject } = jahresZeileTeile(key);
  return [classGroup, subject].filter(Boolean).join(' · ') || 'Allgemein';
}

/* --- Sequenz-Vorlagen -------------------------------------------------

   Eine Vorlage besteht aus Einheiten. Eine Einheit ist das, was in der
   Sequenz eine Stunde war – und kann seit den Doppelstunden mehr als
   einen Stundenplatz umfassen. Deshalb gilt durchgehend:

     Einheiten  = Anzahl der Sequenzeinheiten
     Stunden    = benötigte Stundenplätze (Summe der Spannen)

   Alle beschreibenden Angaben sind optional. Eine Vorlage aus einer
   früheren Fassung trägt keine davon und bleibt vollständig gültig –
   sie zeigt dann eben weniger. */
const VORLAGEN_HERKUNFT = {
  sequence: 'Aus Sequenz gespeichert',
  own: 'Eigene Vorlage',
  builtin: 'Mitgelieferte Vorlage',
  imported: 'Importiert',
};

function herkunftName(id){
  return VORLAGEN_HERKUNFT[String(id || '').trim()] || VORLAGEN_HERKUNFT.own;
}

function normalisiereVorlage(raw, id = ''){
  const t = (raw && typeof raw === 'object') ? raw : {};
  const text = (v)=> String(v ?? '').trim();
  const lessons = (Array.isArray(t.lessons) ? t.lessons : []).map(l => {
    const o = (l && typeof l === 'object') ? l : {};
    return { ...o, blockSpan: normalisiereBlockSpan(o.blockSpan) };
  });
  return {
    ...t,
    id: t.id || id || uid(),
    name: text(t.name) || String(id || 'Vorlage'),
    subject: text(t.subject),
    color: text(t.color),
    createdAt: t.createdAt || new Date().toISOString(),
    lessons,
    /* Beschreibende Angaben. Sie helfen bei der Auswahl und ändern an
       den Stunden der Vorlage nichts. */
    description: text(t.description),
    gradeLevel: text(t.gradeLevel),
    learningYear: text(t.learningYear),
    competencies: (Array.isArray(t.competencies) ? t.competencies : []).map(text).filter(Boolean),
    primaryCompetency: text(t.primaryCompetency),
    finalTask: normalisiereAufgabe(t.finalTask),
    targetProduct: text(t.targetProduct),
    languageResources: normalisiereMittel(t.languageResources),
    courseRef: text(t.courseRef),
    prerequisites: text(t.prerequisites),
    origin: VORLAGEN_HERKUNFT[text(t.origin)] ? text(t.origin) : 'own',
  };
}

/* Umfang einer Vorlage: Einheiten, Stundenplätze, Doppelstunden. */
function vorlagenUmfang(tpl){
  const lessons = Array.isArray(tpl?.lessons) ? tpl.lessons : [];
  let stunden = 0;
  let doppel = 0;
  for (const l of lessons){
    const span = normalisiereBlockSpan(l?.blockSpan);
    stunden += span;
    if (span > 1) doppel += 1;
  }
  return { einheiten: lessons.length, stunden, doppelstunden: doppel, minuten: stunden * TOTAL_MIN };
}

function umfangText(tpl){
  const u = vorlagenUmfang(tpl);
  const teile = [
    `${u.einheiten} ${u.einheiten === 1 ? 'Einheit' : 'Einheiten'}`,
    `${u.stunden} ${u.stunden === 1 ? 'Unterrichtsstunde' : 'Unterrichtsstunden'}`,
  ];
  if (u.doppelstunden) teile.push(`${u.doppelstunden} ${u.doppelstunden === 1 ? 'Doppelstunde' : 'Doppelstunden'}`);
  return teile.join(' · ');
}

/* Klassenstufe und Lernjahr als eine Zeile – beides ist optional. */
function stufenText(tpl){
  const teile = [];
  const k = String(tpl?.gradeLevel || '').trim();
  const j = String(tpl?.learningYear || '').trim();
  if (k) teile.push(/^\d+$/.test(k) ? `Klasse ${k}` : k);
  if (j) teile.push(/^\d+$/.test(j) ? `${j}. Lernjahr` : j);
  return teile.join(' · ');
}

/* Die Zielhandlung als ein Satz – aus der Zielaufgabe der Sequenz. */
function zielhandlungText(tpl){
  const a = normalisiereAufgabe(tpl?.finalTask);
  return String(a.text || '').trim();
}

function nurPlanung(lesson){
  const l = normalizeLesson(lesson);
  return { ...l, review: leeresReview() };
}

/* --- Verbinden und Trennen -------------------------------------------

   Beides sind reine Umformungen auf Stundenobjekten. Sie kennen weder
   Woche noch Oberfläche – dadurch sind sie prüfbar und lassen sich an
   jeder Stelle wiederverwenden. */

/* Zwei Stunden zu einer Doppelstunde. Der Entwurf wird gemeinsam:
   die Phasen laufen durch, Texte werden angefügt statt verworfen.
   Nichts geht dabei verloren – das ist die Bedingung dafür, dass sich
   das Verbinden ohne Nachfrage anbieten lässt. */
function verbindeStunden(ersteRaw, zweiteRaw){
  const a = normalizeLesson(ersteRaw);
  const b = normalizeLesson(zweiteRaw);
  const span = normalisiereBlockSpan(blockSpanOf(a) + blockSpanOf(b));

  const text = (x, y, trenner = '\n')=>{
    const s1 = String(x || '').trim();
    const s2 = String(y || '').trim();
    if (!s1) return s2;
    if (!s2 || s1 === s2) return s1;
    return `${s1}${trenner}${s2}`;
  };
  const liste = (x, y)=>{
    const arr = [...(Array.isArray(x) ? x : []), ...(Array.isArray(y) ? y : [])];
    return arr;
  };
  const eindeutig = (arr)=>{
    const out = [];
    for (const v of arr){
      const t = String(v || '').trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };

  const competencies = eindeutig(liste(a.competencies, b.competencies));
  const mittelA = normalisiereMittel(a.languageResources);
  const mittelB = normalisiereMittel(b.languageResources);

  const merged = {
    ...a,
    blockSpan: span,
    room: (a.room || '').trim() || (b.room || '').trim(),
    topic: text(a.topic, b.topic, ' · '),
    objectives: text(a.objectives, b.objectives),
    homework: text(a.homework, b.homework),
    notes: text(a.notes, b.notes),
    links: liste(a.links, b.links),
    files: liste(a.files, b.files),
    sequenceId: (a.sequenceId || '').trim() || (b.sequenceId || '').trim(),
    competencies,
    primaryCompetency: (a.primaryCompetency || '').trim() || (b.primaryCompetency || '').trim(),
    successCriteria: normalisiereErfolgskriterien(liste(a.successCriteria, b.successCriteria)),
    speechActs: normalisiereSprechabsichten(liste(a.speechActs, b.speechActs)),
    languageResources: normalisiereMittel({
      vocabulary: text(mittelA.vocabulary, mittelB.vocabulary),
      grammar: text(mittelA.grammar, mittelB.grammar),
      pronunciation: text(mittelA.pronunciation, mittelB.pronunciation),
      other: text(mittelA.other, mittelB.other),
    }),
    progressionNote: text(a.progressionNote, b.progressionNote, ' · '),
    /* Die Phasen behalten ihre Kennungen. Nur so bleiben die
       phasenweisen Nachbereitungen beider Stunden gültig. */
    phases: normalizePhases([...(a.phases || []), ...(b.phases || [])], TOTAL_MIN * span),
    review: {
      ...normalisiereReview(a.review, uid),
      generalNotes: text(normalisiereReview(a.review).generalNotes, normalisiereReview(b.review).generalNotes),
      phaseReviews: {
        ...normalisiereReview(a.review).phaseReviews,
        ...normalisiereReview(b.review).phaseReviews,
      },
      carryOverItems: [
        ...normalisiereReview(a.review).carryOverItems,
        ...normalisiereReview(b.review).carryOverItems,
      ],
    },
    updatedAt: new Date().toISOString(),
  };
  return normalizeLesson(merged);
}

/* Eine Doppelstunde wieder in Einzelstunden.

   Der gemeinsame Verlaufsplan wird an der Stundengrenze geteilt: was
   davor liegt, bleibt in der ersten Stunde, was danach beginnt, geht in
   die zweite. Eine Phase, die über die Grenze läuft, wird an genau
   dieser Stelle geteilt – ihre Angaben stehen dann in beiden Teilen.

   Alles Organisatorische (Klasse, Fach, Raum, Sequenz) trägt jede der
   entstehenden Stunden; die Nachbereitung bleibt bei der ersten, weil
   sie eine gehaltene Stunde beschreibt und sich nicht aufteilen lässt. */
function trenneStunde(raw){
  const l = normalizeLesson(raw);
  const span = blockSpanOf(l);
  if (span <= 1) return [l];

  /* Die erste Stunde behält die Kennungen ihrer Phasen. Nur so bleibt
     die phasenweise Nachbereitung gültig, die auf sie zeigt. Die
     weiteren Stunden bekommen eigene Kennungen – sie starten ohnehin
     ohne Nachbereitung. */
  const teile = verteilePhasenAufPlaetze(l.phases, span)
    .map((phasen, i)=> (i === 0 ? phasen : phasen.map(ph => neuePhasenIds(ph))));

  return teile.map((phasen, i)=>{
    const stunde = normalizeLesson({
      ...deepClone(l),
      blockSpan: 1,
      phases: phasen.length ? phasen : [neuePhase('Neue Phase', TOTAL_MIN)],
      updatedAt: new Date().toISOString(),
    });
    if (i > 0) {
      /* Die zweite Stunde ist eine eigene, noch nicht gehaltene Stunde:
         Nachbereitung und Hausaufgabe gehören zur ersten. */
      stunde.review = leeresReview();
      stunde.homework = '';
    }
    return stunde;
  });
}

function neuePhasenIds(phase){
  const p = (phase && typeof phase === 'object') ? phase : {};
  return {
    ...p,
    id: uid(),
    scaffolds: (Array.isArray(p.scaffolds) ? p.scaffolds : [])
      .map(sc => ({ ...sc, id: uid() })),
  };
}

function normalizeLesson(lesson){
  const base = defaultLesson();
  const l = (lesson && typeof lesson === 'object') ? lesson : {};
  const blockSpan = normalisiereBlockSpan(l.blockSpan);
  const phases = normalizePhases(l.phases || base.phases, TOTAL_MIN * blockSpan);
  return {
    ...base,
    ...l,
    blockSpan,
    sequenceId: l.sequenceId || '',
    primaryCompetency: l.primaryCompetency || '',
    competencies: Array.isArray(l.competencies) ? l.competencies : [],
    files: Array.isArray(l.files) ? l.files : [],
    links: Array.isArray(l.links) ? l.links : [],
    phases,
    // Fachdidaktik: fehlt ein Feld, entsteht die leere Form.
    successCriteria: normalisiereErfolgskriterien(l.successCriteria),
    communicativeTask: normalisiereAufgabe(l.communicativeTask),
    speechActs: normalisiereSprechabsichten(l.speechActs),
    languageResources: normalisiereMittel(l.languageResources),
    progressionNote: String(l.progressionNote || '').trim(),
    /* Unbekanntes fällt auf "standard" zurück – nie auf einen Fehler.
       Das eigene Layout bleibt leer, solange keines gewählt wurde. */
    planningProfile: normalisiereProfilId(l.planningProfile),
    customPlanningFields: normalisiereFeldListe(l.customPlanningFields),
    preferredExportLayout: l.preferredExportLayout ? normalisiereLayoutId(l.preferredExportLayout) : '',
    review: normalisiereReview(l.review, uid),
    updatedAt: l.updatedAt || base.updatedAt
  };
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// Some environments can fail on `structuredClone` for certain objects.
// Use a safe deep-clone helper so persistence/editing never breaks silently.
function deepClone(obj){
  try {
    if (typeof globalThis.structuredClone === 'function') {
      // Rief bisher globalThis.deepClone auf – das gibt es nicht, der
      // Aufruf warf, und der Rückfall unten hat den Fehler stillschweigend
      // geschluckt. Der schnelle Weg lief dadurch nie.
      return globalThis.structuredClone(obj);
    }
  } catch {}
  // Rückfall für Umgebungen ohne structuredClone. Für unsere reinen
  // Datenobjekte verhält er sich gleich, ist aber rund 1,4x langsamer.
  return JSON.parse(JSON.stringify(obj ?? null));
}


// Einzige Quelle für die Schema-Kennzeichnung im Renderer. Muss mit
// SCHEMA_VERSION in electron/main.cjs übereinstimmen.
const SCHEMA_VERSION = 11;

/* ============================================================
   Interaktionsschicht: Meldungen, Bestätigung, Eingabe

   Ersetzt die nativen Browserdialoge. Grundsatz: Bei umkehrbaren
   Aktionen wird nicht gefragt, sondern ausgeführt und ein Toast mit
   "Rückgängig" gezeigt. Ein echter Bestätigungsdialog bleibt nur dort,
   wo etwas unwiederbringlich überschrieben wird.
   ============================================================ */

// Einheitliche Darstellung aller Symbole: eine Grösse, eine Strichstärke.
const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };
const ICON_SM = { size: 14, strokeWidth: 1.75, 'aria-hidden': true, focusable: 'false' };

/* Ein Kontext für die gesamte Interaktionsschicht. Die Meldungen und
   Dialoge werden aus tief verschachtelten Komponenten heraus gebraucht;
   sie durch zehn Ebenen als Eigenschaften zu reichen wäre die schlechtere
   Lösung. React-Bordmittel, kein Zustandsframework. */
const UiContext = React.createContext(null);
const NOOP_UI = {
  toast: ()=>{},
  dismissToast: ()=>{},
  // Ausserhalb des Providers (Durchführungsfenster) nicht blockieren:
  // die Rückgabe entspricht "abgebrochen".
  askConfirm: async ()=>false,
  askInput: async ()=>null,
};
function useUi(){ return useContext(UiContext) || NOOP_UI; }

function ToastHost({ toasts, onDismiss }){
  if (!toasts.length) return null;
  return (
    <div className="toastHost">
      {/* Screenreader lesen Änderungen hier vor, ohne den Fokus zu stehlen. */}
      <ol className="toastList" aria-live="polite" aria-relevant="additions" aria-label="Meldungen">
        {toasts.map((t)=>(
          <li key={t.id} className={`toast toast--${t.tone || 'info'}`}>
            <span className="toastText">{t.text}</span>
            {t.action ? (
              <button
                type="button"
                className="toastAction"
                onClick={()=>{ try { t.action.onAct?.(); } finally { onDismiss(t.id); } }}
              >{t.action.label}</button>
            ) : null}
            <button
              type="button"
              className="toastClose"
              aria-label="Meldung schließen"
              onClick={()=>onDismiss(t.id)}
            ><X {...ICON_SM} /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* Bestätigung nur für Unwiederbringliches. Der Knopf benennt die
   Handlung, nicht "OK" – man soll lesen können, was gleich passiert. */
function ConfirmDialog({ open, title, body, confirmLabel, tone = 'primary', onConfirm, onCancel }){
  const confirmRef = useRef(null);
  useEffect(()=>{ if (open) confirmRef.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onCancel?.(); }}>
      <div className="modalCard" role="alertdialog" aria-modal="true" aria-label={title}
           onKeyDown={(e)=>{ if (e.key === 'Escape') onCancel?.(); }}>
        <h3 className="dialogTitle">{title}</h3>
        {body ? <p className="dialogBody">{body}</p> : null}
        <div className="dialogActions">
          <button type="button" className="btn" onClick={onCancel}>Abbrechen</button>
          <button ref={confirmRef} type="button" className={`btn ${tone}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Eingabe an Ort und Stelle ist nicht überall möglich (etwa beim Anlegen
   aus einem Menü heraus) – dann dieses Feld statt window.prompt. */
/* `erlaubeLeer`: für Angaben, bei denen "nichts" eine gültige Antwort
   ist – etwa das Fach einer Jahresplanungszeile. Ohne die Angabe
   bleibt es beim bisherigen Verhalten: leer heisst abbrechen. */
function PromptDialog({ open, title, label, placeholder, initialValue = '', confirmLabel = 'Übernehmen', erlaubeLeer = false, onConfirm, onCancel }){
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);
  useEffect(()=>{ if (open){ setValue(initialValue); setTimeout(()=>{ inputRef.current?.focus(); inputRef.current?.select(); }, 0);} }, [open, initialValue]);
  if (!open) return null;
  const submit = (e)=>{ e?.preventDefault?.(); const v = value.trim(); if (!v && !erlaubeLeer) return; onConfirm?.(v); };
  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onCancel?.(); }}>
      <form className="modalCard" onSubmit={submit} role="dialog" aria-modal="true" aria-label={title}
            onKeyDown={(e)=>{ if (e.key === 'Escape') onCancel?.(); }}>
        <h3 className="dialogTitle">{title}</h3>
        <label className="small muted" htmlFor="promptDialogInput">{label}</label>
        <input id="promptDialogInput" ref={inputRef} className="input" value={value}
               placeholder={placeholder || ''} onChange={(e)=>setValue(e.target.value)} />
        <div className="dialogActions">
          <button type="button" className="btn" onClick={onCancel}>Abbrechen</button>
          <button type="submit" className="btn primary" disabled={!value.trim() && !erlaubeLeer}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

/* Leerzustand: eine Zeile, was hierhin gehört, und ein Knopf, der genau
   das beginnt.

   Die Illustration ist hier bewusst NICHT mehr gesetzt: Phase 6 gibt dem
   Wochenabschluss den einen Auftritt der Bildmarke. Zwei dekorative
   Stellen wären eine zu viel – die Möglichkeit bleibt als Eigenschaft
   erhalten, falls sie einmal woanders gebraucht wird. */
function EmptyState({ text, actionLabel, onAction, illustration = false }){
  return (
    <div className={`emptyState${illustration ? ' emptyState--art' : ''}`}>
      {illustration ? <img className="emptyStateArt" src={logo} alt="" aria-hidden="true" /> : null}
      <p className="emptyStateText">{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn primary" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}

/* Suchvergleich ohne Akzente: In einer App für den Französischunterricht
   heissen Sequenzen "Le passé composé". Wer "passe" tippt, muss sie finden –
   sonst ist die Palette für genau die Inhalte unbrauchbar, um die es geht. */
/* Eine Schaltfläche, die auch in einem gesperrten Bereich wirkt.

   Der Riegel der Archivansicht ist ein deaktiviertes <fieldset>. Es
   erfasst Formularelemente – ein <a> ist keines. Genau richtig für
   Aktionen, die nichts ändern: eine Datei öffnen, einen Ordner
   anzeigen, zu einer anderen Ansicht springen. */
function OeffnenKnopf({ onClick, disabled = false, className = 'btn', title, children }){
  const ausloesen = (e)=>{
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onClick?.();
  };
  return (
    <a
      role="button"
      className={`${className}${disabled ? ' is-disabled' : ''}`}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={ausloesen}
      onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') ausloesen(e); }}
    >{children}</a>
  );
}

/* Ein dezentes Kontextmenü (⋯).

   Bewusst kein neues Baukastensystem: es benutzt dieselben Flächen,
   Abstände und Farben wie die übrigen Bedienelemente und schliesst sich
   bei Klick nach aussen und mit Escape. Einträge sind einfache Objekte
   – `{ label, onSelect }`, `{ trenner: true }` oder ein Eintrag mit
   `unter: [...]` für eine Untergruppe (z. B. "Exportieren"). */
function KebabMenu({ eintraege, titel = 'Weitere Aktionen', ausrichtung = 'rechts', knopfKlasse = 'iconBtn' }){
  const [offen, setOffen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(()=>{
    if (!offen) return;
    const beiKlick = (e)=>{
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOffen(false);
    };
    const beiTaste = (e)=>{ if (e.key === 'Escape') setOffen(false); };
    window.addEventListener('mousedown', beiKlick);
    window.addEventListener('keydown', beiTaste);
    return ()=>{
      window.removeEventListener('mousedown', beiKlick);
      window.removeEventListener('keydown', beiTaste);
    };
  }, [offen]);

  const liste = (Array.isArray(eintraege) ? eintraege : []).filter(Boolean);
  if (!liste.length) return null;

  const zeile = (e, i)=>{
    if (e.trenner) return <div key={`t-${i}`} className="kebabTrenner" role="separator" />;
    if (Array.isArray(e.unter)) {
      const unter = e.unter.filter(Boolean);
      if (!unter.length) return null;
      return (
        <div key={`g-${i}`} className="kebabGruppe">
          <div className="kebabGruppeTitel">{e.label}</div>
          {unter.map((u, j)=>zeile(u, `${i}-${j}`))}
        </div>
      );
    }
    return (
      <button
        key={`e-${i}`}
        type="button"
        className={`kebabEintrag${e.tone === 'danger' ? ' kebabEintrag--danger' : ''}`}
        disabled={Boolean(e.disabled)}
        title={e.title || ''}
        onClick={(ev)=>{
          ev.stopPropagation();
          setOffen(false);
          try { e.onSelect?.(); } catch {}
        }}
      >
        {e.icon ? <span className="kebabIcon">{e.icon}</span> : null}
        <span>{e.label}</span>
      </button>
    );
  };

  return (
    <div className={`kebabWrap${offen ? ' is-open' : ''}`} ref={wrapRef} onClick={(e)=>e.stopPropagation()}>
      <button
        type="button"
        className={knopfKlasse}
        aria-haspopup="menu"
        aria-expanded={offen}
        title={titel}
        aria-label={titel}
        onClick={(e)=>{ e.stopPropagation(); setOffen(v => !v); }}
      ><MoreHorizontal {...ICON_SM} /></button>
      {offen ? (
        <div className={`kebabMenu kebabMenu--${ausrichtung}`} role="menu">
          {liste.map(zeile)}
        </div>
      ) : null}
    </div>
  );
}

/* Wie die Trefferarten in der Palette heissen. Einzahl, weil dort
   einzelne Treffer stehen – die Suchansicht gruppiert in der Mehrzahl. */
const SUCH_GRUPPEN = {
  [SUCH_TYPEN.STUNDE]: 'Stunde',
  [SUCH_TYPEN.SEQUENZ]: 'Sequenz',
  [SUCH_TYPEN.VORLAGE]: 'Vorlage',
  [SUCH_TYPEN.JAHRESPLANUNG]: 'Jahresplanung',
  [SUCH_TYPEN.TODO]: 'To-do',
};

/* ============================================================
   Befehlspalette (Strg+K)

   Vollständig über die Tastatur bedienbar: tippen filtert, Pfeiltasten
   wählen, Eingabe führt aus, Escape schliesst. Die Liste bekommt sie
   von aussen, damit sie nichts über den Aufbau der App wissen muss.
   ============================================================ */
function CommandPalette({ open, commands, suchIndex = null, onOeffneTreffer = null, onAlleTreffer = null, onClose }){
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(()=>{
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = setTimeout(()=>inputRef.current?.focus(), 0);
    return ()=> clearTimeout(t);
  }, [open]);

  const filtered = useMemo(()=>{
    const q = foldForSearch(query);
    if (!q) return commands.slice(0, 60);
    const words = q.split(/\s+/);
    return commands
      .map((c)=>{
        const hay = foldForSearch(`${c.label} ${c.group || ''} ${c.hint || ''}`);
        if (!words.every(w => hay.includes(w))) return null;
        // Treffer am Wortanfang zählen mehr als irgendwo mittendrin.
        return { c, score: hay.startsWith(q) ? 0 : (foldForSearch(c.label).includes(q) ? 1 : 2) };
      })
      .filter(Boolean)
      .sort((a,b)=> a.score - b.score)
      .map(x => x.c)
      .slice(0, 60);
  }, [commands, query]);

  /* Die Befehlspalette ist zugleich der schnelle Weg in die Inhalte.

     Sie bekommt deshalb keine zweite Suchoberfläche daneben, sondern
     zeigt unter den Befehlen die besten Treffer aus der globalen Suche
     – und einen Eintrag, der die vollständige Suchansicht öffnet. */
  const inhalte = useMemo(()=>{
    const q = String(query || '').trim();
    if (!open || !suchIndex || q.length < 2 || typeof onOeffneTreffer !== 'function') return [];
    return sucheImIndex(suchIndex, q).slice(0, 8).map(({ dokument, fundstelle })=>({
      id: `treffer-${dokument.id}`,
      label: dokument.titel,
      group: `${SUCH_GRUPPEN[dokument.typ] || 'Treffer'}${dokument.quelle?.archiviert ? ' · Archiv' : ''}`,
      hint: fundstelle?.text || '',
      run: ()=> onOeffneTreffer(dokument),
    }));
  }, [open, suchIndex, query, onOeffneTreffer]);

  const eintraege = useMemo(()=>{
    const q = String(query || '').trim();
    const alles = [...filtered, ...inhalte];
    if (q.length >= 2 && typeof onAlleTreffer === 'function') {
      alles.push({
        id: 'suche-alle',
        label: `Alle Treffer für „${q}“ anzeigen`,
        group: 'Suche',
        run: ()=> onAlleTreffer(q),
      });
    }
    return alles;
  }, [filtered, inhalte, query, onAlleTreffer]);

  useEffect(()=>{ setActive(0); }, [query]);
  useEffect(()=>{
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open, eintraege.length]);

  if (!open) return null;

  const run = (cmd)=>{ onClose(); setTimeout(()=>cmd?.run?.(), 0); };

  const onKeyDown = (e)=>{
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, eintraege.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, eintraege.length - 1)); return; }
    if (e.key === 'Enter') { e.preventDefault(); run(eintraege[active]); return; }
  };

  return (
    <div className="modalOverlay paletteOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div className="paletteCard" role="dialog" aria-modal="true" aria-label="Befehlspalette">
        <div className="paletteSearch">
          <Search {...ICON} />
          <input
            ref={inputRef}
            className="paletteInput"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Springen, ausführen oder suchen…"
            aria-label="Befehl oder Inhalt suchen"
            aria-controls="paletteList"
            aria-activedescendant={eintraege[active] ? `paletteItem-${active}` : undefined}
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
          />
          <kbd className="paletteHint">Esc</kbd>
        </div>
        <ul className="paletteList" id="paletteList" role="listbox" ref={listRef}>
          {eintraege.length === 0 ? (
            <li className="paletteEmpty">Kein Treffer für „{query}“.</li>
          ) : eintraege.map((c, i)=>(
            <li
              key={c.id}
              id={`paletteItem-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active ? 'true' : 'false'}
              className={`paletteItem${i === active ? ' is-active' : ''}`}
              onMouseEnter={()=>setActive(i)}
              onMouseDown={(e)=>{ e.preventDefault(); run(c); }}
            >
              <span className="paletteLabel">
                {c.label}
                {c.hint ? <span className="paletteHinweis">{c.hint}</span> : null}
              </span>
              {c.group ? <span className="paletteGroup">{c.group}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


/* ============================================================
   Einstellungen

   Bis hierher hatte die App keinen eigenen Bereich dafür. Speicherstatus,
   Datenschutzhinweis und die Trennung zwischen Desktop und Browser
   brauchen aber einen sichtbaren Platz – Lehrkräfte müssen gegenüber
   Schulleitung und Datenschutzbeauftragten belegen können, wo die Daten
   liegen. Ein Satz in der Dokumentation reicht dafür nicht.
   ============================================================ */
/* ============================================================
   Kompetenzen verwalten

   Bewusst innerhalb der Einstellungen und nicht als eigene Ansicht: Es
   ist eine Sache, die man selten anfasst. Der häufige Weg – eine eigene
   Kompetenz anlegen – läuft direkt in der Stunde und braucht diese
   Ansicht gar nicht.

   Systemkompetenzen lassen sich ausblenden, aber nicht löschen. Eigene
   lassen sich umbenennen, einem Bereich zuordnen und löschen. Gelöscht
   heisst: aus der Auswahl genommen – die Stunden, in denen sie vorkam,
   behalten sie.
   ============================================================ */
function CompetencyManager({
  modell, benutzte,
  onSetHidden, onSetArea, onRename, onDelete,
  onAddArea, onRenameArea, onDeleteArea,
}){
  const [suche, setSuche] = useState('');
  const [neuerBereich, setNeuerBereich] = useState('');
  const [bearbeitet, setBearbeitet] = useState(null);   // { art, id, wert }

  const bereiche = useMemo(
    ()=> katalogNachBereichen({ modell, benutzte, mitAusgeblendeten: true, mitLeeren: true }),
    [modell, benutzte]
  );
  const gefiltert = useMemo(()=> filterKatalog(bereiche, suche), [bereiche, suche]);
  const zuordenbar = useMemo(()=> alleBereiche(modell), [modell]);

  const bearbeiteJetzt = (art, id, wert)=> setBearbeitet({ art, id, wert });
  const brichAb = ()=> setBearbeitet(null);
  const uebernimm = ()=>{
    if (!bearbeitet) return;
    const wert = String(bearbeitet.wert || '').trim();
    if (wert) {
      if (bearbeitet.art === 'kompetenz') onRename?.(bearbeitet.id, wert);
      else onRenameArea?.(bearbeitet.id, wert);
    }
    setBearbeitet(null);
  };
  const beiTaste = (e)=>{
    if (e.key === 'Enter') { e.preventDefault(); uebernimm(); }
    if (e.key === 'Escape') { e.preventDefault(); brichAb(); }
  };

  return (
    <div className="kompetenzVerwaltung">
      <div className="row wrap" style={{gap:8, alignItems:'flex-end'}}>
        <div style={{flex:1, minWidth:200}}>
          <label className="small muted">Kompetenz suchen</label>
          <input className="input" value={suche} onChange={(e)=>setSuche(e.target.value)}
                 placeholder="System- und eigene Kompetenzen…" />
        </div>
        <div style={{flex:1, minWidth:200}}>
          <label className="small muted">Kompetenzbereich hinzufügen</label>
          <div className="row" style={{gap:8}}>
            <input className="input" value={neuerBereich}
                   onChange={(e)=>setNeuerBereich(e.target.value)}
                   onKeyDown={(e)=>{
                     if (e.key !== 'Enter') return;
                     e.preventDefault();
                     if (neuerBereich.trim()) { onAddArea?.(neuerBereich); setNeuerBereich(''); }
                   }}
                   placeholder="z. B. Text- und Medienkompetenz" />
            <button className="btn" disabled={!neuerBereich.trim()}
                    onClick={()=>{ onAddArea?.(neuerBereich); setNeuerBereich(''); }}>Hinzufügen</button>
          </div>
        </div>
      </div>

      <p className="muted small" style={{margin:'10px 0 0'}}>
        Ausgeblendete Kompetenzen verschwinden aus der Auswahl, bleiben aber in
        vorhandenen Stunden und in der Jahresübersicht stehen. Löschen nimmt eine
        eigene Kompetenz aus der Auswahl – die Stunden, in denen sie vorkam,
        behalten sie.
      </p>

      {gefiltert.length === 0 ? (
        <p className="muted small" style={{marginBottom:0}}>Keine Kompetenz gefunden.</p>
      ) : gefiltert.map((b)=>{
        const bearbeiteBereich = bearbeitet?.art === 'bereich' && bearbeitet.id === b.id;
        return (
          <div key={b.id} className="kompetenzBereich">
            <div className="kompetenzBereichKopf">
              {bearbeiteBereich ? (
                <>
                  <input className="input" autoFocus value={bearbeitet.wert}
                         onChange={(e)=>setBearbeitet({ ...bearbeitet, wert: e.target.value })}
                         onKeyDown={beiTaste} />
                  <button className="btn" onClick={uebernimm}>Speichern</button>
                  <button className="btn" onClick={brichAb}>Abbrechen</button>
                </>
              ) : (
                <>
                  <h4 className="kompetenzBereichName">{b.name}</h4>
                  {b.source === 'custom' ? (
                    <>
                      <button className="btn btnMini" title="Bereich umbenennen" aria-label="Bereich umbenennen"
                              onClick={()=>bearbeiteJetzt('bereich', b.id, b.name)}><Pencil {...ICON_SM} /></button>
                      <button className="btn btnMini" title="Bereich löschen" aria-label="Bereich löschen"
                              onClick={()=>onDeleteArea?.(b.id)}><Trash2 {...ICON_SM} /></button>
                    </>
                  ) : null}
                </>
              )}
            </div>

            {b.kompetenzen.map((k)=>{
              const bearbeiteKompetenz = bearbeitet?.art === 'kompetenz' && bearbeitet.id === k.label;
              return (
                <div key={k.label} className="kompetenzZeile">
                  {bearbeiteKompetenz ? (
                    <>
                      <input className="input" autoFocus value={bearbeitet.wert}
                             onChange={(e)=>setBearbeitet({ ...bearbeitet, wert: e.target.value })}
                             onKeyDown={beiTaste} />
                      <button className="btn" onClick={uebernimm}>Speichern</button>
                      <button className="btn" onClick={brichAb}>Abbrechen</button>
                    </>
                  ) : (
                    <>
                      <label className="kompetenzSicht" title={k.hidden ? 'Wieder einblenden' : 'Ausblenden'}>
                        <input type="checkbox" checked={!k.hidden}
                               onChange={(e)=>onSetHidden?.(k.label, !e.target.checked)} />
                        <span className={k.hidden ? 'kompetenzNameAus' : 'kompetenzName'}>{k.label}</span>
                      </label>

                      {k.source === 'custom' ? (
                        <>
                          <select className="input kompetenzBereichWahl"
                                  value={bereichVon(k.label, modell)}
                                  aria-label={`Bereich von ${k.label}`}
                                  onChange={(e)=>onSetArea?.(k.label, e.target.value)}>
                            {zuordenbar.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                          </select>
                          <button className="btn btnMini" title="Umbenennen" aria-label={`${k.label} umbenennen`}
                                  onClick={()=>bearbeiteJetzt('kompetenz', k.label, k.label)}><Pencil {...ICON_SM} /></button>
                          <button className="btn btnMini" title="Aus der Auswahl löschen"
                                  aria-label={`${k.label} löschen`}
                                  onClick={()=>onDelete?.(k.label)}><Trash2 {...ICON_SM} /></button>
                        </>
                      ) : (
                        <span className="muted small kompetenzHerkunft">System</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* Eigene Sprechabsichten verwalten.

   Bewusst schmaler als die Kompetenzverwaltung: der Startbestand ist
   fest und braucht keine Pflege, verwaltet wird nur, was die Lehrkraft
   selbst angelegt hat. Löschen nimmt den Eintrag aus der Auswahl – die
   Stunden, in denen er vorkam, behalten ihn. */
function SpeechActManager({ eigene, onRename, onDelete }){
  const [bearbeitet, setBearbeitet] = useState(null);

  if (!eigene.length) {
    return (
      <p className="settingsText muted small" style={{marginBottom:0}}>
        Eigene Sprechabsichten legst du direkt in der Stunde an. Sie erscheinen
        danach hier und stehen in jeder weiteren Stunde zur Auswahl.
      </p>
    );
  }

  const uebernimm = ()=>{
    const wert = String(bearbeitet?.wert || '').trim();
    if (wert) onRename?.(bearbeitet.id, wert);
    setBearbeitet(null);
  };

  return (
    <div className="kompetenzBereich" style={{marginTop:10}}>
      <div className="kompetenzBereichKopf">
        <h4 className="kompetenzBereichName">Eigene Sprechabsichten</h4>
      </div>
      {eigene.map((label)=>(
        <div key={label} className="kompetenzZeile">
          {bearbeitet?.id === label ? (
            <>
              <input className="input" autoFocus value={bearbeitet.wert}
                     onChange={(e)=>setBearbeitet({ ...bearbeitet, wert: e.target.value })}
                     onKeyDown={(e)=>{
                       if (e.key === 'Enter') { e.preventDefault(); uebernimm(); }
                       if (e.key === 'Escape') { e.preventDefault(); setBearbeitet(null); }
                     }} />
              <button className="btn" onClick={uebernimm}>Speichern</button>
              <button className="btn" onClick={()=>setBearbeitet(null)}>Abbrechen</button>
            </>
          ) : (
            <>
              <span className="kompetenzName" style={{flex:1}}>{label}</span>
              <button className="btn btnMini" title="Umbenennen" aria-label={`${label} umbenennen`}
                      onClick={()=>setBearbeitet({ id: label, wert: label })}><Pencil {...ICON_SM} /></button>
              <button className="btn btnMini" title="Aus der Auswahl löschen"
                      aria-label={`${label} löschen`}
                      onClick={()=>onDelete?.(label)}><Trash2 {...ICON_SM} /></button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsView({ theme, onChangeTheme, storageState, onExportBackup, onImportBackup,
                        onExportPocketProfile, onOpenPocketImport,
                        weekReview, onChangeWeekReview,
                        languageMode, onChangeLanguageMode,
                        defaultPlanningProfile, onChangeDefaultPlanningProfile,
                        eigeneSprechabsichten = [], onRenameSpeechAct, onDeleteSpeechAct,
                        competencyModel, benutzteKompetenzen,
                        onSetCompetencyHidden, onSetCompetencyArea, onRenameCompetency,
                        onDeleteCompetency, onAddCompetencyArea, onRenameCompetencyArea,
                        onDeleteCompetencyArea, onLeereVerlauf,
                        onSchnellstartNeu, onHinweiseZuruecksetzen }){
  const istBrowser = platformName === 'browser';
  return (
    <div className="card" style={{display:'flex', flexDirection:'column', gap:18}}>
      <div>
        <h2 className="dialogTitle">Einstellungen</h2>
        <p className="muted small" style={{margin:0}}>
          Darstellung, Datenablage und Datenschutz.
        </p>
      </div>

      <section>
        <h3 className="settingsHeading">Darstellung</h3>
        <div className="settingsRow">
          <span>Hell, dunkel oder wie das Betriebssystem</span>
          <ThemeSwitch value={theme} onChange={onChangeTheme} />
        </div>
      </section>

      <section>
        <h3 className="settingsHeading">Wochenabschluss</h3>
        <div className="settingsRow">
          <span className="settingsText" style={{margin:0}}>
            Beim Verlassen einer Woche einen kurzen Rückblick zeigen.
          </span>
          <label className="row" style={{gap:8, flexShrink:0}}>
            <input type="checkbox" checked={!!weekReview}
                   onChange={(e)=>onChangeWeekReview(e.target.checked)} />
            <span>Anzeigen</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="settingsHeading">Unterrichtsplanung</h3>
        <div className="settingsRow">
          <span className="settingsText" style={{margin:0}}>
            <strong>Standard-Planungsprofil.</strong> Bestimmt, welche Angaben in der
            Phasenplanung <em>neuer</em> Stunden erscheinen. Bereits geplante Stunden
            behalten ihr eigenes Profil und ändern sich dadurch nicht.
          </span>
          <select value={normalisiereProfilId(defaultPlanningProfile)} style={{flexShrink:0}}
                  onChange={(e)=>onChangeDefaultPlanningProfile?.(e.target.value)}>
            {PLANUNGSPROFILE.filter(pr => !pr.eigen).map(pr => (
              <option key={pr.id} value={pr.id}>{pr.name}</option>
            ))}
          </select>
        </div>
        <p className="settingsText muted small" style={{marginBottom:0}}>
          {PLANUNGSPROFILE.find(pr => pr.id === normalisiereProfilId(defaultPlanningProfile))?.beschreibung || ''}
          {' '}Das Profil entscheidet ausschliesslich über die Sichtbarkeit – gespeicherte
          Angaben bleiben in jedem Fall erhalten, auch beim Wechsel auf ein knapperes Profil.
        </p>
      </section>

      <section>
        <h3 className="settingsHeading">Fachdidaktische Erweiterungen</h3>
        <div className="settingsRow">
          <span className="settingsText" style={{margin:0}}>
            <strong>Fremdsprachenmodus.</strong> Erweitert die Kompetenzplanung um
            fremdsprachendidaktische Kompetenzbereiche nach dem handlungsorientierten
            Ansatz des GER. Eigene Kompetenzen können jederzeit ergänzt werden.
          </span>
          <label className="row" style={{gap:8, flexShrink:0}}>
            <input type="checkbox" checked={!!languageMode}
                   onChange={(e)=>onChangeLanguageMode(e.target.checked)} />
            <span>Aktiv</span>
          </label>
        </div>
        {languageMode ? (
          <CompetencyManager
            modell={competencyModel}
            benutzte={benutzteKompetenzen}
            onSetHidden={onSetCompetencyHidden}
            onSetArea={onSetCompetencyArea}
            onRename={onRenameCompetency}
            onDelete={onDeleteCompetency}
            onAddArea={onAddCompetencyArea}
            onRenameArea={onRenameCompetencyArea}
            onDeleteArea={onDeleteCompetencyArea}
          />
        ) : null}
        {languageMode ? (
          <SpeechActManager
            eigene={eigeneSprechabsichten}
            onRename={onRenameSpeechAct}
            onDelete={onDeleteSpeechAct}
          />
        ) : (
          <p className="settingsText muted small" style={{marginBottom:0}}>
            Ist der Modus aus, verhält sich die Kompetenzplanung wie bisher:
            freie Eingabe mit Vorschlägen. Vorhandene Kompetenzen bleiben in
            jedem Fall erhalten – auch beim späteren Abschalten.
          </p>
        )}
      </section>

      <section>
        <h3 className="settingsHeading">Wo deine Daten liegen</h3>
        <p className="settingsText">
          {istBrowser
            ? 'Diese Planung liegt in der Datenbank deines Browsers, auf diesem Gerät. Sie wird nicht an einen Server übertragen – die App hat keinen.'
            : 'Diese Planung liegt als Datei auf diesem Rechner, im Benutzerordner der App. Sie wird nicht an einen Server übertragen – die App hat keinen.'}
        </p>
        <p className="settingsText">
          Es gibt keine Anmeldung, keine Nutzerkonten, keine Statistik und keine
          Verbindung nach aussen. Schriften und Symbole sind mitgeliefert und
          werden nicht nachgeladen.
        </p>

        {istBrowser ? (
          <p className="settingsText">
            Angehängte Dateien bleiben dort liegen, wo sie sind – die App merkt
            sich nur einen Verweis darauf. Wird eine Datei verschoben oder
            gelöscht, meldet die App das beim Öffnen. Im Backup stehen die
            Verweise, nicht die Dateien selbst.
          </p>
        ) : null}

        {istBrowser ? (
          storageState?.granted ? (
            <div className="inlineNotice">
              Der Browser hat die Ablage als dauerhaft zugesagt. Deine Planung
              bleibt auch dann erhalten, wenn Speicherplatz knapp wird.
            </div>
          ) : (
            <div className="inlineNotice inlineNotice--warning">
              Der Browser hat die Ablage <b>nicht</b> als dauerhaft zugesagt. Bei
              Platzmangel oder beim Löschen der Browserdaten kann deine Planung
              verschwinden. Lege regelmässig ein Backup an – am besten nach jeder
              Planungssitzung.
            </div>
          )
        ) : null}
      </section>

      <section>
        <h3 className="settingsHeading">Einführung</h3>
        <p className="settingsText">
          Der <strong>Schnellstart</strong> führt in drei Schritten zur ersten geplanten Stunde.
          Alles Weitere erklärt Prép-ybara erst dann, wenn du es zum ersten Mal brauchst –
          als kurzer Hinweis, den du wegklicken kannst.
        </p>
        <p className="settingsText muted small">
          Beides ändert ausschliesslich diese Einstellung. An deinen Stunden, Sequenzen und
          Vorlagen wird dabei nichts angefasst.
        </p>
        <div className="row wrap" style={{gap:8, marginTop:10}}>
          <button className="btn" onClick={onSchnellstartNeu}>Schnellstart erneut starten</button>
          <button className="btn" onClick={onHinweiseZuruecksetzen}>Kontextbezogene Hinweise zurücksetzen</button>
        </div>
      </section>

      <section>
        <h3 className="settingsHeading">Versionsverlauf</h3>
        <p className="settingsText">
          Neben dem Rückgängigmachen führt Prép-ybara einen <strong>lokalen
          Versionsverlauf</strong>: frühere Fassungen einzelner Stunden, Sequenzen
          und Sammelaktionen. Er entsteht an wenigen, festen Punkten – beim
          Verlassen einer geänderten Stunde sowie vor dem Löschen, Verschieben,
          Ersetzen und Wiederherstellen.
        </p>
        <p className="settingsText">
          Er liegt {istBrowser ? 'in einer eigenen Browser-Datenbank' : 'in einer eigenen Datei'} neben
          der Planung – nicht in ihr. Deshalb gehört er <b>nicht</b> zum Backup, wandert
          nicht nach Pocket und nicht in exportierte Vorlagen. Angehängte Dateien
          werden nie hineinkopiert; gespeichert werden nur Verweise.
        </p>
        <p className="settingsText muted small">
          Aufbewahrt werden höchstens {MAX_VERLAUF_TAGE} Tage, höchstens {MAX_VERLAUF_JE_ZIEL} Fassungen
          je Stunde oder Sequenz und insgesamt {MAX_VERLAUF_GESAMT} Einträge. Ältere fallen
          von selbst weg; die Unterrichtsdaten bleiben davon unberührt.
        </p>
        {typeof onLeereVerlauf === 'function' ? (
          <div className="row" style={{gap:8, marginTop:10}}>
            <button className="btn" onClick={onLeereVerlauf}>Versionsverlauf leeren</button>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="settingsHeading">Desktop-App und Browser-Version</h3>
        <div className="inlineNotice inlineNotice--warning">
          Beide Fassungen teilen ihre Daten <b>nicht</b>. Wer beides nutzt, hat
          zwei getrennte Planungen auf demselben Gerät. Die Brücke dazwischen ist
          der Backup-Export: hier ausgeben, dort einlesen.
        </div>
        {capabilities.backupFiles ? (
          <div className="row" style={{gap:8, marginTop:10}}>
            <button className="btn primary" onClick={onExportBackup}>Backup exportieren</button>
            <button className="btn" onClick={onImportBackup}>Backup importieren</button>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="settingsHeading">Prép-ybara Pocket</h3>
        <p className="settingsText">
          <strong>Pocket erfasst – Prép-ybara organisiert.</strong> Die mobile
          Begleit-App plant einzelne Stunden unterwegs; hier werden sie eingesetzt.
          Der Austausch läuft über Dateien, es gibt keine Verbindung und keine
          gemeinsame Datenbank.
        </p>
        <p className="settingsText muted small">
          Das Profil enthält Lerngruppen, Fächer, Stundenplan, Kompetenzen,
          Sprechabsichten, Sozialformen und Phasentypen – ausdrücklich keine
          Schülerdaten, Noten oder Nachbereitungen.
        </p>
        <div className="row wrap" style={{gap:8, marginTop:10}}>
          {capabilities.pocketFiles ? (
            <button className="btn primary" onClick={onExportPocketProfile}>Pocket-Profil exportieren</button>
          ) : null}
          <button className="btn" onClick={onOpenPocketImport}>Pocket-Import öffnen</button>
        </div>
      </section>

      <section>
        <h3 className="settingsHeading">Version</h3>
        <p className="settingsText">
          Prép-ybara {APP_VERSION} · {istBrowser ? 'Browser-Version' : 'Desktop-App'} · © Florian Nowak
        </p>
      </section>
    </div>
  );
}

/* Sequenzfortschritt: "Le passé composé – Stunde 4 von 9".

   Von allen Anzeigen dieser Ebene die stärkste, weil sie gleichzeitig
   Orientierung gibt und Fortschritt zeigt. Beides steckt bereits im
   Datenmodell – die Zuordnung in lesson.sequenceId, die Reihenfolge im
   Datum. Es kommt kein Feld hinzu.

   Der Balken bewertet nichts: er sagt, wo man steht, nicht ob das gut
   ist. Deshalb kein Prozentwert und kein Soll-Vergleich. */
function SequenceProgress({ progress, kompakt = false }){
  if (!progress || progress.position < 1) return null;
  const anteil = progress.total > 0 ? progress.position / progress.total : 0;
  const linie = progress.color ? lineColor(progress.color) : 'var(--primary)';
  return (
    <div className={`seqProgress${kompakt ? ' seqProgress--kompakt' : ''}`}>
      <div className="seqProgressText">
        <span className="seqProgressName">{progress.name}</span>
        <span className="seqProgressZahl">Stunde {progress.position} von {progress.total}</span>
      </div>
      <div className="seqProgressBahn" role="img"
           aria-label={`${progress.name}: Stunde ${progress.position} von ${progress.total}`}>
        <div className="seqProgressFuellung"
             style={{ width: `${Math.round(anteil * 100)}%`, background: linie }} />
      </div>
    </div>
  );
}


/* ============================================================
   Heute

   Ersetzt das morgendliche "Wochenraster öffnen, Tag suchen". Zeigt die
   Stunden des laufenden Tages, Aufsichten und offene To-dos.

   Die bestehende Datenschutzlogik bleibt gewahrt: Von den To-dos steht
   hier nur die ANZAHL. Der Inhalt erscheint erst, wenn die Liste
   geöffnet wird – wer mit dem Rechner am Pult steht, soll nicht
   versehentlich Namen und Vermerke zeigen.
   ============================================================ */
function TodayView({ heute, todayISO, getSeqProgress, onOpenLesson, onOpenTodos, onOpenWeek }){
  const datum = new Date(`${todayISO}T00:00:00`);
  const wochentag = Number.isNaN(datum.getTime())
    ? '' : datum.toLocaleDateString('de-DE', { weekday: 'long' });

  return (
    <div style={{display:'flex', flexDirection:'column', gap:14}}>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
          <div>
            <h2 className="dialogTitle">Heute</h2>
            <p className="muted small" style={{margin:0}}>
              {wochentag}, {formatDateDE(todayISO)}
            </p>
          </div>
          <button className="btn" onClick={onOpenWeek}>Zur Woche</button>
        </div>
      </div>

      <div className="card">
        <h3 className="settingsHeading">Stunden</h3>
        {heute.stunden.length === 0 ? (
          <EmptyState
            text="Für heute ist keine Stunde eingetragen. Im Wochenraster kannst du eine anlegen."
            actionLabel="Wochenraster öffnen"
            onAction={onOpenWeek}
          />
        ) : (
          <div className="todayList">
            {heute.stunden.map((s)=>{
              const l = s.lesson || {};
              const p = l.sequenceId ? getSeqProgress?.(l.sequenceId, s.dayIndex, s.slotIndex) : null;
              const farbe = l.classGroup && l.subject ? null : null;
              return (
                <button
                  key={s.key}
                  type="button"
                  className="todayLesson"
                  onClick={()=>onOpenLesson?.(s.dayIndex, s.slotIndex)}
                >
                  <span className="todaySlot" title={blockSpanOf(l) > 1 ? `${blockName(blockSpanOf(l))} · ${stundenBereichLabel(s.slotIndex, blockSpanOf(l))}` : ''}>
                    {blockSpanOf(l) > 1 ? `${s.slotIndex + 1}.–${s.slotIndex + blockSpanOf(l)}.` : `${s.slotIndex + 1}.`}
                  </span>
                  <span className="todayMain">
                    <span className="todayTopic">{String(l.topic || '').trim() || 'Noch kein Thema'}</span>
                    <span className="todayMeta">
                      {[l.classGroup, l.subject, l.room].filter(Boolean).join(' · ') || 'Ohne Lerngruppe'}
                    </span>
                    {p ? <SequenceProgress progress={p} kompakt /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {heute.aufsichten.length ? (
        <div className="card">
          <h3 className="settingsHeading">Aufsichten</h3>
          <div className="tagRow">
            {heute.aufsichten.map((a)=>(
              <span key={a.key} className="badge badge--dayoff">{a.title}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3 className="settingsHeading">To-dos</h3>
        {(heute.offeneHeute + heute.offeneUeberfaellig) === 0 ? (
          <p className="settingsText muted" style={{margin:0}}>Für heute steht nichts an.</p>
        ) : (
          <>
            <p className="settingsText" style={{marginBottom:8}}>
              {heute.offeneHeute > 0
                ? `${heute.offeneHeute} offene${heute.offeneHeute === 1 ? 's' : ''} To-do${heute.offeneHeute === 1 ? '' : 's'} für heute.`
                : 'Für heute selbst steht nichts an.'}
              {heute.offeneUeberfaellig > 0
                ? ` ${heute.offeneUeberfaellig} mit abgelaufener Frist.`
                : ''}
              {' '}Die Inhalte werden aus Datenschutzgründen erst in der Liste angezeigt.
            </p>
            <button className="btn primary" onClick={onOpenTodos}>To-dos öffnen</button>
          </>
        )}
      </div>
    </div>
  );
}


/* ============================================================
   Kompetenz-Wärmekarte

   Verwandelt Pflichtdokumentation in eine Auswertung: welche Kompetenz
   wurde wie oft und wann bedient. Die Daten liegen bereits vor –
   competencies je Stunde, eine davon als primäre markiert.

   Bewusst ohne Soll-Vergleich und ohne Lücken-Warnung. Die Karte zeigt
   die Verteilung; ob sie stimmt, weiss nur die Lehrkraft.
   ============================================================ */
/* Kompetenzprofil nach Bereichen.

   Ausdrücklich deskriptiv: Anteile, sonst nichts. Keine Sollwerte,
   keine Farbcodierung nach "gut" und "schlecht", keine Hinweise auf
   fehlende Bereiche. Die Zahlen gehören der Lehrkraft; die App
   kommentiert sie nicht. */
function CompetencyProfileView({ profil }){
  if (!profil || !profil.bereiche.length) return null;
  const prozent = (a)=> Math.round(a * 100);
  return (
    <div className="profilListe">
      {profil.bereiche.map((b)=>(
        <div key={b.id} className="profilZeile">
          <div className="profilKopf">
            <span className="profilName">{b.name}</span>
            <span className="profilZahl">{prozent(b.anteil)} % · {b.anzahl} Zuordnungen</span>
          </div>
          <div className="profilBahn" role="img"
               aria-label={`${b.name}: ${prozent(b.anteil)} Prozent, ${b.anzahl} Zuordnungen`}>
            <div className="profilFuellung" style={{ width: `${b.anteil * 100}%` }} />
          </div>
          <details className="profilDetails">
            <summary>{b.kompetenzen.length} {b.kompetenzen.length === 1 ? 'Kompetenz' : 'Kompetenzen'}</summary>
            <ul className="profilDetailListe">
              {b.kompetenzen.map((k)=>(
                <li key={k.name}>
                  <span>{k.name}</span>
                  <span className="profilDetailZahl">
                    {k.anzahl} {k.anzahl === 1 ? 'Stunde' : 'Stunden'}
                    {k.primaer > 0 ? ` · ${k.primaer}× primär` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Fachdidaktischer Planungscheck

   Ein Dialog nach dem vorhandenen Muster. Er rechnet aus dem gerade
   bearbeiteten Entwurf, nicht aus dem gespeicherten Stand – sonst
   fehlte alles, was in den letzten Sekunden getippt wurde.

   Was er zeigt, ist eine Auswahl, kein Katalog: höchstens zwei
   Feststellungen und sechs Fragen. Und er zeigt nichts an, was er
   nicht aus den Feldern belegen kann.
   ============================================================ */
function DidaktikCheckDialog({ open, ergebnis, onClose, onSpringeZu }){
  const schliessenRef = useRef(null);
  useEffect(()=>{ if (open) schliessenRef.current?.focus(); }, [open]);
  if (!open || !ergebnis) return null;

  const { strengths, prompts } = ergebnis;

  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modalCard checkCard" role="dialog" aria-modal="true"
           aria-label="Fachdidaktischer Planungscheck"
           onKeyDown={(e)=>{ if (e.key === 'Escape') onClose?.(); }}>
        <h3 className="dialogTitle">Fachdidaktischer Planungscheck</h3>
        <p className="dialogBody" style={{marginTop:0}}>
          Einige ausgewählte Fragen zu dieser Planung.
        </p>

        {strengths.length ? (
          <section className="checkAbschnitt">
            <h4 className="settingsHeading">Bereits angelegt</h4>
            <ul className="checkStaerken">
              {strengths.map((s)=>(
                <li key={s.id}>
                  <Check {...ICON_SM} />
                  <div>
                    <div className="checkStaerkeTitel">{s.title}</div>
                    <div className="muted small">{s.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="checkAbschnitt">
          <h4 className="settingsHeading">
            {strengths.length ? 'Noch einen Blick wert' : 'Fragen zu dieser Planung'}
          </h4>
          {prompts.length === 0 ? (
            <p className="muted small" style={{margin:0}}>
              Aus den vorhandenen Angaben ergibt sich gerade keine Frage.
            </p>
          ) : (
            <div className="checkImpulse">
              {prompts.map((p)=>(
                <div key={p.id} className="checkImpuls">
                  <div className="checkImpulsKopf">
                    <span className="checkKategorie">{p.category}</span>
                    <span className="checkImpulsTitel">{p.title}</span>
                    {(p.phaseId || p.target !== 'phases') ? (
                      <button type="button" className="btn btnMini"
                              onClick={()=>onSpringeZu?.(p)}>
                        {p.phaseId ? 'Zur Phase' : 'Zur Planung'}
                      </button>
                    ) : null}
                  </div>
                  <div className="checkImpulsText">{p.text}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="dialogActions">
          <button ref={schliessenRef} type="button" className="btn primary" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Offene Punkte aus vorherigen Stunden

   Der Hinweis ist bewusst leise: eine Zeile, kein Dialog, kein
   Warnsymbol. Nichts muss bearbeitet werden – wer die Stunde plant,
   ohne hinzusehen, wird nicht aufgehalten.

   Die Punkte gehören der Lerngruppe, nicht dieser Stunde. Deshalb
   überstehen sie es, wenn eine geplante Folgestunde gelöscht wird,
   Unterricht ausfällt oder sich der Plan verschiebt: sie warten
   einfach auf die nächste Stunde, die es gibt.
   ============================================================ */
function CarryOverPanel({ punkte, onUebernehmenAlsPhase, onUebernehmenAlsNotiz, onErledigt, onIgnorieren }){
  const [offen, setOffen] = useState(false);
  const [auswahl, setAuswahl] = useState(()=> new Set());

  if (!punkte.length) return null;

  const phasenPunkte = punkte.filter(p => p.snapshot);
  const umschalten = (id)=>{
    setAuswahl((v)=>{
      const n = new Set(v);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  /* Mehrere Phasen in ihrer ursprünglichen Reihenfolge übernehmen –
     also so, wie sie in der Stunde standen, nicht in Klickreihenfolge. */
  const gewaehlte = phasenPunkte.filter(p => auswahl.has(p.id));

  return (
    <div className="carryBox">
      <button type="button" className="carryKopf" onClick={()=>setOffen(v => !v)} aria-expanded={offen}>
        {offen ? <ChevronDown {...ICON_SM} /> : <ChevronRight {...ICON_SM} />}
        <span>
          {punkte.length} {punkte.length === 1 ? 'offener Punkt' : 'offene Punkte'} aus vorherigen Stunden
        </span>
        <span className="muted small">{offen ? 'Schließen' : 'Ansehen'}</span>
      </button>

      {offen ? (
        <div className="carryInhalt">
          {punkte.map((p)=>(
            <div key={p.id} className="carryPunkt">
              <div className="carryHerkunft">
                {p.sourceDateISO ? formatDateDE(p.sourceDateISO) : ''}
                {p.sourceTopic ? ` · ${p.sourceTopic}` : ''}
                {p.type === 'unfinished_phase' ? ' · offen gebliebene Phase'
                  : p.type === 'partial_phase' ? ' · offener Teil einer Phase'
                  : p.type === 'review_note' ? ' · Notiz aus der Nachbereitung'
                  : ' · vorgemerkt'}
              </div>
              <div className="carryZeile">
                {p.snapshot ? (
                  <input type="checkbox" checked={auswahl.has(p.id)} onChange={()=>umschalten(p.id)}
                         aria-label={`${p.title} auswählen`} />
                ) : null}
                <span className="carryTitel">{p.title}</span>
              </div>
              <div className="carryAktionen">
                <button className="btn btnMini" onClick={()=>onUebernehmenAlsPhase([p])}>Als Phase übernehmen</button>
                <button className="btn btnMini" onClick={()=>onUebernehmenAlsNotiz(p)}>Als Notiz übernehmen</button>
                <button className="btn btnMini" onClick={()=>onErledigt(p)}>Erledigt</button>
                <button className="btn btnMini" onClick={()=>onIgnorieren(p)}>Ignorieren</button>
              </div>
            </div>
          ))}

          {/* Erst ab zwei phasenbasierten Punkten – darunter wäre die
              Mehrfachauswahl nur ein zusätzlicher Klick. */}
          {phasenPunkte.length >= 2 ? (
            <div className="carryMehrfach">
              <button className="btn" disabled={gewaehlte.length === 0}
                      onClick={()=>{ onUebernehmenAlsPhase(gewaehlte); setAuswahl(new Set()); }}>
                {gewaehlte.length ? `${gewaehlte.length} ${gewaehlte.length === 1 ? 'Phase' : 'Phasen'} übernehmen` : 'Auswahl übernehmen'}
              </button>
              <button className="btn btnLeise"
                      onClick={()=>{ onUebernehmenAlsPhase(phasenPunkte); setAuswahl(new Set()); }}>
                Alle offenen Phasen übernehmen
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Nachbereitung einer gehaltenen Stunde

   Keine zweite Unterrichtsplanung. Die Ansicht fasst die geplante
   Stunde lesbar zusammen und fragt genau eine Sache: was ist daraus
   geworden. Vier Zustände je Phase, ein Klick, fertig.

   Die Sprache bleibt neutral. "Offen geblieben" ist kein Versäumnis,
   und "entfallen" ist eine Entscheidung, keine Lücke. Es gibt keine
   Fehlerfarbe, keine Warnung und keine Wertung – eine Planung ist eine
   Annahme über den Verlauf, kein Versprechen.
   ============================================================ */
function LessonReviewView({
  lesson, dateISO, dayIndex, slotIndex, languageMode,
  onChangeReview, onOpenLesson,
}){
  const l = normalizeLesson(lesson);
  const review = normalisiereReview(l.review);
  const phasen = normalizePhases(l.phases || [], lessonTotalMin(l));
  const [neuerPunkt, setNeuerPunkt] = useState('');
  const [notizVormerken, setNotizVormerken] = useState(false);

  const aendern = (patch)=> onChangeReview({ ...review, ...patch });

  const setzePhase = (phaseId, patch)=>{
    const bisher = review.phaseReviews[phaseId] || { executionStatus:'', note:'', unfinishedContent:'' };
    aendern({ phaseReviews: { ...review.phaseReviews, [phaseId]: { ...bisher, ...patch } } });
  };

  const ergaenzeCarry = (eintrag)=>{
    if (!eintrag) return;
    aendern({ carryOverItems: [...review.carryOverItems, eintrag], status: 'in_progress' });
  };
  const entferneCarry = (id)=>
    aendern({ carryOverItems: review.carryOverItems.filter(i => i.id !== id) });

  /* Ein Punkt gilt als vorgemerkt, wenn es zu dieser Phase schon einen
     offenen Eintrag gibt – so lässt sich der Knopf nicht doppelt drücken. */
  const vorgemerkt = (phaseId, typ)=> review.carryOverItems
    .find(i => i.sourcePhaseId === phaseId && i.type === typ && i.status === 'open');

  const offene = review.carryOverItems.filter(i => i.status === 'open');
  const erledigte = review.carryOverItems.filter(i => i.status !== 'open');

  const kopf = [
    (l.classGroup || '').trim(),
    (l.subject || '').trim(),
  ].filter(Boolean).join(' · ');

  const zusammenfassung = [
    ['Thema', (l.topic || '').trim()],
    ['Lernziele', (l.objectives || '').trim()],
  ].filter(([, v]) => v);

  const aufgabe = normalisiereAufgabe(l.communicativeTask);
  const kompetenzen = [l.primaryCompetency, ...(l.competencies || [])]
    .map(x => String(x || '').trim()).filter(Boolean);
  const kompetenzListe = [...new Set(kompetenzen)];

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
        <div>
          <h2 className="dialogTitle">Nachbereitung</h2>
          <p className="muted small" style={{margin:0}}>
            {kopf}{kopf && dateISO ? ' · ' : ''}{dateISO ? formatDateDE(dateISO) : ''}
            {Number.isFinite(slotIndex) ? ` · ${slotIndex + 1}. Stunde` : ''}
          </p>
        </div>
        <button className="btn" onClick={onOpenLesson}>Zur Planung</button>
      </div>

      {(zusammenfassung.length || kompetenzListe.length || (languageMode && aufgabe.text)) ? (
        <section className="nbZusammenfassung">
          {zusammenfassung.map(([k, v])=>(
            <div key={k}>
              <div className="nbLabel">{k}</div>
              <div className="nbWert">{v}</div>
            </div>
          ))}
          {kompetenzListe.length ? (
            <div>
              <div className="nbLabel">Kompetenzen</div>
              <div className="nbWert">{kompetenzListe.join(' · ')}</div>
            </div>
          ) : null}
          {languageMode && aufgabe.text ? (
            <div>
              <div className="nbLabel">Kommunikative Aufgabe</div>
              <div className="nbWert">{aufgabe.text}</div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={{marginTop:18}}>
        <h3 className="settingsHeading">Verlauf</h3>
        <div className="nbPhasen">
          {phasen.map((p)=>{
            const pr = review.phaseReviews[p.id] || { executionStatus:'', note:'', unfinishedContent:'' };
            const istOffen = pr.executionStatus === 'not_completed';
            const istTeilweise = pr.executionStatus === 'partial';
            const ganzVorgemerkt = vorgemerkt(p.id, 'unfinished_phase');
            const restVorgemerkt = vorgemerkt(p.id, 'partial_phase');
            return (
              <div key={p.id} className="nbPhase">
                <div className="nbPhaseKopf">
                  <span className="nbPhaseZeichen" aria-hidden="true">
                    {statusZeichen(pr.executionStatus) || '·'}
                  </span>
                  <span className="nbPhaseName">{p.title || 'Phase'}</span>
                  <span className="muted small">{p.duration} min{p.socialForm ? ` · ${p.socialForm}` : ''}</span>
                  <div className="nbStatusWahl" role="group" aria-label={`Status von ${p.title || 'Phase'}`}>
                    {PHASEN_STATUS.map((st)=>(
                      <button
                        key={st.id}
                        type="button"
                        className={`btn btnMini${pr.executionStatus === st.id ? ' primary' : ''}`}
                        aria-pressed={pr.executionStatus === st.id}
                        title={st.name}
                        onClick={()=>setzePhase(p.id, {
                          executionStatus: pr.executionStatus === st.id ? '' : st.id,
                        })}
                      >{st.zeichen} {st.kurz}</button>
                    ))}
                  </div>
                </div>

                {istTeilweise ? (
                  <div className="nbPhaseDetail">
                    <label className="small muted">Noch offen (optional)</label>
                    <input
                      className="input"
                      value={pr.unfinishedContent}
                      onChange={(e)=>setzePhase(p.id, { unfinishedContent: e.target.value })}
                      placeholder="z. B. gemeinsame Empfehlungen formulieren"
                    />
                  </div>
                ) : null}

                {(istOffen || istTeilweise) ? (
                  <div className="nbPhaseAktionen">
                    {/* Vormerken ist ein Klick, nicht ein Automatismus: was in
                        die nächste Stunde geht, entscheidet die Lehrkraft. */}
                    {istTeilweise && pr.unfinishedContent.trim() ? (
                      restVorgemerkt ? (
                        <span className="nbVorgemerkt">
                          Offener Teil vorgemerkt
                          <button className="btn btnMini" onClick={()=>entferneCarry(restVorgemerkt.id)}
                                  title="Vormerkung zurücknehmen"><X {...ICON_SM} /></button>
                        </span>
                      ) : (
                        <button className="btn btnLeise" onClick={()=>ergaenzeCarry(
                          carryOverAusPhase(p, { nurOffenerTeil: true, offenerText: pr.unfinishedContent, neueId: uid })
                        )}>Offenen Teil vormerken</button>
                      )
                    ) : null}

                    {ganzVorgemerkt ? (
                      <span className="nbVorgemerkt">
                        Phase vorgemerkt
                        <button className="btn btnMini" onClick={()=>entferneCarry(ganzVorgemerkt.id)}
                                title="Vormerkung zurücknehmen"><X {...ICON_SM} /></button>
                      </span>
                    ) : (
                      <button className="btn btnLeise" onClick={()=>ergaenzeCarry(
                        carryOverAusPhase(p, { neueId: uid })
                      )}>{istTeilweise ? 'Ganze Phase vormerken' : 'Für nächste Stunde vormerken'}</button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{marginTop:18}}>
        <h3 className="settingsHeading">Notizen</h3>
        <textarea
          value={review.generalNotes}
          onChange={(e)=>aendern({ generalNotes: e.target.value, status: review.status === 'not_reviewed' ? 'in_progress' : review.status })}
          placeholder="z. B. Die Redemittel zum Widersprechen wurden noch wenig genutzt."
        />
        <div className="row wrap" style={{gap:8, marginTop:6, alignItems:'center'}}>
          <label className="row" style={{gap:6}}>
            <input type="checkbox" checked={notizVormerken}
                   onChange={(e)=>setNotizVormerken(e.target.checked)} />
            <span className="small">Für nächste Stunde vormerken</span>
          </label>
          <button className="btn btnLeise"
                  disabled={!notizVormerken || !review.generalNotes.trim()}
                  onClick={()=>{
                    ergaenzeCarry(carryOverAusNotiz(review.generalNotes, { type:'review_note', neueId: uid }));
                    setNotizVormerken(false);
                  }}>Notiz vormerken</button>
        </div>
      </section>

      <section style={{marginTop:18}}>
        <h3 className="settingsHeading">Für nächste Stunde</h3>
        {offene.length === 0 ? (
          <p className="muted small" style={{margin:'0 0 8px'}}>
            Noch nichts vorgemerkt. Was hier steht, wird bei der nächsten Stunde
            dieser Lerngruppe angeboten – übernehmen musst du es dort.
          </p>
        ) : (
          <ul className="nbPunkte">
            {offene.map((i)=>(
              <li key={i.id}>
                <span>{i.title}</span>
                <button className="btn btnMini" onClick={()=>entferneCarry(i.id)}
                        title="Vormerkung entfernen" aria-label="Vormerkung entfernen"><X {...ICON_SM} /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="row" style={{gap:8, marginTop:8}}>
          <input className="input" value={neuerPunkt} style={{flex:1}}
                 onChange={(e)=>setNeuerPunkt(e.target.value)}
                 onKeyDown={(e)=>{
                   if (e.key !== 'Enter') return;
                   e.preventDefault();
                   if (!neuerPunkt.trim()) return;
                   ergaenzeCarry(carryOverAusNotiz(neuerPunkt, { type:'manual_follow_up', neueId: uid }));
                   setNeuerPunkt('');
                 }}
                 placeholder="z. B. Hausaufgabe zunächst vergleichen" />
          <button className="btn" disabled={!neuerPunkt.trim()}
                  onClick={()=>{
                    ergaenzeCarry(carryOverAusNotiz(neuerPunkt, { type:'manual_follow_up', neueId: uid }));
                    setNeuerPunkt('');
                  }}>Punkt hinzufügen</button>
        </div>

        {erledigte.length ? (
          <details className="nbErledigt">
            <summary>{erledigte.length} {erledigte.length === 1 ? 'abgeschlossener Punkt' : 'abgeschlossene Punkte'}</summary>
            <ul className="nbPunkte">
              {erledigte.map((i)=>(
                <li key={i.id}>
                  <span className="muted">{i.title}</span>
                  <span className="muted small">
                    {i.status === 'transferred' ? 'übernommen' : i.status === 'completed' ? 'erledigt' : 'verworfen'}
                    {i.resolvedAt ? ` · ${formatDateDE(i.resolvedAt.slice(0,10))}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="row" style={{justifyContent:'flex-end', marginTop:18}}>
        {review.status === 'reviewed' ? (
          <span className="muted small" style={{alignSelf:'center'}}>
            Abgeschlossen{review.reviewedAt ? ` am ${formatDateDE(review.reviewedAt.slice(0,10))}` : ''} –
            weiterhin bearbeitbar.
          </span>
        ) : (
          <button className="btn primary" onClick={()=>aendern({
            status: 'reviewed', reviewedAt: new Date().toISOString(),
          })}>Nachbereitung abschließen</button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Progression einer Sequenz

   Sie zeigt, wie sich das sprachliche Handeln über die Sequenz
   entwickelt – und speist sich vollständig aus dem, was in den Stunden
   ohnehin steht. Es wird nichts doppelt eingegeben; die einzige eigene
   Angabe ist die freie Notiz je Stunde, und die liegt in der Stunde.

   Was sie ausdrücklich NICHT tut: bewerten. Keine Reihenfolgeprüfung,
   kein Hinweis auf angeblich fehlende Progression, keine Ampel, kein
   Wert. Ob eine Sequenz didaktisch trägt, entscheidet die Lehrkraft;
   die App legt ihr die eigenen Angaben nebeneinander.
   ============================================================ */
/* Eine geöffnete Sequenz. Hier – und nur hier – steht der Export einer
   konkreten Sequenz: ein dezentes "Exportieren ▾" oben rechts, in
   derselben Zeile wie die übrigen Aktionen. */
function SequenceProgressionView({ sequenz, zeilen, onOpenLesson, onChangeNote, onOpenLessons,
                                   onExportDocx, onExportPdf, onVerschieben, onVerschiebenAb }){
  const [exportOffen, setExportOffen] = useState(false);
  const exportRef = useRef(null);
  useEffect(()=>{
    if (!exportOffen) return;
    const beiKlick = (e)=>{ if (exportRef.current && !exportRef.current.contains(e.target)) setExportOffen(false); };
    const beiTaste = (e)=>{ if (e.key === 'Escape') setExportOffen(false); };
    window.addEventListener('mousedown', beiKlick);
    window.addEventListener('keydown', beiTaste);
    return ()=>{
      window.removeEventListener('mousedown', beiKlick);
      window.removeEventListener('keydown', beiTaste);
    };
  }, [exportOffen]);
  const exportMoeglich = (capabilities.docxExport && typeof onExportDocx === 'function')
    || (capabilities.pdfExport && typeof onExportPdf === 'function');
  const finalTask = normalisiereAufgabe(sequenz?.finalTask);
  const details = [
    ['Situation', finalTask.situation],
    ['Adressat', finalTask.audience],
    ['Absicht', finalTask.intention],
    ['Ergebnis', finalTask.outcome],
  ].filter(([, v]) => v);

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
        <div>
          <h2 className="dialogTitle">{sequenz?.name || 'Sequenz'}</h2>
          <p className="muted small" style={{margin:0}}>
            Wie sich das sprachliche Handeln über die Sequenz entwickelt – aus den
            Angaben der einzelnen Stunden.
          </p>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <button className="btn" onClick={onOpenLessons}>Stunden im Makroplan</button>
          {typeof onVerschieben === 'function' ? (
            <button className="btn" onClick={()=>onVerschieben()}
                    title="Die Termine dieser Sequenz auf andere Stundenplanplätze legen – mit Vorschau">
              <CalendarClock {...ICON_SM} /> Termine verschieben…
            </button>
          ) : null}
          {exportMoeglich ? (
            <div className="kebabWrap" ref={exportRef}>
              <button
                className="btn"
                aria-haspopup="menu"
                aria-expanded={exportOffen}
                onClick={()=>setExportOffen(v => !v)}
                title="Diese Sequenz ausgeben"
              ><Download {...ICON_SM} /> Exportieren <ChevronDown {...ICON_SM} /></button>
              {exportOffen ? (
                <div className="kebabMenu kebabMenu--rechts" role="menu">
                  {(capabilities.docxExport && typeof onExportDocx === 'function') ? (
                    <button className="kebabEintrag" onClick={()=>{ setExportOffen(false); onExportDocx(); }}>
                      <span className="kebabIcon"><FileText {...ICON_SM} /></span>
                      <span>Als Word-Datei</span>
                    </button>
                  ) : null}
                  {(capabilities.pdfExport && typeof onExportPdf === 'function') ? (
                    <button className="kebabEintrag" onClick={()=>{ setExportOffen(false); onExportPdf(); }}>
                      <span className="kebabIcon"><FileDown {...ICON_SM} /></span>
                      <span>Als PDF</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {!istLeereAufgabe(finalTask) ? (
        <section className="zielaufgabe">
          <div className="zielaufgabeKopf">Zielaufgabe der Sequenz</div>
          {finalTask.text ? <p className="zielaufgabeText">{finalTask.text}</p> : null}
          {details.length ? (
            <div className="zielaufgabeDetails">
              {details.map(([k, v])=>(
                <div key={k}><span className="muted small">{k}: </span>{v}</div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {zeilen.length === 0 ? (
        <EmptyState
          text="Sobald dieser Sequenz Stunden zugeordnet sind, entsteht hier ihre Abfolge."
        />
      ) : (
        <div className="progScroll">
          <table className="progTable">
            <thead>
              <tr>
                <th scope="col" className="progNr">Std.</th>
                <th scope="col">Sprachhandlung / Aufgabe</th>
                <th scope="col">Kompetenz</th>
                <th scope="col">Sprechabsichten</th>
                <th scope="col">Sprachliche Mittel</th>
                <th scope="col">Hilfen</th>
                <th scope="col">Notiz</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z)=>(
                <tr key={z.key}>
                  <th scope="row" className="progNr">
                    <button className="linkBtn" onClick={()=>onOpenLesson(z)}
                            title="Stunde öffnen">{z.nummer}</button>
                    {z.dateISO ? <div className="muted small">{formatDateDE(z.dateISO)}</div> : null}
                    {typeof onVerschiebenAb === 'function' ? (
                      <button
                        className="iconBtn"
                        title="Ab dieser Stunde verschieben"
                        aria-label={`Ab Stunde ${z.nummer} verschieben`}
                        onClick={()=>onVerschiebenAb(z)}
                      ><CalendarClock {...ICON_SM} /></button>
                    ) : null}
                  </th>
                  <td>
                    <div>{z.sprachhandlung || <span className="muted">—</span>}</div>
                    {/* Sichtbar machen, wenn hier ersatzweise das Thema steht. */}
                    {!z.ausAufgabe && z.topic ? <div className="muted small">Stundenthema</div> : null}
                  </td>
                  <td>
                    {z.kompetenzPrimaer ? (
                      <div><Star {...ICON_SM} /> {z.kompetenzPrimaer}</div>
                    ) : null}
                    {z.kompetenzen.filter(k => k !== z.kompetenzPrimaer).map(k => (
                      <div key={k} className="muted small">{k}</div>
                    ))}
                    {!z.kompetenzPrimaer && !z.kompetenzen.length ? <span className="muted">—</span> : null}
                  </td>
                  <td>
                    {z.sprechabsichten.length
                      ? z.sprechabsichten.join(', ')
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {z.mittel.length
                      ? z.mittel.map((m, i)=> <div key={i}>{m}</div>)
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {z.scaffolds.length ? (
                      <details className="progHilfen">
                        <summary>
                          {z.scaffolds.length} {z.scaffolds.length === 1 ? 'Hilfe' : 'Hilfen'}
                          {/* Nur was die Lehrkraft selbst hinterlegt hat. */}
                          {z.stufe ? ` · ${stufenName(z.stufe)}` : ''}
                        </summary>
                        <ul className="progHilfenListe">
                          {z.scaffolds.map(sc => (
                            <li key={sc.id}>
                              {sc.fadeOut ? <ArrowDown {...ICON_SM} /> : null}
                              <span>{sc.label || scaffoldArtName(sc.type)}</span>
                              {sc.note ? <span className="muted small"> – {sc.note}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    {/* Ein Textfeld statt einer Zeile: In einer Tabelle, die
                        gelesen werden soll, darf die Notiz nicht hinter dem
                        rechten Rand verschwinden. */}
                    <textarea
                      className="input progNotiz"
                      rows={3}
                      value={z.notiz}
                      onChange={(e)=>onChangeNote(z, e.target.value)}
                      placeholder="z. B. Übergang zum freieren Sprechen"
                      aria-label={`Progressionsnotiz zu Stunde ${z.nummer}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompetencyHeatmapView({ daten, profil, onBack }){
  const monatsName = (m)=>{
    const [j, mo] = String(m).split('-');
    const d = new Date(Number(j), Number(mo) - 1, 1);
    return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString('de-DE', { month: 'short' });
  };

  if (!daten.zeilen.length) {
    return (
      <div className="card">
        <h2 className="dialogTitle">Kompetenzen im Jahr</h2>
        <EmptyState
          text="Sobald du Stunden Kompetenzen zuordnest, entsteht hier eine Übersicht darüber, welche Kompetenz du wann und wie oft bedient hast."
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
        <div>
          <h2 className="dialogTitle">Kompetenzen im Jahr</h2>
          <p className="muted small" style={{margin:0}}>
            Wie oft welche Kompetenz in welchem Monat vorkam. {daten.gesamt} Zuordnungen insgesamt.
          </p>
        </div>
      </div>

      {profil && profil.bereiche.length ? (
        <section style={{marginTop:14}}>
          <h3 className="settingsHeading">Kompetenzprofil</h3>
          <p className="muted small" style={{margin:'0 0 4px'}}>
            Wie sich die Zuordnungen auf die Bereiche verteilen. Eine Beschreibung,
            keine Bewertung.
          </p>
          <CompetencyProfileView profil={profil} />
        </section>
      ) : null}

      <div className="heatScroll">
        <table className="heatTable">
          <thead>
            <tr>
              <th scope="col" className="heatRowHead">Kompetenz</th>
              {daten.monate.map(m => <th key={m} scope="col" className="heatMonth">{monatsName(m)}</th>)}
              <th scope="col" className="heatMonth">Summe</th>
            </tr>
          </thead>
          <tbody>
            {daten.zeilen.map((z)=>(
              <tr key={z.name}>
                <th scope="row" className="heatRowHead">
                  {z.name}
                  {z.primaerSumme > 0 ? (
                    <span className="heatPrimaer" title={`${z.primaerSumme}× als primäre Kompetenz`}>
                      {z.primaerSumme}× primär
                    </span>
                  ) : null}
                </th>
                {z.zellen.map((c, i)=>{
                  const anteil = daten.hoechst > 0 ? c.anzahl / daten.hoechst : 0;
                  return (
                    <td key={i} className="heatCell"
                        title={`${daten.monate[i]}: ${c.anzahl}× (davon ${c.primaer}× primär)`}>
                      {/* Deckkraft gedeckelt: darüber wäre die Zahl auf der
                          Fläche nicht mehr mit 4.5:1 lesbar (nachgerechnet). */}
                      <span className="heatFill" style={{ opacity: c.anzahl ? 0.12 + anteil * 0.48 : 0 }} />
                      <span className="heatZahl">{c.anzahl || ''}</span>
                    </td>
                  );
                })}
                <td className="heatCell heatSum">{z.summe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ============================================================
   Wochenabschluss

   Ein ruhiger Rückblick statt eines leeren Rasters. Ausdrücklich eine
   Zusammenfassung, keine Bewertung: kein Prozentwert, kein Vergleich mit
   einem Soll, kein Pokal. Die Zahlen sagen, was war – nicht ob es genug
   war. Deshalb steht dort "4 von 5 Plätzen mit einem Thema" und nicht
   "80 % erledigt".

   Hier darf das Capybara einmal auftauchen – und genau einmal in der
   ganzen Anwendung.
   ============================================================ */
function WeekReview({ offen, zusammenfassung, weekLabel, onClose, onDisable }){
  if (!offen || !zusammenfassung) return null;
  const z = zusammenfassung;
  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div className="modalCard reviewCard" role="dialog" aria-modal="true" aria-label="Wochenabschluss"
           onKeyDown={(e)=>{ if (e.key === 'Escape') onClose(); }}>
        <img className="reviewArt" src={logo} alt="" aria-hidden="true" />
        <h3 className="dialogTitle">Woche abgeschlossen</h3>
        <p className="muted small" style={{margin:'0 0 12px'}}>{weekLabel}</p>

        <ul className="reviewList">
          <li>
            <span className="reviewZahl">{z.geplant}</span>
            <span className="reviewText">
              {z.geplant === 1 ? 'Stunde mit Thema' : 'Stunden mit Thema'}
              {z.gesamt > z.geplant ? ` · ${z.gesamt - z.geplant} noch ohne` : ''}
            </span>
          </li>
          {z.lerngruppen > 0 ? (
            <li>
              <span className="reviewZahl">{z.lerngruppen}</span>
              <span className="reviewText">{z.lerngruppen === 1 ? 'Lerngruppe' : 'Lerngruppen'}</span>
            </li>
          ) : null}
          {z.erledigteTodos > 0 ? (
            <li>
              <span className="reviewZahl">{z.erledigteTodos}</span>
              <span className="reviewText">{z.erledigteTodos === 1 ? 'To-do erledigt' : 'To-dos erledigt'}</span>
            </li>
          ) : null}
        </ul>

        {z.sequenzen.length ? (
          <div className="reviewSeq">
            <div className="settingsHeading">Fortgesetzte Sequenzen</div>
            <div className="tagRow">
              {z.sequenzen.map((sq)=>(
                <span key={sq.name} className="pill"
                      style={{borderColor: lineColor(sq.color), color: lineColor(sq.color)}}>
                  {sq.name} · {sq.anzahl}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dialogActions">
          <button type="button" className="btn" onClick={onDisable}>Nicht mehr zeigen</button>
          <button type="button" className="btn primary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   Seitenleiste

   Entscheidung: ja. Zwei Gründe.

   Erstens war die Kopfleiste nachweislich überfüllt – in Phase 1 brach
   der Titel um, bis white-space: nowrap gesetzt wurde. Diese Phase legt
   zwei weitere Ansichten dazu; sie in dieselbe Zeile zu drängen hätte
   die Leiste endgültig unlesbar gemacht.

   Zweitens macht sie die Ebenen sichtbar, um die es fachlich geht:
   Tag → Woche → Zeitraum → Jahr. Das Badge in der Kopfleiste nannte nur
   die aktuelle Ansicht, nicht ihren Platz in dieser Folge.

   Schmal gehalten und ab 900px auf Symbole reduziert, damit dem
   Wochenraster mit seinen fünf Spalten die Breite bleibt.
   ============================================================ */
const NAV_EBENEN = [
  { id: 'today',        label: 'Heute',       Icon: Sun },
  { id: 'week',         label: 'Woche',       Icon: CalendarDays },
  /* Die Suche steht bei den Ebenen und nicht im Fuss: sie ist ein Weg
     in die Inhalte, keine Einstellung. Das Lupensymbol ist dasselbe wie
     in der Befehlspalette – es ist derselbe Vorgang. */
  { id: 'search',       label: 'Suche',       Icon: Search },
  /* Die Unterrichtszeiten stehen bei den Ebenen: Sie beschreiben, wann
     unterrichtet wird – die Woche zeigt, was darin geplant ist. */
  { id: 'timetable',    label: 'Zeiten',      Icon: CalendarClock },
  { id: 'macro',        label: 'Makro',       Icon: Rows3 },
  { id: 'year',         label: 'Jahr',        Icon: CalendarRange },
  { id: 'competencies', label: 'Kompetenzen', Icon: Grid3x3 },
  { id: 'library',      label: 'Bibliothek',  Icon: Library },
  { id: 'calendar',     label: 'Kalender',    Icon: CalendarCheck },
];
const NAV_FUSS = [
  { id: 'settings', label: 'Einstellungen', Icon: Settings },
  { id: 'help',     label: 'Hilfe',         Icon: CircleHelp },
];

/* Im Archiv stehen nur die Bereiche zur Wahl, die ein Schuljahr
   überhaupt hat. "Heute" gehört zum laufenden Jahr, die Bibliothek und
   die Einstellungen gehören der App – beides wäre im Archiv nur
   verwirrend. */
/* Die Suche gehört dazu: sie findet auch im Archiv, und ihre Treffer
   führen von dort aus zurück ins laufende Schuljahr. */
const NAV_ARCHIV = ['week', 'macro', 'year', 'competencies', 'calendar', 'search'];

function Sidebar({ aktiv, onNavigate, imArchiv = false }){
  const eintrag = ({ id, label, Icon })=>(
    <button
      key={id}
      type="button"
      className={`navItem${aktiv === id ? ' is-active' : ''}`}
      aria-current={aktiv === id ? 'page' : undefined}
      onClick={()=>onNavigate(id)}
      title={label}
      /* Anker für die Einführung. Ein Attribut statt eines Selektors:
         Wird die Leiste umgebaut, wandert es mit. */
      data-onboarding-target={`nav-${id}`}
    >
      <Icon {...ICON} />
      <span className="navLabel">{label}</span>
    </button>
  );
  return (
    <nav className="sidebar" aria-label="Ansichten">
      <div className="navGroup">
        {(imArchiv ? NAV_EBENEN.filter(e => NAV_ARCHIV.includes(e.id)) : NAV_EBENEN).map(eintrag)}
      </div>
      <div className="navGroup navGroup--fuss">
        {(imArchiv ? NAV_FUSS.filter(e => e.id === 'help') : NAV_FUSS).map(eintrag)}
      </div>
    </nav>
  );
}

const THEME_CHOICES = ['light', 'dark', 'system'];
const THEME_LABELS = { light: 'Hell', dark: 'Dunkel', system: 'System' };

/* Drei Zustände, als Radiogruppe – damit Tastatur und Screenreader die
   Auswahl als das lesen, was sie ist. */
function ThemeSwitch({ value, onChange }){
  return (
    <div className="themeSwitch" role="radiogroup" aria-label="Darstellung">
      {THEME_CHOICES.map((choice)=>(
        <button
          key={choice}
          type="button"
          role="radio"
          aria-checked={value === choice}
          className={`themeSwitchBtn${value === choice ? ' is-active' : ''}`}
          onClick={()=>onChange(choice)}
          title={`Darstellung: ${THEME_LABELS[choice]}`}
        >{THEME_LABELS[choice]}</button>
      ))}
    </div>
  );
}

/* ============================================================
   Pocket-Import

   Der Weg zurück: eine Datei aus Prép-ybara Pocket wird zu einer
   Stunde in der Wochenplanung.

   Der Ablauf ist bewusst dreiteilig und nicht zweiteilig:

       Datei wählen  →  VORSCHAU  →  Importieren

   Die Vorschau ist keine Höflichkeit. Sie ist die Stelle, an der
   sichtbar wird, wohin die Stunde geht, was dort schon steht und was an
   ihr neu ist. Ohne sie wäre der Import ein Sprung ins Ungewisse – und
   ein überschriebener Donnerstag wäre nicht zu bemerken, bevor er weg
   ist.

   Drei Regeln, die diese Ansicht durchhält:

   1. Nichts wird automatisch überschrieben. Steht am Zieltermin bereits
      eine Planung, gibt es vier Wege – und der voreingestellte ist
      "Desktopplanung beibehalten".
   2. Ein zweiter Import derselben Pocket-Kennung wird gemeldet, bevor
      er passiert.
   3. Neue Kompetenzen und Sprechabsichten kommen nur in die Bibliothek,
      wenn das ausdrücklich angehakt wird. In der Stunde stehen sie in
      jedem Fall.

   Jeder Import ist über Strg+Z zurückzunehmen.
   ============================================================ */

const POCKET_MODUS_OPTIONEN = [
  {
    id: 'behalten',
    name: 'Desktopplanung beibehalten',
    beschreibung: 'Es wird nichts importiert. Die vorhandene Stunde bleibt unverändert.',
  },
  {
    id: POCKET_MODI.NEU,
    name: 'Pocketplanung als neue Stunde importieren',
    beschreibung: 'Die vorhandene Stunde bleibt. Die Pocket-Planung kommt an den nächsten freien Platz desselben Tages.',
  },
  {
    id: POCKET_MODI.ANHAENGEN,
    name: 'Pocket-Phasen an die bestehende Stunde anhängen',
    beschreibung: 'Thema, Ziele und Kompetenzen der vorhandenen Stunde bleiben. Nur die Phasen und die Notiz kommen dazu.',
  },
  {
    id: POCKET_MODI.ERSETZEN,
    name: 'Pocketplanung verwenden',
    beschreibung: 'Die vorhandene Planung dieses Termins wird ersetzt. Die Sequenzzuordnung bleibt erhalten.',
  },
];

function pocketTrefferText(treffer){
  if (treffer === 'id') return 'automatisch erkannt';
  if (treffer === 'name') return 'über den Namen erkannt';
  if (treffer === 'neu') return 'im Desktop noch unbekannt – wird angelegt';
  return 'nicht zugeordnet';
}

function PocketEintrag({ eintrag, db, onAendern, onImport, onOpenLesson }){
  const { analyse, ziel, modus, kompetenzen, sprechabsichten, status, ergebnis } = eintrag;
  const zielInfo = pruefeZiel(db, ziel);
  const freierSlot = ziel ? naechsterFreierSlot(db, ziel.weekStart, ziel.dayIndex) : null;

  const zeilen = vorschauZeilen(analyse);
  const konflikt = zielInfo.konflikt;
  const wirklicherModus = konflikt ? modus : POCKET_MODI.NEU;
  const kannImportieren = Boolean(ziel)
    && (!konflikt || (modus !== 'behalten' && (modus !== POCKET_MODI.NEU || freierSlot !== null)));

  if (status === 'importiert') {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <b>{analyse.titel}</b>
          <span className="badge">importiert</span>
        </div>
        <div className="muted small">
          {[analyse.gruppenName, ergebnis?.ziel?.dateISO ? formatDatumLang(ergebnis.ziel.dateISO, { lang: true }) : '',
            ergebnis?.ziel ? `${ergebnis.ziel.slotIndex + 1}. Stunde` : ''].filter(Boolean).join(' · ')}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={()=>onOpenLesson?.(ergebnis.ziel)}>Zur Stunde</button>
          <span className="muted small">Strg+Z nimmt den Import zurück.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="row wrap" style={{ gap: 8 }}>
          <b style={{ fontSize: 'var(--fs-lg)' }}>{analyse.titel}</b>
          {analyse.stunde.kind === 'quick' ? <span className="badge">Schnellplanung</span> : null}
          {analyse.stunde.kind === 'idea' ? <span className="badge">Unterrichtsidee</span> : null}
        </div>
        <div className="muted small">
          {analyse.gruppenName || 'Ohne Lerngruppe'}
          {' · '}
          {pocketTrefferText(analyse.klasse.treffer)}
        </div>
      </div>

      {zeilen.length ? (
        <div className="muted small">{zeilen.join(' · ')}</div>
      ) : null}

      {/* Eine Desktop-Stunde ist auf 45 Minuten aufgeteilt; Pocket lässt
          die Dauer frei. Weicht die Summe ab, gleicht der Desktop die
          letzte Phase an – das soll man vorher wissen, nicht nachher
          bemerken. */}
      {analyse.statistik.phasen && analyse.statistik.minuten !== 45 ? (
        <div className="muted small">
          Die Phasen ergeben {analyse.statistik.minuten} Minuten. Eine Stunde in Prép-ybara
          umfasst 45 Minuten – die letzte Phase wird beim Import entsprechend angepasst.
        </div>
      ) : null}

      {/* Termin – vorbelegt aus der Datei, hier änderbar. Ohne Datum in
          der Datei ist das der Weg zur manuellen Zuordnung. */}
      <div className="row wrap" style={{ gap: 10 }}>
        <label className="grow">
          <span className="small muted">Datum</span>
          <input
            type="date"
            value={ziel?.dateISO || ''}
            onChange={(e)=>onAendern({ ziel: zielFuer(e.target.value, ziel?.lessonNumber || 1) })}
          />
        </label>
        <label>
          <span className="small muted">Stunde</span>
          <select
            value={ziel?.lessonNumber || ''}
            onChange={(e)=>onAendern({ ziel: zielFuer(ziel?.dateISO || '', e.target.value) })}
          >
            <option value="">–</option>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}.</option>)}
          </select>
        </label>
      </div>

      {ziel ? (
        <div className="muted small">{formatDatumLang(ziel.dateISO, { lang: true })} · {ziel.lessonNumber}. Stunde</div>
      ) : (
        <div className="inlineNotice inlineNotice--warning">
          Diese Datei nennt keinen vollständigen Termin. Bitte Datum und Stunde wählen.
        </div>
      )}

      {analyse.bereitsImportiert ? (
        <div className="inlineNotice inlineNotice--warning">
          Dieser Pocket-Entwurf wurde möglicherweise bereits importiert
          {analyse.bereitsImportiert.importedAt
            ? ` (${new Date(analyse.bereitsImportiert.importedAt).toLocaleString('de-DE')})`
            : ''}.
          Ein erneuter Import legt eine zweite Stunde an.
        </div>
      ) : null}

      {konflikt ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="inlineNotice inlineNotice--warning">
            Für diesen Termin existiert bereits eine Planung
            {zielInfo.bestehende?.topic ? `: „${zielInfo.bestehende.topic}“` : ''}.
          </div>
          {POCKET_MODUS_OPTIONEN.map((o)=>{
            const gesperrt = o.id === POCKET_MODI.NEU && freierSlot === null;
            return (
              <label key={o.id} className="row" style={{ gap: 8, alignItems: 'flex-start', opacity: gesperrt ? 0.5 : 1 }}>
                <input
                  type="radio"
                  name={`pocket-modus-${analyse.stunde.externalId}`}
                  checked={modus === o.id}
                  disabled={gesperrt}
                  onChange={()=>onAendern({ modus: o.id })}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <b>{o.name}</b>
                  <span className="muted small" style={{ display: 'block' }}>
                    {o.beschreibung}
                    {o.id === POCKET_MODI.NEU
                      ? (freierSlot === null
                        ? ' An diesem Tag ist kein Platz frei – bitte einen anderen Termin wählen.'
                        : ` Hier: ${freierSlot + 1}. Stunde.`)
                      : ''}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}

      {(analyse.neueKompetenzen.length || analyse.neueSprechabsichten.length) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="small" style={{ fontWeight: 600 }}>Neu aus Pocket</div>
          <div className="muted small">
            Diese Einträge stehen in jedem Fall in der importierten Stunde. Angehakt kommen
            sie zusätzlich dauerhaft in die Bibliothek.
          </div>
          {analyse.neueKompetenzen.map((label)=>(
            <label key={`k-${label}`} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={kompetenzen.includes(label)}
                onChange={(e)=>onAendern({
                  kompetenzen: e.target.checked
                    ? [...kompetenzen, label]
                    : kompetenzen.filter(l => l !== label),
                })}
              />
              <span>Neue Kompetenz: „{label}“ zur Bibliothek hinzufügen</span>
            </label>
          ))}
          {analyse.neueSprechabsichten.map((label)=>(
            <label key={`s-${label}`} className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={sprechabsichten.includes(label)}
                onChange={(e)=>onAendern({
                  sprechabsichten: e.target.checked
                    ? [...sprechabsichten, label]
                    : sprechabsichten.filter(l => l !== label),
                })}
              />
              <span>Neue Sprechabsicht: „{label}“ zur Bibliothek hinzufügen</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn primary"
          disabled={!kannImportieren}
          onClick={()=>onImport(wirklicherModus)}
        >Importieren</button>
        {konflikt && modus === 'behalten' ? (
          <span className="muted small">Es wird nichts importiert – die Desktopplanung bleibt.</span>
        ) : null}
      </div>
    </div>
  );
}

function PocketImportView({ db, todayISO, onImport, onOpenLesson, onExportProfile }){
  const [eintraege, setEintraege] = useState([]);
  const [quelle, setQuelle] = useState('');
  const [fehler, setFehler] = useState('');
  const [ueberDatei, setUeberDatei] = useState(false);

  const lies = useCallback((name, inhalt)=>{
    setQuelle(name || '');
    try {
      /* Ein versehentlich abgelegtes Profil ist der wahrscheinlichste
         Irrtum – dafür lohnt eine eigene, klare Auskunft. */
      let vorab = null;
      try { vorab = JSON.parse(String(inhalt || '')); } catch {}
      if (vorab && vorab.format === FORMAT_PROFILE) {
        setEintraege([]);
        setFehler('Das ist ein Pocket-Profil, keine Stunde. Profile gehen von hier nach Pocket, nicht umgekehrt.');
        return;
      }
      const stunden = leseStundenDatei(inhalt);
      setEintraege(stunden.map((s)=>{
        const analyse = analysierePocketStunde(s, db, { todayISO });
        return {
          analyse,
          ziel: analyse.ziel,
          modus: 'behalten',
          kompetenzen: [],
          sprechabsichten: [],
          status: 'offen',
          ergebnis: null,
        };
      }));
      setFehler('');
    } catch (err) {
      setEintraege([]);
      setFehler(fehlertext(err, 'Diese Datei ist kein gültiger Prép-ybara-Pocket-Export.'));
    }
  }, [db, todayISO]);

  const waehleDatei = async ()=>{
    try {
      const datei = await platform.importPocketFile?.();
      if (!datei) return;
      lies(datei.name, datei.content);
    } catch (err) {
      setFehler(String(err?.message || err));
    }
  };

  const beiDrop = async (e)=>{
    e.preventDefault();
    setUeberDatei(false);
    const datei = e.dataTransfer?.files?.[0];
    if (!datei) return;
    try { lies(datei.name, await datei.text()); }
    catch { setFehler('Die Datei konnte nicht gelesen werden.'); }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 className="dialogTitle">Import aus Prép-ybara Pocket</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Pocket erfasst unterwegs, Prép-ybara organisiert. Der Austausch läuft über
          Dateien – es gibt keine Verbindung zwischen Telefon und PC.
        </p>
      </div>

      <div
        className={`pocketDrop${ueberDatei ? ' is-over' : ''}`}
        onDragOver={(e)=>{ e.preventDefault(); setUeberDatei(true); }}
        onDragLeave={()=>setUeberDatei(false)}
        onDrop={beiDrop}
      >
        <div style={{ fontWeight: 600 }}>Datei hierher ziehen</div>
        <div className="muted small">.prepybara-lesson oder .prepybara-lessons</div>
        {capabilities.pocketFiles ? (
          <button className="btn primary" onClick={waehleDatei}>Datei auswählen …</button>
        ) : null}
      </div>

      {quelle ? <div className="muted small">Gelesen: {quelle}</div> : null}

      {fehler ? <div className="inlineNotice inlineNotice--warning">{fehler}</div> : null}

      {eintraege.map((eintrag, index)=>(
        <PocketEintrag
          key={eintrag.analyse.stunde.externalId || index}
          eintrag={eintrag}
          db={db}
          onAendern={(patch)=>setEintraege(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e))}
          onOpenLesson={onOpenLesson}
          onImport={(modus)=>{
            const ergebnis = onImport({
              analyse: eintrag.analyse,
              /* Ausgewichen wird nur bei einem echten Konflikt. Eine
                 leere Stundenhülle am Zieltermin ist kein Grund, den
                 gewählten Termin zu verlassen. */
              ziel: modus === POCKET_MODI.NEU && pruefeZiel(db, eintrag.ziel).konflikt
                ? { ...eintrag.ziel, slotIndex: naechsterFreierSlot(db, eintrag.ziel.weekStart, eintrag.ziel.dayIndex) }
                : eintrag.ziel,
              modus,
              kompetenzen: eintrag.kompetenzen,
              sprechabsichten: eintrag.sprechabsichten,
            });
            if (ergebnis) {
              setEintraege(prev => prev.map((e, i) => i === index
                ? { ...e, status: 'importiert', ergebnis }
                : e));
            }
          }}
        />
      ))}

      <section>
        <h3 className="settingsHeading">Profil für Pocket</h3>
        <p className="settingsText">
          Das Profil bringt Lerngruppen, Fächer, Stundenplan, Kompetenzen und
          Sprechabsichten auf das Telefon – damit Pocket dieselben Kennungen benutzt
          wie diese App. Schülerdaten, Noten und Nachbereitungen sind nicht enthalten.
        </p>
        {capabilities.pocketFiles ? (
          <button className="btn" onClick={onExportProfile}>Pocket-Profil exportieren …</button>
        ) : (
          <div className="inlineNotice">
            Der Profil-Export braucht einen Dateizugriff, den diese Umgebung nicht anbietet.
          </div>
        )}
      </section>
    </div>
  );
}

function ensureDbShape(raw){
  const db = (raw && typeof raw === 'object') ? raw : {};
  if (!('schemaVersion' in db)) db.schemaVersion = 1;
  if (!db.socialForms || typeof db.socialForms !== 'object') db.socialForms = {};
  // Phase names (Phasenname) suggestions
  if (!db.phaseNames || typeof db.phaseNames !== 'object') db.phaseNames = {};
  if (!db.competencies || typeof db.competencies !== 'object') db.competencies = {};
  /* Eigene Sprechabsichten und Bezeichnungen von Hilfen. Bewusst
     dieselbe Bauart wie db.competencies: eine Nutzungsablage, aus der
     sich Vorschläge, Wiederverwendung und die Verwaltung ergeben. Es
     kommt keine zweite Bibliotheksarchitektur hinzu. */
  if (!db.speechActs || typeof db.speechActs !== 'object') db.speechActs = {};
  if (!db.scaffoldLabels || typeof db.scaffoldLabels !== 'object') db.scaffoldLabels = {};
  if (!db.classGroups || typeof db.classGroups !== 'object') db.classGroups = {};
  if (!db.subjects || typeof db.subjects !== 'object') db.subjects = {};
  // Hidden suggestions (user can remove unwanted ones via the dropdown "x")
  if (!db.hiddenSuggestions || typeof db.hiddenSuggestions !== 'object') {
    db.hiddenSuggestions = {
      socialForms: {},
      phaseNames: {},
      classGroups: {},
      subjects: {},
      competencies: {},
      speechActs: {},
      scaffoldLabels: {},
      supervisionLabels: {}
    };
  } else {
    if (!db.hiddenSuggestions.socialForms || typeof db.hiddenSuggestions.socialForms !== 'object') db.hiddenSuggestions.socialForms = {};
    if (!db.hiddenSuggestions.phaseNames || typeof db.hiddenSuggestions.phaseNames !== 'object') db.hiddenSuggestions.phaseNames = {};
    if (!db.hiddenSuggestions.classGroups || typeof db.hiddenSuggestions.classGroups !== 'object') db.hiddenSuggestions.classGroups = {};
    if (!db.hiddenSuggestions.subjects || typeof db.hiddenSuggestions.subjects !== 'object') db.hiddenSuggestions.subjects = {};
    if (!db.hiddenSuggestions.competencies || typeof db.hiddenSuggestions.competencies !== 'object') db.hiddenSuggestions.competencies = {};
    if (!db.hiddenSuggestions.speechActs || typeof db.hiddenSuggestions.speechActs !== 'object') db.hiddenSuggestions.speechActs = {};
    if (!db.hiddenSuggestions.scaffoldLabels || typeof db.hiddenSuggestions.scaffoldLabels !== 'object') db.hiddenSuggestions.scaffoldLabels = {};
    if (!db.hiddenSuggestions.supervisionLabels || typeof db.hiddenSuggestions.supervisionLabels !== 'object') db.hiddenSuggestions.supervisionLabels = {};
  }

// groupColors: mapping "<class>|<subject>" -> pastel color
  if (!db.groupColors || typeof db.groupColors !== 'object') db.groupColors = {};
  if (!db.supervisionLabels || typeof db.supervisionLabels !== 'object') db.supervisionLabels = {};
  if (!Array.isArray(db.todos)) db.todos = [];
  if (!db.sequences || typeof db.sequences !== 'object') db.sequences = {};
  if (!db.sequenceTemplates || typeof db.sequenceTemplates !== 'object') db.sequenceTemplates = {};
  // Jahresgrobplanung (Orientierungs-Balken): wird in der Einzelstundenansicht nur angezeigt,
  // hat KEINEN Einfluss auf Unterrichtssequenzen und wird NICHT in Verlaufspläne/Exports übernommen.
  if (!Array.isArray(db.yearBars)) db.yearBars = [];
  /* Zeilen der Jahresplanung, die auch OHNE Balken sichtbar bleiben
     sollen ("Jahresplanung leeren"). Ohne diese Liste ergaben sich die
     Zeilen allein aus den Balken – eine geleerte Zeile verschwand
     damit sofort wieder. Fehlt die Liste, verhält sich alles wie
     bisher: die Zeilen kommen aus den Balken. */
  if (!Array.isArray(db.yearPlanLanes)) db.yearPlanLanes = [];
  if (!db.schoolCalendar || typeof db.schoolCalendar !== 'object') {
    db.schoolCalendar = {
      schoolYear: { startISO: '', endISO: '' },
      lessonTimesEnabled: false,
      lessonTimes: [],
      vacations: [],
      freeDays: [],
      events: []
    };
  } else {
    if (!db.schoolCalendar.schoolYear) db.schoolCalendar.schoolYear = { startISO: '', endISO: '' };
    if (!('lessonTimesEnabled' in db.schoolCalendar)) db.schoolCalendar.lessonTimesEnabled = false;
    if (!Array.isArray(db.schoolCalendar.lessonTimes)) db.schoolCalendar.lessonTimes = [];
    if (!Array.isArray(db.schoolCalendar.vacations)) db.schoolCalendar.vacations = [];
    if (!Array.isArray(db.schoolCalendar.freeDays)) db.schoolCalendar.freeDays = [];
    if (!Array.isArray(db.schoolCalendar.events)) db.schoolCalendar.events = [];
  }
  if (!db.weeks || typeof db.weeks !== 'object') db.weeks = {};
  /* --- Migration auf Schema 9: Planungsprofil je Stunde ---------------

     Vor dieser Fassung kannte eine Stunde kein Planungsprofil. Sie
     bekommt hier "standard" – also genau die Felder, die sie ohnehin
     schon hatte, ergänzt um die neuen als leere Ergänzung. Es wird
     nichts umgeschrieben, nichts umbenannt und nichts entfernt: die
     Phasen selbst bleiben Zeichen für Zeichen, wie sie waren.

     Bewusst OHNE Versionsabfrage, wie jede andere Formangleichung hier
     auch. Der Grund ist konkret: beim Einlesen eines Backups hebt der
     Hauptprozess die Schemakennzeichnung bereits an, bevor diese
     Funktion sie zu sehen bekommt. Eine Migration hinter `if (version <
     9)` liefe für genau diesen Weg nie – die Stunden aus einem älteren
     Backup blieben ohne Profil zurück.

     Die Angleichung ist verlustfrei und beliebig oft wiederholbar: eine
     Stunde, die bereits ein Profil trägt, wird nicht angefasst. */
  const setzePlanungsprofil = (l) => {
    if (!l || typeof l !== 'object') return;
    if (!l.planningProfile) l.planningProfile = STANDARD_PROFIL;
  };
  for (const w of Object.values(db.weeks || {})){
    for (const l of Object.values(w?.lessons || {})) setzePlanungsprofil(l);
  }
  for (const t of Object.values(db.sequenceTemplates || {})){
    for (const l of (Array.isArray(t?.lessons) ? t.lessons : [])) setzePlanungsprofil(l);
  }

  // Die Formangleichung oben läuft unabhängig von der Version; versionsabhängige
  // Migrationen gehören vor diesen Clamp.
  if (db.schemaVersion < SCHEMA_VERSION) db.schemaVersion = SCHEMA_VERSION;

  // Normalize Jahresgrobplanung-Balken
  db.yearBars = (Array.isArray(db.yearBars) ? db.yearBars : []).map(b => {
    const o = (b && typeof b === 'object') ? b : null;
    if (!o) return null;
    const id = o.id || uid();
    const color = (o.color || '').trim() || SEQ_COLORS[Math.abs(hashCode(id)) % SEQ_COLORS.length];
    const startISO = (o.startISO || '').toString();
    const endISO = (o.endISO || '').toString();
    return {
      id,
      title: (o.title || o.name || '').toString(),
      classGroup: (o.classGroup || '').toString(),
      subject: (o.subject || '').toString(),
      startISO,
      endISO,
      color,
      /* Schema 10: die optionale Verknüpfung mit einer Sequenz.

         Gespeichert wird ausschliesslich die Kennung – nie eine Kopie
         der Sequenz. Fehlt die Angabe (jeder Balken aus einer früheren
         Fassung), entsteht der leere Text: der Balken ist dann
         unverknüpft und verhält sich exakt wie bisher. */
      sequenceId: (o.sequenceId || '').toString().trim(),
      createdAt: o.createdAt || new Date().toISOString(),
      updatedAt: o.updatedAt || o.createdAt || new Date().toISOString()
    };
  }).filter(Boolean);

  db.yearPlanLanes = (Array.isArray(db.yearPlanLanes) ? db.yearPlanLanes : [])
    .map(l => {
      const o = (l && typeof l === 'object') ? l : null;
      if (!o) return null;
      return {
        classGroup: String(o.classGroup || '').trim(),
        subject: String(o.subject || '').trim(),
      };
    })
    .filter(Boolean)
    .filter((l, i, arr)=> arr.findIndex(x => x.classGroup === l.classGroup && x.subject === l.subject) === i);

  // Normalize weeks (ensure lessons/duties objects exist)
  for (const [ws, w] of Object.entries(db.weeks || {})){
    if (!w || typeof w !== 'object') { db.weeks[ws] = { slotsPerDay: 6, lessons: {}, duties: {} }; continue; }
    if (!('slotsPerDay' in w)) w.slotsPerDay = 6;
    if (!w.lessons || typeof w.lessons !== 'object') w.lessons = {};
    if (!w.duties || typeof w.duties !== 'object') w.duties = {};
  }


  // Normalize sequences (ensure id/color)
  for (const [id, s] of Object.entries(db.sequences)){
    if (!s || typeof s !== 'object') { db.sequences[id] = { id, name: String(id), color: SEQ_COLORS[0] }; continue; }
    if (!s.id) s.id = id;
    if (!s.name) s.name = String(id);
    if (!s.color) s.color = SEQ_COLORS[Math.abs(hashCode(id)) % SEQ_COLORS.length];
    /* Schwerpunkt der Sequenz – dieselbe Form wie in der Stunde, damit
       beides mit denselben Bausteinen bearbeitet werden kann. Stunden
       dürfen davon abweichen; die Sequenz gibt nichts vor. */
    if (!Array.isArray(s.competencies)) s.competencies = [];
    s.competencies = s.competencies.map(x => String(x || '').trim()).filter(Boolean);
    s.primaryCompetency = String(s.primaryCompetency || '').trim();
    /* Zielaufgabe der Sequenz. Dieselbe Form wie die kommunikative
       Aufgabe einer Stunde – dieselben Bausteine bearbeiten beides. */
    s.finalTask = normalisiereAufgabe(s.finalTask);
  }

  /* Vorlagen angleichen.

     Rein additiv: die beschreibenden Angaben der Bibliothek entstehen
     leer, die Einheiten bekommen die Spanne 1 (Einzelstunde). Eine
     Vorlage aus einer früheren Fassung bleibt dadurch unverändert
     einsetzbar – sie zeigt in der Bibliothek nur weniger. */
  for (const [id, t] of Object.entries(db.sequenceTemplates)){
    db.sequenceTemplates[id] = normalisiereVorlage(t, id);
  }

// Normalize group colors (Lerngruppe = Klasse||Fach)
for (const [k, v] of Object.entries(db.groupColors || {})){
  if (!v || typeof v !== 'object') { db.groupColors[k] = { color: defaultGroupColor(k) }; continue; }
  if (!v.color) v.color = defaultGroupColor(k);
}

// Normalize todos
db.todos = (Array.isArray(db.todos) ? db.todos : []).map(t => {
  const obj = (t && typeof t === 'object') ? t : null;
  if (!obj) return null;
  return {
    id: obj.id || uid(),
    text: (obj.text || '').toString(),
    done: Boolean(obj.done),
    dateISO: (obj.dateISO || '').toString(),
    deadlineISO: (obj.deadlineISO || '').toString(),
    weekStartISO: (obj.weekStartISO || '').toString(),
    createdAt: obj.createdAt || new Date().toISOString()
  };
}).filter(Boolean);

  // --- Schuljahres-Archiv & Wechsel-Metadaten ---
  if (!Array.isArray(db.schoolYearArchives)) db.schoolYearArchives = [];
  db.schoolYearArchives = db.schoolYearArchives
    .map(a => {
      const o = (a && typeof a === 'object') ? a : null;
      if (!o) return null;
      const sy = (o.schoolCalendar && o.schoolCalendar.schoolYear) ? o.schoolCalendar.schoolYear : (o.schoolYear || {});
      return {
        id: o.id || uid(),
        label: (o.label || '').toString(),
        startISO: (o.startISO || sy.startISO || '').toString(),
        endISO: (o.endISO || sy.endISO || '').toString(),
        archivedAt: o.archivedAt || new Date().toISOString(),
        data: (o.data && typeof o.data === 'object') ? o.data : {}
      };
    })
    .filter(Boolean);

  if (!db.schoolYearRollover || typeof db.schoolYearRollover !== 'object') {
    db.schoolYearRollover = { dismissedEndISO: '', snoozeUntilISO: '', lastPromptISO: '' };
  } else {
    db.schoolYearRollover.dismissedEndISO = (db.schoolYearRollover.dismissedEndISO || '').toString();
    db.schoolYearRollover.snoozeUntilISO = (db.schoolYearRollover.snoozeUntilISO || '').toString();
    db.schoolYearRollover.lastPromptISO = (db.schoolYearRollover.lastPromptISO || '').toString();
  }

  // --- App-Einstellungen (optional) ---
  if (!db.appSettings || typeof db.appSettings !== 'object') db.appSettings = {};
  // Opt-in: Dateien beim Anhängen in App-Ordner kopieren
  db.appSettings.fileCopyOptIn = Boolean(db.appSettings.fileCopyOptIn);
  // Darstellung: hell | dunkel | system. Unbekanntes fällt auf System zurück.
  if (!THEME_CHOICES.includes(db.appSettings.theme)) db.appSettings.theme = 'system';
  // Wochenabschluss: standardmässig an, dauerhaft abschaltbar.
  if (typeof db.appSettings.weekReview !== 'boolean') db.appSettings.weekReview = true;
  /* Fremdsprachenmodus: bei bestehenden wie bei neuen Installationen aus.
     Er schaltet ausschliesslich die Darstellung der Kompetenzauswahl um –
     an den gespeicherten Kompetenzen ändert er nichts. */
  if (typeof db.appSettings.languageMode !== 'boolean') db.appSettings.languageMode = false;

  /* Standard-Planungsprofil für NEUE Stunden. Bestehende Stunden tragen
     ihr eigenes Profil und werden davon nie berührt – das ist der ganze
     Sinn der Angabe je Stunde. */
  db.appSettings.defaultPlanningProfile = normalisiereProfilId(db.appSettings.defaultPlanningProfile);

  /* Unterrichtszeiten: Wochenvorlagen und Stundenplanmodelle.

     Schema 11, rein additiv: Eine Datenbank ohne diese Felder bekommt
     leere Ablagen und verhält sich unverändert. Eine einzelne, als
     Standard gekennzeichnete Vorlage aus einem früheren Stand wird
     dabei zu einem Ein-Wochen-Modell – dieselbe Sache, nur mit einem
     Rahmen darum. */
  normalisiereStundenplandaten(db);

  /* Der Stand der Einführung. Rein additiv und rückwärtsverträglich:
     Eine Datenbank aus einer früheren Fassung kennt das Feld nicht und
     bekommt hier den Anfangszustand. Ob die Einführung tatsächlich
     erscheint, entscheidet nicht dieses Feld, sondern die Frage, ob
     schon geplant wurde. */
  db.appSettings.onboarding = normalisiereOnboarding(db.appSettings.onboarding);

  /* Das eigene Exportlayout liegt bewusst hier und nicht in der Stunde:
     wer sich seine Spalten einmal eingerichtet hat, will sie in jeder
     Stunde wiederfinden. Welches Layout eine Stunde zuletzt benutzt hat,
     steht dagegen in der Stunde (preferredExportLayout). */
  db.appSettings.customExportLayout = normalisiereEigenesLayout(db.appSettings.customExportLayout);

  /* Der gespeicherte Teil des Kompetenzkatalogs.

     Rein additiv: fehlt das Feld, entsteht ein leeres Modell, und die App
     verhält sich wie zuvor. Die Kompetenzen der Stunden werden NICHT
     angefasst – sie bleiben Etiketten, so wie sie seit der ersten Fassung
     gespeichert sind. Damit ist dieser Schritt für sich genommen
     verlustfrei und beliebig oft wiederholbar. */
  db.competencyModel = normalisiereModell(db.competencyModel);

  return db;
}


function hashCode(str){
  let h = 0;
  for (let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
  return h;
}


function useDB(){
  const [db, setDb] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const saveTimer = useRef(null);


  useEffect(()=> {
    let cancelled = false;
    (async ()=>{
      // Ein Ladeweg für beide Plattformen. Liefert die Ablage nichts
      // (Erststart), erzeugt ensureDbShape die vollständige Grundform –
      // dieselbe Normalisierung, die auch Bestandsdaten durchlaufen.
      const loaded = await platform.loadDB();
      if (!cancelled) setDb(ensureDbShape(loaded || {}));
    })();
    return ()=> { cancelled = true; };
  }, []);

  const persist = (nextDb) => {
    setDb(nextDb);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>{
      // Bewusst nicht erwartet: der Schreibvorgang läuft asynchron weiter
      // und darf die Eingabe nicht aufhalten. Ein Fehlschlag wird als
      // Zustand nach oben gereicht – die Meldung gehört in die App, hier
      // ist sie nicht im Gültigkeitsbereich.
      platform.saveDB(nextDb)
        .then(()=> setSaveError(null))
        .catch((err)=> setSaveError(String(err?.message || err)));
    }, 250);
  };

  return { db, persist, saveError };
}

export default function App(){
  const { db: liveDb, persist: persistLive, saveError } = useDB();

  /* --- Aktuelles Schuljahr oder Archiv ------------------------------

     Es gibt genau eine Quelle, aus der die Ansichten lesen: `db`.
     Normalerweise sind das die echten Daten; in der Archivansicht der
     Abzug des gewählten Schuljahres.

     Geschrieben wird IMMER nur in die echten Daten – und in der
     Archivansicht gar nicht. Der Riegel dafür liegt nicht in den
     Schaltflächen, sondern in `persist`: dort kommt jede Änderung
     vorbei, von der Stundenplanung bis zum Rückgängig. Damit kann
     keine Ansicht versehentlich in ein Archiv schreiben, auch wenn ihr
     jemand später eine Schaltfläche hinzufügt. */
  const [archivAnsicht, setArchivAnsicht] = useState(null); // { id, zurueckZu }

  const archiv = useMemo(()=>{
    const id = archivAnsicht?.id;
    if (!id) return null;
    const liste = Array.isArray(liveDb?.schoolYearArchives) ? liveDb.schoolYearArchives : [];
    return liste.find(a => a?.id === id) || null;
  }, [archivAnsicht?.id, liveDb?.schoolYearArchives]);

  const archivDb = useMemo(
    ()=> (archiv ? archivDatenbank(archiv, liveDb) : null),
    [archiv, liveDb]
  );

  /* Ab hier ist `db` die Quelle für ALLE Ansichten. */
  const db = archiv ? archivDb : liveDb;
  const imArchiv = Boolean(archiv);

  /* Der Riegel. Die Meldung kommt über eine Referenz, weil showToast
     erst weiter unten entsteht – der Riegel selbst muss aber vor jeder
     Schreibstelle stehen. */
  const archivHinweisRef = useRef(()=>{});
  const persist = useCallback((nextDb)=>{
    if (archiv) {
      archivHinweisRef.current?.();
      return;
    }
    persistLive(nextDb);
  }, [archiv, persistLive]);
  // Show a large logo once when the app starts (helps users recognize the app).
  const [splashVisible, setSplashVisible] = useState(true);
  const [easterEggVisible, setEasterEggVisible] = useState(false);
  const easterEggTimer = useRef(null);
  // Holds the latest (possibly unsaved) topic while the user is editing an Einzelstunde.
  // Used so the easter egg can trigger reliably when the user goes back to the timetable.
  const lessonDraftTopicRef = useRef('');

  // Cache ephemeral draft lessons (so opening an empty slot doesn't regenerate IDs every render).
  // These drafts are NOT persisted until the user actually changes something.
  const draftLessonCacheRef = useRef(new Map());

  /* Eigener Zustand, bewusst nicht splashVisible wiederverwendet: an
     dessen Ende hängen der To-do-Hinweis und die Schuljahresabfrage.
     Ein wiederholtes Startbild darf diese Abläufe nicht anstossen. */
  const [splashReplay, setSplashReplay] = useState(false);
  const splashReplayTimer = useRef(null);
  const versteckeSplashReplay = ()=>{
    if (splashReplayTimer.current) { clearTimeout(splashReplayTimer.current); splashReplayTimer.current = null; }
    setSplashReplay(false);
  };
  const zeigeSplashReplay = ()=>{
    if (splashReplayTimer.current) clearTimeout(splashReplayTimer.current);
    setSplashReplay(true);
    splashReplayTimer.current = setTimeout(()=>{ splashReplayTimer.current = null; setSplashReplay(false); }, 1800);
  };
  useEffect(()=>()=>{ if (splashReplayTimer.current) clearTimeout(splashReplayTimer.current); }, []);

  const triggerEasterEgg = ()=>{
    try {
      if (easterEggTimer.current) clearTimeout(easterEggTimer.current);
      setEasterEggVisible(true);
      // Keep the easter egg visible long enough to notice (matches the splash duration).
      easterEggTimer.current = setTimeout(()=>setEasterEggVisible(false), 3000);
    } catch {}
  };

  const initialWeekStart = toISODate(startOfWeekMonday(new Date()));
  const initialViewName = (()=>{
    try {
      const params = new URLSearchParams(window.location.search || '');
      const v = (params.get('view') || '').trim().toLowerCase();
      if (v === 'help') return 'help';
      if (v === 'execution') return 'execution';
    } catch {}
    return 'week';
  })();
  const isHelpOnlyWindow = initialViewName === 'help';
  const isExecutionOnlyWindow = initialViewName === 'execution';
  const [view, setView] = useState({ name: initialViewName, weekStart: initialWeekStart });
  // Global Sequenz-Manager (wird von "Sequenzen verwalten" UND "+ Neue Sequenz…" verwendet)
  const [seqManagerModal, setSeqManagerModal] = useState({ open:false, nonce:0, afterCreate:null, autoCloseOnCreate:false });
  const openSequenceManagerModal = (afterCreate, opts = {}) => {
    const autoCloseOnCreate = (typeof opts?.autoCloseOnCreate === 'boolean') ? opts.autoCloseOnCreate : (typeof afterCreate === 'function');
    setSeqManagerModal({ open:true, nonce: Date.now(), afterCreate: (typeof afterCreate === 'function') ? afterCreate : null, autoCloseOnCreate });
  };
  const closeSequenceManagerModal = () => {
    setSeqManagerModal({ open:false, nonce: Date.now(), afterCreate:null, autoCloseOnCreate:false });
  };

  // Backwards-compatible alias (older call sites used "create sequence" wording)
  const openCreateSequenceModal = openSequenceManagerModal;
  const closeCreateSequenceModal = closeSequenceManagerModal;

  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [todoReminderVisible, setTodoReminderVisible] = useState(false);
  const todoReminderGuard = useRef('');
  const [showWeekCopyDialog, setShowWeekCopyDialog] = useState(false);
  const [colorPalette, setColorPalette] = useState({ visible:false, key:'', label:'' });
  const [schoolYearDialog, setSchoolYearDialog] = useState({ visible:false, reason:'', oldLabel:'', oldStartISO:'', oldEndISO:'', newStartISO:'', newEndISO:'', keepColors:true, keepTodos:false });

  // --- Stunden: interne Zwischenablage (Copy/Cut/Paste) ---
  // Hinweis: absichtlich NICHT das OS-Clipboard, damit Inhalte strukturiert bleiben.
  // { lesson, source?:{weekStart, dayIndex, slotIndex}, cut?:boolean, copiedAt }
  const [lessonClipboard, setLessonClipboard] = useState(null);

  const openGroupColorPalette = (key, label) => {
    const k = (key || '').trim();
    if (!k) return;
    setColorPalette({ visible:true, key: k, label: (label || '').trim() });
  };

  const closeGroupColorPalette = () => setColorPalette({ visible:false, key:'', label:'' });

  const makeSchoolYearLabel = (startISO, endISO) => {
    const s = (startISO || '').trim();
    const e = (endISO || '').trim();
    if (!s && !e) return 'Schuljahr';
    const sy = s ? fromISODate(s).getFullYear() : null;
    const ey = e ? fromISODate(e).getFullYear() : null;
    if (sy && ey) {
      if (sy === ey) return `Schuljahr ${sy}`;
      // typical format: 2025/26
      const short = String(ey).slice(-2);
      return `Schuljahr ${sy}/${short}`;
    }
    if (sy) return `Schuljahr ab ${sy}`;
    if (ey) return `Schuljahr bis ${ey}`;
    return 'Schuljahr';
  };

  const openNewSchoolYearDialog = ({ reason = 'manual' } = {}) => {
    if (!db) return;
    const oldStartISO = (db.schoolCalendar?.schoolYear?.startISO || '').trim();
    const oldEndISO = (db.schoolCalendar?.schoolYear?.endISO || '').trim();
    const oldLabel = makeSchoolYearLabel(oldStartISO, oldEndISO);

    const todayISO = toISODate(new Date());
    const baseNewStartISO = oldEndISO ? addDaysISO(oldEndISO, 1) : todayISO;
    const baseNewEndISO = addDaysISO(baseNewStartISO, 364);

    setSchoolYearDialog({
      visible: true,
      reason,
      oldLabel,
      oldStartISO,
      oldEndISO,
      newStartISO: baseNewStartISO,
      newEndISO: baseNewEndISO,
      keepColors: true,
      keepTodos: false
    });
  };

  const archiveAndStartNewSchoolYear = ({ newStartISO, newEndISO, keepColors, keepTodos } = {}) => {
    if (!db) return;
    const ns = (newStartISO || '').trim();
    const ne = (newEndISO || '').trim();
    if (!ns || !ne) { showToast('Bitte Start- und Enddatum des neuen Schuljahres angeben.', { tone: 'warning' }); return; }
    if (ne < ns) { showToast('Das Enddatum muss nach dem Startdatum liegen.', { tone: 'warning' }); return; }

    const nextDb = deepClone(db);

    const oldCal = nextDb.schoolCalendar || { schoolYear:{startISO:'', endISO:''}, vacations:[], freeDays:[], events:[] };
    const oldSY = oldCal.schoolYear || { startISO:'', endISO:'' };
    const label = makeSchoolYearLabel(oldSY.startISO, oldSY.endISO);

    if (!Array.isArray(nextDb.schoolYearArchives)) nextDb.schoolYearArchives = [];
    nextDb.schoolYearArchives.unshift({
      id: uid(),
      label,
      startISO: (oldSY.startISO || '').trim(),
      endISO: (oldSY.endISO || '').trim(),
      archivedAt: new Date().toISOString(),
      data: {
        schoolCalendar: oldCal,
        weeks: nextDb.weeks || {},
        sequences: nextDb.sequences || {},
        todos: Array.isArray(nextDb.todos) ? nextDb.todos : [],
        groupColors: nextDb.groupColors || {},
        supervisionLabels: nextDb.supervisionLabels || {},
        /* Die Jahresgrobplanung gehört zum Schuljahr: ihre Balken
           liegen auf dessen Wochen. Sie wandert deshalb mit ins Archiv
           und startet im neuen Jahr leer – vorher blieb sie stehen und
           rutschte an den Anfang des neuen Jahres. Ältere Archive
           tragen sie nicht; die Archivansicht kommt damit zurecht. */
        yearBars: Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [],
        yearPlanLanes: Array.isArray(nextDb.yearPlanLanes) ? nextDb.yearPlanLanes : []
      }
    });

    // Reset year-specific planning data
    nextDb.weeks = {};
    nextDb.sequences = {};
    nextDb.yearBars = [];
    nextDb.yearPlanLanes = [];
    nextDb.schoolCalendar = {
      schoolYear: { startISO: ns, endISO: ne },
      vacations: [],
      freeDays: [],
      events: []
    };
    if (!keepColors) nextDb.groupColors = {};
    nextDb.todos = keepTodos ? (Array.isArray(nextDb.todos) ? nextDb.todos.filter(t => t && !t.done) : []) : [];

    // Reset rollover meta so the dialog won't pop up again for the previous year end date
    nextDb.schoolYearRollover = { dismissedEndISO: '', snoozeUntilISO: '', lastPromptISO: '' };

    persist(nextDb);

    // Jump to the first week of the new school year
    try {
      const monday = startOfWeekMonday(fromISODate(ns));
      setSelectedDate(ns);
      setView({ name: 'week', weekStart: toISODate(monday) });
    } catch {}

    setSchoolYearDialog({ visible:false, reason:'', oldLabel:'', oldStartISO:'', oldEndISO:'', newStartISO:'', newEndISO:'', keepColors:true, keepTodos:false });
  };

  /* --- Archivansicht: hinein und wieder heraus ---------------------- */

  /* `ziel`: wohin es im Archiv gehen soll. Ohne Angabe beginnt der Blick
     dort, wo es etwas zu sehen gibt – mit Angabe (etwa aus der Suche)
     direkt bei dem gefundenen Inhalt. Geschrieben wird im Archiv in
     keinem Fall. */
  const oeffneArchiv = (archivId, ziel = null) => {
    const liste = Array.isArray(liveDb?.schoolYearArchives) ? liveDb.schoolYearArchives : [];
    const gewaehlt = liste.find(a => a?.id === archivId);
    if (!gewaehlt) { showToast('Dieses archivierte Schuljahr wurde nicht gefunden.', { tone: 'warning' }); return; }
    // Wo es Wochen gibt, beginnt der Blick dort; sonst im Kalender.
    const hatWochen = archivKennzahlen(gewaehlt).wochen > 0;
    /* Gemerkt wird, wo man herkam – der Rückweg soll dorthin führen
       und nicht irgendwohin. */
    /* Wer von einem Archiv ins nächste wechselt, soll am Ende dort
       herauskommen, wo er ursprünglich war – nicht in einer
       archivierten Woche. */
    setArchivAnsicht(prev => (prev
      ? { ...prev, id: archivId }
      : { id: archivId, zurueckZu: { ...view }, zurueckDatum: selectedDate }));
    const wochen = Object.keys(archivAbzug(gewaehlt).weeks || {});
    wochen.sort();
    const start = wochen[0] || (gewaehlt.startISO || toISODate(new Date()));
    const ws = (()=>{
      try { return toISODate(startOfWeekMonday(fromISODate(start))); } catch { return toISODate(startOfWeekMonday(new Date())); }
    })();
    setSelectedDate(ziel?.weekStart || start);
    setView(ziel || (hatWochen ? { name:'week', weekStart: ws } : { name:'calendar', weekStart: ws }));
    showToast(`Archivansicht: ${gewaehlt.label || 'Schuljahr'}. Änderungen sind hier nicht möglich.`, { ttl: 7000 });
  };

  const verlasseArchiv = () => {
    const zurueck = archivAnsicht?.zurueckZu;
    const zurueckDatum = archivAnsicht?.zurueckDatum;
    setArchivAnsicht(null);
    if (zurueckDatum) setSelectedDate(zurueckDatum);
    /* Keine Daten wandern zurück – es wird nur wieder auf die
       aktuellen Daten geschaut. */
    setView(zurueck && zurueck.name ? zurueck : { name:'week', weekStart: toISODate(startOfWeekMonday(new Date())) });
  };

  /* Ein Archiv als Backup-Datei ausgeben.

     Bewusst dieselbe Form wie ein normales Backup: eine vollständige
     Datenbank, die nur dieses eine Schuljahr enthält. Damit lässt sie
     sich mit "Backup importieren" öffnen – es entsteht kein zweites,
     unverträgliches Dateiformat. */
  const exportiereArchiv = async (archivId) => {
    const liste = Array.isArray(liveDb?.schoolYearArchives) ? liveDb.schoolYearArchives : [];
    const gewaehlt = liste.find(a => a?.id === archivId);
    if (!gewaehlt) return;
    if (!capabilities.archiveFiles) {
      showToast('Der Archiv-Export ist in dieser Fassung nicht verfügbar.', { tone: 'warning' });
      return;
    }
    /* Bewusst OHNE die aktuellen Daten: die Datei soll dieses eine
       Schuljahr enthalten, nicht nebenbei die Vorlagenbibliothek und
       die Einstellungen des laufenden Betriebs. Was dem Abzug fehlt,
       ergänzt ensureDbShape leer – die Datei bleibt ein vollständiges,
       einlesbares Backup. */
    const inhalt = archivDatenbank(gewaehlt, {});
    const name = `Prepybara-${String(gewaehlt.label || 'Schuljahr').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '-')}.json`;
    try {
      const gespeichert = await platform.exportArchive({ data: inhalt, suggestedFileName: name });
      if (typeof gespeichert === 'string') toastSavedPath('Archiv gespeichert.', gespeichert);
      else if (gespeichert) showToast('Archiv gespeichert.', { tone: 'success' });
    } catch (err) {
      showToast(`Archiv konnte nicht gespeichert werden: ${String(err?.message || err)}`, { tone: 'danger' });
    }
  };

  const loescheArchiv = async (archivId) => {
    const liste = Array.isArray(liveDb?.schoolYearArchives) ? liveDb.schoolYearArchives : [];
    const gewaehlt = liste.find(a => a?.id === archivId);
    if (!gewaehlt) return;
    const k = archivKennzahlen(gewaehlt);
    const ok = await askConfirm({
      title: 'Archiviertes Schuljahr löschen',
      body: `Das archivierte ${gewaehlt.label || 'Schuljahr'} wird gelöscht – mit ${k.stunden} ${k.stunden === 1 ? 'Planung' : 'Planungen'} und ${k.sequenzen} ${k.sequenzen === 1 ? 'Sequenz' : 'Sequenzen'}. Danach ist dieses Schuljahr nur noch aus einer Backup-Datei zu bekommen.`,
      confirmLabel: 'Endgültig löschen',
      tone: 'danger',
    });
    if (!ok) return;
    // Man kann nicht löschen, was man gerade ansieht.
    if (archivAnsicht?.id === archivId) verlasseArchiv();
    const before = liveDb;
    const nextDb = deepClone(liveDb);
    nextDb.schoolYearArchives = (Array.isArray(nextDb.schoolYearArchives) ? nextDb.schoolYearArchives : [])
      .filter(a => a?.id !== archivId);
    runUndoable(`${gewaehlt.label || 'Schuljahr'} gelöscht`, before, ()=>persistLive(nextDb), { liveAktion: true });
  };

  const closeSchoolYearDialog = () => setSchoolYearDialog(prev => ({ ...prev, visible: false }));

  const snoozeSchoolYearDialog = (days = 7) => {
    if (!db) { closeSchoolYearDialog(); return; }
    const todayISO = toISODate(new Date());
    const untilISO = addDaysISO(todayISO, Math.max(1, days|0));
    const nextDb = deepClone(db);
    nextDb.schoolYearRollover = { ...(nextDb.schoolYearRollover || {}), snoozeUntilISO: untilISO };
    persist(nextDb);
    closeSchoolYearDialog();
  };

  const dismissSchoolYearDialogForCurrentEndDate = () => {
    if (!db) { closeSchoolYearDialog(); return; }
    const endISO = (db.schoolCalendar?.schoolYear?.endISO || '').trim();
    const nextDb = deepClone(db);
    nextDb.schoolYearRollover = { ...(nextDb.schoolYearRollover || {}), dismissedEndISO: endISO };
    persist(nextDb);
    closeSchoolYearDialog();
  };


  useEffect(()=>{
    // Keep the splash visible long enough to be recognized.
    // Note: In React StrictMode (dev) effects run twice (setup/cleanup/setup). This is fine here:
    // the first timeout is cleaned up immediately, the second one will hide the splash.
    const t = setTimeout(()=>setSplashVisible(false), 3000);
    return ()=>clearTimeout(t);
  }, []);

  // Remembers the last "main" view (week/macro/calendar). Used for going back from lesson/library.
  const lastMainView = useRef({ name: 'week', weekStart: toISODate(startOfWeekMonday(new Date())) });
  useEffect(()=>{
    /* Nur Ansichten der aktuellen Daten merken: sonst führte "Zurück"
       nach dem Verlassen des Archivs in eine archivierte Woche, die es
       im laufenden Schuljahr gar nicht gibt. */
    if (imArchiv) return;
    if (view.name === 'week' || view.name === 'macro' || view.name === 'calendar') lastMainView.current = view;
  }, [view, imArchiv]);

  useEffect(()=>{
    if (view.name === 'week') {
      setSelectedDate(view.weekStart);
    }
  }, [view]);

  const week = useMemo(()=>{
    if (!db) return null;
    const ws = view.weekStart;
    const w = db.weeks[ws] || { slotsPerDay: 6, lessons: {}, duties: {} };
    return w;
  }, [db, view.weekStart]);

  const socialFormSuggestions = useMemo(()=>{
    if (!db || !db.socialForms) return [];
    const hidden = db.hiddenSuggestions?.socialForms || {};
    const entries = Object.entries(db.socialForms || {}).filter(([label])=>!hidden[label]);
    entries.sort((a,b)=>{
      const ac = a[1]?.count || 0;
      const bc = b[1]?.count || 0;
      const al = a[1]?.lastUsed || '';
      const bl = b[1]?.lastUsed || '';
      if (bc !== ac) return bc - ac;
      return bl.localeCompare(al);
    });
    return entries.map(([label])=>label);
  }, [db?.socialForms, db?.hiddenSuggestions]);

  const phaseNameSuggestions = useMemo(()=>{
    if (!db || !db.phaseNames) return [];
    const hidden = db.hiddenSuggestions?.phaseNames || {};
    const entries = Object.entries(db.phaseNames || {}).filter(([label])=>!hidden[label]);
    entries.sort((a,b)=>{
      const ac = a[1]?.count || 0;
      const bc = b[1]?.count || 0;
      const al = a[1]?.lastUsed || '';
      const bl = b[1]?.lastUsed || '';
      if (bc !== ac) return bc - ac;
      return bl.localeCompare(al);
    });
    return entries.map(([label])=>label);
  }, [db?.phaseNames, db?.hiddenSuggestions]);

  const supervisionSuggestions = useMemo(()=>{
    if (!db || !db.supervisionLabels) return [];
    const hidden = db.hiddenSuggestions?.supervisionLabels || {};
    const entries = Object.entries(db.supervisionLabels || {}).filter(([label])=>!hidden[label]);
    entries.sort((a,b)=>{
      const ac = a[1]?.count || 0;
      const bc = b[1]?.count || 0;
      const al = a[1]?.lastUsed || '';
      const bl = b[1]?.lastUsed || '';
      if (bc !== ac) return bc - ac;
      return bl.localeCompare(al);
    });
    return entries.map(([label])=>label);
  }, [db?.supervisionLabels, db?.hiddenSuggestions]);



  const competencySuggestions = useMemo(()=>{
    if (!db || !db.competencies) return [];
    const hidden = db.hiddenSuggestions?.competencies || {};
    const entries = Object.entries(db.competencies || {}).filter(([label])=>!hidden[label]);
    entries.sort((a,b)=>{
      const ac = a[1]?.count || 0;
      const bc = b[1]?.count || 0;
      const al = a[1]?.lastUsed || '';
      const bl = b[1]?.lastUsed || '';
      if (bc !== ac) return bc - ac;
      return bl.localeCompare(al);
    });
    return entries.map(([label])=>label);
  }, [db?.competencies, db?.hiddenSuggestions]);

  /* Sprechabsichten und Hilfen-Bezeichnungen: dieselbe Sortierung wie
     bei den Kompetenzen – oft benutzt und zuletzt benutzt zuerst. */
  const nutzungsliste = (ablage, versteckt)=>{
    const entries = Object.entries(ablage || {}).filter(([label])=>!(versteckt || {})[label]);
    entries.sort((a, b)=>{
      const ac = a[1]?.count || 0, bc = b[1]?.count || 0;
      if (bc !== ac) return bc - ac;
      return String(b[1]?.lastUsed || '').localeCompare(String(a[1]?.lastUsed || ''));
    });
    return entries.map(([label])=>label);
  };

  const speechActSuggestions = useMemo(
    ()=> nutzungsliste(db?.speechActs, db?.hiddenSuggestions?.speechActs),
    [db?.speechActs, db?.hiddenSuggestions]
  );
  const scaffoldSuggestions = useMemo(
    ()=> [...new Set([
      ...nutzungsliste(db?.scaffoldLabels, db?.hiddenSuggestions?.scaffoldLabels),
      ...SCAFFOLD_VORSCHLAEGE,
    ])],
    [db?.scaffoldLabels, db?.hiddenSuggestions]
  );

  /* Der Fremdsprachenmodus und der gespeicherte Teil des Katalogs.
     Beides wird an die Stellen durchgereicht, die Kompetenzen anzeigen –
     die Auswahl in der Stunde, die Verwaltung, die Jahresübersicht. */
  const languageMode = Boolean(db?.appSettings?.languageMode);
  const competencyModel = useMemo(
    ()=> normalisiereModell(db?.competencyModel),
    [db?.competencyModel]
  );
  /* Alle je benutzten Etiketten – ohne die aus den Vorschlägen entfernten.
     Sie sind die eigenen Kompetenzen; es braucht dafür keine eigene
     Ablage, weil db.competencies sie seit jeher führt. */
  const benutzteKompetenzen = competencySuggestions;

  /* Ausgeblendetes gehört auch nicht in die freie Vorschlagsliste. */
  const sichtbareKompetenzVorschlaege = useMemo(
    ()=> competencySuggestions.filter(l => !competencyModel.hidden?.[l]),
    [competencySuggestions, competencyModel]
  );

const classGroupSuggestions = useMemo(()=>{
  if (!db || !db.classGroups) return [];
  const hidden = db.hiddenSuggestions?.classGroups || {};
  const entries = Object.entries(db.classGroups || {}).filter(([label])=>!hidden[label]);
  entries.sort((a,b)=>{
    const ac = a[1]?.count || 0;
    const bc = b[1]?.count || 0;
    const al = a[1]?.lastUsed || '';
    const bl = b[1]?.lastUsed || '';
    if (bc !== ac) return bc - ac;
    return bl.localeCompare(al);
  });
  return entries.map(([label])=>label);
}, [db?.classGroups, db?.hiddenSuggestions]);



  const subjectSuggestions = useMemo(()=>{
    if (!db || !db.subjects) return [];
    const hidden = db.hiddenSuggestions?.subjects || {};
    const entries = Object.entries(db.subjects || {}).filter(([label])=>!hidden[label]);
    entries.sort((a,b)=>{
      const ac = a[1]?.count || 0;
      const bc = b[1]?.count || 0;
      const al = a[1]?.lastUsed || '';
      const bl = b[1]?.lastUsed || '';
      if (bc !== ac) return bc - ac;
      return bl.localeCompare(al);
    });
    return entries.map(([label])=>label);
  }, [db?.subjects, db?.hiddenSuggestions]);

  const sequences = db?.sequences || {};

  const appSettings = db?.appSettings || { fileCopyOptIn: false, theme: 'system' };

  // Systemvorgabe beobachten, damit "System" ohne Neustart umschaltet.
  const [systemPrefersDark, setSystemPrefersDark] = useState(()=>{
    try { return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false; }
    catch { return false; }
  });
  useEffect(()=>{
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return; }
    const onChange = (e)=> setSystemPrefersDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return ()=> mq.removeEventListener?.('change', onChange);
  }, []);

  /* ---- Meldungen ------------------------------------------------------ */
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef(new Map());
  const dismissToast = useCallback((id)=>{
    const t = toastTimers.current.get(id);
    if (t) { clearTimeout(t); toastTimers.current.delete(id); }
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);
  const showToast = useCallback((text, opts = {})=>{
    const id = uid();
    const ttl = Number.isFinite(opts.ttl) ? opts.ttl : (opts.action ? 9000 : 5000);
    setToasts(prev => [...prev.slice(-3), { id, text, tone: opts.tone, action: opts.action }]);
    if (ttl > 0) toastTimers.current.set(id, setTimeout(()=>dismissToast(id), ttl));
    return id;
  }, [dismissToast]);
  useEffect(()=>()=>{ toastTimers.current.forEach(clearTimeout); toastTimers.current.clear(); }, []);

  /* Die Meldung des Riegels. Sie steht hier, weil showToast erst jetzt
     existiert; der Riegel selbst liegt weiter oben in persist(). */
  useEffect(()=>{
    archivHinweisRef.current = ()=> showToast('Archivansicht: Dieses Schuljahr ist archiviert. Änderungen sind hier nicht möglich.', { tone: 'warning' });
  }, [showToast]);


  /* ---- Rückgängig -----------------------------------------------------
     Bewusst an diskrete Aktionen gebunden, nicht an persist(): persist
     läuft bei jedem Tastenanschlag, ein Stapel daraus wäre wertlos.
     Nur im Speicher, nicht persistiert.                                  */
  const UNDO_LIMIT = 10;
  const undoStack = useRef([]);
  const captureUndo = useCallback((label, snapshot)=>{
    undoStack.current = [...undoStack.current.slice(-(UNDO_LIMIT - 1)), { label, db: deepClone(snapshot) }];
  }, []);
  /* Auf dem Stapel liegen ausschliesslich Stände der ECHTEN Daten –
     dafür sorgt runUndoable unten. Deshalb wird hier auch dann in die
     echten Daten zurückgeschrieben, wenn gerade ein Archiv offen ist:
     das "Rückgängig" nach dem Löschen eines Archivs soll wirken. */
  const undoLast = useCallback(()=>{
    const entry = undoStack.current[undoStack.current.length - 1];
    if (!entry) { showToast('Nichts zum Rückgängigmachen.'); return; }
    undoStack.current = undoStack.current.slice(0, -1);
    persistLive(entry.db);
    showToast(`${entry.label} rückgängig gemacht.`);
  }, [showToast, persistLive]);

  /* Umkehrbare Aktion: ausführen, dann Rückgängig anbieten.

     `liveAktion` kennzeichnet die wenigen Aktionen, die auch aus einer
     Archivansicht heraus auf die echten Daten wirken dürfen – etwa das
     Löschen eines Archivs. Alles andere wird in der Archivansicht gar
     nicht erst ausgeführt: sonst landete der Archivstand auf dem
     Rückgängig-Stapel und würde später über die echten Daten
     geschrieben. */
  const runUndoable = useCallback((label, snapshot, mutate, { liveAktion = false } = {})=>{
    if (imArchiv && !liveAktion) { archivHinweisRef.current?.(); return; }
    captureUndo(label, snapshot);
    mutate();
    showToast(label, { action: { label: 'Rückgängig', onAct: undoLast } });
  }, [captureUndo, showToast, undoLast, imArchiv]);

  /* ---- Versionsverlauf ------------------------------------------------

     Das Rückgängig oben deckt den Augenblick ab. Der Versionsverlauf
     deckt die Woche davor ab: wenige, bewusst gesetzte
     Wiederherstellungspunkte, die einen Neustart überleben.

     Er liegt in einer EIGENEN Ablage (siehe verlauf-speicher.js und die
     Plattformadapter) und wird erst gelesen, wenn er gebraucht wird –
     der Start der App fasst ihn nicht an. In die Unterrichtsdatenbank,
     in ein Backup, in eine Vorlage oder nach Pocket gerät er nie.       */
  const verlaufSpeicher = useMemo(()=> erstelleVerlaufSpeicher(platform, {
    beiFehler: (err)=> { try { console.warn('[Versionsverlauf]', err); } catch {} },
  }), []);
  const [verlaufDialog, setVerlaufDialog] = useState(null);   // { bereich, zielId, titel, untertitel }
  const [verlaufEintraege, setVerlaufEintraege] = useState([]);
  const [verlaufLaedt, setVerlaufLaedt] = useState(false);

  const stundenLabel = useCallback((weekStart, dayIndex, slotIndex, span = 1)=>{
    const iso = addDaysISO(weekStart, Number(dayIndex) || 0);
    return `${DAYS[Number(dayIndex) || 0] || ''} · ${formatDateDE(iso)} · ${stundenBereichLabel(slotIndex, span)}`;
  }, []);

  /* Ein Sicherungspunkt für eine Stunde.

     `stunde` ist der Stand VOR der Änderung. Ohne Angabe wird er aus den
     echten Daten gelesen – das ist der Normalfall, weil ein
     Sicherungspunkt immer vor dem Schreiben gesetzt wird. */
  const sichereStunde = useCallback((ort, ausloeser, { felder = [], stunde } = {})=>{
    if (!verlaufSpeicher.verfuegbar || imArchiv) return;
    const weekStart = String(ort?.weekStart || '');
    if (!weekStart) return;
    const dayIndex = Number(ort?.dayIndex) || 0;
    const slotIndex = Number(ort?.slotIndex) || 0;
    const vorher = (stunde !== undefined)
      ? stunde
      : (liveDb?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)] || null);
    /* Ein leerer Platz, der gerade erst gefüllt wird, ist keine frühere
       Fassung – dafür gibt es das Rückgängig. */
    if (!vorher && ausloeser === 'bearbeitet') return;
    verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
      ausloeser,
      bereich: 'lesson',
      zielId: stundenZiel({ weekStart, dayIndex, slotIndex }),
      zielLabel: stundenLabel(weekStart, dayIndex, slotIndex, blockSpanOf(vorher)),
      felder,
      teile: [stundenTeil({ weekStart, dayIndex, slotIndex, stunde: vorher })],
    })).catch(()=>{});
  }, [verlaufSpeicher, imArchiv, liveDb, stundenLabel]);

  const sichereSequenz = useCallback((sequenceId, ausloeser, { felder = [] } = {})=>{
    if (!verlaufSpeicher.verfuegbar || imArchiv) return;
    const id = String(sequenceId || '');
    const seq = liveDb?.sequences?.[id] || null;
    if (!id) return;
    verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
      ausloeser,
      bereich: 'sequence',
      zielId: sequenzZiel(id),
      zielLabel: seq?.name || 'Sequenz',
      felder,
      teile: [sequenzTeil(id, seq)],
    })).catch(()=>{});
  }, [verlaufSpeicher, imArchiv, liveDb]);

  const sichereVorlage = useCallback((templateId, ausloeser)=>{
    if (!verlaufSpeicher.verfuegbar || imArchiv) return;
    const id = String(templateId || '');
    const tpl = liveDb?.sequenceTemplates?.[id] || null;
    if (!id) return;
    verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
      ausloeser,
      bereich: 'template',
      zielId: vorlagenZiel(id),
      zielLabel: tpl?.name || 'Vorlage',
      teile: [vorlagenTeil(id, tpl)],
    })).catch(()=>{});
  }, [verlaufSpeicher, imArchiv, liveDb]);

  const sichereBalken = useCallback((barId, ausloeser)=>{
    if (!verlaufSpeicher.verfuegbar || imArchiv) return;
    const id = String(barId || '');
    const bar = (Array.isArray(liveDb?.yearBars) ? liveDb.yearBars : []).find(b => b?.id === id) || null;
    if (!id) return;
    verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
      ausloeser,
      bereich: 'yearBar',
      zielId: balkenZiel(id),
      zielLabel: bar?.title || 'Jahresbalken',
      teile: [balkenTeil(id, bar)],
    })).catch(()=>{});
  }, [verlaufSpeicher, imArchiv, liveDb]);

  /* Eine Sammelaktion: viele Orte, ein Vorgang.

     Die Teile tragen dieselbe Transaktionskennung; wiederhergestellt
     wird deshalb entweder alles oder nichts. Genau das braucht das
     Verschieben mehrerer Sequenzstunden. */
  const sichereSammlung = useCallback((teile, ausloeser, { bereich = 'bulk', zielId = '', zielLabel = '', felder = [] } = {})=>{
    if (!verlaufSpeicher.verfuegbar || imArchiv) return null;
    const liste = (Array.isArray(teile) ? teile : []).filter(Boolean);
    if (!liste.length) return null;
    const transaktion = uid();
    verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
      ausloeser, bereich, zielId, zielLabel, felder, teile: liste, transaktion,
    })).catch(()=>{});
    return transaktion;
  }, [verlaufSpeicher, imArchiv]);

  /* Den Verlauf von Hand leeren. Bewusst mit Nachfrage: er ist die
     einzige Stelle, an der frühere Fassungen liegen. Die Planung selbst
     bleibt in jedem Fall unberührt. */
  const leereVerlauf = useCallback(async ()=>{
    const ok = await askConfirmRef.current?.({
      title: 'Versionsverlauf leeren',
      body: 'Alle gespeicherten früheren Fassungen werden entfernt. Die aktuelle Planung bleibt vollständig erhalten – nur der Weg zurück zu älteren Ständen entfällt.',
      confirmLabel: 'Verlauf leeren',
      tone: 'danger',
    });
    if (!ok) return;
    await verlaufSpeicher.leeren();
    setVerlaufEintraege([]);
    showToast('Versionsverlauf geleert. Die Planung ist unverändert.');
  }, [verlaufSpeicher, showToast]);

  const ladeVerlauf = useCallback(async (ziel)=>{
    if (!ziel) return;
    setVerlaufLaedt(true);
    try {
      const liste = await verlaufSpeicher.liste();
      setVerlaufEintraege(eintraegeFuer(liste, ziel));
    } catch {
      setVerlaufEintraege([]);
    }
    setVerlaufLaedt(false);
  }, [verlaufSpeicher]);

  const oeffneVerlauf = useCallback((ziel)=>{
    if (!verlaufSpeicher.verfuegbar) {
      showToast('Der Versionsverlauf ist in dieser Fassung nicht verfügbar.', { tone: 'warning' });
      return;
    }
    setVerlaufDialog(ziel);
    setVerlaufEintraege([]);
    ladeVerlauf(ziel);
  }, [verlaufSpeicher, ladeVerlauf, showToast]);

  /* Eine frühere Fassung zurückholen.

     Zuerst wird der Stand gesichert, der gerade gilt – erst dann wird
     geschrieben. Damit ist auch die Wiederherstellung selbst umkehrbar,
     über den Verlauf wie über das Rückgängig. */
  const stelleVersionHer = useCallback(async (eintrag)=>{
    if (!eintrag) return;
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    const gegenTeile = aktuellerStand(liveDb, eintrag);
    try {
      await verlaufSpeicher.anhaengen(erstelleVerlaufEintrag({
        ausloeser: 'vorWiederherstellen',
        bereich: eintrag.bereich,
        zielId: eintrag.zielId,
        zielLabel: eintrag.zielLabel,
        teile: gegenTeile,
        transaktion: eintrag.transaktion ? uid() : '',
      }));
    } catch {}
    const next = ensureDbShape(wendeVerlaufAn(liveDb, eintrag));
    /* Entwürfe der betroffenen Plätze verwerfen: sonst zeigte die
       Stundenansicht weiter den Stand von vorhin. */
    for (const teil of (eintrag.teile || [])) {
      if (teil?.art !== 'stunde') continue;
      try { draftLessonCacheRef.current.delete(`${teil.weekStart}|${teil.dayIndex}|${teil.slotIndex}`); } catch {}
    }
    runUndoable('Frühere Fassung wiederhergestellt', liveDb, ()=>persistLive(next), { liveAktion: true });
    if (verlaufDialog) ladeVerlauf(verlaufDialog);
  }, [imArchiv, liveDb, verlaufSpeicher, runUndoable, persistLive, verlaufDialog, ladeVerlauf]);

  /* ---- Sequenzen verschieben -----------------------------------------

     Der Einstieg ist überall derselbe: eine Sequenz, wahlweise eine
     Stunde darin, und – wenn die Frage von einem Jahresbalken kommt –
     eine Verschiebung um n Wochen als Vorschlag.

     Gerechnet wird im Modul, gezeigt im Dialog, ausgeführt erst nach
     dem Klick. Diese Reihenfolge ist der ganze Sicherheitsgewinn
     gegenüber dem Verschieben von Hand.                                */
  const [verschiebenDialog, setVerschiebenDialog] = useState(null);

  const oeffneVerschieben = useCallback((cfg)=>{
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    const sequenceId = String(cfg?.sequenceId || '');
    if (!sequenceId || !liveDb?.sequences?.[sequenceId]) {
      showToast('Diese Sequenz gibt es nicht mehr.', { tone: 'warning' });
      return;
    }
    setVerschiebenDialog({
      sequenceId,
      ab: cfg?.ab || null,
      umfang: cfg?.umfang || (cfg?.ab ? VERSCHIEBE_UMFANG.AB_FOLGENDE : VERSCHIEBE_UMFANG.GESAMT),
      /* Ohne Umwandlung: `Number(null)` wäre 0 – aus "keine Angabe"
         würde sonst "um 0 Wochen verschieben". */
      wochen: Number.isFinite(cfg?.wochen) ? Number(cfg.wochen) : null,
      barId: cfg?.barId || '',
    });
  }, [imArchiv, liveDb, showToast]);

  /* Die Ausführung. Sie ist der einzige Ort, an dem beim Verschieben
     geschrieben wird – und sie schreibt genau einmal:

       - ein Undo-Eintrag,
       - ein zusammengehöriger Eintrag im Versionsverlauf,
       - eine Zusammenfassung als Meldung.                              */
  const fuehreVerschiebungAus = useCallback(({ plan, balkenAnpassen })=>{
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    if (!plan?.ok) return;
    const naechste = wendeVerschiebungAn(liveDb, plan);
    if (!naechste) {
      showToast('Die Verschiebung wurde nicht ausgeführt: die Planung hat sich zwischenzeitlich geändert.', { tone: 'warning' });
      setVerschiebenDialog(null);
      return;
    }

    const sequenceId = String(plan.sequenz?.id || verschiebenDialog?.sequenceId || '');

    /* Optional: die verknüpften Jahresbalken auf den neuen Zeitraum
       legen. Mehrere Balken auf derselben Sequenz bekommen jeder
       denselben Zeitraum – daraus wird keine zweite Verschiebung. */
    const balkenAenderungen = balkenAnpassen
      ? balkenNachVerschiebung(liveDb.yearBars, sequenceId, plan, {
          aufWoche: (iso)=> { try { return toISODate(startOfWeekMonday(fromISODate(iso))); } catch { return iso; } },
        })
      : [];
    if (balkenAenderungen.length) {
      naechste.yearBars = (Array.isArray(naechste.yearBars) ? naechste.yearBars : []).map(b => {
        const treffer = balkenAenderungen.find(a => a.id === b?.id);
        return treffer ? { ...b, startISO: treffer.startISO, endISO: treffer.endISO, updatedAt: new Date().toISOString() } : b;
      });
    }

    /* Ein Vorgang, ein Eintrag: alle berührten Plätze mit dem Stand,
       den sie VOR der Verschiebung trugen – Quelle wie Ziel. Nur so
       lässt sich die Sammelaktion später als Ganzes zurückholen. */
    const teile = betroffeneOrte(plan).map(o => stundenTeil({
      weekStart: o.weekStart, dayIndex: o.dayIndex, slotIndex: o.slotIndex,
      stunde: liveDb?.weeks?.[o.weekStart]?.lessons?.[keyOf(o.dayIndex, o.slotIndex)] || null,
    }));
    for (const a of balkenAenderungen) {
      const bar = (Array.isArray(liveDb.yearBars) ? liveDb.yearBars : []).find(b => b?.id === a.id) || null;
      teile.push(balkenTeil(a.id, bar));
    }
    sichereSammlung(teile, 'vorVerschieben', {
      bereich: 'bulk',
      zielId: sequenzZiel(sequenceId),
      zielLabel: `${plan.sequenz?.name || 'Sequenz'} verschoben`,
    });

    for (const o of betroffeneOrte(plan)) {
      try { draftLessonCacheRef.current.delete(`${o.weekStart}|${o.dayIndex}|${o.slotIndex}`); } catch {}
    }

    const anzahl = plan.bewegungen.length;
    runUndoable(
      `${anzahl} ${anzahl === 1 ? 'Stunde' : 'Stunden'} verschoben`,
      liveDb,
      ()=>persistLive(ensureDbShape(naechste)),
    );
    setVerschiebenDialog(null);

    const teileText = [
      `${anzahl} ${anzahl === 1 ? 'Stunde' : 'Stunden'} verschoben`,
      plan.vonISO ? `neuer Zeitraum ${formatDateDE(plan.vonISO)} – ${formatDateDE(plan.bisISO)}` : '',
      plan.uebersprungeneFerien ? `${plan.uebersprungeneFerien} freie Tage übersprungen` : '',
      plan.uebersprungeneBelegt ? `${plan.uebersprungeneBelegt} belegte Termine übersprungen` : '',
      balkenAenderungen.length ? `${balkenAenderungen.length} ${balkenAenderungen.length === 1 ? 'Jahresbalken angepasst' : 'Jahresbalken angepasst'}` : '',
    ].filter(Boolean);
    showToast(teileText.join(' · '), { ttl: 9000 });
  }, [imArchiv, liveDb, showToast, runUndoable, persistLive, sichereSammlung, verschiebenDialog]);

  /* ---- Dialoge -------------------------------------------------------- */
  const [confirmState, setConfirmState] = useState(null);
  // Versprechensbasiert, damit die Aufrufstellen so knapp bleiben wie mit
  // window.confirm: const ok = await askConfirm({...}); if (!ok) return;
  const askConfirm = useCallback((cfg)=> new Promise((resolve)=>{
    setConfirmState({ ...cfg, onConfirm: ()=>resolve(true), onCancel: ()=>resolve(false) });
  }), []);
  /* Der Versionsverlauf weiter oben braucht die Bestätigung, entsteht
     aber vor ihr. Die Referenz überbrückt das, ohne die Reihenfolge der
     Abschnitte umzustellen. */
  const askConfirmRef = useRef(null);
  useEffect(()=>{ askConfirmRef.current = askConfirm; }, [askConfirm]);
  const [promptState, setPromptState] = useState(null);
  const askPrompt = useCallback((cfg)=> new Promise((resolve)=>{
    setPromptState({ ...cfg, onConfirm: (v)=>resolve(v), onCancel: ()=>resolve(null) });
  }), []);

  // Strg+Z global. In Eingabefeldern hat die native Rücknahme Vorrang.
  useEffect(()=>{
    const onKey = (e)=>{
      const z = (e.key === 'z' || e.key === 'Z');
      if (!z || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const el = e.target;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      /* In der Archivansicht nähme die Tastenkombination eine Änderung
         am LAUFENDEN Schuljahr zurück – zu sehen wäre davon nichts.
         Das "Rückgängig" in der Meldung bleibt davon unberührt: dort
         weiss man, worauf es sich bezieht. */
      if (imArchiv) { archivHinweisRef.current?.(); return; }
      e.preventDefault();
      undoLast();
    };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [undoLast, imArchiv]);

  /* ---- Wochenabschluss ------------------------------------------------
     Erscheint beim Verlassen der Woche und freitags – höchstens einmal je
     Woche und Sitzung. Der Merker liegt nur im Speicher: er soll nicht in
     die Datenbank, sondern beim nächsten Start wieder greifen. */
  const [reviewWeek, setReviewWeek] = useState(null);
  const reviewGezeigt = useRef(new Set());
  const letzteWoche = useRef(view.weekStart);
  useEffect(()=>{
    /* Der Wochenabschluss gehört zum laufenden Schuljahr. In der
       Archivansicht wäre er ein Rückblick auf einen Rückblick – und
       der Merker darf dort gar nicht erst mitlaufen, sonst würde eine
       archivierte Woche später gegen die aktuellen Daten geprüft. */
    if (imArchiv) return;
    const vorher = letzteWoche.current;
    letzteWoche.current = view.weekStart;
    if (!db || appSettings?.weekReview === false) return;
    // Beim Verlassen der Wochenansicht
    if (view.name === 'week') return;
    if (!vorher || reviewGezeigt.current.has(vorher)) return;
    const z = weekSummary(db, vorher);
    if (!z.gesamt) return;                     // leere Woche: nichts zu berichten
    reviewGezeigt.current.add(vorher);
    setReviewWeek(vorher);
  }, [view.name]);

  /* ---- Befehlspalette ------------------------------------------------- */
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(()=>{
    const onKey = (e)=>{
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, []);

  const paletteCommands = useMemo(()=>{
    const ws = view.weekStart || toISODate(startOfWeekMonday(new Date()));
    const go = (v)=>()=> setView(v);
    const cmds = [
      { id:'v-today',    group:'Ansicht', label:'Heute',               run: go({ name:'today', weekStart: ws }) },
      { id:'v-week',     group:'Ansicht', label:'Wochenraster',        run: go({ name:'week', weekStart: ws }) },
      { id:'v-macro',    group:'Ansicht', label:'Makro-Plan',          run: go({ name:'macro', weekStart: ws, startISO: ws, rangeDays: 28 }) },
      { id:'v-year',     group:'Ansicht', label:'Jahresgrobplanung',   run: go({ name:'year', weekStart: ws, focusISO: ws }) },
      { id:'v-comp',     group:'Ansicht', label:'Kompetenzen im Jahr', run: go({ name:'competencies', weekStart: ws }) },
      { id:'v-library',  group:'Ansicht', label:'Bibliothek',          run: go({ name:'library', weekStart: ws }) },
      { id:'v-calendar', group:'Ansicht', label:'Schulkalender',       run: go({ name:'calendar', weekStart: ws }) },
      { id:'v-archives', group:'Ansicht', label:'Archivierte Schuljahre', run: go({ name:'archives', weekStart: ws }) },
      { id:'v-search',   group:'Ansicht', label:'Suche',               hint:'Strg+K', run: ()=>oeffneSuche('') },
      { id:'v-todos',    group:'Ansicht', label:'To-dos',              run: go({ name:'todos', weekStart: ws }) },
      { id:'v-settings', group:'Ansicht', label:'Einstellungen',       run: go({ name:'settings', weekStart: ws }) },
      { id:'v-help',     group:'Ansicht', label:'Hilfe',               run: go({ name:'help', weekStart: ws }) },

      { id:'w-prev',  group:'Woche', label:'Vorherige Woche', run: ()=>goWeekDelta(-1) },
      { id:'w-next',  group:'Woche', label:'Nächste Woche',   run: ()=>goWeekDelta(1) },
      { id:'w-today', group:'Woche', label:'Aktuelle Woche',  run: ()=>{
          const t = toISODate(startOfWeekMonday(new Date()));
          setView({ name:'week', weekStart: t }); setSelectedDate(toISODate(new Date()));
        } },

      { id:'a-undo',    group:'Aktion', label:'Rückgängig',            hint:'Strg+Z', run: undoLast },
      { id:'a-seq',     group:'Aktion', label:'Sequenzen verwalten',   run: ()=>openSequenceManagerModal() },
      { id:'a-copy',    group:'Aktion', label:'In nächste Woche übernehmen', run: ()=>setShowWeekCopyDialog(true) },
      { id:'a-expback', group:'Aktion', label:'Backup exportieren',    run: ()=>exportBackup() },
      { id:'a-impback', group:'Aktion', label:'Backup importieren',    run: ()=>importBackup() },
      { id:'a-pocketexp', group:'Aktion', label:'Pocket-Profil exportieren', run: ()=>exportPocketProfile() },
      { id:'v-pocket',  group:'Ansicht', label:'Pocket-Import',        run: go({ name:'pocket', weekStart: ws }) },

      { id:'t-light',  group:'Darstellung', label:'Hell',   run: ()=>updateAppSettings({ theme:'light' }) },
      { id:'t-dark',   group:'Darstellung', label:'Dunkel', run: ()=>updateAppSettings({ theme:'dark' }) },
      { id:'t-system', group:'Darstellung', label:'System', run: ()=>updateAppSettings({ theme:'system' }) },
    ];

    /* In der Archivansicht bleibt, was nur schaut. Alles Ändernde ist
       dort ohnehin wirkungslos – es hier gar nicht erst anzubieten,
       erspart die Meldung. */
    const nurAnsehen = new Set([
      'a-undo', 'a-seq', 'a-copy', 'a-expback', 'a-impback', 'a-pocketexp', 'v-pocket',
      'v-settings', 'v-library', 'v-today', 'w-today',
    ]);
    /* Die Suche bleibt: sie ändert nichts und führt aus dem Archiv
       wieder heraus. */
    nurAnsehen.delete('v-search');
    if (imArchiv) {
      /* Nicht an Ort und Stelle leeren: `cmds` ist dieselbe Liste, die
         unten weiter gefüllt wird. */
      const gefiltert = cmds.filter(c => !nurAnsehen.has(c.id));
      cmds.length = 0;
      cmds.push(
        { id:'a-archiv-zurueck', group:'Aktion', label:'Zurück zum aktuellen Schuljahr', run: ()=>verlasseArchiv() },
        ...gefiltert,
      );
    }

    // Sequenzen: direkt in den Makro-Plan springen und dort filtern.
    for (const seq of Object.values(sequences || {})) {
      if (!seq?.id) continue;
      cmds.push({
        id:`seq-${seq.id}`, group:'Sequenz', label: seq.name || 'Sequenz',
        run: ()=> setView({ name:'macro', weekStart: ws, startISO: ws, rangeDays: 28, sequenceId: seq.id }),
      });
    }
    // Lerngruppen aus den gespeicherten Farben ableiten – dort steht jede
    // tatsächlich verwendete Kombination aus Klasse und Fach.
    for (const key of Object.keys(db?.groupColors || {})) {
      const [cls, subj] = String(key).split('||');
      if (!cls || !subj) continue;
      cmds.push({
        id:`grp-${key}`, group:'Lerngruppe', label:`${cls} · ${subj}`,
        run: ()=> setView({ name:'macro', weekStart: ws, startISO: ws, rangeDays: 28, groupQuery: `${cls} · ${subj}` }),
      });
    }
    return cmds;
    /* `verlasseArchiv` steht bewusst nicht in der Liste: die Funktion
       entsteht bei jedem Rendern neu und liest nur Zustand, der sich
       zusammen mit `imArchiv` ändert. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.weekStart, sequences, db?.groupColors, undoLast, imArchiv]);

  /* ---- Unterrichtszeiten ----------------------------------------------

     Eine Wochenvorlage beschreibt die wiederkehrende Struktur; ein
     Stundenplanmodell fasst zusammen, was für einen Zeitraum gilt –
     eine gleichbleibende Woche oder ein A-/B-Zyklus.

     Zwei Regeln gelten hier durchgehend und stehen deshalb an jeder
     Schreibstelle: In eine Vorlage kommt NIE Planungsinhalt, und beim
     Übernehmen wird NIE etwas überschrieben.                           */
  const stundenplanModelle = useMemo(
    ()=> (Array.isArray(liveDb?.timetableModels) ? liveDb.timetableModels : []),
    [liveDb?.timetableModels],
  );
  const stundenplanVorlagen = liveDb?.timetableTemplates || {};

  /* Das Modell, das in der gerade gezeigten Woche gilt – und daraus die
     Kennzeichnung A/B. Sie kommt aus dem Modell, nicht aus der Woche:
     eine Woche weiss nichts von ihrem Rhythmus. */
  const aktivesStundenplanModell = useMemo(
    ()=> aktivesModellFuer(stundenplanModelle, view.weekStart || toISODate(new Date())),
    [stundenplanModelle, view.weekStart],
  );
  const wochenRhythmus = useMemo(()=>{
    const m = aktivesStundenplanModell;
    if (!m || !istWechselModell(m)) return null;
    const label = labelFuerWoche(m, view.weekStart, { schoolCalendar: db?.schoolCalendar });
    if (!label) return null;
    return {
      label,
      position: positionFuer(m, view.weekStart, { schoolCalendar: db?.schoolCalendar }),
      modell: m,
      laenge: zyklusLaenge(m),
      ausnahme: Object.prototype.hasOwnProperty.call(m.ausnahmen || {}, stundenplanMontag(view.weekStart)),
    };
  }, [aktivesStundenplanModell, view.weekStart, db?.schoolCalendar]);

  const [stundenplanDialog, setStundenplanDialog] = useState(null);
  // { art: 'assistent' | 'anwenden' | 'rhythmus' | 'ausWoche', ... }
  const [stundenplanZiel, setStundenplanZiel] = useState('');   // Modell, das die Ansicht öffnen soll

  const schreibeStundenplan = useCallback((patch, { label = '', umkehrbar = true } = {})=>{
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    const vorher = liveDb;
    const nextDb = {
      ...deepClone(liveDb),
      ...patch,
    };
    if (umkehrbar && label) runUndoable(label, vorher, ()=>persistLive(nextDb));
    else persistLive(nextDb);
  }, [imArchiv, liveDb, runUndoable, persistLive]);

  /* Eine Vorlage speichern. Die Fassung zählt dabei hoch – bereits
     erzeugte Stunden bleiben unberührt und tragen weiter die Fassung,
     mit der sie entstanden sind. */
  const speichereStundenplanVorlage = useCallback((vorlage, { modell = null, position = null } = {})=>{
    const norm = normalisiereStundenplanVorlage({
      ...vorlage,
      modelId: modell ? modell.id : (vorlage.modelId || ''),
      zyklusPosition: (position === null || position === undefined)
        ? (vorlage.zyklusPosition || 0)
        : position,
    });
    const vorlagen = speichereVorlageIn(liveDb?.timetableTemplates || {}, norm);
    let modelle = stundenplanModelle;
    if (modell) {
      modelle = modelle.map(m => {
        if (m.id !== modell.id) return m;
        const zyklus = [...(m.zyklus || [])];
        const index = (position === null || position === undefined) ? norm.zyklusPosition : position;
        zyklus[index] = norm.id;
        return normalisiereStundenplanModell({ ...m, zyklus: zyklus.filter(Boolean), updatedAt: new Date().toISOString() });
      });
    }
    schreibeStundenplan({ timetableTemplates: vorlagen, timetableModels: modelle }, { umkehrbar: false });
    return norm;
  }, [liveDb, stundenplanModelle, schreibeStundenplan]);

  const speichereStundenplanModell = useCallback((modell)=>{
    const norm = normalisiereStundenplanModell(modell);
    const vorhanden = stundenplanModelle.some(m => m.id === norm.id);
    const modelle = vorhanden
      ? stundenplanModelle.map(m => (m.id === norm.id ? norm : m))
      : [...stundenplanModelle, norm];
    schreibeStundenplan({ timetableModels: modelle }, { umkehrbar: false });
    return norm;
  }, [stundenplanModelle, schreibeStundenplan]);

  /* Ein neues Modell samt seiner Vorlagen. Bei A/B entstehen zwei
     getrennt bearbeitbare Wochen, die von Anfang an eindeutig
     beschriftet sind. */
  const legeStundenplanModellAn = useCallback(({ typ, name })=>{
    const wechsel = typ === MODELL_TYP.WECHSEL;
    const modellId = uid();
    const vorlagen = { ...(liveDb?.timetableTemplates || {}) };
    const zyklus = [];
    const anzahl = wechsel ? 2 : 1;
    for (let i = 0; i < anzahl; i++) {
      const v = normalisiereStundenplanVorlage({
        id: uid(),
        modelId: modellId,
        zyklusPosition: i,
        name: wechsel ? `${name} · ${zyklusLabel(i, 2)}-Woche` : name,
        slotsPerDay: db?.weeks?.[view.weekStart]?.slotsPerDay || 6,
      });
      vorlagen[v.id] = v;
      zyklus.push(v.id);
    }
    const sy = db?.schoolCalendar?.schoolYear || {};
    const modell = normalisiereStundenplanModell({
      id: modellId,
      name,
      typ: wechsel ? MODELL_TYP.WECHSEL : MODELL_TYP.EINZEL,
      zyklus,
      vonISO: String(sy.startISO || '').trim(),
      bisISO: String(sy.endISO || '').trim(),
      /* Bewusst OHNE Referenzwoche: Welche Woche die A-Woche ist,
         entscheidet die Schule – nicht die App. Solange das offen ist,
         gilt das Modell als unvollständig, und die Einführung fragt
         danach. */
      referenzWocheISO: '',
      referenzPosition: 0,
      wechselregel: RHYTHMUS.KALENDERWOCHEN,
      aktiv: false,
    });
    schreibeStundenplan({
      timetableTemplates: vorlagen,
      timetableModels: [...stundenplanModelle, modell],
    }, { umkehrbar: false });
    return modell;
  }, [liveDb, db, view.weekStart, stundenplanModelle, schreibeStundenplan]);

  const aktiviereStundenplanModell = useCallback(async (modell)=>{
    const { modelle, deaktiviert } = aktiviereModell(stundenplanModelle, modell.id);
    if (deaktiviert.length) {
      const namen = stundenplanModelle.filter(m => deaktiviert.includes(m.id)).map(m => m.name).join(', ');
      const ok = await askConfirm({
        title: 'Anderen Stundenplan ablösen',
        body: `Für denselben Zeitraum kann nur ein Stundenplan gelten. „${namen}" wird deshalb stillgelegt. Bereits angelegte Unterrichtsstunden bleiben davon unberührt.`,
        confirmLabel: 'Aktivieren',
      });
      if (!ok) return;
    }
    schreibeStundenplan({ timetableModels: modelle }, { label: `${modell.name} aktiviert` });
  }, [stundenplanModelle, askConfirm, schreibeStundenplan]);

  /* Übernehmen. Ein Vorgang: ein Undo-Eintrag, ein zusammengehöriger
     Eintrag im Versionsverlauf, eine Zusammenfassung. */
  const fuehreStundenplanAn = useCallback(({ plan })=>{
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    if (!plan?.ok) return;
    const naechste = wendeVorlageAn(liveDb, plan, {
      neueStunde: ({ classGroup, subject, room, blockSpan })=>{
        const l = defaultLesson();
        l.classGroup = classGroup;
        l.subject = subject;
        l.room = room;
        l.blockSpan = normalisiereBlockSpan(blockSpan);
        l.phases = normalizePhases(l.phases, TOTAL_MIN * l.blockSpan);
        l.planningProfile = normalisiereProfilId(db?.appSettings?.defaultPlanningProfile);
        return l;
      },
    });
    if (!naechste) return;

    /* Was dabei entsteht, gehört als EIN Vorgang in den Verlauf. */
    const teile = stundenplanOrte(plan).map(o => stundenTeil({
      weekStart: o.weekStart, dayIndex: o.dayIndex, slotIndex: o.slotIndex,
      stunde: liveDb?.weeks?.[o.weekStart]?.lessons?.[keyOf(o.dayIndex, o.slotIndex)] || null,
    }));
    sichereSammlung(teile, 'vorImport', {
      bereich: 'bulk',
      zielLabel: 'Unterrichtszeiten übernommen',
    });
    for (const o of stundenplanOrte(plan)) {
      try { draftLessonCacheRef.current.delete(`${o.weekStart}|${o.dayIndex}|${o.slotIndex}`); } catch {}
    }

    /* Lerngruppen und Farben mitziehen – dieselbe Ablage wie beim
       Planen, kein zweiter Datensatz. */
    for (const b of plan.bewegungen) {
      rememberClassGroupIn(naechste, b.eintrag.classGroup);
      rememberSubjectIn(naechste, b.eintrag.subject);
      ensureGroupColorIn(naechste, b.eintrag.classGroup, b.eintrag.subject);
    }

    const anzahl = plan.bewegungen.length;
    runUndoable(
      `${anzahl} ${anzahl === 1 ? 'Stunde' : 'Stunden'} aus der Vorlage angelegt`,
      liveDb,
      ()=>persistLive(ensureDbShape(naechste)),
    );
    setStundenplanDialog(null);
    showToast([
      `${anzahl} ${anzahl === 1 ? 'Stunde angelegt' : 'Stunden angelegt'}`,
      plan.summe.identisch ? `${plan.summe.identisch} schon vorhanden` : '',
      plan.summe.konflikt ? `${plan.summe.konflikt} belegte Plätze unverändert` : '',
      plan.summe.freieWochen ? `${plan.summe.freieWochen} unterrichtsfreie Wochen übersprungen` : '',
    ].filter(Boolean).join(' · '), { ttl: 9000 });
  }, [imArchiv, liveDb, db, runUndoable, persistLive, showToast, sichereSammlung]);

  /* Eine Woche als Vorlage: nur Struktur, nie Inhalt. */
  const speichereWocheAlsVorlage = useCallback(({ name, auswahl, ziel = 'frei', modellId = 'neu' }, { weekStart } = {})=>{
    const ws = weekStart || view.weekStart;
    const woche = liveDb?.weeks?.[ws];
    if (!woche) return null;

    const position = ziel === 'B' ? 1 : 0;
    let modell = null;
    let modelle = stundenplanModelle;
    const vorlagen = { ...(liveDb?.timetableTemplates || {}) };

    if (ziel !== 'frei') {
      if (modellId === 'neu') {
        modell = normalisiereStundenplanModell({
          id: uid(),
          name,
          typ: MODELL_TYP.WECHSEL,
          zyklus: [],
          vonISO: String(db?.schoolCalendar?.schoolYear?.startISO || '').trim(),
          bisISO: String(db?.schoolCalendar?.schoolYear?.endISO || '').trim(),
          referenzWocheISO: ws,
          referenzPosition: position,
          wechselregel: RHYTHMUS.KALENDERWOCHEN,
        });
        modelle = [...modelle, modell];
      } else {
        modell = modelle.find(m => m.id === modellId) || null;
      }
    }

    const vorlage = vorlageAusWoche(woche, {
      name,
      auswahl,
      modelId: modell?.id || '',
      zyklusPosition: position,
      slotsPerDay: woche.slotsPerDay,
    });
    vorlagen[vorlage.id] = vorlage;

    if (modell) {
      const zyklus = [...(modell.zyklus || [])];
      zyklus[position] = vorlage.id;
      modelle = modelle.map(m => (m.id === modell.id
        ? normalisiereStundenplanModell({ ...m, zyklus, updatedAt: new Date().toISOString() })
        : m));
    }

    schreibeStundenplan({ timetableTemplates: vorlagen, timetableModels: modelle }, { umkehrbar: false });
    setStundenplanDialog(null);

    if (modell) {
      const zyklus = modelle.find(m => m.id === modell.id)?.zyklus || [];
      const fehlt = zyklus.filter(Boolean).length < 2;
      showToast(
        fehlt
          ? `${zyklusLabel(position, 2)}-Woche gespeichert. Jetzt passende ${zyklusLabel(position === 0 ? 1 : 0, 2)}-Woche auswählen oder einrichten.`
          : 'Wochenvorlage gespeichert.',
        {
          ttl: 10000,
          action: {
            label: fehlt ? 'Jetzt einrichten' : 'Öffnen',
            onAct: ()=>{ setStundenplanZiel(modell.id); setView(v => ({ name: 'timetable', weekStart: v.weekStart })); },
          },
        },
      );
    } else {
      showToast('Wochenvorlage gespeichert. Nur Unterrichtszeiten – die Planung ist in der Woche geblieben.', {
        ttl: 9000,
        action: { label: 'Unterrichtszeiten öffnen', onAct: ()=> setView(v => ({ name: 'timetable', weekStart: v.weekStart })) },
      });
    }
    return vorlage;
  }, [liveDb, db, view.weekStart, stundenplanModelle, schreibeStundenplan, showToast]);

  /* Eine manuelle Abweichung im Rhythmus. Sie ändert die Zuordnung –
     und nichts sonst: keine Stunde wird dabei angefasst. */
  const setzeRhythmusAusnahme = useCallback(async (position)=>{
    const m = aktivesStundenplanModell;
    if (!m || !istWechselModell(m)) return;
    const ws = stundenplanMontag(view.weekStart);
    const bisher = labelFuerWoche(m, ws, { schoolCalendar: db?.schoolCalendar });
    const neu = zyklusLabel(position, zyklusLaenge(m));
    const ok = await askConfirm({
      title: 'Woche abweichend zuordnen',
      body: `Diese Woche gilt künftig als ${neu}-Woche statt als ${bisher}-Woche. Die folgenden Wochen behalten ihren Rhythmus. An deinen Unterrichtsstunden ändert sich dabei nichts.`,
      confirmLabel: `Als ${neu}-Woche führen`,
    });
    if (!ok) return;
    const modelle = stundenplanModelle.map(x => (x.id === m.id ? setzeAusnahme(x, ws, position) : x));
    schreibeStundenplan({ timetableModels: modelle }, { label: `Woche als ${neu}-Woche geführt` });
  }, [aktivesStundenplanModell, view.weekStart, db, stundenplanModelle, askConfirm, schreibeStundenplan]);

  /* ---- Globale Suche --------------------------------------------------

     Der Index entsteht im Arbeitsspeicher aus den Daten – und zwar
     erst dann, wenn tatsächlich gesucht wird. Beim Tippen in einer
     Stunde ändert sich die Datenbank bei jedem Anschlag; ihn dabei
     ständig neu zu bauen wäre Arbeit für nichts.

     Sobald die Suche offen ist, hängt er an `liveDb` und ist damit
     immer auf dem Stand der Daten. Gespeichert wird er nirgends: er
     kann deshalb weder veralten noch in einem Backup landen.          */
  const [suchQuery, setSuchQuery] = useState('');
  const suchAnsichtOffen = view.name === 'search';
  const brauchtIndex = suchAnsichtOffen || paletteOpen;
  const LEERER_INDEX = useMemo(()=> ({ dokumente: [], gebautAm: 0 }), []);
  const suchIndex = useMemo(
    ()=> (brauchtIndex ? baueIndex(liveDb, { archive: liveDb?.schoolYearArchives }) : LEERER_INDEX),
    [brauchtIndex, liveDb, LEERER_INDEX],
  );

  const oeffneSuche = useCallback((query = '')=>{
    setSuchQuery(String(query || ''));
    setView(v => ({ name: 'search', weekStart: v.weekStart }));
  }, []);

  /* Einen Treffer öffnen.

     Aus dem laufenden Schuljahr führt der Weg direkt dorthin; aus einem
     Archiv über die Archivansicht, die schreibgeschützt ist. Kopiert
     oder eingefügt wird hier nichts – dafür gibt es die vorhandenen
     Wege. */
  const oeffneTreffer = (dokument)=>{
    const ziel = dokument?.ziel;
    if (!ziel) return;
    const ws = view.weekStart;
    const ansicht = (()=>{
      if (ziel.art === 'stunde') {
        return { name: 'lesson', weekStart: ziel.weekStart, dayIndex: ziel.dayIndex, slotIndex: ziel.slotIndex };
      }
      if (ziel.art === 'sequenz') return { name: 'progression', sequenceId: ziel.sequenceId, weekStart: ws };
      if (ziel.art === 'vorlage') return { name: 'library', weekStart: ws, vorschauId: ziel.templateId };
      if (ziel.art === 'jahresplanung') return { name: 'year', weekStart: ws, focusISO: ziel.focusISO || ws };
      if (ziel.art === 'todo') return { name: 'todos', weekStart: ziel.weekStartISO || ws };
      return null;
    })();
    if (!ansicht) return;

    if (ziel.archivId) {
      /* Archivierte Treffer werden im Archiv geöffnet: dieselbe
         Ansicht, nur schreibgeschützt. */
      oeffneArchiv(ziel.archivId, ansicht);
      return;
    }
    if (imArchiv) verlasseArchiv();
    setView(ansicht);
  };

  /* Eine gefundene Stunde übernehmen: über die vorhandene
     Kopierfunktion, nicht über einen zweiten Weg. */
  const kopiereTreffer = (dokument)=>{
    const ziel = dokument?.ziel;
    if (!ziel || ziel.art !== 'stunde' || ziel.archivId) return;
    copyLessonToClipboard(ziel.weekStart, ziel.dayIndex, ziel.slotIndex);
    showToast('Stunde kopiert. Sie lässt sich jetzt in einen freien Stundenplatz einfügen.');
  };


  /* ---- Onboarding -----------------------------------------------------

     Eine Einführung, die sich selbst überflüssig macht: drei Schritte
     bis zur ersten geplanten Stunde, danach nur noch Hinweise dort, wo
     eine Funktion zum ersten Mal gebraucht wird.

     Der Zustand liegt in appSettings.onboarding und wird ausschliesslich
     über updateAppSettings geschrieben – dieser Weg fasst nur die
     Einstellungen an. Unterrichtsdaten kann die Einführung damit gar
     nicht verändern, auch nicht beim Zurücksetzen.                     */
  const onboarding = useMemo(
    ()=> normalisiereOnboarding(liveDb?.appSettings?.onboarding),
    [liveDb?.appSettings?.onboarding],
  );
  /* Geschrieben wird über updateAppSettings, das weiter unten entsteht.
     Die Referenz überbrückt das, ohne die Reihenfolge der Abschnitte
     umzustellen – und stellt zugleich sicher, dass die Einführung
     denselben, einzigen Schreibweg benutzt wie jede andere Einstellung. */
  const updateAppSettingsRef = useRef(null);
  const setzeOnboarding = useCallback((naechster)=>{
    updateAppSettingsRef.current?.({ onboarding: naechster });
  }, []);

  /* Was in dieser Sitzung schon gezeigt wurde. Bewusst nur im Speicher:
     "Später" soll beim nächsten Start wiederkommen dürfen, und ein
     Sitzungsmerker gehört nicht in die Datenbank. */
  const onboardingSitzung = useRef({ gezeigt: false, vertagt: [] });
  const [aktiverHinweis, setAktiverHinweis] = useState(null);

  /* Der Stand der gerade geöffneten Stunde, bevor er gespeichert ist.
     Ohne ihn hinkte die Führung dem Tippen um eine halbe Sekunde
     hinterher. Gemeldet wird nur, was sich wirklich geändert hat –
     sonst liefe die Anzeige bei jedem Anschlag neu. */
  const [stundeFortschritt, setStundeFortschritt] = useState(null);
  const stundeFortschrittRef = useRef('');
  const meldeStundeFortschritt = useCallback((f)=>{
    const schluessel = JSON.stringify(f || null);
    if (stundeFortschrittRef.current === schluessel) return;
    stundeFortschrittRef.current = schluessel;
    setStundeFortschritt(f || null);
  }, []);

  const onboardingAktiv = !imArchiv && !isHelpOnlyWindow && !isExecutionOnlyWindow
    && onboarding.status === ONB_STATUS.AKTIV;

  /* Welche Checkliste gilt, entscheidet der gewählte Einstieg – und beim
     Weg über die Unterrichtszeiten die Art des Stundenplans. */
  const onboardingArt = useMemo(()=> checklistenArt(liveDb, onboarding), [liveDb, onboarding]);
  const onboardingListe = useMemo(()=> checklistenSchritte(onboardingArt), [onboardingArt]);
  const onboardingSchritte = useMemo(
    ()=> schritteAus(liveDb, onboarding, onboardingArt),
    [liveDb, onboarding, onboardingArt],
  );

  /* Beantwortet ist beantwortet – für diese Sitzung.

     Ohne diesen Merker bliebe die Ansicht nach "Später" stehen: Der
     Zustand "pausiert" heisst ausdrücklich, dass sie beim NÄCHSTEN
     Start wiederkommen darf, nicht dass sie jetzt bleiben soll. */
  const [willkommenBeantwortet, setWillkommenBeantwortet] = useState(false);

  const willkommenOffen = !imArchiv && !isHelpOnlyWindow && !isExecutionOnlyWindow
    && !willkommenBeantwortet
    && zeigeWillkommen(liveDb, onboarding);

  /* Solange ein Dialog offen ist, schweigt die Einführung. Ein Hinweis,
     der hinter einem Overlay klebt, ist keine Hilfe. */
  const dialogeOffen = Boolean(willkommenOffen || confirmState || promptState || paletteOpen
    || verlaufDialog || verschiebenDialog || seqManagerModal.open || showWeekCopyDialog
    || colorPalette.visible || schoolYearDialog.visible || reviewWeek || stundenplanDialog);

  /* Der Schritt, der gerade dran ist. '' heisst: nichts zu zeigen. */
  const schnellstartId = (onboardingAktiv && !dialogeOffen)
    ? (onboardingArt === 'stunde'
      ? schnellstartSchritt({ ansicht: view.name, entwurf: stundeFortschritt, schritte: onboardingSchritte })
      : zeitenSchritt({ art: onboardingArt, schritte: onboardingSchritte }))
    : '';

  /* Der freie Platz, an dem der erste Hinweis hängt. Nur solange die
     erste Stunde noch aussteht – danach wäre die Hervorhebung im Weg. */
  const onboardingPlatz = useMemo(
    ()=> ((onboardingAktiv && onboardingArt === 'stunde' && schnellstartId === 'stunde')
      ? ersterFreierPlatz(liveDb, view.weekStart)
      : null),
    [onboardingAktiv, onboardingArt, schnellstartId, liveDb, view.weekStart],
  );

  /* Das Öffnen einer Stunde ist der zweite Schritt – ohne "Weiter",
     wie versprochen. */
  useEffect(()=>{
    if (!onboardingAktiv || view.name !== 'lesson') return;
    const id = onboardingArt === 'stunde' ? 'stunde' : 'stundeGeoeffnet';
    if (onboarding.schritte[id]) return;
    setzeOnboarding(markiereSchritt(onboarding, id));
  }, [onboardingAktiv, onboardingArt, view.name, onboarding, setzeOnboarding]);

  /* Der Schnellstart endet, wenn alle drei Schritte getan sind und der
     Abschluss quittiert wurde – nicht schon beim dritten Häkchen: die
     Abschlussmeldung gehört noch dazu. */
  const beendeSchnellstart = useCallback((weiter)=>{
    setzeOnboarding(schliesseOnboardingAb(onboarding));
    weiter?.();
  }, [onboarding, setzeOnboarding]);

  /* Die nächste Stunde, die sich planen lässt: die erste vorbereitete
     Stunde ab heute. Sie ist das Ziel nach dem Einrichten der
     Unterrichtszeiten – dort geht die Arbeit weiter. */
  const oeffneNaechsteStunde = useCallback(()=>{
    const heute = toISODate(new Date());
    const alle = allLessonsChronological(liveDb).filter(x => x.dateISO >= heute);
    const ziel = alle[0];
    if (!ziel) {
      setView(v => ({ name: 'week', weekStart: v.weekStart }));
      return;
    }
    setSelectedDate(ziel.dateISO);
    setView({ name: 'lesson', weekStart: ziel.weekStart, dayIndex: ziel.dayIndex, slotIndex: ziel.slotIndex });
  }, [liveDb]);

  /* Ein echtes Bedienelement anstossen, statt seine Wirkung ein zweites
     Mal zu schreiben. Die Einführung soll die App bedienen, nicht sie
     nachbauen. */
  const zielBedienen = useCallback((name, { klicken = false } = {})=>{
    try {
      const el = document.querySelector(`[data-onboarding-target="${name}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (klicken) el.click();
      else (el.querySelector('input, textarea, select, button') || el).focus?.();
    } catch {}
  }, []);

  /* Die vier Wege der Willkommensansicht. Jeder benutzt, was es schon
     gibt: die Wochenansicht, den Schulkalender, den Backup-Import. Es
     entsteht kein zweiter Weg in die App. */
  const waehleOnboardingWeg = useCallback(async (weg)=>{
    setWillkommenBeantwortet(true);
    if (weg === ONB_PFADE.ERKUNDEN) {
      setzeOnboarding(ueberspringeOnboarding(onboarding));
      showToast('Alles klar. Erklärungen erscheinen später dort, wo du sie brauchst.');
      return;
    }
    if (weg === ONB_PFADE.IMPORT) {
      /* Nach einem Import ist nichts mehr zu erklären: Der Stand ist da,
         der Schnellstart hätte nichts zu tun. */
      setzeOnboarding(starteOnboarding(onboarding, { pfad: ONB_PFADE.IMPORT }));
      const geladen = await importBackupRef.current?.();
      setzeOnboarding(geladen
        ? ueberspringeOnboarding(starteOnboarding(onboarding, { pfad: ONB_PFADE.IMPORT }))
        : pausiereOnboarding(onboarding));
      return;
    }
    setzeOnboarding(starteOnboarding(onboarding, { pfad: weg }));
    if (weg === ONB_PFADE.ZEITEN) {
      /* Vorhandene Vorlagen werden erkannt: Wer schon welche hat, wird
         nicht noch einmal durch die Einrichtung geschickt. */
      setView(v => ({ name: 'timetable', weekStart: v.weekStart }));
      if (!hatStundenplanVorlagen(liveDb)) {
        setStundenplanDialog({ art: 'assistent' });
      } else {
        showToast('Deine Unterrichtszeiten sind bereits angelegt. Du kannst sie hier ergänzen oder übernehmen.');
      }
      return;
    }
    setView(v => ({ name: 'week', weekStart: v.weekStart }));
  }, [onboarding, setzeOnboarding, showToast]);

  /* Der Backup-Import entsteht weiter unten; die Referenz überbrückt das. */
  const importBackupRef = useRef(null);

  /* ---- Kontextbezogene Hinweise ---------------------------------------

     Sie erscheinen, wenn ihre Situation zum ersten Mal entsteht – und
     höchstens einer je Sitzung. Welche Situation das ist, entscheidet
     das Modul; hier wird nur gefragt. */
  const pruefeHinweis = useCallback((ereignis = '')=>{
    if (imArchiv || isHelpOnlyWindow || isExecutionOnlyWindow) return;
    if (onboarding.status === ONB_STATUS.AKTIV) return;   // erst den Schnellstart zu Ende
    if (onboardingSitzung.current.gezeigt || aktiverHinweis) return;
    const kontext = onboardingKontext(liveDb, {
      ansicht: view.name, ereignis, heuteISO: toISODate(new Date()),
      zustand: onboarding, weekStart: view.weekStart,
    });
    const hinweis = naechsterHinweis({ zustand: onboarding, kontext, sitzung: onboardingSitzung.current });
    if (!hinweis) return;
    onboardingSitzung.current = { ...onboardingSitzung.current, gezeigt: true };
    setAktiverHinweis(hinweis);
  }, [imArchiv, onboarding, aktiverHinweis, liveDb, view.name]);

  useEffect(()=>{
    if (dialogeOffen) return undefined;
    /* Kurz warten: Die Ansicht soll stehen, bevor sich ein Hinweis
       daran hängt. */
    const t = setTimeout(()=>pruefeHinweis(), 900);
    return ()=> clearTimeout(t);
  }, [view.name, dialogeOffen, pruefeHinweis]);

  const beantworteHinweis = useCallback((wahl)=>{
    const h = aktiverHinweis;
    setAktiverHinweis(null);
    if (!h) return;
    if (wahl === 'spaeter') {
      /* Nichts speichern: in einer späteren Sitzung darf er wiederkommen. */
      onboardingSitzung.current = {
        ...onboardingSitzung.current,
        vertagt: [...onboardingSitzung.current.vertagt, h.id],
      };
      return;
    }
    setzeOnboarding(merkeHinweis(onboarding, h.id, wahl));
  }, [aktiverHinweis, onboarding, setzeOnboarding]);

  // Ein fehlgeschlagenes Speichern darf nicht still bleiben. Die Meldung
  // bleibt stehen (ttl 0), bis der Nutzer sie schliesst.
  useEffect(()=>{
    if (!saveError) return;
    showToast(`Speichern fehlgeschlagen: ${saveError}`, { tone: 'danger', ttl: 0 });
  }, [saveError, showToast]);

  /* ---- Web-App: Service Worker und Speicherzusage --------------------- */
  const [storageState, setStorageState] = useState(null);
  useEffect(()=>{
    let abgemeldet = false;
    setupServiceWorker({
      onUpdateAvailable: (anwenden)=>{
        if (abgemeldet) return;
        showToast('Neue Version verfügbar.', {
          ttl: 0,
          action: { label: 'Neu laden', onAct: ()=> anwenden() },
        });
      },
    });
    // Dauerhafte Ablage anfragen. Ohne Zusage darf der Browser die Daten
    // bei Platzmangel verwerfen – das muss sichtbar sein, nicht geraten.
    (async ()=>{
      if (typeof platform.requestPersistence !== 'function') return;
      const res = await platform.requestPersistence();
      if (!abgemeldet) setStorageState(res);
    })();
    return ()=>{ abgemeldet = true; };
  }, [showToast]);

  const uiApi = useMemo(()=>({
    toast: showToast, dismissToast, askConfirm, askInput: askPrompt,
  }), [showToast, dismissToast, askConfirm, askPrompt]);

  /* Beschriftung der Kopfleiste. Vorher eine fünffach verschachtelte
     Ternärkette – als Zuordnung ist sie erweiterbar, ohne Klammern zu zählen. */
  const viewBadgeLabel = useMemo(()=>{
    switch (view.name) {
      case 'macro':
        return `${formatDateDE(view.startISO)} – ${formatDateDE(toISODate(addDays(fromISODate(view.startISO), (view.rangeDays || 28) - 1)))}`;
      case 'year':     return 'Jahresgrobplanung';
      case 'library':  return 'Bibliothek';
      case 'archives': return 'Archivierte Schuljahre';
      case 'today':    return 'Heute';
      case 'competencies': return 'Kompetenzen';
      case 'progression':  return 'Progression';
      case 'review':       return 'Nachbereitung';
      case 'search':   return 'Suche';
      case 'timetable': return 'Meine Unterrichtszeiten';
      case 'settings': return 'Einstellungen';
      case 'help':     return 'Hilfe';
      case 'week':     return '';
      default:         return formatWeekLabel(view.weekStart);
    }
  }, [view]);

  /* Die offenen Punkte für die gerade geöffnete Stunde. Sie werden über
     die Lerngruppe gesucht, nicht über eine feste Verknüpfung – deshalb
     stimmt die Liste auch dann, wenn zwischenzeitlich Stunden entstanden
     oder verschwunden sind. */
  const offenePunkteDerStunde = useMemo(()=>{
    if (!db || view.name !== 'lesson') return [];
    const l = db.weeks?.[view.weekStart]?.lessons?.[keyOf(view.dayIndex, view.slotIndex)];
    const gruppe = l || {};
    const classGroup = String(gruppe.classGroup || '').trim();
    const subject = String(gruppe.subject || '').trim();
    if (!classGroup || !subject) return [];
    return offenePunkteFuer(db, {
      classGroup, subject,
      weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: view.slotIndex,
    });
  }, [db, view]);

  const themeChoice = THEME_CHOICES.includes(appSettings?.theme) ? appSettings.theme : 'system';
  const darkActive = themeChoice === 'dark' || (themeChoice === 'system' && systemPrefersDark);
  // Vor dem Rendern der Kinder setzen: die Farbableitungen lesen diesen Wert.
  setDarkMode(darkActive);

  useEffect(()=>{
    const root = document.documentElement;
    if (themeChoice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeChoice);
  }, [themeChoice]);
  /* Einstellungen gehören der App, nicht einem Schuljahr. Sie werden
     deshalb immer in die echten Daten geschrieben – auch während eine
     Archivansicht offen ist. Das Archiv selbst bleibt unberührt. */
  const updateAppSettings = (patch) => {
    try {
      const nextDb = deepClone(liveDb);
      nextDb.appSettings = { ...(nextDb.appSettings || {}), ...(patch || {}) };
      persistLive(nextDb);
    } catch {}
  };
  /* Die Einführung schreibt über denselben Weg – siehe setzeOnboarding. */
  useEffect(()=>{ updateAppSettingsRef.current = updateAppSettings; });

const todos = Array.isArray(db?.todos) ? db.todos : [];
const todayISO = toISODate(new Date());
const todosDueTodayCount = useMemo(()=>{
  return todos.filter(t => !t.done && ((t.dateISO || '') === todayISO || (t.deadlineISO || '') === todayISO)).length;
}, [todos, todayISO]);


useEffect(()=>{
  if (splashVisible) return;
  // To-dos aus einem abgeschlossenen Schuljahr sind nicht "heute fällig".
  if (imArchiv) return;
  if (todosDueTodayCount <= 0) return;
  if (todoReminderGuard.current === todayISO) return;
  todoReminderGuard.current = todayISO;
  setTodoReminderVisible(true);
}, [splashVisible, todosDueTodayCount, todayISO]);


  // --- Schuljahreswechsel: nach Schuljahresende beim Start nachfragen ---
  useEffect(()=>{
    if (!db) return;
    if (isHelpOnlyWindow) return;
    if (splashVisible) return;

    const endISO = (db.schoolCalendar?.schoolYear?.endISO || '').trim();
    if (!endISO) return;

    const todayISO = toISODate(new Date());
    if (todayISO <= endISO) return;

    // Kein Schuljahreswechsel aus einer Archivansicht heraus.
    if (imArchiv) return;
    const meta = db.schoolYearRollover || {};
    if (((meta.dismissedEndISO || '').trim()) === endISO) return;

    const snoozeUntil = (meta.snoozeUntilISO || '').trim();
    if (snoozeUntil && todayISO < snoozeUntil) return;

    if (((meta.lastPromptISO || '').trim()) === todayISO) return;

    // Mark as prompted today to avoid repeat prompts on the same day
    try {
      const nextDb = deepClone(db);
      nextDb.schoolYearRollover = { ...(nextDb.schoolYearRollover || {}), lastPromptISO: todayISO };
      persist(nextDb);
    } catch {}

    openNewSchoolYearDialog({ reason: 'auto' });
  }, [db, splashVisible, isHelpOnlyWindow]);

  const schoolCalendar = db?.schoolCalendar || { schoolYear:{startISO:'', endISO:''}, vacations:[], freeDays:[], events:[] };
  const schoolYear = schoolCalendar.schoolYear || { startISO:'', endISO:'' };
  const minDate = (schoolYear.startISO || '').trim() || undefined;
  const maxDate = (schoolYear.endISO || '').trim() || undefined;

  const weekEndISO = useMemo(()=>{
    // In der Wochenübersicht planen wir typischerweise Mo–Fr
    return toISODate(addDays(fromISODate(view.weekStart), 4));
  }, [view.weekStart]);

  const weekTodosCount = useMemo(()=>{
    const ws = (view.weekStart || '');
    return todos.filter(t => t && !t.done && (t.weekStartISO || '') === ws).length;
  }, [todos, view.weekStart]);

  const futureWeekTodosCount = useMemo(()=>{
    const ws = (view.weekStart || '');
    if (!ws) return 0;
    return todos
      .filter(t => t && !t.done && (t.weekStartISO || '') === ws)
      .filter(t => {
        const d = (t.dateISO || '').trim();
        const dl = (t.deadlineISO || '').trim();
        return (d && d > weekEndISO) || (dl && dl > weekEndISO);
      }).length;
  }, [todos, view.weekStart, weekEndISO]);

  /* Menüpunkt "Import / Export → Prép-ybara Pocket" der Desktop-App.
     Im Browser gibt es keine Menüleiste; dort führt der Weg über die
     Einstellungen.

     Die Anmeldung steht VOR dem frühen Rückgabepfad unten: Hooks müssen
     in jeder Render-Runde in derselben Reihenfolge laufen, und solange
     die Datenbank noch lädt, endet App vorher. Was der Menüpunkt tut,
     steht deshalb in einer Referenz, die weiter unten gesetzt wird. */
  const pocketMenuRef = useRef(null);
  useEffect(()=>{
    if (typeof platform.onPocketMenu !== 'function') return undefined;
    return platform.onPocketMenu((aktion)=> pocketMenuRef.current?.(aktion));
  }, []);

  if (!db) {
    return <div className="app">
      <div className="topbar">
        <div className="left">
          <LogoButton onClick={zeigeSplashReplay} />
          <h1>Prép-ybara</h1>
        </div>
      </div>
      <div className="content"><div className="card">Lade Daten…</div></div>
      <div className="appFooter">
        <span>Prép-ybara, Version {APP_VERSION}</span>
        <span>© Florian Nowak</span>
      </div>
      <SplashOverlay
        visible={splashVisible || splashReplay}
        onDismiss={(splashReplay && !splashVisible) ? versteckeSplashReplay : null}
      />
	      <EasterEggOverlay visible={easterEggVisible} />
      <TodoReminderOverlay
        visible={todoReminderVisible}
        count={todosDueTodayCount}
        onDismiss={()=>setTodoReminderVisible(false)}
        onOpen={()=>{ setTodoReminderVisible(false); setView({ name:'todos', weekStart: lastMainView.current.weekStart }); }}
      />
      <WeekCopyDialog
        visible={showWeekCopyDialog}
        weekTodosCount={weekTodosCount}
        futureWeekTodosCount={futureWeekTodosCount}
        onClose={()=>setShowWeekCopyDialog(false)}
        onConfirm={({copyTodos, shiftTodoDates, copyDuties})=>{
          setShowWeekCopyDialog(false);
          duplicateToNextWeek({ copyTodos, shiftTodoDates, copyDuties });
        }}
      />
    </div>;
  }

  const updateWeek = (weekStart, updater) => {
    const nextDb = deepClone(db);
    const current = nextDb.weeks[weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
    nextDb.weeks[weekStart] = updater(current);
    persist(nextDb);
  };

  // opts.silent: beim Ausschneiden wird die Stunde nur verschoben – dort
  // wäre eine Lösch-Meldung mit "Rückgängig" irreführend.
  const deleteLessonAt = (weekStart, dayIndex, slotIndex, opts = {}) => {
    const k = keyOf(dayIndex, slotIndex);
    try { draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex}`); } catch {}
    const before = db;
    const nextDb = deepClone(db);
    const w = nextDb.weeks?.[weekStart];
    if (!w || !w.lessons) return;
    if (!(k in w.lessons)) return;
    /* Vor dem Löschen eine Fassung sichern. Beim Ausschneiden ist es
       kein Löschen, sondern der erste Halbschritt eines Verschiebens –
       der Anlass heisst dann auch so. */
    sichereStunde({ weekStart, dayIndex, slotIndex }, opts.silent ? 'vorVerschieben' : 'vorLoeschen');
    delete w.lessons[k];
    if (opts.silent) { persist(nextDb); return; }
    runUndoable('Stunde gelöscht', before, ()=>persist(nextDb));
  };

  /* --- Doppelstunden: verbinden und trennen -------------------------

     Beides ändert nur die Woche: die verbundene Stunde bleibt an ihrem
     ersten Platz stehen und belegt den folgenden mit. Der Folgeplatz
     trägt danach keinen eigenen Eintrag mehr – deshalb sieht jede
     Auswertung genau eine Stunde, nicht zwei halbe. */
  /* `entwurf`: der Stand, der gerade in der Einzelstunde offen ist.

     Ohne ihn ginge alles verloren, was in den letzten Augenblicken vor
     dem Klick getippt wurde – das verzögerte Speichern hat es dann noch
     nicht geschrieben. Aus dem Wochenraster heraus gibt es keinen
     Entwurf; dort zählt der gespeicherte Stand. */
  const joinLessonsIntoBlock = async (weekStart, dayIndex, slotIndex, entwurf = null) => {
    const before = db;
    const w = db?.weeks?.[weekStart];
    if (!w) return;
    const gespeichert = w.lessons?.[keyOf(dayIndex, slotIndex)];
    if (!gespeichert) return;
    const erste = entwurf ? normalizeLesson(entwurf) : gespeichert;
    const span = blockSpanOf(erste);
    const folgeSlot = slotIndex + span;
    const slots = w.slotsPerDay || 6;
    if (span >= MAX_BLOCK_SPAN) {
      showToast(`Mehr als ${MAX_BLOCK_SPAN} Stunden lassen sich nicht verbinden.`, { tone: 'warning' });
      return;
    }
    if (folgeSlot >= slots) {
      showToast('Nach dieser Stunde gibt es an dem Tag keinen weiteren Stundenplatz.', { tone: 'warning' });
      return;
    }
    const zweite = w.lessons?.[keyOf(dayIndex, folgeSlot)];
    if (!zweite) {
      showToast('Zum Verbinden braucht es eine Stunde im direkt folgenden Stundenplatz.', { tone: 'warning' });
      return;
    }
    if (!passenZusammen(erste, zweite)) {
      showToast('Verbinden geht nur bei derselben Lerngruppe – gleiche Klasse und gleiches Fach.', { tone: 'warning' });
      return;
    }
    /* Zusammen dürfen beide nicht länger werden als erlaubt. Sonst
       würde die Spanne stillschweigend gekappt – und der letzte Platz
       trüge plötzlich keine Stunde mehr. */
    if (span + blockSpanOf(zweite) > MAX_BLOCK_SPAN) {
      showToast(`Zusammen wären das mehr als ${MAX_BLOCK_SPAN} Stunden. Das lässt sich nicht verbinden.`, { tone: 'warning' });
      return;
    }

    /* Gehören die beiden zu verschiedenen Sequenzen, kann die
       verbundene Stunde nur in einer davon liegen. Das ist eine
       Entscheidung, keine Formsache – also wird gefragt. */
    const seqA = String(erste.sequenceId || '').trim();
    const seqB = String(zweite.sequenceId || '').trim();
    if (seqA && seqB && seqA !== seqB) {
      const nameA = db?.sequences?.[seqA]?.name || 'Sequenz';
      const nameB = db?.sequences?.[seqB]?.name || 'Sequenz';
      const ok = await askConfirm({
        title: 'Zwei verschiedene Sequenzen',
        body: `Die erste Stunde gehört zu „${nameA}", die zweite zu „${nameB}". Die verbundene Doppelstunde kann nur in einer Sequenz liegen – sie bleibt in „${nameA}". In „${nameB}" fällt dieser Termin damit weg.`,
        confirmLabel: 'Trotzdem verbinden',
        tone: 'danger',
      });
      if (!ok) return;
    }

    /* Eine Aufsicht zwischen den beiden Stunden bleibt gespeichert,
       wird aber nicht mehr angezeigt: innerhalb einer Doppelstunde gibt
       es keine Pause. Beim Trennen ist sie wieder da. */
    const innereAufsicht = w.duties?.[`${dayIndex}-${folgeSlot}`];

    const verbunden = verbindeStunden(erste, zweite);
    sichereSammlung(
      [
        stundenTeil({ weekStart, dayIndex, slotIndex, stunde: gespeichert }),
        stundenTeil({ weekStart, dayIndex, slotIndex: folgeSlot, stunde: zweite }),
      ],
      'vorStruktur',
      { zielLabel: `${blockName(blockSpanOf(verbunden))} verbunden` },
    );
    const nextDb = deepClone(db);
    const nw = nextDb.weeks[weekStart];
    nw.lessons[keyOf(dayIndex, slotIndex)] = verbunden;
    delete nw.lessons[keyOf(dayIndex, folgeSlot)];
    try {
      draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex}`);
      draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${folgeSlot}`);
    } catch {}
    runUndoable(`${blockName(blockSpanOf(verbunden))} verbunden`, before, ()=>persist(nextDb));
    if (innereAufsicht?.title) {
      showToast(`Die Aufsicht „${innereAufsicht.title}" zwischen den beiden Stunden wird nicht angezeigt, solange sie verbunden sind.`,
        { tone: 'warning', ttl: 8000 });
    }
  };

  const splitBlockAt = (weekStart, dayIndex, slotIndex, entwurf = null) => {
    const before = db;
    const w = db?.weeks?.[weekStart];
    const gespeichert = w?.lessons?.[keyOf(dayIndex, slotIndex)];
    if (!gespeichert) return;
    const l = entwurf ? normalizeLesson(entwurf) : gespeichert;
    const span = blockSpanOf(l);
    if (span <= 1) return;

    const teile = trenneStunde(l);
    sichereSammlung(
      belegteSlots(slotIndex, span).map(si => stundenTeil({
        weekStart, dayIndex, slotIndex: si,
        stunde: db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, si)] || null,
      })),
      'vorStruktur',
      { zielLabel: `${blockName(span)} getrennt` },
    );
    const nextDb = deepClone(db);
    const nw = nextDb.weeks[weekStart];
    teile.forEach((teil, i)=>{
      nw.lessons[keyOf(dayIndex, slotIndex + i)] = teil;
      try { draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex + i}`); } catch {}
    });
    runUndoable(`${blockName(span)} getrennt`, before, ()=>persist(nextDb));
  };

  // --- Stunden: Copy/Cut/Paste + Drag&Drop ---
  const copyLessonToClipboard = (weekStart, dayIndex, slotIndex) => {
    const l = getLessonAt(weekStart, dayIndex, slotIndex);
    // Nichts kopieren, wenn wirklich noch keine Stunde existiert
    const persisted = db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)] || null;
    if (!persisted) {
      // Wenn es nur ein Draft ist (leerer Slot), nicht in die Zwischenablage.
      if (!l || isLessonEmpty(l)) return;
    }
    const cloned = nurPlanung(deepClone(l));
    // Neue IDs für Phasen, damit du beim Kopieren nicht versehentlich identische IDs hast.
    cloned.phases = normalizePhases((cloned.phases || []).map(p => neuePhasenIds(p)), lessonTotalMin(cloned));
    setLessonClipboard({ lesson: cloned, source: { weekStart, dayIndex, slotIndex }, cut: false, copiedAt: Date.now() });
  };

  const cutLessonToClipboard = (weekStart, dayIndex, slotIndex) => {
    const persisted = db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)] || null;
    if (!persisted) return;
    const l = nurPlanung(deepClone(persisted));
    l.phases = normalizePhases((l.phases || []).map(p => neuePhasenIds(p)), lessonTotalMin(l));
    setLessonClipboard({ lesson: l, source: { weekStart, dayIndex, slotIndex }, cut: true, copiedAt: Date.now() });
    deleteLessonAt(weekStart, dayIndex, slotIndex, { silent: true });
  };

  const pasteLessonFromClipboard = async (weekStart, dayIndex, slotIndex) => {
    if (!lessonClipboard?.lesson) return;
    const woche = db?.weeks?.[weekStart];
    if (istAbgedeckt(woche, dayIndex, slotIndex)) {
      showToast('Dieser Stundenplatz gehört zu einer Doppelstunde. Trenne sie zuerst.', { tone: 'warning' });
      return;
    }
    /* Eine Doppelstunde aus der Zwischenablage braucht so viele freie
       Plätze, wie sie belegt – sonst verdeckte sie eine Planung. */
    const einfuegeSpanne = blockSpanOf(lessonClipboard.lesson);
    if (einfuegeSpanne > 1) {
      const slotsAmTag = woche?.slotsPerDay || 6;
      const passt = (slotIndex + einfuegeSpanne) <= slotsAmTag
        && belegteSlots(slotIndex, einfuegeSpanne).slice(1)
          .every(si => !woche?.lessons?.[keyOf(dayIndex, si)] && !istAbgedeckt(woche, dayIndex, si));
      if (!passt) {
        showToast(`Für eine ${blockName(einfuegeSpanne)} sind dort nicht genug freie Stundenplätze.`, { tone: 'warning' });
        return;
      }
    }
    const targetHas = !!(db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)]);
    if (targetHas) {
      const ok = await askConfirm({
        title: 'Zielstunde ist bereits belegt',
        body: 'Die dort geplante Stunde wird durch den Inhalt der Zwischenablage ersetzt. Das lässt sich nicht rückgängig machen.',
        confirmLabel: 'Überschreiben',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const l = normalizeLesson(deepClone(lessonClipboard.lesson));
    l.updatedAt = new Date().toISOString();
    if (targetHas) sichereStunde({ weekStart, dayIndex, slotIndex }, 'vorImport');
    updateLessonAt(weekStart, dayIndex, slotIndex, l);
    if (lessonClipboard.cut) setLessonClipboard(null);
  };

  const moveOrCopyLessonByDnd = async ({ from, to, mode = 'move' }) => {
    const f = from || {};
    const t = to || {};
    if (!f.weekStart || !t.weekStart) return;
    if (f.weekStart === t.weekStart && f.dayIndex === t.dayIndex && f.slotIndex === t.slotIndex) return;

    if (istAbgedeckt(db?.weeks?.[t.weekStart], t.dayIndex, t.slotIndex)) {
      showToast('Dieser Stundenplatz gehört zu einer Doppelstunde. Trenne sie zuerst.', { tone: 'warning' });
      return;
    }

    const nextDb = deepClone(db);
    if (!nextDb.weeks) nextDb.weeks = {};
    const fromW = nextDb.weeks[f.weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
    if (!nextDb.weeks[f.weekStart]) nextDb.weeks[f.weekStart] = fromW;
    if (!fromW.lessons) fromW.lessons = {};
    const toW = nextDb.weeks[t.weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
    if (!nextDb.weeks[t.weekStart]) nextDb.weeks[t.weekStart] = toW;
    if (!toW.lessons) toW.lessons = {};

    const fromKey = keyOf(f.dayIndex, f.slotIndex);
    const toKey = keyOf(t.dayIndex, t.slotIndex);
    const srcRaw = fromW.lessons?.[fromKey];
    if (!srcRaw) return;

    const src = normalizeLesson(deepClone(srcRaw));
    const now = new Date().toISOString();

    /* Eine Doppelstunde braucht am Ziel so viele freie Plätze, wie sie
       belegt. Sonst schöbe sie sich lautlos über eine andere Planung. */
    const srcSpan = blockSpanOf(src);
    if (srcSpan > 1) {
      const zielSlots = t.slotsPerDay || toW.slotsPerDay || 6;
      const platzReicht = (t.slotIndex + srcSpan) <= zielSlots;
      const frei = belegteSlots(t.slotIndex, srcSpan).slice(1).every(si => {
        const k = keyOf(t.dayIndex, si);
        /* Nur beim Verschieben gibt die Stunde ihre bisherigen Plätze
           frei. Beim Kopieren bleibt sie liegen – dort ist kein Platz. */
        const belegtVonQuelle = mode !== 'copy'
          && (f.weekStart === t.weekStart)
          && belegteSlots(f.slotIndex, srcSpan).includes(si) && f.dayIndex === t.dayIndex;
        if (belegtVonQuelle) return true;
        return !toW.lessons?.[k] && !istAbgedeckt(toW, t.dayIndex, si);
      });
      if (!platzReicht || !frei) {
        showToast(`Für eine ${blockName(srcSpan)} sind dort nicht genug freie Stundenplätze.`, { tone: 'warning' });
        return;
      }
    }

    /* Die Stände VOR der Bewegung – gelesen aus `db`, nicht aus der
       bereits veränderten Kopie. Sie bilden einen Vorgang: wer ihn
       wiederherstellt, bekommt Quelle und Ziel gemeinsam zurück. */
    const teilVon = (ws, di, si)=> stundenTeil({
      weekStart: ws, dayIndex: di, slotIndex: si,
      stunde: db?.weeks?.[ws]?.lessons?.[keyOf(di, si)] || null,
    });

    const upsertIn = (w, key, lesson) => {
      const l = normalizeLesson(lesson);
      w.lessons[key] = { ...l, updatedAt: now };
      rememberClassGroupIn(nextDb, l.classGroup);
      rememberSubjectIn(nextDb, l.subject);
      ensureGroupColorIn(nextDb, l.classGroup, l.subject);
      // Draft cache invalidieren
      try {
        const parts = key.split('-');
        const di = Number(parts[0]);
        const si = Number(parts[1]);
        draftLessonCacheRef.current.delete(`${w === fromW ? f.weekStart : t.weekStart}|${di}|${si}`);
      } catch {}
    };

    if (mode === 'copy') {
      if (toW.lessons?.[toKey]) {
        const ok = await askConfirm({
          title: 'Zielstunde ist bereits belegt',
          body: 'Die dort geplante Stunde wird durch die kopierte ersetzt. Das lässt sich nicht rückgängig machen.',
          confirmLabel: 'Überschreiben',
          tone: 'danger',
        });
        if (!ok) return;
      }
      const cloned = nurPlanung(deepClone(src));
      cloned.phases = normalizePhases((cloned.phases || []).map(p => neuePhasenIds(p)), lessonTotalMin(cloned));
      if (toW.lessons?.[toKey]) {
        sichereStunde({ weekStart: t.weekStart, dayIndex: t.dayIndex, slotIndex: t.slotIndex }, 'vorImport');
      }
      upsertIn(toW, toKey, cloned);
      persist(nextDb);
      return;
    }

    // move (standard): swap, wenn Ziel belegt
    const dstRaw = toW.lessons?.[toKey];
    if (dstRaw) {
      const dst = normalizeLesson(deepClone(dstRaw));
      /* Getauscht wird nur zwischen Einzelstunden.

         Sobald eine der beiden mehr als einen Platz belegt, ist der
         Tausch nicht mehr eindeutig: die verdrängte Stunde landete
         sonst auf einem Platz, den die andere gerade mit abdeckt. Dann
         lieber sagen, was zu tun ist, als etwas zu verdecken. */
      if (blockSpanOf(dst) > 1 || srcSpan > 1) {
        const welche = blockSpanOf(dst) > 1 ? blockSpanOf(dst) : srcSpan;
        showToast(`Eine ${blockName(welche)} lässt sich nicht mit einer belegten Stunde tauschen. Wähle einen freien Platz oder trenne sie zuerst.`, { tone: 'warning' });
        return;
      }
      sichereSammlung(
        [teilVon(f.weekStart, f.dayIndex, f.slotIndex), teilVon(t.weekStart, t.dayIndex, t.slotIndex)],
        'vorVerschieben',
        { zielLabel: 'Zwei Stunden getauscht' },
      );
      upsertIn(toW, toKey, src);
      upsertIn(fromW, fromKey, dst);
      persist(nextDb);
      return;
    }

    // Ziel leer: verschieben
    sichereSammlung(
      [teilVon(f.weekStart, f.dayIndex, f.slotIndex), teilVon(t.weekStart, t.dayIndex, t.slotIndex)],
      'vorVerschieben',
      { zielLabel: 'Stunde verschoben' },
    );
    upsertIn(toW, toKey, src);
    if (fromKey in fromW.lessons) delete fromW.lessons[fromKey];
    try { draftLessonCacheRef.current.delete(`${f.weekStart}|${f.dayIndex}|${f.slotIndex}`); } catch {}
    persist(nextDb);
  };

  const upsertDutyAt = (weekStart, dayIndex, pos, title) => {
    const t = (title || '').trim();
    const key = `${dayIndex}-${pos}`;
    const nextDb = deepClone(db);
    if (!nextDb.weeks) nextDb.weeks = {};
    const w = nextDb.weeks[weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
    if (!nextDb.weeks[weekStart]) nextDb.weeks[weekStart] = w;
    if (!w.duties) w.duties = {};
    if (!t) {
      if (key in w.duties) delete w.duties[key];
      persist(nextDb);
      return;
    }
    const existing = w.duties[key];
    w.duties[key] = { id: existing?.id || uid(), title: t };
    rememberSupervisionIn(nextDb, t);
    persist(nextDb);
  };

  const deleteDutyAt = (weekStart, dayIndex, pos) => {
    const before = db;
    const key = `${dayIndex}-${pos}`;
    const nextDb = deepClone(db);
    const w = nextDb.weeks?.[weekStart];
    if (!w || !w.duties) return;
    if (key in w.duties) {
      delete w.duties[key];
      runUndoable('Aufsicht gelöscht', before, ()=>persist(nextDb));
    }
  };


/* Heisser Pfad: läuft bei jeder Eingabe in der Einzelstunde.

   Früher wurde hier die vollständige Datenbank geklont. Bei 40 Wochen à
   50 Stunden kostet dieser Klon rund 55 ms – bei jedem Tastenanschlag,
   synchron, vor dem eigentlichen Speichern. Das ist derselbe Fehler wie
   beim Gesamtblob, nur im Arbeitsspeicher.

   Jetzt wird nur der geänderte Pfad kopiert. Alle übrigen Wochen behalten
   ihre Identität – dadurch erkennt der Plattform-Adapter unveränderte
   Wochen an der Referenz und muss sie nicht einmal serialisieren. */
const updateLessonAt = (weekStart, dayIndex, slotIndex, nextLesson) => {
  const l = normalizeLesson(nextLesson);
  const prevWeeks = db?.weeks || {};
  const prevWeek = prevWeeks[weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
  const prevHidden = db?.hiddenSuggestions || {};

  const nextDb = {
    ...db,
    classGroups: { ...(db?.classGroups || {}) },
    subjects: { ...(db?.subjects || {}) },
    groupColors: { ...(db?.groupColors || {}) },
    hiddenSuggestions: {
      ...prevHidden,
      classGroups: { ...(prevHidden.classGroups || {}) },
      subjects: { ...(prevHidden.subjects || {}) },
    },
    weeks: {
      ...prevWeeks,
      [weekStart]: {
        ...prevWeek,
        lessons: {
          ...(prevWeek.lessons || {}),
          [keyOf(dayIndex, slotIndex)]: { ...l, updatedAt: new Date().toISOString() },
        },
      },
    },
  };
  rememberClassGroupIn(nextDb, l.classGroup);
  rememberSubjectIn(nextDb, l.subject);
  ensureGroupColorIn(nextDb, l.classGroup, l.subject);

  // This slot now has a persisted lesson; drop any cached draft.
  try { draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex}`); } catch {}
  persist(nextDb);
};

/* Der Weg, den der Stundeneditor nimmt.

   Er unterscheidet sich von updateLessonAt in genau einem Punkt: bevor
   eine Bearbeitung geschrieben wird, wandert der bisherige Stand in den
   Versionsverlauf. Die Bündelung dort macht daraus EINE Fassung je
   Bearbeitung – nicht eine je Tastendruck.

   Bewusst nicht in updateLessonAt selbst: dort kommen auch Vorgänge
   vorbei, die ihre Fassung schon mit dem passenden Anlass gesichert
   haben (Import, Verschieben, Einfügen). Sonst entstünden zwei
   Einträge für dieselbe Änderung. */
const updateLessonFromEditor = (weekStart, dayIndex, slotIndex, nextLesson) => {
  const vorher = db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)] || null;
  if (vorher) {
    const felder = geaenderteFelder(vorher, normalizeLesson(nextLesson));
    if (felder.length) sichereStunde({ weekStart, dayIndex, slotIndex }, 'bearbeitet', { felder, stunde: vorher });
  }
  updateLessonAt(weekStart, dayIndex, slotIndex, nextLesson);
};

  // Read a lesson without creating/persisting anything (important: no side effects during render).
  const getLessonAt = (weekStart, dayIndex, slotIndex) => {
    const k = keyOf(dayIndex, slotIndex);
    const raw = db?.weeks?.[weekStart]?.lessons?.[k] || null;
    if (raw) return normalizeLesson(raw);

    // No persisted lesson yet → return a cached draft (stable IDs, stable local editing).
    const dk = `${weekStart}|${dayIndex}|${slotIndex}`;
    const cache = draftLessonCacheRef.current;
    if (cache.has(dk)) return normalizeLesson(cache.get(dk));
    const draft = defaultLesson();
    /* Neue Stunden starten mit dem in den Einstellungen hinterlegten
       Profil. Bestehende Stunden werden davon nie berührt – sie tragen
       ihr eigenes. */
    draft.planningProfile = normalisiereProfilId(db?.appSettings?.defaultPlanningProfile);
    cache.set(dk, draft);
    return normalizeLesson(draft);
  };

  const hasLessonAt = (weekStart, dayIndex, slotIndex) => {
    const k = keyOf(dayIndex, slotIndex);
    return Boolean(db?.weeks?.[weekStart]?.lessons?.[k]);
  };


  const onSelectWeekDate = (iso) => {
    setSelectedDate(iso);
    const monday = startOfWeekMonday(fromISODate(iso));
    setView({ name:'week', weekStart: toISODate(monday) });
  };

  const goWeekDelta = (deltaWeeks) => {
    const currMonday = fromISODate(view.weekStart);
    let targetMondayISO = toISODate(addDays(currMonday, 7 * (deltaWeeks || 0)));

    // Optional: an Schuljahr-Grenzen ausrichten
    const minWeekISO = minDate ? toISODate(startOfWeekMonday(fromISODate(minDate))) : undefined;
    const maxWeekISO = maxDate ? toISODate(startOfWeekMonday(fromISODate(maxDate))) : undefined;
    if (minWeekISO && targetMondayISO < minWeekISO) targetMondayISO = minWeekISO;
    if (maxWeekISO && targetMondayISO > maxWeekISO) targetMondayISO = maxWeekISO;

    onSelectWeekDate(targetMondayISO);
  };

  const duplicateToNextWeek = ({ copyTodos = false, shiftTodoDates = true, copyDuties = true } = {}) => {
  const currStart = fromISODate(view.weekStart);
  const nextStart = toISODate(addDays(currStart, 7));
  const currentWeek = db.weeks[view.weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };

  const currStartISO = view.weekStart;
  const currEndISO = toISODate(addDays(fromISODate(view.weekStart), 4));

  const shiftIfInWeek = (iso) => {
    const d = (iso || '').trim();
    if (!d) return '';
    if (!shiftTodoDates) return d;
    // Nur Datumsangaben innerhalb der Woche verschieben – spätere Deadlines bleiben unverändert.
    if (d >= currStartISO && d <= currEndISO) return shiftISOByDays(d, 7);
    return d;
  };



  // Beim Übernehmen in die nächste Woche sollen nur Klasse + Fach + Raum übernommen werden.
  // Inhalte (Thema, Ziele, Phasen, Notizen, Sequenz, Kompetenzen …) werden bewusst NICHT kopiert.
  const nextWeek = { slotsPerDay: currentWeek.slotsPerDay || 6, lessons: {}, duties: copyDuties ? deepClone(currentWeek.duties || {}) : {} };
  for (const k of Object.keys(currentWeek.lessons || {})) {
    const src = currentWeek.lessons?.[k] || {};
    const l = defaultLesson();
    l.subject = src.subject || '';
    l.classGroup = src.classGroup || '';
    l.room = src.room || '';
    /* Die Länge gehört zum Stundenplan, nicht zum Inhalt: eine
       Doppelstunde ist in der nächsten Woche wieder eine. Ohne diese
       Zeile verschwände die zweite Stunde – ihr Platz trägt ja keinen
       eigenen Eintrag. */
    l.blockSpan = blockSpanOf(src);
    l.phases = normalizePhases(l.phases, TOTAL_MIN * l.blockSpan);
    /* Inhalte werden bewusst nicht übernommen – das Planungsprofil aber
       schon: es beschreibt, WIE geplant wird, nicht WAS geplant wurde. */
    l.planningProfile = normalisiereProfilId(src.planningProfile || db?.appSettings?.defaultPlanningProfile);
    l.customPlanningFields = normalisiereFeldListe(src.customPlanningFields);
    l.updatedAt = new Date().toISOString();
    nextWeek.lessons[k] = l;
  }

  const nextDb = deepClone(db);
  if (!nextDb.weeks) nextDb.weeks = {};
  nextDb.weeks[nextStart] = nextWeek;

  // Lerngruppen (Klasse||Fach) und ihre Farben merken
  for (const l of Object.values(nextWeek.lessons || {})){
    ensureGroupColorIn(nextDb, l?.classGroup, l?.subject);
    rememberClassGroupIn(nextDb, l?.classGroup);
    rememberSubjectIn(nextDb, l?.subject);
  }

  // Optional: To-dos dieser Woche übernehmen
  if (copyTodos){
    const existing = Array.isArray(nextDb.todos) ? nextDb.todos : [];
    const srcTodos = existing.filter(t => t && !t.done && (t.weekStartISO || '') === view.weekStart);
    const copied = srcTodos.map(t => ({
      ...t,
      id: uid(),
      done: false,
      weekStartISO: nextStart,
      createdAt: new Date().toISOString(),
      dateISO: shiftIfInWeek(t.dateISO),
      deadlineISO: shiftIfInWeek(t.deadlineISO)
    }));
    nextDb.todos = [...copied, ...existing];
  }

  persist(nextDb);
  setView({ name:'week', weekStart: nextStart });
};

  /* Bei Pfadangaben gehört ein Weg zur Datei an die Meldung – sonst muss
     man sich den Pfad merken und ihn im Dateimanager nachbauen. */
  const toastSavedPath = (text, pathStr) => {
    showToast(text, {
      tone: 'success',
      action: capabilities.revealInFolder ? {
        label: 'Ordner öffnen',
        onAct: async ()=>{
          const res = await platform.revealPath(pathStr);
          if (res && res.ok === false && res.error) showToast(`Konnte Ordner nicht öffnen: ${res.error}`, { tone: 'danger' });
        },
      } : null,
    });
  };

  /* ---- Prép-ybara Pocket ---------------------------------------------
     Zwei Wege, beide dateibasiert. Erzeugt und geprüft wird in der
     gemeinsamen Schicht (shared/exchange); hier steht nur, was die App
     damit tut. */

  const exportPocketProfile = async () => {
    if (!capabilities.pocketFiles || typeof platform.exportPocketProfile !== 'function') {
      showToast('Der Profil-Export ist in dieser Umgebung nicht verfügbar.', { tone: 'warning' });
      return;
    }
    try {
      const profil = buildPocketProfile(db, { todayISO, appVersion: APP_VERSION });
      const inhalt = JSON.stringify(profil, null, 2);
      const pfad = await platform.exportPocketProfile({ content: inhalt, fileName: pocketProfilDateiname() });
      if (!pfad) return;                       // Abbruch ist kein Fehler
      showToast(`Pocket-Profil gespeichert: ${profil.groups.length} Lerngruppen, ${profil.competencies.length} Kompetenzen.`);
    } catch (err) {
      showToast(`Das Profil konnte nicht gespeichert werden: ${String(err?.message || err)}`, { tone: 'warning' });
    }
  };

  /* Führt genau einen Import aus. Über runUndoable, damit Strg+Z auch
     ein versehentliches "Pocketplanung verwenden" zurücknimmt. */
  const importPocketStunde = ({ analyse, ziel, modus, kompetenzen = [], sprechabsichten = [] }) => {
    if (!ziel) {
      showToast('Ohne Datum und Stunde kann nicht importiert werden.', { tone: 'warning' });
      return null;
    }
    try {
      const vorher = db;
      /* Was am Zielplatz steht, wird ersetzt oder ergänzt – in beiden
         Fällen gehört der bisherige Stand in den Versionsverlauf. */
      sichereStunde(ziel, 'vorImport');
      const nextDb = deepClone(db);
      const ergebnis = fuehrePocketImportAus(nextDb, {
        stunde: analyse.stunde,
        modus,
        ziel,
        klasse: analyse.klasse.label,
        fach: analyse.fach.label,
        kompetenzenUebernehmen: kompetenzen,
        sprechabsichtenUebernehmen: sprechabsichten,
      }, { uid, defaultLesson, normalizeLesson });
      runUndoable('Pocket-Import', vorher, ()=>persist(nextDb));
      showToast(
        modus === POCKET_MODI.ANHAENGEN
          ? 'Pocket-Phasen an die bestehende Stunde angehängt.'
          : 'Stunde aus Pocket importiert.'
      );
      return ergebnis;
    } catch (err) {
      showToast(`Import nicht möglich: ${String(err?.message || err)}`, { tone: 'warning' });
      return null;
    }
  };

  /* Jetzt sind beide Wege bekannt. Die Zuweisung geschieht in der
     Render-Runde, nicht in einem Effekt: ein zweiter Effekt an dieser
     Stelle läge wieder hinter dem frühen Rückgabepfad. */
  pocketMenuRef.current = (aktion)=>{
    /* Der Pocket-Austausch bezieht sich immer auf das laufende
       Schuljahr. Aus dem Menü heraus ist er auch in der Archivansicht
       erreichbar – deshalb hier derselbe Riegel wie sonst. */
    if (imArchiv) { archivHinweisRef.current?.(); return; }
    if (aktion === 'export-profile') exportPocketProfile();
    else setView({ name: 'pocket', weekStart: view.weekStart });
  };

  const exportBackup = async () => {
    // Der Hinweis gehört an die Stelle, wo er zählt: Wer exportiert, will
    // die Planung oft in die jeweils andere Fassung übertragen.
    showToast('Backup ist die Brücke zwischen Desktop-App und Browser-Version – beide teilen ihre Daten nicht.', { ttl: 8000 });
    if (!capabilities.backupFiles) {
      showToast('Backup-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }
    const path = await platform.exportBackup();
    if (path) toastSavedPath('Backup gespeichert.', path);
    /* Vermerkt für die Einführung: Wer gesichert hat, braucht keine
       Backup-Empfehlung mehr. Der Vermerk gehört zum Onboarding, nicht
       zur Planung. */
    if (path) setzeOnboarding(setzeBackupZeitpunkt(onboarding));
  };

  /* Rückgabe: ob tatsächlich etwas eingelesen wurde. Die Einführung
     entscheidet daran, ob der Schnellstart noch etwas zu tun hat. */
  const importBackup = async () => {
    if (!capabilities.backupFiles) {
      showToast('Backup-Import ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return false;
    }
    /* Ein Backup wird nicht dazugelegt, es tritt an die Stelle von
       allem. Seit sich auch einzelne archivierte Schuljahre als Backup
       ausgeben lassen, ist die Verwechslungsgefahr real – deshalb wird
       vorher gefragt. */
    const anzahlArchive = (Array.isArray(liveDb?.schoolYearArchives) ? liveDb.schoolYearArchives : []).length;
    const ok = await askConfirm({
      title: 'Backup importieren',
      body: `Das Backup ersetzt alle Daten dieser App – das laufende Schuljahr${anzahlArchive ? ` und ${anzahlArchive} archivierte ${anzahlArchive === 1 ? 'Schuljahr' : 'Schuljahre'}` : ''}. Am besten vorher ein eigenes Backup exportieren.`,
      confirmLabel: 'Backup importieren',
      tone: 'danger',
    });
    if (!ok) return false;
    const imported = await platform.importBackup();
    if (imported) {
      persist(ensureDbShape(imported));
      showToast('Backup importiert.', { tone: 'success' });
      return true;
    }
    return false;
  };
  /* Die Willkommensansicht benutzt denselben Import – kein zweiter Weg. */
  importBackupRef.current = importBackup;

  const createSequence = (name) => {
    // If user cancelled a prompt, keep quiet.
    if (name == null) return null;
    const n = String(name || '').trim();
    if (!n) {
      // Previously this failed silently and felt like "not allowed".
      showToast('Bitte einen Sequenznamen eingeben.', { tone: 'warning' });
      return null;
    }
    const nextDb = deepClone(db);
    if (!nextDb.sequences) nextDb.sequences = {};
    const id = uid();
    const color = SEQ_COLORS[Object.keys(nextDb.sequences).length % SEQ_COLORS.length];
    nextDb.sequences[id] = { id, name: n, color, createdAt: new Date().toISOString(), files: [] };
    persist(nextDb);
    return id;
  };

  const updateSequence = (id, patch) => {
    const nextDb = deepClone(db);
    if (!nextDb.sequences?.[id]) return;
    nextDb.sequences[id] = { ...nextDb.sequences[id], ...patch, id };
    persist(nextDb);
  };

  /* Eine Sequenz duplizieren.

     Kopiert wird die Sequenz selbst – Name, Farbe, Schwerpunkt,
     Zielaufgabe. Die Stunden bleiben bei der ursprünglichen Sequenz:
     eine Kopie ist ein neuer Rahmen, keine zweite Belegung derselben
     Stundenplätze. */
  const duplicateSequence = (id) => {
    const quelle = db?.sequences?.[id];
    if (!quelle) return null;
    const nextDb = deepClone(db);
    const neueId = uid();
    nextDb.sequences[neueId] = {
      ...deepClone(quelle),
      id: neueId,
      name: `${String(quelle.name || 'Sequenz').trim()} (Kopie)`,
      createdAt: new Date().toISOString(),
      files: [],
    };
    persist(nextDb);
    showToast('Sequenz dupliziert.', { tone: 'success' });
    return neueId;
  };

  const deleteSequence = (id) => {
    const before = db;
    const nextDb = deepClone(db);
    if (!nextDb.sequences?.[id]) return;
    sichereSequenz(id, 'vorLoeschen');
    delete nextDb.sequences[id];
    // Remove references in lessons
    for (const ws of Object.keys(nextDb.weeks || {})) {
      const w = nextDb.weeks[ws];
      if (!w?.lessons) continue;
      for (const k of Object.keys(w.lessons)) {
        const l = w.lessons[k];
        if (l?.sequenceId === id) w.lessons[k] = { ...l, sequenceId: '' };
      }
    }
    /* Jahresbalken, die auf diese Sequenz zeigten, BLEIBEN – sie
       verlieren nur ihre Verknüpfung. Ein Balken ist eine eigene
       Planung; ihn mit der Sequenz zu löschen wäre eine stille
       Datenvernichtung. */
    const balkenVorher = (Array.isArray(db?.yearBars) ? db.yearBars : [])
      .filter(b => balkenSequenzId(b) === id);
    nextDb.yearBars = entferneSequenzAusBalken(nextDb.yearBars, id);
    runUndoable('Sequenz gelöscht', before, ()=>persist(nextDb));
    if (balkenVorher.length) {
      showToast(`${balkenVorher.length === 1 ? 'Ein Jahresbalken bleibt' : `${balkenVorher.length} Jahresbalken bleiben`} erhalten – ohne Verknüpfung.`);
    }
  };

  // --- Jahresgrobplanung (Orientierungs-Balken) ---
  const createYearBar = (payload) => {
    const p = (payload && typeof payload === 'object') ? payload : {};
    const title = String(p.title || '').trim();
    if (!title) {
      showToast('Bitte einen Titel für den Balken eingeben.', { tone: 'warning' });
      return null;
    }
    const startISO = String(p.startISO || '').trim();
    const endISO = String(p.endISO || '').trim();
    if (!startISO || !endISO) {
      showToast('Bitte Start- und Enddatum wählen.', { tone: 'warning' });
      return null;
    }
    if (endISO < startISO) {
      showToast('Enddatum muss nach dem Startdatum liegen.', { tone: 'warning' });
      return null;
    }

    const nextDb = deepClone(db);
    if (!Array.isArray(nextDb.yearBars)) nextDb.yearBars = [];
    const id = uid();
    const now = new Date().toISOString();
    const color = String(p.color || '').trim() || SEQ_COLORS[nextDb.yearBars.length % SEQ_COLORS.length];
    nextDb.yearBars.push({
      id,
      title,
      classGroup: String(p.classGroup || '').trim(),
      subject: String(p.subject || '').trim(),
      startISO,
      endISO,
      color,
      /* Optional und leer voreingestellt: der Balken zeigt auf keine
         Sequenz, solange niemand eine wählt. */
      sequenceId: String(p.sequenceId || '').trim(),
      createdAt: now,
      updatedAt: now
    });
    persist(nextDb);
    return id;
  };

  /* Einen Balken ändern.

     `live`: während des Ziehens läuft diese Funktion viele Male je
     Sekunde. Dann entsteht KEIN Sicherungspunkt – sonst schriebe jedes
     Einzelbild in den Versionsverlauf. Gesichert wird beim Abschluss
     der Bewegung und bei jeder Änderung aus dem Dialog. */
  const updateYearBar = (id, patch, { live = false } = {}) => {
    const nextDb = deepClone(db);
    const arr = Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [];
    const idx = arr.findIndex(b => b?.id === id);
    if (idx < 0) return;
    const curr = arr[idx];
    const p = (patch && typeof patch === 'object') ? patch : {};
    const next = { ...curr, ...p, id, updatedAt: new Date().toISOString() };
    // minimal validation
    if (next.startISO && next.endISO && next.endISO < next.startISO) return;
    /* Ein verknüpfter Balken gehört zu einer Sequenz – seine Änderung
       ist deshalb eine, die man zurücknehmen können will. */
    if (!live && (balkenSequenzId(curr) || balkenSequenzId(next))) {
      sichereBalken(id, 'vorBalken');
    }
    arr[idx] = next;
    nextDb.yearBars = arr;
    persist(nextDb);
  };

  /* Eine Zeile der Jahresplanung leeren: die Balken gehen, die Zeile
     bleibt. Damit sie ohne Balken sichtbar bleibt, wird sie in
     `yearPlanLanes` vermerkt. */
  const clearYearPlanLane = (laneKey) => {
    const before = db;
    const { classGroup, subject } = jahresZeileTeile(laneKey);
    const nextDb = deepClone(db);
    const alle = Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [];
    nextDb.yearBars = alle.filter(b => jahresZeileKey(b?.classGroup, b?.subject) !== laneKey);
    if (!Array.isArray(nextDb.yearPlanLanes)) nextDb.yearPlanLanes = [];
    const schonDa = nextDb.yearPlanLanes.some(l => jahresZeileKey(l.classGroup, l.subject) === laneKey);
    if (!schonDa) nextDb.yearPlanLanes.push({ classGroup, subject });
    runUndoable(`${jahresZeileLabel(laneKey)}: Jahresplanung geleert`, before, ()=>persist(nextDb));
  };

  /* Eine Zeile ganz aus der Jahresplanung nehmen.

     Ausdrücklich NICHT dasselbe wie "Lerngruppe löschen": Stunden,
     Sequenzen, Farben und Kompetenzen der Lerngruppe bleiben
     unverändert. Es verschwindet nur diese Zeile samt ihrer
     Orientierungsbalken – und das lässt sich rückgängig machen. */
  const removeYearPlanLane = async (laneKey) => {
    const anzahl = (Array.isArray(db?.yearBars) ? db.yearBars : [])
      .filter(b => jahresZeileKey(b?.classGroup, b?.subject) === laneKey).length;
    if (anzahl > 0) {
      const ok = await askConfirm({
        title: 'Aus Jahresplanung entfernen',
        body: `Diese Lerngruppe enthält ${anzahl} ${anzahl === 1 ? 'geplanten Balken' : 'geplante Balken'}. Wirklich aus der Jahresplanung entfernen? Die Lerngruppe selbst bleibt mit allen Stunden und Sequenzen erhalten.`,
        confirmLabel: 'Entfernen',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const before = db;
    const nextDb = deepClone(db);
    nextDb.yearBars = (Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [])
      .filter(b => jahresZeileKey(b?.classGroup, b?.subject) !== laneKey);
    nextDb.yearPlanLanes = (Array.isArray(nextDb.yearPlanLanes) ? nextDb.yearPlanLanes : [])
      .filter(l => jahresZeileKey(l.classGroup, l.subject) !== laneKey);
    runUndoable(`${jahresZeileLabel(laneKey)} wurde aus der Jahresplanung entfernt`, before, ()=>persist(nextDb));
  };

  /* Klasse und Fach einer Zeile ändern. Es werden die Balken dieser
     Zeile umgeschrieben – an den Stunden der Lerngruppe ändert sich
     nichts. */
  const renameYearPlanLane = async (laneKey) => {
    const teile = jahresZeileTeile(laneKey);
    const klasse = await askPrompt({
      title: 'Lerngruppe bearbeiten',
      label: 'Klasse/Kurs (leer lassen für „Allgemein“)',
      initialValue: teile.classGroup,
      confirmLabel: 'Weiter',
      erlaubeLeer: true,
    });
    if (klasse === null) return;
    const fach = await askPrompt({
      title: 'Lerngruppe bearbeiten',
      label: 'Fach (optional)',
      initialValue: teile.subject,
      confirmLabel: 'Übernehmen',
      erlaubeLeer: true,
    });
    if (fach === null) return;

    const neuerKey = jahresZeileKey(klasse, fach);
    if (neuerKey === laneKey) return;

    const before = db;
    const nextDb = deepClone(db);
    const g = String(klasse || '').trim();
    const f = String(fach || '').trim();
    nextDb.yearBars = (Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [])
      .map(b => (jahresZeileKey(b?.classGroup, b?.subject) === laneKey
        ? { ...b, classGroup: g, subject: f, updatedAt: new Date().toISOString() }
        : b));
    const lanes = (Array.isArray(nextDb.yearPlanLanes) ? nextDb.yearPlanLanes : [])
      .filter(l => jahresZeileKey(l.classGroup, l.subject) !== laneKey);
    const trägtBalken = nextDb.yearBars.some(b => jahresZeileKey(b?.classGroup, b?.subject) === neuerKey);
    const schonDa = lanes.some(l => jahresZeileKey(l.classGroup, l.subject) === neuerKey);
    if (!trägtBalken && !schonDa) lanes.push({ classGroup: g, subject: f });
    nextDb.yearPlanLanes = lanes;
    runUndoable(`Lerngruppe geändert: ${jahresZeileLabel(neuerKey)}`, before, ()=>persist(nextDb));
  };

  const deleteYearBar = (id) => {
    const before = db;
    sichereBalken(id, 'vorLoeschen');
    const nextDb = deepClone(db);
    nextDb.yearBars = (Array.isArray(nextDb.yearBars) ? nextDb.yearBars : []).filter(b => b?.id !== id);
    runUndoable('Balken gelöscht', before, ()=>persist(nextDb));
  };

  const rememberCompetency = (label) => {
    const l = (label || '').trim();
    if (!l || l.length < 2) return;
    const nextDb = deepClone(db);
    if (!nextDb.competencies) nextDb.competencies = {};
    if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {}, competencies: {}, supervisionLabels: {} };
    if (!nextDb.hiddenSuggestions.competencies) nextDb.hiddenSuggestions.competencies = {};
    // If the user re-enters a previously removed suggestion, show it again.
    if (nextDb.hiddenSuggestions.competencies[l]) delete nextDb.hiddenSuggestions.competencies[l];
    const existing = nextDb.competencies[l] || { count: 0, lastUsed: '' };
    existing.count = (existing.count || 0) + 1;
    existing.lastUsed = new Date().toISOString();
    nextDb.competencies[l] = existing;
    persist(nextDb);
  };

  /* ============================================================
     Kompetenzkatalog

     Alles hier arbeitet auf Etiketten, weil die Stunden Etiketten
     speichern. Die Funktionen fassen deshalb nie eine Stunde an – mit
     einer begründeten Ausnahme: Umbenennen. Bliebe eine Stunde beim
     alten Namen, hätte die Lehrkraft danach zwei Kompetenzen statt
     einer, und die Jahresübersicht zählte getrennt. Ein Umbenennen ist
     genau das Versprechen, dass es dieselbe Kompetenz bleibt.
     ============================================================ */

  const updateCompetencyModel = (aendern) => {
    const nextDb = deepClone(db);
    const modell = normalisiereModell(nextDb.competencyModel);
    nextDb.competencyModel = normalisiereModell(aendern(modell) || modell);
    persist(nextDb);
  };

  /* Ausblenden ist die zurückhaltende Geste: die Kompetenz verschwindet
     aus der Auswahl, bleibt aber in allen Stunden und in der Übersicht
     stehen und lässt sich jederzeit wieder einblenden. */
  const setCompetencyHidden = (label, hidden) => {
    const l = normalisiereEtikett(label);
    if (!l) return;
    updateCompetencyModel((m)=>{
      const next = { ...m, hidden: { ...m.hidden } };
      if (hidden) next.hidden[l] = true; else delete next.hidden[l];
      return next;
    });
  };

  const setCompetencyArea = (label, bereichId) => {
    const l = normalisiereEtikett(label);
    if (!l || istSystemKompetenz(l)) return;
    updateCompetencyModel((m)=>{
      const next = { ...m, areaOf: { ...m.areaOf } };
      if (bereichId && bereichId !== OHNE_BEREICH_ID) next.areaOf[l] = bereichId;
      else delete next.areaOf[l];
      return next;
    });
  };

  /* Umbenennen: das Etikett wird überall dort ersetzt, wo es steht –
     im Katalog, in jeder Stunde, in jeder Sequenz und in jeder Vorlage.
     Trifft der neue Name auf ein bereits vorhandenes Etikett, werden
     beide zusammengeführt statt verdoppelt. */
  const renameCompetency = (vonLabel, nachLabel) => {
    const alt = normalisiereEtikett(vonLabel);
    const neu = normalisiereEtikett(nachLabel);
    if (!alt || !neu || alt === neu) return;
    if (istSystemKompetenz(alt)) return;   // Systemnamen bleiben, wie sie sind

    const before = db;
    const nextDb = deepClone(db);
    const tausch = (x)=> (String(x || '').trim() === alt ? neu : x);
    const tauschListe = (arr)=> Array.from(new Set(
      (Array.isArray(arr) ? arr : []).map(x => tausch(String(x || '').trim())).filter(Boolean)
    ));

    for (const woche of Object.values(nextDb.weeks || {})) {
      for (const stunde of Object.values(woche?.lessons || {})) {
        if (!stunde || typeof stunde !== 'object') continue;
        stunde.competencies = tauschListe(stunde.competencies);
        stunde.primaryCompetency = tausch(stunde.primaryCompetency || '');
      }
    }
    for (const seq of Object.values(nextDb.sequences || {})) {
      if (!seq || typeof seq !== 'object') continue;
      seq.competencies = tauschListe(seq.competencies);
      seq.primaryCompetency = tausch(seq.primaryCompetency || '');
    }
    for (const tpl of Object.values(nextDb.sequenceTemplates || {})) {
      for (const l of (Array.isArray(tpl?.lessons) ? tpl.lessons : [])) {
        if (!l || typeof l !== 'object') continue;
        l.competencies = tauschListe(l.competencies);
        l.primaryCompetency = tausch(l.primaryCompetency || '');
      }
    }

    // Katalog: Nutzungszähler zusammenführen, Zuordnung und Ausblendung mitnehmen.
    const komp = nextDb.competencies || {};
    if (komp[alt]) {
      const a = komp[alt];
      const b = komp[neu] || { count: 0, lastUsed: '' };
      komp[neu] = {
        ...b,
        count: (b.count || 0) + (a.count || 0),
        lastUsed: [a.lastUsed || '', b.lastUsed || ''].sort().pop() || '',
      };
      delete komp[alt];
    } else if (!komp[neu]) {
      komp[neu] = { count: 1, lastUsed: new Date().toISOString() };
    }
    nextDb.competencies = komp;

    const m = normalisiereModell(nextDb.competencyModel);
    if (m.areaOf[alt]) { m.areaOf[neu] = m.areaOf[alt]; delete m.areaOf[alt]; }
    if (m.hidden[alt]) { m.hidden[neu] = true; delete m.hidden[alt]; }
    nextDb.competencyModel = normalisiereModell(m);

    runUndoable('Kompetenz umbenannt', before, ()=>persist(nextDb));
  };

  /* Löschen nimmt die Kompetenz aus dem Katalog, NICHT aus den Stunden.
     Eine bereits gehaltene Stunde soll zeigen, was in ihr vorkam –
     unabhängig davon, was heute noch zur Auswahl steht. Dafür gibt es
     bereits den Weg über hideSuggestion; er wird hier wiederverwendet. */
  const deleteCompetency = (label) => {
    const l = normalisiereEtikett(label);
    if (!l || istSystemKompetenz(l)) return;
    hideSuggestion('competency', l);
  };

  /* Sprechabsichten umbenennen: dieselbe Überlegung wie bei den
     Kompetenzen – bliebe eine Stunde beim alten Namen, hätte man
     danach zwei Einträge statt einem. Deshalb wandert das Etikett mit. */
  const renameSpeechAct = (vonLabel, nachLabel) => {
    const alt = String(vonLabel || '').trim();
    const neu = String(nachLabel || '').trim();
    if (!alt || !neu || alt === neu || istSystemSprechabsicht(alt)) return;

    const before = db;
    const nextDb = deepClone(db);
    const tauschListe = (arr)=> [...new Set(
      (Array.isArray(arr) ? arr : [])
        .map(x => String(x || '').trim())
        .map(x => x === alt ? neu : x)
        .filter(Boolean)
    )];

    for (const woche of Object.values(nextDb.weeks || {})) {
      for (const stunde of Object.values(woche?.lessons || {})) {
        if (!stunde || typeof stunde !== 'object') continue;
        stunde.speechActs = tauschListe(stunde.speechActs);
      }
    }
    for (const tpl of Object.values(nextDb.sequenceTemplates || {})) {
      for (const l of (Array.isArray(tpl?.lessons) ? tpl.lessons : [])) {
        if (!l || typeof l !== 'object') continue;
        l.speechActs = tauschListe(l.speechActs);
      }
    }

    const ablage = nextDb.speechActs || {};
    if (ablage[alt]) {
      const a = ablage[alt];
      const b = ablage[neu] || { count: 0, lastUsed: '' };
      ablage[neu] = {
        ...b,
        count: (b.count || 0) + (a.count || 0),
        lastUsed: [a.lastUsed || '', b.lastUsed || ''].sort().pop() || '',
      };
      delete ablage[alt];
    }
    nextDb.speechActs = ablage;

    runUndoable('Sprechabsicht umbenannt', before, ()=>persist(nextDb));
  };

  /* Löschen nimmt sie aus der Auswahl, nicht aus den Stunden. */
  const deleteSpeechAct = (label) => {
    const l = String(label || '').trim();
    if (!l || istSystemSprechabsicht(l)) return;
    hideSuggestion('speechAct', l);
  };

  const addCompetencyArea = (name) => {
    const n = String(name || '').trim();
    if (!n) return;
    updateCompetencyModel((m)=>({
      ...m,
      customAreas: [...m.customAreas, { id: `area-${uid()}`, name: n }],
    }));
  };

  const renameCompetencyArea = (id, name) => {
    const n = String(name || '').trim();
    if (!id || !n || istSystemBereich(id)) return;
    updateCompetencyModel((m)=>({
      ...m,
      customAreas: m.customAreas.map(a => a.id === id ? { ...a, name: n } : a),
    }));
  };

  /* Einen eigenen Bereich zu löschen darf keine Kompetenz kosten: die
     Zuordnungen fallen weg, die Etiketten bleiben und rücken in
     „Ohne Bereich". In den Stunden ändert sich gar nichts. */
  const deleteCompetencyArea = (id) => {
    if (!id || istSystemBereich(id)) return;
    updateCompetencyModel((m)=>{
      const areaOf = { ...m.areaOf };
      for (const [label, bereichId] of Object.entries(areaOf)) {
        if (bereichId === id) delete areaOf[label];
      }
      return { ...m, customAreas: m.customAreas.filter(a => a.id !== id), areaOf };
    });
  };

  /* Merken in einer beliebigen Nutzungsablage. Dieselbe Mechanik wie
     rememberCompetency, nur ohne sie zu verdoppeln. */
  const rememberIn = (ablage, label, minLaenge = 1) => {
    const l = String(label || '').trim();
    if (!l || l.length < minLaenge) return;
    const nextDb = deepClone(db);
    if (!nextDb[ablage] || typeof nextDb[ablage] !== 'object') nextDb[ablage] = {};
    if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = {};
    if (!nextDb.hiddenSuggestions[ablage]) nextDb.hiddenSuggestions[ablage] = {};
    // Wer einen entfernten Vorschlag erneut eingibt, will ihn zurück.
    if (nextDb.hiddenSuggestions[ablage][l]) delete nextDb.hiddenSuggestions[ablage][l];
    const bisher = nextDb[ablage][l] || { count: 0, lastUsed: '' };
    nextDb[ablage][l] = {
      ...bisher,
      count: (bisher.count || 0) + 1,
      lastUsed: new Date().toISOString(),
    };
    persist(nextDb);
  };

  /* Systemeinträge des Startbestands nicht in die eigene Ablage
     schreiben – sie stehen ohnehin zur Auswahl, und die Verwaltung
     zeigte sie sonst fälschlich als eigene Sprechabsicht. */
  const rememberSpeechAct = (label) => {
    const l = String(label || '').trim();
    if (!l || istSystemSprechabsicht(l)) return;
    rememberIn('speechActs', l, 2);
  };
  const rememberScaffoldLabel = (label) => rememberIn('scaffoldLabels', label, 2);

  /* Einen offenen Punkt abschliessen. Er wird nicht gelöscht, sondern
     bekommt einen Status – so bleibt in der Nachbereitung der
     Ursprungsstunde sichtbar, was aus ihm geworden ist, und ein
     versehentliches "Erledigt" ist über Rückgängig zu holen. */
  const resolveCarryOver = (punkt, status) => {
    const ref = punkt?.sourceRef ? parseStundenRef(punkt.sourceRef) : null;
    if (!ref || !punkt?.id) return;
    const before = db;
    const nextDb = deepClone(db);
    const stunde = nextDb.weeks?.[ref.weekStart]?.lessons?.[keyOf(ref.dayIndex, ref.slotIndex)];
    if (!stunde) return;
    const review = normalisiereReview(stunde.review, uid);
    review.carryOverItems = review.carryOverItems.map(i => i.id === punkt.id ? {
      ...i,
      status,
      resolvedAt: new Date().toISOString(),
      targetRef: status === 'transferred' && view.name === 'lesson'
        ? stundenRef({ weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: view.slotIndex })
        : i.targetRef,
    } : i);
    stunde.review = review;
    const beschriftung = status === 'transferred' ? 'Punkt übernommen'
      : status === 'completed' ? 'Punkt erledigt' : 'Punkt verworfen';
    runUndoable(beschriftung, before, ()=>persist(nextDb));
  };

  const rememberSocialForm = (label) => {
    const l = (label || '').trim();
    if (!l) return;
    const nextDb = deepClone(db);
    if (!nextDb.socialForms) nextDb.socialForms = {};
    if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {} };
    if (!nextDb.hiddenSuggestions.socialForms) nextDb.hiddenSuggestions.socialForms = {};
    // If the user re-enters a previously removed suggestion, show it again.
    if (nextDb.hiddenSuggestions.socialForms[l]) delete nextDb.hiddenSuggestions.socialForms[l];
    const existing = nextDb.socialForms[l] || { count: 0, lastUsed: '' };
    existing.count = (existing.count || 0) + 1;
    existing.lastUsed = new Date().toISOString();
    nextDb.socialForms[l] = existing;
    persist(nextDb);
  };

  const rememberPhaseName = (label) => {
    const l = (label || '').trim();
    if (!l) return;
    const nextDb = deepClone(db);
    if (!nextDb.phaseNames) nextDb.phaseNames = {};
    if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {} };
    if (!nextDb.hiddenSuggestions.phaseNames) nextDb.hiddenSuggestions.phaseNames = {};
    if (nextDb.hiddenSuggestions.phaseNames[l]) delete nextDb.hiddenSuggestions.phaseNames[l];
    const existing = nextDb.phaseNames[l] || { count: 0, lastUsed: '' };
    existing.count = (existing.count || 0) + 1;
    existing.lastUsed = new Date().toISOString();
    nextDb.phaseNames[l] = existing;
    persist(nextDb);
  };

  const hideSuggestion = (kind, label) => {
    const l = (label || '').trim();
    if (!l) return;
    const nextDb = deepClone(db);
    if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {}, competencies: {}, supervisionLabels: {} };

    if (kind === 'socialForm') {
      if (!nextDb.hiddenSuggestions.socialForms) nextDb.hiddenSuggestions.socialForms = {};
      nextDb.hiddenSuggestions.socialForms[l] = true;
      if (nextDb.socialForms && nextDb.socialForms[l]) delete nextDb.socialForms[l];
    } else if (kind === 'phaseName') {
      if (!nextDb.hiddenSuggestions.phaseNames) nextDb.hiddenSuggestions.phaseNames = {};
      nextDb.hiddenSuggestions.phaseNames[l] = true;
      if (nextDb.phaseNames && nextDb.phaseNames[l]) delete nextDb.phaseNames[l];
    } else if (kind === 'classGroup') {
      if (!nextDb.hiddenSuggestions.classGroups) nextDb.hiddenSuggestions.classGroups = {};
      nextDb.hiddenSuggestions.classGroups[l] = true;
      if (nextDb.classGroups && nextDb.classGroups[l]) delete nextDb.classGroups[l];
    } else if (kind === 'subject') {
      if (!nextDb.hiddenSuggestions.subjects) nextDb.hiddenSuggestions.subjects = {};
      nextDb.hiddenSuggestions.subjects[l] = true;
      if (nextDb.subjects && nextDb.subjects[l]) delete nextDb.subjects[l];
    } else if (kind === 'competency') {
      if (!nextDb.hiddenSuggestions.competencies) nextDb.hiddenSuggestions.competencies = {};
      nextDb.hiddenSuggestions.competencies[l] = true;
      if (nextDb.competencies && nextDb.competencies[l]) delete nextDb.competencies[l];
    } else if (kind === 'speechAct') {
      if (!nextDb.hiddenSuggestions.speechActs) nextDb.hiddenSuggestions.speechActs = {};
      nextDb.hiddenSuggestions.speechActs[l] = true;
      if (nextDb.speechActs && nextDb.speechActs[l]) delete nextDb.speechActs[l];
    } else if (kind === 'scaffoldLabel') {
      if (!nextDb.hiddenSuggestions.scaffoldLabels) nextDb.hiddenSuggestions.scaffoldLabels = {};
      nextDb.hiddenSuggestions.scaffoldLabels[l] = true;
      if (nextDb.scaffoldLabels && nextDb.scaffoldLabels[l]) delete nextDb.scaffoldLabels[l];
    } else if (kind === 'supervisionLabel') {
      if (!nextDb.hiddenSuggestions.supervisionLabels) nextDb.hiddenSuggestions.supervisionLabels = {};
      nextDb.hiddenSuggestions.supervisionLabels[l] = true;
      if (nextDb.supervisionLabels && nextDb.supervisionLabels[l]) delete nextDb.supervisionLabels[l];
    }
    persist(nextDb);
  };



const rememberClassGroupIn = (nextDb, label) => {
  const l = (label || '').trim();
  if (!l) return;

  if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {} };
  if (!nextDb.hiddenSuggestions.classGroups) nextDb.hiddenSuggestions.classGroups = {};
  // If the user re-enters a previously removed suggestion, show it again.
  if (nextDb.hiddenSuggestions.classGroups[l]) delete nextDb.hiddenSuggestions.classGroups[l];

  if (!nextDb.classGroups) nextDb.classGroups = {};
  // Ersetzen statt verändern: der Eintrag kann noch mit dem vorigen
  // Zustand geteilt sein, wenn nur der geänderte Pfad kopiert wurde.
  const existing = nextDb.classGroups[l] || { count: 0, lastUsed: '' };
  nextDb.classGroups[l] = { ...existing, count: (existing.count || 0) + 1, lastUsed: new Date().toISOString() };
};

const rememberSubjectIn = (nextDb, label) => {
  const l = (label || '').trim();
  if (!l) return;

  if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {} };
  if (!nextDb.hiddenSuggestions.subjects) nextDb.hiddenSuggestions.subjects = {};
  if (nextDb.hiddenSuggestions.subjects[l]) delete nextDb.hiddenSuggestions.subjects[l];

  if (!nextDb.subjects) nextDb.subjects = {};
  // Ersetzen statt verändern: der Eintrag kann noch mit dem vorigen
  // Zustand geteilt sein, wenn nur der geänderte Pfad kopiert wurde.
  const existing = nextDb.subjects[l] || { count: 0, lastUsed: '' };
  nextDb.subjects[l] = { ...existing, count: (existing.count || 0) + 1, lastUsed: new Date().toISOString() };
};


const rememberSupervisionIn = (nextDb, label) => {
  const l = (label || '').trim();
  if (!l) return;

  if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {}, competencies: {}, supervisionLabels: {} };
  if (!nextDb.hiddenSuggestions.supervisionLabels) nextDb.hiddenSuggestions.supervisionLabels = {};
  if (nextDb.hiddenSuggestions.supervisionLabels[l]) delete nextDb.hiddenSuggestions.supervisionLabels[l];

  if (!nextDb.supervisionLabels) nextDb.supervisionLabels = {};
  // Ersetzen statt verändern: der Eintrag kann noch mit dem vorigen
  // Zustand geteilt sein, wenn nur der geänderte Pfad kopiert wurde.
  const existing = nextDb.supervisionLabels[l] || { count: 0, lastUsed: '' };
  nextDb.supervisionLabels[l] = { ...existing, count: (existing.count || 0) + 1, lastUsed: new Date().toISOString() };
};

const ensureGroupColorIn = (nextDb, classGroup, subject) => {
  const key = groupKey(classGroup, subject);
  if (!key) return;
  if (!nextDb.groupColors) nextDb.groupColors = {};
  const existing = nextDb.groupColors[key];
  if (existing && existing.color) return;
  nextDb.groupColors[key] = { color: defaultGroupColor(key) };
};

const setGroupColorForKey = (key, color) => {
  const k = (key || '').trim();
  const c = (color || '').trim();
  if (!k || !c) return;
  const nextDb = deepClone(db);
  if (!nextDb.groupColors) nextDb.groupColors = {};
  nextDb.groupColors[k] = { color: c };
  persist(nextDb);
};


const addTodo = ({ text, dateISO, deadlineISO, weekStartISO }) => {
  const t = (text || '').trim();
  if (!t) return;
  const nextDb = deepClone(db);
  const todo = {
    id: uid(),
    text: t,
    done: false,
    dateISO: (dateISO || '').trim(),
    deadlineISO: (deadlineISO || '').trim(),
    weekStartISO: (weekStartISO || '').trim(),
    createdAt: new Date().toISOString()
  };
  nextDb.todos = Array.isArray(nextDb.todos) ? [todo, ...nextDb.todos] : [todo];
  persist(nextDb);
};

const updateTodo = (id, patch) => {
  const nextDb = deepClone(db);
  const arr = Array.isArray(nextDb.todos) ? nextDb.todos : [];
  const idx = arr.findIndex(t => t?.id === id);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], ...patch };
  nextDb.todos = arr;
  persist(nextDb);
};

const deleteTodo = (id) => {
  const before = db;
  const nextDb = deepClone(db);
  const arr = Array.isArray(nextDb.todos) ? nextDb.todos : [];
  if (!arr.some(t => t?.id === id)) return;
  nextDb.todos = arr.filter(t => t?.id !== id);
  runUndoable('To-do gelöscht', before, ()=>persist(nextDb));
};


  // --- Sequenz-Vorlagen (Bibliothek) ---
  const templates = db.sequenceTemplates || {};

  const createTemplateFromSequence = (sequenceId, templateName) => {
    const seq = sequences?.[sequenceId];
    const name = (templateName || seq?.name || '').trim();
    if (!sequenceId || !name) return null;

    // Collect lessons in this sequence across all weeks, in chronological order
    const items = [];
    for (const [weekStart, w] of Object.entries(db.weeks || {})) {
      for (const [k, rawLesson] of Object.entries(w?.lessons || {})) {
        const l = normalizeLesson(rawLesson);
        if ((l.sequenceId || '') !== sequenceId) continue;
        const [dayIndex, slotIndex] = k.split('-').map(Number);
        if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
        const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
        items.push({ weekStart, dayIndex, slotIndex, dateISO, lesson: l });
      }
    }
    items.sort((a,b)=> (a.dateISO.localeCompare(b.dateISO) || (a.slotIndex-b.slotIndex)));
    if (items.length === 0) {
      showToast('In dieser Sequenz sind noch keine Stunden zugeordnet.', { tone: 'warning' });
      return null;
    }

    // Determine a default subject (most frequent)
    const counts = new Map();
    for (const it of items) {
      const s = (it.lesson.subject || '').trim();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    let subject = '';
    let best = -1;
    for (const [s, c] of counts.entries()) {
      if (c > best) { best = c; subject = s; }
    }
    if (!subject) subject = (items.find(i=> (i.lesson.subject||'').trim())?.lesson?.subject || '').trim();

    /* Diese Aufzählung ist die einzige Stelle, an der eine Vorlage
       entscheidet, was sie mitnimmt. Neue Felder gehören deshalb hier
       hinein – sonst gingen sie beim Speichern als Vorlage lautlos
       verloren, ohne dass irgendwo ein Fehler entstünde. */
    const lessons = items.map(({ lesson }) => ({
      topic: lesson.topic || '',
      objectives: lesson.objectives || '',
      phases: (lesson.phases || []).map(p => neuePhasenIds(p)),
      homework: lesson.homework || '',
      notes: lesson.notes || '',
      competencies: Array.isArray(lesson.competencies) ? lesson.competencies : [],
      primaryCompetency: lesson.primaryCompetency || '',
      successCriteria: normalisiereErfolgskriterien(lesson.successCriteria),
      communicativeTask: normalisiereAufgabe(lesson.communicativeTask),
      speechActs: normalisiereSprechabsichten(lesson.speechActs),
      languageResources: normalisiereMittel(lesson.languageResources),
      progressionNote: String(lesson.progressionNote || '').trim(),
      /* Die Dauer der Einheit. Eine Doppelstunde bleibt beim Speichern
         als Vorlage eine Doppelstunde – und wird beim Einsetzen wieder
         zu einer, wenn dort zwei Plätze frei sind. */
      blockSpan: blockSpanOf(lesson),
    }));

    /* Was die Bibliothek über die Sequenz weiss, entsteht hier – aus
       der Sequenz und aus ihren Stunden. Nichts davon wird erfunden:
       fehlt eine Angabe, bleibt das Feld leer und die Karte zeigt sie
       schlicht nicht. Ergänzen lässt sich alles später von Hand. */
    const kompetenzen = (()=>{
      const zaehler = new Map();
      const merke = (v)=>{
        const t = String(v || '').trim();
        if (!t) return;
        zaehler.set(t, (zaehler.get(t) || 0) + 1);
      };
      for (const c of (Array.isArray(seq?.competencies) ? seq.competencies : [])) merke(c);
      merke(seq?.primaryCompetency);
      for (const { lesson } of items){
        merke(lesson.primaryCompetency);
        for (const c of (Array.isArray(lesson.competencies) ? lesson.competencies : [])) merke(c);
      }
      return [...zaehler.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0])).map(([k])=>k).slice(0, 6);
    })();

    const mittel = (()=>{
      const sammle = (feld)=>{
        const out = [];
        for (const { lesson } of items){
          const v = String(normalisiereMittel(lesson.languageResources)[feld] || '').trim();
          if (v && !out.includes(v)) out.push(v);
        }
        return out.join(' · ');
      };
      return normalisiereMittel({
        vocabulary: sammle('vocabulary'),
        grammar: sammle('grammar'),
        pronunciation: sammle('pronunciation'),
        other: sammle('other'),
      });
    })();

    const zielaufgabe = normalisiereAufgabe(seq?.finalTask);

    const nextDb = deepClone(db);
    if (!nextDb.sequenceTemplates) nextDb.sequenceTemplates = {};
    const id = uid();
    nextDb.sequenceTemplates[id] = normalisiereVorlage({
      id,
      name,
      subject,
      color: seq?.color || '',
      createdAt: new Date().toISOString(),
      lessons,
      competencies: kompetenzen,
      primaryCompetency: String(seq?.primaryCompetency || '').trim() || (kompetenzen[0] || ''),
      finalTask: zielaufgabe,
      // Das Zielprodukt steht in der Zielaufgabe: "Was entsteht dabei?"
      targetProduct: String(zielaufgabe.outcome || '').trim(),
      languageResources: mittel,
      origin: 'sequence',
    }, id);
    persist(nextDb);
    return id;
  };

  /* Beschreibende Angaben einer Vorlage ändern. Die Einheiten selbst
     werden dabei nie angefasst. */
  const updateTemplate = (templateId, patch) => {
    const nextDb = deepClone(db);
    const t = nextDb.sequenceTemplates?.[templateId];
    if (!t) return;
    nextDb.sequenceTemplates[templateId] = normalisiereVorlage({ ...t, ...(patch || {}) }, templateId);
    persist(nextDb);
  };

  const deleteTemplate = (templateId) => {
    const before = db;
    const nextDb = deepClone(db);
    if (!nextDb.sequenceTemplates?.[templateId]) return;
    sichereVorlage(templateId, 'vorLoeschen');
    delete nextDb.sequenceTemplates[templateId];
    runUndoable('Vorlage gelöscht', before, ()=>persist(nextDb));
  };

  const exportTemplates = async () => {
    if (!capabilities.templateFiles) { showToast('Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' }); return; }
    const path = await platform.exportTemplates();
    if (path) toastSavedPath('Sequenz-Vorlagen exportiert.', path);
  };

  const importTemplates = async () => {
    if (!capabilities.templateFiles) { showToast('Import ist nur in der Desktop-App verfügbar.', { tone: 'warning' }); return; }
    const importedDb = await platform.importTemplates();
    if (importedDb) {
      persist(ensureDbShape(importedDb));
      showToast('Sequenz-Vorlagen importiert.', { tone: 'success' });
    }
  };

  /* Ob eine Stunde als leer gilt, entscheidet mit darüber, ob eine
     Vorlage sie überschreiben darf. Eine Stunde, in der bislang nur
     fachdidaktisch geplant wurde – etwa eine kommunikative Aufgabe und
     Erfolgskriterien, aber noch kein Thema –, ist nicht leer. */
  const isLessonEmpty = (raw) => {
    const l = normalizeLesson(raw);
    const hasText = (l.topic || l.objectives || l.homework || l.notes || '').trim().length > 0;
    const hasComps = (l.primaryCompetency || '').trim() || (Array.isArray(l.competencies) && l.competencies.length);
    // A brand-new default lesson has titles; consider it empty if only titles exist and no content/socialforms.
    const hasMeaningfulPhase = (l.phases || []).some(p => (p.socialForm || '').trim() || (p.content || '').trim());
    const hasDidaktik = (l.successCriteria || []).length > 0
      || (l.progressionNote || '').trim().length > 0
      || hatFachdidaktik(l);
    return !hasText && !hasComps && !hasMeaningfulPhase && !hasDidaktik;
  };

  const insertTemplateIntoPlan = ({ templateId, targetGroup, subject, startISO, overwrite, sequenceName }) => {
    const tpl = templates?.[templateId];
    if (!tpl) return { inserted: 0, missing: 0 };
    const group = (targetGroup || '').trim();
    if (!group) { showToast('Bitte Lerngruppe wählen.', { tone: 'warning' }); return { inserted: 0, missing: 0 }; }
    const subj = (subject || tpl.subject || '').trim();
    if (!subj) { showToast('Bitte Fach angeben.', { tone: 'warning' }); return { inserted: 0, missing: 0 }; }

    const blueprints = Array.isArray(tpl.lessons) ? tpl.lessons : [];
    if (blueprints.length === 0) { showToast('Diese Vorlage enthält keine Stunden.', { tone: 'warning' }); return { inserted: 0, missing: 0 }; }

    const nextDb = deepClone(db);
    if (!nextDb.sequences) nextDb.sequences = {};
    const seqId = uid();
    const seqColor = (tpl.color || '').trim() || SEQ_COLORS[Object.keys(nextDb.sequences).length % SEQ_COLORS.length];
    nextDb.sequences[seqId] = {
      id: seqId,
      name: ((sequenceName || tpl.name || '').trim() || tpl.name || 'Sequenz'),
      color: seqColor,
      createdAt: new Date().toISOString()
    };
    let inserted = 0;
    /* Die Plätze, die die Vorlage belegt – mit dem Stand, den sie
       VORHER trugen. Daraus entsteht ein einziger Eintrag im
       Versionsverlauf, der das Einsetzen als Ganzes zurücknimmt. */
    const ersetzteStunden = [];

    const schoolYear = nextDb.schoolCalendar?.schoolYear || { startISO:'', endISO:'' };
    const maxISO = (schoolYear.endISO || '').trim() || addDaysISO(startISO, 180);
    const scanLimitDays = 366;

    let bpIndex = 0;
    for (let dayOffset = 0; dayOffset < scanLimitDays && bpIndex < blueprints.length; dayOffset++) {
      const dateISO = addDaysISO(startISO, dayOffset);
      if (dateISO > maxISO) break;

      const d = fromISODate(dateISO);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const info = getDayInfo(dateISO, nextDb.schoolCalendar);
      if (info.isOff) continue;

      const weekStart = toISODate(startOfWeekMonday(d));
      const w = nextDb.weeks[weekStart];
      if (!w) continue;
      const dayIndex = Math.round((fromISODate(dateISO) - fromISODate(weekStart)) / 86400000);
      const slotsPerDay = w.slotsPerDay || 6;

      for (let slotIndex = 0; slotIndex < slotsPerDay && bpIndex < blueprints.length; slotIndex++) {
        const k = keyOf(dayIndex, slotIndex);
        const existing = w.lessons?.[k];
        if (!existing) continue;
        const l = normalizeLesson(existing);
        if (((l.classGroup || '').trim()) !== group) continue;
        if (((l.subject || '').trim()) !== subj) continue;
        if (!overwrite && !isLessonEmpty(l)) continue;

        const bp = blueprints[bpIndex];

        /* Eine Einheit kann länger als eine Stunde sein. Sie bekommt
           die Plätze, die sie braucht – und nur dann, wenn dort auch
           wirklich Unterricht derselben Lerngruppe liegt. Ist kein
           Platz für die volle Dauer, wird die Einheit als Einzelstunde
           eingesetzt statt gar nicht: der Verlaufsplan bleibt erhalten,
           die Lehrkraft kann anschliessend verbinden. */
        const gewuenschteSpanne = normalisiereBlockSpan(bp.blockSpan);
        let spanne = 1;
        for (let n = gewuenschteSpanne; n > 1; n--){
          if (slotIndex + n > slotsPerDay) continue;
          const passt = Array.from({ length: n - 1 }, (_, i)=> slotIndex + 1 + i).every(si => {
            const nachbar = w.lessons?.[keyOf(dayIndex, si)];
            if (!nachbar) return false;
            const nl = normalizeLesson(nachbar);
            if (blockSpanOf(nl) > 1) return false;
            if (((nl.classGroup || '').trim()) !== group) return false;
            if (((nl.subject || '').trim()) !== subj) return false;
            return overwrite || isLessonEmpty(nl);
          });
          if (passt) { spanne = n; break; }
        }
        const nextLesson = normalizeLesson(l);
        nextLesson.classGroup = group;
        nextLesson.subject = (l.subject || '').trim() || subj;
        // room comes from timetable (keep existing)
        nextLesson.room = (l.room || '').trim();
        nextLesson.topic = bp.topic || '';
        nextLesson.objectives = bp.objectives || '';
        nextLesson.blockSpan = spanne;
        /* Passt die Einheit nicht in ihrer geplanten Länge, behalten
           die Phasen wenigstens ihr Verhältnis zueinander. */
        const bpSpanne = normalisiereBlockSpan(bp.blockSpan);
        const bpPhasen = (bp.phases || []).map(p => neuePhasenIds(p));
        nextLesson.phases = normalizePhases(
          spanne === bpSpanne ? bpPhasen : skalierePhasen(bpPhasen, TOTAL_MIN * bpSpanne, TOTAL_MIN * spanne),
          TOTAL_MIN * spanne
        );
        nextLesson.homework = bp.homework || '';
        nextLesson.notes = bp.notes || '';
        nextLesson.competencies = Array.isArray(bp.competencies) ? bp.competencies : [];
        nextLesson.primaryCompetency = bp.primaryCompetency || (nextLesson.competencies?.[0] || '');
        nextLesson.successCriteria = normalisiereErfolgskriterien(bp.successCriteria);
        nextLesson.communicativeTask = normalisiereAufgabe(bp.communicativeTask);
        nextLesson.speechActs = normalisiereSprechabsichten(bp.speechActs);
        nextLesson.languageResources = normalisiereMittel(bp.languageResources);
        nextLesson.progressionNote = String(bp.progressionNote || '').trim();
        nextLesson.sequenceId = seqId;
        nextLesson.updatedAt = new Date().toISOString();

        if (!w.lessons) w.lessons = {};
        /* Was hier überschrieben wird, wandert vorher in den
           Versionsverlauf – als EIN Vorgang für die ganze Vorlage. */
        for (let i = 0; i < spanne; i++){
          const si = slotIndex + i;
          const vorher = db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, si)] || null;
          ersetzteStunden.push(stundenTeil({ weekStart, dayIndex, slotIndex: si, stunde: vorher }));
        }
        w.lessons[k] = nextLesson;
        // Die mit belegten Plätze tragen keinen eigenen Eintrag mehr.
        for (let i = 1; i < spanne; i++) delete w.lessons[keyOf(dayIndex, slotIndex + i)];
        slotIndex += spanne - 1;
        inserted += 1;
        bpIndex += 1;
      }
    }

    if (ersetzteStunden.length) {
      sichereSammlung(ersetzteStunden, 'vorImport', {
        bereich: 'bulk',
        zielId: sequenzZiel(seqId),
        zielLabel: `Vorlage „${tpl.name || 'Vorlage'}“ eingesetzt`,
      });
    }
    persist(nextDb);

    const missing = Math.max(0, blueprints.length - inserted);
    return { inserted, missing, sequenceId: seqId };
  };


  const doExportPdf = async (html, suggestedName) => {
    if (!capabilities.pdfExport) {
      showToast('PDF-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }
    const saved = await platform.exportPdf({ html, suggestedFileName: suggestedName });
    // Der Desktop liefert einen Pfad, der Browser öffnet den Druckdialog –
    // dort entsteht die Datei erst durch die Wahl des Nutzers.
    if (typeof saved === 'string') toastSavedPath('PDF gespeichert.', saved);
    else if (saved?.printed) showToast('Druckdialog geöffnet – dort „Als PDF speichern“ wählen.');
  };


const doExportDocx = async (html, suggestedName) => {
  // Wir exportieren bewusst als .doc (HTML), weil das auf allen Word-Versionen
  // zuverlässig öffnet. ("echtes" .docx hatte bei manchen Systemen Probleme.)
  if (!capabilities.docxExport) {
    showToast('Word-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
    return;
  }
  const safe = String(suggestedName || 'Unterrichtsstunde.doc').replace(/\.docx$/i, '.doc');
  const saved = await platform.exportDocx({ html, suggestedFileName: safe });
  if (typeof saved === 'string') toastSavedPath('Word-Datei gespeichert.', saved);
  else if (saved) showToast('Word-Datei gespeichert.', { tone: 'success' });
};

  /* Eine Sequenz ausgeben.

     Vorher stand diese Rechnung zweimal fast gleich in der
     Sequenzverwaltung – einmal für PDF, einmal für Word. Jetzt gibt es
     sie einmal; das Ziel ist ein Parameter. */
  const exportSequenceAs = (sequenceId, ziel = 'pdf') => {
    const seq = sequences?.[sequenceId];
    if (!seq) return;
    const raus = (ziel === 'docx') ? doExportDocx : doExportPdf;
    if (typeof raus !== 'function') {
      showToast(`${ziel === 'docx' ? 'Word' : 'PDF'}-Export ist nur in der Desktop-App verfügbar.`, { tone: 'warning' });
      return;
    }
    try {
      const occ = [];
      for (const [ws, w] of Object.entries(db?.weeks || {})) {
        for (const [k, raw] of Object.entries(w?.lessons || {})) {
          if (!raw) continue;
          if ((raw.sequenceId || '') !== sequenceId) continue;
          const parts = String(k).split('-');
          const dayIndex = Number(parts[0]);
          const slotIndex = Number(parts[1]);
          if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
          const dateISO = toISODate(addDays(fromISODate(ws), dayIndex));
          const lesson = normalizeLesson(raw);
          occ.push({ weekStart: ws, dayIndex, slotIndex, dateISO, lesson, group: lesson.classGroup || '' });
        }
      }
      occ.sort((a,b)=> a.dateISO.localeCompare(b.dateISO) || (a.slotIndex - b.slotIndex) || (a.group||'').localeCompare(b.group||''));

      const html = buildSequencePdfHtml({
        sequence: seq,
        occurrences: occ,
        schoolCalendar,
        groupColors: db?.groupColors || {}
      });
      const safe = String(seq.name || 'Sequenz').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Sequenz';
      raus(html, ziel === 'docx' ? `Sequenz_${safe}.doc` : `Sequenz_${safe}.pdf`);
    } catch {}
  };

  // Render main content in a readable way (avoids a very long nested ternary inside JSX,
  // which is easy to break and hard to maintain).
  const mainContent = (() => {
    if (view.name === 'week') {
      return (
        <WeekView
          readOnly={imArchiv}
          onboardingPlatz={onboardingPlatz}
          rhythmus={wochenRhythmus}
          onRhythmusAusnahme={imArchiv ? null : ((position)=>setzeRhythmusAusnahme(position))}
          onAlsVorlage={imArchiv ? null : (()=>setStundenplanDialog({ art: 'ausWoche' }))}
          weekStart={view.weekStart}
          week={week}
          sequences={sequences}
          schoolCalendar={schoolCalendar}
          todos={todos}
          todayISO={todayISO}
          groupColors={db.groupColors || {}}
          onOpenGroupColorPalette={openGroupColorPalette}
          duties={week.duties || {}}
          supervisionSuggestions={supervisionSuggestions}
          onHideSupervisionSuggestion={(label)=>hideSuggestion('supervisionLabel', label)}
          onUpsertDuty={(dayIndex, pos, title)=>upsertDutyAt(view.weekStart, dayIndex, pos, title)}
          onDeleteDuty={(dayIndex, pos)=>deleteDutyAt(view.weekStart, dayIndex, pos)}
          lessonClipboard={lessonClipboard}
          onCopyLesson={(dayIndex, slotIndex)=>copyLessonToClipboard(view.weekStart, dayIndex, slotIndex)}
          onReviewLesson={(dayIndex, slotIndex)=>setView({ name:'review', weekStart: view.weekStart, dayIndex, slotIndex })}
          onCutLesson={(dayIndex, slotIndex)=>cutLessonToClipboard(view.weekStart, dayIndex, slotIndex)}
          onPasteLesson={(dayIndex, slotIndex)=>pasteLessonFromClipboard(view.weekStart, dayIndex, slotIndex)}
          onLessonDnd={(payload)=>moveOrCopyLessonByDnd(payload)}
          onJoinBlock={(dayIndex, slotIndex)=>joinLessonsIntoBlock(view.weekStart, dayIndex, slotIndex)}
          onSplitBlock={(dayIndex, slotIndex)=>splitBlockAt(view.weekStart, dayIndex, slotIndex)}
          onOpenLesson={(dayIndex, slotIndex)=>{
            setView({ name:'lesson', weekStart: view.weekStart, dayIndex, slotIndex });
          }}
          onOpenMacro={()=>{
            setView({ name:'macro', weekStart: view.weekStart, startISO: view.weekStart, rangeDays: 28 });
          }}
          onOpenTodos={()=>setView({ name:'todos', weekStart: view.weekStart })}
          onChangeSlots={(slotsPerDay)=>{
            updateWeek(view.weekStart, (w)=>({ ...w, slotsPerDay: clamp(slotsPerDay, 1, 12), lessons: w.lessons||{} }));
          }}
          onDeleteLesson={(dayIndex, slotIndex)=>deleteLessonAt(view.weekStart, dayIndex, slotIndex)}
          onExportPdf={doExportPdf}
          onExportDocx={doExportDocx}
        />
      );
    }
    if (view.name === 'macro') {
      return (
        <MacroView
          readOnly={imArchiv}
          db={db}
          view={view}
          sequences={sequences}
          appSettings={appSettings}
          onUpdateAppSettings={updateAppSettings}
          schoolCalendar={schoolCalendar}
          competencySuggestions={competencySuggestions}
          onExportPdf={doExportPdf}
          onExportDocx={doExportDocx}
          onSetView={setView}
          onCreateSequence={createSequence}
          onRequestCreateSequence={openCreateSequenceModal}
          onUpdateSequence={updateSequence}
          onDeleteSequence={deleteSequence}
          onSaveSequenceAsTemplate={(sequenceId)=>{
            const seq = sequences?.[sequenceId];
            askPrompt({
              title: 'Sequenz als Vorlage speichern',
              label: 'Name der Vorlage',
              placeholder: 'z. B. Einführung Perfekt',
              initialValue: seq?.name || '',
              confirmLabel: 'Vorlage speichern',
            }).then((name)=>{
              if (!name) return;
              const tid = createTemplateFromSequence(sequenceId, name);
              if (tid) showToast('Vorlage gespeichert – du findest sie in der Bibliothek.');
            });
          }}
          onRememberCompetency={rememberCompetency}
          onOpenLesson={(weekStart, dayIndex, slotIndex)=>{
            setView({ name:'lesson', weekStart, dayIndex, slotIndex });
          }}
          onUpdateLessonAt={(weekStart, dayIndex, slotIndex, nextLesson)=>updateLessonAt(weekStart, dayIndex, slotIndex, nextLesson)}
          onDeleteLessonAt={(weekStart, dayIndex, slotIndex)=>deleteLessonAt(weekStart, dayIndex, slotIndex)}
        />
      );
    }
    if (view.name === 'year') {
      return (
        <YearPlanView
          db={db}
          view={view}
          schoolCalendar={schoolCalendar}
          minDate={minDate}
          maxDate={maxDate}
          classGroupSuggestions={classGroupSuggestions}
          subjectSuggestions={subjectSuggestions}
          onHideClassGroupSuggestion={(label)=>hideSuggestion('classGroup', label)}
          onHideSubjectSuggestion={(label)=>hideSuggestion('subject', label)}
          onCreateBar={(payload)=>createYearBar(payload)}
          onUpdateBar={(id, patch, opts)=>updateYearBar(id, patch, opts)}
          onDeleteBar={(id)=>deleteYearBar(id)}
          readOnly={imArchiv}
          onClearLane={(laneKey)=>clearYearPlanLane(laneKey)}
          onRemoveLane={(laneKey)=>removeYearPlanLane(laneKey)}
          onRenameLane={(laneKey)=>renameYearPlanLane(laneKey)}
          onOpenSequenz={(sequenceId)=>setView({ name:'progression', sequenceId, weekStart: view.weekStart })}
          onVerschiebeSequenz={({ sequenceId, wochen, barId })=>oeffneVerschieben({
            sequenceId, umfang: 'gesamt', wochen, barId,
          })}
          onSetView={setView}
        />
      );
    }
    if (view.name === 'library') {
      return (
        <SequenceLibraryView
          db={db}
          templates={templates}
          sequences={sequences}
          schoolCalendar={schoolCalendar}
          startVorschauId={view.vorschauId || ''}
          minDate={minDate}
          maxDate={maxDate}
          classGroupSuggestions={classGroupSuggestions}
          subjectSuggestions={subjectSuggestions}
          onHideClassGroupSuggestion={(label)=>hideSuggestion('classGroup', label)}
          onHideSubjectSuggestion={(label)=>hideSuggestion('subject', label)}
          onUpdateTemplate={(id, patch)=>updateTemplate(id, patch)}
          onCreateTemplateFromSequence={(sequenceId)=>{
            const seq = sequences?.[sequenceId];
            askPrompt({
              title: 'Sequenz als Vorlage speichern',
              label: 'Name der Vorlage',
              placeholder: 'z. B. Einführung Perfekt',
              initialValue: seq?.name || '',
              confirmLabel: 'Vorlage speichern',
            }).then((name)=>{
              if (!name) return;
              const tid = createTemplateFromSequence(sequenceId, name);
              if (tid) showToast('Vorlage gespeichert – du findest sie in der Bibliothek.');
            });
          }}
          onDeleteTemplate={(id)=>{
            const t = templates?.[id];
            deleteTemplate(id);
          }}
          onExportTemplates={exportTemplates}
          onImportTemplates={importTemplates}
          onInsert={(payload)=>{
            const res = insertTemplateIntoPlan(payload);
            if (res.inserted > 0) {
              showToast(`Sequenz übernommen: ${res.inserted} ${res.inserted === 1 ? 'Einheit' : 'Einheiten'}` + (res.missing ? ` · nicht platziert: ${res.missing}` : ''), { tone: 'success' });
              // Jump to macro plan around start
              setView({ name:'macro', weekStart: toISODate(startOfWeekMonday(fromISODate(payload.startISO))), startISO: payload.startISO, rangeDays: 28 });
            } else {
              showToast('Keine passenden Stundenplätze gefunden. Stelle sicher, dass der Stundenplan (Klasse/Fach/Raum) in den Zielwochen schon angelegt ist.', { tone: 'warning', ttl: 9000 });
            }
          }}
        />
      );
    }
    if (view.name === 'archives') {
      return (
        <ArchiveOverviewView
          /* Immer aus den ECHTEN Daten: die Archivliste gehört nicht zu
             einem einzelnen Schuljahr. */
          archive={liveDb?.schoolYearArchives || []}
          onOpen={(id)=>oeffneArchiv(id)}
          onExport={(id)=>exportiereArchiv(id)}
          onDelete={(id)=>loescheArchiv(id)}
          onBack={()=>setView({ name:'calendar', weekStart: view.weekStart })}
        />
      );
    }
    if (view.name === 'todos') {
      return (
        <TodoView
          readOnly={imArchiv}
          weekStart={view.weekStart}
          todos={todos}
          onAddTodo={addTodo}
          onUpdateTodo={updateTodo}
          onDeleteTodo={deleteTodo}
          /* Im Archiv führt der Rückweg in die Woche des archivierten
             Jahres – die zuletzt besuchte Hauptansicht gehört zum
             laufenden Schuljahr. */
          onBack={()=>setView(imArchiv
            ? { name:'week', weekStart: view.weekStart }
            : { ...lastMainView.current })}
        />
      );
    }
    if (view.name === 'today') {
      return (
        <TodayView
          heute={todayOverview(db, todayISO, toISODate(startOfWeekMonday(fromISODate(todayISO))))}
          todayISO={todayISO}
          getSeqProgress={(sequenceId, dayIndex, slotIndex)=> sequenceProgress(db, sequenceId, {
            weekStart: toISODate(startOfWeekMonday(fromISODate(todayISO))), dayIndex, slotIndex,
          })}
          onOpenLesson={(dayIndex, slotIndex)=> setView({
            name:'lesson', weekStart: toISODate(startOfWeekMonday(fromISODate(todayISO))), dayIndex, slotIndex,
          })}
          onOpenTodos={()=> setView({ name:'todos', weekStart: view.weekStart })}
          onOpenWeek={()=> setView({ name:'week', weekStart: toISODate(startOfWeekMonday(fromISODate(todayISO))) })}
        />
      );
    }
    if (view.name === 'review') {
      const l = getLessonAt(view.weekStart, view.dayIndex, view.slotIndex);
      const dateISO = toISODate(addDays(fromISODate(view.weekStart), view.dayIndex));
      return (
        <LessonReviewView
          lesson={l}
          dateISO={dateISO}
          dayIndex={view.dayIndex}
          slotIndex={view.slotIndex}
          languageMode={languageMode}
          onChangeReview={(next)=>{
            const akt = getLessonAt(view.weekStart, view.dayIndex, view.slotIndex);
            updateLessonFromEditor(view.weekStart, view.dayIndex, view.slotIndex, { ...akt, review: next });
          }}
          onOpenLesson={()=>setView({
            name:'lesson', weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: view.slotIndex,
          })}
        />
      );
    }
    if (view.name === 'progression') {
      const seq = sequences?.[view.sequenceId] || null;
      const zeilen = seq ? sequenzProgression(sequenceOccurrences(db, view.sequenceId)) : [];
      return (
        <SequenceProgressionView
          sequenz={seq}
          zeilen={zeilen}
          onOpenLesson={(z)=>setView({
            name:'lesson', weekStart: z.weekStart, dayIndex: z.dayIndex, slotIndex: z.slotIndex,
          })}
          onChangeNote={(z, wert)=>{
            const l = getLessonAt(z.weekStart, z.dayIndex, z.slotIndex);
            updateLessonAt(z.weekStart, z.dayIndex, z.slotIndex, { ...l, progressionNote: wert });
          }}
          onOpenLessons={()=>setView({
            name:'macro', weekStart: view.weekStart,
            startISO: zeilen[0]?.weekStart || view.weekStart, rangeDays: 84,
          })}
          onExportDocx={()=>exportSequenceAs(view.sequenceId, 'docx')}
          onExportPdf={()=>exportSequenceAs(view.sequenceId, 'pdf')}
          onVerschieben={imArchiv ? null : (()=>oeffneVerschieben({
            sequenceId: view.sequenceId, umfang: VERSCHIEBE_UMFANG.GESAMT,
          }))}
          onVerschiebenAb={imArchiv ? null : ((z)=>oeffneVerschieben({
            sequenceId: view.sequenceId,
            umfang: VERSCHIEBE_UMFANG.AB_FOLGENDE,
            ab: { weekStart: z.weekStart, dayIndex: z.dayIndex, slotIndex: z.slotIndex },
          }))}
        />
      );
    }
    if (view.name === 'competencies') {
      return (
        <CompetencyHeatmapView
          daten={competencyHeatmap(db)}
          /* Das Profil folgt der Gliederung des Katalogs. Ohne den
             Fremdsprachenmodus gibt es keine Bereiche, nach denen sich
             sinnvoll bündeln liesse – dann bleibt es bei der Wärmekarte. */
          profil={languageMode ? competencyProfile(db, { modell: competencyModel }) : null}
        />
      );
    }
    if (view.name === 'settings') {
      return (
        <SettingsView
          theme={themeChoice}
          onChangeTheme={(next)=>updateAppSettings({ theme: next })}
          storageState={storageState}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
          onExportPocketProfile={exportPocketProfile}
          onOpenPocketImport={()=>setView({ name: 'pocket', weekStart: view.weekStart })}
          weekReview={appSettings?.weekReview !== false}
          onChangeWeekReview={(v)=>updateAppSettings({ weekReview: !!v })}
          languageMode={languageMode}
          onChangeLanguageMode={(v)=>updateAppSettings({ languageMode: !!v })}
          defaultPlanningProfile={appSettings?.defaultPlanningProfile}
          onChangeDefaultPlanningProfile={(v)=>updateAppSettings({ defaultPlanningProfile: normalisiereProfilId(v) })}
          eigeneSprechabsichten={speechActSuggestions.filter(l => !istSystemSprechabsicht(l))}
          onRenameSpeechAct={renameSpeechAct}
          onDeleteSpeechAct={deleteSpeechAct}
          competencyModel={competencyModel}
          benutzteKompetenzen={benutzteKompetenzen}
          onSetCompetencyHidden={setCompetencyHidden}
          onSetCompetencyArea={setCompetencyArea}
          onRenameCompetency={renameCompetency}
          onDeleteCompetency={deleteCompetency}
          onAddCompetencyArea={addCompetencyArea}
          onRenameCompetencyArea={renameCompetencyArea}
          onDeleteCompetencyArea={deleteCompetencyArea}
          onLeereVerlauf={verlaufSpeicher.verfuegbar ? leereVerlauf : null}
          onSchnellstartNeu={()=>{
            setzeOnboarding(starteSchnellstartNeu(onboarding));
            setView(v => ({ name: 'week', weekStart: v.weekStart }));
            showToast('Schnellstart neu gestartet. Deine Planung bleibt unverändert.');
          }}
          onHinweiseZuruecksetzen={()=>{
            setzeOnboarding(setzeHinweiseZurueck(onboarding));
            onboardingSitzung.current = { gezeigt: false, vertagt: [] };
            showToast('Hinweise zurückgesetzt. Sie erscheinen wieder, wenn ihre Situation entsteht.');
          }}
        />
      );
    }
    if (view.name === 'pocket') {
      return (
        <PocketImportView
          db={db}
          todayISO={todayISO}
          onImport={importPocketStunde}
          onExportProfile={exportPocketProfile}
          onOpenLesson={(ziel)=>setView({
            name: 'lesson', weekStart: ziel.weekStart, dayIndex: ziel.dayIndex, slotIndex: ziel.slotIndex,
          })}
        />
      );
    }
    if (view.name === 'timetable') {
      return (
        <StundenplanView
          db={db}
          aktuelleWoche={view.weekStart}
          readOnly={imArchiv}
          startModellId={stundenplanZiel}
          komponenten={{
            ClassGroupInput, SubjectInput,
            classGroupSuggestions, subjectSuggestions,
          }}
          onNeuesModell={()=>setStundenplanDialog({ art: 'assistent' })}
          onAusWoche={(ziel)=>setStundenplanDialog({ art: 'ausWoche', ...(ziel || {}) })}
          onSpeichereVorlage={(vorlage, opts)=>{
            const gespeichert = speichereStundenplanVorlage(vorlage, opts);
            /* Beim ersten Bearbeiten einer Vorlage, die schon Wochen
               erzeugt hat, gehört der Satz dazu: Sie ändern sich nicht
               von selbst. */
            if (angewendeteWochen(liveDb, opts?.modell?.id || '').length) {
              setTimeout(()=>pruefeHinweis('vorlageBearbeitet'), 400);
            }
            return gespeichert;
          }}
          onSpeichereModell={(m)=>speichereStundenplanModell(m)}
          onLoescheVorlage={async (vorlage)=>{
            const ok = await askConfirm({
              title: 'Wochenvorlage löschen',
              body: `„${vorlage.name}" wird gelöscht. Bereits angelegte Unterrichtsstunden bleiben davon unberührt – gelöscht wird nur die Vorlage.`,
              confirmLabel: 'Vorlage löschen',
              tone: 'danger',
            });
            if (!ok) return;
            schreibeStundenplan(loescheVorlageAus(liveDb, vorlage.id), { label: 'Wochenvorlage gelöscht' });
          }}
          onAktiviere={(m)=>aktiviereStundenplanModell(m)}
          onArchiviere={(m)=>schreibeStundenplan(
            { timetableModels: archiviereModell(stundenplanModelle, m.id) },
            { label: `${m.name} archiviert` },
          )}
          onTausche={(m)=>{
            const getauscht = tauscheZyklus(m, liveDb?.timetableTemplates || {});
            schreibeStundenplan({
              timetableModels: stundenplanModelle.map(x => (x.id === m.id ? getauscht.modell : x)),
              timetableTemplates: getauscht.vorlagen,
            }, { label: 'A- und B-Woche getauscht' });
          }}
          onDupliziere={(vorlage)=>{
            const kopie = dupliziereVorlage(vorlage);
            schreibeStundenplan({
              timetableTemplates: { ...(liveDb?.timetableTemplates || {}), [kopie.id]: kopie },
            }, { label: 'Wochenvorlage dupliziert' });
          }}
          onAnwenden={(ziel)=>setStundenplanDialog({ art: 'anwenden', ...ziel })}
          onRhythmus={(m)=>setStundenplanDialog({ art: 'rhythmus', modell: m })}
        />
      );
    }
    if (view.name === 'search') {
      return (
        <GlobaleSucheView
          index={suchIndex}
          startQuery={suchQuery}
          onQueryChange={setSuchQuery}
          onOeffnen={oeffneTreffer}
          onKopieren={imArchiv ? null : kopiereTreffer}
        />
      );
    }
    if (view.name === 'help') {
      return (
        <HelpView
          version={APP_VERSION}
          onStarteEinfuehrung={imArchiv ? null : (()=>{
            setzeOnboarding(starteSchnellstartNeu(onboarding));
            setView(v => ({ name: 'week', weekStart: v.weekStart }));
            showToast('Schnellstart neu gestartet. Deine Planung bleibt unverändert.');
          })}
        />
      );
    }
    if (view.name === 'execution') {
      return <ExecutionWindow />;
    }
    if (view.name === 'calendar') {
      return (
        <SchoolCalendarView
          calendar={schoolCalendar}
          readOnly={imArchiv}
          archivesCount={(liveDb?.schoolYearArchives || []).length}
          onOpenArchives={()=>setView({ name:'archives', weekStart: view.weekStart })}
          onStartNewSchoolYear={()=>openNewSchoolYearDialog({ reason:'manual' })}
          onUpdate={(updater)=>{
            const nextDb = deepClone(db);
            const current = nextDb.schoolCalendar || { schoolYear:{startISO:'', endISO:''}, vacations:[], freeDays:[], events:[] };
            nextDb.schoolCalendar = updater(current);
            persist(nextDb);
          }}
        />
      );
    }

    /* Ein von einer Doppelstunde abgedeckter Stundenplatz trägt keine
       eigene Planung. Wird er trotzdem angesteuert – etwa aus einer
       Zuordnung im Pocket-Import –, öffnet sich die Stunde, zu der er
       gehört, statt einer zweiten Planung auf demselben Platz. */
    const stundenBesitzer = blockOwnerAt(db?.weeks?.[view.weekStart], view.dayIndex, view.slotIndex);
    const lessonSlotIndex = (stundenBesitzer && stundenBesitzer.covered) ? stundenBesitzer.slotIndex : view.slotIndex;

    // default: Einzelstunde
    return (
      <LessonView
        readOnly={imArchiv}
        weekStart={view.weekStart}
        dayIndex={view.dayIndex}
        slotIndex={lessonSlotIndex}
        lesson={getLessonAt(view.weekStart, view.dayIndex, lessonSlotIndex)}
        exists={hasLessonAt(view.weekStart, view.dayIndex, lessonSlotIndex)}
        sequences={sequences}
        appSettings={appSettings}
        onUpdateAppSettings={updateAppSettings}
        schoolCalendar={schoolCalendar}
        competencySuggestions={sichtbareKompetenzVorschlaege}
        languageMode={languageMode}
        competencyModel={competencyModel}
        benutzteKompetenzen={benutzteKompetenzen}
        speechActSuggestions={speechActSuggestions}
        scaffoldSuggestions={scaffoldSuggestions}
        offenePunkte={offenePunkteDerStunde}
        onResolveCarryOver={resolveCarryOver}
        onOpenReview={()=>setView({
          name:'review', weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: lessonSlotIndex,
        })}
        onJoinBlock={(entwurf)=>joinLessonsIntoBlock(view.weekStart, view.dayIndex, lessonSlotIndex, entwurf)}
        onSplitBlock={(entwurf)=>splitBlockAt(view.weekStart, view.dayIndex, lessonSlotIndex, entwurf)}
        onOpenVerlauf={verlaufSpeicher.verfuegbar ? (()=>oeffneVerlauf({
          bereich: 'lesson',
          zielId: stundenZiel({ weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: lessonSlotIndex }),
          titel: 'Versionsverlauf der Stunde',
          untertitel: stundenLabel(view.weekStart, view.dayIndex, lessonSlotIndex),
        })) : null}
        onVerschiebeSequenz={imArchiv ? null : ((sequenceId)=>oeffneVerschieben({
          sequenceId,
          umfang: VERSCHIEBE_UMFANG.AB_FOLGENDE,
          ab: { weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: lessonSlotIndex },
        }))}
        kannVerbinden={(()=>{
          const w = db?.weeks?.[view.weekStart];
          const l = w?.lessons?.[keyOf(view.dayIndex, lessonSlotIndex)];
          if (!l) return false;
          const span = blockSpanOf(l);
          if (span >= MAX_BLOCK_SPAN) return false;
          if ((lessonSlotIndex + span) >= (w.slotsPerDay || 6)) return false;
          const b = w.lessons?.[keyOf(view.dayIndex, lessonSlotIndex + span)];
          if (!b) return false;
          if (span + blockSpanOf(b) > MAX_BLOCK_SPAN) return false;
          return passenZusammen(l, b);
        })()}
        onRememberSpeechAct={rememberSpeechAct}
        onHideSpeechActSuggestion={(label)=>hideSuggestion('speechAct', label)}
        onRememberScaffoldLabel={rememberScaffoldLabel}
        onHideScaffoldSuggestion={(label)=>hideSuggestion('scaffoldLabel', label)}
        onHideCompetencySuggestion={(label)=>hideSuggestion('competency', label)}
        suggestions={socialFormSuggestions}
        phaseNameSuggestions={phaseNameSuggestions}
        classGroupSuggestions={classGroupSuggestions}
        subjectSuggestions={subjectSuggestions}
        onRememberClassGroup={(v)=>{
          const nextDb = deepClone(db);
          rememberClassGroupIn(nextDb, v);
          persist(nextDb);
        }}
        onRememberSubject={(v)=>{
          const nextDb = deepClone(db);
          rememberSubjectIn(nextDb, v);
          persist(nextDb);
        }}
        groupColors={db.groupColors || {}}
        onOpenGroupColorPalette={openGroupColorPalette}
        onCreateSequence={createSequence}
          onRequestCreateSequence={openCreateSequenceModal}
        onRememberCompetency={rememberCompetency}
        onUpdateLesson={(nextLesson)=>updateLessonFromEditor(view.weekStart, view.dayIndex, lessonSlotIndex, nextLesson)}
        getSeqProgress={(sequenceId)=> sequenceProgress(db, sequenceId, {
          weekStart: view.weekStart, dayIndex: view.dayIndex, slotIndex: lessonSlotIndex,
        })}
        onRememberSocialForm={rememberSocialForm}
        onRememberPhaseName={rememberPhaseName}
        onHideSocialFormSuggestion={(label)=>hideSuggestion('socialForm', label)}
        onHidePhaseNameSuggestion={(label)=>hideSuggestion('phaseName', label)}
        onHideClassGroupSuggestion={(label)=>hideSuggestion('classGroup', label)}
        onHideSubjectSuggestion={(label)=>hideSuggestion('subject', label)}
        onExportPdf={doExportPdf}
          onExportDocx={doExportDocx}
        onOpenExecution={(snapshot)=>{
          if (capabilities.executionWindow) {
            platform.openExecutionWindow(snapshot);
            /* Die Durchführung ist eine Funktion, die man beim ersten
               Mal erklärt bekommen sollte – aber erst, nachdem sie
               offen ist. */
            setTimeout(()=>pruefeHinweis('durchfuehrung'), 600);
          } else {
            showToast('Durchführungsansicht ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
          }
        }}
        onDraftTopicChange={(t)=>{ lessonDraftTopicRef.current = String(t || ''); }}
        /* Nur während der Einführung: Woran der Coachmark erkennt, was
           schon eingetragen ist – am Entwurf, nicht am gespeicherten
           Stand. */
        onDraftFortschritt={onboardingAktiv ? meldeStundeFortschritt : null}
        yearBars={db.yearBars || []}
        onOpenYearPlan={(focusISO)=>{
          setView({ name:'year', weekStart: view.weekStart, focusISO: String(focusISO || view.weekStart) });
        }}
        onDeleteLesson={() => {
          deleteLessonAt(view.weekStart, view.dayIndex, lessonSlotIndex);
          setView({ ...lastMainView.current });
        }}
      />
    );
  })();

  // This window is opened specifically for the Durchführung (presenter mode).
  // In that case we render only the presenter and hide the normal app chrome.
  if (isExecutionOnlyWindow) {
    return mainContent;
  }

  return (
    <UiContext.Provider value={uiApi}>
    <div className="app">
      <div className="topbar">
        <div className="row" style={{gap:10}}>
          {!isHelpOnlyWindow && view.name !== 'week' ? (
            <button
              className="btn"
              onClick={()=>{
	                // Easter Egg: when jumping back to the timetable and the current lesson topic
	                // contains the word "Klassenarbeit", briefly show the capybara image.
	                const target = (view.name === 'library') ? { ...lastMainView.current } : { name:'week', weekStart: view.weekStart };
	                if (view.name === 'lesson' && target.name === 'week') {
	                  try {
	                    const draftTopic = String(lessonDraftTopicRef.current || '').trim();
	                    const storedTopic = String(getLessonAt(view.weekStart, view.dayIndex, view.slotIndex)?.topic || '').trim();
	                    const t = draftTopic || storedTopic;
	                    if (/\bKlassenarbeit\b/i.test(t)) triggerEasterEgg();
	                  } catch {}
	                  lessonDraftTopicRef.current = '';
	                }
	
	                setView(target);
              }}
            ><ArrowLeft {...ICON} /> Zurück</button>
          ) : null}
          <LogoButton onClick={zeigeSplashReplay} />
          <h1>Prép-ybara</h1>
          {viewBadgeLabel ? <span className="badge">{viewBadgeLabel}</span> : null}
        </div>

        <div className="right">
          {isHelpOnlyWindow ? (
            <button className="btn" onClick={()=>window.close?.()}>Schließen</button>
          ) : null}
          {!isHelpOnlyWindow && view.name === 'week' && (
            <>
              <div className="weeknav" style={{display:'flex', gap:6, alignItems:'center'}}>
                <button className="btn" title="Vorherige Woche" aria-label="Vorherige Woche" onClick={()=>goWeekDelta(-1)}><ChevronLeft {...ICON} /></button>
                <input className="input" style={{width:170}} type="date" min={minDate} max={maxDate} value={selectedDate} onChange={(e)=>onSelectWeekDate(e.target.value)} />
                <button className="btn" title="Nächste Woche" aria-label="Nächste Woche" onClick={()=>goWeekDelta(1)}><ChevronRight {...ICON} /></button>
              </div>
              {!imArchiv ? (
                <>
                  <button className="btn" onClick={()=>setShowWeekCopyDialog(true)}>In nächste Woche übernehmen</button>
                  {capabilities.backupFiles ? (
                    <>
                      <button className="btn" onClick={()=>exportBackup()}>Backup exportieren</button>
                      <button className="btn" onClick={()=>importBackup()}>Backup importieren</button>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Dauerhaft sichtbar, solange ein Archiv offen ist. Es steht über
          allem anderen, damit niemand vergisst, wo er gerade ist. */}
      {imArchiv ? (
        <div className="archivBand" role="status">
          <div className="archivBandText">
            <span className="archivBandTitel"><Archive {...ICON_SM} /> Archivansicht · {archiv?.label || 'Schuljahr'}</span>
            <span className="archivBandHinweis">Dieses Schuljahr ist archiviert. Änderungen sind deaktiviert.</span>
          </div>
          <button className="btn" onClick={verlasseArchiv}>
            <ArrowLeft {...ICON_SM} /> Zurück zum aktuellen Schuljahr
          </button>
        </div>
      ) : null}

      <div className={`appBody${imArchiv ? ' appBody--archiv' : ''}`}>
        {!isHelpOnlyWindow ? (
          <Sidebar
            imArchiv={imArchiv}
            aktiv={view.name}
            onNavigate={(ziel)=>{
              const ws = view.weekStart;
              if (ziel === 'macro') setView({ name:'macro', weekStart: ws, startISO: ws, rangeDays: 28 });
              else if (ziel === 'year') setView({ name:'year', weekStart: ws, focusISO: ws });
              else setView({ name: ziel, weekStart: ws });
            }}
          />
        ) : null}
        <div className="content">
          {mainContent}
        </div>
      </div>

      <div className="appFooter">
        <span>Prép-ybara, Version {APP_VERSION}</span>
        <span>© Florian Nowak</span>
      </div>

      <SplashOverlay
        visible={splashVisible || splashReplay}
        onDismiss={(splashReplay && !splashVisible) ? versteckeSplashReplay : null}
      />
      <EasterEggOverlay visible={easterEggVisible} />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      <WeekReview
        offen={!!reviewWeek}
        weekLabel={reviewWeek ? formatWeekLabel(reviewWeek) : ''}
        zusammenfassung={reviewWeek && db ? weekSummary(db, reviewWeek) : null}
        onClose={()=>setReviewWeek(null)}
        onDisable={()=>{ updateAppSettings({ weekReview: false }); setReviewWeek(null);
          showToast('Wochenabschluss abgeschaltet. In den Einstellungen wieder einschaltbar.'); }}
      />
      <CommandPalette
        open={paletteOpen}
        commands={paletteCommands}
        suchIndex={suchIndex}
        onOeffneTreffer={oeffneTreffer}
        onAlleTreffer={(q)=>oeffneSuche(q)}
        onClose={()=>setPaletteOpen(false)}
      />
      {/* ---- Unterrichtszeiten ------------------------------------------ */}
      <ModellAssistent
        offen={stundenplanDialog?.art === 'assistent'}
        schuljahr={db?.schoolCalendar?.schoolYear}
        vorhandeneWoche={Object.keys(db?.weeks?.[view.weekStart]?.lessons || {}).length > 0}
        onSchliessen={()=>setStundenplanDialog(null)}
        onAnlegen={({ typ, name, quelle })=>{
          if (quelle === 'woche') {
            setStundenplanDialog({ art: 'ausWoche', typ, name });
            return;
          }
          const modell = legeStundenplanModellAn({ typ, name });
          setStundenplanDialog(null);
          setStundenplanZiel(modell.id);
          setView(v => ({ name: 'timetable', weekStart: v.weekStart }));
          showToast(typ === MODELL_TYP.WECHSEL
            ? 'Zwei Wochenvorlagen angelegt: A-Woche und B-Woche. Trage jetzt die Unterrichtszeiten ein.'
            : 'Wochenvorlage angelegt. Trage jetzt deine Unterrichtszeiten ein.');
        }}
      />
      <WocheAlsVorlageDialog
        offen={stundenplanDialog?.art === 'ausWoche'}
        woche={db?.weeks?.[view.weekStart] || null}
        weekStartISO={view.weekStart}
        modelle={stundenplanModelle}
        vorlagen={liveDb?.timetableTemplates || {}}
        onSchliessen={()=>setStundenplanDialog(null)}
        onSpeichern={(payload)=>speichereWocheAlsVorlage(payload, { weekStart: view.weekStart })}
      />
      <AnwendenDialog
        offen={stundenplanDialog?.art === 'anwenden'}
        db={liveDb}
        modell={stundenplanDialog?.modell || null}
        vorlage={stundenplanDialog?.vorlage || null}
        aktuelleWoche={view.weekStart}
        schuljahr={db?.schoolCalendar?.schoolYear}
        onSchliessen={()=>setStundenplanDialog(null)}
        onAusfuehren={fuehreStundenplanAn}
      />
      <RhythmusDialog
        offen={stundenplanDialog?.art === 'rhythmus'}
        modell={stundenplanDialog?.modell || null}
        aktuelleWoche={view.weekStart}
        schoolCalendar={db?.schoolCalendar}
        schuljahr={db?.schoolCalendar?.schoolYear}
        onSchliessen={()=>setStundenplanDialog(null)}
        onSpeichern={(patch)=>{
          const m = stundenplanDialog?.modell;
          if (!m) return;
          speichereStundenplanModell({ ...m, ...patch });
          setStundenplanDialog(null);
          showToast('Wochenrhythmus gespeichert.');
        }}
      />

      {/* ---- Einführung ------------------------------------------------

          Drei Teile: die einmalige Willkommensansicht, der Coachmark am
          jeweils nächsten Schritt und die Checkliste am Rand. Alles
          andere erklärt sich später von selbst – und nur dann. */}
      <WillkommenAnsicht
        offen={willkommenOffen}
        importMoeglich={capabilities.backupFiles}
        onWaehlen={(weg)=>waehleOnboardingWeg(weg)}
        onSpaeter={()=>{
          setWillkommenBeantwortet(true);
          setzeOnboarding(pausiereOnboarding(onboarding));
        }}
      />

      {/* Der Schnellstart. Der Hinweis nach der ersten Phase kommt
          dazwischen: Er verlangt nichts und wird deshalb kein Schritt. */}
      {(schnellstartId === 'abschluss' && onboardingArt === 'stunde'
        && !istHinweisErledigt(onboarding, PHASEN_HINWEIS.id)) ? (
        <Coachmark
          offen
          titel={PHASEN_HINWEIS.titel}
          text={PHASEN_HINWEIS.text}
          ziel={SCHNELLSTART_TEXTE.phase.ziel}
          aktionen={[
            { id: 'ok', label: 'Verstanden', tone: 'primary',
              onSelect: ()=>setzeOnboarding(merkeHinweis(onboarding, PHASEN_HINWEIS.id, 'verstanden')) },
          ]}
          onSchliessen={()=>setzeOnboarding(pausiereOnboarding(onboarding))}
        />
      ) : (schnellstartId === 'abschluss' && onboardingArt !== 'stunde') ? (
        /* Der Abschluss des Weges über die Unterrichtszeiten. Er führt
           dorthin, wo es weitergeht: zur ersten planbaren Stunde. */
        <Coachmark
          offen
          titel={(onboardingArt === 'zeitenAB' ? ZEITEN_TEXTE.abschlussAB : ZEITEN_TEXTE.abschluss).titel}
          text={(onboardingArt === 'zeitenAB' ? ZEITEN_TEXTE.abschlussAB : ZEITEN_TEXTE.abschluss).text}
          ziel={(onboardingArt === 'zeitenAB' ? ZEITEN_TEXTE.abschlussAB : ZEITEN_TEXTE.abschluss).ziel}
          aktionen={[
            { id: 'planen', label: 'Nächste Unterrichtsstunde planen', tone: 'primary',
              onSelect: ()=>beendeSchnellstart(()=>oeffneNaechsteStunde()) },
            { id: 'woche', label: 'Zur Wochenübersicht',
              onSelect: ()=>beendeSchnellstart(()=>setView(v => ({ name: 'week', weekStart: v.weekStart }))) },
            { id: 'vorlage', label: 'Vorlage weiter bearbeiten',
              onSelect: ()=>beendeSchnellstart(()=>setView(v => ({ name: 'timetable', weekStart: v.weekStart }))) },
          ]}
          onSchliessen={()=>beendeSchnellstart()}
        />
      ) : schnellstartId === 'abschluss' ? (
        <Coachmark
          offen
          titel={SCHNELLSTART_TEXTE.abschluss.titel}
          text={SCHNELLSTART_TEXTE.abschluss.text}
          ziel={SCHNELLSTART_TEXTE.abschluss.ziel}
          aktionen={[
            { id: 'phase', label: 'Weitere Phase hinzufügen',
              onSelect: ()=>beendeSchnellstart(()=>zielBedienen('stunde-phase-hinzu', { klicken: true })) },
            { id: 'sequenz', label: 'Stunde einer Sequenz zuordnen',
              onSelect: ()=>beendeSchnellstart(()=>zielBedienen('stunde-sequenz')) },
            { id: 'woche', label: 'Zur Wochenübersicht', tone: 'primary',
              onSelect: ()=>beendeSchnellstart(()=>setView(v => ({ name: 'week', weekStart: v.weekStart }))) },
          ]}
          onSchliessen={()=>beendeSchnellstart()}
        />
      ) : schnellstartId ? (
        <Coachmark
          offen
          titel={(onboardingArt === 'stunde' ? SCHNELLSTART_TEXTE : ZEITEN_TEXTE)[schnellstartId]?.titel || ''}
          text={(onboardingArt === 'stunde' ? SCHNELLSTART_TEXTE : ZEITEN_TEXTE)[schnellstartId]?.text || ''}
          ziel={(onboardingArt === 'stunde' ? SCHNELLSTART_TEXTE : ZEITEN_TEXTE)[schnellstartId]?.ziel || ''}
          fortschritt={`${onboardingListe.filter(id => onboardingSchritte[id]).length} von ${onboardingListe.length}`}
          onSchliessen={()=>{
            setzeOnboarding(pausiereOnboarding(onboarding));
            showToast('Einführung pausiert. In den Einstellungen kannst du sie fortsetzen.');
          }}
        />
      ) : null}

      {/* Kontextbezogene Hinweise: höchstens einer je Sitzung.

          Manche bieten zusätzlich eine Handlung an – dann führt sie
          direkt dorthin, wovon der Hinweis spricht. */}
      <Coachmark
        offen={Boolean(aktiverHinweis && !dialogeOffen)}
        titel={aktiverHinweis?.titel || ''}
        text={aktiverHinweis?.text || ''}
        ziel={aktiverHinweis?.ziel || ''}
        aktionen={[
          ...(aktiverHinweis?.hauptaktion ? [{
            id: 'haupt',
            label: aktiverHinweis.hauptaktion.label,
            tone: 'primary',
            onSelect: ()=>{
              const aktion = aktiverHinweis.hauptaktion.id;
              beantworteHinweis('verstanden');
              if (aktion === 'vorlageAnlegen') {
                setView(v => ({ name: 'timetable', weekStart: v.weekStart }));
                setStundenplanDialog({ art: 'assistent' });
              } else if (aktion === 'wocheAlsVorlage') {
                setStundenplanDialog({ art: 'ausWoche' });
              }
            },
          }] : []),
          ...(aktiverHinweis?.hauptaktion ? [] : [
            { id: 'ok', label: 'Verstanden', tone: 'primary', onSelect: ()=>beantworteHinweis('verstanden') },
          ]),
          { id: 'spaeter', label: 'Später', onSelect: ()=>beantworteHinweis('spaeter') },
          ...(aktiverHinweis?.ohneNie ? [] : [
            { id: 'nie', label: 'Nicht mehr anzeigen', onSelect: ()=>beantworteHinweis('nie') },
          ]),
        ]}
        onSchliessen={()=>beantworteHinweis('spaeter')}
      />

      <OnboardingCheckliste
        offen={!dialogeOffen && zeigeCheckliste(liveDb, onboarding)}
        schritte={onboardingSchritte}
        reihenfolge={onboardingListe}
        texte={ONB_SCHRITT_TEXT}
        eingeklappt={onboarding.checkliste.eingeklappt}
        onEinklappen={(wert)=>setzeOnboarding(setzeCheckliste(onboarding, { eingeklappt: wert }))}
        onAusblenden={()=>{
          setzeOnboarding(setzeCheckliste(onboarding, { sichtbar: false }));
          showToast('Checkliste ausgeblendet. Über die Einstellungen kommt sie zurück.');
        }}
      />

      <VerschiebenDialog
        offen={!!verschiebenDialog}
        db={liveDb}
        sequenceId={verschiebenDialog?.sequenceId || ''}
        ab={verschiebenDialog?.ab || null}
        startUmfang={verschiebenDialog?.umfang || VERSCHIEBE_UMFANG.GESAMT}
        startWochen={verschiebenDialog?.wochen}
        heuteISO={todayISO}
        onAusfuehren={fuehreVerschiebungAus}
        onSchliessen={()=>setVerschiebenDialog(null)}
      />
      <VersionsverlaufDialog
        offen={!!verlaufDialog}
        titel={verlaufDialog?.titel || 'Versionsverlauf'}
        untertitel={verlaufDialog?.untertitel || ''}
        eintraege={verlaufEintraege}
        laedt={verlaufLaedt}
        db={liveDb}
        readOnly={imArchiv}
        ortName={(teil)=>{
          if (!teil) return '';
          if (teil.art === 'stunde') return stundenLabel(teil.weekStart, teil.dayIndex, teil.slotIndex, blockSpanOf(teil.wert));
          if (teil.art === 'sequenz') return liveDb?.sequences?.[teil.id]?.name || 'Sequenz';
          if (teil.art === 'vorlage') return liveDb?.sequenceTemplates?.[teil.id]?.name || 'Vorlage';
          if (teil.art === 'balken') {
            const b = (Array.isArray(liveDb?.yearBars) ? liveDb.yearBars : []).find(x => x?.id === teil.id);
            return b?.title || 'Jahresbalken';
          }
          return '';
        }}
        onWiederherstellen={(eintrag)=>stelleVersionHer(eintrag)}
        onSchliessen={()=>setVerlaufDialog(null)}
      />
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title || ''}
        body={confirmState?.body || ''}
        confirmLabel={confirmState?.confirmLabel || 'Fortfahren'}
        tone={confirmState?.tone || 'primary'}
        onCancel={()=>{ confirmState?.onCancel?.(); setConfirmState(null); }}
        onConfirm={()=>{ const c = confirmState; setConfirmState(null); c?.onConfirm?.(); }}
      />
      <PromptDialog
        open={!!promptState}
        title={promptState?.title || ''}
        label={promptState?.label || ''}
        placeholder={promptState?.placeholder || ''}
        initialValue={promptState?.initialValue || ''}
        confirmLabel={promptState?.confirmLabel || 'Übernehmen'}
        erlaubeLeer={Boolean(promptState?.erlaubeLeer)}
        onCancel={()=>{ promptState?.onCancel?.(); setPromptState(null); }}
        onConfirm={(v)=>{ const c = promptState; setPromptState(null); c?.onConfirm?.(v); }}
      />
      <TodoReminderOverlay
        visible={todoReminderVisible}
        count={todosDueTodayCount}
        onDismiss={()=>setTodoReminderVisible(false)}
        onOpen={()=>{ setTodoReminderVisible(false); setView({ name:'todos', weekStart: lastMainView.current.weekStart }); }}
      />
      <WeekCopyDialog
        visible={showWeekCopyDialog}
        weekTodosCount={weekTodosCount}
        futureWeekTodosCount={futureWeekTodosCount}
        onClose={()=>setShowWeekCopyDialog(false)}
        onConfirm={({copyTodos, shiftTodoDates, copyDuties})=>{
          setShowWeekCopyDialog(false);
          duplicateToNextWeek({ copyTodos, shiftTodoDates, copyDuties });
        }}
      />
      <SchoolYearRolloverDialog
        visible={schoolYearDialog.visible}
        reason={schoolYearDialog.reason}
        oldLabel={schoolYearDialog.oldLabel}
        oldStartISO={schoolYearDialog.oldStartISO}
        oldEndISO={schoolYearDialog.oldEndISO}
        newStartISO={schoolYearDialog.newStartISO}
        newEndISO={schoolYearDialog.newEndISO}
        keepColors={schoolYearDialog.keepColors}
        keepTodos={schoolYearDialog.keepTodos}
        archivesCount={(liveDb?.schoolYearArchives || []).length}
        onChange={(patch)=>setSchoolYearDialog(prev=>({ ...prev, ...patch }))}
        onClose={closeSchoolYearDialog}
        onSnooze={()=>snoozeSchoolYearDialog(7)}
        onDismiss={dismissSchoolYearDialogForCurrentEndDate}
        onConfirm={()=>archiveAndStartNewSchoolYear({
          newStartISO: schoolYearDialog.newStartISO,
          newEndISO: schoolYearDialog.newEndISO,
          keepColors: schoolYearDialog.keepColors,
          keepTodos: schoolYearDialog.keepTodos
        })}
      />
      <PastelPaletteModal
        visible={colorPalette.visible}
        title={colorPalette.label ? `Lerngruppe: ${colorPalette.label}` : 'Lerngruppen-Farbe'}
        current={colorPalette.key ? ((db.groupColors||{})[colorPalette.key]?.color || defaultGroupColor(colorPalette.key)) : ''}
        colors={GROUP_PASTELS}
        onPick={(c)=>{ setGroupColorForKey(colorPalette.key, c); closeGroupColorPalette(); }}
        onReset={()=>{ setGroupColorForKey(colorPalette.key, defaultGroupColor(colorPalette.key)); closeGroupColorPalette(); }}
        onClose={closeGroupColorPalette}
      />
      {seqManagerModal.open && (
        <SequenceManager
          key={seqManagerModal.nonce}
          sequences={sequences}
          appSettings={appSettings}
          onUpdateAppSettings={updateAppSettings}
          schoolCalendar={schoolCalendar}
          onClose={closeSequenceManagerModal}
          onCreate={(name)=>createSequence(name)}
          onUpdate={(id, patch)=>updateSequence(id, patch)}
          onDelete={(id)=>deleteSequence(id)}
          onDuplicate={(id)=>duplicateSequence(id)}
          onOpenVerlauf={verlaufSpeicher.verfuegbar ? ((id)=>oeffneVerlauf({
            bereich: 'sequence',
            zielId: sequenzZiel(id),
            titel: 'Versionsverlauf der Sequenz',
            untertitel: sequences?.[id]?.name || 'Sequenz',
          })) : null}
          onVerschieben={imArchiv ? null : ((id)=>{
            closeSequenceManagerModal();
            oeffneVerschieben({ sequenceId: id, umfang: VERSCHIEBE_UMFANG.GESAMT });
          })}
          competencySuggestions={sichtbareKompetenzVorschlaege}
          languageMode={languageMode}
          competencyModel={competencyModel}
          benutzteKompetenzen={benutzteKompetenzen}
          onRememberCompetency={rememberCompetency}
          onOpenProgression={(sequenceId)=>{
            closeSequenceManagerModal();
            setView({ name:'progression', sequenceId, weekStart: view.weekStart });
          }}
          afterCreate={seqManagerModal.afterCreate}
          autoCloseOnCreate={seqManagerModal.autoCloseOnCreate}
          onSaveAsTemplate={(id)=>{
            const seq = sequences?.[id];
            askPrompt({
              title: 'Sequenz als Vorlage speichern',
              label: 'Name der Vorlage',
              placeholder: 'z. B. Einführung Perfekt',
              initialValue: seq?.name || '',
              confirmLabel: 'Vorlage speichern',
            }).then((name)=>{
              if (!name) return;
              const tid = createTemplateFromSequence(id, name);
              if (tid) showToast('Vorlage gespeichert – du findest sie in der Bibliothek.');
            });
          }}
          onExportPdfSequence={(id)=>exportSequenceAs(id, 'pdf')}
          onExportDocxSequence={(id)=>exportSequenceAs(id, 'docx')}
        />
      )}
    </div>
    </UiContext.Provider>
  );
}

function WeekView({ weekStart, week, sequences, schoolCalendar, todos, todayISO, groupColors, duties, supervisionSuggestions, onHideSupervisionSuggestion = ()=>{},
  onboardingPlatz = null,
  rhythmus = null, onRhythmusAusnahme = null, onAlsVorlage = null,
  readOnly = false,
  lessonClipboard, onCopyLesson, onCutLesson, onPasteLesson, onLessonDnd, onReviewLesson,
  onJoinBlock, onSplitBlock,
  onOpenGroupColorPalette, onOpenLesson, onOpenMacro, onOpenTodos, onChangeSlots, onDeleteLesson, onUpsertDuty, onDeleteDuty, onExportPdf, onExportDocx }){
  const slots = week.slotsPerDay || 6;
  const dutyMap = duties || week.duties || {};
  const [dutyEditor, setDutyEditor] = useState(null);
  const [dropKey, setDropKey] = useState(null);

  /* Feste Zeilen statt automatischer Platzierung.

     Nötig für Doppelstunden: eine Zelle, die zwei Stundenplätze belegt,
     überspannt drei Rasterzeilen (Stunde – Aufsichtsstreifen – Stunde).
     Mit automatischer Platzierung würden die übrigen Zellen dabei
     verrutschen; mit fester Zeilen-/Spaltenangabe steht jede Zelle da,
     wo sie hingehört. */
  const kopfZeileNr = 1;
  const aufsichtZeileNr = (pos) => 2 + pos * 2;
  const stundenZeileNr = (slotIndex) => 3 + slotIndex * 2;
  const spalteNr = (dayIndex) => dayIndex + 2;

  /* Wer belegt diesen Platz? Entweder er trägt selbst eine Stunde oder
     eine Doppelstunde weiter oben deckt ihn ab. */
  const besitzerVon = (dayIndex, slotIndex) => blockOwnerAt(week, dayIndex, slotIndex);

  /* Liegt dieser Aufsichtsstreifen INNERHALB einer Doppelstunde? Dann
     gibt es dort keine Pause und auch kein Feld dafür. */
  const inDoppelstunde = (dayIndex, pos) => {
    if (pos <= 0 || pos >= slots) return false;
    const o = besitzerVon(dayIndex, pos);
    return Boolean(o && o.covered);
  };

  /* Lässt sich die Stunde an diesem Platz mit der folgenden verbinden?
     Beide müssen existieren, zur selben Lerngruppe gehören und der
     Folgeplatz muss frei von einer anderen Doppelstunde sein. */
  const verbindbarAb = (dayIndex, slotIndex) => {
    const l = week.lessons?.[keyOf(dayIndex, slotIndex)];
    if (!l) return false;
    const span = blockSpanOf(l);
    const naechster = slotIndex + span;
    if (naechster >= slots) return false;
    if (span >= MAX_BLOCK_SPAN) return false;
    const b = week.lessons?.[keyOf(dayIndex, naechster)];
    if (!b) return false;
    if (span + blockSpanOf(b) > MAX_BLOCK_SPAN) return false;
    return passenZusammen(l, b);
  };

  const dutyLabel = (pos) => {
    if (pos === 0) return 'vor der 1. Stunde';
    if (pos === slots) return 'nach der letzten Stunde';
    return `zwischen ${pos}. und ${pos+1}. Stunde`;
  };

  const openDutyEditor = (dayIndex, pos) => {
    // In der Archivansicht wird die Aufsicht nur angezeigt.
    if (readOnly) return;
    setDutyEditor({ dayIndex, pos });
  };

  // Keep the duty rows visually minimal: red bars live between lesson rows.
  // We only label the very first / last boundary in the left column; the rest is blank.
  const dutyRowLabelShort = (pos) => {
    if (pos === 0) return 'Aufsicht';
    if (pos === slots) return 'Aufsicht';
    return '';
  };

  const renderDutyRow = (pos) => {
    // One row of small red bars between lessons (or before first / after last)
    return (
      <React.Fragment key={`dutyrow-${pos}`}>
        <div className="dutyRowLabel" style={{gridColumn:1, gridRow: aufsichtZeileNr(pos)}} title={dutyLabel(pos)}>{dutyRowLabelShort(pos)}</div>
        {DAYS.map((_, dayIndex)=>{
          const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
          const info = getDayInfo(dateISO, schoolCalendar);
          const dutyKey = `${dayIndex}-${pos}`;
          const duty = dutyMap[dutyKey];
          // Innerhalb einer Doppelstunde gibt es keinen Streifen: die
          // Stunde läuft dort durch.
          if (inDoppelstunde(dayIndex, pos)) return null;
          return (
            <div
              key={`duty-${pos}-${dayIndex}`}
              style={{gridColumn: spalteNr(dayIndex), gridRow: aufsichtZeileNr(pos)}}
              className={`dutyCell ${duty ? 'dutyCell--has' : ''} ${info.isOff ? 'dayOffDutyCell' : ''}`}
              onClick={(e)=>{ e.stopPropagation(); openDutyEditor(dayIndex, pos); }}
              title={duty ? `Aufsicht: ${duty.title}` : (readOnly ? '' : 'Aufsicht eintragen')}
              aria-label={duty ? `Aufsicht: ${duty.title}` : (readOnly ? 'Keine Aufsicht' : 'Aufsicht eintragen')}
              role={readOnly ? undefined : 'button'}
              tabIndex={readOnly ? -1 : 0}
              onKeyDown={(e)=>{
                if (e.key === 'Enter' || e.key === ' '){
                  e.preventDefault();
                  openDutyEditor(dayIndex, pos);
                }
              }}
            >
              <span className="dutyCellPlus">{(duty || readOnly) ? '' : '+'}</span>
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  const todoCountByISO = useMemo(()=>{
    const m = new Map();
    const arr = Array.isArray(todos) ? todos : [];
    for (const t of arr){
      if (t?.done) continue;
      const d = (t?.dateISO || '').trim();
      const dl = (t?.deadlineISO || '').trim();
      if (d) m.set(d, (m.get(d) || 0) + 1);
      if (dl && dl !== d) m.set(dl, (m.get(dl) || 0) + 1);
    }
    return m;
  }, [todos]);

  const todayTodoCount = todoCountByISO.get(todayISO) || 0;

  const exportWeekPdf = () => {
    if (typeof onExportPdf !== 'function') {
      showToast('PDF-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }
    const html = buildWeekPdfHtml({ weekStart, week, sequences, groupColors, schoolCalendar, duties: dutyMap });
    const ws = (weekStart || '').replaceAll('-', '');
    onExportPdf(html, `Wochenplan_${ws}.pdf`);
  };


const exportWeekDocx = () => {
  if (typeof onExportDocx !== 'function') {
    showToast('Word-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
    return;
  }
  const html = buildWeekPdfHtml({ weekStart, week, sequences, groupColors, schoolCalendar, duties: dutyMap });
  const ws = (weekStart || '').replaceAll('-', '');
  onExportDocx(html, `Wochenplan_${ws}.doc`);
};

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:800, fontSize:16}}>Wochenübersicht</div>
          <div className="muted small">{readOnly
            ? 'Archiviertes Schuljahr – klicke auf eine Stunde, um die Planung anzusehen.'
            : 'Klicke auf eine Stunde, um in die Einzelstundenplanung zu zoomen.'}</div>
          <div className="row wrap" style={{gap:8, marginTop:6}}>
            <span className="badge">{formatWeekLabel(weekStart)}</span>
            {/* Der Rhythmus dieser Woche. Er kommt aus dem aktiven
                Stundenplanmodell, nicht aus einer einzelnen Stunde –
                deshalb steht er hier oben und sieht anders aus als ein
                Stundenetikett. */}
            {rhythmus?.label ? (
              <span className="badge rhythmusBadge" title={`Aus dem Stundenplan „${rhythmus.modell?.name || ''}"${rhythmus.ausnahme ? ' · manuell abweichend zugeordnet' : ''}`}>
                {rhythmus.label}-Woche{rhythmus.ausnahme ? ' (abweichend)' : ''}
              </span>
            ) : null}
            {(!readOnly && rhythmus?.laenge > 1 && typeof onRhythmusAusnahme === 'function') ? (
              <KebabMenu
                titel="Rhythmus dieser Woche"
                eintraege={Array.from({ length: rhythmus.laenge }).map((_, index)=>({
                  label: `Als ${zyklusLabel(index, rhythmus.laenge)}-Woche führen`,
                  icon: <CalendarClock {...ICON_SM} />,
                  disabled: index === rhythmus.position,
                  title: 'Nur die Zuordnung ändert sich – an den Stunden dieser Woche nichts',
                  onSelect: ()=>onRhythmusAusnahme(index),
                }))}
              />
            ) : null}
          </div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <button className="btn warning" onClick={onOpenTodos} title="To-do-Checkliste öffnen">To-dos{todayTodoCount ? ` (${todayTodoCount})` : ''}</button>
          {(!readOnly && typeof onAlsVorlage === 'function') ? (
            <button className="btn" onClick={onAlsVorlage}
                    data-onboarding-target="woche-als-vorlage"
                    title="Die Unterrichtszeiten dieser Woche als Stundenplanvorlage sichern – ohne Planungsinhalte">
              <CalendarRange {...ICON_SM} /> Als Vorlage speichern
            </button>
          ) : null}
          {capabilities.docxExport ? (
            <button className="btn iconBtn-word" onClick={exportWeekDocx} title="Als Word-Datei speichern"><FileText {...ICON_SM} /> Word Woche</button>
          ) : null}
          {capabilities.pdfExport ? (
            <button className="btn iconBtn-pdf" onClick={exportWeekPdf} title="Als PDF speichern"><FileDown {...ICON_SM} /> PDF Woche</button>
          ) : null}
          <span className="muted small">Stunden pro Tag:</span>
          <input className="input" style={{width:90}} type="number" min={1} max={12} value={slots}
                 disabled={readOnly}
                 title={readOnly ? 'In der Archivansicht nicht änderbar' : ''}
                 onChange={(e)=>onChangeSlots(Number(e.target.value||slots))} />
        </div>
      </div>

      <div style={{height:12}} />

      <div className="grid">
        <div style={{gridColumn:1, gridRow: kopfZeileNr}} />
        {DAYS.map((d, dayIndex) => {
          const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
          const info = getDayInfo(dateISO, schoolCalendar);
          const label = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
          const tc = todoCountByISO.get(dateISO) || 0;
          const isToday = (dateISO === todayISO);
          return (
            <div key={d} style={{gridColumn: spalteNr(dayIndex), gridRow: kopfZeileNr}}
                 className={`cellHeader ${info.isOff ? 'dayOffHeader' : ''}`} title={label}>
              <div style={{fontWeight:700}}>{d}</div>
              <div className="muted small">{formatDateDE(dateISO)}</div>
              {tc ? (
                <button className="todoHint" onClick={(e)=>{ e.stopPropagation(); if (onOpenTodos) onOpenTodos(); }} title="To-dos ansehen (Inhalt wird erst nach Klick gezeigt)"><NotebookPen {...ICON_SM} /> {tc}</button>
              ) : null}
              {label ? <span className="badge" style={{marginTop:4}}>{label}</span> : null}
            </div>
          );
        })}

        {Array.from({length: slots}).map((_, slotIndex)=>{
          return (
            <React.Fragment key={slotIndex}>
              {slotIndex === 0 ? renderDutyRow(0) : null}

              <div className="slotLabel" style={{gridColumn:1, gridRow: stundenZeileNr(slotIndex)}}>{slotIndex+1}. Stunde</div>
              {Array.from({length: DAYS.length}).map((__, dayIndex)=>{
                const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
                const info = getDayInfo(dateISO, schoolCalendar);
                const dayLabel = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
                const k = keyOf(dayIndex, slotIndex);
                const l = week.lessons?.[k];
                /* Ein von einer Doppelstunde abgedeckter Platz bekommt
                   keine eigene Zelle – die Stunde darüber reicht bis
                   hierher. Der Stundenplatz selbst bleibt links in der
                   Zeitachse sichtbar. */
                if (!l && istAbgedeckt(week, dayIndex, slotIndex)) return null;
                const span = l ? Math.min(blockSpanOf(l), Math.max(1, slots - slotIndex)) : 1;
                const istBlock = span > 1;
                const zeilenSpan = span * 2 - 1;
                const kannVerbinden = verbindbarAb(dayIndex, slotIndex);
                const title = l?.subject ? l.subject : (l?.topic ? l.topic : (readOnly ? 'Ohne Titel' : 'Planen…'));
                const sub = l?.classGroup || '';
                const seq = l?.sequenceId ? (sequences?.[l.sequenceId] || null) : null;
                const gKey = l ? groupKey(l.classGroup, l.subject) : '';
                const gColor = gKey ? (groupColors?.[gKey]?.color || defaultGroupColor(gKey)) : '';
                const cellStyle = gColor ? {
                  borderLeft: `7px solid ${lineColor(gColor)}`,
                  background: hexToRgba(surfaceColor(gColor), info.isOff ? 0.07 : 0.12),
                } : undefined;
                /* Der Platz, an dem die Einführung ansetzt. Sie hebt ihn
                   dezent hervor und hängt ihren Hinweis daran – ohne
                   Bildschirmkoordinaten und ohne eigene Zellenlogik. */
                const istOnboardingPlatz = !l && onboardingPlatz
                  && onboardingPlatz.dayIndex === dayIndex && onboardingPlatz.slotIndex === slotIndex;
                return (
                  <div
                    key={k}
                    style={{...(cellStyle || {}), gridColumn: spalteNr(dayIndex), gridRow: `${stundenZeileNr(slotIndex)} / span ${zeilenSpan}`}}
                    data-onboarding-target={istOnboardingPlatz ? 'wochen-freier-platz' : undefined}
                    className={`lessonCell ${info.isOff ? 'dayOffCell' : ''} ${gKey ? 'hasGroupColor' : ''} ${istBlock ? 'lessonCell--block' : ''} ${dropKey === k ? 'dropTarget' : ''} ${(readOnly && !l) ? 'lessonCell--leer' : ''}${istOnboardingPlatz ? ' lessonCell--onboarding' : ''}`}
                    tabIndex={(readOnly && !l) ? -1 : 0}
                    onClick={()=>{
                      // Im Archiv gibt es an einem leeren Platz nichts anzusehen.
                      if (readOnly && !l) return;
                      onOpenLesson(dayIndex, slotIndex);
                    }}
                    title={dayLabel
                      ? `${dayLabel}${(readOnly && !l) ? '' : ' (trotzdem öffnen)'}`
                      : (l
                        ? `${istBlock ? `${blockName(span)} · ${stundenBereichLabel(slotIndex, span)} · ` : ''}${readOnly ? 'Ansehen' : 'Öffnen (ziehen zum Verschieben, Ctrl+Ziehen zum Kopieren)'}`
                        : (readOnly ? 'Keine Stunde eingetragen' : 'Öffnen'))}
                    draggable={!!l && !readOnly}
                    onDragStart={(e)=>{
                      if (!l) return;
                      try {
                        const payload = { t:'lesson', weekStart, dayIndex, slotIndex };
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('application/x-prepybara-lesson', JSON.stringify(payload));
                        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                      } catch {}
                    }}
                    onDragOver={(e)=>{
                      if (readOnly) return;
                      try {
                        const types = Array.from(e.dataTransfer.types || []);
                        if (!types.includes('application/x-prepybara-lesson')) return;
                        e.preventDefault();
                        setDropKey(k);
                      } catch {}
                    }}
                    onDragLeave={()=>{ if (dropKey === k) setDropKey(null); }}
                    onDrop={(e)=>{
                      if (readOnly) return;
                      try {
                        const raw = e.dataTransfer.getData('application/x-prepybara-lesson');
                        if (!raw) return;
                        const payload = JSON.parse(raw);
                        if (!payload || payload.t !== 'lesson') return;
                        e.preventDefault();
                        setDropKey(null);
                        const mode = e.ctrlKey ? 'copy' : 'move';
                        onLessonDnd?.({ from: payload, to: { weekStart, dayIndex, slotIndex }, mode });
                      } catch {}
                    }}
                  >

                    {/* Werkzeuge sind Änderungen – im Archiv gibt es keine. */}
                    {(!readOnly && (l || lessonClipboard)) ? (
                      <div className="cellTools" onClick={(e)=>e.stopPropagation()}>
                        {l ? (
                          <>
                            <button
                              className="iconBtn cellTool"
                              onClick={()=>onCopyLesson?.(dayIndex, slotIndex)}
                              title="Stunde kopieren (interne Zwischenablage)"
                              aria-label="Stunde kopieren"
                            ><Copy {...ICON_SM} /></button>
                            <button
                              className="iconBtn cellTool"
                              onClick={()=>onCutLesson?.(dayIndex, slotIndex)}
                              title="Stunde ausschneiden (interne Zwischenablage)"
                              aria-label="Stunde ausschneiden"
                            ><Scissors {...ICON_SM} /></button>
                            <button
                              className="iconBtn cellTool"
                              onClick={()=>onReviewLesson?.(dayIndex, slotIndex)}
                              title="Nachbereiten"
                              aria-label="Stunde nachbereiten"
                            ><ClipboardCheck {...ICON_SM} /></button>
                            {istBlock ? (
                              <button
                                className="iconBtn cellTool"
                                onClick={()=>onSplitBlock?.(dayIndex, slotIndex)}
                                title={`${blockName(span)} wieder in Einzelstunden trennen`}
                                aria-label="Doppelstunde trennen"
                              ><Unlink {...ICON_SM} /></button>
                            ) : kannVerbinden ? (
                              <button
                                className="iconBtn cellTool"
                                onClick={()=>onJoinBlock?.(dayIndex, slotIndex)}
                                title="Mit der folgenden Stunde als Doppelstunde verbinden"
                                aria-label="Als Doppelstunde verbinden"
                              ><Link2 {...ICON_SM} /></button>
                            ) : null}
                          </>
                        ) : null}
                        {lessonClipboard ? (
                          <button
                            className="iconBtn cellTool"
                            onClick={()=>onPasteLesson?.(dayIndex, slotIndex)}
                            title="Stunde einfügen"
                            aria-label="Stunde einfügen"
                          ><ClipboardPaste {...ICON_SM} /></button>
                        ) : null}

                        {l ? (
                          <button
                            className="iconBtn danger cellTool"
                            onClick={(e)=>{
                              e.stopPropagation();
                              onDeleteLesson(dayIndex, slotIndex);
                            }}
                            title="Stunde löschen"
                            aria-label="Stunde löschen"
                          ><Trash2 {...ICON_SM} /></button>
                        ) : null}
                      </div>
                    ) : null}
                    {(gKey && !readOnly) ? (
                      <button
                        className="groupColorChip groupColorChip--corner"
                        style={{background: surfaceColor(gColor)}}
                        onClick={(e)=>{
                          e.stopPropagation();
                          onOpenGroupColorPalette?.(gKey, `${l?.classGroup || ''} · ${l?.subject || ''}`.trim());
                        }}
                        title="Farbe der Lerngruppe ändern"
                        aria-label="Farbe der Lerngruppe ändern"
                      />
                    ) : null}
                    <div className="title">{l ? title : (readOnly ? '' : 'Planen…')}</div>
                    <div className="sub">{sub}</div>
                    {istBlock ? (
                      <span className="blockBadge" title={`${stundenBereichLabel(slotIndex, span)} · ${TOTAL_MIN * span} Minuten am Stück`}>
                        <Link2 {...ICON_SM} /> {blockName(span)} · {stundenBereichLabel(slotIndex, span)}
                      </span>
                    ) : null}
                    {seq ? <span className="badge" style={{borderColor: lineColor(seq.color), color: textColor(seq.color)}}>Sequenz: {seq.name}</span> : null}
                    {l?.topic
                      ? <span className="badge">Thema: {l.topic}</span>
                      : (l || !readOnly) ? <span className="badge">Noch kein Thema</span> : null}
                    {(()=>{
                      /* Dezentes Kennzeichen, kein Warnsymbol: ein Haken für
                         nachbereitet, ein Punkt für noch Vorgemerktes. */
                      if (!l) return null;
                      const offen = offeneCarryOver(l.review).length;
                      if (offen) return (
                        <span className="nbMarke" title={`${offen} ${offen === 1 ? 'offener Punkt' : 'offene Punkte'} für die nächste Stunde`}>
                          <span className="nbMarkePunkt" aria-hidden="true" />
                          {offen}
                        </span>
                      );
                      if (hatNachbereitung(l.review)) return (
                        <span className="nbMarke" title="nachbereitet"><Check {...ICON_SM} /></span>
                      );
                      return null;
                    })()}
                  </div>
                );
              })}

              {renderDutyRow(slotIndex+1)}
            </React.Fragment>
          );
        })}
      </div>

      <DutyDialog
        visible={!!dutyEditor}
        dayIndex={dutyEditor?.dayIndex ?? 0}
        pos={dutyEditor?.pos ?? 0}
        slots={slots}
        dayName={DAYS[dutyEditor?.dayIndex ?? 0]}
        existingTitle={dutyEditor ? (dutyMap[`${dutyEditor.dayIndex}-${dutyEditor.pos}`]?.title || '') : ''}
        suggestions={supervisionSuggestions}
        onHideSuggestion={onHideSupervisionSuggestion}
        onClose={()=>setDutyEditor(null)}
        onSave={(title)=>{
          if (!dutyEditor) return;
          onUpsertDuty?.(dutyEditor.dayIndex, dutyEditor.pos, title);
          setDutyEditor(null);
        }}
        onDelete={()=>{
          if (!dutyEditor) return;
          onDeleteDuty?.(dutyEditor.dayIndex, dutyEditor.pos);
          setDutyEditor(null);
        }}
      />

    </div>
  );
}

/* Die Übersicht über die archivierten Schuljahre.

   Sie liest nur: jede Karte zeigt, was in dem Abzug steckt, und
   bietet an, ihn anzusehen oder auszugeben. Geöffnet wird immer eine
   Ansicht, nie ein Rückschreiben in die aktuellen Daten. */
function ArchiveOverviewView({ archive, onOpen, onExport, onDelete, onBack }){
  const liste = useMemo(()=>{
    const arr = Array.isArray(archive) ? [...archive] : [];
    // Neuestes zuerst: erst nach Archivierungszeitpunkt, dann nach Schuljahresende.
    arr.sort((a,b)=> String(b?.archivedAt || '').localeCompare(String(a?.archivedAt || ''))
      || String(b?.endISO || '').localeCompare(String(a?.endISO || '')));
    return arr;
  }, [archive]);

  const zeitraum = (a)=>{
    const s = String(a?.startISO || '').trim();
    const e = String(a?.endISO || '').trim();
    if (!s && !e) return 'Zeitraum nicht hinterlegt';
    if (s && e) return `${formatDateDE(s)} – ${formatDateDE(e)}`;
    return formatDateDE(s || e);
  };

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Archivierte Schuljahre</div>
          <div className="muted small">
            Abgeschlossene Schuljahre. Sie lassen sich ansehen und ausgeben – geändert wird darin nichts.
          </div>
        </div>
        <button className="btn" onClick={onBack}>Zum Schulkalender</button>
      </div>

      <div style={{height:14}} />

      {liste.length === 0 ? (
        <EmptyState
          text="Noch kein Schuljahr archiviert. Beim Start eines neuen Schuljahres wird das bisherige hier abgelegt."
        />
      ) : (
        <div className="archivListe">
          {liste.map(a => {
            const k = archivKennzahlen(a);
            const bereiche = archivBereiche(a);
            const fehlend = [
              bereiche.wochen ? null : 'Wochenplanung',
              bereiche.sequenzen ? null : 'Sequenzen',
              bereiche.jahresplanung ? null : 'Jahresplanung',
            ].filter(Boolean);
            return (
              <div key={a.id} className="archivKarte">
                <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start', gap:12}}>
                  <div style={{minWidth:0}}>
                    <div className="row" style={{gap:8, alignItems:'center'}}>
                      <Archive {...ICON_SM} />
                      <span style={{fontWeight:900, fontSize:15}}>{a.label || 'Schuljahr'}</span>
                    </div>
                    <div className="muted small" style={{marginTop:2}}>{zeitraum(a)}</div>
                    <div className="muted small">
                      Archiviert am {formatDateDE(String(a.archivedAt || '').slice(0,10))}
                    </div>
                  </div>
                  <div className="row wrap" style={{gap:8}}>
                    <button className="btn primary" onClick={()=>onOpen(a.id)}>Ansehen</button>
                    {capabilities.archiveFiles ? (
                      <button className="btn" onClick={()=>onExport(a.id)} title="Als Backup-Datei speichern">
                        <Download {...ICON_SM} /> Exportieren
                      </button>
                    ) : null}
                    <KebabMenu
                      titel={`Weitere Aktionen für ${a.label || 'dieses Schuljahr'}`}
                      eintraege={[
                        capabilities.archiveFiles ? {
                          label: 'Als Backup-Datei speichern',
                          icon: <Download {...ICON_SM} />,
                          onSelect: ()=>onExport(a.id),
                        } : null,
                        capabilities.archiveFiles ? { trenner: true } : null,
                        {
                          label: 'Archiv endgültig löschen',
                          icon: <Trash2 {...ICON_SM} />,
                          tone: 'danger',
                          onSelect: ()=>onDelete(a.id),
                        },
                      ].filter(Boolean)}
                    />
                  </div>
                </div>

                <div className="row wrap" style={{gap:6, marginTop:10}}>
                  <span className="pill">{k.lerngruppen} {k.lerngruppen === 1 ? 'Lerngruppe' : 'Lerngruppen'}</span>
                  <span className="pill">{k.stunden} {k.stunden === 1 ? 'Planung' : 'Planungen'}</span>
                  <span className="pill">{k.sequenzen} {k.sequenzen === 1 ? 'Sequenz' : 'Sequenzen'}</span>
                  {k.balken ? <span className="pill">{k.balken} {k.balken === 1 ? 'Balken' : 'Balken'} im Jahresplan</span> : null}
                  {k.todos ? <span className="pill">{k.todos} {k.todos === 1 ? 'To-do' : 'To-dos'}</span> : null}
                  <span className="pill">{k.wochen} {k.wochen === 1 ? 'Woche' : 'Wochen'}</span>
                </div>

                {fehlend.length ? (
                  <div className="muted small" style={{marginTop:8}}>
                    Nicht in diesem Abzug enthalten: {fehlend.join(', ')}. Das Archiv stammt aus einer früheren Fassung.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SchoolCalendarView({ calendar, onUpdate, onStartNewSchoolYear, archivesCount = 0, onOpenArchives, readOnly = false }){
  const cal = calendar || { schoolYear:{startISO:'', endISO:''}, lessonTimesEnabled:false, lessonTimes:[], vacations:[], freeDays:[], events:[] };
  const schoolYear = cal.schoolYear || { startISO:'', endISO:'' };

  const [newVac, setNewVac] = useState({ name: '', startISO: '', endISO: '' });
  const [newFree, setNewFree] = useState({ name: '', dateISO: '' });
  const [newEv, setNewEv] = useState({ name: '', dateISO: '', startTime: '', endTime: '' });

  const fileRef = useRef(null);
  const [importRows, setImportRows] = useState(null);

  const vacations = useMemo(()=>{
    const v = Array.isArray(cal.vacations) ? [...cal.vacations] : [];
    v.sort((a,b)=>(a.startISO||'').localeCompare(b.startISO||''));
    return v;
  }, [cal.vacations]);

  const freeDays = useMemo(()=>{
    const f = Array.isArray(cal.freeDays) ? [...cal.freeDays] : [];
    f.sort((a,b)=>(a.dateISO||'').localeCompare(b.dateISO||''));
    return f;
  }, [cal.freeDays]);

  const events = useMemo(()=>{
    const e = Array.isArray(cal.events) ? [...cal.events] : [];
    e.sort((a,b)=>{
      const ad = (a.dateISO||a.startISO||'');
      const bd = (b.dateISO||b.startISO||'');
      return ad.localeCompare(bd);
    });
    return e;
  }, [cal.events]);

  const setSchoolYear = (patch) => {
    onUpdate((prev)=>({ ...prev, schoolYear: { ...(prev.schoolYear||{startISO:'', endISO:''}), ...patch } }));
  };

  const addVacation = () => {
    const name = (newVac.name || '').trim() || 'Ferien';
    let startISO = (newVac.startISO || '').trim();
    let endISO = (newVac.endISO || '').trim();
    if (!startISO || !endISO) return;
    if (endISO < startISO) { const t = startISO; startISO = endISO; endISO = t; }
    onUpdate((prev)=>({ ...prev, vacations: [...(prev.vacations||[]), { id: uid(), name, startISO, endISO }] }));
    setNewVac({ name: '', startISO: '', endISO: '' });
  };

  const addFreeDay = () => {
    const name = (newFree.name || '').trim() || 'Schulfrei';
    const dateISO = (newFree.dateISO || '').trim();
    if (!dateISO) return;
    onUpdate((prev)=>({ ...prev, freeDays: [...(prev.freeDays||[]), { id: uid(), name, dateISO }] }));
    setNewFree({ name: '', dateISO: '' });
  };

  const addEvent = () => {
    const name = (newEv.name || '').trim() || 'Termin';
    const dateISO = (newEv.dateISO || '').trim();
    if (!dateISO) return;
    onUpdate((prev)=>({ ...prev, events: [...(prev.events||[]), { id: uid(), name, dateISO, startTime: (newEv.startTime||''), endTime: (newEv.endTime||'') }] }));
    setNewEv({ name: '', dateISO: '', startTime: '', endTime: '' });
  };

  const onPickIcs = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const onIcsSelected = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseICS(text);
    const rows = parsed.map(ev => {
      let type = 'event';
      if (ev.allDay && ev.startISO === ev.endISO) type = 'freeDay';
      if (ev.allDay && ev.startISO !== ev.endISO) type = 'vacation';
      return {
        id: uid(),
        import: true,
        type,
        summary: ev.summary,
        description: ev.description,
        startISO: ev.startISO,
        endISO: ev.endISO,
        startTime: ev.startTime,
        endTime: ev.endTime
      };
    });
    setImportRows(rows);
  };

  const commitImport = (rows) => {
    const selected = (rows || []).filter(r => r.import);
    if (selected.length === 0) { setImportRows(null); return; }

    onUpdate((prev)=>{
      const next = { ...prev };
      next.vacations = Array.isArray(next.vacations) ? [...next.vacations] : [];
      next.freeDays = Array.isArray(next.freeDays) ? [...next.freeDays] : [];
      next.events = Array.isArray(next.events) ? [...next.events] : [];

      const vacKeys = new Set(next.vacations.map(v => `${(v.name||'').trim()}|${v.startISO}|${v.endISO}`));
      const freeKeys = new Set(next.freeDays.map(f => `${(f.name||'').trim()}|${f.dateISO}`));
      const evKeys = new Set(next.events.map(e => `${(e.name||e.summary||'').trim()}|${e.dateISO}|${e.startTime||''}|${e.endTime||''}`));

      for (const r of selected){
        const name = (r.summary || '').trim() || 'Eintrag';
        if (r.type === 'vacation') {
          let s = r.startISO, e = r.endISO;
          if (!s || !e) continue;
          if (e < s) { const t=s; s=e; e=t; }
          const key = `${name}|${s}|${e}`;
          if (vacKeys.has(key)) continue;
          vacKeys.add(key);
          next.vacations.push({ id: uid(), name, startISO: s, endISO: e });
        } else if (r.type === 'freeDay') {
          const d = r.startISO;
          if (!d) continue;
          const key = `${name}|${d}`;
          if (freeKeys.has(key)) continue;
          freeKeys.add(key);
          next.freeDays.push({ id: uid(), name, dateISO: d });
        } else {
          const d = r.startISO;
          if (!d) continue;
          const key = `${name}|${d}|${r.startTime||''}|${r.endTime||''}`;
          if (evKeys.has(key)) continue;
          evKeys.add(key);
          next.events.push({ id: uid(), name, dateISO: d, startTime: r.startTime||'', endTime: r.endTime||'', notes: r.description||'' });
        }
      }
      return next;
    });

    setImportRows(null);
  };

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Schulkalender</div>
          <div className="muted small">{readOnly
            ? 'Archiviertes Schuljahr – Ferien, schulfreie Tage und Termine werden nur angezeigt.'
            : 'Schuljahr, Ferien, schulfreie Tage und Termine – inklusive ICS-Import.'}</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            style={{display:'none'}}
            onChange={(e)=>onIcsSelected(e.target.files?.[0])}
          />
          {!readOnly ? (
            <>
              <button className="btn" onClick={onPickIcs}>ICS importieren…</button>
              <button className="btn" onClick={()=>onStartNewSchoolYear?.()}>Neues Schuljahr…</button>
            </>
          ) : null}
          {/* Aus der Zählung wird eine Tür: das Archiv ist von hier aus
              zu öffnen, nicht nur zu zählen. */}
          <button
            className="btn"
            onClick={()=>onOpenArchives?.()}
            disabled={!archivesCount}
            title={archivesCount
              ? 'Archivierte Schuljahre ansehen'
              : 'Noch kein Schuljahr archiviert'}
          ><Archive {...ICON_SM} /> Archivierte Schuljahre ({archivesCount})</button>
        </div>
      </div>

      {/* Der Kalender des Archivs wird gelesen, nicht gepflegt. */}
      <fieldset className="archivFieldset" disabled={readOnly}>

      <div style={{height:12}} />

      <div className="calendarSection">
        <div style={{fontWeight:800}}>Schuljahr</div>
        <div className="muted small">Damit die Datumsauswahl und Ansichten auf das Schuljahr begrenzt werden können.</div>
        <div style={{height:10}} />
        <div className="row wrap">
          <div style={{width:220}}>
            <label className="small muted">Start</label>
            <input className="input" type="date" value={schoolYear.startISO || ''} onChange={(e)=>setSchoolYear({ startISO: e.target.value })} />
          </div>
          <div style={{width:220}}>
            <label className="small muted">Ende</label>
            <input className="input" type="date" value={schoolYear.endISO || ''} onChange={(e)=>setSchoolYear({ endISO: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="calendarSection">
        <div style={{fontWeight:800}}>Unterrichtszeiten (optional)</div>
        <div className="muted small">
          Wenn du hier die Startzeiten der Unterrichtsstunden einträgst, zeigt die Einzelstundenplanung bei jeder Phase Beginn (Uhrzeit) und Dauer an – und exportiert die Verlaufsplanung mit Uhrzeiten.
        </div>
        <div style={{height:10}} />

        <label className="row" style={{gap:8, alignItems:'center'}}>
          <input
            type="checkbox"
            checked={!!cal.lessonTimesEnabled}
            onChange={(e)=>onUpdate(prev=>({ ...prev, lessonTimesEnabled: !!e.target.checked }))}
          />
          <span>Uhrzeiten verwenden</span>
        </label>

        <div style={{height:10}} />

        <div className="calendarList">
          {Array.from({length: 12}).map((_, idx)=>{
            const arr = Array.isArray(cal.lessonTimes) ? cal.lessonTimes : [];
            const v = (arr[idx]?.start || arr[idx]?.startTime || '') || '';
            return (
              <div key={idx} className="calendarRow" style={{gridTemplateColumns:'120px 220px 120px'}}>
                <div style={{fontWeight:700, padding:'10px 0'}}>{idx+1}. Stunde</div>
                <input
                  className="input"
                  type="time"
                  value={v}
                  onChange={(e)=>{
                    const val = e.target.value;
                    onUpdate(prev=>{
                      const next = { ...prev };
                      next.lessonTimesEnabled = true;
                      const copy = Array.isArray(next.lessonTimes) ? [...next.lessonTimes] : [];
                      while (copy.length < 12) copy.push({ start: '' });
                      copy[idx] = { ...(copy[idx] || {}), start: val };
                      next.lessonTimes = copy;
                      return next;
                    });
                  }}
                  placeholder="HH:MM"
                />
                <button
                  className="btn"
                  onClick={()=>{
                    onUpdate(prev=>{
                      const next = { ...prev };
                      const copy = Array.isArray(next.lessonTimes) ? [...next.lessonTimes] : [];
                      if (copy[idx]) copy[idx] = { ...(copy[idx] || {}), start: '' };
                      next.lessonTimes = copy;
                      return next;
                    });
                  }}
                  title="Zeit löschen"
                >Leeren</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{height:12}} />

      <div className="calendarSection">
        <div className="row wrap" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:800}}>Ferien / Zeiträume</div>
            <div className="muted small">Werden in Woche/Makro-Plan als Ferien markiert.</div>
          </div>
        </div>
        <div style={{height:10}} />
        <div className="row wrap" style={{gap:10}}>
          <input className="input" style={{flex:1}} value={newVac.name} onChange={(e)=>setNewVac(p=>({...p, name: e.target.value}))} placeholder="z. B. Herbstferien" />
          <input className="input" style={{width:180}} type="date" value={newVac.startISO} onChange={(e)=>setNewVac(p=>({...p, startISO: e.target.value}))} />
          <input className="input" style={{width:180}} type="date" value={newVac.endISO} onChange={(e)=>setNewVac(p=>({...p, endISO: e.target.value}))} />
          <button className="btn primary" onClick={addVacation}>Hinzufügen</button>
        </div>
        <div style={{height:10}} />
        <div className="calendarList">
          {vacations.length === 0 ? (
            <EmptyState
              text="Hier stehen die Ferienzeiten deines Bundeslandes. Eingetragene Ferien werden im Wochenraster und im Makro-Plan gekennzeichnet."
            />
          ) : vacations.map(v => (
            <div key={v.id} className="calendarRow">
              <input className="input" value={v.name || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, vacations: (prev.vacations||[]).map(x=>x.id===v.id?{...x, name:e.target.value}:x) }))} />
              <input className="input" type="date" value={v.startISO || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, vacations: (prev.vacations||[]).map(x=>x.id===v.id?{...x, startISO:e.target.value}:x) }))} />
              <input className="input" type="date" value={v.endISO || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, vacations: (prev.vacations||[]).map(x=>x.id===v.id?{...x, endISO:e.target.value}:x) }))} />
              <button className="btn danger" onClick={()=>onUpdate(prev=>({ ...prev, vacations: (prev.vacations||[]).filter(x=>x.id!==v.id) }))}>Löschen</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:12}} />

      <div className="calendarSection">
        <div style={{fontWeight:800}}>Schulfreie Tage</div>
        <div className="muted small">Einzeltage (Brückentag, pädagogischer Tag, beweglicher Ferientag ...).</div>
        <div style={{height:10}} />
        <div className="row wrap" style={{gap:10}}>
          <input className="input" style={{flex:1}} value={newFree.name} onChange={(e)=>setNewFree(p=>({...p, name:e.target.value}))} placeholder="z. B. Pädagogischer Tag" />
          <input className="input" style={{width:200}} type="date" value={newFree.dateISO} onChange={(e)=>setNewFree(p=>({...p, dateISO:e.target.value}))} />
          <button className="btn primary" onClick={addFreeDay}>Hinzufügen</button>
        </div>
        <div style={{height:10}} />
        <div className="calendarList">
          {freeDays.length === 0 ? (
            <EmptyState
              text="Einzelne unterrichtsfreie Tage – bewegliche Ferientage, Feiertage, pädagogische Tage."
            />
          ) : freeDays.map(f => (
            <div key={f.id} className="calendarRow2">
              <input className="input" value={f.name || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, freeDays: (prev.freeDays||[]).map(x=>x.id===f.id?{...x, name:e.target.value}:x) }))} />
              <input className="input" type="date" value={f.dateISO || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, freeDays: (prev.freeDays||[]).map(x=>x.id===f.id?{...x, dateISO:e.target.value}:x) }))} />
              <button className="btn danger" onClick={()=>onUpdate(prev=>({ ...prev, freeDays: (prev.freeDays||[]).filter(x=>x.id!==f.id) }))}>Löschen</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:12}} />

      <div className="calendarSection">
        <div style={{fontWeight:800}}>Wichtige Termine</div>
        <div className="muted small">Konferenzen, Elternabende, Prüfungen, Notenschluss etc.</div>
        <div style={{height:10}} />
        <div className="row wrap" style={{gap:10}}>
          <input className="input" style={{flex:1}} value={newEv.name} onChange={(e)=>setNewEv(p=>({...p, name:e.target.value}))} placeholder="z. B. Elternabend" />
          <input className="input" style={{width:200}} type="date" value={newEv.dateISO} onChange={(e)=>setNewEv(p=>({...p, dateISO:e.target.value}))} />
          <input className="input" style={{width:130}} value={newEv.startTime} onChange={(e)=>setNewEv(p=>({...p, startTime:e.target.value}))} placeholder="Start (HH:MM)" />
          <input className="input" style={{width:130}} value={newEv.endTime} onChange={(e)=>setNewEv(p=>({...p, endTime:e.target.value}))} placeholder="Ende (HH:MM)" />
          <button className="btn primary" onClick={addEvent}>Hinzufügen</button>
        </div>
        <div style={{height:10}} />
        <div className="calendarList">
          {events.length === 0 ? (
            <EmptyState
              text="Termine wie Elternabende, Konferenzen oder Klassenfahrten. Sie erscheinen als Hinweis im Wochenraster."
            />
          ) : events.map(ev => (
            <div key={ev.id} className="calendarRow3">
              <input className="input" value={ev.name || ev.summary || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, events: (prev.events||[]).map(x=>x.id===ev.id?{...x, name:e.target.value}:x) }))} />
              <input className="input" type="date" value={ev.dateISO || ev.startISO || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, events: (prev.events||[]).map(x=>x.id===ev.id?{...x, dateISO:e.target.value}:x) }))} />
              <input className="input" value={ev.startTime || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, events: (prev.events||[]).map(x=>x.id===ev.id?{...x, startTime:e.target.value}:x) }))} placeholder="HH:MM" />
              <input className="input" value={ev.endTime || ''} onChange={(e)=>onUpdate(prev=>({ ...prev, events: (prev.events||[]).map(x=>x.id===ev.id?{...x, endTime:e.target.value}:x) }))} placeholder="HH:MM" />
              <button className="btn danger" onClick={()=>onUpdate(prev=>({ ...prev, events: (prev.events||[]).filter(x=>x.id!==ev.id) }))}>Löschen</button>
            </div>
          ))}
        </div>
      </div>

      {importRows && (
        <IcsImportModal
          rows={importRows}
          onClose={()=>setImportRows(null)}
          onCommit={(rows)=>commitImport(rows)}
          onChange={setImportRows}
        />
      )}
      </fieldset>
    </div>
  );
}

function IcsImportModal({ rows, onClose, onCommit, onChange }){
  const selectedCount = (rows || []).filter(r=>r.import).length;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:900}}>ICS-Import</div>
            <div className="muted small">Wähle aus, was importiert werden soll und ob es Ferien, schulfrei oder Termin ist.</div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        <div className="row wrap" style={{gap:8}}>
          <button className="btn" onClick={()=>onChange((rows||[]).map(r=>({ ...r, import: true })))}>Alle auswählen</button>
          <button className="btn" onClick={()=>onChange(rows.map(r=>({ ...r, import: false })))}>Alle abwählen</button>
          <span className="badge">Ausgewählt: {selectedCount} / {rows.length}</span>
        </div>

        <div style={{height:12}} />

        <div className="icsList">
          {rows.map((r, idx)=>{
            const range = (r.startISO && r.endISO && r.endISO !== r.startISO)
              ? `${formatDateDE(r.startISO)} – ${formatDateDE(r.endISO)}`
              : formatDateDE(r.startISO);
            return (
              <div key={r.id} className="icsRow">
                <input type="checkbox" checked={Boolean(r.import)} onChange={(e)=>{
                  const v = e.target.checked;
                  const next = [...rows];
                  next[idx] = { ...next[idx], import: v };
                  onChange(next);
                }} />
                <div className="icsMain">
                  <div style={{fontWeight:800}}>{r.summary}</div>
                  <div className="muted small">{range}{r.startTime ? ` · ${r.startTime}${r.endTime ? `–${r.endTime}` : ''}` : ''}</div>
                </div>
                <select className="input" style={{width:160}} value={r.type} onChange={(e)=>{
                  const v = e.target.value;
                  const next = [...rows];
                  next[idx] = { ...next[idx], type: v };
                  onChange(next);
                }}>
                  <option value="vacation">Ferien (Zeitraum)</option>
                  <option value="freeDay">Schulfrei (Tag)</option>
                  <option value="event">Termin</option>
                </select>
              </div>
            );
          })}
        </div>

        <div style={{height:12}} />
        <div className="row" style={{justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={()=>onCommit(rows)} disabled={selectedCount===0}>Importieren</button>
        </div>
      </div>
    </div>
  );
}

function LessonView({
  weekStart,
  dayIndex,
  slotIndex,
  lesson,
  exists,
  sequences,
  getSeqProgress,
  appSettings,
  onUpdateAppSettings,
  schoolCalendar,
  competencySuggestions,
  languageMode,
  competencyModel,
  benutzteKompetenzen,
  speechActSuggestions,
  scaffoldSuggestions,
  onRememberSpeechAct,
  onHideSpeechActSuggestion,
  onRememberScaffoldLabel,
  onHideScaffoldSuggestion,
  offenePunkte = [],
  onResolveCarryOver,
  onOpenReview,
  suggestions,
  phaseNameSuggestions,
  onCreateSequence,
  onRequestCreateSequence,
  onRememberCompetency,
  onHideCompetencySuggestion,
  onUpdateLesson,
  onDeleteLesson,
  onRememberSocialForm,
  onRememberPhaseName,
  onHideSocialFormSuggestion,
  onHidePhaseNameSuggestion,
  onExportPdf,
  onExportDocx,
  onOpenExecution,
  onJoinBlock,
  onSplitBlock,
  onOpenVerlauf,
  onVerschiebeSequenz,
  kannVerbinden = false,
  readOnly = false,
  classGroupSuggestions,
  subjectSuggestions,
  onRememberClassGroup,
  onRememberSubject,
  onHideClassGroupSuggestion,
  onHideSubjectSuggestion,
  groupColors,
  onOpenGroupColorPalette,
  onDraftTopicChange,
  onDraftFortschritt,
  yearBars,
  onOpenYearPlan,
}){
  const ui = useUi();
  const normalizeForLocal = (l) => ({
    ...l,
    sequenceId: l.sequenceId || '',
    primaryCompetency: l.primaryCompetency || '',
    competencies: Array.isArray(l.competencies) ? l.competencies : [],
    files: Array.isArray(l.files) ? l.files : [],
    links: Array.isArray(l.links) ? l.links : [],
    blockSpan: normalisiereBlockSpan(l.blockSpan),
    phases: normalizePhases(l.phases || [], TOTAL_MIN * normalisiereBlockSpan(l.blockSpan)),
    // Damit die Bausteine nie auf undefined treffen.
    successCriteria: normalisiereErfolgskriterien(l.successCriteria),
    communicativeTask: normalisiereAufgabe(l.communicativeTask),
    speechActs: normalisiereSprechabsichten(l.speechActs),
    languageResources: normalisiereMittel(l.languageResources),
    progressionNote: String(l.progressionNote || ''),
    planningProfile: normalisiereProfilId(l.planningProfile),
    customPlanningFields: normalisiereFeldListe(l.customPlanningFields),
    preferredExportLayout: l.preferredExportLayout ? normalisiereLayoutId(l.preferredExportLayout) : '',
  });

  // Stable serialization for change detection (no IDs, no timestamps).
  const serializeForCompare = (l) => {
    const n = normalizeLesson(l);
    const simple = {
      subject: (n.subject || ''),
      classGroup: (n.classGroup || ''),
      room: (n.room || ''),
      topic: (n.topic || ''),
      objectives: (n.objectives || ''),
      homework: (n.homework || ''),
      notes: (n.notes || ''),
      links: Array.isArray(n.links) ? n.links.map(x => ({
        title: String(x?.title || ''),
        url: String(x?.url || '')
      })) : [],
      files: Array.isArray(n.files) ? n.files.map(x => ({
        name: String(x?.name || ''),
        path: String(x?.path || ''),
        sourcePath: String(x?.sourcePath || ''),
        mode: String(x?.mode || '')
      })) : [],
      sequenceId: (n.sequenceId || ''),
      primaryCompetency: (n.primaryCompetency || ''),
      competencies: Array.isArray(n.competencies) ? n.competencies : [],
      blockSpan: blockSpanOf(n),
      phases: normalizePhases(n.phases || [], lessonTotalMin(n)).map(p => ({
        title: p.title || '',
        duration: Number(p.duration || 0),
        socialForm: p.socialForm || '',
        content: p.content || '',
        materialsMedia: p.materialsMedia || '',
        remarks: p.remarks || '',
        // Ohne die Hilfen hier bliebe eine geänderte Hilfe ungespeichert.
        scaffolds: normalisiereScaffolds(p.scaffolds),
        // Und ohne die zusätzlichen Planungsfelder bliebe jede Eingabe
        // darin ungespeichert – der Vergleich sähe sie schlicht nicht.
        ...Object.fromEntries(NEUE_PHASENFELDER.map(k => [k, String(p[k] || '')])),
      })),
      /* Diese Aufzählung entscheidet, OB überhaupt gespeichert wird:
         was hier fehlt, sieht der Vergleich nicht, und die Änderung
         gilt als "nichts passiert". Neue Felder gehören deshalb hierher
         – sonst verschwände die Eingabe beim Verlassen der Ansicht. */
      successCriteria: normalisiereErfolgskriterien(n.successCriteria),
      communicativeTask: normalisiereAufgabe(n.communicativeTask),
      speechActs: normalisiereSprechabsichten(n.speechActs),
      languageResources: normalisiereMittel(n.languageResources),
      progressionNote: String(n.progressionNote || ''),
      planningProfile: normalisiereProfilId(n.planningProfile),
      customPlanningFields: normalisiereFeldListe(n.customPlanningFields),
      preferredExportLayout: String(n.preferredExportLayout || ''),
    };
    return JSON.stringify(simple);
  };

  const [local, setLocal] = useState(() => normalizeForLocal(lesson));
  // Keep a ref to the latest local state so we can flush pending changes on unmount
  // (important when users go back to the timetable quickly).
  const localRef = useRef(local);
  useEffect(()=>{ localRef.current = local; }, [local]);

  /* Auch der Speicher-Rückruf muss frisch bleiben.

     Der Abschluss beim Verlassen der Ansicht unten hängt an [] und hielt
     deshalb den Rückruf des ERSTEN Rendervorgangs fest. Der schliesst
     über den Datenbankstand von damals. Alles, was währenddessen sonst
     gespeichert wurde – eine gemerkte Kompetenz, eine Sozialform, eine
     Lerngruppenfarbe –, wurde beim Verlassen wieder überschrieben, wenn
     man schneller wegklickte als die 600 ms des verzögerten Speicherns.
     Mit dem Ref schreibt der Abschluss auf den aktuellen Stand. */
  const onUpdateLessonRef = useRef(onUpdateLesson);
  useEffect(()=>{ onUpdateLessonRef.current = onUpdateLesson; });

  // Prevent saving a "brand-new" empty lesson just because the user opened it.
  const initialSnapshotRef = useRef(serializeForCompare(lesson));
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef(null);

  /* Auch das Verbinden und Trennen setzt den Entwurf neu auf.

     Ort und Platz der Stunde bleiben dabei gleich; was sich ändert, ist
     ihre Länge. Ohne diese Abhängigkeit schriebe das verzögerte
     Speichern anschliessend den Stand von VOR dem Verbinden zurück –
     die zweite Stunde wäre wieder verloren. */
  const lessonBlockSpan = blockSpanOf(lesson);

  // Only re-initialize the editor when the user navigates to a *different* lesson.
  // Do NOT depend on the `lesson` object reference, otherwise every autosave would
  // re-hydrate local state and can steal focus while typing.
  useEffect(()=>{
    const next = normalizeForLocal(lesson);
    setLocal(next);
    initialSnapshotRef.current = serializeForCompare(next);
    skipNextSaveRef.current = true;
    if (onDraftTopicChange) onDraftTopicChange(next.topic || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, dayIndex, slotIndex, lessonBlockSpan]);

  useEffect(()=>{
    if (onDraftTopicChange) onDraftTopicChange(local.topic || '');
  }, [local.topic, onDraftTopicChange]);

  /* Was die Einführung wissen muss, während getippt wird: welcher
     Schritt schon erledigt ist. Bewusst nur diese vier Ja/Nein-Werte –
     der Entwurf selbst bleibt hier. Ohne Einführung wird die Funktion
     nicht übergeben, dann kostet das hier nichts. */
  useEffect(()=>{
    if (typeof onDraftFortschritt !== 'function') return;
    const t = (v)=> String(v ?? '').trim().length > 0;
    onDraftFortschritt({
      lerngruppe: t(local.classGroup) && t(local.subject),
      thema: t(local.topic),
      lernziel: t(local.objectives),
      phase: (Array.isArray(local.phases) ? local.phases : [])
        .some(p => t(p?.socialForm) || t(p?.content) || t(p?.materialsMedia) || t(p?.remarks)),
    });
  }, [local, onDraftFortschritt]);

  useEffect(()=>{
    // Ignore the very first effect run after (re)initialization.
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    /* Eine archivierte Stunde wird nicht gespeichert. Ohne diese Zeile
       liefe bei jeder Regung des Entwurfs – etwa der Layoutwahl im
       Exportdialog – ein Speicherversuch los, der abgewiesen würde. */
    if (readOnly) return;
    const curr = serializeForCompare(local);
    if (curr === initialSnapshotRef.current) return;

    // Debounced autosave so typing stays smooth.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(()=>{
      try {
        onUpdateLesson(local);
        initialSnapshotRef.current = curr;
      } catch {}
    }, 600);
    return ()=>{
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  // Flush any pending edits immediately when leaving the view (e.g., clicking "Zurück").
  // This prevents data loss if the user navigates away before the debounce fires.
  const readOnlyRef = useRef(readOnly);
  useEffect(()=>{ readOnlyRef.current = readOnly; }, [readOnly]);
  useEffect(()=>{
    return () => {
      try {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (readOnlyRef.current) return;
        const latest = localRef.current;
        const curr = serializeForCompare(latest);
        if (curr !== initialSnapshotRef.current) {
          onUpdateLessonRef.current?.(latest);
          initialSnapshotRef.current = curr;
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateISO = useMemo(()=>{
    const start = fromISODate(weekStart);
    return toISODate(addDays(start, dayIndex));
  }, [weekStart, dayIndex]);

  /* Der Zeitrahmen dieser Stunde: 45 Minuten je belegtem Stundenplatz,
     durchgehend. Eine Doppelstunde wird NICHT nach 45 Minuten geteilt. */
  const blockSpan = blockSpanOf(local);
  const gesamtMin = TOTAL_MIN * blockSpan;
  const istBlock = blockSpan > 1;

  const lessonTitle = `${DAYS[dayIndex]} · ${formatDateDE(dateISO)} · ${stundenBereichLabel(slotIndex, blockSpan)}`;

  const dayInfo = useMemo(()=>getDayInfo(dateISO, schoolCalendar), [dateISO, schoolCalendar]);

  const matchingYearBars = useMemo(()=>{
    const arr = Array.isArray(yearBars) ? yearBars : [];
    const g = String(local.classGroup || '').trim();
    const s = String(local.subject || '').trim();
    return arr
      .filter(b => {
        if (!b?.startISO || !b?.endISO) return false;
        if (dateISO < b.startISO || dateISO > b.endISO) return false;
        const bg = String(b.classGroup || '').trim();
        const bs = String(b.subject || '').trim();
        // empty group/subject acts like a wildcard
        const groupOk = !bg || !g || bg === g;
        const subjOk = !bs || !s || bs === s;
        return groupOk && subjOk;
      })
      .sort((a,b)=> (a.startISO.localeCompare(b.startISO) || (a.title||'').localeCompare(b.title||'')));
  }, [yearBars, dateISO, local.classGroup, local.subject]);

  const lessonStartHHMM = useMemo(()=>getLessonStartTime(schoolCalendar, slotIndex), [schoolCalendar, slotIndex]);
  const phaseTimes = useMemo(()=>computePhaseTimes(local.phases, lessonStartHHMM), [local.phases, lessonStartHHMM]);

  /* Das Planungsprofil dieser Stunde. Es entscheidet ausschliesslich
     über Sichtbarkeit – gespeichert bleibt in jedem Fall alles. */
  const planungsprofil = normalisiereProfilId(local.planningProfile);
  const sichtbareFelder = useMemo(
    ()=> profilFelder(planungsprofil, local.customPlanningFields),
    [planungsprofil, local.customPlanningFields]
  );

  /* Was nicht schon offen in der Karte steht, sammelt sich unter
     "Weitere Angaben": die zusätzlichen Felder des Profils – und
     ausserdem jedes Feld, das ausserhalb des Profils liegt, aber
     bereits Text enthält. Ohne diesen zweiten Teil wäre ein Wechsel
     auf ein knapperes Profil zwar verlustfrei, aber blind. */
  const zusatzFelderFuer = useCallback((phase)=>{
    const ids = new Set(sichtbareFelder);
    for (const feld of PLANUNGSFELDER){
      if (feld.basis || feld.id === 'time' || feld.eingabe === 'scaffolds') continue;
      if (feldHatInhalt(phase, feld.id)) ids.add(feld.id);
    }
    const reihenfolge = planungsprofil === 'eigenes'
      ? [...sichtbareFelder, ...PLANUNGSFELDER.map(f => f.id)]
      : PLANUNGSFELDER.map(f => f.id);
    const gesehen = new Set();
    return reihenfolge.filter(id => {
      if (gesehen.has(id) || !ids.has(id)) return false;
      const feld = feldDefinition(id);
      if (!feld || feld.basis || feld.id === 'time' || feld.eingabe === 'scaffolds') return false;
      gesehen.add(id);
      return true;
    });
  }, [sichtbareFelder, planungsprofil]);

const gKey = useMemo(()=>groupKey(local.classGroup, local.subject), [local.classGroup, local.subject]);
const gColor = useMemo(()=>{
  if (!gKey) return '';
  const stored = groupColors?.[gKey]?.color;
  return (stored || defaultGroupColor(gKey));
}, [gKey, groupColors]);


  const setField = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };


  const fileCopyOptIn = Boolean(appSettings?.fileCopyOptIn);
  const toggleFileCopyOptIn = () => {
    if (typeof onUpdateAppSettings === 'function') onUpdateAppSettings({ fileCopyOptIn: !fileCopyOptIn });
  };

  const schoolYearLabel = useMemo(()=>{
    try {
      const sy = schoolCalendar?.schoolYear || {};
      const s = String(sy.startISO || '').trim();
      const e = String(sy.endISO || '').trim();
      if (!s && !e) return '';
      const syYear = s ? fromISODate(s).getFullYear() : null;
      const eyYear = e ? fromISODate(e).getFullYear() : null;
      if (syYear && eyYear) {
        if (syYear === eyYear) return `Schuljahr ${syYear}`;
        return `Schuljahr ${syYear}/${String(eyYear).slice(-2)}`;
      }
      if (syYear) return `Schuljahr ab ${syYear}`;
      if (eyYear) return `Schuljahr bis ${eyYear}`;
      return '';
    } catch { return ''; }
  }, [schoolCalendar]);

  const lessonFiles = Array.isArray(local.files) ? local.files : [];
  const lessonLinks = Array.isArray(local.links) ? local.links : [];
  const seqFiles = useMemo(()=>{
    const sid = String(local.sequenceId || '').trim();
    if (!sid) return [];
    const s = sequences?.[sid];
    return Array.isArray(s?.files) ? s.files : [];
  }, [local.sequenceId, sequences]);

  const normalizeUrl = (u) => {
    const raw = String(u || '').trim();
    if (!raw) return '';
    // allow mailto:, http:, https:
    if (/^(https?:\/\/|mailto:)/i.test(raw)) return raw;
    // common case: pasted without scheme
    return `https://${raw}`;
  };

  const addLink = () => {
    setField('links', [...lessonLinks, { id: uid(), title: '', url: '' }]);
  };
  const updateLink = (id, patch) => {
    setField('links', lessonLinks.map(l => (l?.id === id ? { ...l, ...(patch || {}) } : l)));
  };
  const removeLink = (id) => {
    setField('links', lessonLinks.filter(l => l?.id !== id));
  };
  const openLink = (url) => {
    const href = normalizeUrl(url);
    if (!href) return;
    try { window.open(href, '_blank'); } catch {}
  };

  const addLessonFiles = async () => {
    if (!capabilities.fileAttachments) {
      ui.toast('Dateien anhängen ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }
    const picked = await platform.pickFiles({ multi: true });
    if (!Array.isArray(picked) || picked.length === 0) return;

    let copiedMap = null; // Map<sourcePath, destPath>
    let mode = 'link';
    if (fileCopyOptIn && typeof platform.copyToLibrary === 'function') {
      try {
        const seqName = (sequences?.[String(local.sequenceId || '').trim()]?.name || '').trim();
        const res = await platform.copyToLibrary({
          paths: picked,
          meta: {
            schoolYearLabel,
            classGroup: String(local.classGroup || '').trim(),
            subject: String(local.subject || '').trim(),
            sequenceName: seqName,
            contextLabel: `${dateISO} · ${slotIndex+1}. Stunde`
          }
        });
        if (res?.files?.length) {
          copiedMap = new Map(res.files.map(r => [String(r.source||''), String(r.dest||'')]));
          mode = 'copy';
        }
        if (res?.errors?.length) {
          ui.toast(`${res.errors.length} Datei(en) konnten nicht kopiert werden.`, { tone: 'danger' });
        }
      } catch {}
    }

    const next = [...lessonFiles];
    for (const p of picked) {
      const srcPath = String(p || '').trim();
      if (!srcPath) continue;
      const destPath = copiedMap ? (String(copiedMap.get(srcPath) || srcPath).trim()) : srcPath;
      if (!destPath) continue;
      const isDup = next.some(f => {
        const fp = String(f?.path || '').trim();
        const sp = String(f?.sourcePath || '').trim();
        return fp === destPath || (sp && sp === srcPath);
      });
      if (isDup) continue;
      next.push({
        id: uid(),
        name: fileNameFromPath(destPath),
        path: destPath,
        sourcePath: (mode === 'copy') ? srcPath : '',
        mode,
        addedAt: new Date().toISOString()
      });
    }

    setField('files', next);
  };

  const removeLessonFile = (fileId) => {
    const next = lessonFiles.filter(f => f?.id !== fileId);
    setField('files', next);
  };

  const openFile = async (pathStr) => {
    if (!capabilities.openExternally) return;
    const res = await platform.openPath(pathStr);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Datei nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  const revealFile = async (pathStr) => {
    if (!capabilities.revealInFolder) return;
    const res = await platform.revealPath(pathStr);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Ordner nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  const openLibraryRoot = async () => {
    if (!capabilities.fileLibrary) return;
    const root = await platform.getLibraryRoot();
    if (!root) return;
    const res = await platform.openPath(root);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Ablage nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  /* Der Check rechnet aus `local`, also aus dem gerade bearbeiteten
     Entwurf. Aus `lesson` gerechnet fehlte alles, was das verzögerte
     Speichern noch nicht geschrieben hat.

     Gerechnet wird erst beim Öffnen: useMemo hängt an checkOffen, damit
     nicht jeder Tastendruck die Analyse auslöst. */
  const [checkOffen, setCheckOffen] = useState(false);
  const checkSeed = `${weekStart}-${dayIndex}-${slotIndex}`;
  const checkErgebnis = useMemo(
    ()=> (checkOffen ? erstelleDidaktikCheck(local, { seed: checkSeed }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkOffen, local, checkSeed]
  );

  /* Zu einer bestimmten Phase scrollen – aus dem Exportdialog heraus,
     wenn dort eine Angabe fehlt. Es wird nichts verändert, nur gezeigt,
     wo die Lücke ist. */
  const springeZuPhase = (index)=>{
    const ph = local.phases?.[index];
    if (!ph) return;
    setTimeout(()=>{
      const el = document.getElementById(`phase-${ph.id}`);
      if (!el) return;
      try { el.scrollIntoView({ behavior:'smooth', block:'center' }); } catch { el.scrollIntoView(); }
      // Die fehlende Angabe steht oft unter "Weitere Angaben".
      el.querySelector('details.phaseZusatz')?.setAttribute('open', 'open');
    }, 60);
  };

  /* Sanft zum betroffenen Ort scrollen. Es werden keine Daten verändert –
     der Check schlägt vor, er greift nicht ein. */
  const springeZu = (impuls)=>{
    setCheckOffen(false);
    const ziel = impuls?.phaseId
      ? `phase-${impuls.phaseId}`
      : (impuls?.target === 'criteria' ? 'lesson-kriterien' : 'lesson-didaktik');
    setTimeout(()=>{
      const el = document.getElementById(ziel);
      if (!el) return;
      try { el.scrollIntoView({ behavior:'smooth', block:'center' }); } catch { el.scrollIntoView(); }
      // Der fachdidaktische Block ist zugeklappt, wenn nichts darin steht.
      if (ziel === 'lesson-didaktik') setFachdidaktikOffen(true);
    }, 60);
  };

  /* Der fachdidaktische Block startet aufgeklappt, wenn schon etwas
     darin steht – sonst wären ausgefüllte Angaben versteckt. Sonst
     bleibt die Stundenplanung so kurz wie zuvor. */
  const [fachdidaktikOffen, setFachdidaktikOffen] = useState(()=> hatFachdidaktik(lesson));

  /* Eine Zeile, die im zugeklappten Zustand sagt, was drinsteht. */
  const fachdidaktikZusammenfassung = useMemo(()=>{
    const teile = [];
    if (!istLeereAufgabe(local.communicativeTask)) teile.push('Aufgabe');
    const sa = normalisiereSprechabsichten(local.speechActs).length;
    if (sa) teile.push(`${sa} ${sa === 1 ? 'Sprechabsicht' : 'Sprechabsichten'}`);
    if (!istLeereMittel(local.languageResources)) teile.push('sprachliche Mittel');
    const sc = scaffoldsDerStunde(local).length;
    if (sc) teile.push(`${sc} ${sc === 1 ? 'Hilfe' : 'Hilfen'}`);
    return teile.length ? teile.join(' · ') : 'noch nichts eingetragen';
  }, [local.communicativeTask, local.speechActs, local.languageResources, local.phases]);

  /* Ein offener Punkt wird zu einer ganz normalen Phase am Ende der
     Stunde. Danach lässt sie sich wie jede andere ziehen, ändern und
     löschen – es gibt keinen Sondertyp "übernommene Phase".

     Die Ursprungsstunde bleibt unverändert: kopiert, nicht verschoben.
     Nur der Punkt selbst wird dort als übernommen vermerkt, damit er
     nicht bei jeder weiteren Stunde erneut angeboten wird. */
  const uebernehmeAlsPhasen = (liste)=>{
    const punkte = (Array.isArray(liste) ? liste : []).filter(Boolean);
    if (!punkte.length) return;
    const neue = punkte.map(p => phaseAusCarryOver(p, uid));
    setPhases([...(local.phases || []), ...neue]);
    for (const p of punkte) onResolveCarryOver?.(p, 'transferred');
    ui.toast(punkte.length === 1
      ? 'Als Phase übernommen.'
      : `${punkte.length} Phasen übernommen.`);
  };

  const uebernehmeAlsNotiz = (p)=>{
    if (!p) return;
    const bisher = String(local.notes || '').trim();
    const zeile = String(p.title || '').trim();
    if (!zeile) return;
    setField('notes', bisher ? `${bisher}\n${zeile}` : zeile);
    onResolveCarryOver?.(p, 'transferred');
    ui.toast('Als Notiz übernommen.');
  };

  const setPhases = (nextPhases) => {
    setLocal(prev => ({ ...prev, phases: normalizePhases(nextPhases, lessonTotalMin(prev)) }));
  };

  const addPhase = () => {
    setPhases((() => {
      const phases = deepClone(local.phases);
      const newPhase = neuePhase('Neue Phase', 5);
      // Erste Phase einer Stunde ohne Phasen: sie bekommt die ganze Zeit.
      // Ohne diesen Fall griff die Suche unten auf phases[0] zu.
      if (!phases.length) {
        newPhase.duration = gesamtMin;
        return [newPhase];
      }
      // reduce from the longest phase that can spare minutes
      let idxLongest = 0;
      for (let i=0;i<phases.length;i++){
        if (phases[i].duration > phases[idxLongest].duration) idxLongest = i;
      }
      const spare = phases[idxLongest].duration - MIN_PHASE_MIN;
      const take = Math.min(spare, newPhase.duration);
      phases[idxLongest].duration -= take;
      newPhase.duration = take || MIN_PHASE_MIN;
      phases.push(newPhase);
      return phases;
    })());
  };

  const removePhase = (index) => {
    setPhases((() => {
      const phases = deepClone(local.phases);
      if (phases.length <= 1) return phases;
      const removed = phases.splice(index, 1)[0];
      if (index-1 >= 0) phases[index-1].duration += removed.duration;
      else phases[0].duration += removed.duration;
      return phases;
    })());
  };

  /* Der Export läuft ab jetzt über einen kleinen Zwischenschritt: Layout
     wählen, Vollständigkeit sehen, Vorschau prüfen. Er hält niemanden
     auf – die Schaltfläche im Dialog exportiert in jedem Zustand. */
  const [exportZiel, setExportZiel] = useState(null);
  const exportLayout = normalisiereLayoutId(local.preferredExportLayout || STANDARD_LAYOUT);
  const eigenesExportLayout = normalisiereEigenesLayout(appSettings?.customExportLayout);

  const fuehreExportAus = () => {
    const ziel = exportZiel;
    setExportZiel(null);
    if (!ziel) return;
    const html = buildLessonPdfHtml({
      title: lessonTitle, dateISO, dayIndex, slotIndex, schoolCalendar, lesson: local,
      layout: exportLayout, eigenesLayout: eigenesExportLayout,
    });
    // Filename uses a safe format (dots can be awkward on some systems); keep ISO for filenames.
    const stundenTeil = istBlock ? `${slotIndex+1}-${slotIndex+blockSpan}.Stunde` : `${slotIndex+1}.Stunde`;
    if (ziel === 'docx') onExportDocx?.(html, `Unterricht_${dateISO}_${stundenTeil}.doc`);
    else onExportPdf?.(html, `Unterricht_${dateISO}_${stundenTeil}.pdf`);
  };

  const exportPdf = () => setExportZiel('pdf');

const exportDocx = () => {
  if (typeof onExportDocx !== 'function') {
    ui.toast('Word-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
    return;
  }
  setExportZiel('docx');
};

  const startExecution = () => {
    if (typeof onOpenExecution !== 'function') {
      ui.toast('Durchführungsansicht ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }

    const metaBits = [];
    const cg = (local.classGroup || '').trim();
    const sj = (local.subject || '').trim();
    if (cg) metaBits.push(cg);
    if (sj) metaBits.push(sj);
    const meta = metaBits.join(' · ');

    const snap = {
      kind: 'prepybara-execution-v1',
      lessonId: `${weekStart}-${dayIndex}-${slotIndex}`,
      lessonTitle,
      meta,
      createdAt: new Date().toISOString(),
      homework: String(local.homework || ''),
      phases: (local.phases || []).map((ph, i)=>( {
        id: ph.id,
        title: String(ph.title || ''),
        duration: Number(ph.duration) || 0,
        start: phaseTimes?.[i]?.start || '',
        end: phaseTimes?.[i]?.end || '',
        socialForm: String(ph.socialForm || ''),
        content: String(ph.content || ''),
        materialsMedia: String(ph.materialsMedia || ''),
        remarks: String(ph.remarks || '')
      } ))
    };

    onOpenExecution(snap);
  };

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>{istBlock ? blockName(blockSpan) : 'Einzelstunde'}</div>
          <div className="muted small">
            {lessonTitle}{istBlock ? ` · ${gesamtMin} Minuten am Stück` : ''}
            {readOnly ? ' · archiviert, nur zum Ansehen' : ''}
          </div>
          {(dayInfo.vac || dayInfo.fd || (dayInfo.evs && dayInfo.evs.length)) ? (
            <div className="row wrap" style={{gap:6, marginTop:6}}>
              {dayInfo.vac ? <span className="badge badge--vacation" title={`Ferien: ${dayInfo.vac.name || ''}`}><Palmtree {...ICON_SM} /> Ferien: {dayInfo.vac.name || ''}</span> : null}
              {dayInfo.fd ? <span className="badge badge--dayoff" title={`Schulfrei: ${dayInfo.fd.name || ''}`}><Ban {...ICON_SM} /> Schulfrei: {dayInfo.fd.name || ''}</span> : null}
              {(dayInfo.evs || []).slice(0,2).map(ev => (
                <span key={ev.id} className="badge"><CalendarDays {...ICON_SM} /> {ev.name || ev.summary || 'Termin'}</span>
              ))}
              {(dayInfo.evs && dayInfo.evs.length > 2) ? <span className="badge">+{dayInfo.evs.length-2} Termine</span> : null}
            </div>
          ) : null}
        </div>
        <div className="row" style={{gap:8}}>
          {/* Der gerade offene Entwurf geht mit: was eben getippt wurde,
              ist noch nicht gespeichert. */}
          {readOnly ? null : istBlock ? (
            <button className="btn" onClick={()=>onSplitBlock?.(local)}
                    title={`${blockName(blockSpan)} wieder in Einzelstunden trennen`}>
              <Unlink {...ICON_SM} /> Doppelstunde trennen
            </button>
          ) : kannVerbinden ? (
            <button className="btn" onClick={()=>onJoinBlock?.(local)}
                    title="Mit der folgenden Stunde derselben Lerngruppe zu einer Doppelstunde verbinden">
              <Link2 {...ICON_SM} /> Als Doppelstunde verbinden
            </button>
          ) : null}
          {(!readOnly && typeof onVerschiebeSequenz === 'function' && String(local.sequenceId || '').trim()) ? (
            <button className="btn" onClick={()=>onVerschiebeSequenz(local.sequenceId)}
                    title="Diese und die folgenden Stunden der Sequenz auf andere Termine legen – mit Vorschau">
              <CalendarClock {...ICON_SM} /> Sequenz verschieben…
            </button>
          ) : null}
          {typeof onOpenVerlauf === 'function' ? (
            /* Ansehen und Zurückholen ändert nichts an der Stunde –
               deshalb steht der Verlauf auch im Archiv zur Verfügung.
               Das Wiederherstellen bleibt dort gesperrt. */
            <OeffnenKnopf onClick={()=>onOpenVerlauf()} title="Frühere Fassungen dieser Stunde ansehen">
              <FileClock {...ICON_SM} /> Versionsverlauf
            </OeffnenKnopf>
          ) : null}
          {!readOnly ? (
            <>
              <button className="btn" onClick={()=>onOpenReview?.()}
                      title="Nach der Stunde festhalten, was daraus geworden ist">
                <ClipboardCheck {...ICON_SM} /> Nachbereiten
              </button>
              {capabilities.executionWindow ? (
                <button className="btn success" onClick={startExecution}><Play {...ICON_SM} /> Durchführung</button>
              ) : null}
              <button className="btn danger" onClick={onDeleteLesson}>Stunde löschen</button>
            </>
          ) : null}
          {capabilities.docxExport ? (
            <button className="btn iconBtn-word" onClick={exportDocx} title="Als Word-Datei speichern"><FileText {...ICON_SM} /> Word speichern</button>
          ) : null}
          {capabilities.pdfExport ? (
            <button className="btn iconBtn-pdf" onClick={exportPdf} title="Als PDF speichern"><FileDown {...ICON_SM} /> PDF speichern</button>
          ) : null}
        </div>
      </div>

      <div style={{height:12}} />

      {/* Der Riegel der Archivansicht.

          Ein deaktiviertes <fieldset> nimmt allen Eingabefeldern und
          Schaltflächen darin nativ die Wirkung – zuverlässiger, als
          jede einzelne Stelle daran zu erinnern. Die Ausgabe (PDF,
          Word) liegt bewusst ausserhalb: sie ändert nichts. */}
      <fieldset className="archivFieldset" disabled={readOnly}>
      <div className="row wrap" data-onboarding-target="stunde-lerngruppe">
        <div className="grow">
          <label className="small muted">Fach</label>
          <SubjectInput
            value={local.subject}
            suggestions={subjectSuggestions || []}
            onChange={(v)=>setField('subject', v)}
            onCommit={(v)=>onRememberSubject && onRememberSubject(v)}
            onHideSuggestion={(v)=>onHideSubjectSuggestion?.(v)}
          />
        </div>
        <div className="grow">
          <label className="small muted">Klasse/Kurs</label>
          <ClassGroupInput
            value={local.classGroup}
            suggestions={classGroupSuggestions || []}
            onChange={(v)=>setField('classGroup', v)}
            onCommit={(v)=>onRememberClassGroup && onRememberClassGroup(v)}
            onHideSuggestion={(v)=>onHideClassGroupSuggestion?.(v)}
          />
        </div>
        <div style={{width:150}}>
          <label className="small muted">Raum</label>
          <input className="input" value={local.room} onChange={(e)=>setField('room', e.target.value)} placeholder="optional" />
        </div>
<div style={{width:120}}>
  <label className="small muted">Farbe</label>
  <button
    className="groupColorChip groupColorChip--field"
    style={gKey
      ? { background: surfaceColor(gColor) }
      : { background: 'repeating-linear-gradient(45deg, var(--bg-subtle), var(--bg-subtle) 6px, var(--card) 6px, var(--card) 12px)' }}
    onClick={(e)=>{
      e.stopPropagation();
      if (!gKey) { ui.toast('Bitte zuerst Fach + Klasse/Kurs setzen, um eine Lerngruppen-Farbe festzulegen.', { tone: 'warning' }); return; }
      onOpenGroupColorPalette?.(gKey, `${local.classGroup} · ${local.subject}`.trim());
    }}
    title={gKey ? 'Lerngruppen-Farbe ändern (gilt für das ganze Schuljahr)' : 'Bitte zuerst Fach + Klasse/Kurs setzen'}
    aria-label="Lerngruppenfarbe auswählen"
  />
</div>


      </div>

      </fieldset>

      <div style={{height:10}} />

      <DidaktikCheckDialog
        open={checkOffen}
        ergebnis={checkErgebnis}
        onClose={()=>setCheckOffen(false)}
        onSpringeZu={springeZu}
      />

      <ExportLayoutDialog
        offen={Boolean(exportZiel)}
        ziel={exportZiel}
        phasen={local.phases}
        layout={exportLayout}
        eigenesLayout={eigenesExportLayout}
        onChangeLayout={(id)=>setField('preferredExportLayout', normalisiereLayoutId(id))}
        onChangeEigenesLayout={(next)=>onUpdateAppSettings?.({ customExportLayout: normalisiereEigenesLayout(next) })}
        onExport={fuehreExportAus}
        onClose={()=>setExportZiel(null)}
        onSpringeZuPhase={(i)=>springeZuPhase(i)}
      />

      {/* Offene Punkte zu übernehmen hiesse, die Stunde zu ändern. */}
      {!readOnly ? (
      <CarryOverPanel
        punkte={offenePunkte}
        onUebernehmenAlsPhase={(liste)=>uebernehmeAlsPhasen(liste)}
        onUebernehmenAlsNotiz={(p)=>uebernehmeAlsNotiz(p)}
        onErledigt={(p)=>onResolveCarryOver?.(p, 'completed')}
        onIgnorieren={(p)=>onResolveCarryOver?.(p, 'dismissed')}
      />
      ) : null}

      <fieldset className="archivFieldset" disabled={readOnly}>
      <div className="row wrap" data-onboarding-target="stunde-thema">
        <div className="grow">
          <label className="small muted">Stundenthema</label>
          <input className="input" value={local.topic} onChange={(e)=>setField('topic', e.target.value)} placeholder="z. B. Bruchrechnung: Addition" />
        </div>
      </div>

      <div style={{height:10}} />


      <div style={{height:10}} />

      <div className="row wrap" data-onboarding-target="stunde-sequenz">
        <div className="grow">
          <label className="small muted">Unterrichtssequenz</label>
          <SequenceSelect
            sequences={sequences}
            value={local.sequenceId || ''}
            onChange={(seqId)=>setField('sequenceId', seqId)}
            onRequestCreateSequence={onRequestCreateSequence}
            onCreate={(name)=>{
              const id = onCreateSequence(name);
              if (id) setField('sequenceId', id);
              return id;
            }}
          />
          {(() => {
            // Folgt der im Entwurf gewählten Sequenz, nicht der gespeicherten –
            // sonst hinkte die Anzeige beim Umstellen hinterher.
            const p = local.sequenceId ? getSeqProgress?.(local.sequenceId) : null;
            return p ? <div style={{marginTop:8}}><SequenceProgress progress={p} /></div> : null;
          })()}
        </div>
        <div className="grow">
          <label className="small muted">Primäre Kompetenz</label>
          <CompetencyPrimaryInput
            value={local.primaryCompetency || ''}
            suggestions={competencySuggestions}
            onChange={(v)=>setField('primaryCompetency', v)}
            onCommit={(v)=>onRememberCompetency(v)}
            onHideSuggestion={(label)=>onHideCompetencySuggestion?.(label)}
          />
        </div>
      </div>

      {matchingYearBars.length ? (
        <div style={{marginTop:10}}>
          <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <div style={{fontWeight:800}}>Jahresgrobplanung (Orientierung)</div>
              <div className="muted small">Diese Balken wirken sich nicht auf Sequenzen aus und werden nicht exportiert.</div>
            </div>
            <OeffnenKnopf onClick={()=>onOpenYearPlan?.(dateISO)}>Im Jahresplan öffnen</OeffnenKnopf>
          </div>
          <div style={{height:8}} />
          <div className="yearHintList">
            {matchingYearBars.slice(0,6).map(b=> (
              <div key={b.id} className="yearHintItem">
                <span className="yearHintDot" style={{background: b.color ? lineColor(b.color) : 'var(--border-strong)'}} />
                <div className="yearHintText">
                  <div style={{fontWeight:700}}>{b.title || 'Ohne Titel'}</div>
                  <div className="muted small">{formatDateDE(b.startISO)} – {formatDateDE(b.endISO)}{(b.classGroup||b.subject) ? ` · ${[b.classGroup,b.subject].filter(Boolean).join(' · ')}` : ''}</div>
                </div>
              </div>
            ))}
            {matchingYearBars.length > 6 ? <div className="muted small">+{matchingYearBars.length-6} weitere…</div> : null}
          </div>
        </div>
      ) : null}

      <div style={{height:8}} />

      <CompetencyEditor
        competencies={Array.isArray(local.competencies) ? local.competencies : []}
        primary={local.primaryCompetency || ''}
        suggestions={competencySuggestions}
        languageMode={languageMode}
        modell={competencyModel}
        benutzte={benutzteKompetenzen}
        onChange={(nextComps, nextPrimary)=>{
          setLocal(prev => ({ ...prev, competencies: nextComps, primaryCompetency: nextPrimary }));
        }}
        onRemember={(v)=>onRememberCompetency(v)}
        onHideSuggestion={(label)=>onHideCompetencySuggestion?.(label)}
      />

      <div style={{height:10}} />

      <div data-onboarding-target="stunde-lernziele">
        <label className="small muted">Lernziele (Stichpunkte oder Sätze)</label>
        <textarea value={local.objectives} onChange={(e)=>setField('objectives', e.target.value)} placeholder="- Die Lernenden können ..." />
      </div>

      <div style={{height:8}} />

      {/* Fachunabhängig – deshalb auch ohne Fremdsprachenmodus da. */}
      <SuccessCriteriaEditor
        id="lesson-kriterien"
        kriterien={local.successCriteria}
        onChange={(next)=>setField('successCriteria', next)}
      />

      {/* Alles Weitere gehört zum Fremdsprachenmodus und bleibt sonst
          unsichtbar – gespeichert bleibt es trotzdem. */}
      {languageMode ? (
        <>
          <div style={{height:10}} />
          <details id="lesson-didaktik" className="didaktikBlock" open={fachdidaktikOffen}
                   onToggle={(e)=>setFachdidaktikOffen(e.currentTarget.open)}>
            <summary className="didaktikKopf">
              <span className="didaktikTitel">Fachdidaktische Planung</span>
              <span className="muted small">{fachdidaktikZusammenfassung}</span>
            </summary>
            <div className="didaktikInhalt">
              <CommunicativeTaskEditor
                wert={local.communicativeTask}
                onChange={(next)=>setField('communicativeTask', next)}
                titel="Kommunikative Aufgabe"
                platzhalter="z. B. Plant mit eurem Austauschpartner einen gemeinsamen Samstagnachmittag."
              />
              <SpeechActEditor
                ausgewaehlt={local.speechActs}
                vorrat={speechActSuggestions}
                onChange={(next)=>setField('speechActs', next)}
                onRemember={(v)=>onRememberSpeechAct?.(v)}
                onHideSuggestion={(v)=>onHideSpeechActSuggestion?.(v)}
                mittel={local.languageResources}
                onChangeMittel={(next)=>setField('languageResources', next)}
              />
            </div>
          </details>
        </>
      ) : null}

      <div style={{height:14}} />

      <div className="split">
        <PhaseTimeline phases={local.phases} onChange={setPhases} startTime={lessonStartHHMM} gesamt={gesamtMin} gesperrt={readOnly} />
        <div>
          <div className="row wrap" style={{justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:800}}>Phasen &amp; Inhalte</div>
              <div className="muted small">Phasenname &amp; Sozialform werden vorgeschlagen und gemerkt.</div>
            </div>
            <div className="row wrap" style={{gap:8}}>
              <PlanungsprofilWahl
                profil={planungsprofil}
                eigeneFelder={local.customPlanningFields}
                onChangeProfil={(id)=>setField('planningProfile', normalisiereProfilId(id))}
                onChangeFelder={(ids)=>setField('customPlanningFields', normalisiereFeldListe(ids))}
              />
              {languageMode ? (
                <button className="btn btnLeise" onClick={()=>setCheckOffen(true)}
                        title="Wenige ausgewählte Fragen zu dieser Planung">
                  <CircleHelp {...ICON_SM} /> Didaktik-Check
                </button>
              ) : null}
              <button className="btn" onClick={addPhase} data-onboarding-target="stunde-phase-hinzu">+ Phase</button>
            </div>
          </div>

          <div style={{height:10}} />

          <div className="phaseEditorList" data-onboarding-target="stunde-phasen">
            {local.phases.map((ph, idx)=>{
              /* Welche Angaben diese Phase zeigt, entscheidet das
                 Planungsprofil – mit einer Ausnahme: was bereits
                 ausgefüllt ist, bleibt sichtbar. Sonst verschwände beim
                 Wechsel auf ein knapperes Profil vorhandener Text aus
                 dem Blick, obwohl er weiter gespeichert ist und weiter
                 exportiert werden kann. */
              const zeigt = (feldId) => sichtbareFelder.includes(feldId) || feldHatInhalt(ph, feldId);
              const setzeFeld = (key, v) => {
                setPhases(local.phases.map((p,i)=> i===idx ? { ...p, [key]: v } : p));
              };
              const zusatzFelder = zusatzFelderFuer(ph);
              /* Eine Phase, in der ausser dem Namen noch nichts steht,
                 ist nicht unvollständig – sie ist unangetastet. Der
                 Hinweis erscheint erst, wenn hier tatsächlich geplant
                 wird; sonst stünde er auf jeder neuen Stunde viermal. */
              const begonnen = sichtbareFelder.some(id => id !== 'time' && id !== 'phase' && feldHatInhalt(ph, id));
              const offen = begonnen ? offeneFelderDerPhase(ph, sichtbareFelder) : [];
              const zeigtHilfen = languageMode || zeigt('scaffolding');
              return (
              <div key={ph.id} id={`phase-${ph.id}`} className="phaseEditor">
                <div className="phaseEditorHeader">
                  <div style={{fontWeight:800}}>{idx+1}. Phase</div>
                  <div className="row" style={{gap:8}}>
                    {/* Ein neutraler Hinweis, keine Warnung: eine Phase
                        darf bewusst unvollständig bleiben. */}
                    {offen.length ? (
                      <span className="offenHinweis"
                            title={`Noch ohne Angabe: ${offen.map(id => feldDefinition(id)?.label || id).join(', ')}`}>
                        {offen.length === 1 ? '1 Angabe offen' : `${offen.length} Angaben offen`}
                      </span>
                    ) : null}
                    <span className="badge" title={(phaseTimes?.[idx]?.end && phaseTimes?.[idx]?.start) ? `${phaseTimes[idx].start} – ${phaseTimes[idx].end}` : ''}>
                      {phaseTimes?.[idx]?.start ? `${phaseTimes[idx].start} · ` : ''}{ph.duration} min
                    </span>
                    {/* Das Entfernen einer Phase ist eine Nebenhandlung.
                        Als grosse rote Schaltfläche zog es mehr
                        Aufmerksamkeit auf sich als die Planung selbst –
                        jetzt steht es als ruhiges Symbol daneben. */}
                    <button className="iconBtn danger phaseEntfernen" onClick={()=>removePhase(idx)}
                            disabled={local.phases.length<=1}
                            title="Phase entfernen" aria-label={`Phase ${idx+1} entfernen`}>
                      <Trash2 {...ICON_SM} />
                    </button>
                  </div>
                </div>

                <div className="row wrap">
                  {zeigt('phase') ? (
                    <div className="grow">
                      <label className="small muted">Phasenname</label>
                      <PhaseNameInput
                        value={ph.title}
                        suggestions={phaseNameSuggestions || []}
                        onChange={(v)=>setzeFeld('title', v)}
                        onCommit={(v)=>onRememberPhaseName?.(v)}
                        onHideSuggestion={(v)=>onHidePhaseNameSuggestion?.(v)}
                      />
                    </div>
                  ) : null}
                  {zeigt('socialForm') ? (
                    <div style={{width:260}}>
                      <label className="small muted">Sozialform</label>
                      <SocialFormInput
                        value={ph.socialForm}
                        suggestions={suggestions}
                        onChange={(v)=>setzeFeld('socialForm', v)}
                        onCommit={(v)=>onRememberSocialForm(v)}
                        onHideSuggestion={(v)=>onHideSocialFormSuggestion?.(v)}
                      />
                    </div>
                  ) : null}
                </div>

                {zeigt('content') ? (
                  <>
                    <div style={{height:10}} />
                    <div className="phaseContentHead">
                      <label className="small muted">Inhalt / Ablauf</label>
                      <PhaseHelpCard
                        phaseTitle={ph.title}
                        lesson={local}
                        phase={ph}
                        phaseIndex={idx}
                        languageMode={languageMode}
                      />
                    </div>
                    <RichTextEditor
                      value={ph.content}
                      onChange={(v)=>setzeFeld('content', v)}
                      placeholder="Was passiert in dieser Phase? Material? Fragen? Differenzierung?"
                      gesperrt={readOnly}
                    />
                  </>
                ) : null}

                {(zeigt('materialsMedia') || zeigt('remarks')) ? (
                  <>
                    <div style={{height:10}} />
                    <div className="row wrap" style={{gap:10}}>
                      {zeigt('materialsMedia') ? (
                        <div className="grow">
                          <label className="small muted">Materialien &amp; Medien</label>
                          <RichTextEditor
                            value={ph.materialsMedia || ''}
                            onChange={(v)=>setzeFeld('materialsMedia', v)}
                            placeholder="z. B. AB, Tafelbild, Beamer, Karten, ..."
                            gesperrt={readOnly}
                          />
                        </div>
                      ) : null}
                      {zeigt('remarks') ? (
                        <div className="grow">
                          <label className="small muted">Bemerkungen</label>
                          <RichTextEditor
                            value={ph.remarks || ''}
                            onChange={(v)=>setzeFeld('remarks', v)}
                            placeholder="z. B. Hinweise, Beobachtungen, Alternativen, ..."
                            gesperrt={readOnly}
                          />
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {/* Alles Weitere steht hinter EINEM Griff. So bleibt die
                    Phasenplanung auch im ausführlichsten Profil eine
                    Karte und keine Formularwand. */}
                {zusatzFelder.length ? (
                  <>
                    <div style={{height:10}} />
                    <details className="phaseZusatz">
                      <summary className="phaseZusatzKopf">
                        <ChevronDown {...ICON_SM} />
                        <span>Weitere Angaben</span>
                        <span className="muted small">
                          {zusatzFelder.length === 1 ? '1 Feld' : `${zusatzFelder.length} Felder`}
                        </span>
                      </summary>
                      <div className="phaseZusatzInhalt">
                        {zusatzFelder.map((feldId)=>{
                          const feld = feldDefinition(feldId);
                          if (!feld) return null;
                          return (
                            <PhasenFeld
                              key={feldId}
                              feld={feld}
                              wert={ph[feld.key]}
                              ausserhalbDesProfils={!sichtbareFelder.includes(feldId)}
                              onChange={(v)=>setzeFeld(feld.key, v)}
                              gesperrt={readOnly}
                            />
                          );
                        })}
                      </div>
                    </details>
                  </>
                ) : null}

                {/* Hilfen gehören zur Phase und stehen deshalb hier –
                    im Fremdsprachenmodus oder wenn das Planungsprofil
                    die sprachliche Unterstützung vorsieht. */}
                {zeigtHilfen ? (
                  <>
                    <div style={{height:10}} />
                    <PhaseScaffolds
                      scaffolds={ph.scaffolds}
                      vorschlaege={scaffoldSuggestions}
                      onChange={(next)=>setzeFeld('scaffolds', next)}
                      onRemember={(v)=>onRememberScaffoldLabel?.(v)}
                      onHideSuggestion={(v)=>onHideScaffoldSuggestion?.(v)}
                    />
                  </>
                ) : null}
              </div>
              );
            })}
          </div>

          <div className="hr" />

          <div className="row wrap">
            <div className="grow">
              <label className="small muted">Hausaufgaben</label>
              <textarea value={local.homework} onChange={(e)=>setField('homework', e.target.value)} placeholder="z. B. Buch S. 42 Nr. 1–3" />
            </div>
            <div className="grow">
              <label className="small muted">Notizen</label>
              <textarea value={local.notes} onChange={(e)=>setField('notes', e.target.value)} placeholder="z. B. Beobachtungen, nächste Stunde anpassen..." />
            </div>

            <div style={{height:14}} />

            <div className="card">
              <div className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:10}}>
                <div>
                  <div style={{fontWeight:800}}>Links</div>
                  <div className="muted small">Klickbar in der App – wird nicht exportiert.</div>
                </div>
                {!readOnly ? <button className="btn primary" onClick={addLink}>Link hinzufügen</button> : null}
              </div>
              <div style={{height:10}} />

              {lessonLinks.length === 0 ? (
                <EmptyState
                  text="Verweise auf Material im Netz oder auf Ablagen – sie bleiben an dieser Stunde gespeichert."
                />
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {lessonLinks.map(l => (
                    <div key={l.id} className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                      <div className="grow" style={{minWidth:240}}>
                        <input
                          value={l.title || ''}
                          readOnly={readOnly}
                          onChange={(e)=>updateLink(l.id, { title: e.target.value })}
                          placeholder="Titel (optional)"
                        />
                        <div style={{height:6}} />
                        <input
                          value={l.url || ''}
                          readOnly={readOnly}
                          onChange={(e)=>updateLink(l.id, { url: e.target.value })}
                          placeholder="https://..."
                        />
                        {String(l.url || '').trim() ? (
                          <div className="muted small" style={{marginTop:6}}>
                            <a href={normalizeUrl(l.url)} target="_blank" rel="noreferrer">Öffnen</a>
                          </div>
                        ) : null}
                      </div>
                      <div className="row wrap" style={{gap:8}}>
                        <OeffnenKnopf onClick={()=>openLink(l.url)} disabled={!String(l.url||'').trim()}>Öffnen</OeffnenKnopf>
                        {!readOnly ? <button className="btn danger" onClick={()=>removeLink(l.id)}>Entfernen</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{height:14}} />

            <div className="card">
            <div className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:10}}>
              <div>
                <div style={{fontWeight:800}}>Dateien (lokale Verweise)</div>
                <div className="muted small">Nur zur Organisation – wird nicht exportiert und beeinflusst keine Sequenzen. Optional können Dateien beim Hinzufügen in eine App-Ablage kopiert werden (opt‑in).</div>
              </div>
              <div className="row wrap" style={{gap:8, alignItems:'center'}}>
                {!readOnly ? (
                  <>
                    <button className="btn primary" onClick={addLessonFiles}>Datei hinzufügen</button>
                    <label className="row" style={{gap:8, userSelect:'none'}} title="Wenn aktiv, werden Dateien in einen App-eigenen Ordner kopiert (opt-in).">
                      <input type="checkbox" checked={fileCopyOptIn} onChange={toggleFileCopyOptIn} />
                      <span className="small muted">Dateien in App kopieren (opt‑in)</span>
                    </label>
                  </>
                ) : null}
                {capabilities.fileLibrary ? (
                  <OeffnenKnopf onClick={openLibraryRoot} title="App-Ablage öffnen">Ablage öffnen</OeffnenKnopf>
                ) : null}
              </div>
            </div>

            <div style={{height:10}} />

            {seqFiles.length > 0 && (
              <div style={{marginBottom:10}}>
                <div className="small muted" style={{marginBottom:6}}>Aus Sequenz</div>
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {seqFiles.map(f => (
                    <div key={f.id} className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                      <div style={{minWidth:240}}>
                        <div className="row" style={{gap:8, alignItems:'center'}}>
                          <div style={{fontWeight:700}}>{f.name || fileNameFromPath(f.path)}</div>
                          {f.mode === 'copy' ? <span className="badge" title="In die App-Ablage kopiert">Kopie</span> : <span className="badge" title="Lokaler Verweis">Link</span>}
                        </div>
                        <div className="muted small" style={{wordBreak:'break-all'}}>{f.path}</div>
                        {f.sourcePath ? <div className="muted small" style={{wordBreak:'break-all'}}>Original: {f.sourcePath}</div> : null}
                      </div>
                      <div className="row wrap" style={{gap:8}}>
                        <OeffnenKnopf onClick={()=>openFile(f.path)}>Öffnen</OeffnenKnopf>
                        {capabilities.revealInFolder ? (
                          <OeffnenKnopf onClick={()=>revealFile(f.path)}>Im Ordner</OeffnenKnopf>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{height:10}} className="hr" />
              </div>
            )}

            {lessonFiles.length === 0 ? (
              <EmptyState
                text="Arbeitsblätter, Folien oder Hörtexte, die zu dieser Stunde gehören."
              />
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {lessonFiles.map(f => (
                  <div key={f.id} className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                    <div style={{minWidth:240}}>
                      <div className="row" style={{gap:8, alignItems:'center'}}>
                        <div style={{fontWeight:700}}>{f.name || fileNameFromPath(f.path)}</div>
                        {f.mode === 'copy' ? <span className="badge" title="In die App-Ablage kopiert">Kopie</span> : <span className="badge" title="Lokaler Verweis">Link</span>}
                      </div>
                      <div className="muted small" style={{wordBreak:'break-all'}}>{f.path}</div>
                      {f.sourcePath ? <div className="muted small" style={{wordBreak:'break-all'}}>Original: {f.sourcePath}</div> : null}
                    </div>
                    <div className="row wrap" style={{gap:8}}>
                      <OeffnenKnopf onClick={()=>openFile(f.path)}>Öffnen</OeffnenKnopf>
                      {capabilities.revealInFolder ? (
                          <OeffnenKnopf onClick={()=>revealFile(f.path)}>Im Ordner</OeffnenKnopf>
                        ) : null}
                      {!readOnly ? <button className="btn danger" onClick={()=>removeLessonFile(f.id)}>Entfernen</button> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          </div>

        </div>
      </div>

      <div style={{height:6}} />
      </fieldset>
      {!readOnly ? (
        <div className="muted small">Tipp: Ziehe einen Phasenblock im Zeitstrahl, um die Reihenfolge zu ändern. Ziehe die Trennlinie zwischen zwei Phasen, um Minuten zu verschieben (Summe bleibt {gesamtMin}).</div>
      ) : null}
    </div>
  );
}


function MacroView({
  db,
  view,
  sequences,
  appSettings,
  onUpdateAppSettings,
  schoolCalendar,
  competencySuggestions,
  onSetView,
  onCreateSequence,
  onRequestCreateSequence,
  onUpdateSequence,
  onDeleteSequence,
  onSaveSequenceAsTemplate,
  onRememberCompetency,
  onOpenLesson,
  onUpdateLessonAt,
  onDeleteLessonAt,
  onExportPdf,
  onExportDocx,
  readOnly = false
}){
  const startISO = view.startISO || view.weekStart;
  const rangeDays = view.rangeDays || 28;
  const endISO = useMemo(()=> toISODate(addDays(fromISODate(startISO), rangeDays - 1)), [startISO, rangeDays]);

  const schoolYear = (schoolCalendar && schoolCalendar.schoolYear) ? schoolCalendar.schoolYear : { startISO: '', endISO: '' };
  const minDate = (schoolYear.startISO || '').trim() || undefined;
  const maxDate = (schoolYear.endISO || '').trim() || undefined;

  const [groupQuery, setGroupQuery] = useState('');
  const [sequenceFilter, setSequenceFilter] = useState('');
  /* Kompetenzfilter: arbeitet auf dem Etikett und deckt damit System-
     wie eigene Kompetenzen gleichermassen ab – es gibt nur eine Art
     von Wert, nach der gefiltert werden könnte. */
  const [competencyFilter, setCompetencyFilter] = useState('');

  const dates = useMemo(()=>{
    const out = [];
    const start = fromISODate(startISO);
    for (let i=0;i<rangeDays;i++){
      const d = addDays(start, i);
      const dow = d.getDay(); // 0 Sun ... 6 Sat
      if (dow === 0 || dow === 6) continue; // skip weekend
      out.push(toISODate(d));
    }
    return out;
  }, [startISO, rangeDays]);

  const dateInfoByISO = useMemo(()=>{
    const m = new Map();
    for (const d of dates) m.set(d, getDayInfo(d, schoolCalendar));
    return m;
  }, [dates, schoolCalendar]);

  const occurrences = useMemo(()=>{
    const out = [];
    for (const [weekStart, w] of Object.entries(db.weeks || {})) {
      for (const [k, rawLesson] of Object.entries(w.lessons || {})) {
        const parts = k.split('-').map(Number);
        if (parts.length !== 2) continue;
        const [dayIndex, slotIndex] = parts;
        const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
        if (dateISO < startISO || dateISO > endISO) continue;

        const lesson = normalizeLesson(rawLesson);
        const group = (lesson.classGroup || '').trim() || 'Ohne Lerngruppe';
        const primary = (lesson.primaryCompetency || '').trim() || (lesson.competencies?.[0] || '');
        out.push({
          weekStart, dayIndex, slotIndex, dateISO,
          group,
          lesson,
          primaryCompetency: primary
        });
      }
    }
    out.sort((a,b)=> (a.group.localeCompare(b.group) || a.dateISO.localeCompare(b.dateISO) || (a.slotIndex-b.slotIndex)));
    return out;
  }, [db, startISO, endISO]);

  const groups = useMemo(()=>{
    const gset = new Set();
    for (const o of occurrences) gset.add(o.group);
    return Array.from(gset).sort((a,b)=>a.localeCompare(b));
  }, [occurrences]);

  const filteredGroups = useMemo(()=>{
    const q = (groupQuery || '').trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => g.toLowerCase().includes(q));
  }, [groups, groupQuery]);

  /* Zur Auswahl steht, was in diesem Zeitraum wirklich vorkommt – eine
     Liste aller je angelegten Kompetenzen wäre hier nur lang. */
  const kompetenzenImZeitraum = useMemo(()=>{
    const set = new Set();
    for (const o of occurrences) {
      for (const c of (Array.isArray(o.lesson.competencies) ? o.lesson.competencies : [])) {
        const v = String(c || '').trim();
        if (v) set.add(v);
      }
      const p = String(o.lesson.primaryCompetency || '').trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b)=> a.localeCompare(b));
  }, [occurrences]);

  const byGroupDate = useMemo(()=>{
    const map = new Map();
    for (const o of occurrences) {
      if (sequenceFilter && (o.lesson.sequenceId || '') !== sequenceFilter) continue;
      if (competencyFilter && kompetenzenImZeitraum.includes(competencyFilter)) {
        const liste = Array.isArray(o.lesson.competencies) ? o.lesson.competencies : [];
        const alle = new Set(liste.map(x => String(x || '').trim()).filter(Boolean));
        const primaer = String(o.lesson.primaryCompetency || '').trim();
        if (primaer) alle.add(primaer);
        if (!alle.has(competencyFilter)) continue;
      }
      if (!map.has(o.group)) map.set(o.group, new Map());
      const dm = map.get(o.group);
      const arr = dm.get(o.dateISO) || [];
      arr.push(o);
      dm.set(o.dateISO, arr);
    }
    return map;
  }, [occurrences, sequenceFilter, competencyFilter, kompetenzenImZeitraum]);

  const colsStyle = useMemo(()=>({
    gridTemplateColumns: `160px repeat(${dates.length}, 220px)`
  }), [dates.length]);

  const setStartISO = (iso) => {
    const monday = toISODate(startOfWeekMonday(fromISODate(iso)));
    onSetView(v => ({ ...v, startISO: iso, weekStart: monday }));
  };
  const setRangeDays = (d) => {
    onSetView(v => ({ ...v, rangeDays: d }));
  };

  const getSeq = (id) => id ? (sequences?.[id] || null) : null;

  const exportSequencePdf = (sequenceId) => {
    const seq = sequences?.[sequenceId];
    if (!seq) return;
    if (typeof onExportPdf !== 'function') {
      showToast('PDF-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }

    const occ = [];
    const weeks = db?.weeks || {};
    for (const [ws, w] of Object.entries(weeks)) {
      const lessons = w?.lessons || {};
      for (const [k, raw] of Object.entries(lessons)) {
        if (!raw) continue;
        if ((raw.sequenceId || '') !== sequenceId) continue;
        const parts = String(k).split('-');
        const dayIndex = Number(parts[0]);
        const slotIndex = Number(parts[1]);
        if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
        const dateISO = toISODate(addDays(fromISODate(ws), dayIndex));
        const lesson = normalizeLesson(raw);
        occ.push({ weekStart: ws, dayIndex, slotIndex, dateISO, lesson, group: lesson.classGroup || '' });
      }
    }
    occ.sort((a,b)=> a.dateISO.localeCompare(b.dateISO) || (a.slotIndex - b.slotIndex) || (a.group||'').localeCompare(b.group||''));

    const html = buildSequencePdfHtml({
      sequence: seq,
      occurrences: occ,
      schoolCalendar,
      groupColors: db?.groupColors || {}
    });
    const safe = String(seq.name || 'Sequenz').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Sequenz';
    onExportPdf(html, `Sequenz_${safe}.pdf`);
  };


const exportSequenceDocx = (sequenceId) => {
  const seq = sequences?.[sequenceId];
  if (!seq) return;
  if (typeof onExportDocx !== 'function') {
    showToast('Word-Export ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
    return;
  }

  const occ = [];
  const weeks = db?.weeks || {};
  for (const [ws, w] of Object.entries(weeks)) {
    const lessons = w?.lessons || {};
    for (const [k, raw] of Object.entries(lessons)) {
      if (!raw) continue;
      if ((raw.sequenceId || '') !== sequenceId) continue;
      const parts = String(k).split('-');
      const dayIndex = Number(parts[0]);
      const slotIndex = Number(parts[1]);
      if (!Number.isFinite(dayIndex) || !Number.isFinite(slotIndex)) continue;
      const dateISO = toISODate(addDays(fromISODate(ws), dayIndex));
      const lesson = normalizeLesson(raw);
      occ.push({ weekStart: ws, dayIndex, slotIndex, dateISO, lesson, group: lesson.classGroup || '' });
    }
  }
  occ.sort((a,b)=> a.dateISO.localeCompare(b.dateISO) || (a.slotIndex - b.slotIndex) || (a.group||'').localeCompare(b.group||''));

  const html = buildSequencePdfHtml({
    sequence: seq,
    occurrences: occ,
    schoolCalendar,
    groupColors: db?.groupColors || {}
  });
  const safe = String(seq.name || 'Sequenz').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Sequenz';
  onExportDocx(html, `Sequenz_${safe}.doc`);
};

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Makro-Plan</div>
          <div className="muted small">Lerngruppen als horizontale Strahlen. Klick auf eine Stunde öffnet die Detailplanung.</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          {!readOnly ? (
            <button className="btn" onClick={()=>onRequestCreateSequence?.()}>Sequenzen verwalten</button>
          ) : null}
        </div>
      </div>

      <div style={{height:12}} />

      <div className="row wrap" style={{gap:10}}>
        <div style={{width:180}}>
          <label className="small muted">Startdatum</label>
          <input className="input" type="date" min={minDate} max={maxDate} value={startISO} onChange={(e)=>setStartISO(e.target.value)} />
        </div>
        <div style={{width:180}}>
          <label className="small muted">Zeitraum</label>
          <select className="input" value={rangeDays} onChange={(e)=>setRangeDays(Number(e.target.value))}>
            <option value={14}>2 Wochen</option>
            <option value={28}>4 Wochen</option>
            <option value={84}>12 Wochen</option>
          </select>
        </div>
        <div style={{width:240}}>
          <label className="small muted">Lerngruppe suchen</label>
          <input className="input" value={groupQuery} onChange={(e)=>setGroupQuery(e.target.value)} placeholder="z. B. 7a" />
        </div>
        <div style={{width:260}}>
          <label className="small muted">Sequenz filtern</label>
          <select className="input" value={sequenceFilter} onChange={(e)=>setSequenceFilter(e.target.value)}>
            <option value="">Alle Sequenzen</option>
            {Object.values(sequences || {}).sort((a,b)=>a.name.localeCompare(b.name)).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div style={{width:260}}>
          <label className="small muted">Kompetenz filtern</label>
          <select className="input" value={competencyFilter}
                  onChange={(e)=>setCompetencyFilter(e.target.value)}
                  disabled={kompetenzenImZeitraum.length === 0}>
            <option value="">Alle Kompetenzen</option>
            {kompetenzenImZeitraum.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>

      <div style={{height:14}} />

      <div className="macroScroll">
        <div className="macroRow macroHeader" style={colsStyle}>
          <div className="macroSticky macroHeaderCell">Lerngruppe</div>
          {dates.map(d => {
            const info = dateInfoByISO.get(d) || { isOff: false };
            const label = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
            return (
              <div key={d} className={`macroHeaderCell ${info.isOff ? 'dayOffCol' : ''}`} title={label}>
                <div style={{fontWeight:700}}>{formatDateDE(d)}</div>
                <div className="muted small">{DAYS[fromISODate(d).getDay()-1] || ''}</div>
                {label ? <div className="muted small" style={{marginTop:4}}>{label}</div> : null}
              </div>
            );
          })}
        </div>

        {filteredGroups.map(group => {
          const dm = byGroupDate.get(group) || new Map();
          return (
            <div key={group} className="macroRow" style={colsStyle}>
              <div className="macroSticky macroGroupCell">
                <div style={{fontWeight:800}}>{group}</div>
                <div className="muted small">{(()=>{
                  /* Gezählt werden Unterrichtsstunden, nicht Einträge:
                     eine Doppelstunde ist ein Eintrag und zwei Stunden. */
                  const eintraege = Array.from(dm.values()).reduce((a,b)=>a+b.length,0);
                  const stunden = Array.from(dm.values()).reduce((a,b)=> a + b.reduce((x,o)=> x + blockSpanOf(o.lesson), 0), 0);
                  return eintraege === stunden ? `${stunden} Std.` : `${eintraege} Einheiten · ${stunden} Std.`;
                })()}</div>
              </div>
              {dates.map(d => {
                const info = dateInfoByISO.get(d) || { isOff: false };
                const label = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
                const items = (dm.get(d) || []).sort((a,b)=>a.slotIndex-b.slotIndex);
                return (
                  <div key={d} className={`macroCell ${info.isOff ? 'dayOffCol' : ''}`} title={label}>
                    {label && items.length === 0 ? <span className="pill" style={{marginBottom:6}}>{label}</span> : null}
                    {items.map((o) => {
                      const seq = getSeq(o.lesson.sequenceId);
                      const border = seq?.color ? lineColor(seq.color) : 'var(--border)';
                      const topic = (o.lesson.topic || '').trim() || (o.lesson.subject || '').trim() || 'Ohne Thema';
                      const comp = (o.primaryCompetency || '').trim();
                      return (
                        <div
                          key={`${o.weekStart}-${o.dayIndex}-${o.slotIndex}`}
                          className="macroLesson"
                          style={{ borderLeftColor: border }}
                          onClick={()=>onOpenLesson(o.weekStart, o.dayIndex, o.slotIndex)}
                          title="Öffnen"
                        >
                          <div className="row" style={{justifyContent:'space-between', gap:8, alignItems:'flex-start'}}>
                            <div style={{fontWeight:800, fontSize:12}}>{formatDateDE(o.dateISO)} · {stundenBereichLabel(o.slotIndex, blockSpanOf(o.lesson))}</div>
                            <select
                              className="macroSelect"
                              value={o.lesson.sequenceId || ''}
                              disabled={readOnly}
                              title={readOnly ? 'Archiviert – nur zum Ansehen' : 'Sequenz zuordnen'}
                              onClick={(e)=>e.stopPropagation()}
                              onChange={(e)=>{
                                e.stopPropagation();
                                if (readOnly) return;
                                const v = e.target.value;
                                if (v === '__new__') {
                                  // In-app modal (window.prompt can be suppressed in some Electron/Windows setups)
                                  onRequestCreateSequence?.((createdId)=>{
                                    if (createdId) {
                                      onUpdateLessonAt(o.weekStart, o.dayIndex, o.slotIndex, { ...o.lesson, sequenceId: createdId });
                                    }
                                  });
                                  return;
                                }
                                onUpdateLessonAt(o.weekStart, o.dayIndex, o.slotIndex, { ...o.lesson, sequenceId: v });
                              }}
                            >
                              <option value="">— Sequenz —</option>
                              {Object.values(sequences || {}).sort((a,b)=>a.name.localeCompare(b.name)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                              <option value="__new__">+ Neue Sequenz…</option>
                            </select>
                            {!readOnly ? (
                              <button
                                className="iconBtn danger"
                                onClick={(e)=>{
                                  e.stopPropagation();
                                  onDeleteLessonAt(o.weekStart, o.dayIndex, o.slotIndex);
                                }}
                                title="Stunde löschen"
                                aria-label="Stunde löschen"
                              ><Trash2 {...ICON_SM} /></button>
                            ) : null}
                          </div>

                          <div className="macroTopic">{topic}</div>

                          <div className="row wrap" style={{gap:6}}>
                            {seq ? <span className="pill" style={{borderColor: lineColor(seq.color), color: lineColor(seq.color)}}><Square {...ICON_SM} fill="currentColor" /> {seq.name}</span> : <span className="pill">Ohne Sequenz</span>}
                            {comp ? <span className="pill">Kompetenz: {comp}</span> : <span className="pill">Kompetenz: —</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Jahresgrobplanung (Orientierung) ---
// Draggable Balken über das Schuljahr. Rein informativ:
// - wird in der Einzelstundenansicht als Hinweis angezeigt
// - beeinflusst keine Sequenzen
// - wird nicht in Verlaufspläne/Exports übernommen
function YearPlanView({
  db,
  view,
  schoolCalendar,
  minDate,
  maxDate,
  classGroupSuggestions,
  subjectSuggestions,
  onHideClassGroupSuggestion,
  onHideSubjectSuggestion,
  onCreateBar,
  onUpdateBar,
  onDeleteBar,
  onClearLane,
  onRemoveLane,
  onRenameLane,
  onOpenSequenz,
  onVerschiebeSequenz,
  onSetView,
  readOnly = false
}){
  const schoolYear = (schoolCalendar && schoolCalendar.schoolYear) ? schoolCalendar.schoolYear : { startISO:'', endISO:'' };
  const syStart = (schoolYear.startISO || '').trim();
  const syEnd = (schoolYear.endISO || '').trim();

  const weekWidth = 28; // px per Woche

  const weekStarts = useMemo(()=>{
    if (!syStart || !syEnd) return [];
    const start = startOfWeekMonday(fromISODate(syStart));
    const end = startOfWeekMonday(fromISODate(syEnd));
    const out = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 7)){
      out.push(toISODate(d));
    }
    return out;
  }, [syStart, syEnd]);

  const totalWidth = Math.max(weekStarts.length * weekWidth, 200);

  const bars = useMemo(()=> (Array.isArray(db?.yearBars) ? db.yearBars : []), [db]);

  const [query, setQuery] = useState('');

  const laneKey = (b) => jahresZeileKey(b?.classGroup, b?.subject);
  const laneLabel = (k) => jahresZeileLabel(k);

  /* Sichtbar ist eine Zeile, wenn sie Balken trägt ODER ausdrücklich
     behalten wurde (nach "Jahresplanung leeren"). */
  const lanes = useMemo(()=>{
    const set = new Set();
    for (const b of bars) set.add(laneKey(b));
    for (const l of (Array.isArray(db?.yearPlanLanes) ? db.yearPlanLanes : [])) {
      set.add(jahresZeileKey(l.classGroup, l.subject));
    }
    const arr = Array.from(set);
    // sort: Allgemein first, then by label
    arr.sort((a,b)=> (a==='allgemein'?-1:(b==='allgemein'?1:laneLabel(a).localeCompare(laneLabel(b)))));
    return arr;
  }, [bars, db?.yearPlanLanes]);

  const filteredLanes = useMemo(()=>{
    const q = String(query||'').trim().toLowerCase();
    if (!q) return lanes;
    return lanes.filter(k => laneLabel(k).toLowerCase().includes(q));
  }, [lanes, query]);

  const weekIndexOf = (iso) => {
    if (!iso || !weekStarts.length) return 0;
    try {
      const d = startOfWeekMonday(fromISODate(iso));
      const w = toISODate(d);
      const idx = weekStarts.indexOf(w);
      if (idx >= 0) return idx;
      // fallback: approximate
      const start = fromISODate(weekStarts[0]);
      return clamp(Math.round((d - start) / (7*24*60*60*1000)), 0, weekStarts.length-1);
    } catch {
      return 0;
    }
  };

  const isoFromWeekIndex = (idx) => {
    if (!weekStarts.length) return '';
    return weekStarts[clamp(idx, 0, weekStarts.length-1)] || '';
  };

  const normalizeToWeek = (iso) => {
    try {
      return toISODate(startOfWeekMonday(fromISODate(iso)));
    } catch { return iso; }
  };

  const axis = useMemo(()=>{
    return weekStarts.map((ws, i)=>{
      const d = fromISODate(ws);
      const voll = weekNumberISO(d);            // "KW x / yyyy"
      return {
        ws, i,
        month: d.getMonth(),
        year: d.getFullYear(),
        wk: voll,
        // Nur die Zahl. "KW" 40-mal nebeneinander zu wiederholen ist der
        // Grund, warum die Leiste vorher unlesbar war – es steht jetzt
        // einmal in der Spaltenüberschrift.
        nummer: (voll.match(/\d+/) || [''])[0],
      };
    });
  }, [weekStarts]);

  /* Monatsbänder: zusammenhängende Wochen desselben Monats zu einem Feld
     gefasst. Vorher lag die Monatsbeschriftung IN der 28 px breiten
     Wochenspalte und lief über ihre Nachbarn hinweg. */
  const monatsBaender = useMemo(()=>{
    const out = [];
    for (const a of axis){
      const letzter = out[out.length - 1];
      if (letzter && letzter.month === a.month && letzter.year === a.year) {
        letzter.wochen += 1;
        continue;
      }
      out.push({ month: a.month, year: a.year, start: a.i, wochen: 1, ws: a.ws });
    }
    return out.map((m, i)=>{
      const d = fromISODate(m.ws);
      const kurz = d.toLocaleString('de-DE', { month: 'short' });
      const lang = d.toLocaleString('de-DE', { month: 'long' });
      // Die Jahreszahl steht am Anfang und beim Jahreswechsel, nicht an
      // jedem Monat – sonst trägt die Leiste zwölfmal dieselbe Angabe.
      const zeigtJahr = i === 0 || out[i-1].year !== m.year;
      return {
        key: `${m.year}-${m.month}`,
        left: m.start * weekWidth,
        width: m.wochen * weekWidth,
        text: zeigtJahr ? `${kurz} ${m.year}` : kurz,
        titel: `${lang} ${m.year}`,
      };
    });
  }, [axis, weekWidth]);

  const scrollRef = useRef(null);
  useEffect(()=>{
    const focusISO = String(view?.focusISO || '').trim();
    if (!focusISO || !scrollRef.current || !weekStarts.length) return;
    const idx = weekIndexOf(focusISO);
    const x = idx * weekWidth;
    scrollRef.current.scrollLeft = Math.max(0, x - 220);
  }, [view?.focusISO, weekStarts.length]);

  const [modal, setModal] = useState({ open:false, mode:'create', bar:null });

  const startCreate = () => {
    if (!syStart || !syEnd) {
      showToast('Bitte zuerst im Schulkalender das Schuljahr (Start/Ende) setzen.', { tone: 'warning' });
      return;
    }
    const startISO = normalizeToWeek(view?.focusISO || syStart);
    const endISO = normalizeToWeek(addDaysISO(startISO, 14));
    setModal({ open:true, mode:'create', bar:{ title:'', classGroup:'', subject:'', startISO, endISO, color: SEQ_COLORS[0] } });
  };

  const startEdit = (bar) => {
    if (readOnly) return;
    setModal({ open:true, mode:'edit', bar: deepClone(bar) });
  };

  // --- Drag + Resize ---
  /* Was nach dem Loslassen eines VERKNÜPFTEN Balkens zu entscheiden ist.
     Ein Balken zu verschieben heisst nie von selbst, Unterricht zu
     verschieben – gefragt wird deshalb erst, nachdem die Bewegung
     abgeschlossen ist. */
  const [balkenFrage, setBalkenFrage] = useState(null);
  const dragRef = useRef(null);
  const onMouseDownBar = (e, bar, mode) => {
    e.preventDefault();
    e.stopPropagation();
    // Im Archiv wird nichts gezogen und nichts verschoben.
    if (readOnly) return;
    if (!weekStarts.length) return;
    const startIdx = weekIndexOf(bar.startISO);
    const endIdx = weekIndexOf(bar.endISO);
    dragRef.current = {
      id: bar.id,
      sequenceId: balkenSequenzId(bar),
      vorher: { startISO: bar.startISO, endISO: bar.endISO },
      letzte: { startISO: bar.startISO, endISO: bar.endISO },
      mode: mode || 'move',
      startX: e.clientX,
      startIdx,
      endIdx
    };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const deltaWeeks = Math.round(dx / weekWidth);
      let nStart = d.startIdx;
      let nEnd = d.endIdx;
      if (d.mode === 'move') {
        nStart = d.startIdx + deltaWeeks;
        nEnd = d.endIdx + deltaWeeks;
      } else if (d.mode === 'resize-left') {
        nStart = d.startIdx + deltaWeeks;
      } else if (d.mode === 'resize-right') {
        nEnd = d.endIdx + deltaWeeks;
      }
      nStart = clamp(nStart, 0, weekStarts.length-1);
      nEnd = clamp(nEnd, 0, weekStarts.length-1);
      if (nEnd < nStart) {
        if (d.mode === 'resize-left') nStart = nEnd;
        else nEnd = nStart;
      }
      // live update (throttled by RAF to keep smooth)
      d.letzte = { startISO: isoFromWeekIndex(nStart), endISO: isoFromWeekIndex(nEnd) };
      if (d.raf) cancelAnimationFrame(d.raf);
      d.raf = requestAnimationFrame(()=>{
        onUpdateBar?.(d.id, { ...d.letzte }, { live: true });
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.raf) cancelAnimationFrame(d.raf);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!d) return;
      const bewegt = d.letzte.startISO !== d.vorher.startISO || d.letzte.endISO !== d.vorher.endISO;
      if (!bewegt) return;
      /* Der Abschluss der Bewegung. Erst hier entsteht ein
         Sicherungspunkt – während des Ziehens wäre er ein Einzelbild. */
      onUpdateBar?.(d.id, { ...d.letzte });
      if (!d.sequenceId) return;
      const wochen = weekIndexOf(d.letzte.startISO) - weekIndexOf(d.vorher.startISO);
      setBalkenFrage({
        barId: d.id,
        sequenceId: d.sequenceId,
        vorher: d.vorher,
        nachher: { ...d.letzte },
        wochen,
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const weekOffMap = useMemo(()=>{
    // mark weeks that overlap with vacation/free days (for subtle background)
    const m = new Map();
    for (const ws of weekStarts){
      let off = false;
      for (let i=0;i<5;i++){
        const d = toISODate(addDays(fromISODate(ws), i));
        const info = getDayInfo(d, schoolCalendar);
        if (info?.isOff) { off = true; break; }
      }
      m.set(ws, off);
    }
    return m;
  }, [weekStarts, schoolCalendar]);

  if (!syStart || !syEnd) {
    return (
      <div className="card">
        <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontWeight:900, fontSize:16}}>Jahresgrobplanung</div>
            <div className="muted small">Drag-&-Drop-Balken als Orientierung (wirkt sich nicht auf Sequenzen/Exporte aus).</div>
          </div>
        </div>
        <div style={{height:10}} />
        <div className="muted">Bitte zuerst im <b>Schulkalender</b> das Schuljahr (Start/Ende) eintragen.</div>
        <div style={{height:10}} />
        <button className="btn" onClick={()=>onSetView?.({ name:'calendar', weekStart: view?.weekStart || toISODate(new Date()) })}>Zum Schulkalender</button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Jahresgrobplanung</div>
          <div className="muted small">{readOnly
            ? 'Archiviertes Schuljahr – die Balken werden nur angezeigt.'
            : 'Farbbalken über das Schuljahr – nur Orientierung. Keine Auswirkungen auf Unterrichtssequenzen, nicht im Export.'}</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          {!readOnly ? (
            <button className="btn primary" onClick={startCreate}>+ Balken hinzufügen</button>
          ) : null}
        </div>
      </div>

      <div style={{height:12}} />

      <div className="row wrap" style={{gap:10, alignItems:'flex-end'}}>
        <div style={{width:260}}>
          <label className="small muted">Lane suchen (Klasse · Fach)</label>
          <input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="z. B. 7a · Deutsch" />
        </div>
        <div className="muted small" style={{marginBottom:2}}>
          Schuljahr: {formatDateDE(syStart)} – {formatDateDE(syEnd)}
        </div>
      </div>

      <div style={{height:14}} />

      <div className="yearPlanWrap">
        <div className="yearPlanAxis">
          <div className="yearPlanSticky yearPlanAxisSticky">
            <div className="yearPlanAxisHint">Monat</div>
            <div className="yearPlanAxisHint">Kalenderwoche</div>
          </div>
          <div className="yearPlanScroll" ref={scrollRef}>
            <div className="yearPlanAxisInner" style={{width: totalWidth}}>
              <div className="yearPlanMonthBand">
                {monatsBaender.map(m=>(
                  <div key={m.key} className="yearPlanMonth"
                       style={{left: m.left, width: m.width}} title={m.titel}>
                    <span className="yearPlanMonthLabel">{m.text}</span>
                  </div>
                ))}
              </div>
              <div className="yearPlanWeekBand">
                {axis.map(({ws,i,month,wk,nummer})=>{
                  const istMonatsbeginn = i===0 || axis[i-1].month !== month;
                  const off = weekOffMap.get(ws);
                  return (
                    <div key={ws}
                         className={`yearPlanWeekTick${off ? ' yearPlanWeekTick--off' : ''}${istMonatsbeginn ? ' is-monthStart' : ''}`}
                         style={{left: i*weekWidth, width: weekWidth}} title={wk}>
                      <span className="yearPlanWeekLabel">{nummer}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {filteredLanes.length === 0 ? (
          <div className="muted small">Keine passenden Lanes gefunden.</div>
        ) : filteredLanes.map((lk)=>{
          const laneBars = bars.filter(b => laneKey(b) === lk);
          return (
            <div key={lk} className="yearPlanRow">
              <div className="yearPlanSticky">
                <div style={{fontWeight:800, paddingRight:26}}>{laneLabel(lk)}</div>
                <div className="muted small">{laneBars.length === 1 ? '1 Balken' : `${laneBars.length} Balken`}</div>
                {/* Aktionen der ZEILE – nicht der Lerngruppe. Die
                    Lerngruppe selbst bleibt der App in jedem Fall
                    erhalten; hier geht es nur um diese Jahresplanung. */}
                {!readOnly ? (
                <KebabMenu
                  titel="Aktionen für diese Zeile"
                  ausrichtung="links"
                  eintraege={[
                    { label: 'Lerngruppe bearbeiten', icon: <Pencil {...ICON_SM} />, onSelect: ()=>onRenameLane?.(lk) },
                    {
                      label: 'Jahresplanung leeren',
                      icon: <Eraser {...ICON_SM} />,
                      disabled: laneBars.length === 0,
                      title: 'Alle Balken dieser Zeile entfernen – die Zeile bleibt stehen',
                      onSelect: ()=>onClearLane?.(lk),
                    },
                    { trenner: true },
                    {
                      label: 'Aus Jahresplanung entfernen',
                      icon: <Ban {...ICON_SM} />,
                      tone: 'danger',
                      title: 'Entfernt nur diese Zeile. Die Lerngruppe bleibt in Prép-ybara erhalten.',
                      onSelect: ()=>onRemoveLane?.(lk),
                    },
                  ]}
                />
                ) : null}
              </div>
              <div className="yearPlanScroll">
                <div className="yearPlanLane" style={{width: totalWidth}}>
                  {/* background grid */}
                  {weekStarts.map((ws, i)=>{
                    const off = weekOffMap.get(ws);
                    const istMonatsbeginn = i===0 || axis[i-1]?.month !== axis[i]?.month;
                    return <div key={ws}
                                className={`yearPlanGridCol${off ? ' yearPlanGridCol--off' : ''}${istMonatsbeginn ? ' is-monthStart' : ''}`}
                                style={{left:i*weekWidth, width:weekWidth}} />;
                  })}

                  {laneBars.map((b, idx)=>{
                    const sIdx = weekIndexOf(b.startISO);
                    const eIdx = weekIndexOf(b.endISO);
                    const left = sIdx * weekWidth;
                    const breiteInWochen = Math.max(1, eIdx - sIdx + 1);
                    const width = Math.max(weekWidth, breiteInWochen * weekWidth);
                    // Für bessere Übersicht: Hintergrund der Balken abwechselnd etwas heller/dunkler
                    // (wir verändern NICHT die gespeicherte Balkenfarbe, nur die Darstellung).
                    const bgAlpha = (idx % 2 === 0) ? 0.16 : 0.30;
                    /* Was der Balken über seine Sequenz weiss, wird bei
                       jeder Darstellung neu gerechnet. Deshalb steht
                       nach einem Umbenennen sofort der neue Name da. */
                    const verknuepft = balkenBeschriftung(db, b);
                    const verwaist = istVerwaist(b, db?.sequences);
                    const titelText = [
                      b.title || '',
                      `${formatDateDE(b.startISO)} – ${formatDateDE(b.endISO)}`,
                      verknuepft ? `Sequenz: ${verknuepft.name} · ${verknuepft.umfang}` : '',
                      verwaist ? 'Die verknüpfte Sequenz gibt es nicht mehr.' : '',
                      '(Doppelklick zum Bearbeiten)',
                    ].filter(Boolean).join('\n');
                    return (
                      <div
                        key={b.id}
                        className={`yearPlanBar${verknuepft ? ' yearPlanBar--verknuepft' : ''}`}
                        style={{left, width, background: hexToRgba(surfaceColor(b.color), bgAlpha), borderColor: lineColor(b.color)}}
                        onDoubleClick={()=>startEdit(b)}
                        onMouseDown={(e)=>onMouseDownBar(e, b, 'move')}
                        title={titelText}
                      >
                        <div className="yearPlanBarHandle yearPlanBarHandle--left" onMouseDown={(e)=>onMouseDownBar(e, b, 'resize-left')} />
                        <div className="yearPlanBarHandle yearPlanBarHandle--right" onMouseDown={(e)=>onMouseDownBar(e, b, 'resize-right')} />
                        <div className="yearPlanBarTitle" style={{color: textColor(b.color)}}>
                          <span className="yearPlanDot" style={{background:b.color}} />
                          {b.title || 'Ohne Titel'}
                        </div>
                        {verknuepft ? (
                          /* Zwei Zeilen: der Titel des Balkens gehört ihm
                             allein, die Sequenz steht darunter. In einer
                             Zeile drängte die Sequenzangabe den Titel aus
                             dem Balken – bei 28 px je Woche ist das schnell
                             geschehen.

                             Was in die zweite Zeile passt, hängt von der
                             Breite ab: der Name immer, die Anzahl ab sechs
                             Wochen, der Zeitraum ab zehn. Alles Weitere
                             steht im Tooltip – ein abgeschnittener Name
                             wäre schlechter als eine Angabe weniger. */
                          <div className="yearPlanBarSeq" style={{color: textColor(b.color)}}>
                            <Link2 {...ICON_SM} />
                            <span className="yearPlanBarSeqName">{verknuepft.name}</span>
                            {breiteInWochen >= 6 ? (
                              <span className="yearPlanBarSeqUmfang">{verknuepft.umfang}</span>
                            ) : null}
                            {(breiteInWochen >= 10 && verknuepft.vonISO) ? (
                              <span className="yearPlanBarSeqZeit">
                                {formatDateDE(verknuepft.vonISO)} – {formatDateDE(verknuepft.bisISO)}
                              </span>
                            ) : null}
                          </div>
                        ) : verwaist ? (
                          <div className="yearPlanBarSeq" style={{color: textColor(b.color)}}>
                            <Unlink {...ICON_SM} />
                            <span className="yearPlanBarSeqName">Sequenz nicht mehr vorhanden</span>
                          </div>
                        ) : null}
                        {/* Das Menü des Balkens. Es liegt IM Balken, darf
                            aber nicht mitziehen – deshalb hält es die
                            Maustaste bei sich. */}
                        <div className="yearPlanBarMenu" onMouseDown={(e)=>e.stopPropagation()} onDoubleClick={(e)=>e.stopPropagation()}>
                          <KebabMenu
                            titel={`Aktionen für „${b.title || 'Balken'}“`}
                            ausrichtung="rechts"
                            eintraege={[
                              ...(verknuepft ? [
                                {
                                  label: 'Sequenz öffnen',
                                  icon: <ListTree {...ICON_SM} />,
                                  title: 'Zur Progression dieser Sequenz',
                                  onSelect: ()=>onOpenSequenz?.(balkenSequenzId(b)),
                                },
                                {
                                  label: 'Zeitraum aus Sequenz übernehmen',
                                  icon: <CalendarRange {...ICON_SM} />,
                                  disabled: readOnly || !verknuepft.vonISO,
                                  title: 'Den Balken auf die tatsächlich geplanten Termine legen',
                                  onSelect: ()=>{
                                    const zeitraum = zeitraumAusSequenz(db, balkenSequenzId(b), { aufWoche: normalizeToWeek });
                                    if (!zeitraum) return;
                                    onUpdateBar?.(b.id, zeitraum);
                                  },
                                },
                              ] : []),
                              ...(verknuepft || verwaist ? [{
                                label: 'Verknüpfung lösen',
                                icon: <Unlink {...ICON_SM} />,
                                disabled: readOnly,
                                title: 'Der Balken bleibt, die Sequenz bleibt – nur die Verbindung geht',
                                onSelect: ()=>onUpdateBar?.(b.id, { sequenceId: '' }),
                              }] : []),
                              ...((verknuepft || verwaist) ? [{ trenner: true }] : []),
                              {
                                label: 'Bearbeiten',
                                icon: <Pencil {...ICON_SM} />,
                                disabled: readOnly,
                                onSelect: ()=>startEdit(b),
                              },
                              {
                                label: 'Löschen',
                                icon: <Trash2 {...ICON_SM} />,
                                tone: 'danger',
                                disabled: readOnly,
                                title: 'Löscht nur den Balken – eine verknüpfte Sequenz bleibt erhalten',
                                onSelect: ()=>onDeleteBar?.(b.id),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {balkenFrage ? (
        <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) setBalkenFrage(null); }}>
          <div className="modalCard" role="dialog" aria-modal="true" aria-label="Verknüpfter Balken verschoben"
               onKeyDown={(e)=>{ if (e.key === 'Escape') setBalkenFrage(null); }}>
            <h3 className="dialogTitle">Balken verschoben – und die Sequenz?</h3>
            <p className="dialogBody">
              Der Balken liegt jetzt auf {formatDateDE(balkenFrage.nachher.startISO)} – {formatDateDE(balkenFrage.nachher.endISO)}.
              Die Sequenztermine sind unverändert geblieben. Sollen sie mitgehen?
            </p>
            <p className="muted small">
              Beim Mitverschieben erscheint zuerst eine Vorschau. Ohne Vorschau wird nichts verschoben,
              und belegte Plätze werden nie überschrieben.
            </p>
            <div className="dialogActions" style={{flexWrap:'wrap'}}>
              <button type="button" className="btn" onClick={()=>{
                const f = balkenFrage;
                setBalkenFrage(null);
                onUpdateBar?.(f.barId, { ...f.vorher });
              }}>Abbrechen</button>
              <button type="button" className="btn" onClick={()=>setBalkenFrage(null)}>
                Nur Balken verschieben
              </button>
              <button type="button" className="btn primary" onClick={()=>{
                const f = balkenFrage;
                setBalkenFrage(null);
                onVerschiebeSequenz?.({
                  sequenceId: f.sequenceId,
                  wochen: f.wochen,
                  barId: f.barId,
                });
              }}>Sequenztermine mitverschieben…</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal.open && (
        <YearBarModal
          mode={modal.mode}
          bar={modal.bar}
          db={db}
          minDate={minDate}
          maxDate={maxDate}
          classGroupSuggestions={classGroupSuggestions}
          subjectSuggestions={subjectSuggestions}
          onHideClassGroupSuggestion={onHideClassGroupSuggestion}
          onHideSubjectSuggestion={onHideSubjectSuggestion}
          onClose={()=>setModal({ open:false, mode:'create', bar:null })}
          onSave={(payload)=>{
            if (modal.mode === 'create') {
              const id = onCreateBar?.(payload);
              if (id) setModal({ open:false, mode:'create', bar:null });
            } else {
              onUpdateBar?.(modal.bar.id, payload);
              setModal({ open:false, mode:'create', bar:null });
            }
          }}
          onDelete={()=>{
            if (modal.mode !== 'edit') return;
            onDeleteBar?.(modal.bar.id);
            setModal({ open:false, mode:'create', bar:null });
          }}
        />
      )}
    </div>
  );
}

function YearBarModal({ mode, bar, db, minDate, maxDate, classGroupSuggestions, subjectSuggestions, onHideClassGroupSuggestion, onHideSubjectSuggestion, onClose, onSave, onDelete }){
  const [local, setLocal] = useState(()=>({
    title: String(bar?.title || '').trim(),
    classGroup: String(bar?.classGroup || '').trim(),
    subject: String(bar?.subject || '').trim(),
    startISO: String(bar?.startISO || '').trim(),
    endISO: String(bar?.endISO || '').trim(),
    color: String(bar?.color || SEQ_COLORS[0]).trim(),
    sequenceId: String(bar?.sequenceId || '').trim(),
  }));

  /* Die Auswahl: passende Sequenzen zuerst, die übrigen darunter.
     Ausgeblendet wird nichts – aber eine unpassende Zuordnung wird
     benannt, damit sie nicht stillschweigend entsteht. */
  const auswahl = useMemo(
    ()=> auswahlSequenzen(db, { classGroup: local.classGroup, subject: local.subject }),
    [db, local.classGroup, local.subject],
  );
  const passende = auswahl.filter(a => a.passt);
  const uebrige = auswahl.filter(a => !a.passt);
  const gewaehlt = auswahl.find(a => a.id === local.sequenceId) || null;

  const canSave = Boolean((local.title || '').trim() && local.startISO && local.endISO && local.endISO >= local.startISO);

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:900}}>{mode === 'edit' ? 'Balken bearbeiten' : 'Balken hinzufügen'}</div>
            <div className="muted small">Nur Orientierung – wird nicht exportiert und beeinflusst keine Sequenzen.</div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        <div className="row wrap" style={{gap:10}}>
          <div style={{minWidth:280, flex:1}}>
            <label className="small muted">Titel</label>
            <input className="input" value={local.title} onChange={(e)=>setLocal(prev=>({ ...prev, title: e.target.value }))} placeholder="z. B. Bruchrechnung (Lektion 1–6)" />
          </div>
          <div style={{width:150}}>
            <label className="small muted">Farbe</label>
            <input className="input" type="color" value={local.color} onChange={(e)=>setLocal(prev=>({ ...prev, color: e.target.value }))} />
          </div>
        </div>

        <div style={{height:10}} />

        <div className="row wrap" style={{gap:10}}>
          <div className="grow" style={{minWidth:220}}>
            <label className="small muted">Klasse/Kurs (optional)</label>
            <ClassGroupInput
              value={local.classGroup}
              suggestions={classGroupSuggestions || []}
              onChange={(v)=>setLocal(prev=>({ ...prev, classGroup: v }))}
              onCommit={(v)=>setLocal(prev=>({ ...prev, classGroup: String(v||'') }))}
              onHideSuggestion={(v)=>onHideClassGroupSuggestion?.(v)}
            />
          </div>
          <div className="grow" style={{minWidth:220}}>
            <label className="small muted">Fach (optional)</label>
            <SubjectInput
              value={local.subject}
              suggestions={subjectSuggestions || []}
              onChange={(v)=>setLocal(prev=>({ ...prev, subject: v }))}
              onCommit={(v)=>setLocal(prev=>({ ...prev, subject: String(v||'') }))}
              onHideSuggestion={(v)=>onHideSubjectSuggestion?.(v)}
            />
          </div>
        </div>

        <div style={{height:10}} />

        <div className="row wrap" style={{gap:10}}>
          <div className="grow" style={{minWidth:280}}>
            <label className="small muted" htmlFor="yearBarSequence">Verknüpfte Sequenz (optional)</label>
            <select
              id="yearBarSequence"
              className="input"
              value={local.sequenceId}
              onChange={(e)=>setLocal(prev=>({ ...prev, sequenceId: e.target.value }))}
            >
              <option value="">Ohne Verknüpfung</option>
              {passende.length ? (
                <optgroup label="Passende Sequenzen">
                  {passende.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.termine ? ` (${a.termine} ${a.termine === 1 ? 'Termin' : 'Termine'})` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {uebrige.length ? (
                <optgroup label="Andere Lerngruppe oder anderes Fach">
                  {uebrige.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.gruppen?.[0] ? ` – ${[a.gruppen[0].classGroup, a.gruppen[0].subject].filter(Boolean).join(' · ')}` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {gewaehlt && !gewaehlt.passt ? (
              <div className="small" style={{color:'var(--warning)', marginTop:4}}>
                Diese Sequenz liegt in einer anderen Lerngruppe. Die Verknüpfung ist möglich –
                sie verschiebt aber nie von selbst Stunden.
              </div>
            ) : (
              <div className="muted small" style={{marginTop:4}}>
                Der Balken zeigt dann Name und Umfang der Sequenz. Die Sequenz selbst bleibt unberührt.
              </div>
            )}
          </div>
        </div>

        <div style={{height:10}} />

        <div className="row wrap" style={{gap:10}}>
          <div style={{width:190}}>
            <label className="small muted">Start</label>
            <input className="input" type="date" min={minDate} max={maxDate} value={local.startISO} onChange={(e)=>setLocal(prev=>({ ...prev, startISO: e.target.value }))} />
          </div>
          <div style={{width:190}}>
            <label className="small muted">Ende</label>
            <input className="input" type="date" min={minDate} max={maxDate} value={local.endISO} onChange={(e)=>setLocal(prev=>({ ...prev, endISO: e.target.value }))} />
          </div>
          <div className="muted small" style={{alignSelf:'flex-end', marginBottom:4}}>
            Tipp: Im Jahresplan kannst du Balken ziehen und an den Enden verlängern.
          </div>
        </div>

        <div style={{height:14}} />

        <div className="row" style={{justifyContent:'flex-end', gap:8}}>
          {mode === 'edit' ? <button className="btn danger" onClick={onDelete}>Löschen</button> : null}
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" disabled={!canSave} onClick={()=>onSave?.({
            title: local.title,
            classGroup: local.classGroup,
            subject: local.subject,
            startISO: local.startISO,
            endISO: local.endISO,
            color: local.color,
            sequenceId: local.sequenceId,
          })}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

/* --- Bibliothek: Sequenz-Vorlagen ------------------------------------

   Die Bibliothek ist kein Regal, sondern eine Auswahlhilfe. Deshalb
   sagt jede Karte, was sich hinter der Vorlage verbirgt: für wen sie
   gedacht ist, worauf sie hinausläuft, wie lange sie dauert. Alles
   davon ist optional – fehlt eine Angabe, entfällt die Zeile, und die
   Karte bleibt trotzdem vollständig benutzbar. */

/* Die Einheiten einer Vorlage als Liste: Nummer, Thema, Kompetenzen,
   Dauer. Dieselbe Rechnung für Karte und Vorschau. */
function vorlagenEinheiten(tpl){
  const lessons = Array.isArray(tpl?.lessons) ? tpl.lessons : [];
  return lessons.map((l, i)=>{
    const span = normalisiereBlockSpan(l?.blockSpan);
    const kompetenzen = [];
    const primaer = String(l?.primaryCompetency || '').trim();
    if (primaer) kompetenzen.push(primaer);
    for (const c of (Array.isArray(l?.competencies) ? l.competencies : [])){
      const t = String(c || '').trim();
      if (t && !kompetenzen.includes(t)) kompetenzen.push(t);
    }
    return {
      nummer: i + 1,
      titel: String(l?.topic || '').trim() || `Einheit ${i + 1}`,
      kompetenzen,
      span,
      minuten: span * TOTAL_MIN,
    };
  });
}

function VorlagenKarte({ tpl, onVorschau, onVerwenden, onBearbeiten, onLoeschen }){
  const stufe = stufenText(tpl);
  const ziel = zielhandlungText(tpl);
  const kompetenzen = Array.isArray(tpl.competencies) ? tpl.competencies : [];
  const beschreibung = String(tpl.description || '').trim();
  const produkt = String(tpl.targetProduct || '').trim();
  const bezug = String(tpl.courseRef || '').trim();

  return (
    <div className="templateCard">
      <div className="tplKopf">
        <div style={{minWidth:0}}>
          <div className="tplTitel">{tpl.name || 'Ohne Name'}</div>
          <div className="tplMeta">
            {[stufe, String(tpl.subject || '').trim()].filter(Boolean).join(' · ') || 'Ohne Angabe zur Lerngruppe'}
          </div>
        </div>
        <KebabMenu
          titel={`Aktionen für „${tpl.name || 'Vorlage'}“`}
          eintraege={[
            { label: 'Vorschau', icon: <Eye {...ICON_SM} />, onSelect: onVorschau },
            { label: 'Sequenz verwenden', icon: <Plus {...ICON_SM} />, onSelect: onVerwenden },
            { label: 'Angaben bearbeiten', icon: <Pencil {...ICON_SM} />, onSelect: onBearbeiten },
            { trenner: true },
            { label: 'Löschen', icon: <Trash2 {...ICON_SM} />, tone: 'danger', onSelect: onLoeschen },
          ]}
        />
      </div>

      {beschreibung ? <div className="tplMeta" style={{marginTop:8}}>{beschreibung}</div> : null}
      {ziel ? <div className="tplZiel">„{ziel}“</div> : null}

      {kompetenzen.length ? (
        <div className="tplZeile">
          {kompetenzen.slice(0, 4).map(k => <span key={k} className="pill">{k}</span>)}
          {kompetenzen.length > 4 ? <span className="pill">+{kompetenzen.length - 4}</span> : null}
        </div>
      ) : null}

      <div className="tplUmfang">{umfangText(tpl)}</div>
      {produkt ? <div className="tplProdukt">Zielprodukt: {produkt}</div> : null}
      {bezug ? <div className="tplProdukt">Bezug: {bezug}</div> : null}

      <div className="tplAktionen">
        <button className="btn" onClick={onVorschau}><Eye {...ICON_SM} /> Vorschau</button>
        <button className="btn primary" onClick={onVerwenden}>Sequenz verwenden</button>
      </div>

      <div className="muted small" style={{marginTop:10}}>
        {herkunftName(tpl.origin)} · Erstellt: {formatDateDE((tpl.createdAt||'').slice(0,10))}
      </div>
    </div>
  );
}

/* Die Detailvorschau. Sie zeigt nur – sie verändert die Vorlage nicht
   und setzt nichts ein. Wer sie einsetzen will, tut das ausdrücklich
   über "Sequenz verwenden". */
function VorlagenVorschau({ tpl, onClose, onVerwenden, onBearbeiten }){
  const einheiten = useMemo(()=>vorlagenEinheiten(tpl), [tpl]);
  const aufgabe = normalisiereAufgabe(tpl?.finalTask);
  const mittel = normalisiereMittel(tpl?.languageResources);
  const stufe = stufenText(tpl);
  const materialien = (Array.isArray(tpl?.lessons) ? tpl.lessons : [])
    .reduce((a, l)=> a + ((Array.isArray(l?.files) ? l.files.length : 0) + (Array.isArray(l?.links) ? l.links.length : 0)), 0);

  const zeile = (label, wert)=> (String(wert || '').trim()
    ? <div style={{marginTop:8}}><span className="muted small">{label}: </span>{wert}</div>
    : null);

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{maxWidth:820}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:900, fontSize:16}}>{tpl?.name || 'Vorlage'}</div>
            <div className="muted small">
              {[stufe, String(tpl?.subject || '').trim(), herkunftName(tpl?.origin)].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        {String(tpl?.description || '').trim() ? <p style={{margin:0}}>{tpl.description}</p> : null}

        <div className="tplUmfang" style={{marginTop:10}}>
          {umfangText(tpl)} · ca. {vorlagenUmfang(tpl).minuten} Minuten
        </div>

        {(Array.isArray(tpl?.competencies) && tpl.competencies.length) ? (
          <div className="tplZeile">
            {tpl.competencies.map(k => (
              <span key={k} className={`pill${k === tpl.primaryCompetency ? ' pill--primary' : ''}`}>{k}</span>
            ))}
          </div>
        ) : null}

        {!istLeereAufgabe(aufgabe) ? (
          <section className="zielaufgabe" style={{marginTop:12}}>
            <div className="zielaufgabeKopf">Kommunikative Zielhandlung</div>
            {aufgabe.text ? <p className="zielaufgabeText">{aufgabe.text}</p> : null}
            <div className="zielaufgabeDetails">
              {aufgabe.situation ? <div><span className="muted small">Situation: </span>{aufgabe.situation}</div> : null}
              {aufgabe.audience ? <div><span className="muted small">Adressat: </span>{aufgabe.audience}</div> : null}
              {aufgabe.intention ? <div><span className="muted small">Absicht: </span>{aufgabe.intention}</div> : null}
              {aufgabe.outcome ? <div><span className="muted small">Ergebnis: </span>{aufgabe.outcome}</div> : null}
            </div>
          </section>
        ) : null}

        {zeile('Zielprodukt', tpl?.targetProduct)}
        {zeile('Voraussetzungen', tpl?.prerequisites)}
        {zeile('Wortschatz', mittel.vocabulary)}
        {zeile('Grammatik', mittel.grammar)}
        {zeile('Aussprache', mittel.pronunciation)}
        {zeile('Weitere Mittel', mittel.other)}
        {zeile('Bezug', tpl?.courseRef)}
        {materialien ? zeile('Enthaltene Materialien', `${materialien} ${materialien === 1 ? 'Verweis' : 'Verweise'} (Dateien/Links)`) : null}

        <div style={{height:14}} />
        <div style={{fontWeight:800}}>Sequenzeinheiten</div>
        <div className="muted small">Die Reihenfolge, in der die Einheiten eingesetzt werden.</div>
        <div style={{marginTop:8}}>
          {einheiten.length === 0 ? (
            <div className="muted small">Diese Vorlage enthält noch keine Einheiten.</div>
          ) : einheiten.map(e => (
            <div key={e.nummer} className="tplEinheit">
              <div className="tplEinheitNr">{e.nummer}.</div>
              <div style={{minWidth:0}}>
                <div className="tplEinheitTitel">{e.titel}</div>
                {e.kompetenzen.length ? <div className="tplEinheitSub">{e.kompetenzen.join(' · ')}</div> : null}
              </div>
              <div className="tplEinheitDauer">
                {e.minuten} Min.{e.span > 1 ? ` · ${blockName(e.span)}` : ''}
              </div>
            </div>
          ))}
        </div>

        <div style={{height:14}} />
        <div className="row wrap" style={{justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={onBearbeiten}><Pencil {...ICON_SM} /> Angaben bearbeiten</button>
          <button className="btn primary" onClick={onVerwenden}>Sequenz verwenden</button>
        </div>
      </div>
    </div>
  );
}

/* Die beschreibenden Angaben einer Vorlage bearbeiten. Die Einheiten
   selbst bleiben unberührt – sie kommen aus der Sequenz, aus der die
   Vorlage entstanden ist. */
function VorlagenAngaben({ tpl, onClose, onSave }){
  const [local, setLocal] = useState(()=>({
    name: String(tpl?.name || ''),
    subject: String(tpl?.subject || ''),
    description: String(tpl?.description || ''),
    gradeLevel: String(tpl?.gradeLevel || ''),
    learningYear: String(tpl?.learningYear || ''),
    targetProduct: String(tpl?.targetProduct || ''),
    prerequisites: String(tpl?.prerequisites || ''),
    courseRef: String(tpl?.courseRef || ''),
    finalTask: normalisiereAufgabe(tpl?.finalTask),
  }));
  const setzen = (feld, wert)=> setLocal(prev => ({ ...prev, [feld]: wert }));

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{maxWidth:720}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:900}}>Angaben zur Vorlage</div>
            <div className="muted small">Hilft beim Auswählen. Die Einheiten der Vorlage ändern sich dadurch nicht.</div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        <div className="row wrap" style={{gap:10}}>
          <div style={{minWidth:260, flex:1}}>
            <label className="small muted">Titel</label>
            <input className="input" value={local.name} onChange={(e)=>setzen('name', e.target.value)} placeholder="z. B. Paris autrement" />
          </div>
          <div style={{minWidth:180, flex:1}}>
            <label className="small muted">Fach</label>
            <input className="input" value={local.subject} onChange={(e)=>setzen('subject', e.target.value)} placeholder="z. B. Französisch" />
          </div>
          <div style={{width:130}}>
            <label className="small muted">Klassenstufe</label>
            <input className="input" value={local.gradeLevel} onChange={(e)=>setzen('gradeLevel', e.target.value)} placeholder="z. B. 8" />
          </div>
          <div style={{width:130}}>
            <label className="small muted">Lernjahr</label>
            <input className="input" value={local.learningYear} onChange={(e)=>setzen('learningYear', e.target.value)} placeholder="z. B. 2" />
          </div>
        </div>

        <div style={{height:10}} />
        <label className="small muted">Kurze Beschreibung</label>
        <textarea className="input" rows={2} value={local.description}
                  onChange={(e)=>setzen('description', e.target.value)}
                  placeholder="Worum geht es in dieser Sequenz?" />

        <div style={{height:10}} />
        <CommunicativeTaskEditor
          wert={local.finalTask}
          onChange={(next)=>setzen('finalTask', next)}
          titel="Kommunikative Zielhandlung"
          hinweis="Worauf die Sequenz hinausläuft. Steht oben auf der Karte."
          platzhalter="z. B. Paris erkunden und Sehenswürdigkeiten für eine Klassenfahrt empfehlen."
        />

        <div style={{height:10}} />
        <div className="row wrap" style={{gap:10}}>
          <div style={{minWidth:220, flex:1}}>
            <label className="small muted">Zielprodukt</label>
            <input className="input" value={local.targetProduct} onChange={(e)=>setzen('targetProduct', e.target.value)} placeholder="z. B. Mini-Reiseführer" />
          </div>
          <div style={{minWidth:220, flex:1}}>
            <label className="small muted">Lehrwerks-/Themenbezug</label>
            <input className="input" value={local.courseRef} onChange={(e)=>setzen('courseRef', e.target.value)} placeholder="z. B. Découvertes 3, Unité 2" />
          </div>
        </div>

        <div style={{height:10}} />
        <label className="small muted">Voraussetzungen</label>
        <textarea className="input" rows={2} value={local.prerequisites}
                  onChange={(e)=>setzen('prerequisites', e.target.value)}
                  placeholder="Was sollten die Lernenden mitbringen?" />

        <div style={{height:14}} />
        <div className="row" style={{justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={()=>onSave(local)}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}

function SequenceLibraryView({
  db,
  templates,
  sequences,
  schoolCalendar,
  startVorschauId = '',
  minDate,
  maxDate,
  onCreateTemplateFromSequence,
  onUpdateTemplate,
  onDeleteTemplate,
  onExportTemplates,
  onImportTemplates,
  onInsert,
  classGroupSuggestions: classGroupSuggestionsProp,
  subjectSuggestions: subjectSuggestionsProp,
  onHideClassGroupSuggestion,
  onHideSubjectSuggestion
}){
  const list = useMemo(()=> {
    const arr = Object.values(templates || {});
    arr.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    return arr;
  }, [templates]);

  const seqList = useMemo(()=> {
    const arr = Object.values(sequences || {});
    arr.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    return arr;
  }, [sequences]);

  const groupSuggestionsLocal = useMemo(()=> {
    const set = new Set();
    for (const w of Object.values(db?.weeks || {})) {
      for (const raw of Object.values(w?.lessons || {})) {
        const g = (raw?.classGroup || '').trim();
        if (g) set.add(g);
      }
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [db]);

  const subjectSuggestionsLocal = useMemo(()=> {
    const set = new Set();
    for (const w of Object.values(db?.weeks || {})) {
      for (const raw of Object.values(w?.lessons || {})) {
        const s = (raw?.subject || '').trim();
        if (s) set.add(s);
      }
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [db]);

  const groupSuggestions = classGroupSuggestionsProp || groupSuggestionsLocal;
  const subjectSuggestions = subjectSuggestionsProp || subjectSuggestionsLocal;

  const [selectedSeqId, setSelectedSeqId] = useState(seqList?.[0]?.id || '');
  useEffect(()=>{
    if (!selectedSeqId && seqList.length) setSelectedSeqId(seqList[0].id);
  }, [seqList, selectedSeqId]);

  const [activeTemplate, setActiveTemplate] = useState(null);
  const [showInsert, setShowInsert] = useState(false);
  /* Kommt der Weg aus der Suche, ist die Vorschau schon gewählt: die
     Bibliothek öffnet sich dann direkt bei dieser Vorlage. */
  const [vorschauId, setVorschauId] = useState(String(startVorschauId || ''));
  useEffect(()=>{
    if (startVorschauId) setVorschauId(String(startVorschauId));
  }, [startVorschauId]);
  const [angabenId, setAngabenId] = useState('');

  /* --- Suchen und Filtern ------------------------------------------
     Die Auswahlmöglichkeiten kommen aus den vorhandenen Vorlagen. Was
     es nicht gibt, steht auch nicht zur Wahl. */
  const [suche, setSuche] = useState('');
  const [filterStufe, setFilterStufe] = useState('');
  const [filterKompetenz, setFilterKompetenz] = useState('');
  const [filterThema, setFilterThema] = useState('');
  const [filterUmfang, setFilterUmfang] = useState('');
  const [filterHerkunft, setFilterHerkunft] = useState('');

  const werte = useMemo(()=>{
    const stufen = new Set();
    const kompetenzen = new Set();
    const themen = new Set();
    const herkuenfte = new Set();
    for (const t of list){
      const st = String(t.gradeLevel || '').trim();
      if (st) stufen.add(st);
      for (const k of (Array.isArray(t.competencies) ? t.competencies : [])) kompetenzen.add(k);
      const f = String(t.subject || '').trim();
      if (f) themen.add(f);
      herkuenfte.add(String(t.origin || 'own'));
    }
    const sortiert = (set)=> Array.from(set).sort((a,b)=>a.localeCompare(b, 'de', { numeric: true }));
    return {
      stufen: sortiert(stufen),
      kompetenzen: sortiert(kompetenzen),
      themen: sortiert(themen),
      herkuenfte: sortiert(herkuenfte),
    };
  }, [list]);

  const UMFANG_STUFEN = [
    { id: 'kurz', label: 'bis 5 Unterrichtsstunden', passt: (n)=> n <= 5 },
    { id: 'mittel', label: '6–10 Unterrichtsstunden', passt: (n)=> n >= 6 && n <= 10 },
    { id: 'lang', label: 'mehr als 10 Unterrichtsstunden', passt: (n)=> n > 10 },
  ];

  const gefiltert = useMemo(()=>{
    const q = foldForSearch(String(suche || '').trim());
    return list.filter(t => {
      if (filterStufe && String(t.gradeLevel || '').trim() !== filterStufe) return false;
      if (filterKompetenz && !(Array.isArray(t.competencies) ? t.competencies : []).includes(filterKompetenz)) return false;
      if (filterThema && String(t.subject || '').trim() !== filterThema) return false;
      if (filterHerkunft && String(t.origin || 'own') !== filterHerkunft) return false;
      if (filterUmfang) {
        const stufe = UMFANG_STUFEN.find(u => u.id === filterUmfang);
        if (stufe && !stufe.passt(vorlagenUmfang(t).stunden)) return false;
      }
      if (!q) return true;
      const heuhaufen = foldForSearch([
        t.name, t.description, t.subject, t.targetProduct, t.courseRef,
        zielhandlungText(t),
        (Array.isArray(t.competencies) ? t.competencies.join(' ') : ''),
        (Array.isArray(t.lessons) ? t.lessons.map(l => l?.topic || '').join(' ') : ''),
      ].filter(Boolean).join(' '));
      return heuhaufen.includes(q);
    });
  }, [list, suche, filterStufe, filterKompetenz, filterThema, filterUmfang, filterHerkunft]);

  const filterAktiv = Boolean(suche || filterStufe || filterKompetenz || filterThema || filterUmfang || filterHerkunft);
  const filterZuruecksetzen = ()=>{
    setSuche(''); setFilterStufe(''); setFilterKompetenz('');
    setFilterThema(''); setFilterUmfang(''); setFilterHerkunft('');
  };

  const vorschau = vorschauId ? (templates?.[vorschauId] || null) : null;
  const angaben = angabenId ? (templates?.[angabenId] || null) : null;

  const verwenden = (t)=>{
    setVorschauId('');
    setAngabenId('');
    setActiveTemplate(t);
    setShowInsert(true);
  };

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Bibliothek – Sequenz‑Vorlagen</div>
          <div className="muted small">Vorlagen ansehen, vergleichen und als eigene, bearbeitbare Sequenz verwenden. Die Vorlage selbst bleibt dabei unverändert.</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <button className="btn" onClick={onImportTemplates}>Importieren…</button>
          <button className="btn" onClick={onExportTemplates}>Exportieren…</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="row wrap" style={{gap:8, alignItems:'flex-end'}}>
        <div style={{minWidth:280, flex:1}}>
          <label className="small muted">Vorlage aus bestehender Sequenz erstellen</label>
          <select className="input" value={selectedSeqId} onChange={(e)=>setSelectedSeqId(e.target.value)}>
            {seqList.length === 0 ? <option value="">(keine Sequenzen vorhanden)</option> : null}
            {seqList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button
          className="btn primary"
          disabled={!selectedSeqId || seqList.length === 0}
          onClick={()=>{ if (selectedSeqId) onCreateTemplateFromSequence(selectedSeqId); }}
        >Als Vorlage speichern</button>
      </div>

      <div style={{height:14}} />

      {list.length ? (
        <>
          <div className="tplFilter">
            <div style={{minWidth:220, flex:1}}>
              <label className="small muted">Suchen</label>
              <input className="input" value={suche} onChange={(e)=>setSuche(e.target.value)} placeholder="Titel, Thema, Zielprodukt…" />
            </div>
            {werte.stufen.length ? (
              <div>
                <label className="small muted">Klassenstufe</label>
                <select className="input" value={filterStufe} onChange={(e)=>setFilterStufe(e.target.value)}>
                  <option value="">alle</option>
                  {werte.stufen.map(v => <option key={v} value={v}>{/^\d+$/.test(v) ? `Klasse ${v}` : v}</option>)}
                </select>
              </div>
            ) : null}
            {werte.kompetenzen.length ? (
              <div>
                <label className="small muted">Kompetenz</label>
                <select className="input" value={filterKompetenz} onChange={(e)=>setFilterKompetenz(e.target.value)}>
                  <option value="">alle</option>
                  {werte.kompetenzen.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ) : null}
            {werte.themen.length ? (
              <div>
                <label className="small muted">Fach / Thema</label>
                <select className="input" value={filterThema} onChange={(e)=>setFilterThema(e.target.value)}>
                  <option value="">alle</option>
                  {werte.themen.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className="small muted">Umfang</label>
              <select className="input" value={filterUmfang} onChange={(e)=>setFilterUmfang(e.target.value)}>
                <option value="">alle</option>
                {UMFANG_STUFEN.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            {werte.herkuenfte.length > 1 ? (
              <div>
                <label className="small muted">Herkunft</label>
                <select className="input" value={filterHerkunft} onChange={(e)=>setFilterHerkunft(e.target.value)}>
                  <option value="">alle</option>
                  {werte.herkuenfte.map(v => <option key={v} value={v}>{herkunftName(v)}</option>)}
                </select>
              </div>
            ) : null}
            {filterAktiv ? (
              <button className="btn" onClick={filterZuruecksetzen}>Filter zurücksetzen</button>
            ) : null}
          </div>
          <div style={{height:6}} />
          <div className="muted small">
            {gefiltert.length === list.length
              ? `${list.length} ${list.length === 1 ? 'Vorlage' : 'Vorlagen'}`
              : `${gefiltert.length} von ${list.length} Vorlagen`}
          </div>
          <div style={{height:8}} />
        </>
      ) : null}

      <div className="templateGrid">
        {list.length === 0 ? (
          <EmptyState
            text="Vorlagen sind Sequenzen, die du wiederverwenden kannst – einmal geplant, in jedem Jahrgang wieder einsetzbar. Lege im Makro-Plan eine Sequenz an und speichere sie als Vorlage."
          />
        ) : gefiltert.length === 0 ? (
          <EmptyState
            text="Keine Vorlage passt zu dieser Auswahl."
            actionLabel="Filter zurücksetzen"
            onAction={filterZuruecksetzen}
          />
        ) : gefiltert.map(t => (
          <VorlagenKarte
            key={t.id}
            tpl={t}
            onVorschau={()=>setVorschauId(t.id)}
            onVerwenden={()=>verwenden(t)}
            onBearbeiten={()=>setAngabenId(t.id)}
            onLoeschen={()=>onDeleteTemplate(t.id)}
          />
        ))}
      </div>

      {vorschau ? (
        <VorlagenVorschau
          tpl={vorschau}
          onClose={()=>setVorschauId('')}
          onVerwenden={()=>verwenden(vorschau)}
          onBearbeiten={()=>{ setAngabenId(vorschau.id); setVorschauId(''); }}
        />
      ) : null}

      {angaben ? (
        <VorlagenAngaben
          tpl={angaben}
          onClose={()=>setAngabenId('')}
          onSave={(patch)=>{ onUpdateTemplate?.(angaben.id, patch); setAngabenId(''); }}
        />
      ) : null}

      {showInsert && activeTemplate && (
        <InsertTemplateModal
          template={activeTemplate}
          groupSuggestions={groupSuggestions}
          subjectSuggestions={subjectSuggestions}
          onHideGroupSuggestion={onHideClassGroupSuggestion}
          onHideSubjectSuggestion={onHideSubjectSuggestion}
          minDate={minDate}
          maxDate={maxDate}
          onClose={()=>{ setShowInsert(false); setActiveTemplate(null); }}
          onInsert={(payload)=>{ onInsert(payload); setShowInsert(false); setActiveTemplate(null); }}
        />
      )}
    </div>
  );
}

/* Eine Vorlage verwenden.

   "Verwenden" statt "Importieren": es entsteht immer eine eigene,
   bearbeitbare Sequenz – die Vorlage selbst wird dabei nie verändert.
   Das steht hier ausdrücklich, damit niemand raten muss. */
function InsertTemplateModal({ template, groupSuggestions, subjectSuggestions, minDate, maxDate, onHideGroupSuggestion, onHideSubjectSuggestion, onClose, onInsert }){
  const [targetGroup, setTargetGroup] = useState(groupSuggestions?.[0] || '');
  const [subject, setSubject] = useState((template?.subject || '').trim());
  const [startISO, setStartISO] = useState(toISODate(new Date()));
  const [overwrite, setOverwrite] = useState(false);
  const [sequenceName, setSequenceName] = useState((template?.name || '').trim());

  useEffect(()=>{
    // Clamp start date to school-year bounds if provided
    if (minDate && startISO < minDate) setStartISO(minDate);
    if (maxDate && startISO > maxDate) setStartISO(maxDate);
  }, [minDate, maxDate]);

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:900}}>Sequenz verwenden</div>
            <div className="muted small">
              „{template?.name || ''}“ · {umfangText(template)}
            </div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        <div className="row wrap" style={{gap:10}}>
          <div style={{minWidth:220, flex:1}}>
            <label className="small muted">Ziel‑Lerngruppe</label>
            <TypeaheadInput
              value={targetGroup}
              suggestions={groupSuggestions}
              onChange={setTargetGroup}
              onCommit={(v)=>setTargetGroup((v || '').toString())}
              onHideSuggestion={onHideGroupSuggestion}
              placeholder="z. B. 7a"
              wrapStyle={{width:'100%'}}
            />
          </div>
          <div style={{minWidth:220, flex:1}}>
            <label className="small muted">Fach</label>
            <TypeaheadInput
              value={subject}
              suggestions={subjectSuggestions}
              onChange={setSubject}
              onCommit={(v)=>setSubject((v || '').toString())}
              onHideSuggestion={onHideSubjectSuggestion}
              placeholder="z. B. Deutsch"
              wrapStyle={{width:'100%'}}
            />
          </div>
          <div style={{width:190}}>
            <label className="small muted">Startdatum</label>
            <input className="input" type="date" min={minDate} max={maxDate} value={startISO} onChange={(e)=>setStartISO(e.target.value)} />
          </div>
        </div>

        <div style={{height:10}} />

        <div className="row wrap" style={{gap:10, alignItems:'flex-end'}}>
          <div style={{minWidth:280, flex:1}}>
            <label className="small muted">Name der neuen Sequenz (eigene, bearbeitbare Kopie im Makro‑Plan)</label>
            <input className="input" value={sequenceName} onChange={(e)=>setSequenceName(e.target.value)} placeholder="z. B. Argumentieren – Kurzsequenz" />
          </div>
          <label className="row" style={{gap:8, userSelect:'none'}}>
            <input type="checkbox" checked={overwrite} onChange={(e)=>setOverwrite(e.target.checked)} />
            <span className="small muted">Bestehende Planung überschreiben</span>
          </label>
        </div>

        <div style={{height:10}} />
        <div className="muted small">
          Es entsteht eine eigene Sequenz für diese Lerngruppe. Die Vorlage bleibt unverändert und lässt sich beliebig oft weiterverwenden.
          Die App platziert die Einheiten automatisch in passende Stundenplätze (gleiche Lerngruppe + Fach) ab dem Startdatum;
          eine Doppelstunde bekommt zwei aufeinanderfolgende Plätze, sofern dort welche frei sind.
          Damit Räume übernommen werden können, sollte der Stundenplan in den Zielwochen bereits angelegt sein (Klasse/Fach/Raum). Danach kannst du Stunden flexibel löschen oder neue hinzufügen.
        </div>

        <div style={{height:14}} />

        <div className="row" style={{justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button
            className="btn primary"
            onClick={()=>onInsert({ templateId: template.id, targetGroup, subject, startISO, overwrite, sequenceName })}
          >Sequenz verwenden</button>
        </div>
      </div>
    </div>
  );
}

function SequenceManager({
  sequences,
  onDuplicate,
  onOpenVerlauf,
  onVerschieben,
  appSettings,
  onUpdateAppSettings,
  schoolCalendar,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onSaveAsTemplate,
  onExportPdfSequence,
  onExportDocxSequence,
  competencySuggestions = [],
  languageMode = false,
  competencyModel = null,
  benutzteKompetenzen = [],
  onRememberCompetency,
  onOpenProgression,
  afterCreate,
  autoCloseOnCreate = false,
}){
  const ui = useUi();
  /* Die Kompetenzen einer Sequenz stehen nicht dauerhaft in der Zeile –
     sie ist bereits dicht genug. Ein Klick klappt sie unter der Sequenz
     auf, immer nur für eine; ein zweiter schliesst sie wieder. */
  const [kompetenzSeqId, setKompetenzSeqId] = useState('');
  const [newName, setNewName] = useState('');
  const newNameRef = useRef(null);
  const canAdd = (newName || '').trim().length > 0;
  const list = Object.values(sequences || {}).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));

  useEffect(()=>{
    // Focus the input when opened (helps the "+ Neue Sequenz…" flow feel instant).
    const t = setTimeout(()=>{ try { newNameRef.current?.focus?.(); } catch {} }, 50);
    return ()=>{ try { clearTimeout(t); } catch {} };
  }, []);

  const [filesSeqId, setFilesSeqId] = useState(null);

  const openLibraryRoot = async () => {
    if (!capabilities.fileLibrary) return;
    const root = await platform.getLibraryRoot();
    if (!root) return;
    const res = await platform.openPath(root);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Ablage nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  const fileCopyOptIn = Boolean(appSettings?.fileCopyOptIn);
  const toggleFileCopyOptIn = () => {
    if (typeof onUpdateAppSettings === 'function') onUpdateAppSettings({ fileCopyOptIn: !fileCopyOptIn });
  };

  const schoolYearLabel = useMemo(()=>{
    try {
      const sy = schoolCalendar?.schoolYear || {};
      const s = String(sy.startISO || '').trim();
      const e = String(sy.endISO || '').trim();
      if (!s && !e) return '';
      const syYear = s ? fromISODate(s).getFullYear() : null;
      const eyYear = e ? fromISODate(e).getFullYear() : null;
      if (syYear && eyYear) {
        if (syYear === eyYear) return `Schuljahr ${syYear}`;
        return `Schuljahr ${syYear}/${String(eyYear).slice(-2)}`;
      }
      if (syYear) return `Schuljahr ab ${syYear}`;
      if (eyYear) return `Schuljahr bis ${eyYear}`;
      return '';
    } catch { return ''; }
  }, [schoolCalendar]);

  const openSeqFiles = (id) => setFilesSeqId(id);
  const closeSeqFiles = () => setFilesSeqId(null);

  const seq = filesSeqId ? sequences?.[filesSeqId] : null;
  const seqFiles = Array.isArray(seq?.files) ? seq.files : [];

  const addSeqFiles = async () => {
    if (!filesSeqId) return;
    if (!capabilities.fileAttachments) {
      ui.toast('Dateien anhängen ist nur in der Desktop-App verfügbar.', { tone: 'warning' });
      return;
    }
    const picked = await platform.pickFiles({ multi: true });
    if (!Array.isArray(picked) || picked.length === 0) return;

    let copiedMap = null; // Map<sourcePath, destPath>
    let mode = 'link';
    if (fileCopyOptIn && typeof platform.copyToLibrary === 'function') {
      try {
        const res = await platform.copyToLibrary({
          paths: picked,
          meta: {
            schoolYearLabel,
            sequenceName: seq?.name || '',
            contextLabel: 'Sequenzen'
          }
        });
        if (res?.files?.length) {
          copiedMap = new Map(res.files.map(r => [String(r.source||''), String(r.dest||'')]));
          mode = 'copy';
        }
        if (res?.errors?.length) {
          // Zeige nur eine knappe Meldung; Details bleiben in res.
          ui.toast(`${res.errors.length} Datei(en) konnten nicht kopiert werden.`, { tone: 'danger' });
        }
      } catch {}
    }

    const next = [...seqFiles];
    for (const p of picked) {
      const srcPath = String(p || '').trim();
      if (!srcPath) continue;
      const destPath = copiedMap ? (String(copiedMap.get(srcPath) || srcPath).trim()) : srcPath;
      if (!destPath) continue;
      // avoid duplicates
      const isDup = next.some(f => {
        const fp = String(f?.path || '').trim();
        const sp = String(f?.sourcePath || '').trim();
        return fp === destPath || (sp && sp === srcPath);
      });
      if (isDup) continue;
      next.push({
        id: uid(),
        name: fileNameFromPath(destPath),
        path: destPath,
        sourcePath: (mode === 'copy') ? srcPath : '',
        mode,
        addedAt: new Date().toISOString()
      });
    }
    onUpdate(filesSeqId, { files: next });
  };

  const removeSeqFile = (fileId) => {
    if (!filesSeqId) return;
    const next = seqFiles.filter(f => f?.id !== fileId);
    onUpdate(filesSeqId, { files: next });
  };

  const openFile = async (pathStr) => {
    if (!capabilities.openExternally) return;
    const res = await platform.openPath(pathStr);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Datei nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  const revealFile = async (pathStr) => {
    if (!capabilities.revealInFolder) return;
    const res = await platform.revealPath(pathStr);
    if (res && res.ok === false && res.error) ui.toast(`Konnte Ordner nicht öffnen: ${res.error}`, { tone: 'danger' });
  };

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:900}}>Sequenzen verwalten</div>
            <div className="muted small">Farben werden im Makro-Plan verwendet.</div>
          </div>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>

        <div style={{height:12}} />

        <div className="row wrap" style={{gap:8}}>
          <input
            className="input"
            style={{flex:1}}
            value={newName}
            ref={newNameRef}
            onChange={(e)=>setNewName(e.target.value)}
            onKeyDown={(e)=>{
              if (e.key === 'Enter' && canAdd) {
                const id = onCreate(newName);
                if (id) {
                  setNewName('');
                  try { afterCreate?.(id); } catch {}
                  if (autoCloseOnCreate) onClose?.();
                }
              }
            }}
            placeholder="Neue Sequenz (Name)"
          />
          <button
            className="btn primary"
            disabled={!canAdd}
            title={canAdd ? 'Sequenz anlegen' : 'Bitte erst einen Namen eingeben'}
            onClick={()=>{
              const id = onCreate(newName);
              if (id) {
                setNewName('');
                try { afterCreate?.(id); } catch {}
                if (autoCloseOnCreate) onClose?.();
              }
            }}
          >Hinzufügen</button>
        </div>

        <div style={{height:12}} />


        {filesSeqId && seq && (
          <div className="modalBackdrop" role="dialog" aria-modal="true">
            <div className="modal" style={{maxWidth:760}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div>
                  <div style={{fontWeight:900}}>Sequenz-Dateien</div>
                  <div className="muted small">{seq.name || 'Sequenz'}</div>
                  <div className="muted small">Hinweis: Standardmäßig werden nur lokale Dateipfade gespeichert. Optional kannst du die Dateien beim Hinzufügen in eine App-Ablage kopieren. Diese Liste wird nicht in PDF/Word-Exports übernommen.</div>
                </div>
                <button className="btn" onClick={closeSeqFiles}>Schließen</button>
              </div>

              <div style={{height:12}} />

              <div className="row wrap" style={{gap:8, alignItems:'center'}}>
                <button className="btn primary" onClick={addSeqFiles}>Dateien hinzufügen</button>
                <label className="row" style={{gap:8, userSelect:'none'}} title="Wenn aktiv, werden Dateien in einen App-eigenen Ordner kopiert (opt-in).">
                  <input type="checkbox" checked={fileCopyOptIn} onChange={toggleFileCopyOptIn} />
                  <span className="small muted">Dateien in App kopieren (opt‑in)</span>
                </label>
                {capabilities.fileLibrary ? (
                  <OeffnenKnopf onClick={openLibraryRoot} title="App-Ablage öffnen">Ablage öffnen</OeffnenKnopf>
                ) : null}
              </div>

              <div style={{height:12}} />

              {seqFiles.length === 0 ? (
                <EmptyState
                  text="Material, das für die ganze Sequenz gilt – nicht nur für eine einzelne Stunde."
                />
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {seqFiles.map(f => (
                    <div key={f.id} className="card" style={{padding:10}}>
                      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                        <div style={{minWidth:240}}>
                          <div className="row" style={{gap:8, alignItems:'center'}}>
                            <div style={{fontWeight:700}}>{f.name || fileNameFromPath(f.path)}</div>
                            {f.mode === 'copy' ? <span className="badge" title="In die App-Ablage kopiert">Kopie</span> : <span className="badge" title="Lokaler Verweis">Link</span>}
                          </div>
                          <div className="muted small" style={{wordBreak:'break-all'}}>{f.path}</div>
                          {f.sourcePath ? <div className="muted small" style={{wordBreak:'break-all'}}>Original: {f.sourcePath}</div> : null}
                        </div>
                        <div className="row wrap" style={{gap:8}}>
                          <button className="btn" onClick={()=>openFile(f.path)}>Öffnen</button>
                          {capabilities.revealInFolder ? (
                          <button className="btn" onClick={()=>revealFile(f.path)}>Im Ordner</button>
                        ) : null}
                          <button className="btn danger" onClick={()=>removeSeqFile(f.id)}>Entfernen</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="seqList">
          {list.length === 0 ? (
            <EmptyState
              text="Eine Sequenz fasst die Stunden zu einem Thema zusammen und zeigt dir, wo du darin stehst."
            />
          ) : list.map(s => (
          <React.Fragment key={s.id}>
            <div className="seqRow">
              <input
                type="color"
                value={s.color || SEQ_COLORS[0]}
                onChange={(e)=>onUpdate(s.id, { color: e.target.value })}
                title="Farbe"
              />
              <input
                className="input"
                value={s.name || ''}
                onChange={(e)=>onUpdate(s.id, { name: e.target.value })}
                placeholder="Sequenzname"
              />
              {/* Verwalten steht vorn, Exportieren liegt im Menü:
                  hier wird organisiert, nicht ausgegeben. */}
              <button className={`btn${kompetenzSeqId === s.id ? ' primary' : ''}`}
                      onClick={()=>setKompetenzSeqId(kompetenzSeqId === s.id ? '' : s.id)}
                      title="Schwerpunkt und Zielaufgabe der Sequenz – die Stunden dürfen davon abweichen">
                {languageMode ? 'Didaktik' : 'Kompetenzen'}{(s.competencies || []).length ? ` (${s.competencies.length})` : ''}
              </button>
              <KebabMenu
                titel={`Aktionen für „${s.name || 'Sequenz'}“`}
                eintraege={[
                  {
                    label: 'Öffnen',
                    icon: <ListTree {...ICON_SM} />,
                    title: 'Progression der Sequenz ansehen',
                    onSelect: ()=>onOpenProgression?.(s.id),
                  },
                  ...(typeof onVerschieben === 'function' ? [{
                    label: 'Termine verschieben…',
                    icon: <CalendarClock {...ICON_SM} />,
                    title: 'Die Termine dieser Sequenz auf andere Stundenplanplätze legen – mit Vorschau',
                    onSelect: ()=>onVerschieben(s.id),
                  }] : []),
                  {
                    label: 'Duplizieren',
                    icon: <Copy {...ICON_SM} />,
                    title: 'Eine Kopie dieser Sequenz anlegen (ohne Stunden)',
                    onSelect: ()=>onDuplicate?.(s.id),
                  },
                  {
                    label: 'Umbenennen',
                    icon: <Pencil {...ICON_SM} />,
                    onSelect: async ()=>{
                      const name = await ui.askInput({
                        title: 'Sequenz umbenennen',
                        label: 'Name der Sequenz',
                        initialValue: s.name || '',
                        confirmLabel: 'Umbenennen',
                      });
                      if (name) onUpdate(s.id, { name });
                    },
                  },
                  {
                    label: 'Als Vorlage speichern',
                    icon: <Library {...ICON_SM} />,
                    title: 'Sequenz als Vorlage für spätere Schuljahre speichern',
                    onSelect: ()=>onSaveAsTemplate?.(s.id),
                  },
                  ...(typeof onOpenVerlauf === 'function' ? [{
                    label: 'Versionsverlauf',
                    icon: <FileClock {...ICON_SM} />,
                    title: 'Frühere Fassungen dieser Sequenz und ihrer Stunden',
                    onSelect: ()=>onOpenVerlauf(s.id),
                  }] : []),
                  {
                    label: 'Dateien…',
                    icon: <FileText {...ICON_SM} />,
                    title: 'Dateien für diese Sequenz hinterlegen (nur Verweise, nicht exportiert)',
                    onSelect: ()=>openSeqFiles(s.id),
                  },
                  { trenner: true },
                  {
                    label: 'Exportieren',
                    unter: [
                      capabilities.docxExport ? {
                        label: 'Als Word-Datei',
                        icon: <FileText {...ICON_SM} />,
                        onSelect: ()=>onExportDocxSequence?.(s.id),
                      } : null,
                      capabilities.pdfExport ? {
                        label: 'Als PDF',
                        icon: <FileDown {...ICON_SM} />,
                        onSelect: ()=>onExportPdfSequence?.(s.id),
                      } : null,
                    ],
                  },
                  { trenner: true },
                  {
                    label: 'Löschen',
                    icon: <Trash2 {...ICON_SM} />,
                    tone: 'danger',
                    onSelect: ()=>onDelete(s.id),
                  },
                ]}
              />
            </div>
            {kompetenzSeqId === s.id ? (
              <div className="seqKompetenzen">
                {languageMode ? (
                  <>
                    <CommunicativeTaskEditor
                      wert={s.finalTask}
                      onChange={(next)=>onUpdate(s.id, { finalTask: next })}
                      titel="Kommunikative Zielaufgabe (Final Task)"
                      hinweis="Worauf die Sequenz hinausläuft. Erscheint über der Progressionsansicht."
                      platzhalter="z. B. Plant ein Wochenende für die Austauschschüler und begründet euer Programm."
                    />
                    <div style={{height:12}} />
                  </>
                ) : null}
                <p className="muted small" style={{margin:'0 0 8px'}}>
                  Schwerpunkt dieser Sequenz. Die einzelnen Stunden dürfen andere
                  Kompetenzen haben – die Sequenz gibt nichts vor.
                </p>
                <CompetencyEditor
                  competencies={Array.isArray(s.competencies) ? s.competencies : []}
                  primary={s.primaryCompetency || ''}
                  suggestions={competencySuggestions}
                  languageMode={languageMode}
                  modell={competencyModel}
                  benutzte={benutzteKompetenzen}
                  onChange={(nextComps, nextPrimary)=>{
                    onUpdate(s.id, { competencies: nextComps, primaryCompetency: nextPrimary });
                  }}
                  onRemember={(v)=>onRememberCompetency?.(v)}
                />
              </div>
            ) : null}
          </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}


/* `gesperrt`: im Archiv wird der Zeitstrahl nur gezeigt.

   Ein deaktiviertes <fieldset> erreicht das hier NICHT – gezogen wird
   an gewöhnlichen <div>s, und die kennen kein "disabled". Deshalb die
   ausdrückliche Angabe. */
function PhaseTimeline({ phases, onChange, startTime = '', gesamt = TOTAL_MIN, gesperrt = false }){
  /* Der Zeitstrahl zeigt den Rahmen der Stunde – 45 Minuten bei einer
     Einzelstunde, 90 bei einer Doppelstunde. Er wird nicht nach 45
     Minuten unterbrochen: Phasen dürfen über die Stundengrenze laufen. */
  const gesamtMin = Math.max(MIN_PHASE_MIN, Math.round(Number(gesamt) || TOTAL_MIN));
  const [drag, setDrag] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const bodyRef = useRef(null);

  const moveItem = (arr, from, to) => {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    const adjTo = to > from ? to - 1 : to;
    copy.splice(adjTo, 0, item);
    return copy;
  };

  const phaseLayout = useMemo(()=>{
    let offset = 0;
    return phases.map((p, idx)=>{
      const top = offset * PX_PER_MIN;
      const height = p.duration * PX_PER_MIN;
      offset += p.duration;
      return { idx, top, height };
    });
  }, [phases]);

  const phaseTimes = useMemo(()=>computePhaseTimes(phases, startTime), [phases, startTime]);

  const computeDropIndex = (clientY) => {
    const el = bodyRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    // insertion index in [0..len]
    for (let i = 0; i < phaseLayout.length; i++) {
      const mid = phaseLayout[i].top + phaseLayout[i].height / 2;
      if (y < mid) return i;
    }
    return phaseLayout.length;
  };

  useEffect(()=>{
    if (gesperrt) return;
    const onMove = (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      const deltaMin = Math.round(dy / PX_PER_MIN);
      if (deltaMin === drag.lastDelta) return;

      const i = drag.index;
      const a = phases[i];
      const b = phases[i+1];
      if (!a || !b) return;

      const newA = clamp(drag.startA + deltaMin, MIN_PHASE_MIN, drag.startA + (drag.startB - MIN_PHASE_MIN));
      const newB = drag.startA + drag.startB - newA;

      const next = phases.map((p, idx)=>{
        if (idx === i) return { ...p, duration: newA };
        if (idx === i+1) return { ...p, duration: newB };
        return p;
      });
      setDrag(prev => ({ ...prev, lastDelta: deltaMin }));
      onChange(next);
    };
    const onUp = () => {
      if (drag) setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return ()=>{
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, phases, onChange, gesperrt]);

  return (
    <div className="timeline">
      <div className="timelineHeader">
        <div style={{fontWeight:800}}>Zeitstrahl</div>
        <div className="muted small">{gesamtMin} Minuten</div>
      </div>
      <div
        className="timelineBody"
        style={{height: gesamtMin * PX_PER_MIN}}
        ref={bodyRef}
        onDragOver={(e)=>{
          if (gesperrt) return;
          // Allow drop
          if (drag) return; // while resizing, ignore dnd
          e.preventDefault();
          const di = computeDropIndex(e.clientY);
          if (di !== null) setDropIndex(di);
        }}
        onDragLeave={()=>setDropIndex(null)}
        onDrop={(e)=>{
          if (gesperrt || drag) return;
          e.preventDefault();
          const from = dragFrom ?? Number(e.dataTransfer.getData('text/plain'));
          const to = dropIndex ?? computeDropIndex(e.clientY);
          setDropIndex(null);
          setDragFrom(null);
          if (!Number.isFinite(from) || to === null) return;
          if (from < 0 || from >= phases.length) return;
          if (to === from || to === from + 1) return;
          const next = moveItem(phases, from, to);
          onChange(next);
        }}
      >
        {dropIndex !== null && (
          <div
            className="dropLine"
            style={{
              top: dropIndex >= phaseLayout.length
                ? gesamtMin * PX_PER_MIN - 1
                : Math.max(0, phaseLayout[dropIndex].top - 1)
            }}
          />
        )}
        {phaseLayout.map(({idx, top, height})=>{
          const p = phases[idx];
          return (
            <div
              key={p.id}
              className="phaseBlock"
              style={{ top, height }}
              title="Phase"
              draggable={!drag && !gesperrt}
              onDragStart={(e)=>{
                if (gesperrt || drag) return;
                setDragFrom(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragEnd={()=>{
                setDragFrom(null);
                setDropIndex(null);
              }}
            >
              <div className="phaseTitle">{p.title || `Phase ${idx+1}`}</div>
              <div className="phaseMeta">
                {phaseTimes?.[idx]?.start ? `${phaseTimes[idx].start} · ` : ''}{p.duration} min{p.socialForm ? ` · ${p.socialForm}` : ''}
              </div>
            </div>
          );
        })}

        {/* handles between phases */}
        {(gesperrt ? [] : phaseLayout.slice(0, -1)).map(({idx, top, height})=>{
          const y = top + height - 5;
          return (
            <div
              key={`h-${phases[idx].id}`}
              className="handle"
              style={{ top: y }}
              onPointerDown={(e)=>{
                e.preventDefault();
                const a = phases[idx].duration;
                const b = phases[idx+1].duration;
                setDrag({ index: idx, startY: e.clientY, startA: a, startB: b, lastDelta: 0 });
              }}
              title="Ziehen, um Minuten zu verschieben"
            >
              <div />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeaheadInput({
  value,
  suggestions,
  onChange,
  onCommit,
  onEnter,
  onHideSuggestion,
  placeholder,
  autoFocus,
  wrapStyle,
  inputStyle
}){
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);

  const items = useMemo(()=>{
    const all = Array.isArray(suggestions) ? suggestions : [];
    const q = (value || '').trim().toLowerCase();
    let list = all;
    if (q) {
      list = all.filter(s => (s || '').toLowerCase().includes(q));
      // Prefer prefix matches when typing.
      list = list.slice().sort((a,b)=>{
        const ap = (a || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bp = (b || '').toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return 0;
      });
    }
    return list.slice(0, 15);
  }, [suggestions, value]);

  const commit = (v) => {
    const next = (v || '').toString();
    onCommit?.(next);
  };

  const pick = (s) => {
    onChange?.(s);
    commit(s);
    setOpen(false);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(()=>setOpen(false), 120);
  };

  useEffect(()=>()=>{ if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <div className="typeaheadWrap" style={wrapStyle}>
      <input
        className="input"
        style={inputStyle}
        autoFocus={autoFocus}
        value={value}
        onChange={(e)=>{ onChange?.(e.target.value); }}
        onFocus={()=>{ setOpen(true); }}
        onBlur={()=>{ commit(value); scheduleClose(); }}
        onKeyDown={(e)=>{
          if (e.key === 'Enter') {
            e.preventDefault();
            if (onEnter) onEnter(value);
            else commit(value);
            setOpen(false);
          }
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
      />
      {open && items.length > 0 ? (
        <div className="typeaheadMenu" role="listbox">
          {items.map((s)=>{
            const label = String(s || '');
            return (
              <div key={label} className="typeaheadItem" role="option">
                <button
                  type="button"
                  className="typeaheadPick"
                  onMouseDown={(e)=>{ e.preventDefault(); pick(label); }}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="typeaheadRemove"
                  title="Vorschlag entfernen"
                  aria-label="Vorschlag entfernen"
                  onMouseDown={(e)=>{
                    e.preventDefault();
                    e.stopPropagation();
                    onHideSuggestion?.(label);
                  }}
                >
                  <X {...ICON_SM} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SocialFormInput({ value, suggestions, onChange, onCommit, onHideSuggestion }){
  return (
    <TypeaheadInput
      value={value}
      suggestions={suggestions}
      onChange={onChange}
      onCommit={onCommit}
      onHideSuggestion={onHideSuggestion}
      placeholder="z. B. Partnerarbeit"
    />
  );
}

function PhaseNameInput({ value, suggestions, onChange, onCommit, onHideSuggestion }){
  return (
    <TypeaheadInput
      value={value}
      suggestions={suggestions}
      onChange={onChange}
      onCommit={onCommit}
      onHideSuggestion={onHideSuggestion}
      placeholder="z. B. Einstieg"
    />
  );
}

// --- Rich text editor (bold / italic / underline / color) ---
// Stores HTML in the field. Plain text is auto-converted to HTML for display.
/* `gesperrt`: contentEditable kennt kein "disabled" – ein umgebendes
   <fieldset> hält hier nichts auf. Deshalb wird die Bearbeitbarkeit
   direkt abgeschaltet; lesen und kopieren bleibt möglich. */
function RichTextEditor({ value, onChange, placeholder = '', gesperrt = false }){
  const ref = useRef(null);
  const lastHtml = useRef('');
  const [focused, setFocused] = useState(false);
  // Toolbar is hidden by default; it opens/closes explicitly via the pen icon.
  const [toolsOpen, setToolsOpen] = useState(false);

  const normalizeForDisplay = (v) => {
    const s = String(v || '');
    if (!s.trim()) return '';
    if (isProbablyHtml(s)) return s;
    return escapeHtml(s).replaceAll('\n','<br/>');
  };

  useEffect(()=>{
    if (!ref.current) return;
    if (focused) return;
    const next = normalizeForDisplay(value);
    if (next !== lastHtml.current) {
      ref.current.innerHTML = next;
      lastHtml.current = next;
    }
  }, [value, focused]);

  const emit = () => {
    if (!ref.current) return;
    const html = normalizeRichForStorage((ref.current.innerHTML || '')).replace(/^<br\s*\/?>(\s*)$/i,'').trim();
    lastHtml.current = html;
    onChange?.(html);
  };

  const cmd = (command, val) => {
    if (!ref.current) return;
    ref.current.focus();
    try { document.execCommand(command, false, val); } catch {}
    emit();
  };

  const showTools = toolsOpen;

  return (
    <div className="rte">
      <button
        type="button"
        className={`rteToggle ${showTools ? 'active' : ''}`}
        title={showTools ? 'Formatleiste ausblenden' : 'Text formatieren'}
        aria-label={showTools ? 'Formatleiste ausblenden' : 'Text formatieren'}
        onMouseDown={(e)=>{
          e.preventDefault();
          // Toolbar toggeln (auf/zu)
          setToolsOpen(v => !v);
          // Fokus im Editor behalten
          try { ref.current?.focus(); } catch {}
        }}
      >
        <Pencil {...ICON_SM} />
      </button>

      {showTools ? (
        <div className="rteToolbar" role="toolbar" aria-label="Text formatieren">
          <button type="button" className="rteBtn" title="Fett" onMouseDown={(e)=>{ e.preventDefault(); cmd('bold'); }}><b>B</b></button>
          <button type="button" className="rteBtn" title="Kursiv" onMouseDown={(e)=>{ e.preventDefault(); cmd('italic'); }}><i>I</i></button>
          <button type="button" className="rteBtn" title="Unterstrichen" onMouseDown={(e)=>{ e.preventDefault(); cmd('underline'); }}><u>U</u></button>
          <span className="rteSep" />
          <label className="rteColorWrap" title="Schriftfarbe">
            <span className="rteColorDot" />
            <input
              className="rteColor"
              type="color"
              defaultValue={RTE_DEFAULT_INK}
              onChange={(e)=>cmd('foreColor', e.target.value)}
              onMouseDown={(e)=>e.stopPropagation()}
            />
          </label>
          <button type="button" className="rteBtn" title="Formatierung entfernen" onMouseDown={(e)=>{ e.preventDefault(); cmd('removeFormat'); }}>
            Tx
          </button>
        </div>
      ) : null}

      <div
        ref={ref}
        className="rteBody"
        contentEditable={!gesperrt}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={()=>setFocused(true)}
        onBlur={()=>{ setFocused(false); emit(); }}
        onInput={()=>emit()}
      />
    </div>
  );
}



function SubjectInput({ value, suggestions, onChange, onCommit, onHideSuggestion }){
  return (
    <TypeaheadInput
      value={value}
      suggestions={suggestions}
      onChange={onChange}
      onCommit={onCommit}
      onHideSuggestion={onHideSuggestion}
      placeholder="z. B. Mathe"
    />
  );
}

function ClassGroupInput({ value, suggestions, onChange, onCommit, onHideSuggestion }){
  return (
    <TypeaheadInput
      value={value}
      suggestions={suggestions}
      onChange={onChange}
      onCommit={onCommit}
      onHideSuggestion={onHideSuggestion}
      placeholder="z. B. 7a"
    />
  );
}

function SequenceSelect({ sequences, value, onChange, onCreate, onRequestCreateSequence }){
  const ui = useUi();
  const list = Object.values(sequences || {}).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  return (
    <select
      className="input"
      value={value || ''}
      onChange={(e)=>{
        const v = e.target.value;
        if (v === '__new__') {
          // Open the same Sequenz-Manager window as in the Makro-Ansicht.
          if (typeof onRequestCreateSequence === 'function') {
            onRequestCreateSequence((createdId)=>{
              if (createdId) onChange?.(createdId);
            }, { autoCloseOnCreate: true });
            return;
          }
          // Rückfallweg, falls kein Sequenz-Manager gereicht wurde.
          ui.askInput({
            title: 'Neue Unterrichtssequenz',
            label: 'Name der Sequenz',
            placeholder: 'z. B. Le passé composé',
            confirmLabel: 'Sequenz anlegen',
          }).then((name)=>{
            if (!name || !onCreate) return;
            const createdId = onCreate(name);
            if (createdId) onChange?.(createdId);
          });
          return;
        }
        onChange?.(v);
      }}
    >
      <option value="">— keine Sequenz —</option>
      {list.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
      <option value="__new__">+ Neue Sequenz…</option>
    </select>
  );
}

function CompetencyPrimaryInput({ value, suggestions, onChange, onCommit, onHideSuggestion }){
  return (
    <TypeaheadInput
      value={value}
      suggestions={suggestions}
      onChange={onChange}
      onCommit={onCommit}
      onHideSuggestion={onHideSuggestion}
      placeholder="z. B. Argumentieren, Modellieren ..."
      wrapStyle={{width:'100%'}}
    />
  );
}


/* ============================================================
   Erfolgskriterien

   Woran ist erkennbar, dass die Lernenden das Ziel erreicht haben? Eine
   Liste von Sätzen, sonst nichts – ausdrücklich kein Bewertungsraster:
   keine Punkte, keine Stufen, kein "erreicht / nicht erreicht". Es sind
   Planungskriterien, keine Urteile.

   Bewusst NICHT unter der fremdsprachlichen Planung: die Frage ist
   fachunabhängig, und die App gilt weiterhin für jedes Fach. Die
   Kriterien sind deshalb auch bei abgeschaltetem Fremdsprachenmodus
   erreichbar.

   Die App kennt ein Lernziel-FELD, keine Lernziel-LISTE (objectives ist
   ein Freitext mit mehreren Zeilen). Eine Zuordnung "Kriterien je Ziel"
   hätte deshalb kein Ziel, an dem sie hängen könnte. Die Kriterien
   gehören darum zur Stunde – so wie die Lernziele selbst.
   ============================================================ */
function SuccessCriteriaEditor({ id, kriterien, onChange }){
  const liste = Array.isArray(kriterien) ? kriterien : [];
  // Aufgeklappt, sobald etwas drinsteht – sonst versteckte Inhalte.
  const [offen, setOffen] = useState(liste.length > 0);

  const setzen = (i, wert)=> onChange(liste.map((k, j)=> j === i ? wert : k));
  const entfernen = (i)=> onChange(liste.filter((_, j)=> j !== i));
  const ergaenzen = ()=>{ setOffen(true); onChange([...liste, '']); };

  if (!offen) {
    return (
      <button type="button" id={id} className="btn btnLeise" onClick={ergaenzen}>
        <Plus {...ICON_SM} /> Erfolgskriterien
      </button>
    );
  }

  return (
    <div id={id} className="kriterienBox">
      <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
        <div>
          <div className="kriterienTitel">Erfolgskriterien</div>
          <div className="muted small">Woran ist erkennbar, dass das Ziel erreicht ist?</div>
        </div>
        {liste.length === 0 ? (
          <button className="btn btnLeise" onClick={()=>setOffen(false)}>Ausblenden</button>
        ) : null}
      </div>

      <div style={{height:8}} />

      {liste.map((k, i)=>(
        <div key={i} className="kriterienZeile">
          <span className="kriterienPunkt" aria-hidden="true">·</span>
          <input
            className="input"
            value={k}
            autoFocus={i === liste.length - 1 && !k}
            onChange={(e)=>setzen(i, e.target.value)}
            onKeyDown={(e)=>{
              if (e.key === 'Enter') { e.preventDefault(); ergaenzen(); }
            }}
            placeholder="z. B. mindestens zwei Vorschläge formulieren"
          />
          <button className="btn btnMini" onClick={()=>entfernen(i)}
                  title="Kriterium entfernen" aria-label={`Kriterium ${i + 1} entfernen`}>
            <X {...ICON_SM} />
          </button>
        </div>
      ))}

      <button className="btn btnLeise" onClick={ergaenzen} style={{marginTop:6}}>
        <Plus {...ICON_SM} /> Kriterium
      </button>
    </div>
  );
}

/* ============================================================
   Kommunikative Aufgabe

   Was sollen die Lernenden mit der Sprache tatsächlich tun? Ein Satz
   genügt. Die vier Detailfelder sind für die, die genauer planen
   wollen – nichts davon ist Pflicht, nichts wird angemahnt.

   Dieselbe Form trägt die Zielaufgabe einer Sequenz; nur die
   Beschriftungen unterscheiden sich.
   ============================================================ */
function CommunicativeTaskEditor({ wert, onChange, titel, hinweis, platzhalter }){
  const a = normalisiereAufgabe(wert);
  const [details, setDetails] = useState(hatAufgabenDetails(a));
  const setzen = (feld, v)=> onChange({ ...a, [feld]: v });

  return (
    <div className="aufgabeBox">
      <div className="small muted">{titel}</div>
      <textarea
        className="aufgabeText"
        value={a.text}
        onChange={(e)=>setzen('text', e.target.value)}
        placeholder={platzhalter}
      />
      {hinweis ? <div className="muted small">{hinweis}</div> : null}

      <button type="button" className="btn btnLeise" onClick={()=>setDetails(v => !v)}
              aria-expanded={details} style={{marginTop:6}}>
        {details ? <ChevronDown {...ICON_SM} /> : <ChevronRight {...ICON_SM} />} Details
      </button>

      {details ? (
        <div className="aufgabeDetails">
          <div>
            <label className="small muted">Situation / Kontext</label>
            <input className="input" value={a.situation} onChange={(e)=>setzen('situation', e.target.value)}
                   placeholder="z. B. während des Austausches, ein freier Nachmittag" />
          </div>
          <div>
            <label className="small muted">Adressat / Kommunikationspartner</label>
            <input className="input" value={a.audience} onChange={(e)=>setzen('audience', e.target.value)}
                   placeholder="z. B. die Austauschpartner" />
          </div>
          <div>
            <label className="small muted">Kommunikative Absicht</label>
            <input className="input" value={a.intention} onChange={(e)=>setzen('intention', e.target.value)}
                   placeholder="z. B. vorschlagen, reagieren, aushandeln" />
          </div>
          <div>
            <label className="small muted">Ergebnis / Produkt</label>
            <input className="input" value={a.outcome} onChange={(e)=>setzen('outcome', e.target.value)}
                   placeholder="z. B. ein gemeinsamer Nachmittagsplan" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Sprachhandeln & sprachliche Mittel

   Sprechabsichten sind Etiketten wie Kompetenzen: die Bezeichnung ist
   die Identität, eigene liegen in derselben Merk-Ablage, und eine
   Stunde verliert nichts, wenn ein Eintrag später aus der Auswahl
   genommen wird.

   Die sprachlichen Mittel bleiben absichtlich vier Freitextfelder. Ein
   Grammatik- oder Wortschatzkatalog wäre für jede Sprache ein eigenes
   Projekt und im Alltag langsamer als Tippen.
   ============================================================ */
function SpeechActEditor({
  ausgewaehlt, vorrat, onChange, onRemember, onHideSuggestion,
  mittel, onChangeMittel,
}){
  const [draft, setDraft] = useState('');
  const [suche, setSuche] = useState('');
  const liste = normalisiereSprechabsichten(ausgewaehlt);
  const m = normalisiereMittel(mittel);

  /* Startbestand plus alles je Benutzte plus das, was in dieser Stunde
     steht – Letzteres, damit ein aus der Auswahl genommener Eintrag
     hier abwählbar bleibt. */
  const alle = useMemo(()=>{
    const set = new Set([...SPRECHABSICHTEN, ...(vorrat || []), ...liste]);
    return [...set].filter(Boolean);
  }, [vorrat, liste]);

  const zeigeSuche = alle.length >= 34;   // Startbestand sind 27
  const gefiltert = useMemo(()=>{
    const q = suche.trim().toLowerCase();
    if (!zeigeSuche || !q) return alle;
    return alle.filter(x => x.toLowerCase().includes(q));
  }, [alle, suche, zeigeSuche]);

  const umschalten = (v)=>{
    if (liste.includes(v)) onChange(liste.filter(x => x !== v));
    else { onRemember?.(v); onChange([...liste, v]); }
  };
  const ergaenzen = (roh)=>{
    const v = String(roh || '').trim();
    if (!v) return;
    onRemember?.(v);
    if (!liste.includes(v)) onChange([...liste, v]);
    setDraft('');
  };

  const feld = (schluessel, beschriftung, platzhalter)=>(
    <div>
      <label className="small muted">{beschriftung}</label>
      <input className="input" value={m[schluessel]}
             onChange={(e)=>onChangeMittel({ ...m, [schluessel]: e.target.value })}
             placeholder={platzhalter} />
    </div>
  );

  return (
    <div className="sprachBox">
      <div className="small muted">Sprechabsichten / kommunikative Funktionen</div>
      {zeigeSuche ? (
        <input className="input kompetenzSuche" value={suche} onChange={(e)=>setSuche(e.target.value)}
               placeholder="Sprechabsicht suchen…" aria-label="Sprechabsicht suchen" />
      ) : null}
      <div className="kompetenzWahlListe" style={{marginTop:6}}>
        {gefiltert.length === 0 ? (
          <span className="muted small">Keine Sprechabsicht gefunden.</span>
        ) : gefiltert.map((v)=>(
          <label key={v} className={`kompetenzWahlEintrag${liste.includes(v) ? ' is-active' : ''}`}>
            <input type="checkbox" checked={liste.includes(v)} onChange={()=>umschalten(v)} />
            <span>{v}</span>
          </label>
        ))}
      </div>

      <div className="kompetenzEigene" style={{marginTop:10}}>
        <div className="small muted">Eigene Sprechabsicht</div>
        <div className="row" style={{gap:8}}>
          <TypeaheadInput
            value={draft}
            suggestions={vorrat || []}
            onChange={setDraft}
            onCommit={(v)=>setDraft((v || '').toString())}
            onEnter={(v)=>ergaenzen(v)}
            onHideSuggestion={onHideSuggestion}
            placeholder="z. B. Gesprächspartner zum Weiterreden animieren"
            wrapStyle={{flex:1}}
          />
          <button className="btn" onClick={()=>ergaenzen(draft)} disabled={!draft.trim()}>Hinzufügen</button>
        </div>
      </div>

      <div className="sprachMittel">
        <div className="small muted" style={{gridColumn:'1 / -1'}}>Sprachliche Mittel</div>
        {feld('vocabulary', 'Wortschatz', 'z. B. Freizeitaktivitäten, Zeitangaben')}
        {feld('grammar', 'Grammatik / Strukturen', 'z. B. futur composé, on pourrait…')}
        {feld('pronunciation', 'Aussprache / Phonologie', 'z. B. Intonation bei Rückfragen; liaison')}
        {feld('other', 'Weitere sprachliche Mittel', 'z. B. Gesprächsfüller, Konnektoren')}
      </div>
    </div>
  );
}

/* ============================================================
   Hilfen / Scaffolds an einer Phase

   Sie hängen an der Phase, die es ohnehin gibt – es entsteht keine
   zweite Phasenstruktur.

   Zur vorhandenen Hilfekarte: die ist etwas anderes. Sie zeigt feste
   Leitfragen zum Phasennamen ("Wie werden die Lernenden aktiviert?")
   und speichert nichts. Sie ist kein Bibliotheksmechanismus und taugt
   deshalb nicht als Grundlage für die Hilfen einer konkreten Stunde.
   Beide stehen nebeneinander in derselben Zeile: die Karte fragt, die
   Hilfen antworten.

   Wiederverwendbar sind die Hilfen trotzdem – über dieselbe
   Merk-Ablage wie Kompetenzen und Sprechabsichten. Eine dritte
   Bibliotheksarchitektur kommt nicht hinzu.
   ============================================================ */
function PhaseScaffolds({ scaffolds, vorschlaege, onChange, onRemember, onHideSuggestion }){
  const liste = Array.isArray(scaffolds) ? scaffolds : [];
  const [offen, setOffen] = useState(liste.length > 0);

  const setzen = (id, patch)=> onChange(liste.map(sc => sc.id === id ? { ...sc, ...patch } : sc));
  const entfernen = (id)=> onChange(liste.filter(sc => sc.id !== id));
  const ergaenzen = ()=>{
    setOffen(true);
    onChange([...liste, {
      id: uid(), type: SCAFFOLD_ART_STANDARD, label: '', note: '', supportLevel: '', fadeOut: false,
    }]);
  };

  if (!offen) {
    return (
      <button type="button" className="btn btnLeise" onClick={ergaenzen}>
        <Plus {...ICON_SM} /> Hilfen
      </button>
    );
  }

  return (
    <div className="scaffoldBox">
      <div className="row" style={{justifyContent:'space-between', alignItems:'baseline'}}>
        <div className="small muted">Hilfen / Scaffolds</div>
        {liste.length === 0 ? (
          <button className="btn btnLeise" onClick={()=>setOffen(false)}>Ausblenden</button>
        ) : null}
      </div>

      {liste.map((sc)=>(
        <div key={sc.id} className="scaffoldZeile">
          <select className="input scaffoldArt" value={sc.type}
                  aria-label="Art der Hilfe"
                  onChange={(e)=>setzen(sc.id, { type: e.target.value })}>
            {SCAFFOLD_ARTEN.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <TypeaheadInput
            value={sc.label}
            suggestions={vorschlaege || []}
            onChange={(v)=>setzen(sc.id, { label: v })}
            onCommit={(v)=>{ setzen(sc.id, { label: v }); onRemember?.(v); }}
            onHideSuggestion={onHideSuggestion}
            placeholder="z. B. Redemittelkarte Vorschläge"
            wrapStyle={{flex:1, minWidth:160}}
          />

          <input className="input scaffoldNotiz" value={sc.note}
                 aria-label="Notiz zur Hilfe"
                 onChange={(e)=>setzen(sc.id, { note: e.target.value })}
                 placeholder="Notiz, z. B. on pourrait…, pourquoi pas…" />

          {/* Beides freiwillig: die App leitet daraus nichts ab. */}
          <select className="input scaffoldStufe" value={sc.supportLevel}
                  aria-label="Unterstützungsniveau"
                  onChange={(e)=>setzen(sc.id, { supportLevel: e.target.value })}>
            <option value="">Niveau –</option>
            {UNTERSTUETZUNGSSTUFEN.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>

          <button type="button"
                  className={`btn btnMini${sc.fadeOut ? ' primary' : ''}`}
                  aria-pressed={sc.fadeOut}
                  title="Kennzeichnen, dass diese Unterstützung hier bewusst zurückgenommen wird"
                  onClick={()=>setzen(sc.id, { fadeOut: !sc.fadeOut })}>
            <ArrowDown {...ICON_SM} />
          </button>

          <button className="btn btnMini" onClick={()=>entfernen(sc.id)}
                  title="Hilfe entfernen" aria-label="Hilfe entfernen">
            <X {...ICON_SM} />
          </button>
        </div>
      ))}

      <button className="btn btnLeise" onClick={ergaenzen} style={{marginTop:6}}>
        <Plus {...ICON_SM} /> Hilfe
      </button>
    </div>
  );
}

/* Ab so vielen auswählbaren Kompetenzen erscheint die Suche. Der
   Systemkatalog allein bleibt darunter – die Suche kommt also erst,
   wenn eigene Einträge die Liste tatsächlich haben wachsen lassen. */
/* ============================================================
   Planungsprofile und Exportlayouts – die Bausteine

   Ein Feld, eine Feldliste, eine Auswahl. Dieselben drei Bausteine
   tragen die Sichtbarkeit in der Phasenplanung UND die Spalten im
   Export; es gibt keine zweite Fassung davon für den Export.
   ============================================================ */

/* Eine zusätzliche Angabe zur Phase. Welche Eingabeart es wird, steht
   in der Registry – hier wird sie nur ausgeführt. */
function PhasenFeld({ feld, wert, onChange, ausserhalbDesProfils = false, gesperrt = false }){
  const beschriftung = (
    <label className="small muted">
      {feld.label}
      {ausserhalbDesProfils ? (
        <span className="feldFremd" title="Dieses Feld gehört nicht zum gewählten Planungsprofil, enthält aber bereits eine Angabe. Sie bleibt gespeichert.">
          ausserhalb des Profils
        </span>
      ) : null}
    </label>
  );

  if (feld.eingabe === 'rich') {
    return (
      <div className="phasenFeld phasenFeld--breit">
        {beschriftung}
        <RichTextEditor value={wert || ''} onChange={onChange} placeholder={feld.platzhalter || ''} gesperrt={gesperrt} />
      </div>
    );
  }
  return (
    <div className="phasenFeld">
      {beschriftung}
      <input className="input" value={wert || ''} placeholder={feld.platzhalter || ''}
             onChange={(e)=>onChange(e.target.value)} />
    </div>
  );
}

/* Sichtbarkeit und Reihenfolge einer Feldliste.

   Wird zweimal benutzt: für das benutzerdefinierte Planungsprofil (nur
   Häkchen und Reihenfolge) und für das benutzerdefinierte Exportlayout
   (zusätzlich Breite und eigene Spaltenüberschrift). Deshalb sind
   Breiten und Bezeichnungen optional – fehlen die Rückrufe, erscheinen
   die Spalten schlicht nicht.

   Ziehen ordnet um; die Pfeiltasten daneben tun dasselbe ohne Maus. */
function FeldListeEditor({ ausgewaehlt, onChange, breiten = null, onChangeBreite = null,
                           bezeichnungen = null, onChangeBezeichnung = null }){
  const [gezogen, setGezogen] = useState(-1);
  const gewaehlt = normalisiereFeldListe(ausgewaehlt);
  const rest = PLANUNGSFELDER.map(f => f.id).filter(id => !gewaehlt.includes(id));
  const reihen = [...gewaehlt, ...rest];

  const umschalten = (id) => {
    const feld = feldDefinition(id);
    if (feld?.pflicht) return;
    if (gewaehlt.includes(id)) onChange(gewaehlt.filter(x => x !== id));
    else onChange([...gewaehlt, id]);
  };

  const verschieben = (id, delta) => {
    const i = gewaehlt.indexOf(id);
    const ziel = i + delta;
    if (i < 0 || ziel < 0 || ziel >= gewaehlt.length) return;
    const next = [...gewaehlt];
    next.splice(ziel, 0, next.splice(i, 1)[0]);
    onChange(next);
  };

  const ablegen = (zielId) => {
    if (gezogen < 0) return;
    const quelleId = gewaehlt[gezogen];
    setGezogen(-1);
    if (!quelleId || quelleId === zielId) return;
    const ziel = gewaehlt.indexOf(zielId);
    if (ziel < 0) return;
    const next = gewaehlt.filter(x => x !== quelleId);
    next.splice(ziel, 0, quelleId);
    onChange(next);
  };

  return (
    <div className="feldListe">
      {reihen.map((id)=>{
        const feld = feldDefinition(id);
        if (!feld) return null;
        const an = gewaehlt.includes(id);
        const pos = gewaehlt.indexOf(id);
        return (
          <div key={id}
               className={`feldZeile${an ? '' : ' feldZeile--aus'}`}
               draggable={an}
               onDragStart={()=>setGezogen(pos)}
               onDragOver={(e)=>{ if (an && gezogen >= 0) e.preventDefault(); }}
               onDrop={(e)=>{ e.preventDefault(); ablegen(id); }}
               onDragEnd={()=>setGezogen(-1)}>
            <span className="feldGriff" aria-hidden="true">{an ? '☰' : ''}</span>
            <label className="feldName">
              <input type="checkbox" checked={an} disabled={Boolean(feld.pflicht)}
                     onChange={()=>umschalten(id)} />
              <span>{feld.label}</span>
              {feld.pflicht ? <span className="muted small">(immer dabei)</span> : null}
            </label>

            {(an && onChangeBezeichnung) ? (
              <input className="input feldLabelEingabe"
                     value={bezeichnungen?.[id] ?? ''}
                     placeholder={feld.kurz}
                     title="Eigene Spaltenüberschrift"
                     onChange={(e)=>onChangeBezeichnung(id, e.target.value)} />
            ) : null}

            {(an && onChangeBreite) ? (
              <span className="feldBreite" title="Richtwert der Spaltenbreite">
                <input className="input" type="number" min="4" max="60"
                       value={breiten?.[id] ?? feld.breite}
                       onChange={(e)=>onChangeBreite(id, e.target.value)} />
              </span>
            ) : null}

            <span className="feldPfeile">
              <button type="button" className="btn btnMini" disabled={!an || pos <= 0}
                      title="Nach oben" aria-label={`${feld.label} nach oben`}
                      onClick={()=>verschieben(id, -1)}>↑</button>
              <button type="button" className="btn btnMini" disabled={!an || pos < 0 || pos >= gewaehlt.length - 1}
                      title="Nach unten" aria-label={`${feld.label} nach unten`}
                      onClick={()=>verschieben(id, 1)}>↓</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Die Auswahl des Planungsprofils. Gut erreichbar, aber ruhig: ein
   Auswahlfeld neben "+ Phase", kein eigener Bereich. */
function PlanungsprofilWahl({ profil, eigeneFelder, onChangeProfil, onChangeFelder }){
  const [offen, setOffen] = useState(false);
  const istEigen = profil === 'eigenes';
  return (
    <>
      <label className="profilWahl" title="Bestimmt, welche Angaben in der Phasenplanung erscheinen. Gespeicherte Angaben bleiben in jedem Fall erhalten.">
        <span className="small muted">Planungsprofil</span>
        <select value={profil} onChange={(e)=>onChangeProfil(e.target.value)}>
          {PLANUNGSPROFILE.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
        </select>
      </label>
      {istEigen ? (
        <button className="btn btnLeise" onClick={()=>setOffen(true)}>
          <Settings {...ICON_SM} /> Felder wählen
        </button>
      ) : null}

      {offen ? (
        <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) setOffen(false); }}>
          <div className="modalCard modalCard--breit" role="dialog" aria-modal="true" aria-label="Felder der Phasenplanung"
               onKeyDown={(e)=>{ if (e.key === 'Escape') setOffen(false); }}>
            <h3 className="dialogTitle">Felder der Phasenplanung</h3>
            <p className="dialogBody" style={{marginTop:0}}>
              Häkchen bestimmen die Sichtbarkeit, Ziehen die Reihenfolge. Abgewählte
              Felder werden nur ausgeblendet – bereits eingetragene Angaben bleiben
              gespeichert und weiterhin exportierbar.
            </p>
            <FeldListeEditor ausgewaehlt={eigeneFelder} onChange={onChangeFelder} />
            <div className="dialogActions">
              <button className="btn primary" onClick={()=>setOffen(false)}>Fertig</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* Der Exportdialog.

   Er prüft, er blockiert nicht. Die Prüfung stellt genau eine Frage je
   Spalte: steht in dieser Phase etwas? Sie beurteilt ausdrücklich
   NICHT, ob das Eingetragene fachlich gut ist – kein Score, keine Note,
   keine automatische Bewertung. Der Export ist in jedem Zustand
   möglich, auch mit vollständig leeren Angaben. */
function ExportLayoutDialog({ offen, ziel, phasen, layout, eigenesLayout,
                              onChangeLayout, onChangeEigenesLayout,
                              onExport, onClose, onSpringeZuPhase }){
  const [spaltenOffen, setSpaltenOffen] = useState(false);
  useEffect(()=>{ if (offen) setSpaltenOffen(layout === 'eigenes'); }, [offen, layout]);
  if (!offen) return null;

  const eigen = normalisiereEigenesLayout(eigenesLayout);
  const pruefung = exportPruefung(layout, phasen, { eigenesLayout: eigen });
  const { spalten, zeilen, unvollstaendig, leer, zuVieleSpalten, anzahlPhasen } = pruefung;

  const ersteLuecke = unvollstaendig[0] || zeilen.find(z => z.offen > 0) || null;
  const zielName = ziel === 'docx' ? 'Word' : 'PDF';

  const setzeSpalten = (ids) => onChangeEigenesLayout({ ...eigen, spalten: normalisiereFeldListe(ids) });
  const setzeBreite = (id, wert) => {
    const n = Number(wert);
    const breiten = { ...eigen.breiten };
    if (Number.isFinite(n) && n > 0) breiten[id] = Math.min(60, Math.max(4, Math.round(n)));
    else delete breiten[id];
    onChangeEigenesLayout({ ...eigen, breiten });
  };
  const setzeBezeichnung = (id, wert) => {
    const bezeichnungen = { ...eigen.bezeichnungen };
    const t = String(wert || '').trim();
    if (t) bezeichnungen[id] = t.slice(0, 60);
    else delete bezeichnungen[id];
    onChangeEigenesLayout({ ...eigen, bezeichnungen });
  };

  return (
    <div className="modalOverlay" onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modalCard modalCard--breit exportCard" role="dialog" aria-modal="true"
           aria-label="Verlaufsplan exportieren"
           onKeyDown={(e)=>{ if (e.key === 'Escape') onClose?.(); }}>
        <h3 className="dialogTitle">Verlaufsplan exportieren</h3>

        <div className="exportZeile">
          <label className="profilWahl">
            <span className="small muted">Exportlayout</span>
            <select value={layout} onChange={(e)=>onChangeLayout(e.target.value)}>
              {EXPORTLAYOUTS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <span className="muted small">
            {EXPORTLAYOUTS.find(l => l.id === layout)?.beschreibung || ''}
          </span>
        </div>

        <p className="muted small" style={{margin:'0 0 10px'}}>
          Das Exportlayout ist unabhängig vom Planungsprofil. Es bestimmt allein,
          welche der vorhandenen Angaben ausgegeben werden – gespeichert bleibt alles.
        </p>

        {/* Vollständigkeit prüfen */}
        <section className="exportAbschnitt">
          <h4 className="settingsHeading">Vollständigkeit prüfen</h4>
          {zeilen.length === 0 ? (
            <p className="muted small" style={{margin:0}}>
              Dieses Layout gibt nur die Grundspalten aus – hier ist nichts zu prüfen.
            </p>
          ) : (
            <ul className="exportPruefListe">
              {zeilen.map(z => (
                <li key={z.id}>
                  <span className="exportPruefName">{z.label}</span>
                  <span className={`exportPruefWert${z.offen ? ' exportPruefWert--offen' : ''}`}
                        title={z.ausgegeben ? '' : 'In allen Phasen ohne Angabe – diese Spalte wird nicht ausgegeben.'}>
                    {z.offen === 0
                      ? 'vollständig'
                      : (z.ausgegeben
                          ? (z.offen === 1 ? '1 Phase ohne Angabe' : `${z.offen} Phasen ohne Angabe`)
                          : 'überall ohne Angabe · nicht ausgegeben')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {leer.length ? (
            <p className="muted small" style={{marginBottom:0}}>
              {leer.length === 1
                ? `Eine vorgesehene Spalte ist in allen ${anzahlPhasen} Phasen leer und wird nicht ausgegeben.`
                : `${leer.length} vorgesehene Spalten sind in allen Phasen leer und werden nicht ausgegeben.`}
              {layout === 'eigenes' ? ' Ausdrücklich angehakte Spalten bleiben trotzdem stehen.' : ''}
            </p>
          ) : null}
        </section>

        {zuVieleSpalten ? (
          <div className="inlineNotice inlineNotice--warning">
            Dieses Layout enthält {spalten.length} Spalten. Die Lesbarkeit im
            A4-Querformat kann eingeschränkt sein. Weniger Spalten oder ein
            knapperes Layout hilft – geändert wird hier nichts von selbst.
          </div>
        ) : null}

        {/* Spalten anpassen */}
        {spaltenOffen ? (
          <section className="exportAbschnitt">
            <h4 className="settingsHeading">Spalten anpassen</h4>
            {layout === 'eigenes' ? (
              <>
                <p className="muted small" style={{marginTop:0}}>
                  Häkchen blenden ein und aus, Ziehen ordnet um, die Zahl rechts ist
                  der Richtwert der Spaltenbreite. Eine angehakte Spalte wird auch
                  dann ausgegeben, wenn sie leer ist.
                </p>
                <FeldListeEditor
                  ausgewaehlt={eigen.spalten}
                  onChange={setzeSpalten}
                  breiten={eigen.breiten}
                  onChangeBreite={setzeBreite}
                  bezeichnungen={eigen.bezeichnungen}
                  onChangeBezeichnung={setzeBezeichnung}
                />
              </>
            ) : (
              <p className="muted small" style={{margin:0}}>
                Eigene Spalten gibt es im Layout „Benutzerdefiniert“.{' '}
                <button className="btn btnMini" onClick={()=>onChangeLayout('eigenes')}>
                  Dorthin wechseln
                </button>
              </p>
            )}
          </section>
        ) : null}

        {/* Vorschau */}
        <section className="exportAbschnitt">
          <h4 className="settingsHeading">Vorschau · A4 quer</h4>
          <div className="exportVorschau">
            <table className="exportVorschauTabelle">
              <thead>
                <tr>{spalten.map(c => (
                  <th key={c.id} style={{width:`${c.breite}%`}}>{c.label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(phasen || []).map((ph, i) => (
                  <tr key={ph.id || i}>
                    {spalten.map(c => (
                      <td key={c.id}>
                        {c.id === 'time' ? `${ph.duration} min` : feldText(ph, c.id)}
                      </td>
                    ))}
                  </tr>
                ))}
                {(phasen || []).length === 0 ? (
                  <tr><td colSpan={spalten.length} className="muted">(keine Phasen)</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{marginBottom:0}}>
            Spalten, Reihenfolge und Breiten wie im Export. Formatierungen im Text
            erscheinen erst in der fertigen Datei.
          </p>
        </section>

        <div className="dialogActions exportAktionen">
          {ersteLuecke ? (
            <button className="btn btnLeise"
                    onClick={()=>{ onSpringeZuPhase?.(ersteLuecke.phasen[0] ?? 0); onClose?.(); }}>
              Fehlende Angaben ergänzen
            </button>
          ) : null}
          {!spaltenOffen ? (
            <button className="btn btnLeise" onClick={()=>setSpaltenOffen(true)}>Layout anpassen</button>
          ) : null}
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={onExport}>
            {ersteLuecke ? `Trotzdem als ${zielName} speichern` : `Als ${zielName} speichern`}
          </button>
        </div>
      </div>
    </div>
  );
}

const KOMPETENZ_SUCHE_AB = 24;

function CompetencyEditor({
  competencies, primary, suggestions, onChange, onRemember, onHideSuggestion,
  languageMode = false, modell = null, benutzte = [],
}){
  const [draft, setDraft] = useState('');
  const [suche, setSuche] = useState('');

  const ausgewaehlt = useMemo(
    ()=> Array.isArray(competencies) ? competencies : [],
    [competencies]
  );

  /* Der Katalog für diese Stunde. `zusaetzlich` sorgt dafür, dass eine
     bereits eingetragene Kompetenz sichtbar bleibt, auch wenn sie
     inzwischen ausgeblendet oder aus der Auswahl gelöscht wurde –
     sonst liesse sie sich nicht mehr abwählen. */
  const bereiche = useMemo(()=>{
    if (!languageMode) return [];
    return katalogNachBereichen({
      modell,
      benutzte,
      zusaetzlich: [...ausgewaehlt, primary].filter(Boolean),
    });
  }, [languageMode, modell, benutzte, ausgewaehlt, primary]);

  const anzahlKompetenzen = useMemo(
    ()=> bereiche.reduce((a, b)=> a + b.kompetenzen.length, 0),
    [bereiche]
  );
  const zeigeSuche = anzahlKompetenzen >= KOMPETENZ_SUCHE_AB;
  const gefiltert = useMemo(
    ()=> zeigeSuche ? filterKatalog(bereiche, suche) : bereiche,
    [bereiche, suche, zeigeSuche]
  );

  const addValue = (raw) => {
    const v = (raw || '').trim();
    if (!v) return;
    const next = Array.from(new Set([...(competencies || []), v]));
    const nextPrimary = (primary || '').trim() || v;
    onRemember?.(v);
    onChange?.(next, nextPrimary);
    setDraft('');
  };

  const add = () => addValue(draft);

  const remove = (v) => {
    const next = (competencies || []).filter(x => x !== v);
    const nextPrimary = v === primary ? (next[0] || '') : primary;
    onChange?.(next, nextPrimary);
  };

  const toggle = (v) => {
    if (ausgewaehlt.includes(v)) remove(v);
    else addValue(v);
  };

  const setAsPrimary = (v) => {
    onRemember?.(v);
    onChange?.(competencies || [], v);
  };

  return (
    <div className="competencyBox">
      <div className="row wrap" style={{justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:800}}>Kompetenzen</div>
          <div className="muted small">
            {languageMode
              ? 'Auswählen oder frei ergänzen. Eine davon kann „primär“ sein.'
              : 'Füge Kompetenzen als Tags hinzu. Eine davon kann „primär“ sein.'}
          </div>
        </div>
      </div>

      <div style={{height:8}} />

      {languageMode ? (
        <div className="kompetenzWahl">
          {zeigeSuche ? (
            <input className="input kompetenzSuche" value={suche}
                   onChange={(e)=>setSuche(e.target.value)}
                   placeholder="Kompetenz suchen…" aria-label="Kompetenz suchen" />
          ) : null}

          {gefiltert.length === 0 ? (
            <div className="muted small">Keine Kompetenz gefunden.</div>
          ) : gefiltert.map((b)=>(
            <div key={b.id} className="kompetenzWahlBereich">
              <div className="kompetenzWahlName">{b.name}</div>
              <div className="kompetenzWahlListe">
                {b.kompetenzen.map((k)=>(
                  <label key={k.label}
                         className={`kompetenzWahlEintrag${ausgewaehlt.includes(k.label) ? ' is-active' : ''}`}>
                    <input type="checkbox"
                           checked={ausgewaehlt.includes(k.label)}
                           onChange={()=>toggle(k.label)} />
                    <span>{k.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Eigene Kompetenz ohne Umweg über die Einstellungen: sie steht
              sofort in dieser Stunde und ab dann in jeder weiteren. */}
          <div className="kompetenzEigene">
            <div className="small muted">Eigene Kompetenz</div>
            <div className="row" style={{gap:8}}>
              <TypeaheadInput
                value={draft}
                suggestions={suggestions}
                onChange={setDraft}
                onCommit={(v)=>setDraft((v || '').toString())}
                onEnter={(v)=>{ addValue(v); }}
                onHideSuggestion={onHideSuggestion}
                placeholder="z. B. Gesprächsstrategien"
                wrapStyle={{flex:1}}
              />
              <button className="btn" onClick={add} disabled={!draft.trim()}>Hinzufügen</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row wrap" style={{gap:8}}>
          <div style={{flex:1}}>
            <TypeaheadInput
              value={draft}
              suggestions={suggestions}
              onChange={setDraft}
              onCommit={(v)=>setDraft((v || '').toString())}
              onEnter={(v)=>{ addValue(v); }}
              onHideSuggestion={onHideSuggestion}
              placeholder="Kompetenz hinzufügen…"
              wrapStyle={{width:'100%'}}
            />
          </div>
          <button className="btn" onClick={add}>Hinzufügen</button>
        </div>
      )}

      <div style={{height:10}} />

      <div className="tagRow">
        {(competencies || []).length === 0 ? (
          <EmptyState
            text="Welche Kompetenzen diese Stunde bedient. Eine davon lässt sich als primär markieren – das taucht später in der Jahresübersicht auf."
          />
        ) : (
          (competencies || []).map((c)=>(
            <span key={c} className={c === primary ? 'tag tagPrimary' : 'tag'}>
              <button className="tagBtn" onClick={()=>setAsPrimary(c)} title="Als primär markieren"><Star {...ICON_SM} /></button>
              <span className="tagText">{c}</span>
              <button className="tagBtn" onClick={()=>remove(c)} title="Entfernen"><X {...ICON_SM} /></button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}



function escapeHtml(str){
  return (str || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function isProbablyHtml(str){
  const s = String(str || '').trim();
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

// Normalizes certain browser-generated tags (e.g. <font color=...>)
// into a small HTML subset that is easier to export.
function normalizeRichForStorage(html){
  const raw = String(html || '');
  if (!raw.trim()) return '';
  if (!isProbablyHtml(raw)) return raw;
  try {
    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
    const root = doc.body.firstChild;
    // execCommand('foreColor') often creates <font color="...">...
    root.querySelectorAll('font').forEach((el)=>{
      const color = (el.getAttribute('color') || '').trim();
      const span = doc.createElement('span');
      if (color) span.setAttribute('style', `color:${color};`);
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
    return root.innerHTML;
  } catch {
    return raw;
  }
}

// Sanitizes a small subset of HTML for export (PDF/DOCX).
// We keep only simple formatting tags and font color.
function sanitizeRichForExport(value){
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!isProbablyHtml(raw)) {
    return escapeHtml(raw).replaceAll('\n','<br/>');
  }
  try {
    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
    const root = doc.body.firstChild;
    const allowed = new Set(['B','STRONG','I','EM','U','BR','SPAN','FONT','UL','OL','LI','DIV','P']);

    const clean = (node) => {
      if (!node) return;
      if (node.nodeType === 3) return; // text
      if (node.nodeType !== 1) { node.remove(); return; }
      const tag = node.tagName.toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE') { node.remove(); return; }

      // unwrap unsupported tags
      if (!allowed.has(tag)) {
        const frag = doc.createDocumentFragment();
        Array.from(node.childNodes).forEach(ch => frag.appendChild(ch));
        node.replaceWith(frag);
        return;
      }

      // remove all attributes except inline color style on <span>/<font>
      Array.from(node.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name !== 'style' && name !== 'color') node.removeAttribute(attr.name);
      });

      if (tag === 'FONT') {
        // Convert <font color="..."> to <span style="color:..."> for better compatibility
        const color = (node.getAttribute('color') || '').trim();
        const span = doc.createElement('span');
        if (color) span.setAttribute('style', `color:${color};`);
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
        return;
      }

      if (tag === 'SPAN') {
        const style = node.getAttribute('style') || '';
        const m = style.match(/color\s*:\s*([^;]+)/i);
        const color = m ? m[1].trim() : '';
        if (color) node.setAttribute('style', `color:${color};`);
        else node.removeAttribute('style');
      } else {
        node.removeAttribute('style');
      }

      Array.from(node.childNodes).forEach(clean);
    };

    Array.from(root.childNodes).forEach(clean);
    let out = root.innerHTML;

    // Flatten block tags into line breaks for more predictable table rendering.
    out = out.replace(/<(\/?)\s*(div|p)[^>]*>/gi, (_m, close)=> close ? '<br/>' : '');
    out = out.replace(/<br\s*\/?>(\s*<br\s*\/?\s*>)+/gi, '<br/>');
    out = out.replace(/^(<br\s*\/?\s*>)+/i, '').replace(/(<br\s*\/?\s*>)+$/i, '');

    return out;
  } catch {
    return escapeHtml(raw).replaceAll('\n','<br/>');
  }
}



function SchoolYearRolloverDialog({
  visible,
  reason = 'manual',
  oldLabel = '',
  oldStartISO = '',
  oldEndISO = '',
  newStartISO = '',
  newEndISO = '',
  keepColors = true,
  keepTodos = false,
  archivesCount = 0,
  onChange,
  onClose,
  onSnooze,
  onDismiss,
  onConfirm
}){
  if (!visible) return null;
  const isAuto = reason === 'auto';
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center', gap:10}}>
          <div>
            <h2 style={{margin:'2px 0 0'}}>Neues Schuljahr anlegen?</h2>
            <div className="muted" style={{marginTop:4}}>
              {oldEndISO
                ? <>Das aktuelle Schuljahr ({oldLabel}) ist am <b>{formatDateDE(oldEndISO)}</b> beendet.</>
                : <>Du kannst dein aktuelles Schuljahr archivieren und ein neues starten.</>
              }
            </div>
          </div>
          <button className="btn" onClick={onClose} title="Schließen" aria-label="Schließen"><X {...ICON} /></button>
        </div>

        <div className="box" style={{marginTop:12}}>
          <div className="muted" style={{marginBottom:8}}>
            <b>Hinweis:</b> Sequenzbibliothek/Vorlagen bleiben erhalten. Der Wochenplan und die Einzelstunden des alten Schuljahres werden ins Archiv verschoben.
          </div>

          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div>
              <div className="label">Start neues Schuljahr</div>
              <input className="input" type="date" value={newStartISO} onChange={(e)=>{
                const v = e.target.value;
                const patch = { newStartISO: v };
                // auto-adjust end if empty or before start
                if (!newEndISO || (newEndISO && v && newEndISO < v)) {
                  try { patch.newEndISO = addDaysISO(v, 364); } catch {}
                }
                onChange?.(patch);
              }} />
            </div>
            <div>
              <div className="label">Ende neues Schuljahr</div>
              <input className="input" type="date" value={newEndISO} onChange={(e)=>onChange?.({ newEndISO: e.target.value })} />
            </div>
          </div>

          <div style={{display:'flex', gap:12, flexWrap:'wrap', marginTop:10}}>
            <label style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={keepColors} onChange={(e)=>onChange?.({ keepColors: e.target.checked })} />
              <span>Lerngruppen-Farben behalten</span>
            </label>
            <label style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={keepTodos} onChange={(e)=>onChange?.({ keepTodos: e.target.checked })} />
              <span>Offene To-dos übernehmen</span>
            </label>
          </div>

          <div className="muted" style={{marginTop:8}}>
            Archivierte Schuljahre: <b>{archivesCount}</b>
          </div>
        </div>

        <div className="row" style={{justifyContent:'flex-end', gap:8, marginTop:12, flexWrap:'wrap'}}>
          {isAuto ? (
            <>
              <button className="btn" onClick={onSnooze}>In 7 Tagen erinnern</button>
              <button className="btn" onClick={onDismiss}>Nicht mehr fragen</button>
            </>
          ) : null}
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={onConfirm}>Archivieren &amp; neues Schuljahr starten</button>
        </div>
      </div>
    </div>
  );
}


function WeekCopyDialog({ visible, onClose, onConfirm, weekTodosCount = 0, futureWeekTodosCount = 0 }){
  const [copyTodos, setCopyTodos] = useState(false);
  const [shiftTodoDates, setShiftTodoDates] = useState(true);
  const [copyDuties, setCopyDuties] = useState(true);

  useEffect(()=>{
    if (!visible) return;
    setCopyTodos(false);
    setShiftTodoDates(true);
    setCopyDuties(true);
  }, [visible]);

  if (!visible) return null;

  // Der Hinweis zu späteren To-dos steht unten im Dialog und wird deutlicher,
  // sobald sie tatsächlich wegfallen. Eine zusätzliche Rückfrage würde dieselbe
  // Information ein zweites Mal stellen – und das aus einem offenen Dialog heraus.
  const submit = () => onConfirm?.({ copyTodos, shiftTodoDates, copyDuties });

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <h3 className="dialogTitle">In nächste Woche übernehmen</h3>
        <div className="muted small" style={{marginTop:6}}>
          Es werden nur <b>Klasse/Kurs, Fach und Raum</b> übernommen – keine Themen, Ziele, Phasen, Notizen oder Sequenz-Zuordnung.
        </div>

        <div style={{height:10}} />

        <label className="row" style={{gap:10}}>
          <input type="checkbox" checked={copyDuties} onChange={(e)=>setCopyDuties(e.target.checked)} />
          <span>Aufsichten/Vertretungen (rote Balken) mit übernehmen</span>
        </label>

        <div style={{height:10}} />

        <label className="row" style={{gap:10}}>
          <input type="checkbox" checked={copyTodos} onChange={(e)=>setCopyTodos(e.target.checked)} />
          <span>To-dos dieser Woche mit übernehmen{weekTodosCount ? ` (${weekTodosCount})` : ''}</span>
        </label>

        {futureWeekTodosCount ? (
          copyTodos ? (
            <div className="muted small" style={{marginLeft:24, marginTop:6}}>
              Hinweis: {futureWeekTodosCount} To-do(s) haben ein Datum/Deadline <b>nach</b> dieser Woche. Diese werden beim Kopieren nicht automatisch „mit verschoben“.
            </div>
          ) : (
            <div className="inlineNotice inlineNotice--warning" style={{marginLeft:24, marginTop:6}}>
              {futureWeekTodosCount} To-do(s) haben ein Datum/Deadline <b>nach</b> dieser Woche und werden <b>nicht</b> übernommen. Setze den Haken darüber, wenn du sie mitnehmen willst.
            </div>
          )
        ) : null}

        {copyTodos ? (
          <label className="row" style={{gap:10, marginLeft:24, marginTop:6}}>
            <input type="checkbox" checked={shiftTodoDates} onChange={(e)=>setShiftTodoDates(e.target.checked)} />
            <span>Datumsangaben in dieser Woche um 7 Tage verschieben</span>
          </label>
        ) : null}

        <div className="row" style={{justifyContent:'flex-end', marginTop:14}}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" onClick={submit}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}

function TodoView({ weekStart, todos, onAddTodo, onUpdateTodo, onDeleteTodo, onBack, readOnly = false }){
  const [text, setText] = useState('');
  const [dateISO, setDateISO] = useState('');
  const [deadlineISO, setDeadlineISO] = useState('');
  const [forWeek, setForWeek] = useState(true);
  const [showOnlyWeek, setShowOnlyWeek] = useState(false);

  const filtered = useMemo(()=>{
    const arr = Array.isArray(todos) ? todos : [];
    const base = showOnlyWeek ? arr.filter(t => (t.weekStartISO || '') === (weekStart || '')) : arr;
    const sorted = [...base].sort((a,b)=>{
      const ad = (a.done ? 1 : 0) - (b.done ? 1 : 0);
      if (ad !== 0) return ad;
      const aDate = (a.deadlineISO || a.dateISO || '') || '9999-12-31';
      const bDate = (b.deadlineISO || b.dateISO || '') || '9999-12-31';
      const cmp = aDate.localeCompare(bDate);
      if (cmp !== 0) return cmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return sorted;
  }, [todos, showOnlyWeek, weekStart]);

  const add = ()=>{
    onAddTodo?.({
      text,
      dateISO,
      deadlineISO,
      weekStartISO: forWeek ? (weekStart || '') : ''
    });
    setText('');
    setDateISO('');
    setDeadlineISO('');
  };

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:900, fontSize:18}}>To-do Checkliste</div>
          <div className="muted small">{readOnly
            ? 'Archiviertes Schuljahr – die To-dos werden nur angezeigt.'
            : 'Optionales Datum/Deadline → Hinweis im Stundenplan & beim App-Start (ohne Inhalt).'}</div>
        </div>
        <button className="btn" onClick={onBack}>Zurück</button>
      </div>

      <div style={{height:12}} />

      {/* Alles darin ist im Archiv wirkungslos – nativ, nicht nur optisch. */}
      <fieldset className="archivFieldset" disabled={readOnly}>

      <div className="row wrap">
        <div className="grow">
          <label className="small muted">Neues To-do</label>
          <input className="input" value={text} onChange={(e)=>setText(e.target.value)} placeholder="z. B. Arbeitsblatt kopieren" />
        </div>
        <div style={{width:170}}>
          <label className="small muted">Datum (optional)</label>
          <input className="input" type="date" value={dateISO} onChange={(e)=>setDateISO(e.target.value)} />
        </div>
        <div style={{width:170}}>
          <label className="small muted">Deadline (optional)</label>
          <input className="input" type="date" value={deadlineISO} onChange={(e)=>setDeadlineISO(e.target.value)} />
        </div>
        <div style={{width:200}}>
          <label className="small muted">Zuordnung</label>
          <label className="row" style={{gap:10, marginTop:6}}>
            <input type="checkbox" checked={forWeek} onChange={(e)=>setForWeek(e.target.checked)} />
            <span>für diese Woche</span>
          </label>
        </div>
        <div style={{width:120, alignSelf:'flex-end'}}>
          <button className="btn primary" disabled={!text.trim()} onClick={add}>Hinzufügen</button>
        </div>
      </div>

      </fieldset>

      <div style={{height:10}} />

      {/* Ein reiner Anzeigefilter – er ändert nichts und gilt deshalb
          auch in der Archivansicht. */}
      <label className="row" style={{gap:10}}>
        <input type="checkbox" checked={showOnlyWeek} onChange={(e)=>setShowOnlyWeek(e.target.checked)} />
        <span>Nur To-dos dieser Woche</span>
      </label>

      <fieldset className="archivFieldset" disabled={readOnly}>

      <div style={{height:10}} />

      <div className="todoList">
        {filtered.length === 0 ? (
          <div className="muted small">Keine To-dos.</div>
        ) : filtered.map(t => (
          <div key={t.id} className={`todoRow ${t.done ? 'todoRow--done' : ''}`}>
            <input type="checkbox" checked={!!t.done} onChange={(e)=>onUpdateTodo?.(t.id, { done: e.target.checked })} />
            <input
              className="input"
              value={t.text || ''}
              onChange={(e)=>onUpdateTodo?.(t.id, { text: e.target.value })}
            />
            <input
              className="input"
              type="date"
              value={t.dateISO || ''}
              onChange={(e)=>onUpdateTodo?.(t.id, { dateISO: e.target.value })}
              title="Datum"
            />
            <input
              className="input"
              type="date"
              value={t.deadlineISO || ''}
              onChange={(e)=>onUpdateTodo?.(t.id, { deadlineISO: e.target.value })}
              title="Deadline"
            />
            <label className="row small" style={{gap:8}}>
              <input
                type="checkbox"
                checked={(t.weekStartISO || '') === (weekStart || '')}
                onChange={(e)=>onUpdateTodo?.(t.id, { weekStartISO: e.target.checked ? (weekStart || '') : '' })}
              />
              <span className="muted">Woche</span>
            </label>
            <button className="iconBtn danger" onClick={()=>onDeleteTodo?.(t.id)} title="To-do löschen"><Trash2 {...ICON_SM} /></button>
          </div>
        ))}
      </div>
      </fieldset>
    </div>
  );
}

/* ============================================================
   Fachdidaktik im Export

   Grundsatz: Nur ausgefüllte Bereiche erscheinen. Ein Verlaufsplan
   einer Stunde ohne diese Angaben sieht deshalb aus wie zuvor – keine
   leeren Überschriften, keine Platzhalter.
   ============================================================ */

/* Die Aufgabe als eine Zeile plus die ausgefüllten Detailfelder. */
function aufgabeAlsHtml(aufgabe){
  const a = normalisiereAufgabe(aufgabe);
  if (istLeereAufgabe(a)) return '';
  const details = [
    ['Situation', a.situation],
    ['Adressat', a.audience],
    ['Absicht', a.intention],
    ['Ergebnis', a.outcome],
  ].filter(([, v]) => v)
   .map(([k, v]) => `<span class="dTag">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
   .join(' ');
  return `${a.text ? escapeHtml(a.text) : ''}${details ? `<div class="dMeta">${details}</div>` : ''}`;
}

/* Sprechabsichten und sprachliche Mittel in einem Block. */
function sprachhandelnAlsHtml(lesson){
  const absichten = normalisiereSprechabsichten(lesson?.speechActs);
  const m = normalisiereMittel(lesson?.languageResources);
  const zeilen = [];
  if (absichten.length) zeilen.push(`<div><em>Sprechabsichten:</em> ${escapeHtml(absichten.join(', '))}</div>`);
  for (const [k, v] of [
    ['Wortschatz', m.vocabulary],
    ['Grammatik / Strukturen', m.grammar],
    ['Aussprache', m.pronunciation],
    ['Weitere Mittel', m.other],
  ]) {
    if (v) zeilen.push(`<div><em>${escapeHtml(k)}:</em> ${escapeHtml(v)}</div>`);
  }
  return zeilen.join('');
}

/* Die Hilfen einer Phase, kompakt in einer Zelle. */
function scaffoldsAlsHtml(phase, { ohneVorspann = false } = {}){
  const liste = normalisiereScaffolds(phase?.scaffolds).filter(sc => !istLeererScaffold(sc));
  if (!liste.length) return '';
  const eintraege = liste.map((sc)=>{
    const teile = [
      sc.fadeOut ? '↓' : '',
      escapeHtml(sc.label || scaffoldArtName(sc.type)),
      sc.note ? `– ${escapeHtml(sc.note)}` : '',
      sc.supportLevel ? `(${escapeHtml(stufenName(sc.supportLevel))})` : '',
    ].filter(Boolean).join(' ');
    return `<div>${teile}</div>`;
  }).join('');
  /* Als eigene Spalte braucht die Liste keine Überschrift – die steht
     schon im Tabellenkopf. Hängt sie dagegen an den Bemerkungen, muss
     erkennbar bleiben, wo die Bemerkung aufhört. */
  if (ohneVorspann) return `<div class="scaffSpalte">${eintraege}</div>`;
  return `<div class="scaff"><em>Hilfen:</em>${eintraege}</div>`;
}

/* Ein Block im Kopfbereich – nur, wenn er Inhalt hat. */
function kopfBlock(beschriftung, inhaltHtml){
  if (!inhaltHtml) return '';
  return `
    <div class="block">
      <div class="k">${escapeHtml(beschriftung)}</div>
      <div class="v">${inhaltHtml}</div>
    </div>`;
}

/* Eine Zelle des Verlaufsplans. Wie sie aussieht, steht in der
   Registry (`zelle`) – nicht hier und nicht ein zweites Mal im
   Word-Export: beide Wege nehmen dieselbe Tabelle. */
function verlaufsZelle(phase, spalte, zeit){
  if (spalte.zelle === 'zeit') {
    return (zeit?.start ? `<div class="tStart"><strong>${escapeHtml(zeit.start)}</strong></div>` : '') +
      `<div class="tDur">(${escapeHtml(String(phase.duration || ''))} min)</div>`;
  }
  if (spalte.zelle === 'scaffolds') return scaffoldsAlsHtml(phase, { ohneVorspann: true });
  const wert = feldWert(phase, spalte.id);
  if (spalte.zelle === 'stark') return `<strong>${escapeHtml(String(wert || ''))}</strong>`;
  if (spalte.zelle === 'rich') return sanitizeRichForExport(wert || '');
  return escapeHtml(String(wert || ''));
}

function buildLessonPdfHtml({ title, dateISO, dayIndex, slotIndex, schoolCalendar, lesson,
                              layout = STANDARD_LAYOUT, eigenesLayout = null }){
  const l = normalizeLesson(lesson || {});
  const phases = normalizePhases(l.phases || [], lessonTotalMin(l));
  const lessonStart = getLessonStartTime(schoolCalendar, slotIndex);
  const times = computePhaseTimes(phases, lessonStart);

  /* Kompetenzen im Verlaufsplan.

     Sie standen bisher nur im Wochenexport, und dort nur als einzelne
     Zeile mit der primären Kompetenz. Weil es hier um dieselben
     Etiketten geht, trägt derselbe Block System- wie eigene
     Kompetenzen; die primäre steht mit Stern voran. Ohne eingetragene
     Kompetenzen entfällt der Block, damit vorhandene Ausgaben
     unverändert aussehen. */
  const kompetenzBlock = (()=>{
    const primaer = String(l.primaryCompetency || '').trim();
    const alle = new Set((Array.isArray(l.competencies) ? l.competencies : [])
      .map(x => String(x || '').trim()).filter(Boolean));
    if (primaer) alle.add(primaer);
    if (!alle.size) return '';
    const sortiert = [...alle].sort((a, b)=>{
      if (a === primaer) return -1;
      if (b === primaer) return 1;
      return a.localeCompare(b);
    });
    const text = sortiert
      .map(k => (k === primaer ? `★ ${k}` : k))
      .map(escapeHtml)
      .join(' · ');
    return `
    <div class="block">
      <div class="k">Kompetenzen</div>
      <div class="v">${text}</div>
    </div>`;
  })();

  const kriterienBlock = (()=>{
    const liste = normalisiereErfolgskriterien(l.successCriteria);
    if (!liste.length) return '';
    return kopfBlock('Erfolgskriterien',
      `<ul class="krit">${liste.map(k => `<li>${escapeHtml(k)}</li>`).join('')}</ul>`);
  })();

  const aufgabenBlock = kopfBlock('Kommunikative Aufgabe', aufgabeAlsHtml(l.communicativeTask));
  const sprachBlock = kopfBlock('Sprachhandeln & sprachliche Mittel', sprachhandelnAlsHtml(l));

  /* Die eine Stelle, an der Spalten entstehen. PDF, Word und die
     Vorschau im Exportdialog fragen dieselbe Funktion – deshalb kann
     die Ausgabe zwischen ihnen nicht auseinanderlaufen.

     Sind die Hilfen keine eigene Spalte, hängen sie wie bisher an den
     Bemerkungen: eine geplante Hilfe verschwindet nie stillschweigend
     aus dem Export. */
  const spalten = getLessonPlanExportColumns(layout, phases, { eigenesLayout });
  const hilfenAlsSpalte = spalten.some(c => c.id === 'scaffolding');
  const anhangSpalte = hilfenAlsSpalte
    ? ''
    : (spalten.find(c => c.id === 'remarks') || spalten[spalten.length - 1] || {}).id;

  const kopfZeile = spalten
    .map(c => `<th class="col-${c.id}">${escapeHtml(c.label)}</th>`)
    .join('');

  const rows = phases.map((p, i)=>{
    const t = times[i] || { start:'', end:'' };
    const zellen = spalten.map((c)=>{
      const inhalt = verlaufsZelle(p, c, t);
      const anhang = (!hilfenAlsSpalte && c.id === anhangSpalte) ? scaffoldsAlsHtml(p) : '';
      return `<td class="col-${c.id}">${inhalt}${anhang}</td>`;
    }).join('');
    return `
      <tr>
        ${zellen}
      </tr>
    `;
  }).join('');

  const spaltenCss = spalten
    .map(c => `    .col-${c.id}{width:${c.breite}%${c.id === 'time' ? '; white-space:nowrap' : ''}}`)
    .join('\n');

  const dayLabel = (typeof dayIndex === 'number' && dayIndex >= 0 && dayIndex < DAYS.length) ? DAYS[dayIndex] : '';
  const dateLabel = dateISO ? formatDateDE(dateISO) : '';
  const slotLabel = Number.isFinite(slotIndex) ? `${slotIndex+1}. Stunde` : '';
  const headerLine = `${dayLabel ? `${escapeHtml(dayLabel)} · ` : ''}` + `${escapeHtml(dateLabel || '')}` + `${slotLabel ? ` · ${escapeHtml(slotLabel)}` : ''}` + `${lessonStart ? ` · Beginn ${escapeHtml(lessonStart)}` : ''}`;

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="page-orientation" content="landscape" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page{ size: A4 landscape; margin: 12mm; }
    body{font-family: Arial, Helvetica, sans-serif; margin: 0; color:#111827}
    h1{font-size:16px; margin:0 0 4mm 0}
    .meta{color:#6b7280; font-size:11px; margin-bottom:4mm}
    .head{display:flex; justify-content:space-between; gap:12mm; margin-bottom:4mm}
    .head .block{flex:1}
    .k{color:#6b7280; font-size:10px; text-transform:uppercase; letter-spacing:0.06em}
    .v{font-size:11px; margin-top:2mm}
    .v strong{font-size:12px}

    table{width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px}
    th,td{border:1px solid #9ca3af; padding:6px; vertical-align:top}
    th{background:#d1d5db; text-align:left; font-weight:800}

${spaltenCss}

    .tStart{font-size:12px}
    .tDur{color:#374151; font-size:10px; margin-top:1mm}
    .krit{margin:0; padding-left:4mm}
    .krit li{margin-bottom:0.5mm}
    .dMeta{margin-top:1mm; font-size:10px; color:#374151}
    .dTag{margin-right:3mm; white-space:nowrap}
    .scaff{margin-top:1mm; padding-top:1mm; border-top:1px dashed #9ca3af; font-size:10px}
    .scaffSpalte{font-size:10px}
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Prép-ybara – Verlaufsplanung Einzelstunde (A4 Querformat)</div>
  <div class="meta">${headerLine}</div>

  <div class="head">
    <div class="block">
      <div class="k">Fach / Klasse / Raum</div>
      <div class="v"><strong>${escapeHtml(l.subject || '')}</strong> · ${escapeHtml(l.classGroup || '')}${l.room ? ` · Raum ${escapeHtml(l.room)}` : ''}</div>
    </div>
    <div class="block">
      <div class="k">Stundenthema</div>
      <div class="v">${escapeHtml(l.topic || '')}</div>
    </div>
    <div class="block">
      <div class="k">Lernziele</div>
      <div class="v">${escapeHtml(l.objectives || '').replaceAll('\n','<br/>')}</div>
    </div>
    ${kompetenzBlock}
    ${kriterienBlock}
    ${aufgabenBlock}
    ${sprachBlock}
  </div>

  <table>
    <thead>
      <tr>
        ${kopfZeile}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}


function buildWeekPdfHtml({ weekStart, week, sequences, schoolCalendar, groupColors, duties }){
  const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag'];
  const start = fromISODate(weekStart);
  const end = addDays(start, 4);
  const slots = week?.slotsPerDay || 6;
  const lessons = week?.lessons || {};
  const dutyMap = duties || week?.duties || {};

  const cellFor = (dayIndex, slotIndex) => {
    const raw = lessons[`${dayIndex}-${slotIndex}`];
    if (!raw) return { html: '' };
    const l = normalizeLesson(raw);
    const span = Math.min(blockSpanOf(l), Math.max(1, slots - slotIndex));
    const gKey = groupKey(l.classGroup, l.subject);
    const color = (groupColors?.[gKey]?.color) || defaultGroupColor(gKey);
    const bg = hexToRgba(color, 0.22);
    const topic = (l.topic || '').trim();
    const comps = Array.isArray(l.competencies) ? l.competencies.filter(Boolean) : [];
    return {
      bg,
      span,
      html: `
        <div class="cellTop">
          <div class="cellMain"><strong>${escapeHtml(l.subject || '')}</strong> · ${escapeHtml(l.classGroup || '')}${l.room ? ` · Raum ${escapeHtml(l.room)}` : ''}</div>
          ${topic ? `<div class="cellSub">${escapeHtml(topic)}</div>` : ''}
          ${span > 1 ? `<div class="cellTiny">${escapeHtml(blockName(span))} · ${escapeHtml(stundenBereichLabel(slotIndex, span))}</div>` : ''}
          ${comps.length ? `<div class="cellTiny">Kompetenz: ${escapeHtml((l.primaryCompetency || comps[0] || ''))}</div>` : ''}
        </div>
      `
    };
  };

  /* Welche Plätze eine Doppelstunde mit abdeckt. Im Export bekommt sie
     eine Zelle über mehrere Tabellenzeilen (rowspan) – die abgedeckten
     Plätze zeichnen dort dann keine eigene Zelle mehr. */
  const abgedeckt = (()=>{
    const m = new Set();
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++){
      for (let slotIndex = 0; slotIndex < slots; slotIndex++){
        const raw = lessons[`${dayIndex}-${slotIndex}`];
        if (!raw) continue;
        const span = Math.min(blockSpanOf(raw), Math.max(1, slots - slotIndex));
        for (let i = 1; i < span; i++) m.add(`${dayIndex}-${slotIndex+i}`);
      }
    }
    return m;
  })();

  const dutyFor = (dayIndex, pos) => (dutyMap?.[`${dayIndex}-${pos}`] || '').trim();

  const headCells = days.map((d, i) => {
    const dateISO = toISODate(addDays(start, i));
    const info = getDayInfo(dateISO, schoolCalendar);
    const label = info?.isOff ? ` · ${info.label || 'frei'}` : '';
    return `<th><div class="dayName">${d}</div><div class="dayDate">${escapeHtml(formatDateDE(dateISO))}${escapeHtml(label)}</div></th>`;
  }).join('');

  const bodyRows = [];
  // duty row before first lesson
  bodyRows.push(buildDutyRow(0));
  for (let slotIndex = 0; slotIndex < slots; slotIndex++) {
    bodyRows.push(buildLessonRow(slotIndex));
    bodyRows.push(buildDutyRow(slotIndex + 1));
  }

  function buildDutyRow(pos){
    const tds = days.map((_, dayIndex) => {
      // Innerhalb einer Doppelstunde läuft die Zelle durch (rowspan).
      if (abgedeckt.has(`${dayIndex}-${pos}`)) return '';
      const title = dutyFor(dayIndex, pos);
      if (!title) return `<td class="dutyCell"></td>`;
      return `<td class="dutyCell"><div class="dutyBar">${escapeHtml(title)}</div></td>`;
    }).join('');
    const label = (pos === 0 || pos === slots) ? 'Aufsicht' : '';
    return `<tr class="dutyRow"><td class="slotCol">${label}</td>${tds}</tr>`;
  }

  function buildLessonRow(slotIndex){
    const tds = days.map((_, dayIndex) => {
      if (abgedeckt.has(`${dayIndex}-${slotIndex}`)) return '';
      const dateISO = toISODate(addDays(start, dayIndex));
      const info = getDayInfo(dateISO, schoolCalendar);
      const cell = cellFor(dayIndex, slotIndex);
      const style = [];
      if (cell.bg) style.push(`background:${cell.bg}`);
      if (info?.isOff) style.push('opacity:0.55');
      // Eine Doppelstunde überspannt Stundenzeile + Aufsichtsstreifen + Stundenzeile.
      const rowspan = (cell.span && cell.span > 1) ? ` rowspan="${cell.span * 2 - 1}"` : '';
      return `<td class="lessonCell"${rowspan} style="${style.join(';')}">${cell.html || ''}</td>`;
    }).join('');
    return `<tr class="lessonRow"><td class="slotCol">${slotIndex+1}. Stunde</td>${tds}</tr>`;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Wochenplan</title>
  <style>
    body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111827; }
    h1{ margin:0 0 2mm 0; font-size:18px; }
    .meta{ color:#6b7280; font-size:12px; margin-bottom:4mm; }
    table{ width:100%; border-collapse:collapse; }
    th, td{ border:1px solid #e5e7eb; vertical-align:top; padding:6px; }
    th{ background:#f9fafb; }
    .slotCol{ width:18mm; white-space:nowrap; font-size:11px; color:#374151; font-weight:700; }
    .dayName{ font-weight:800; }
    .dayDate{ font-size:11px; color:#6b7280; }
    .lessonCell{ min-height:18mm; }
    .cellMain{ font-size:12px; }
    .cellSub{ margin-top:2px; font-size:11px; color:#374151; }
    .cellTiny{ margin-top:2px; font-size:10px; color:#6b7280; }
    .dutyRow td{ padding:3px 6px; }
    .dutyCell{ background:#fff; }
    .dutyBar{ display:inline-block; background:#ef4444; color:white; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:800; }
  </style>
</head>
<body>
  <h1>Wochenübersicht</h1>
  <div class="meta">${escapeHtml(formatDateDE(weekStart))} – ${escapeHtml(formatDateDE(toISODate(end)))} · ${slots} Stunde(n) pro Tag</div>
  <table>
    <thead>
      <tr>
        <th class="slotCol"></th>
        ${headCells}
      </tr>
    </thead>
    <tbody>
      ${bodyRows.join('')}
    </tbody>
  </table>
</body>
</html>`;
}


function buildSequencePdfHtml({ sequence, occurrences, schoolCalendar, groupColors }){
  // Makro-/Sequenz-Export: nutzt dieselbe Verlaufsplanungs-Tabelle wie die Einzelstundenansicht,
  // aber kompakter (damit mehrere Stunden auf eine A4-Hochkant-Seite passen können).
  const seqName = sequence?.name || 'Sequenz';
  const color = sequence?.color || '#2563eb';
  const count = Array.isArray(occurrences) ? occurrences.length : 0;

  /* Zielaufgabe und Progression stehen vor den Verlaufsplänen – sie
     ordnen ein, was danach im Einzelnen kommt. Beides erscheint nur,
     wenn es etwas zu zeigen gibt.

     Die Tabelle bleibt bewusst bei vier Spalten: auf A4 hochkant ist
     mehr nicht lesbar. Die Hilfen stehen als Anzahl, nicht ausgeschrieben. */
  const zielaufgabe = (()=>{
    const html = aufgabeAlsHtml(sequence?.finalTask);
    if (!html) return '';
    return `
  <section class="ziel">
    <div class="zielKopf">Kommunikative Zielaufgabe</div>
    <div class="zielText">${html}</div>
  </section>`;
  })();

  const progression = (()=>{
    const zeilen = sequenzProgression(occurrences || []);
    // Ohne fachdidaktische Angaben wiederholte die Tabelle nur die Themen.
    const traegt = zeilen.some(z => z.ausAufgabe || z.sprechabsichten.length
      || z.mittel.length || z.scaffolds.length || z.notiz);
    if (!traegt) return '';
    const reihen = zeilen.map((z)=>`
      <tr>
        <td class="pNr">${z.nummer}</td>
        <td>${escapeHtml(z.sprachhandlung || '')}${z.notiz ? `<div class="pNotiz">${escapeHtml(z.notiz)}</div>` : ''}</td>
        <td>${escapeHtml([z.kompetenzPrimaer, ...z.kompetenzen.filter(k => k !== z.kompetenzPrimaer)].filter(Boolean).join(', '))}</td>
        <td>${escapeHtml([...z.sprechabsichten, ...z.mittel].join(' · '))}</td>
        <td class="pNr">${z.scaffolds.length ? `${z.scaffolds.length}${z.stufe ? ` · ${escapeHtml(stufenName(z.stufe))}` : ''}` : ''}</td>
      </tr>`).join('');
    return `
  <section class="prog">
    <div class="zielKopf">Progression</div>
    <table class="progT">
      <thead>
        <tr>
          <th class="pNr">Std.</th>
          <th>Sprachhandlung / Aufgabe</th>
          <th>Kompetenz</th>
          <th>Sprechabsichten &amp; sprachliche Mittel</th>
          <th class="pNr">Hilfen</th>
        </tr>
      </thead>
      <tbody>${reihen}</tbody>
    </table>
  </section>`;
  })();

  const blocks = (occurrences || []).map((o, idx) => {
    const l = normalizeLesson(o.lesson);
    const phases = normalizePhases(l.phases || [], lessonTotalMin(l));
    const lessonStart = getLessonStartTime(schoolCalendar, o.slotIndex);
    const times = computePhaseTimes(phases, lessonStart);

    const dayLabel = (typeof o.dayIndex === 'number' && o.dayIndex >= 0 && o.dayIndex < DAYS.length) ? DAYS[o.dayIndex] : '';
    const dateLabel = o.dateISO ? formatDateDE(o.dateISO) : '';
    const slotLabel = Number.isFinite(o.slotIndex) ? ` · ${stundenBereichLabel(o.slotIndex, blockSpanOf(l)).replace('Stunde', 'Std.')}` : '';
    const headerRaw = `${dayLabel ? `${dayLabel} · ` : ''}${dateLabel}${slotLabel}${lessonStart ? ` · Beginn ${lessonStart}` : ''}`;
    const header = escapeHtml(headerRaw);

    const metaLine = `${escapeHtml((l.subject || '').trim())}${(l.classGroup || '').trim() ? ` · ${escapeHtml(l.classGroup)}` : ''}${(l.room || '').trim() ? ` · Raum ${escapeHtml(l.room)}` : ''}`;

    const rows = phases.map((p, i)=>{
      const t = times[i] || { start:'', end:'' };
      const timeCell = (t.start ? `<div class="tStart"><strong>${escapeHtml(t.start)}</strong></div>` : '') +
        `<div class="tDur">(${escapeHtml(String(p.duration || ''))} min)</div>`;
      return `
        <tr>
          <td class="colTime">${timeCell}</td>
          <td class="colPhase"><strong>${escapeHtml(p.title || '')}</strong></td>
          <td class="colContent">${sanitizeRichForExport(p.content || '')}</td>
          <td class="colSocial">${escapeHtml(p.socialForm || '')}</td>
          <td class="colMat">${sanitizeRichForExport(p.materialsMedia || '')}</td>
          <td class="colNotes">${sanitizeRichForExport(p.remarks || '')}${scaffoldsAlsHtml(p)}</td>
        </tr>
      `;
    }).join('');

    const topic = (l.topic || '').trim();

    return `
      <section class="lessonCard">
        <div class="lessonTop">
          <div class="lessonHdr">
            <div class="lessonWhen">${header}</div>
            <div class="lessonMeta">${metaLine}</div>
            ${topic ? `<div class="lessonTopic">${escapeHtml(topic)}</div>` : ''}
          </div>
        </div>

        <table class="phaseTable">
          <thead>
            <tr>
              <th class="colTime">Zeit</th>
              <th class="colPhase">Phase</th>
              <th class="colContent">Inhalt / Handeln / Interaktion</th>
              <th class="colSocial">Sozialform</th>
              <th class="colMat">Materialien und Medien</th>
              <th class="colNotes">Bemerkungen</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="6" class="muted">(keine Phasen)</td></tr>`}
          </tbody>
        </table>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(seqName)}</title>
  <style>
    @page{ size: A4 portrait; margin: 10mm; }

    body{
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      color:#111827;
    }
    h1{ font-size:14px; margin:0 0 2mm 0; }
    .meta{ color:#6b7280; font-size:10px; margin-bottom:3mm; }

    /* Karten so kompakt, dass mehrere pro Seite möglich sind */
    .lessonCard{
      border:1px solid #e5e7eb;
      border-left:6px solid ${escapeHtml(color)};
      border-radius:10px;
      padding:6px 8px;
      margin:0 0 5mm 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .lessonWhen{ font-size:10px; color:#374151; margin-bottom:1mm; }
    .lessonMeta{ font-size:10px; font-weight:700; margin-bottom:1mm; }
    .lessonTopic{ font-size:10px; color:#111827; }

    table{ width:100%; border-collapse:collapse; table-layout:fixed; font-size:9px; }
    th,td{ border:1px solid #e5e7eb; padding:3px; vertical-align:top; }
    th{ background:#f9fafb; font-weight:700; }

    .colTime{width:9%; white-space:nowrap}
    .colPhase{width:16%}
    .colContent{width:44%}
    .colSocial{width:10%}
    .colMat{width:11%}
    .colNotes{width:10%}

    .tStart{font-size:9px; line-height:1.1}
    .tDur{font-size:8px; color:#6b7280}
    .muted{ color:#6b7280; }

    .scaff{margin-top:1mm; padding-top:1mm; border-top:1px dashed #9ca3af; font-size:8px}
    .ziel{border:1px solid #9ca3af; border-left:3px solid ${color}; padding:2mm 3mm; margin-bottom:3mm}
    .zielKopf{font-size:9px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin-bottom:1mm}
    .zielText{font-size:11px}
    .prog{margin-bottom:4mm}
    .progT{width:100%; border-collapse:collapse; font-size:9px}
    .progT th, .progT td{border:1px solid #9ca3af; padding:1.5mm; vertical-align:top; text-align:left}
    .progT th{background:#e5e7eb; font-weight:700}
    .pNr{width:12mm; white-space:nowrap}
    .pNotiz{color:#6b7280; font-style:italic; margin-top:0.5mm}
  </style>
</head>
<body>
  <h1>Sequenz: ${escapeHtml(seqName)}</h1>
  <div class="meta">${count} Unterrichtsstunde(n) · Export aus Prép-ybara</div>
  ${zielaufgabe}
  ${progression}
  ${count ? blocks : `<div class="muted">Keine Stunden dieser Sequenz im aktuellen Plan gefunden.</div>`}
</body>
</html>`;
}
