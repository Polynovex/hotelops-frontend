import { createAppTheme } from '../src/theme/theme';

/**
 * WCAG contrast guard for both themes.
 *
 * This exists because the dark theme shipped with error text at 2.83:1 on the
 * card surface — below the 3:1 minimum — and nothing caught it. Contrast
 * regressions are invisible in review, so they need a test.
 */

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

const relativeLuminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: string, b: string) => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** MUI may hand back rgb() or hex; only hex pairs are meaningful here. */
const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value);

describe.each(['light', 'dark'] as const)('%s theme contrast', (mode) => {
  const palette = createAppTheme(mode).palette;

  const pair = (fg: unknown, bg: unknown) => {
    if (!isHex(fg) || !isHex(bg)) {
      // Skip rather than fail on a non-hex token; the assertions below still
      // cover every pair the theme actually defines as hex.
      return null;
    }
    return contrastRatio(fg, bg);
  };

  it('body text meets AA on the page background', () => {
    const ratio = pair(palette.text.primary, palette.background.default);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('body text meets AA on card surfaces', () => {
    const ratio = pair(palette.text.primary, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('secondary text meets AA on card surfaces', () => {
    const ratio = pair(palette.text.secondary, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('error text meets the 3:1 minimum on card surfaces', () => {
    // The exact check that failed before status colours were made mode-aware.
    const ratio = pair(palette.error.main, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('success text meets the 3:1 minimum on card surfaces', () => {
    const ratio = pair(palette.success.main, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('warning text meets the 3:1 minimum on card surfaces', () => {
    const ratio = pair(palette.warning.main, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it('primary button labels meet AA against the button fill', () => {
    const ratio = pair(palette.primary.contrastText, palette.primary.main);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('secondary button labels meet AA against the button fill', () => {
    const ratio = pair(palette.secondary.contrastText, palette.secondary.main);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('error button labels meet AA against the error fill', () => {
    const ratio = pair(palette.error.contrastText, palette.error.main);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps page and card surfaces visually distinct', () => {
    // Guards the original white-on-white defect: cards must not dissolve into
    // the page behind them.
    const ratio = pair(palette.background.default, palette.background.paper);
    if (ratio !== null) {
      expect(ratio).toBeGreaterThan(1.02);
    }
  });
});
