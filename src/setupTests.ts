import '@testing-library/jest-dom';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

/**
 * jsdom polyfills.
 *
 * jsdom implements a deliberately partial browser environment. Each gap below
 * broke a test suite at *import* time — before a single assertion ran — which
 * shows up as "suite failed to run" rather than a normal failure, so they are
 * worth keeping documented.
 */

// MUI reads matchMedia for responsive breakpoints; without it, any tree
// containing Layout throws on render.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });
}

// MUI's layout components observe element size.
if (typeof globalThis !== 'undefined' && !('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// React Router v7 touches TextEncoder at module load, so anything importing
// react-router-dom fails to load without this.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as unknown as typeof globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = NodeTextDecoder as unknown as typeof globalThis.TextDecoder;
}
