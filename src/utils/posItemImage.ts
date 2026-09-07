/**
 * The image to show for a POS item.
 *
 * Every item gets a picture whether or not anyone uploaded one. A menu of grey
 * rectangles reads as unfinished, and on the guest-facing QR page the picture
 * is most of what sells the item.
 *
 * The fallbacks are inline SVG rather than bundled photographs, for three
 * reasons: no asset ships or has to be licensed, they render instantly and
 * offline, and a drawn plate never looks like a photograph of the wrong dish.
 * A real photograph, once uploaded, always wins.
 */

type Palette = { bg: string; fg: string; accent: string };

/**
 * Categories are free text per property — "Drinks", "Soft Drinks", "Bar" —
 * so matching is on keywords rather than an enum, and anything unrecognised
 * falls back to a generic plate.
 */
const KEYWORDS: Array<{ match: RegExp; kind: Kind }> = [
  { match: /drink|beverage|bar|juice|water|soda|cocktail|wine|beer|spirit/i, kind: 'drink' },
  { match: /coffee|tea|hot\s*bev|cappuccino|espresso/i, kind: 'hot-drink' },
  { match: /dessert|cake|ice\s*cream|pastry|sweet/i, kind: 'dessert' },
  { match: /breakfast|continental/i, kind: 'breakfast' },
  { match: /snack|side|starter|appetiser|appetizer|small\s*chops/i, kind: 'snack' },
  { match: /food|main|grill|rice|soup|swallow|dish|kitchen|lunch|dinner/i, kind: 'food' }
];

type Kind = 'food' | 'drink' | 'hot-drink' | 'dessert' | 'breakfast' | 'snack';

const PALETTES: Record<Kind, Palette> = {
  food: { bg: '#FDF6EC', fg: '#B98047', accent: '#8C5C2E' },
  drink: { bg: '#EDF6FB', fg: '#4E9BC4', accent: '#2E6D91' },
  'hot-drink': { bg: '#F6EFEA', fg: '#A9704E', accent: '#7A4A2E' },
  dessert: { bg: '#FBEFF4', fg: '#C4708F', accent: '#96486B' },
  breakfast: { bg: '#FCF7E4', fg: '#C7A33A', accent: '#8E7220' },
  snack: { bg: '#F2F5EC', fg: '#7C9A55', accent: '#546D36' }
};

const classify = (category?: string | null): Kind => {
  const value = category ?? '';
  for (const entry of KEYWORDS) {
    if (entry.match.test(value)) return entry.kind;
  }
  return 'food';
};

/** Each kind gets a distinct silhouette, so the menu is scannable at a glance. */
const SHAPES: Record<Kind, (p: Palette) => string> = {
  food: (p) => `
    <circle cx="60" cy="60" r="34" fill="none" stroke="${p.fg}" stroke-width="3"/>
    <circle cx="60" cy="60" r="22" fill="none" stroke="${p.accent}" stroke-width="2" opacity=".65"/>
    <path d="M34 44c6 8 6 16 0 24" stroke="${p.accent}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M86 44c-6 8-6 16 0 24" stroke="${p.accent}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  drink: (p) => `
    <path d="M44 34h32l-5 34a11 11 0 0 1-22 0z" fill="none" stroke="${p.fg}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 79v10" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 90h20" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>
    <path d="M49 46h22" stroke="${p.accent}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
  'hot-drink': (p) => `
    <path d="M40 48h34v20a17 17 0 0 1-34 0z" fill="none" stroke="${p.fg}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M74 52h7a8 8 0 0 1 0 16h-7" fill="none" stroke="${p.fg}" stroke-width="3"/>
    <path d="M50 34c0 4 4 4 4 8M60 32c0 4 4 4 4 8" stroke="${p.accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M36 90h44" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>`,
  dessert: (p) => `
    <path d="M40 58h40l-6 32H46z" fill="none" stroke="${p.fg}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 58c0-11 9-20 20-20s20 9 20 20" fill="none" stroke="${p.accent}" stroke-width="3"/>
    <circle cx="60" cy="32" r="4" fill="${p.accent}"/>`,
  breakfast: (p) => `
    <ellipse cx="60" cy="62" rx="32" ry="22" fill="none" stroke="${p.fg}" stroke-width="3"/>
    <circle cx="52" cy="60" r="9" fill="none" stroke="${p.accent}" stroke-width="2.5"/>
    <circle cx="72" cy="64" r="7" fill="none" stroke="${p.accent}" stroke-width="2.5"/>`,
  snack: (p) => `
    <path d="M36 76c0-16 11-28 24-28s24 12 24 28z" fill="none" stroke="${p.fg}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 76h56" stroke="${p.fg}" stroke-width="3" stroke-linecap="round"/>
    <path d="M52 60h16" stroke="${p.accent}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`
};

/**
 * A data URI rather than a file request: it cannot 404, needs no round trip,
 * and works on the guest page before anything else has loaded.
 */
export const placeholderImageFor = (category?: string | null): string => {
  const kind = classify(category);
  const palette = PALETTES[kind];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img">
    <rect width="120" height="120" fill="${palette.bg}"/>
    ${SHAPES[kind](palette)}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

/** The uploaded photograph when there is one, otherwise the drawn fallback. */
export const posItemImage = (
  imageUrl?: string | null,
  category?: string | null
): string => (imageUrl && imageUrl.trim() ? imageUrl : placeholderImageFor(category));
