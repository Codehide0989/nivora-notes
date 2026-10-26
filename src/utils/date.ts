const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n: number) => (n < 10 ? '0' + n : String(n));

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${ampm}`;
}

export function formatDate(ts: number, withYear = true): string {
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}

export function formatDay(ts: number): string {
  const now = Date.now();
  if (isSameDay(ts, now)) return 'Today';
  if (isSameDay(ts, now + 86400000)) return 'Tomorrow';
  if (isSameDay(ts, now - 86400000)) return 'Yesterday';
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${formatDate(ts, d.getFullYear() !== new Date().getFullYear())}`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(ts, new Date(ts).getFullYear() !== new Date().getFullYear());
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export function daysLeft(deletedAt: number, retentionDays: number): number {
  const left = deletedAt + retentionDays * 86400000 - Date.now();
  return Math.max(0, Math.ceil(left / 86400000));
}

export function stamp(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function mergeDateAndTime(date: number, time: number): number {
  const d = new Date(date);
  const t = new Date(time);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d.getTime();
}
