export type Subject = {
  id: string;
  name: string;
  durationMin: number;
  order: number;
};

export type Settings = {
  planDaysPerWeek: number;
  checkinMinMinutes: number;
  soundOn: boolean;
  dailyTargetMinutes: number;
  dailyMoneyCap: number;
  moneyMinMinutes: number;
  updatedAt?: number;
};

export type StudyRecord = {
  id?: string;
  date: string;
  subjectId: string;
  subjectName: string;
  seconds: number;
  startTs: number;
  endTs: number;
};

export type WeekMeta = {
  targetMinutes: number;
  checkinMinMinutes: number;
};

export type SessionCurrent = {
  subjectId: string;
  subjectName: string;
  durationSec: number;
  startTs: number;
  elapsedMsBeforePause: number;
  startedAt: number | null;
  status: 'running' | 'paused';
};

export type StudySession = {
  active: boolean;
  nextIndex: number;
  current: SessionCurrent | null;
};

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub_a', name: '科目A', durationMin: 25, order: 0 },
  { id: 'sub_b', name: '科目B', durationMin: 25, order: 1 },
];

export const DEFAULT_SETTINGS: Settings = {
  planDaysPerWeek: 5,
  checkinMinMinutes: 15,
  soundOn: true,
  dailyTargetMinutes: 60,
  dailyMoneyCap: 10,
  moneyMinMinutes: 15,
};

export type DayPayout = {
  date: string;
  settled: boolean;
  settledAt?: number;
};

export type DayReward = {
  date: string;
  seconds: number;
  score: number;
  baseYuan: number;
  streakDays: number;
  streakMultiplier: number;
  earnedYuan: number;
  settled: boolean;
};

export type WeekReport = {
  weekId: string;
  rangeText: string;
  isCurrent: boolean;
  totalSeconds: number;
  durationText: string;
  targetMinutes: number;
  timeScore: number;
  stabilityScore: number;
  comboScore: number;
  streakDays: number;
  checkedDays: number;
  score: number;
  grade: string;
  weekYuan?: number;
  daily: {
    date: string;
    weekday: string;
    seconds: number;
    durationText: string;
    earnedYuan?: number;
    settled?: boolean;
    streakDays?: number;
  }[];
  subjects: {
    name: string;
    seconds: number;
    durationText: string;
  }[];
};
