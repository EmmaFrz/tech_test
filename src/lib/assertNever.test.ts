import { describe, expect, it } from 'vitest';

import { assertNever } from './assertNever';

describe('assertNever', () => {
  it('throws with the unexpected value for unhandled variants', () => {
    expect(() => assertNever('surprise' as never)).toThrow('Unhandled variant: "surprise"');
  });
});
