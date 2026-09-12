export class TokenBucket {
  capacity: number;
  refillPerSec: number;
  tokens: number;
  last: number;

  constructor(capacity: number, refillPerSec: number, now = Date.now()) {
    this.capacity = Math.max(1, capacity);
    this.refillPerSec = Math.max(0, refillPerSec);
    this.tokens = this.capacity;
    this.last = now;
  }

  refill(now = Date.now()): void {
    const dt = Math.max(0, (now - this.last) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + dt * this.refillPerSec);
    this.last = now;
  }

  take(n = 1, now = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }

  snapshot(now = Date.now()): { tokens: number; capacity: number; refillPerSec: number } {
    this.refill(now);
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillPerSec: this.refillPerSec,
    };
  }
}

export function mintKey(scope: "read" | "write" | "admin"): {
  token: string;
  id: string;
  scope: string;
} {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = `kh_${hex}`;
  return { token, id: token.slice(0, 10), scope };
}

const RANK: Record<string, number> = { read: 1, write: 2, admin: 3 };

export function authorize(keyRank: string, need: string): boolean {
  return (RANK[keyRank] ?? 0) >= (RANK[need] ?? 99);
}
