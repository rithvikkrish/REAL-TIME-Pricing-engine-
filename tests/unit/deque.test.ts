import { describe, it, expect } from 'vitest';
import { MonotonicMinMaxDeque } from '../../src/utils/deque';

describe('MonotonicMinMaxDeque', () => {
  it('correctly returns max and min in O(1)', () => {
    const deque = new MonotonicMinMaxDeque();

    deque.push(10, 1000);
    expect(deque.getMax()).toBe(10);
    expect(deque.getMin()).toBe(10);

    deque.push(15, 2000);
    expect(deque.getMax()).toBe(15);
    expect(deque.getMin()).toBe(10);

    deque.push(8, 3000);
    expect(deque.getMax()).toBe(15);
    expect(deque.getMin()).toBe(8);

    deque.push(12, 4000);
    expect(deque.getMax()).toBe(15);
    expect(deque.getMin()).toBe(8);
  });

  it('prunes expired observations correctly', () => {
    const deque = new MonotonicMinMaxDeque();

    deque.push(20, 1000); // Expired later
    deque.push(5, 2000);  // Expired later
    deque.push(15, 3000);
    deque.push(10, 4000);

    expect(deque.getMax()).toBe(20);
    expect(deque.getMin()).toBe(5);

    // Prune before 2500
    deque.prune(2500);

    expect(deque.getMax()).toBe(15);
    expect(deque.getMin()).toBe(10);
  });
});
