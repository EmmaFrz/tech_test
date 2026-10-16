/** Fixed-capacity buffer that overwrites its oldest item once full. */
export class RingBuffer<T> {
  private readonly items: T[] = [];
  private oldestIndex = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('RingBuffer capacity must be a positive integer');
    }
  }

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    if (this.items.length < this.capacity) {
      this.items.push(item);
      return;
    }

    this.items[this.oldestIndex] = item;
    this.oldestIndex = (this.oldestIndex + 1) % this.capacity;
  }

  /** Returns a new array ordered from the oldest to the newest item. */
  toArray(): T[] {
    return [...this.items.slice(this.oldestIndex), ...this.items.slice(0, this.oldestIndex)];
  }

  clear(): void {
    this.items.length = 0;
    this.oldestIndex = 0;
  }
}
