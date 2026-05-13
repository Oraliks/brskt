'use client';

import { createContext, useContext } from 'react';

interface LandingCtx {
  active: number;
  total: number;
  goTo: (index: number) => void;
}

export const LandingContext = createContext<LandingCtx | null>(null);

export function useLanding(): LandingCtx {
  const ctx = useContext(LandingContext);
  if (!ctx) {
    throw new Error('useLanding must be used within LandingShell');
  }
  return ctx;
}
