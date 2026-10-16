import type { Metadata, Viewport } from 'next';
import type { ReactElement, ReactNode } from 'react';

import './global.css';
import '@/ui/tokens.css';

export const metadata: Metadata = {
  title: 'Fleet Ops',
  description: 'Fleet operations and real-time node telemetry.',
};

export const viewport: Viewport = {
  themeColor: '#101820',
};

export interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
