import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { supportsWebGL, prefersReducedMotion } from './gl';

// Shared state for the visual effects:
//  - enabled: the user's on/off choice (remembered on this device)
//  - backdrop: the live liquid background canvas, plus listeners that redraw glass panels
//    each time the background draws a new frame (no React re-render per frame)

const STORAGE_KEY = 'afa_fx';
const FxContext = createContext(null);

function readInitialPreference() {
  if (typeof window === 'undefined' || !supportsWebGL()) return false;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch (e) { /* storage blocked: fall back to the default */ }
  return !prefersReducedMotion();
}

export function FxProvider({ children }) {
  const [enabled, setEnabledState] = useState(readInitialPreference);
  const backdrop = useRef({ canvas: null, listeners: new Set() }).current;

  const value = useMemo(() => ({
    enabled,
    supported: typeof window !== 'undefined' && supportsWebGL(),
    backdrop,
    setEnabled: (next) => {
      const on = !!next && supportsWebGL();
      setEnabledState(on);
      try { window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    },
    // Called by a component whose WebGL setup failed, so the app falls back to the plain design
    disable: () => setEnabledState(false)
  }), [enabled, backdrop]);

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

const FALLBACK = { enabled: false, supported: false, backdrop: { canvas: null, listeners: new Set() }, setEnabled: () => {}, disable: () => {} };

export function useFx() {
  return useContext(FxContext) || FALLBACK;
}
