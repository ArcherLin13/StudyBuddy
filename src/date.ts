function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function parseDate(str: string): Date {
  const parts = str.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function getWeekId(dateOrStr: Date | string): string {
  const date = typeof dateOrStr === 'string' ? parseDate(dateOrStr) : dateOrStr;
  return formatDate(getWeekStart(date));
}

export function getWeekDays(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekId, i));
}

export function weekdayLabel(dateStr: string): string {
  return ['日', '一', '二', '三', '四', '五', '六'][parseDate(dateStr).getDay()];
}

export function formatDayLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

export function formatWeekRange(weekId: string): string {
  const end = addDays(weekId, 6);
  const a = weekId.split('-');
  const b = end.split('-');
  return `${a[1]}.${a[2]} – ${b[1]}.${b[2]}`;
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 分钟';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '不到 1 分钟';
  if (mins < 60) return `${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分钟`;
}

export function remainingMs(
  current: { elapsedMsBeforePause: number; status: string; startedAt: number | null; durationSec: number },
  now: number
): number {
  let elapsed = current.elapsedMsBeforePause || 0;
  if (current.status === 'running' && current.startedAt) {
    elapsed += now - current.startedAt;
  }
  return Math.max(0, current.durationSec * 1000 - elapsed);
}

export function elapsedMs(
  current: { elapsedMsBeforePause: number; status: string; startedAt: number | null; durationSec: number },
  now: number
): number {
  return current.durationSec * 1000 - remainingMs(current, now);
}
