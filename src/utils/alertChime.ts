/**
 * Audible alerts for events staff must not miss.
 *
 * A kitchen screen sits across the room and a busy front desk is looking at a
 * guest, not a monitor. A QR order that only appears silently gets made late.
 *
 * Synthesised with the Web Audio API rather than shipping sound files. Three
 * reasons: nothing is added to the bundle or fetched at runtime, so a chime is
 * never late or missing on a slow connection; the tone can be shaped per event
 * so an urgent call is distinguishable from an ordinary one without looking;
 * and there is no decoding step, so the cost is a few oscillator nodes that are
 * discarded immediately.
 *
 * Browsers refuse to play audio until the user has interacted with the page.
 * That suits this use: staff sign in before anything can alert them, and that
 * counts as the gesture. The context is created lazily on the first chime and
 * resumed if the browser suspended it, so a tab left open overnight still
 * sounds in the morning.
 */

const STORAGE_KEY = 'hotelopx.alertSound';

type Tone = { frequency: number; duration: number; delay: number };

/**
 * Each alert has its own shape, so a busy operator can tell what happened
 * without looking up. Rising two-note for a new order, a single soft note for
 * routine changes, an insistent triple for anything urgent.
 */
const PATTERNS: Record<string, Tone[]> = {
  order: [
    { frequency: 660, duration: 0.12, delay: 0 },
    { frequency: 880, duration: 0.16, delay: 0.13 }
  ],
  urgent: [
    { frequency: 880, duration: 0.1, delay: 0 },
    { frequency: 880, duration: 0.1, delay: 0.16 },
    { frequency: 1046, duration: 0.2, delay: 0.32 }
  ],
  soft: [{ frequency: 523, duration: 0.14, delay: 0 }]
};

export type ChimeKind = keyof typeof PATTERNS;

let context: AudioContext | null = null;

/** Whether chimes are switched on. Defaults to on; the toggle persists. */
export const isChimeEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Private browsing and blocked site data both throw on access; sound on is
    // the safer default for an operational screen.
    return true;
  }
};

export const setChimeEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Not persisting a preference is a smaller problem than throwing inside a
    // click handler.
  }
};

/**
 * Plays one alert. Never throws: a missing or blocked audio device must not
 * take down the screen that was trying to tell someone about an order.
 */
export const playChime = (kind: ChimeKind = 'soft'): void => {
  if (!isChimeEnabled()) return;

  try {
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    if (!context) context = new AudioCtor();

    // Suspended when the tab was backgrounded, or before the first gesture.
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const now = context.currentTime;

    for (const tone of PATTERNS[kind] ?? PATTERNS.soft) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = tone.frequency;

      // Shaped rather than switched: an abrupt start and stop clicks audibly.
      const start = now + tone.delay;
      const end = start + tone.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);

      // Released as soon as it has sounded; nothing accumulates over a shift.
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    // No audio device, autoplay refused, context limit reached — all of them
    // mean the same thing here: no sound, and the screen carries on.
  }
};
