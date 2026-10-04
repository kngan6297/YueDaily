// Native: no-op shell (auth gate is web-only).
import React from 'react';

export function WebAppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
