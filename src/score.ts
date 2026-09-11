import {
  addDays,
  formatDuration,
  formatWeekRange,
  getWeekDays,
  getWeekId,
  todayStr,
  weekdayLabel,
} from './date';
import type { Settings, StudyRecord, Subject, WeekMeta, WeekReport } from './types';

export function streakScore(days: number): number {
  if (days <= 0) return 0;
  if (days <= 2) return 4;
  if (days <= 4) return 8;
  if (days <= 6) return 12;
  return 15;
}

export function gradeLabel(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '合格';
  if (score >= 40) return '加油';
  return '需改进';
}

function secondsByDate(records: StudyRecord[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of records) {
    map[r.date] = (map[r.date] || 0) + (r.seconds || 0);
  }
  return map;
}

export function checkedDateSet(
  records: StudyRecord[],
  checkinMinMinutes: number
): Record<string, boolean> {
  const byDate = secondsByDate(records);
  const threshold = (checkinMinMinutes || 15) * 60;
  const set: Record<string, boolean> = {};
  for (const date of Object.keys(byDate)) {
    if (byDate[date] >= threshold) set[date] = true;
  }
  return set;
}

export function streakAt(dateStr: string, checkedSet: Record<string, boolean>): number {
  let streak = 0;
  let cursor = dateStr;
  while (checkedSet[cursor]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function targetMinutesFromConfig(subjects: Subject[], settings: Settings): number {
  const sum = subjects.reduce((s, x) => s + (Number(x.durationMin) || 0), 0);
  return Math.max(1, sum * (Number(settings.planDaysPerWeek) || 1));
}

export function computeWeek(
  weekId: string,
  records: StudyRecord[],
  weekMeta: Record<string, WeekMeta>,
  subjects: Subject[],
  settings: Settings
): WeekReport {
  const days = getWeekDays(weekId);
  const today = todayStr();
  const meta = weekMeta[weekId] || {
    targetMinutes: targetMinutesFromConfig(subjects, settings),
    checkinMinMinutes: settings.checkinMinMinutes,
  };

  const weekRecords = records.filter((r) => r.date >= days[0] && r.date <= days[6]);
  const dailyMap: Record<string, { seconds: number; subjects: Record<string, number> }> = {};
  const subjectMap: Record<string, number> = {};
  for (const d of days) dailyMap[d] = { seconds: 0, subjects: {} };

  for (const r of weekRecords) {
    const day = dailyMap[r.date];
    if (!day) continue;
    day.seconds += r.seconds || 0;
    const name = r.subjectName || '未命名';
    day.subjects[name] = (day.subjects[name] || 0) + (r.seconds || 0);
    subjectMap[name] = (subjectMap[name] || 0) + (r.seconds || 0);
  }

  const totalSeconds = weekRecords.reduce((s, r) => s + (r.seconds || 0), 0);
  const targetMinutes = Math.max(1, meta.targetMinutes);
  const timeScore = Math.min(60, (totalSeconds / 60 / targetMinutes) * 60);
  const checkinMin = meta.checkinMinMinutes || 15;
  const checkedDays = days.filter((d) => (dailyMap[d].seconds || 0) >= checkinMin * 60);
  const stabilityScore = (checkedDays.length / 7) * 25;
  const sunday = days[6];
  const streakDate = today > sunday ? sunday : today < days[0] ? sunday : today;
  const streakDays = streakAt(streakDate, checkedDateSet(records, checkinMin));
  const comboScore = streakScore(streakDays);

  return {
    weekId,
    rangeText: formatWeekRange(weekId),
    isCurrent: weekId === getWeekId(today),
    totalSeconds,
    durationText: formatDuration(totalSeconds),
    targetMinutes,
    timeScore: Math.round(timeScore * 10) / 10,
    stabilityScore: Math.round(stabilityScore * 10) / 10,
    comboScore,
    streakDays,
    checkedDays: checkedDays.length,
    score: Math.round(timeScore + stabilityScore + comboScore),
    grade: gradeLabel(Math.round(timeScore + stabilityScore + comboScore)),
    daily: days.map((d) => ({
      date: d,
      weekday: weekdayLabel(d),
      seconds: dailyMap[d].seconds,
      durationText: formatDuration(dailyMap[d].seconds),
    })),
    subjects: Object.keys(subjectMap)
      .sort()
      .map((name) => ({
        name,
        seconds: subjectMap[name],
        durationText: formatDuration(subjectMap[name]),
      })),
  };
}

export function listWeekReports(
  records: StudyRecord[],
  weekMeta: Record<string, WeekMeta>,
  subjects: Subject[],
  settings: Settings
): WeekReport[] {
  const thisWeek = getWeekId(todayStr());
  let oldest = thisWeek;
  for (const r of records) {
    const id = getWeekId(r.date);
    if (id < oldest) oldest = id;
  }
  const weeks: string[] = [];
  let id = thisWeek;
  while (id >= oldest && weeks.length < 104) {
    weeks.push(id);
    id = addDays(id, -7);
  }
  return weeks.map((weekId) => computeWeek(weekId, records, weekMeta, subjects, settings));
}
