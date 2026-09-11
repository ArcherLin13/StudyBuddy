export const MONEY_HOUR_YUAN = 10;
/** 防计时忘关：超过 8 小时按 8 小时算。奖励只看当天总时长，与科目无关。 */
export const MAX_MONEY_HOURS = 8;

export function meetsMoneyMinimum(seconds: number, minMinutes: number): boolean {
  return seconds >= Math.max(0, minMinutes) * 60;
}

/**
 * 当天总时长 → 钱，不看科目。
 * 60 分 ¥10 · 120 分 ¥30 · 180 分 ¥60 · 240 分 ¥100，公式 5 × 小时 × (小时+1)。
 */
export function moneyFromDuration(
  seconds: number,
  dailyCap: number = MONEY_HOUR_YUAN,
  minMinutes: number = 0
): number {
  if (minMinutes > 0 && !meetsMoneyMinimum(seconds, minMinutes)) return 0;
  const hours = Math.min(Math.max(0, seconds) / 3600, MAX_MONEY_HOURS);
  const scale = Math.max(0, dailyCap) / MONEY_HOUR_YUAN;
  return Math.round(5 * hours * (hours + 1) * scale * 10) / 10;
}

/** 连击后硬顶：8 小时基础金额 × 1.5 */
export function hardMoneyCap(dailyCap: number): number {
  const top = moneyFromDuration(MAX_MONEY_HOURS * 3600, dailyCap, 0);
  return Math.round(top * 1.5 * 10) / 10;
}

export function moneyFromScore(
  _score: number,
  dailyCap: number,
  seconds: number,
  minMinutes: number
): number {
  return moneyFromDuration(seconds, dailyCap, minMinutes);
}

export function scoreDuration(seconds: number, _targetMinutes?: number): number {
  return moneyFromDuration(seconds, MONEY_HOUR_YUAN, 0);
}

/** 基础金额 × 连击系数，上限为 8 小时金额的 1.5 倍 */
export function applyStreakToMoney(baseYuan: number, multiplier: number, dailyCap: number): number {
  if (baseYuan <= 0) return 0;
  const earned = Math.round(Math.max(0, baseYuan) * Math.max(1, multiplier) * 10) / 10;
  return Math.min(hardMoneyCap(dailyCap), earned);
}

export function streakMultiplier(streakDays: number): number {
  const n = Math.max(0, Math.floor(streakDays));
  if (n >= 14) return 1.5;
  if (n >= 7) return 1.3;
  if (n >= 4) return 1.2;
  if (n >= 2) return 1.1;
  return 1;
}

export function formatYuan(amount: number): string {
  const n = Math.max(0, amount);
  return Number.isInteger(n) ? `¥${n}` : `¥${n.toFixed(1)}`;
}

export function formatStreakMultiplier(mult: number): string {
  if (mult <= 1) return '×1';
  return `×${mult.toFixed(1).replace(/\.0$/, '')}`;
}

export function minutesUntilMoney(seconds: number, minMinutes: number): number {
  const have = Math.max(0, seconds) / 60;
  return Math.max(0, Math.ceil(minMinutes - have));
}
