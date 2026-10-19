import { tooMany } from './errors.ts';

/**
 * In-memory fixed-window limiter. Adequate for the single-instance deployment this project targets;
 * a multi-instance deployment needs a shared store (e.g. Redis) instead.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Throws 429 once `key` exceeds the limit inside the current window. */
  consume(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      const minutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60_000));
      throw tooMany(`Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`);
    }
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
