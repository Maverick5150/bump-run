/**
 * Minimal per-socket sliding-window rate limiter so a misbehaving or
 * malicious client can't flood the server with events.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private maxEvents: number,
    private windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const history = this.hits.get(key) ?? [];
    const recent = history.filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= this.maxEvents;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}
