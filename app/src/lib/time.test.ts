import { describe, expect, it, vi, afterEach } from 'vitest';
import { __resetClock, formatDate, now } from './time';

afterEach(() => {
  vi.useRealTimers();
  __resetClock();
});

describe('now', () => {
  it('端末の時計が巻き戻っても単調増加する', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000));
    const a = now();
    vi.setSystemTime(new Date(1_000_000)); // 時計が過去に戻った
    const b = now();
    const c = now();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('時計が進めばその値を使う', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    const a = now();
    vi.setSystemTime(new Date(1_005_000));
    expect(now()).toBe(1_005_000);
    expect(a).toBe(1_000_000);
  });
});

describe('formatDate', () => {
  it('ゼロ埋めした日時を返す', () => {
    const ms = new Date(2026, 0, 5, 9, 7).getTime();
    expect(formatDate(ms)).toBe('2026-01-05 09:07');
  });
});
