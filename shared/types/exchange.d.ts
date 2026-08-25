/* ============================================================
   Typbeschreibung des Austauschformats

   Das Projekt ist durchgehend JavaScript ohne TypeScript-Aufbau; diese
   Datei wird nicht übersetzt und von keinem Build angefasst. Sie ist die
   verbindliche Beschreibung der Form – zum Nachschlagen und für
   Editoren, die .d.ts auswerten.

   Verbindlich für die Verträglichkeit ist allein `schemaVersion`.
   ============================================================ */

export type SchemaVersion = 1;

export type ExchangeSource = 'system' | 'profile' | 'custom';

/** Woraus der Entwurf in Pocket entstanden ist. Rein informativ. */
export type LessonKind = 'lesson' | 'quick' | 'idea';

export interface AppStamp {
  name?: string;
  version?: string;
}

export interface LearningGoalExchange {
  text: string;
}

/** Kompetenz oder Sprechabsicht. Das Etikett ist die Identität. */
export interface LabelReference {
  label: string;
  source: ExchangeSource;
  /** Optional; wird für die Zuordnung nicht benötigt. */
  id?: string;
}

export type CompetenceReference = LabelReference;
export type SpeechActReference = LabelReference;

export interface CommunicativeTaskExchange {
  text: string;
  situation: string;
  audience: string;
  intention: string;
  outcome: string;
}

export interface LanguageResourcesExchange {
  vocabulary: string;
  grammar: string;
  pronunciation: string;
  other: string;
}

export interface ScaffoldExchange {
  type: 'linguistic' | 'content' | 'strategic' | 'organizational' | 'other';
  label: string;
  note: string;
}

export interface LessonPhaseExchange {
  id?: string;
  title: string;
  /** Minuten. */
  duration: number;
  content: string;
  socialForm: string;
  /** Materialnotiz – bewusst nur Text, keine Dateien. */
  material: string;
  materialLink: string;
  remarks: string;
  scaffolds?: ScaffoldExchange[];
}

export interface PrepybaraLessonExchange {
  format: 'prepybara-lesson';
  schemaVersion: SchemaVersion;
  /** Stabil über alle Exporte desselben Pocket-Entwurfs hinweg. */
  externalId: string;
  kind: LessonKind;

  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  groupId?: string;

  /** ISO-Datum, YYYY-MM-DD. */
  date?: string;
  /** 1-basiert: "3. Stunde" ist 3. */
  lessonNumber?: number;

  topic?: string;
  learningGoals?: LearningGoalExchange[];
  successCriteria?: string[];
  competencies?: CompetenceReference[];
  primaryCompetency?: string;
  communicativeTask?: CommunicativeTaskExchange;
  speechActs?: SpeechActReference[];
  languageResources?: LanguageResourcesExchange;
  phases?: LessonPhaseExchange[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
  app?: AppStamp;
}

/** Mehrere Stunden in einer Datei – kein ZIP, nur eine Liste. */
export interface PrepybaraLessonBundle {
  format: 'prepybara-lessons';
  schemaVersion: SchemaVersion;
  exportedAt: string;
  app?: AppStamp;
  lessons: PrepybaraLessonExchange[];
}

/* ---- Profil (Desktop → Pocket) --------------------------------------- */

export interface NamedEntity {
  id: string;
  name: string;
}

export interface GroupExchange {
  id: string;
  className: string;
  subjectName: string;
  classId: string;
  subjectId: string;
  label: string;
  color?: string;
}

export interface TimetableEntryExchange {
  date: string;
  lessonNumber: number;
  className: string;
  subjectName: string;
  classId: string;
  subjectId: string;
  groupId: string;
  startTime?: string;
  room?: string;
  /** Im Desktop steht für diesen Termin bereits eine Planung. */
  planned?: boolean;
}

export interface CompetencyExchange {
  label: string;
  area: string;
  areaName: string;
  source: 'system' | 'custom';
}

export interface SpeechActExchange {
  label: string;
  source: 'system' | 'custom';
}

export interface ScaffoldTemplateExchange {
  label: string;
  type: string;
}

export interface LessonTimeExchange {
  start: string;
  end: string;
}

/**
 * Enthält ausdrücklich KEINE Schülerdaten, Noten oder Leistungsdaten.
 * Es gibt dafür nicht einmal Felder.
 */
export interface PrepybaraProfileExchange {
  format: 'prepybara-profile';
  schemaVersion: SchemaVersion;
  exportedAt: string;
  languageMode: boolean;
  classes: NamedEntity[];
  subjects: NamedEntity[];
  groups: GroupExchange[];
  timetable: TimetableEntryExchange[];
  competencies: CompetencyExchange[];
  speechActs: SpeechActExchange[];
  socialForms: string[];
  phaseTypes: string[];
  scaffoldTemplates: ScaffoldTemplateExchange[];
  lessonTimes: LessonTimeExchange[];
  app?: AppStamp;
}
