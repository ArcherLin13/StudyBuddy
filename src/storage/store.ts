import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeekId } from '../date';
import { targetMinutesFromConfig } from '../score';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SUBJECTS,
  type DayPayout,
  type Settings,
  type StudyRecord,
  type StudySession,
  type Subject,
  type WeekMeta,
} from '../types';

const KEYS = {
  subjects: 'studybuddy.subjects.v1',
  settings: 'studybuddy.settings.v1',
  records: 'studybuddy.records.v1',
  weekMeta: 'studybuddy.weekMeta.v1',
  session: 'studybuddy.session.v1',
  payouts: 'studybuddy.payouts.v1',
};

function sortSubjects(list: Subject[]): Subject[] {
  return list.slice().sort((a, b) => a.order - b.order);
}

export async function loadSubjects(): Promise<Subject[]> {
  const raw = await AsyncStorage.getItem(KEYS.subjects);
  if (!raw) {
    await AsyncStorage.setItem(KEYS.subjects, JSON.stringify(DEFAULT_SUBJECTS));
    return DEFAULT_SUBJECTS.slice();
  }
  try {
    const parsed = JSON.parse(raw) as Subject[];
    return parsed.length ? sortSubjects(parsed) : DEFAULT_SUBJECTS.slice();
  } catch {
    return DEFAULT_SUBJECTS.slice();
  }
}

export async function saveSubjects(list: Subject[]): Promise<Subject[]> {
  const next = list.map((item, order) => ({
    id: item.id,
    name: item.name,
    durationMin: item.durationMin,
    order,
  }));
  await AsyncStorage.setItem(KEYS.subjects, JSON.stringify(next));
  const settings = await loadSettings();
  await saveSettings(settings);
  return next;
}

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const next = { ...settings, updatedAt: Date.now() };
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));
}

export async function loadRecords(): Promise<StudyRecord[]> {
  const raw = await AsyncStorage.getItem(KEYS.records);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StudyRecord[];
  } catch {
    return [];
  }
}

export async function loadWeekMeta(): Promise<Record<string, WeekMeta>> {
  const raw = await AsyncStorage.getItem(KEYS.weekMeta);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, WeekMeta>;
  } catch {
    return {};
  }
}

export async function replaceRecords(records: StudyRecord[]): Promise<StudyRecord[]> {
  await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
  return records;
}

export async function saveWeekMeta(meta: Record<string, WeekMeta>): Promise<void> {
  await AsyncStorage.setItem(KEYS.weekMeta, JSON.stringify(meta));
}

export async function loadPayouts(): Promise<Record<string, DayPayout>> {
  const raw = await AsyncStorage.getItem(KEYS.payouts);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DayPayout>;
  } catch {
    return {};
  }
}

export async function savePayouts(payouts: Record<string, DayPayout>): Promise<void> {
  await AsyncStorage.setItem(KEYS.payouts, JSON.stringify(payouts));
}

export async function settlePendingPayouts(
  dates: string[]
): Promise<{ payouts: Record<string, DayPayout>; count: number }> {
  const payouts = await loadPayouts();
  const now = Date.now();
  let count = 0;
  for (const date of dates) {
    if (payouts[date]?.settled) continue;
    payouts[date] = { date, settled: true, settledAt: now };
    count += 1;
  }
  await savePayouts(payouts);
  return { payouts, count };
}

export type DaySubjectSlice = {
  date: string;
  subjectId: string;
  subjectName: string;
  seconds: number;
};

export function daySubjectSlices(records: StudyRecord[], date: string): DaySubjectSlice[] {
  const map = new Map<string, DaySubjectSlice>();
  for (const r of records) {
    if (r.date !== date) continue;
    const key = r.subjectName || r.subjectId || '未命名';
    const prev = map.get(key);
    if (prev) {
      prev.seconds += r.seconds || 0;
    } else {
      map.set(key, {
        date,
        subjectId: r.subjectId,
        subjectName: r.subjectName || '未命名',
        seconds: r.seconds || 0,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.subjectName < b.subjectName ? -1 : 1));
}

export async function replaceAndReturn(
  next: StudyRecord[],
  removed: StudyRecord[]
): Promise<{ records: StudyRecord[]; removed: StudyRecord[] }> {
  const records = await replaceRecords(next);
  return { records, removed };
}

export async function deleteDayRecords(date: string): Promise<{ records: StudyRecord[]; removed: StudyRecord[] }> {
  const all = await loadRecords();
  const removed = all.filter((r) => r.date === date);
  const next = all.filter((r) => r.date !== date);
  return replaceAndReturn(next, removed);
}

export async function deleteDaySubjectRecords(
  date: string,
  subjectName: string
): Promise<{ records: StudyRecord[]; removed: StudyRecord[] }> {
  const all = await loadRecords();
  const removed = all.filter((r) => r.date === date && (r.subjectName || '未命名') === subjectName);
  const next = all.filter((r) => !(r.date === date && (r.subjectName || '未命名') === subjectName));
  return replaceAndReturn(next, removed);
}

export async function setDaySubjectMinutes(
  date: string,
  subjectName: string,
  minutes: number
): Promise<{ records: StudyRecord[]; removed: StudyRecord[] }> {
  const all = await loadRecords();
  const matched = all.filter((r) => r.date === date && (r.subjectName || '未命名') === subjectName);
  if (!matched.length) return { records: all, removed: [] };
  const seconds = Math.max(0, Math.round(minutes * 60));
  if (seconds < 1) return deleteDaySubjectRecords(date, subjectName);
  const keep = matched[0];
  const updated: StudyRecord = {
    ...keep,
    id: keep.id || makeId('rec'),
    seconds,
    endTs: keep.startTs + seconds * 1000,
  };
  const removed = matched.slice(1);
  const next = all
    .filter((r) => !(r.date === date && (r.subjectName || '未命名') === subjectName))
    .concat(updated)
    .sort((a, b) => a.startTs - b.startTs);
  return replaceAndReturn(next, removed);
}

export async function addRecord(record: StudyRecord): Promise<StudyRecord[]> {
  const records = await loadRecords();
  const withId = { ...record, id: record.id || makeId('rec') };
  records.push(withId);
  await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
  const weekId = getWeekId(record.date);
  const meta = await loadWeekMeta();
  if (!meta[weekId]) {
    const settings = await loadSettings();
    const subjects = await loadSubjects();
    meta[weekId] = {
      targetMinutes: targetMinutesFromConfig(subjects, settings),
      checkinMinMinutes: settings.checkinMinMinutes,
    };
    await AsyncStorage.setItem(KEYS.weekMeta, JSON.stringify(meta));
  }
  return records;
}

export async function loadSession(): Promise<StudySession | null> {
  const raw = await AsyncStorage.getItem(KEYS.session);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudySession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StudySession | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(KEYS.session);
    return;
  }
  await AsyncStorage.setItem(KEYS.session, JSON.stringify(session));
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}
