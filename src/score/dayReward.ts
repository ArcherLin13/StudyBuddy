import { addDays, todayStr } from '../date';
import type { DayPayout, DayReward, Settings, StudyRecord } from '../types';
import {
  applyStreakToMoney,
  meetsMoneyMinimum,
  moneyFromDuration,
  streakMultiplier,
} from './dayMoney';

export function secondsByDate(records: StudyRecord[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of records) {
    map[r.date] = (map[r.date] || 0) + (r.seconds || 0);
  }
  return map;
}

export function streakAtDate(
  dateStr: string,
  byDate: Record<string, number>,
  minMinutes: number
): number {
  let streak = 0;
  let cursor = dateStr;
  while (meetsMoneyMinimum(byDate[cursor] || 0, minMinutes)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function rewardForDay(
  date: string,
  records: StudyRecord[],
  settings: Settings,
  payouts: Record<string, DayPayout> = {}
): DayReward {
  const byDate = secondsByDate(records);
  const seconds = byDate[date] || 0;
  const baseYuan = moneyFromDuration(seconds, settings.dailyMoneyCap, settings.moneyMinMinutes);
  const score = Math.round(baseYuan);
  const streakDays = streakAtDate(date, byDate, settings.moneyMinMinutes);
  const mult = streakMultiplier(streakDays);
  const earnedYuan = applyStreakToMoney(baseYuan, mult, settings.dailyMoneyCap);
  const payout = payouts[date];
  return {
    date,
    seconds,
    score,
    baseYuan,
    streakDays,
    streakMultiplier: mult,
    earnedYuan,
    settled: Boolean(payout?.settled),
  };
}

export function todayReward(
  records: StudyRecord[],
  settings: Settings,
  payouts: Record<string, DayPayout> = {}
): DayReward {
  return rewardForDay(todayStr(), records, settings, payouts);
}

export function allDayRewards(
  records: StudyRecord[],
  settings: Settings,
  payouts: Record<string, DayPayout> = {}
): DayReward[] {
  const dates = Object.keys(secondsByDate(records)).sort();
  return dates.map((date) => rewardForDay(date, records, settings, payouts));
}

export function sumPendingYuan(rewards: DayReward[]): number {
  return Math.round(rewards.filter((r) => !r.settled).reduce((s, r) => s + r.earnedYuan, 0) * 10) / 10;
}

export function sumSettledYuan(rewards: DayReward[]): number {
  return Math.round(rewards.filter((r) => r.settled).reduce((s, r) => s + r.earnedYuan, 0) * 10) / 10;
}

export function weekYuan(rewards: DayReward[], dates: string[]): number {
  const set = new Set(dates);
  return Math.round(rewards.filter((r) => set.has(r.date)).reduce((s, r) => s + r.earnedYuan, 0) * 10) / 10;
}
