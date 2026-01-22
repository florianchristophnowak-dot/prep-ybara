import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/logo.png';
import eastereggImg from './assets/easteregg.png';
import wordIcon from './assets/word-icon.svg';
import pdfIcon from './assets/pdf-icon.svg';
import helpMd from './assets/HELP.md?raw';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const PX_PER_MIN = 10;
const TOTAL_MIN = 45;
const MIN_PHASE_MIN = 1;

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
const APP_VERSION = '1.0.9';


const SEQ_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#d97706',
  '#059669', '#0f766e', '#0891b2', '#4f46e5', '#9333ea', '#be123c'
];


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


function SplashOverlay({ visible }){
  return (
    <div className={`splashOverlay ${visible ? '' : 'splashOverlay--hide'}`} aria-hidden={!visible}>
      <div className="splashCard">
        <img className="splashLogo" src={logo} alt="Prép-ybara" />
        <div className="splashTitle">Prép-ybara</div>
        <div className="splashSubtitle">Unterrichtsvorbereitung, entspannt.</div>
      </div>
    </div>
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


function HelpView({ version }){
  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Hilfe</div>
          <div className="muted small">Prép-ybara {version || ''} – Kurzhandbuch</div>
        </div>
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

function formatMMSS(totalSeconds){
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function bgFromProgress(progress){
  const p = clamp01(progress);
  // hue 120 (green) -> 0 (red). Light + low saturation to keep it subtle.
  const hue = 120 * (1 - p);
  return `hsla(${hue}, 55%, 93%, 1)`;
}

function ExecutionWindow({ api }){
  const [snapshot, setSnapshot] = useState(null);
  const [idx, setIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [isCountdownOn, setIsCountdownOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const endTsRef = useRef(null);
  const tickRef = useRef(null);

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

  const phases = Array.isArray(snapshot?.phases) ? snapshot.phases : [];
  const isHomeworkView = snapshot && idx >= phases.length;
  const phase = (!isHomeworkView) ? (phases[idx] || null) : null;
  const durationSec = Math.max(0, Math.round((Number(phase?.duration) || 0) * 60));
  const progress = durationSec > 0 ? (1 - (remainingSec / durationSec)) : 0;
  const bg = (!isHomeworkView && isCountdownOn && !isPaused) ? bgFromProgress(progress) : '#ffffff';

  const resetPhaseTime = (nextIdx) => {
    // Homework view sits AFTER the last phase
    if (nextIdx >= phases.length) {
      endTsRef.current = null;
      setRemainingSec(0);
      // keep paused so nothing restarts unexpectedly
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
      // reset time to that phase
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
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  };

  // Receive snapshot from main process
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
      const d = Math.max(0, Math.round((Number(first?.duration) || 0) * 60));
      setRemainingSec(d);
    };

    // Preferred: fetch payload on demand (prevents race with early IPC send)
    (async () => {
      try {
        if (api?.getExecutionSnapshot) {
          const p = await api.getExecutionSnapshot();
          if (p) applySnapshot(p);
        }
      } catch {}
    })();

    // Backwards/fallback: listen for push init
    if (api?.onExecutionInit) {
      off = api.onExecutionInit((payload)=>applySnapshot(payload));
    }
    return () => off && off();
  }, [api]);

  // Main ticker loop (drift-free)
  useEffect(()=>{
    const loop = () => {
      const snap = snapshotRef.current;
      const i = idxRef.current;
      const isOn = countdownRef.current;
      const isP = pausedRef.current;
      const phasesNow = Array.isArray(snap?.phases) ? snap.phases : [];
      // Homework view: index == phasesNow.length
      if (!snap || !phasesNow.length) {
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      if (i >= phasesNow.length) {
        // Homework screen: keep timer stopped
        endTsRef.current = null;
        if (remainingRef.current !== 0) setRemainingSec(0);
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      const ph = phasesNow[i] || null;

      if (!isOn || isP) {
        // When countdown is off or paused, keep time static.
        endTsRef.current = null;
        tickRef.current = requestAnimationFrame(loop);
        return;
      }

      const dur = Math.max(0, Math.round((Number(ph?.duration) || 0) * 60));
      const rem = Math.max(0, Number(remainingRef.current) || 0);
      if (endTsRef.current == null) {
        endTsRef.current = performance.now() + rem * 1000;
      }
      const msLeft = endTsRef.current - performance.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      if (secLeft !== rem) setRemainingSec(secLeft);

      if (secLeft <= 0) {
        endTsRef.current = null;
        if (i < phasesNow.length - 1) {
          const next = i + 1;
          setIdx(next);
          const nextP = phasesNow[next] || null;
          const nextDur = Math.max(0, Math.round((Number(nextP?.duration) || 0) * 60));
          setRemainingSec(nextDur);
        } else {
          // last phase finished -> go to homework view (one step after last phase)
          setIdx(phasesNow.length);
          setIsPaused(true);
          setRemainingSec(0);
        }
      }

      // If duration changed (shouldn't during execution), ensure remaining isn't above duration.
      if (dur > 0 && remainingRef.current > dur) setRemainingSec(dur);

      tickRef.current = requestAnimationFrame(loop);
    };

    tickRef.current = requestAnimationFrame(loop);
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(()=>{
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(p=>!p);
      }
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
  // If the phase has a lot of text, tighten the layout a bit to reduce scrolling.
  const isDense = contentLen > 900;

  return (
    <div className={`execRoot ${isDense ? 'dense' : ''}`} style={{ background: bg, transition: 'background 320ms linear' }}>
      <div className="execTopbar">
        <div className="execTitle">
          <div className="execTitleMain">{snapshot?.lessonTitle || 'Durchführung'}</div>
          {snapshot?.meta ? <div className="execTitleSub">{snapshot.meta}</div> : null}
        </div>

        <div className="execActions">
          <button className="btn" onClick={()=>setIsCountdownOn(v=>!v)}>
            Countdown: {isCountdownOn ? 'An' : 'Aus'}
          </button>
          <button className="btn" onClick={()=>setIsPaused(p=>!p)}>
            {isPaused ? 'Weiter' : 'Pause'}
          </button>
          <button className="btn" onClick={toggleFullscreen}>Vollbild</button>
          <button className="btn danger" onClick={()=>window.close?.()}>Schließen</button>
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
              <button className="btn" onClick={goPrev} disabled={idx<=0}>←</button>
              <button className="btn" onClick={goNext} disabled={idx>=phases.length}>→</button>
            </div>
          </div>
        ) : (
          <div className="execCard">
            <div className="execCardHeader">
              <div className="execCornerLeft">
                <div className="execCornerChip">Phase {idx + 1} / {phases.length}</div>
                <div className="execCornerChip">{Number(phase?.duration) || 0} min</div>
                {(phase?.start || phase?.end) ? (
                  <div className="execCornerChip">{phase?.start ? `${phase.start}` : ''}{(phase?.start && phase?.end) ? ' – ' : ''}{phase?.end ? phase.end : ''}</div>
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
                    <div className="execBlockTitle">Materialien & Medien</div>
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
              <button className="btn" onClick={goPrev} disabled={idx<=0}>←</button>
              <button className="btn" onClick={goNext} disabled={idx>=phases.length}>→</button>
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
function keyOf(dayIndex, slotIndex){ return `${dayIndex}-${slotIndex}`; }

function defaultLesson(){
  return {
    subject: '',
    classGroup: '',
    room: '',
    topic: '',
    objectives: '',
    phases: [
      { id: uid(), title: 'Einstieg', duration: 5, socialForm: '', content: '', materialsMedia: '', remarks: '' },
      { id: uid(), title: 'Erarbeitung', duration: 20, socialForm: '', content: '', materialsMedia: '', remarks: '' },
      { id: uid(), title: 'Sicherung', duration: 15, socialForm: '', content: '', materialsMedia: '', remarks: '' },
      { id: uid(), title: 'Abschluss', duration: 5, socialForm: '', content: '', materialsMedia: '', remarks: '' }
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
    updatedAt: new Date().toISOString()
  };
}

function normalizePhases(phases){
  // Ensure sum = TOTAL_MIN, min durations
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
      duration: Math.max(MIN_PHASE_MIN, Math.round(src.duration || 0))
    };
  });
  let sum = p.reduce((a,b)=>a+b.duration,0);
  if (sum === TOTAL_MIN) return p;
  if (sum === 0) {
    p[0].duration = TOTAL_MIN;
    return p;
  }
  // adjust last phase to fit
  const diff = TOTAL_MIN - sum;
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
  if (sum !== TOTAL_MIN) {
    const delta = TOTAL_MIN - sum;
    p[0].duration = Math.max(MIN_PHASE_MIN, p[0].duration + delta);
  }
  return p;
}


function normalizeLesson(lesson){
  const base = defaultLesson();
  const l = (lesson && typeof lesson === 'object') ? lesson : {};
  const phases = normalizePhases(l.phases || base.phases);
  return {
    ...base,
    ...l,
    sequenceId: l.sequenceId || '',
    primaryCompetency: l.primaryCompetency || '',
    competencies: Array.isArray(l.competencies) ? l.competencies : [],
    files: Array.isArray(l.files) ? l.files : [],
    links: Array.isArray(l.links) ? l.links : [],
    phases,
    updatedAt: l.updatedAt || base.updatedAt
  };
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// Some environments can fail on `structuredClone` for certain objects.
// Use a safe deep-clone helper so persistence/editing never breaks silently.
function deepClone(obj){
  try {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.deepClone(obj);
    }
  } catch {}
  // Fallback: JSON clone (OK for our plain data objects)
  return JSON.parse(JSON.stringify(obj ?? null));
}


function ensureDbShape(raw){
  const db = (raw && typeof raw === 'object') ? raw : {};
  if (!('schemaVersion' in db)) db.schemaVersion = 1;
  if (!db.socialForms || typeof db.socialForms !== 'object') db.socialForms = {};
  // Phase names (Phasenname) suggestions
  if (!db.phaseNames || typeof db.phaseNames !== 'object') db.phaseNames = {};
  if (!db.competencies || typeof db.competencies !== 'object') db.competencies = {};
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
      supervisionLabels: {}
    };
  } else {
    if (!db.hiddenSuggestions.socialForms || typeof db.hiddenSuggestions.socialForms !== 'object') db.hiddenSuggestions.socialForms = {};
    if (!db.hiddenSuggestions.phaseNames || typeof db.hiddenSuggestions.phaseNames !== 'object') db.hiddenSuggestions.phaseNames = {};
    if (!db.hiddenSuggestions.classGroups || typeof db.hiddenSuggestions.classGroups !== 'object') db.hiddenSuggestions.classGroups = {};
    if (!db.hiddenSuggestions.subjects || typeof db.hiddenSuggestions.subjects !== 'object') db.hiddenSuggestions.subjects = {};
    if (!db.hiddenSuggestions.competencies || typeof db.hiddenSuggestions.competencies !== 'object') db.hiddenSuggestions.competencies = {};
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
  if (db.schemaVersion < 2) db.schemaVersion = 2;
  if (db.schemaVersion < 3) db.schemaVersion = 3;
  if (db.schemaVersion < 4) db.schemaVersion = 4;
  if (db.schemaVersion < 5) db.schemaVersion = 5;
  if (db.schemaVersion < 6) db.schemaVersion = 6;
  if (db.schemaVersion < 7) db.schemaVersion = 7;
  if (db.schemaVersion < 8) db.schemaVersion = 8;
  if (db.schemaVersion < 8) db.schemaVersion = 8;

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
      createdAt: o.createdAt || new Date().toISOString(),
      updatedAt: o.updatedAt || o.createdAt || new Date().toISOString()
    };
  }).filter(Boolean);

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
  }

  // Normalize templates (ensure id/lessons)
  for (const [id, t] of Object.entries(db.sequenceTemplates)){
    if (!t || typeof t !== 'object') { db.sequenceTemplates[id] = { id, name: String(id), subject: '', createdAt: new Date().toISOString(), lessons: [] }; continue; }
    if (!t.id) t.id = id;
    if (!t.name) t.name = String(id);
    if (!Array.isArray(t.lessons)) t.lessons = [];
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


  return db;
}


function hashCode(str){
  let h = 0;
  for (let i=0;i<str.length;i++){ h = ((h<<5)-h) + str.charCodeAt(i); h |= 0; }
  return h;
}


function useDB(){
  const [db, setDb] = useState(null);
  const saveTimer = useRef(null);

  const api = (typeof window !== 'undefined' && window.api) ? window.api : null;

  useEffect(()=> {
    let cancelled = false;
    (async ()=>{
      if (api) {
        const loaded = ensureDbShape(await api.getDB());
        if (!cancelled) setDb(loaded);
      } else {
        // fallback for browser
        const raw = localStorage.getItem('lehrerplan_db');
        setDb(raw ? JSON.parse(raw) : { schemaVersion:8, socialForms:{}, phaseNames:{}, hiddenSuggestions:{ socialForms:{}, phaseNames:{}, classGroups:{}, subjects:{}, competencies:{}, supervisionLabels:{} }, competencies:{}, classGroups:{}, subjects:{}, groupColors:{}, supervisionLabels:{}, todos:[], sequences:{}, sequenceTemplates:{}, yearBars:[], schoolCalendar:{ schoolYear:{startISO:'', endISO:''}, lessonTimesEnabled:false, lessonTimes:[], vacations:[], freeDays:[], events:[] }, weeks:{}, appSettings:{ fileCopyOptIn:false } });
      }
    })();
    return ()=> { cancelled = true; };
  }, []);

  const persist = (nextDb) => {
    setDb(nextDb);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async ()=>{
      if (api) await api.setDB(nextDb);
      else localStorage.setItem('lehrerplan_db', JSON.stringify(nextDb));
    }, 250);
  };

  return { db, persist, api };
}

export default function App(){
  const { db, persist, api } = useDB();
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
    if (!ns || !ne) { alert('Bitte Start- und Enddatum des neuen Schuljahres angeben.'); return; }
    if (ne < ns) { alert('Das Enddatum muss nach dem Startdatum liegen.'); return; }

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
        supervisionLabels: nextDb.supervisionLabels || {}
      }
    });

    // Reset year-specific planning data
    nextDb.weeks = {};
    nextDb.sequences = {};
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
    if (view.name === 'week' || view.name === 'macro' || view.name === 'calendar') lastMainView.current = view;
  }, [view]);

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

  const appSettings = db?.appSettings || { fileCopyOptIn: false };
  const updateAppSettings = (patch) => {
    try {
      const nextDb = deepClone(db);
      nextDb.appSettings = { ...(nextDb.appSettings || {}), ...(patch || {}) };
      persist(nextDb);
    } catch {}
  };

const todos = Array.isArray(db?.todos) ? db.todos : [];
const todayISO = toISODate(new Date());
const todosDueTodayCount = useMemo(()=>{
  return todos.filter(t => !t.done && ((t.dateISO || '') === todayISO || (t.deadlineISO || '') === todayISO)).length;
}, [todos, todayISO]);


useEffect(()=>{
  if (splashVisible) return;
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

  if (!db) {
    return <div className="app">
      <div className="topbar">
        <div className="left">
          <img className="logo" src={logo} alt="Prép-ybara Logo" />
          <h1>Prép-ybara</h1>
        </div>
      </div>
      <div className="content"><div className="card">Lade Daten…</div></div>
      <div className="appFooter">
        <span>Prép-ybara, Version {APP_VERSION}</span>
        <span>© Florian Nowak</span>
      </div>
      <SplashOverlay visible={splashVisible} />
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

  const deleteLessonAt = (weekStart, dayIndex, slotIndex) => {
    const k = keyOf(dayIndex, slotIndex);
    try { draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex}`); } catch {}
    const nextDb = deepClone(db);
    const w = nextDb.weeks?.[weekStart];
    if (!w || !w.lessons) return;
    if (k in w.lessons) {
      delete w.lessons[k];
      persist(nextDb);
    }
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
    const cloned = normalizeLesson(deepClone(l));
    // Neue IDs für Phasen, damit du beim Kopieren nicht versehentlich identische IDs hast.
    cloned.phases = normalizePhases((cloned.phases || []).map(p => ({ ...p, id: uid() })));
    setLessonClipboard({ lesson: cloned, source: { weekStart, dayIndex, slotIndex }, cut: false, copiedAt: Date.now() });
  };

  const cutLessonToClipboard = (weekStart, dayIndex, slotIndex) => {
    const persisted = db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)] || null;
    if (!persisted) return;
    const l = normalizeLesson(deepClone(persisted));
    l.phases = normalizePhases((l.phases || []).map(p => ({ ...p, id: uid() })));
    setLessonClipboard({ lesson: l, source: { weekStart, dayIndex, slotIndex }, cut: true, copiedAt: Date.now() });
    deleteLessonAt(weekStart, dayIndex, slotIndex);
  };

  const pasteLessonFromClipboard = (weekStart, dayIndex, slotIndex) => {
    if (!lessonClipboard?.lesson) return;
    const targetHas = !!(db?.weeks?.[weekStart]?.lessons?.[keyOf(dayIndex, slotIndex)]);
    if (targetHas) {
      const ok = window.confirm('Zielstunde ist bereits belegt. Überschreiben?');
      if (!ok) return;
    }
    const l = normalizeLesson(deepClone(lessonClipboard.lesson));
    l.updatedAt = new Date().toISOString();
    updateLessonAt(weekStart, dayIndex, slotIndex, l);
    if (lessonClipboard.cut) setLessonClipboard(null);
  };

  const moveOrCopyLessonByDnd = ({ from, to, mode = 'move' }) => {
    const f = from || {};
    const t = to || {};
    if (!f.weekStart || !t.weekStart) return;
    if (f.weekStart === t.weekStart && f.dayIndex === t.dayIndex && f.slotIndex === t.slotIndex) return;

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
        const ok = window.confirm('Zielstunde ist bereits belegt. Überschreiben?');
        if (!ok) return;
      }
      const cloned = normalizeLesson(deepClone(src));
      cloned.phases = normalizePhases((cloned.phases || []).map(p => ({ ...p, id: uid() })));
      upsertIn(toW, toKey, cloned);
      persist(nextDb);
      return;
    }

    // move (standard): swap, wenn Ziel belegt
    const dstRaw = toW.lessons?.[toKey];
    if (dstRaw) {
      const dst = normalizeLesson(deepClone(dstRaw));
      upsertIn(toW, toKey, src);
      upsertIn(fromW, fromKey, dst);
      persist(nextDb);
      return;
    }

    // Ziel leer: verschieben
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
    const key = `${dayIndex}-${pos}`;
    const nextDb = deepClone(db);
    const w = nextDb.weeks?.[weekStart];
    if (!w || !w.duties) return;
    if (key in w.duties) {
      delete w.duties[key];
      persist(nextDb);
    }
  };


const updateLessonAt = (weekStart, dayIndex, slotIndex, nextLesson) => {
  const nextDb = deepClone(db);
  if (!nextDb.weeks) nextDb.weeks = {};
  const w = nextDb.weeks[weekStart] || { slotsPerDay: 6, lessons: {}, duties: {} };
  if (!nextDb.weeks[weekStart]) nextDb.weeks[weekStart] = w;
  if (!w.lessons) w.lessons = {};
  const l = normalizeLesson(nextLesson);
  w.lessons[keyOf(dayIndex, slotIndex)] = { ...l, updatedAt: new Date().toISOString() };
  rememberClassGroupIn(nextDb, l.classGroup);
  rememberSubjectIn(nextDb, l.subject);
  ensureGroupColorIn(nextDb, l.classGroup, l.subject);

  // This slot now has a persisted lesson; drop any cached draft.
  try { draftLessonCacheRef.current.delete(`${weekStart}|${dayIndex}|${slotIndex}`); } catch {}
  persist(nextDb);
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

  const exportBackup = async () => {
    if (!api) {
      alert('Backup-Export ist nur in der Desktop-App verfügbar.');
      return;
    }
    const path = await api.exportBackup();
    if (path) alert(`Backup gespeichert:\n${path}`);
  };

  const importBackup = async () => {
    if (!api) {
      alert('Backup-Import ist nur in der Desktop-App verfügbar.');
      return;
    }
    const imported = await api.importBackup();
    if (imported) {
      persist(imported);
      alert('Backup importiert.');
    }
  };

  const createSequence = (name) => {
    // If user cancelled a prompt, keep quiet.
    if (name == null) return null;
    const n = String(name || '').trim();
    if (!n) {
      // Previously this failed silently and felt like "not allowed".
      alert('Bitte einen Sequenznamen eingeben.');
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

  const deleteSequence = (id) => {
    const nextDb = deepClone(db);
    if (!nextDb.sequences?.[id]) return;
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
    persist(nextDb);
  };

  // --- Jahresgrobplanung (Orientierungs-Balken) ---
  const createYearBar = (payload) => {
    const p = (payload && typeof payload === 'object') ? payload : {};
    const title = String(p.title || '').trim();
    if (!title) {
      alert('Bitte einen Titel für den Balken eingeben.');
      return null;
    }
    const startISO = String(p.startISO || '').trim();
    const endISO = String(p.endISO || '').trim();
    if (!startISO || !endISO) {
      alert('Bitte Start- und Enddatum wählen.');
      return null;
    }
    if (endISO < startISO) {
      alert('Enddatum muss nach dem Startdatum liegen.');
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
      createdAt: now,
      updatedAt: now
    });
    persist(nextDb);
    return id;
  };

  const updateYearBar = (id, patch) => {
    const nextDb = deepClone(db);
    const arr = Array.isArray(nextDb.yearBars) ? nextDb.yearBars : [];
    const idx = arr.findIndex(b => b?.id === id);
    if (idx < 0) return;
    const curr = arr[idx];
    const p = (patch && typeof patch === 'object') ? patch : {};
    const next = { ...curr, ...p, id, updatedAt: new Date().toISOString() };
    // minimal validation
    if (next.startISO && next.endISO && next.endISO < next.startISO) return;
    arr[idx] = next;
    nextDb.yearBars = arr;
    persist(nextDb);
  };

  const deleteYearBar = (id) => {
    const nextDb = deepClone(db);
    nextDb.yearBars = (Array.isArray(nextDb.yearBars) ? nextDb.yearBars : []).filter(b => b?.id !== id);
    persist(nextDb);
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
  const existing = nextDb.classGroups[l] || { count: 0, lastUsed: '' };
  existing.count = (existing.count || 0) + 1;
  existing.lastUsed = new Date().toISOString();
  nextDb.classGroups[l] = existing;
};

const rememberSubjectIn = (nextDb, label) => {
  const l = (label || '').trim();
  if (!l) return;

  if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {} };
  if (!nextDb.hiddenSuggestions.subjects) nextDb.hiddenSuggestions.subjects = {};
  if (nextDb.hiddenSuggestions.subjects[l]) delete nextDb.hiddenSuggestions.subjects[l];

  if (!nextDb.subjects) nextDb.subjects = {};
  const existing = nextDb.subjects[l] || { count: 0, lastUsed: '' };
  existing.count = (existing.count || 0) + 1;
  existing.lastUsed = new Date().toISOString();
  nextDb.subjects[l] = existing;
};


const rememberSupervisionIn = (nextDb, label) => {
  const l = (label || '').trim();
  if (!l) return;

  if (!nextDb.hiddenSuggestions) nextDb.hiddenSuggestions = { socialForms: {}, phaseNames: {}, classGroups: {}, subjects: {}, competencies: {}, supervisionLabels: {} };
  if (!nextDb.hiddenSuggestions.supervisionLabels) nextDb.hiddenSuggestions.supervisionLabels = {};
  if (nextDb.hiddenSuggestions.supervisionLabels[l]) delete nextDb.hiddenSuggestions.supervisionLabels[l];

  if (!nextDb.supervisionLabels) nextDb.supervisionLabels = {};
  const existing = nextDb.supervisionLabels[l] || { count: 0, lastUsed: '' };
  existing.count = (existing.count || 0) + 1;
  existing.lastUsed = new Date().toISOString();
  nextDb.supervisionLabels[l] = existing;
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
  const nextDb = deepClone(db);
  const arr = Array.isArray(nextDb.todos) ? nextDb.todos : [];
  nextDb.todos = arr.filter(t => t?.id !== id);
  persist(nextDb);
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
      alert('In dieser Sequenz sind noch keine Stunden zugeordnet.');
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

    const lessons = items.map(({ lesson }) => ({
      topic: lesson.topic || '',
      objectives: lesson.objectives || '',
      phases: (lesson.phases || []).map(p => ({ ...p, id: p?.id || uid() })),
      homework: lesson.homework || '',
      notes: lesson.notes || '',
      competencies: Array.isArray(lesson.competencies) ? lesson.competencies : [],
      primaryCompetency: lesson.primaryCompetency || ''
    }));

    const nextDb = deepClone(db);
    if (!nextDb.sequenceTemplates) nextDb.sequenceTemplates = {};
    const id = uid();
    nextDb.sequenceTemplates[id] = {
      id,
      name,
      subject,
      color: seq?.color || '',
      createdAt: new Date().toISOString(),
      lessons
    };
    persist(nextDb);
    return id;
  };

  const deleteTemplate = (templateId) => {
    const nextDb = deepClone(db);
    if (!nextDb.sequenceTemplates?.[templateId]) return;
    delete nextDb.sequenceTemplates[templateId];
    persist(nextDb);
  };

  const exportTemplates = async () => {
    if (!api) { alert('Export ist nur in der Desktop-App verfügbar.'); return; }
    const path = await api.exportTemplates();
    if (path) alert(`Sequenz-Vorlagen exportiert:\n${path}`);
  };

  const importTemplates = async () => {
    if (!api) { alert('Import ist nur in der Desktop-App verfügbar.'); return; }
    const importedDb = await api.importTemplates();
    if (importedDb) {
      persist(ensureDbShape(importedDb));
      alert('Sequenz-Vorlagen importiert.');
    }
  };

  const isLessonEmpty = (raw) => {
    const l = normalizeLesson(raw);
    const hasText = (l.topic || l.objectives || l.homework || l.notes || '').trim().length > 0;
    const hasComps = (l.primaryCompetency || '').trim() || (Array.isArray(l.competencies) && l.competencies.length);
    const hasPhaseContent = (l.phases || []).some(p => (p.title || '').trim() || (p.socialForm || '').trim() || (p.content || '').trim());
    // A brand-new default lesson has titles; consider it empty if only titles exist and no content/socialforms.
    const hasMeaningfulPhase = (l.phases || []).some(p => (p.socialForm || '').trim() || (p.content || '').trim());
    return !hasText && !hasComps && !hasMeaningfulPhase;
  };

  const insertTemplateIntoPlan = ({ templateId, targetGroup, subject, startISO, overwrite, sequenceName }) => {
    const tpl = templates?.[templateId];
    if (!tpl) return { inserted: 0, missing: 0 };
    const group = (targetGroup || '').trim();
    if (!group) { alert('Bitte Lerngruppe wählen.'); return { inserted: 0, missing: 0 }; }
    const subj = (subject || tpl.subject || '').trim();
    if (!subj) { alert('Bitte Fach angeben.'); return { inserted: 0, missing: 0 }; }

    const blueprints = Array.isArray(tpl.lessons) ? tpl.lessons : [];
    if (blueprints.length === 0) { alert('Diese Vorlage enthält keine Stunden.'); return { inserted: 0, missing: 0 }; }

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
        const nextLesson = normalizeLesson(l);
        nextLesson.classGroup = group;
        nextLesson.subject = (l.subject || '').trim() || subj;
        // room comes from timetable (keep existing)
        nextLesson.room = (l.room || '').trim();
        nextLesson.topic = bp.topic || '';
        nextLesson.objectives = bp.objectives || '';
        nextLesson.phases = normalizePhases((bp.phases || []).map(p => ({ ...p, id: p?.id || uid() })));
        nextLesson.homework = bp.homework || '';
        nextLesson.notes = bp.notes || '';
        nextLesson.competencies = Array.isArray(bp.competencies) ? bp.competencies : [];
        nextLesson.primaryCompetency = bp.primaryCompetency || (nextLesson.competencies?.[0] || '');
        nextLesson.sequenceId = seqId;
        nextLesson.updatedAt = new Date().toISOString();

        if (!w.lessons) w.lessons = {};
        w.lessons[k] = nextLesson;
        inserted += 1;
        bpIndex += 1;
      }
    }

    persist(nextDb);

    const missing = Math.max(0, blueprints.length - inserted);
    return { inserted, missing, sequenceId: seqId };
  };


  const doExportPdf = async (html, suggestedName) => {
    if (!api) {
      alert('PDF-Export ist nur in der Desktop-App verfügbar.');
      return;
    }
    const saved = await api.exportPdf({ html, suggestedFileName: suggestedName });
    if (saved) alert(`PDF gespeichert:\n${saved}`);
  };


const doExportDocx = async (html, suggestedName) => {
  // Wir exportieren bewusst als .doc (HTML), weil das auf allen Word-Versionen
  // zuverlässig öffnet. ("echtes" .docx hatte bei manchen Systemen Probleme.)
  if (!api) {
    alert('Word-Export ist nur in der Desktop-App verfügbar.');
    return;
  }
  const safe = String(suggestedName || 'Unterrichtsstunde.doc').replace(/\.docx$/i, '.doc');
  const saved = await api.exportDocx({ html, suggestedFileName: safe });
  if (saved) alert(`Word-Datei gespeichert:\n${saved}`);
};

  // Render main content in a readable way (avoids a very long nested ternary inside JSX,
  // which is easy to break and hard to maintain).
  const mainContent = (() => {
    if (view.name === 'week') {
      return (
        <WeekView
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
          onCutLesson={(dayIndex, slotIndex)=>cutLessonToClipboard(view.weekStart, dayIndex, slotIndex)}
          onPasteLesson={(dayIndex, slotIndex)=>pasteLessonFromClipboard(view.weekStart, dayIndex, slotIndex)}
          onLessonDnd={(payload)=>moveOrCopyLessonByDnd(payload)}
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
            const def = seq?.name || '';
            const name = window.prompt('Name der Sequenz-Vorlage:', def);
            if (!name) return;
            const tid = createTemplateFromSequence(sequenceId, name);
            if (tid) {
              alert('Vorlage gespeichert. Du findest sie in der Bibliothek.');
            }
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
          onUpdateBar={(id, patch)=>updateYearBar(id, patch)}
          onDeleteBar={(id)=>deleteYearBar(id)}
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
          minDate={minDate}
          maxDate={maxDate}
          classGroupSuggestions={classGroupSuggestions}
          subjectSuggestions={subjectSuggestions}
          onHideClassGroupSuggestion={(label)=>hideSuggestion('classGroup', label)}
          onHideSubjectSuggestion={(label)=>hideSuggestion('subject', label)}
          onCreateTemplateFromSequence={(sequenceId)=>{
            const seq = sequences?.[sequenceId];
            const name = window.prompt('Name der Sequenz-Vorlage:', seq?.name || '');
            if (!name) return;
            const tid = createTemplateFromSequence(sequenceId, name);
            if (tid) alert('Vorlage gespeichert.');
          }}
          onDeleteTemplate={(id)=>{
            const t = templates?.[id];
            if (window.confirm(`Vorlage "${t?.name || ''}" löschen?`)) deleteTemplate(id);
          }}
          onExportTemplates={exportTemplates}
          onImportTemplates={importTemplates}
          onInsert={(payload)=>{
            const res = insertTemplateIntoPlan(payload);
            if (res.inserted > 0) {
              alert(`Eingefügt: ${res.inserted} Stunde(n)${res.missing ? `\nNicht platziert: ${res.missing}` : ''}`);
              // Jump to macro plan around start
              setView({ name:'macro', weekStart: toISODate(startOfWeekMonday(fromISODate(payload.startISO))), startISO: payload.startISO, rangeDays: 28 });
            } else {
              alert('Keine passenden Stundenplätze gefunden. Tipp: Stelle sicher, dass der Stundenplan (Klasse/Fach/Raum) in den Zielwochen bereits angelegt ist.');
            }
          }}
        />
      );
    }
    if (view.name === 'todos') {
      return (
        <TodoView
          weekStart={view.weekStart}
          todos={todos}
          onAddTodo={addTodo}
          onUpdateTodo={updateTodo}
          onDeleteTodo={deleteTodo}
          onBack={()=>setView({ ...lastMainView.current })}
        />
      );
    }
    if (view.name === 'help') {
      return <HelpView version={APP_VERSION} />;
    }
    if (view.name === 'execution') {
      return <ExecutionWindow api={api} />;
    }
    if (view.name === 'calendar') {
      return (
        <SchoolCalendarView
          calendar={schoolCalendar}
          archivesCount={(db.schoolYearArchives || []).length}
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

    // default: Einzelstunde
    return (
      <LessonView
        weekStart={view.weekStart}
        dayIndex={view.dayIndex}
        slotIndex={view.slotIndex}
        lesson={getLessonAt(view.weekStart, view.dayIndex, view.slotIndex)}
        exists={hasLessonAt(view.weekStart, view.dayIndex, view.slotIndex)}
        sequences={sequences}
        appSettings={appSettings}
        onUpdateAppSettings={updateAppSettings}
        schoolCalendar={schoolCalendar}
        competencySuggestions={competencySuggestions}
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
        onUpdateLesson={(nextLesson)=>updateLessonAt(view.weekStart, view.dayIndex, view.slotIndex, nextLesson)}
        onRememberSocialForm={rememberSocialForm}
        onRememberPhaseName={rememberPhaseName}
        onHideSocialFormSuggestion={(label)=>hideSuggestion('socialForm', label)}
        onHidePhaseNameSuggestion={(label)=>hideSuggestion('phaseName', label)}
        onHideClassGroupSuggestion={(label)=>hideSuggestion('classGroup', label)}
        onHideSubjectSuggestion={(label)=>hideSuggestion('subject', label)}
        onExportPdf={doExportPdf}
          onExportDocx={doExportDocx}
        onOpenExecution={(snapshot)=>{
          if (api?.openExecutionWindow) {
            api.openExecutionWindow(snapshot);
          } else {
            alert('Durchführungsansicht ist nur in der Desktop-App verfügbar.');
          }
        }}
        onDraftTopicChange={(t)=>{ lessonDraftTopicRef.current = String(t || ''); }}
        yearBars={db.yearBars || []}
        onOpenYearPlan={(focusISO)=>{
          setView({ name:'year', weekStart: view.weekStart, focusISO: String(focusISO || view.weekStart) });
        }}
        onDeleteLesson={() => {
          if (window.confirm('Diese Stunde wirklich löschen?')) {
            deleteLessonAt(view.weekStart, view.dayIndex, view.slotIndex);
            setView({ ...lastMainView.current });
          }
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
            >← Zurück</button>
          ) : null}
          <img className="logo" src={logo} alt="Prép-ybara Logo" />
          <h1>Prép-ybara</h1>
          <span className="badge">{
            view.name === 'macro'
              ? `${formatDateDE(view.startISO)} – ${formatDateDE(toISODate(addDays(fromISODate(view.startISO), (view.rangeDays||28)-1)))}`
              : (view.name === 'year'
                ? 'Jahresgrobplanung'
              : (view.name === 'library'
                ? 'Bibliothek'
                : (view.name === 'help'
                  ? 'Hilfe'
                  : (view.name === 'week'
                    ? ''
                    : formatWeekLabel(view.weekStart)
                  )
                )
              )
              )
          }</span>
        </div>

        <div className="right">
          {isHelpOnlyWindow ? (
            <button className="btn" onClick={()=>window.close?.()}>Schließen</button>
          ) : null}
          {!isHelpOnlyWindow && view.name === 'week' && (
            <>
              <button className="btn" onClick={()=>setView({ name:'year', weekStart: view.weekStart, focusISO: view.weekStart })}>Jahresgrobplanung</button>
              <button className="btn" onClick={()=>setView({ name:'macro', weekStart: view.weekStart, startISO: view.weekStart, rangeDays: 28 })}>Makro-Plan</button>
              <button className="btn" onClick={()=>setView({ name:'library', weekStart: view.weekStart })}>Bibliothek</button>
              <button className="btn" onClick={()=>setView({ name:'calendar', weekStart: view.weekStart })}>Schulkalender</button>
              <div className="weeknav" style={{display:'flex', gap:6, alignItems:'center'}}>
                <button className="btn" title="Vorherige Woche" onClick={()=>goWeekDelta(-1)}>←</button>
                <input className="input" style={{width:170}} type="date" min={minDate} max={maxDate} value={selectedDate} onChange={(e)=>onSelectWeekDate(e.target.value)} />
                <button className="btn" title="Nächste Woche" onClick={()=>goWeekDelta(1)}>→</button>
              </div>
              <button className="btn" onClick={()=>setShowWeekCopyDialog(true)}>In nächste Woche übernehmen</button>
              <button className="btn" onClick={()=>exportBackup()}>Backup exportieren</button>
              <button className="btn" onClick={()=>importBackup()}>Backup importieren</button>
            </>
          )}
        </div>
      </div>

      <div className="content">
        {mainContent}
      </div>

      <div className="appFooter">
        <span>Prép-ybara, Version {APP_VERSION}</span>
        <span>© Florian Nowak</span>
      </div>

      <SplashOverlay visible={splashVisible} />
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
        archivesCount={(db.schoolYearArchives || []).length}
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
          afterCreate={seqManagerModal.afterCreate}
          autoCloseOnCreate={seqManagerModal.autoCloseOnCreate}
          onSaveAsTemplate={(id)=>{
            const seq = sequences?.[id];
            const def = seq?.name || '';
            const name = window.prompt('Name der Sequenz-Vorlage:', def);
            if (!name) return;
            const tid = createTemplateFromSequence(id, name);
            if (tid) {
              alert('Vorlage gespeichert. Du findest sie in der Bibliothek.');
            }
          }}
          onExportPdfSequence={(id)=>{
            // re-use the same export logic as in Makro-Plan
            try {
              const seq = sequences?.[id];
              if (!seq) return;
              if (typeof doExportPdf !== 'function') {
                alert('PDF-Export ist nur in der Desktop-App verfügbar.');
                return;
              }

              const occ = [];
              const weeks = db?.weeks || {};
              for (const [ws, w] of Object.entries(weeks)) {
                const lessons = w?.lessons || {};
                for (const [k, raw] of Object.entries(lessons)) {
                  if (!raw) continue;
                  if ((raw.sequenceId || '') !== id) continue;
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
              doExportPdf(html, `Sequenz_${safe}.pdf`);
            } catch {}
          }}
          onExportDocxSequence={(id)=>{
            try {
              const seq = sequences?.[id];
              if (!seq) return;
              if (typeof doExportDocx !== 'function') {
                alert('Word-Export ist nur in der Desktop-App verfügbar.');
                return;
              }

              const occ = [];
              const weeks = db?.weeks || {};
              for (const [ws, w] of Object.entries(weeks)) {
                const lessons = w?.lessons || {};
                for (const [k, raw] of Object.entries(lessons)) {
                  if (!raw) continue;
                  if ((raw.sequenceId || '') !== id) continue;
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
              doExportDocx(html, `Sequenz_${safe}.doc`);
            } catch {}
          }}
        />
      )}
    </div>
  );
}

function WeekView({ weekStart, week, sequences, schoolCalendar, todos, todayISO, groupColors, duties, supervisionSuggestions, onHideSupervisionSuggestion = ()=>{},
  lessonClipboard, onCopyLesson, onCutLesson, onPasteLesson, onLessonDnd,
  onOpenGroupColorPalette, onOpenLesson, onOpenMacro, onOpenTodos, onChangeSlots, onDeleteLesson, onUpsertDuty, onDeleteDuty, onExportPdf, onExportDocx }){
  const slots = week.slotsPerDay || 6;
  const dutyMap = duties || week.duties || {};
  const [dutyEditor, setDutyEditor] = useState(null);
  const [dropKey, setDropKey] = useState(null);

  const dutyLabel = (pos) => {
    if (pos === 0) return 'vor der 1. Stunde';
    if (pos === slots) return 'nach der letzten Stunde';
    return `zwischen ${pos}. und ${pos+1}. Stunde`;
  };

  const openDutyEditor = (dayIndex, pos) => {
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
        <div className="dutyRowLabel" title={dutyLabel(pos)}>{dutyRowLabelShort(pos)}</div>
        {DAYS.map((_, dayIndex)=>{
          const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
          const info = getDayInfo(dateISO, schoolCalendar);
          const dutyKey = `${dayIndex}-${pos}`;
          const duty = dutyMap[dutyKey];
          return (
            <div
              key={`duty-${pos}-${dayIndex}`}
              className={`dutyCell ${duty ? 'dutyCell--has' : ''} ${info.isOff ? 'dayOffDutyCell' : ''}`}
              onClick={(e)=>{ e.stopPropagation(); openDutyEditor(dayIndex, pos); }}
              title={duty ? `Aufsicht: ${duty.title}` : 'Aufsicht eintragen'}
              aria-label={duty ? `Aufsicht bearbeiten: ${duty.title}` : 'Aufsicht eintragen'}
              role="button"
              tabIndex={0}
              onKeyDown={(e)=>{
                if (e.key === 'Enter' || e.key === ' '){
                  e.preventDefault();
                  openDutyEditor(dayIndex, pos);
                }
              }}
            >
              <span className="dutyCellPlus">{duty ? '' : '+'}</span>
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
      alert('PDF-Export ist nur in der Desktop-App verfügbar.');
      return;
    }
    const html = buildWeekPdfHtml({ weekStart, week, sequences, groupColors, schoolCalendar, duties: dutyMap });
    const ws = (weekStart || '').replaceAll('-', '');
    onExportPdf(html, `Wochenplan_${ws}.pdf`);
  };


const exportWeekDocx = () => {
  if (typeof onExportDocx !== 'function') {
    alert('Word-Export ist nur in der Desktop-App verfügbar.');
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
          <div className="muted small">Klicke auf eine Stunde, um in die Einzelstundenplanung zu zoomen.</div>
          <span className="badge" style={{marginTop:6}}>{formatWeekLabel(weekStart)}</span>
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn warning" onClick={onOpenTodos} title="To-do-Checkliste öffnen">To-dos{todayTodoCount ? ` (${todayTodoCount})` : ''}</button>
          <button className="btn iconBtn-word" onClick={exportWeekDocx} title="Als Word-Datei speichern"><img src={wordIcon} alt="" className="btnIcon" />Word Woche</button>
          <button className="btn iconBtn-pdf" onClick={exportWeekPdf} title="Als PDF speichern"><img src={pdfIcon} alt="" className="btnIcon" />PDF Woche</button>
          <span className="muted small">Stunden pro Tag:</span>
          <input className="input" style={{width:90}} type="number" min={1} max={12} value={slots} onChange={(e)=>onChangeSlots(Number(e.target.value||slots))} />
        </div>
      </div>

      <div style={{height:12}} />

      <div className="grid">
        <div />
        {DAYS.map((d, dayIndex) => {
          const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
          const info = getDayInfo(dateISO, schoolCalendar);
          const label = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
          const tc = todoCountByISO.get(dateISO) || 0;
          const isToday = (dateISO === todayISO);
          return (
            <div key={d} className={`cellHeader ${info.isOff ? 'dayOffHeader' : ''}`} title={label}>
              <div style={{fontWeight:700}}>{d}</div>
              <div className="muted small">{formatDateDE(dateISO)}</div>
              {tc ? (
                <button className="todoHint" onClick={(e)=>{ e.stopPropagation(); if (onOpenTodos) onOpenTodos(); }} title="To-dos ansehen (Inhalt wird erst nach Klick gezeigt)">📝 {tc}</button>
              ) : null}
              {label ? <span className="badge" style={{marginTop:4}}>{label}</span> : null}
            </div>
          );
        })}

        {Array.from({length: slots}).map((_, slotIndex)=>{
          return (
            <React.Fragment key={slotIndex}>
              {slotIndex === 0 ? renderDutyRow(0) : null}

              <div className="slotLabel">{slotIndex+1}. Stunde</div>
              {Array.from({length: DAYS.length}).map((__, dayIndex)=>{
                const dateISO = toISODate(addDays(fromISODate(weekStart), dayIndex));
                const info = getDayInfo(dateISO, schoolCalendar);
                const dayLabel = info.vac ? `Ferien: ${info.vac.name || ''}` : (info.fd ? `Schulfrei: ${info.fd.name || ''}` : '');
                const k = keyOf(dayIndex, slotIndex);
                const l = week.lessons?.[k];
                const title = l?.subject ? l.subject : (l?.topic ? l.topic : 'Planen…');
                const sub = l?.classGroup || '';
                const seq = l?.sequenceId ? (sequences?.[l.sequenceId] || null) : null;
                const gKey = l ? groupKey(l.classGroup, l.subject) : '';
                const gColor = gKey ? (groupColors?.[gKey]?.color || defaultGroupColor(gKey)) : '';
                const cellStyle = gColor ? { borderLeft: `7px solid ${gColor}`, background: hexToRgba(gColor, info.isOff ? 0.07 : 0.12) } : undefined;
                return (
                  <div
                    key={k}
                    style={cellStyle}
                    className={`lessonCell ${info.isOff ? 'dayOffCell' : ''} ${gKey ? 'hasGroupColor' : ''} ${dropKey === k ? 'dropTarget' : ''}`}
                    tabIndex={0}
                    onClick={()=>onOpenLesson(dayIndex, slotIndex)}
                    title={dayLabel ? `${dayLabel} (trotzdem öffnen)` : (l ? 'Öffnen (ziehen zum Verschieben, Ctrl+Ziehen zum Kopieren)' : 'Öffnen')}
                    draggable={!!l}
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
                      try {
                        const types = Array.from(e.dataTransfer.types || []);
                        if (!types.includes('application/x-prepybara-lesson')) return;
                        e.preventDefault();
                        setDropKey(k);
                      } catch {}
                    }}
                    onDragLeave={()=>{ if (dropKey === k) setDropKey(null); }}
                    onDrop={(e)=>{
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

                    {(l || lessonClipboard) ? (
                      <div className="cellTools" onClick={(e)=>e.stopPropagation()}>
                        {l ? (
                          <>
                            <button
                              className="iconBtn cellTool"
                              onClick={()=>onCopyLesson?.(dayIndex, slotIndex)}
                              title="Stunde kopieren (interne Zwischenablage)"
                              aria-label="Stunde kopieren"
                            >📋</button>
                            <button
                              className="iconBtn cellTool"
                              onClick={()=>onCutLesson?.(dayIndex, slotIndex)}
                              title="Stunde ausschneiden (interne Zwischenablage)"
                              aria-label="Stunde ausschneiden"
                            >✂️</button>
                          </>
                        ) : null}
                        {lessonClipboard ? (
                          <button
                            className="iconBtn cellTool"
                            onClick={()=>onPasteLesson?.(dayIndex, slotIndex)}
                            title="Stunde einfügen"
                            aria-label="Stunde einfügen"
                          >📌</button>
                        ) : null}

                        {l ? (
                          <button
                            className="iconBtn danger cellTool"
                            onClick={(e)=>{
                              e.stopPropagation();
                              if (window.confirm('Stunde löschen?')) onDeleteLesson(dayIndex, slotIndex);
                            }}
                            title="Stunde löschen"
                            aria-label="Stunde löschen"
                          >🗑</button>
                        ) : null}
                      </div>
                    ) : null}
                    {gKey ? (
                      <button
                        className="groupColorChip groupColorChip--corner"
                        style={{background: gColor}}
                        onClick={(e)=>{
                          e.stopPropagation();
                          onOpenGroupColorPalette?.(gKey, `${l?.classGroup || ''} · ${l?.subject || ''}`.trim());
                        }}
                        title="Farbe der Lerngruppe ändern"
                        aria-label="Farbe der Lerngruppe ändern"
                      />
                    ) : null}
                    <div className="title">{title || 'Planen…'}</div>
                    <div className="sub">{sub}</div>
                    {seq ? <span className="badge" style={{borderColor: seq.color, color: seq.color}}>Sequenz: {seq.name}</span> : null}
                    {l?.topic ? <span className="badge">Thema: {l.topic}</span> : <span className="badge">Noch kein Thema</span>}
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
          if (window.confirm('Aufsicht löschen?')) onDeleteDuty?.(dutyEditor.dayIndex, dutyEditor.pos);
          setDutyEditor(null);
        }}
      />

    </div>
  );
}

function SchoolCalendarView({ calendar, onUpdate, onStartNewSchoolYear, archivesCount = 0 }){
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
          <div className="muted small">Schuljahr, Ferien, schulfreie Tage und Termine – inklusive ICS-Import.</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            style={{display:'none'}}
            onChange={(e)=>onIcsSelected(e.target.files?.[0])}
          />
          <button className="btn" onClick={onPickIcs}>ICS importieren…</button>
          <button className="btn" onClick={()=>onStartNewSchoolYear?.()}>Neues Schuljahr…</button>
          <span className="pill" title="Archivierte Schuljahre">Archiv: {archivesCount}</span>
        </div>
      </div>

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
          {vacations.length === 0 ? <div className="muted small">Noch keine Ferien eingetragen.</div> : vacations.map(v => (
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
          {freeDays.length === 0 ? <div className="muted small">Noch keine schulfreien Tage eingetragen.</div> : freeDays.map(f => (
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
          {events.length === 0 ? <div className="muted small">Noch keine Termine eingetragen.</div> : events.map(ev => (
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
  appSettings,
  onUpdateAppSettings,
  schoolCalendar,
  competencySuggestions,
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
  classGroupSuggestions,
  subjectSuggestions,
  onRememberClassGroup,
  onRememberSubject,
  onHideClassGroupSuggestion,
  onHideSubjectSuggestion,
  groupColors,
  onOpenGroupColorPalette,
  onDraftTopicChange,
  yearBars,
  onOpenYearPlan,
}){
  const normalizeForLocal = (l) => ({
    ...l,
    sequenceId: l.sequenceId || '',
    primaryCompetency: l.primaryCompetency || '',
    competencies: Array.isArray(l.competencies) ? l.competencies : [],
    files: Array.isArray(l.files) ? l.files : [],
    links: Array.isArray(l.links) ? l.links : [],
    phases: normalizePhases(l.phases || []),
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
      phases: normalizePhases(n.phases || []).map(p => ({
        title: p.title || '',
        duration: Number(p.duration || 0),
        socialForm: p.socialForm || '',
        content: p.content || '',
        materialsMedia: p.materialsMedia || '',
        remarks: p.remarks || '',
      })),
    };
    return JSON.stringify(simple);
  };

  const [local, setLocal] = useState(() => normalizeForLocal(lesson));
  // Keep a ref to the latest local state so we can flush pending changes on unmount
  // (important when users go back to the timetable quickly).
  const localRef = useRef(local);
  useEffect(()=>{ localRef.current = local; }, [local]);

  // Prevent saving a "brand-new" empty lesson just because the user opened it.
  const initialSnapshotRef = useRef(serializeForCompare(lesson));
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef(null);

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
  }, [weekStart, dayIndex, slotIndex]);

  useEffect(()=>{
    if (onDraftTopicChange) onDraftTopicChange(local.topic || '');
  }, [local.topic, onDraftTopicChange]);

  useEffect(()=>{
    // Ignore the very first effect run after (re)initialization.
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
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
  useEffect(()=>{
    return () => {
      try {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        const latest = localRef.current;
        const curr = serializeForCompare(latest);
        if (curr !== initialSnapshotRef.current) {
          onUpdateLesson(latest);
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

  const lessonTitle = `${DAYS[dayIndex]} · ${formatDateDE(dateISO)} · ${slotIndex+1}. Stunde`;

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

const gKey = useMemo(()=>groupKey(local.classGroup, local.subject), [local.classGroup, local.subject]);
const gColor = useMemo(()=>{
  if (!gKey) return '';
  const stored = groupColors?.[gKey]?.color;
  return (stored || defaultGroupColor(gKey));
}, [gKey, groupColors]);


  const setField = (field, value) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };

  const api = (typeof window !== 'undefined' && window.api) ? window.api : null;

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
    if (!api) {
      alert('Dateien anhängen ist nur in der Desktop-App verfügbar.');
      return;
    }
    const picked = await api.pickFiles({ multi: true });
    if (!Array.isArray(picked) || picked.length === 0) return;

    let copiedMap = null; // Map<sourcePath, destPath>
    let mode = 'link';
    if (fileCopyOptIn && typeof api.copyToLibrary === 'function') {
      try {
        const seqName = (sequences?.[String(local.sequenceId || '').trim()]?.name || '').trim();
        const res = await api.copyToLibrary({
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
          alert(`Achtung: ${res.errors.length} Datei(en) konnten nicht kopiert werden.`);
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
    if (!api) return;
    const res = await api.openPath(pathStr);
    if (res && res.ok === false && res.error) alert(`Konnte Datei nicht öffnen: ${res.error}`);
  };

  const revealFile = async (pathStr) => {
    if (!api) return;
    const res = await api.revealPath(pathStr);
    if (res && res.ok === false && res.error) alert(`Konnte Ordner nicht öffnen: ${res.error}`);
  };

  const openLibraryRoot = async () => {
    if (!api || typeof api.getLibraryRoot !== 'function') return;
    const root = await api.getLibraryRoot();
    if (!root) return;
    const res = await api.openPath(root);
    if (res && res.ok === false && res.error) alert(`Konnte Ablage nicht öffnen: ${res.error}`);
  };

  const setPhases = (nextPhases) => {
    setLocal(prev => ({ ...prev, phases: normalizePhases(nextPhases) }));
  };

  const addPhase = () => {
    setPhases((() => {
      const phases = deepClone(local.phases);
      const newPhase = { id: uid(), title: 'Neue Phase', duration: 5, socialForm: '', content: '', materialsMedia: '', remarks: '' };
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

  const exportPdf = () => {
    const html = buildLessonPdfHtml({ title: lessonTitle, dateISO, dayIndex, slotIndex, schoolCalendar, lesson: local });
    // Filename uses a safe format (dots can be awkward on some systems); keep ISO for filenames.
    const suggested = `Unterricht_${dateISO}_${slotIndex+1}.Stunde.pdf`;
    onExportPdf(html, suggested);
  };


const exportDocx = () => {
  if (typeof onExportDocx !== 'function') {
    alert('Word-Export ist nur in der Desktop-App verfügbar.');
    return;
  }
  const html = buildLessonPdfHtml({ title: lessonTitle, dateISO, dayIndex, slotIndex, schoolCalendar, lesson: local });
  const suggested = `Unterricht_${dateISO}_${slotIndex+1}.Stunde.doc`;
  onExportDocx(html, suggested);
};

  const startExecution = () => {
    if (typeof onOpenExecution !== 'function') {
      alert('Durchführungsansicht ist nur in der Desktop-App verfügbar.');
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
          <div style={{fontWeight:900, fontSize:16}}>Einzelstunde</div>
          <div className="muted small">{lessonTitle}</div>
          {(dayInfo.vac || dayInfo.fd || (dayInfo.evs && dayInfo.evs.length)) ? (
            <div className="row wrap" style={{gap:6, marginTop:6}}>
              {dayInfo.vac ? <span className="badge" style={{borderColor:'#f59e0b', color:'#b45309'}}>🏖 Ferien: {dayInfo.vac.name || ''}</span> : null}
              {dayInfo.fd ? <span className="badge" style={{borderColor:'#ef4444', color:'#b91c1c'}}>🚫 Schulfrei: {dayInfo.fd.name || ''}</span> : null}
              {(dayInfo.evs || []).slice(0,2).map(ev => (
                <span key={ev.id} className="badge">📌 {ev.name || ev.summary || 'Termin'}</span>
              ))}
              {(dayInfo.evs && dayInfo.evs.length > 2) ? <span className="badge">+{dayInfo.evs.length-2} Termine</span> : null}
            </div>
          ) : null}
        </div>
        <div className="row" style={{gap:8}}>
          <button className="btn success" onClick={startExecution}>▶ Durchführung</button>
          <button className="btn danger" onClick={onDeleteLesson}>Stunde löschen</button>
          <button className="btn iconBtn-word" onClick={exportDocx} title="Als Word-Datei speichern"><img src={wordIcon} alt="" className="btnIcon" />Word speichern</button>
          <button className="btn iconBtn-pdf" onClick={exportPdf} title="Als PDF speichern"><img src={pdfIcon} alt="" className="btnIcon" />PDF speichern</button>
        </div>
      </div>

      <div style={{height:12}} />

      <div className="row wrap">
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
    style={{background: gKey ? gColor : 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #ffffff 6px, #ffffff 12px)'}}
    onClick={(e)=>{
      e.stopPropagation();
      if (!gKey) { alert('Bitte zuerst Fach + Klasse/Kurs setzen, um eine Lerngruppen-Farbe festzulegen.'); return; }
      onOpenGroupColorPalette?.(gKey, `${local.classGroup} · ${local.subject}`.trim());
    }}
    title={gKey ? 'Lerngruppen-Farbe ändern (gilt für das ganze Schuljahr)' : 'Bitte zuerst Fach + Klasse/Kurs setzen'}
    aria-label="Lerngruppenfarbe auswählen"
  />
</div>


      </div>

      <div style={{height:10}} />

      <div className="row wrap">
        <div className="grow">
          <label className="small muted">Stundenthema</label>
          <input className="input" value={local.topic} onChange={(e)=>setField('topic', e.target.value)} placeholder="z. B. Bruchrechnung: Addition" />
        </div>
      </div>

      <div style={{height:10}} />


      <div style={{height:10}} />

      <div className="row wrap">
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
            <button className="btn" onClick={()=>onOpenYearPlan?.(dateISO)}>Im Jahresplan öffnen</button>
          </div>
          <div style={{height:8}} />
          <div className="yearHintList">
            {matchingYearBars.slice(0,6).map(b=> (
              <div key={b.id} className="yearHintItem">
                <span className="yearHintDot" style={{background: b.color || '#9ca3af'}} />
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
        onChange={(nextComps, nextPrimary)=>{
          setLocal(prev => ({ ...prev, competencies: nextComps, primaryCompetency: nextPrimary }));
        }}
        onRemember={(v)=>onRememberCompetency(v)}
        onHideSuggestion={(label)=>onHideCompetencySuggestion?.(label)}
      />

      <div style={{height:10}} />

      <div>
        <label className="small muted">Lernziele (Stichpunkte oder Sätze)</label>
        <textarea value={local.objectives} onChange={(e)=>setField('objectives', e.target.value)} placeholder="- Die Lernenden können ..." />
      </div>

      <div style={{height:14}} />

      <div className="split">
        <PhaseTimeline phases={local.phases} onChange={setPhases} startTime={lessonStartHHMM} />
        <div>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:800}}>Phasen & Inhalte</div>
              <div className="muted small">Phasenname & Sozialform werden vorgeschlagen und gemerkt.</div>
            </div>
            <button className="btn" onClick={addPhase}>+ Phase</button>
          </div>

          <div style={{height:10}} />

          <div className="phaseEditorList">
            {local.phases.map((ph, idx)=>(
              <div key={ph.id} className="phaseEditor">
                <div className="phaseEditorHeader">
                  <div style={{fontWeight:800}}>{idx+1}. Phase</div>
                  <div className="row" style={{gap:8}}>
                    <span className="badge" title={(phaseTimes?.[idx]?.end && phaseTimes?.[idx]?.start) ? `${phaseTimes[idx].start} – ${phaseTimes[idx].end}` : ''}>
                      {phaseTimes?.[idx]?.start ? `${phaseTimes[idx].start} · ` : ''}{ph.duration} min
                    </span>
                    <button className="btn danger" onClick={()=>removePhase(idx)} disabled={local.phases.length<=1}>Entfernen</button>
                  </div>
                </div>

                <div className="row wrap">
                  <div className="grow">
                    <label className="small muted">Phasenname</label>
                    <PhaseNameInput
                      value={ph.title}
                      suggestions={phaseNameSuggestions || []}
                      onChange={(v)=>{
                        setPhases(local.phases.map((p,i)=> i===idx ? { ...p, title: v } : p));
                      }}
                      onCommit={(v)=>onRememberPhaseName?.(v)}
                      onHideSuggestion={(v)=>onHidePhaseNameSuggestion?.(v)}
                    />
                  </div>
                  <div style={{width:260}}>
                    <label className="small muted">Sozialform</label>
                    <SocialFormInput
                      value={ph.socialForm}
                      suggestions={suggestions}
                      onChange={(v)=>{
                        setPhases(local.phases.map((p,i)=> i===idx ? { ...p, socialForm: v } : p));
                      }}
                      onCommit={(v)=>onRememberSocialForm(v)}
                      onHideSuggestion={(v)=>onHideSocialFormSuggestion?.(v)}
                    />
                  </div>
                </div>

                <div style={{height:10}} />
                <label className="small muted">Inhalt / Ablauf</label>
                <RichTextEditor
                  value={ph.content}
                  onChange={(v)=>{
                    setPhases(local.phases.map((p,i)=> i===idx ? { ...p, content: v } : p));
                  }}
                  placeholder="Was passiert in dieser Phase? Material? Fragen? Differenzierung?"
                />

                <div style={{height:10}} />
                <div className="row wrap" style={{gap:10}}>
                  <div className="grow">
                    <label className="small muted">Materialien & Medien</label>
                    <RichTextEditor
                      value={ph.materialsMedia || ''}
                      onChange={(v)=>{
                        setPhases(local.phases.map((p,i)=> i===idx ? { ...p, materialsMedia: v } : p));
                      }}
                      placeholder="z. B. AB, Tafelbild, Beamer, Karten, ..."
                    />
                  </div>
                  <div className="grow">
                    <label className="small muted">Bemerkungen</label>
                    <RichTextEditor
                      value={ph.remarks || ''}
                      onChange={(v)=>{
                        setPhases(local.phases.map((p,i)=> i===idx ? { ...p, remarks: v } : p));
                      }}
                      placeholder="z. B. Hinweise, Beobachtungen, Alternativen, ..."
                    />
                  </div>
                </div>
              </div>
            ))}
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
                <button className="btn primary" onClick={addLink}>Link hinzufügen</button>
              </div>
              <div style={{height:10}} />

              {lessonLinks.length === 0 ? (
                <div className="muted small">Noch keine Links hinterlegt.</div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  {lessonLinks.map(l => (
                    <div key={l.id} className="row wrap" style={{justifyContent:'space-between', alignItems:'center', gap:8}}>
                      <div className="grow" style={{minWidth:240}}>
                        <input
                          value={l.title || ''}
                          onChange={(e)=>updateLink(l.id, { title: e.target.value })}
                          placeholder="Titel (optional)"
                        />
                        <div style={{height:6}} />
                        <input
                          value={l.url || ''}
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
                        <button className="btn" onClick={()=>openLink(l.url)} disabled={!String(l.url||'').trim()}>Öffnen</button>
                        <button className="btn danger" onClick={()=>removeLink(l.id)}>Entfernen</button>
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
                <button className="btn primary" onClick={addLessonFiles}>Datei hinzufügen</button>
                <label className="row" style={{gap:8, userSelect:'none'}} title="Wenn aktiv, werden Dateien in einen App-eigenen Ordner kopiert (opt-in).">
                  <input type="checkbox" checked={fileCopyOptIn} onChange={toggleFileCopyOptIn} />
                  <span className="small muted">Dateien in App kopieren (opt‑in)</span>
                </label>
                {api && typeof api.getLibraryRoot === 'function' ? (
                  <button className="btn" onClick={openLibraryRoot} title="App-Ablage öffnen">Ablage öffnen</button>
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
                        <button className="btn" onClick={()=>openFile(f.path)}>Öffnen</button>
                        <button className="btn" onClick={()=>revealFile(f.path)}>Im Ordner</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{height:10}} className="hr" />
              </div>
            )}

            {lessonFiles.length === 0 ? (
              <div className="muted small">Noch keine Dateien an dieser Einzelstunde.</div>
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
                      <button className="btn" onClick={()=>openFile(f.path)}>Öffnen</button>
                      <button className="btn" onClick={()=>revealFile(f.path)}>Im Ordner</button>
                      <button className="btn danger" onClick={()=>removeLessonFile(f.id)}>Entfernen</button>
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
      <div className="muted small">Tipp: Ziehe einen Phasenblock im Zeitstrahl, um die Reihenfolge zu ändern. Ziehe die Trennlinie zwischen zwei Phasen, um Minuten zu verschieben (Summe bleibt 45).</div>
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
  onExportDocx
}){
  const startISO = view.startISO || view.weekStart;
  const rangeDays = view.rangeDays || 28;
  const endISO = useMemo(()=> toISODate(addDays(fromISODate(startISO), rangeDays - 1)), [startISO, rangeDays]);

  const schoolYear = (schoolCalendar && schoolCalendar.schoolYear) ? schoolCalendar.schoolYear : { startISO: '', endISO: '' };
  const minDate = (schoolYear.startISO || '').trim() || undefined;
  const maxDate = (schoolYear.endISO || '').trim() || undefined;

  const [groupQuery, setGroupQuery] = useState('');
  const [sequenceFilter, setSequenceFilter] = useState('');

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

  const byGroupDate = useMemo(()=>{
    const map = new Map();
    for (const o of occurrences) {
      if (sequenceFilter && (o.lesson.sequenceId || '') !== sequenceFilter) continue;
      if (!map.has(o.group)) map.set(o.group, new Map());
      const dm = map.get(o.group);
      const arr = dm.get(o.dateISO) || [];
      arr.push(o);
      dm.set(o.dateISO, arr);
    }
    return map;
  }, [occurrences, sequenceFilter]);

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
      alert('PDF-Export ist nur in der Desktop-App verfügbar.');
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
    alert('Word-Export ist nur in der Desktop-App verfügbar.');
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
          <button className="btn" onClick={()=>onRequestCreateSequence?.()}>Sequenzen verwalten</button>
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
                <div className="muted small">{(Array.from(dm.values()).reduce((a,b)=>a+b.length,0))} Std.</div>
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
                      const border = seq?.color || '#cbd5e1';
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
                            <div style={{fontWeight:800, fontSize:12}}>{formatDateDE(o.dateISO)} · {o.slotIndex+1}. Stunde</div>
                            <select
                              className="macroSelect"
                              value={o.lesson.sequenceId || ''}
                              onClick={(e)=>e.stopPropagation()}
                              onChange={(e)=>{
                                e.stopPropagation();
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
                              title="Sequenz zuordnen"
                            >
                              <option value="">— Sequenz —</option>
                              {Object.values(sequences || {}).sort((a,b)=>a.name.localeCompare(b.name)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                              <option value="__new__">+ Neue Sequenz…</option>
                            </select>
                            <button
                              className="iconBtn danger"
                              onClick={(e)=>{
                                e.stopPropagation();
                                if (window.confirm('Stunde löschen?')) onDeleteLessonAt(o.weekStart, o.dayIndex, o.slotIndex);
                              }}
                              title="Stunde löschen"
                              aria-label="Stunde löschen"
                            >🗑</button>
                          </div>

                          <div className="macroTopic">{topic}</div>

                          <div className="row wrap" style={{gap:6}}>
                            {seq ? <span className="pill" style={{borderColor: seq.color, color: seq.color}}>🟦 {seq.name}</span> : <span className="pill">Ohne Sequenz</span>}
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
  onSetView
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

  const laneKey = (b) => {
    const g = String(b?.classGroup || '').trim();
    const s = String(b?.subject || '').trim();
    if (!g && !s) return 'allgemein';
    return `${g}||${s}`;
  };

  const laneLabel = (k) => {
    if (k === 'allgemein') return 'Allgemein';
    const [g, s] = String(k || '').split('||');
    return `${(g || '').trim()} · ${(s || '').trim()}`.trim();
  };

  const lanes = useMemo(()=>{
    const set = new Set();
    for (const b of bars) set.add(laneKey(b));
    const arr = Array.from(set);
    // sort: Allgemein first, then by label
    arr.sort((a,b)=> (a==='allgemein'?-1:(b==='allgemein'?1:laneLabel(a).localeCompare(laneLabel(b)))));
    return arr;
  }, [bars]);

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
    // Build month separators & week labels
    const list = weekStarts.map((ws, i)=>{
      const d = fromISODate(ws);
      const month = d.getMonth();
      const year = d.getFullYear();
      const wk = weekNumberISO(d); // "KW x / yyyy"
      return { ws, i, month, year, wk };
    });
    return list;
  }, [weekStarts]);

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
      alert('Bitte zuerst im Schulkalender das Schuljahr (Start/Ende) setzen.');
      return;
    }
    const startISO = normalizeToWeek(view?.focusISO || syStart);
    const endISO = normalizeToWeek(addDaysISO(startISO, 14));
    setModal({ open:true, mode:'create', bar:{ title:'', classGroup:'', subject:'', startISO, endISO, color: SEQ_COLORS[0] } });
  };

  const startEdit = (bar) => {
    setModal({ open:true, mode:'edit', bar: deepClone(bar) });
  };

  // --- Drag + Resize ---
  const dragRef = useRef(null);
  const onMouseDownBar = (e, bar, mode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!weekStarts.length) return;
    const startIdx = weekIndexOf(bar.startISO);
    const endIdx = weekIndexOf(bar.endISO);
    dragRef.current = {
      id: bar.id,
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
      if (d.raf) cancelAnimationFrame(d.raf);
      d.raf = requestAnimationFrame(()=>{
        onUpdateBar?.(d.id, { startISO: isoFromWeekIndex(nStart), endISO: isoFromWeekIndex(nEnd) });
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.raf) cancelAnimationFrame(d.raf);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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
          <div className="muted small">Farbbalken über das Schuljahr – nur Orientierung. Keine Auswirkungen auf Unterrichtssequenzen, nicht im Export.</div>
        </div>
        <div className="row wrap" style={{gap:8}}>
          <button className="btn primary" onClick={startCreate}>+ Balken hinzufügen</button>
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
          <div className="yearPlanSticky">&nbsp;</div>
          <div className="yearPlanScroll" ref={scrollRef}>
            <div className="yearPlanAxisInner" style={{width: totalWidth}}>
              {axis.map(({ws,i,month,year,wk})=>{
                const d = fromISODate(ws);
                const isMonthStart = i===0 || fromISODate(axis[i-1].ws).getMonth() !== month;
                const off = weekOffMap.get(ws);
                return (
                  <div key={ws} className={`yearPlanWeekTick ${off ? 'yearPlanWeekTick--off' : ''}`} style={{left: i*weekWidth, width: weekWidth}} title={wk}>
                    {isMonthStart ? <div className="yearPlanMonthLabel">{d.toLocaleString('de-DE', { month:'short' })} {year}</div> : null}
                    <div className="yearPlanWeekLabel">{wk.split(' / ')[0]}</div>
                  </div>
                );
              })}
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
                <div style={{fontWeight:800}}>{laneLabel(lk)}</div>
                <div className="muted small">{laneBars.length} Balken</div>
              </div>
              <div className="yearPlanScroll">
                <div className="yearPlanLane" style={{width: totalWidth}}>
                  {/* background grid */}
                  {weekStarts.map((ws, i)=>{
                    const off = weekOffMap.get(ws);
                    return <div key={ws} className={`yearPlanGridCol ${off ? 'yearPlanGridCol--off' : ''}`} style={{left:i*weekWidth, width:weekWidth}} />;
                  })}

                  {laneBars.map((b, idx)=>{
                    const sIdx = weekIndexOf(b.startISO);
                    const eIdx = weekIndexOf(b.endISO);
                    const left = sIdx * weekWidth;
                    const width = Math.max(weekWidth, (eIdx - sIdx + 1) * weekWidth);
                    // Für bessere Übersicht: Hintergrund der Balken abwechselnd etwas heller/dunkler
                    // (wir verändern NICHT die gespeicherte Balkenfarbe, nur die Darstellung).
                    const bgAlpha = (idx % 2 === 0) ? 0.16 : 0.30;
                    return (
                      <div
                        key={b.id}
                        className="yearPlanBar"
                        style={{left, width, background: hexToRgba(b.color, bgAlpha), borderColor: b.color}}
                        onDoubleClick={()=>startEdit(b)}
                        onMouseDown={(e)=>onMouseDownBar(e, b, 'move')}
                        title={`${b.title || ''}\n${formatDateDE(b.startISO)} – ${formatDateDE(b.endISO)}\n(Doppelklick zum Bearbeiten)`}
                      >
                        <div className="yearPlanBarHandle yearPlanBarHandle--left" onMouseDown={(e)=>onMouseDownBar(e, b, 'resize-left')} />
                        <div className="yearPlanBarHandle yearPlanBarHandle--right" onMouseDown={(e)=>onMouseDownBar(e, b, 'resize-right')} />
                        <div className="yearPlanBarTitle" style={{color: b.color}}>
                          <span className="yearPlanDot" style={{background:b.color}} />
                          {b.title || 'Ohne Titel'}
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

      {modal.open && (
        <YearBarModal
          mode={modal.mode}
          bar={modal.bar}
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
            if (window.confirm('Diesen Balken löschen?')) {
              onDeleteBar?.(modal.bar.id);
              setModal({ open:false, mode:'create', bar:null });
            }
          }}
        />
      )}
    </div>
  );
}

function YearBarModal({ mode, bar, minDate, maxDate, classGroupSuggestions, subjectSuggestions, onHideClassGroupSuggestion, onHideSubjectSuggestion, onClose, onSave, onDelete }){
  const [local, setLocal] = useState(()=>({
    title: String(bar?.title || '').trim(),
    classGroup: String(bar?.classGroup || '').trim(),
    subject: String(bar?.subject || '').trim(),
    startISO: String(bar?.startISO || '').trim(),
    endISO: String(bar?.endISO || '').trim(),
    color: String(bar?.color || SEQ_COLORS[0]).trim()
  }));

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
            color: local.color
          })}>Speichern</button>
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
  minDate,
  maxDate,
  onCreateTemplateFromSequence,
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

  return (
    <div className="card">
      <div className="row wrap" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div style={{fontWeight:900, fontSize:16}}>Bibliothek – Sequenz‑Vorlagen</div>
          <div className="muted small">Speichere Unterrichtssequenzen als wiederverwendbare Vorlagen und füge sie in neue Klassen/Schuljahre ein.</div>
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

      <div className="templateGrid">
        {list.length === 0 ? (
          <div className="muted small">Noch keine Vorlagen gespeichert. Tipp: Lege im Makro‑Plan eine Sequenz an und speichere sie als Vorlage.</div>
        ) : list.map(t => (
          <div key={t.id} className="templateCard">
            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start', gap:10}}>
              <div>
                <div style={{fontWeight:900}}>{t.name || 'Ohne Name'}</div>
                <div className="row wrap" style={{gap:6, marginTop:6}}>
                  <span className="pill">Fach: {(t.subject||'—')}</span>
                  <span className="pill">Stunden: {(Array.isArray(t.lessons) ? t.lessons.length : 0)}</span>
                </div>
              </div>
              <div className="row" style={{gap:8}}>
                <button className="btn" onClick={()=>{ setActiveTemplate(t); setShowInsert(true); }}>Einfügen…</button>
                <button className="btn danger" onClick={()=>onDeleteTemplate(t.id)}>Löschen</button>
              </div>
            </div>
            <div className="muted small" style={{marginTop:10}}>
              Erstellt: {formatDateDE((t.createdAt||'').slice(0,10))}
            </div>
          </div>
        ))}
      </div>

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
            <div style={{fontWeight:900}}>Vorlage einfügen</div>
            <div className="muted small">"{template?.name || ''}"</div>
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
            <label className="small muted">Name der neuen Sequenz (wird im Makro‑Plan angelegt)</label>
            <input className="input" value={sequenceName} onChange={(e)=>setSequenceName(e.target.value)} placeholder="z. B. Argumentieren – Kurzsequenz" />
          </div>
          <label className="row" style={{gap:8, userSelect:'none'}}>
            <input type="checkbox" checked={overwrite} onChange={(e)=>setOverwrite(e.target.checked)} />
            <span className="small muted">Bestehende Planung überschreiben</span>
          </label>
        </div>

        <div style={{height:10}} />
        <div className="muted small">
          Hinweis: Die App platziert die Vorlagenstunden automatisch in passende Stundenplätze (gleiche Lerngruppe + Fach) ab dem Startdatum.
          Damit Räume übernommen werden können, sollte der Stundenplan in den Zielwochen bereits angelegt sein (Klasse/Fach/Raum). Danach kannst du Stunden flexibel löschen oder neue hinzufügen.
        </div>

        <div style={{height:14}} />

        <div className="row" style={{justifyContent:'flex-end'}}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button
            className="btn primary"
            onClick={()=>onInsert({ templateId: template.id, targetGroup, subject, startISO, overwrite, sequenceName })}
          >Einfügen</button>
        </div>
      </div>
    </div>
  );
}

function SequenceManager({
  sequences,
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
  afterCreate,
  autoCloseOnCreate = false,
}){
  const [newName, setNewName] = useState('');
  const newNameRef = useRef(null);
  const canAdd = (newName || '').trim().length > 0;
  const list = Object.values(sequences || {}).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));

  useEffect(()=>{
    // Focus the input when opened (helps the "+ Neue Sequenz…" flow feel instant).
    const t = setTimeout(()=>{ try { newNameRef.current?.focus?.(); } catch {} }, 50);
    return ()=>{ try { clearTimeout(t); } catch {} };
  }, []);

  const api = (typeof window !== 'undefined' && window.api) ? window.api : null;
  const [filesSeqId, setFilesSeqId] = useState(null);

  const openLibraryRoot = async () => {
    if (!api || typeof api.getLibraryRoot !== 'function') return;
    const root = await api.getLibraryRoot();
    if (!root) return;
    const res = await api.openPath(root);
    if (res && res.ok === false && res.error) alert(`Konnte Ablage nicht öffnen: ${res.error}`);
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
    if (!api) {
      alert('Dateien anhängen ist nur in der Desktop-App verfügbar.');
      return;
    }
    const picked = await api.pickFiles({ multi: true });
    if (!Array.isArray(picked) || picked.length === 0) return;

    let copiedMap = null; // Map<sourcePath, destPath>
    let mode = 'link';
    if (fileCopyOptIn && typeof api.copyToLibrary === 'function') {
      try {
        const res = await api.copyToLibrary({
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
          alert(`Achtung: ${res.errors.length} Datei(en) konnten nicht kopiert werden.`);
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
    if (!api) return;
    const res = await api.openPath(pathStr);
    if (res && res.ok === false && res.error) alert(`Konnte Datei nicht öffnen: ${res.error}`);
  };

  const revealFile = async (pathStr) => {
    if (!api) return;
    const res = await api.revealPath(pathStr);
    if (res && res.ok === false && res.error) alert(`Konnte Ordner nicht öffnen: ${res.error}`);
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
                {api && typeof api.getLibraryRoot === 'function' ? (
                  <button className="btn" onClick={openLibraryRoot} title="App-Ablage öffnen">Ablage öffnen</button>
                ) : null}
              </div>

              <div style={{height:12}} />

              {seqFiles.length === 0 ? (
                <div className="muted small">Noch keine Dateien hinterlegt.</div>
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
                          <button className="btn" onClick={()=>revealFile(f.path)}>Im Ordner</button>
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
            <div className="muted small">Noch keine Sequenzen angelegt.</div>
          ) : list.map(s => (
            <div key={s.id} className="seqRow">
              <input
                type="color"
                value={s.color || '#2563eb'}
                onChange={(e)=>onUpdate(s.id, { color: e.target.value })}
                title="Farbe"
              />
              <input
                className="input"
                value={s.name || ''}
                onChange={(e)=>onUpdate(s.id, { name: e.target.value })}
                placeholder="Sequenzname"
              />
              <button className="btn" onClick={()=>{
                if (typeof onSaveAsTemplate === 'function') onSaveAsTemplate(s.id);
              }} title="Sequenz als Vorlage für spätere Schuljahre speichern">Als Vorlage speichern</button>
              <button className="btn iconBtn-pdf" onClick={()=>{
                if (typeof onExportPdfSequence === 'function') onExportPdfSequence(s.id);
              }} title="Sequenz als PDF speichern"><img src={pdfIcon} alt="" className="btnIcon" />PDF</button>
              <button className="btn iconBtn-word" onClick={()=>{
                if (typeof onExportDocxSequence === 'function') onExportDocxSequence(s.id);
              }} title="Sequenz als Word speichern"><img src={wordIcon} alt="" className="btnIcon" />Word</button>
              <button className="btn" onClick={()=>openSeqFiles(s.id)} title="Dateien für diese Sequenz hinterlegen (nur Verweise, nicht exportiert)">Dateien</button>
              <button className="btn danger" onClick={()=>{
                if (window.confirm(`Sequenz "${s.name}" löschen? (Zuordnungen werden entfernt)`)) onDelete(s.id);
              }}>Löschen</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function PhaseTimeline({ phases, onChange, startTime = '' }){
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
  }, [drag, phases, onChange]);

  return (
    <div className="timeline">
      <div className="timelineHeader">
        <div style={{fontWeight:800}}>Zeitstrahl</div>
        <div className="muted small">{TOTAL_MIN} Minuten</div>
      </div>
      <div
        className="timelineBody"
        ref={bodyRef}
        onDragOver={(e)=>{
          // Allow drop
          if (drag) return; // while resizing, ignore dnd
          e.preventDefault();
          const di = computeDropIndex(e.clientY);
          if (di !== null) setDropIndex(di);
        }}
        onDragLeave={()=>setDropIndex(null)}
        onDrop={(e)=>{
          if (drag) return;
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
                ? TOTAL_MIN * PX_PER_MIN - 1
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
              draggable={!drag}
              onDragStart={(e)=>{
                if (drag) return;
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
        {phaseLayout.slice(0, -1).map(({idx, top, height})=>{
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
                  ✕
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
function RichTextEditor({ value, onChange, placeholder = '' }){
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
        ✎
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
              defaultValue="#111827"
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
        contentEditable
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
          // Fallback (should rarely happen): prompt-based creation
          const name = window.prompt('Name der neuen Unterrichtssequenz:');
          if (name && onCreate) {
            const createdId = onCreate(name);
            if (createdId) onChange?.(createdId);
          }
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


function CompetencyEditor({ competencies, primary, suggestions, onChange, onRemember, onHideSuggestion }){
  const [draft, setDraft] = useState('');
  const id = useMemo(()=> `ct-${Math.random().toString(16).slice(2)}`, []);

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

  const setAsPrimary = (v) => {
    onRemember?.(v);
    onChange?.(competencies || [], v);
  };

  return (
    <div className="competencyBox">
      <div className="row wrap" style={{justifyContent:'space-between'}}>
        <div>
          <div style={{fontWeight:800}}>Kompetenzen</div>
          <div className="muted small">Füge Kompetenzen als Tags hinzu. Eine davon kann „primär“ sein.</div>
        </div>
      </div>

      <div style={{height:8}} />

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

      <div style={{height:10}} />

      <div className="tagRow">
        {(competencies || []).length === 0 ? (
          <span className="muted small">Noch keine Kompetenzen eingetragen.</span>
        ) : (
          (competencies || []).map((c)=>(
            <span key={c} className={c === primary ? 'tag tagPrimary' : 'tag'}>
              <button className="tagBtn" onClick={()=>setAsPrimary(c)} title="Als primär markieren">★</button>
              <span className="tagText">{c}</span>
              <button className="tagBtn" onClick={()=>remove(c)} title="Entfernen">✕</button>
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
          <button className="btn" onClick={onClose} title="Schließen">✕</button>
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

  const submit = () => {
    if (!copyTodos && futureWeekTodosCount > 0){
      const ok = window.confirm(
        `Du hast ${futureWeekTodosCount} To-do(s) in dieser Woche mit Datum/Deadline NACH dieser Woche.

Sollen sie wirklich NICHT in die nächste Woche übernommen werden?`
      );
      if (!ok) return;
    }
    onConfirm?.({ copyTodos, shiftTodoDates, copyDuties });
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div style={{fontWeight:900, fontSize:16}}>In nächste Woche übernehmen</div>
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
          <div className="muted small" style={{marginLeft:24, marginTop:6}}>
            Hinweis: {futureWeekTodosCount} To-do(s) haben ein Datum/Deadline <b>nach</b> dieser Woche. Diese werden beim Kopieren nicht automatisch „mit verschoben“.
          </div>
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

function TodoView({ weekStart, todos, onAddTodo, onUpdateTodo, onDeleteTodo, onBack }){
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
          <div className="muted small">Optionales Datum/Deadline → Hinweis im Stundenplan & beim App-Start (ohne Inhalt).</div>
        </div>
        <button className="btn" onClick={onBack}>Zurück</button>
      </div>

      <div style={{height:12}} />

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

      <div style={{height:10}} />

      <label className="row" style={{gap:10}}>
        <input type="checkbox" checked={showOnlyWeek} onChange={(e)=>setShowOnlyWeek(e.target.checked)} />
        <span>Nur To-dos dieser Woche</span>
      </label>

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
            <button className="iconBtn danger" onClick={()=>onDeleteTodo?.(t.id)} title="To-do löschen">🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildLessonPdfHtml({ title, dateISO, dayIndex, slotIndex, schoolCalendar, lesson }){
  const l = normalizeLesson(lesson || {});
  const phases = normalizePhases(l.phases || []);
  const lessonStart = getLessonStartTime(schoolCalendar, slotIndex);
  const times = computePhaseTimes(phases, lessonStart);

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
        <td class="colNotes">${sanitizeRichForExport(p.remarks || '')}</td>
      </tr>
    `;
  }).join('');

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

    .colTime{width:9%; white-space:nowrap}
    .colPhase{width:16%}
    .colContent{width:44%}
    .colSocial{width:10%}
    .colMat{width:11%}
    .colNotes{width:10%}

    .tStart{font-size:12px}
    .tDur{color:#374151; font-size:10px; margin-top:1mm}
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
  </div>

  <table>
    <thead>
      <tr>
        <th class="colTime">Zeit</th>
        <th class="colPhase">Phase</th>
        <th class="colContent">Inhalt, Aktivität, methodisches Vorgehen</th>
        <th class="colSocial">Sozialform</th>
        <th class="colMat">Materialien und Medien</th>
        <th class="colNotes">Bemerkungen</th>
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
    const gKey = groupKey(l.classGroup, l.subject);
    const color = (groupColors?.[gKey]?.color) || defaultGroupColor(gKey);
    const bg = hexToRgba(color, 0.22);
    const topic = (l.topic || '').trim();
    const comps = Array.isArray(l.competencies) ? l.competencies.filter(Boolean) : [];
    return {
      bg,
      html: `
        <div class="cellTop">
          <div class="cellMain"><strong>${escapeHtml(l.subject || '')}</strong> · ${escapeHtml(l.classGroup || '')}${l.room ? ` · Raum ${escapeHtml(l.room)}` : ''}</div>
          ${topic ? `<div class="cellSub">${escapeHtml(topic)}</div>` : ''}
          ${comps.length ? `<div class="cellTiny">Kompetenz: ${escapeHtml((l.primaryCompetency || comps[0] || ''))}</div>` : ''}
        </div>
      `
    };
  };

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
      const title = dutyFor(dayIndex, pos);
      if (!title) return `<td class="dutyCell"></td>`;
      return `<td class="dutyCell"><div class="dutyBar">${escapeHtml(title)}</div></td>`;
    }).join('');
    const label = (pos === 0 || pos === slots) ? 'Aufsicht' : '';
    return `<tr class="dutyRow"><td class="slotCol">${label}</td>${tds}</tr>`;
  }

  function buildLessonRow(slotIndex){
    const tds = days.map((_, dayIndex) => {
      const dateISO = toISODate(addDays(start, dayIndex));
      const info = getDayInfo(dateISO, schoolCalendar);
      const cell = cellFor(dayIndex, slotIndex);
      const style = [];
      if (cell.bg) style.push(`background:${cell.bg}`);
      if (info?.isOff) style.push('opacity:0.55');
      return `<td class="lessonCell" style="${style.join(';')}">${cell.html || ''}</td>`;
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

  const blocks = (occurrences || []).map((o, idx) => {
    const l = normalizeLesson(o.lesson);
    const phases = normalizePhases(l.phases || []);
    const lessonStart = getLessonStartTime(schoolCalendar, o.slotIndex);
    const times = computePhaseTimes(phases, lessonStart);

    const dayLabel = (typeof o.dayIndex === 'number' && o.dayIndex >= 0 && o.dayIndex < DAYS.length) ? DAYS[o.dayIndex] : '';
    const dateLabel = o.dateISO ? formatDateDE(o.dateISO) : '';
    const slotLabel = Number.isFinite(o.slotIndex) ? ` · ${String(o.slotIndex + 1)}. Std.` : '';
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
          <td class="colNotes">${sanitizeRichForExport(p.remarks || '')}</td>
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

  </style>
</head>
<body>
  <h1>Sequenz: ${escapeHtml(seqName)}</h1>
  <div class="meta">${count} Unterrichtsstunde(n) · Export aus Prép-ybara</div>
  ${count ? blocks : `<div class="muted">Keine Stunden dieser Sequenz im aktuellen Plan gefunden.</div>`}
</body>
</html>`;
}
