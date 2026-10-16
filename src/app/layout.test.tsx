// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RootLayout, { metadata, viewport } from './layout';

describe('root layout', () => {
  it('names and describes the document', () => {
    expect(metadata.title).toBe('Fleet Ops');
    expect(metadata.description).toBe('Fleet operations and real-time node telemetry.');
  });

  it('sets the browser theme color', () => {
    expect(viewport.themeColor).toBe('#101820');
  });

  it('wraps its children in an English document', () => {
    const html = renderToString(
      <RootLayout>
        <p>content</p>
      </RootLayout>,
    );

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<body><p>content</p></body>');
  });
});
