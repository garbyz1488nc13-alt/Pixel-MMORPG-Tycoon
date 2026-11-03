/** Game-time helpers. A day is 1440 in-game minutes. */
export const MINUTES_PER_DAY = 1440;
/** Fixed simulation step in real milliseconds (10 ticks per second). */
export const TICK_MS = 100;
/** In-game minutes advanced per tick at speed x1 (=> 1 day ≈ 9.6 real minutes). */
export const GAME_MINUTES_PER_TICK = 0.25;
/** Worlds start on day 1 at 08:00. */
export const START_MINUTES = 8 * 60;

export interface GameTime { day: number; hour: number; minute: number; minuteOfDay: number }

export function toGameTime(totalMinutes: number): GameTime {
  const m = Math.floor(totalMinutes);
  const minuteOfDay = ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return {
    day: Math.floor(m / MINUTES_PER_DAY) + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    minuteOfDay,
  };
}

export function formatGameTime(totalMinutes: number): string {
  const t = toGameTime(totalMinutes);
  return `Day ${t.day} · ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';

export function dayPhase(totalMinutes: number): DayPhase {
  const h = toGameTime(totalMinutes).minuteOfDay / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 18) return 'day';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night';
}

/**
 * Darkness amount 0 (full daylight) .. 1 (deepest night), smoothly interpolated
 * across dawn (05–07) and dusk (18–20).
 */
export function darkness(totalMinutes: number): number {
  const h = toGameTime(totalMinutes).minuteOfDay / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 20 || h < 5) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  return (h - 18) / 2;
}
