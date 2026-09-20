/**
 * Deterministic seeded PRNG using a mulberry32 algorithm.
 * Critical: given same seed → same world layout every time.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let h = 0x811c9dc5;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      this.state = h >>> 0;
    } else {
      this.state = seed >>> 0;
    }
    // Warm up
    this.next(); this.next(); this.next();
  }

  next(): number {
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0xffffffff;
  }

  /** Returns float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns integer in [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-10));
  }

  /** Random angle in radians */
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
