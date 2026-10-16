import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { createMatchMedia } from './layout';

// Wide desktop layout unless a test asks for another one with `mockNarrowLayout`. Server tests
// run in the node environment, which has no window.
if (typeof window !== 'undefined') {
  window.matchMedia = createMatchMedia(() => false);
}

afterEach(cleanup);
